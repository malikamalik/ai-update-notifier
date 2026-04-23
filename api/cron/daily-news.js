// /api/cron/daily-news — runs via external cron trigger (cron-jobs.org).
// Uses Gemini 3 Flash with Google Search grounding to research AI news, deduplicates
// against Firestore, generates TL;DR summaries, and writes to the articles collection.

import crypto from "crypto";
import { db } from "../lib/firestore.js";
import { wordOverlap, detectProvider, isFeatureArticle } from "../lib/newsCore.js";
import { researchAiNews } from "../lib/geminiResearch.js";
import { generateSummary, deduplicateByContent } from "../lib/openrouter.js";
import {
  collection, query, where, getDocs, orderBy, limit,
  doc, writeBatch, serverTimestamp,
} from "firebase/firestore/lite";

const MAX_DURATION = 290000; // stop processing 10s before Vercel's 300s limit
const BATCH_SIZE = 5;

function urlHash(url) {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 20);
}

async function processInBatches(items, size, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export default async function handler(req, res) {
  // Cron auth — accept Vercel header OR ?secret= query param (for cron-jobs.org)
  const headerAuth = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const queryAuth = req.query.secret === process.env.CRON_SECRET;
  if (!headerAuth && !queryAuth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const startTime = Date.now();
  const timeRemaining = () => MAX_DURATION - (Date.now() - startTime);

  try {
    // Step 1: Gemini researches live AI news from the web
    const researched = await researchAiNews();
    console.log(`[cron] Gemini research returned ${researched.length} articles`);

    if (researched.length === 0) {
      return res.status(200).json({ status: "ok", processed: 0, skipped: 0, reason: "no-articles" });
    }

    // Normalize to internal shape and filter to tracked providers only.
    const normalized = researched
      .map((a) => {
        const detected = detectProvider(a.headline) || detectProvider(a.description);
        return {
          link: a.url,
          headline: a.headline,
          source: a.source || "",
          provider: detected || a.provider || null,
          date: a.publication_date,
          description: a.description,
        };
      })
      .filter((a) => a.provider && a.provider !== "misc")
      .filter((a) => isFeatureArticle(a.headline, a.description));

    console.log(`[cron] ${normalized.length} articles pass feature filter`);

    if (normalized.length === 0) {
      return res.status(200).json({ status: "ok", processed: 0, skipped: researched.length, reason: "no-feature-articles" });
    }

    // Step 2: Dedup against Firestore (URL + headline+provider overlap)
    const articlesRef = collection(db, "articles");

    // 2a: URL exact match (chunk by 30 — Firestore 'in' limit)
    const existingUrls = new Set();
    const links = normalized.map((a) => a.link);
    for (let i = 0; i < links.length; i += 30) {
      const chunk = links.slice(i, i + 30);
      if (chunk.length === 0) continue;
      const urlQuery = query(articlesRef, where("url", "in", chunk));
      const urlSnap = await getDocs(urlQuery);
      urlSnap.forEach((d) => {
        const data = d.data();
        if (data.url) existingUrls.add(data.url);
      });
    }

    // 2b: Headline+provider word overlap against recent 50 docs
    const recentQuery = query(articlesRef, orderBy("createdAt", "desc"), limit(50));
    const recentSnap = await getDocs(recentQuery);
    const recentArticles = recentSnap.docs.map((d) => d.data());

    const newArticles = normalized.filter((a) => {
      if (existingUrls.has(a.link)) return false;
      const dupe = recentArticles.some(
        (e) => e.provider === a.provider && wordOverlap(a.headline, e.headline) >= 0.4
      );
      if (dupe) {
        console.log(`[cron] Headline dedup: "${a.headline.slice(0, 50)}..." matches existing`);
      }
      return !dupe;
    });

    console.log(`[cron] ${newArticles.length} new, ${normalized.length - newArticles.length} already in Firestore`);

    if (newArticles.length === 0) {
      return res.status(200).json({ status: "ok", processed: 0, skipped: normalized.length });
    }

    // Step 3: Generate TL;DR summaries (parallel batches of 5)
    if (timeRemaining() < 20000) {
      return res.status(200).json({ status: "ok", processed: 0, skipped: normalized.length, reason: "timeout" });
    }

    const summaryResults = await processInBatches(newArticles, BATCH_SIZE, async (a) => {
      if (timeRemaining() < 10000) return a;
      const aiSummary = await generateSummary(a.description, a.headline);
      return { ...a, aiSummary };
    });

    const enriched = summaryResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    let readyArticles = enriched.filter((a) => a.aiSummary);
    const dropped = enriched.length - readyArticles.length;
    if (dropped > 0) {
      console.warn(`[cron] Dropped ${dropped} articles without AI summary`);
    }

    // Step 4: Semantic dedup via Gemini
    if (readyArticles.length > 0 && timeRemaining() > 15000) {
      const toRemove = await deduplicateByContent(readyArticles, recentArticles);
      if (toRemove.length > 0) {
        const removeSet = new Set(toRemove);
        const before = readyArticles.length;
        readyArticles = readyArticles.filter((_, i) => !removeSet.has(i));
        console.log(`[cron] Semantic dedup removed ${before - readyArticles.length} stories`);
      }
    }

    // Step 5: Batch write to Firestore
    const batch = writeBatch(db);
    let processed = 0;

    for (const article of readyArticles) {
      const docId = urlHash(article.link);
      const ref = doc(db, "articles", docId);

      // Use TL;DR line of AI summary as description
      let description = article.description;
      if (article.aiSummary) {
        const tldrMatch = article.aiSummary.match(/^TL;?DR:?\s*(.+?)(?:\n|$)/i);
        if (tldrMatch) description = tldrMatch[1].trim();
      }

      batch.set(ref, {
        url: article.link,
        headline: article.headline,
        description,
        summary: article.aiSummary,
        provider: article.provider,
        source: article.source || "",
        date: article.date || new Date().toISOString().split("T")[0],
        createdAt: serverTimestamp(),
      });
      processed++;
    }

    await batch.commit();
    console.log(`[cron] Wrote ${processed} articles to Firestore`);

    return res.status(200).json({
      status: "ok",
      processed,
      skipped: normalized.length - newArticles.length,
      dropped,
      elapsed: Date.now() - startTime,
    });
  } catch (err) {
    console.error("[cron]", err);
    return res.status(500).json({ error: err.message });
  }
}
