// /api/cron/daily-news — runs 4x/day via Vercel cron + external trigger.
// Fetches news, deduplicates against Firestore, extracts article text,
// generates AI summaries via OpenRouter, and writes to Firestore.

import crypto from "crypto";
import { db } from "../lib/firestore.js";
import { fetchAndFilterArticles, extractArticleText } from "../lib/newsCore.js";
import { generateSummary } from "../lib/openrouter.js";
import {
  collection, query, where, getDocs,
  doc, writeBatch, serverTimestamp,
} from "firebase/firestore/lite";

const MAX_DURATION = 55000; // stop processing 5s before Vercel's 60s limit
const BATCH_SIZE = 5;

function urlHash(url) {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 20);
}

// Process items in parallel batches of `size`
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
  // Verify cron auth — accept Vercel's header OR ?secret= query param (for external triggers)
  const headerAuth = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const queryAuth = req.query.secret === process.env.CRON_SECRET;
  if (!headerAuth && !queryAuth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const startTime = Date.now();
  const timeRemaining = () => MAX_DURATION - (Date.now() - startTime);

  try {
    // Step 1: Fetch + filter articles from Bing RSS
    const articles = await fetchAndFilterArticles();
    console.log(`[cron] Fetched ${articles.length} filtered articles`);

    if (articles.length === 0) {
      return res.status(200).json({ status: "ok", processed: 0, skipped: 0 });
    }

    // Step 2: Deduplicate against Firestore by URL
    const urls = articles.map((a) => a.link);
    const existingUrls = new Set();

    // Firestore 'in' queries support max 30 values — we have max 20, so one query is fine
    const articlesRef = collection(db, "articles");
    const q = query(articlesRef, where("url", "in", urls));
    const snapshot = await getDocs(q);
    snapshot.forEach((d) => {
      const data = d.data();
      if (data.url) existingUrls.add(data.url);
    });

    const newArticles = articles.filter((a) => !existingUrls.has(a.link));
    console.log(`[cron] ${newArticles.length} new, ${articles.length - newArticles.length} already in Firestore`);

    if (newArticles.length === 0) {
      return res.status(200).json({ status: "ok", processed: 0, skipped: articles.length });
    }

    // Step 3: Extract full article text (parallel, batches of 5)
    if (timeRemaining() < 10000) {
      console.log("[cron] Low time, skipping extraction");
      return res.status(200).json({ status: "ok", processed: 0, skipped: articles.length, reason: "timeout" });
    }

    const extractResults = await processInBatches(newArticles, BATCH_SIZE, async (article) => {
      const text = await extractArticleText(article.link);
      console.log(`[cron] Extract ${article.link.slice(0, 60)}... → ${text ? text.length + " chars" : "FAILED"}`);
      return { ...article, fullText: text };
    });

    const enrichedArticles = extractResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    const extracted = enrichedArticles.filter((a) => a.fullText).length;
    console.log(`[cron] Extracted text for ${extracted}/${enrichedArticles.length} articles`);

    // Step 4: Generate AI summaries (parallel, batches of 5) — fall back to RSS description
    if (timeRemaining() < 10000) {
      console.log("[cron] Low time, skipping summary generation");
      return res.status(200).json({ status: "ok", processed: 0, skipped: articles.length, reason: "timeout" });
    }

    const summaryResults = await processInBatches(enrichedArticles, BATCH_SIZE, async (article) => {
      if (timeRemaining() < 5000) return article; // skip if running low
      const textForSummary = article.fullText || article.summary || "";
      if (!textForSummary) {
        console.warn(`[cron] No text at all for "${article.headline.slice(0, 50)}...", skipping`);
        return article;
      }
      if (!article.fullText) {
        console.log(`[cron] Using RSS description as fallback for "${article.headline.slice(0, 50)}..."`);
      }
      const aiSummary = await generateSummary(textForSummary, article.headline, article.link);
      console.log(`[cron] Summary for "${article.headline.slice(0, 50)}..." → ${aiSummary ? aiSummary.length + " chars" : "FAILED"}`);
      return { ...article, aiSummary };
    });

    // Merge AI summaries back
    for (let i = 0; i < enrichedArticles.length; i++) {
      const result = summaryResults[i];
      if (result.status === "fulfilled" && result.value.aiSummary) {
        enrichedArticles[i].aiSummary = result.value.aiSummary;
      }
    }

    // Only keep articles that got an AI summary — never store RSS descriptions
    const readyArticles = enrichedArticles.filter((a) => a.aiSummary);
    const dropped = enrichedArticles.length - readyArticles.length;
    if (dropped > 0) {
      console.warn(`[cron] Dropped ${dropped} articles without AI summary`);
    }

    // Step 5: Batch write to Firestore
    const batch = writeBatch(db);
    let processed = 0;

    for (const article of readyArticles) {
      const docId = urlHash(article.link);
      const ref = doc(db, "articles", docId);
      batch.set(ref, {
        url: article.link,
        headline: article.headline,
        description: article.summary,
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
      skipped: articles.length - newArticles.length,
      dropped,
      elapsed: Date.now() - startTime,
    });
  } catch (err) {
    console.error("[cron]", err);
    return res.status(500).json({ error: err.message });
  }
}
