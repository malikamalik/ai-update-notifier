// /api/cron/daily-news — runs via external cron trigger (cron-jobs.org).
// Fetches news, deduplicates against Firestore, extracts article text,
// generates AI summaries via Gemini, and writes to Firestore.

import crypto from "crypto";
import { db } from "../lib/firestore.js";
import { fetchAndFilterArticles, extractArticleText, wordOverlap } from "../lib/newsCore.js";
import { generateSummary, fixTruncatedDescription, deduplicateByContent } from "../lib/openrouter.js";
import {
  collection, query, where, getDocs, orderBy, limit,
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
    // Step 1: Fetch + filter articles from Bing RSS (retry once if Bing returns nothing)
    let articles = await fetchAndFilterArticles();
    if (articles.length === 0 && timeRemaining() > 20000) {
      console.log("[cron] Bing returned 0 articles, retrying in 3s...");
      await new Promise((r) => setTimeout(r, 3000));
      articles = await fetchAndFilterArticles();
    }
    console.log(`[cron] Fetched ${articles.length} filtered articles`);

    if (articles.length === 0) {
      return res.status(200).json({ status: "ok", processed: 0, skipped: 0 });
    }

    // Step 2: Deduplicate against Firestore by URL, headline, and provider
    const articlesRef = collection(db, "articles");

    // 2a: Exact URL match
    const urls = articles.map((a) => a.link);
    const existingUrls = new Set();
    const urlQuery = query(articlesRef, where("url", "in", urls));
    const urlSnap = await getDocs(urlQuery);
    urlSnap.forEach((d) => {
      const data = d.data();
      if (data.url) existingUrls.add(data.url);
    });

    // 2b: Fetch recent headlines for headline similarity check
    const recentQuery = query(articlesRef, orderBy("createdAt", "desc"), limit(50));
    const recentSnap = await getDocs(recentQuery);
    const recentArticles = recentSnap.docs.map((d) => d.data());

    const newArticles = articles.filter((a) => {
      // Skip exact URL match
      if (existingUrls.has(a.link)) return false;
      // Skip if a recent Firestore article from the same provider has a similar headline
      const isDupe = recentArticles.some(
        (existing) =>
          existing.provider === a.provider &&
          wordOverlap(a.headline, existing.headline) >= 0.4
      );
      if (isDupe) {
        console.log(`[cron] Headline dedup: "${a.headline.slice(0, 50)}..." matches existing`);
      }
      return !isDupe;
    });

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

    // Step 4: Generate AI summaries (parallel, batches of 5)
    if (timeRemaining() < 10000) {
      console.log("[cron] Low time, skipping summary generation");
      return res.status(200).json({ status: "ok", processed: 0, skipped: articles.length, reason: "timeout" });
    }

    const summaryResults = await processInBatches(enrichedArticles, BATCH_SIZE, async (article) => {
      if (timeRemaining() < 5000) return article; // skip if running low
      const inputText = article.fullText
        || `Headline: ${article.headline}\nDescription: ${article.summary}`;
      if (!article.fullText) {
        console.warn(`[cron] No extracted text for "${article.headline.slice(0, 50)}...", using RSS fallback`);
      }
      const aiSummary = await generateSummary(inputText, article.headline, article.link);
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
    let readyArticles = enrichedArticles.filter((a) => a.aiSummary);
    const dropped = enrichedArticles.length - readyArticles.length;
    if (dropped > 0) {
      console.warn(`[cron] Dropped ${dropped} articles without AI summary`);
    }

    // Step 5: Fix truncated RSS descriptions (ending with "...")
    await processInBatches(readyArticles, BATCH_SIZE, async (article) => {
      if (article.summary && article.summary.endsWith("...")) {
        article.summary = await fixTruncatedDescription(article.summary, article.headline);
        console.log(`[cron] Fixed description for "${article.headline.slice(0, 50)}..."`);
      }
    });

    // Step 6: Semantic dedup — remove articles covering the same story (different sources)
    if (readyArticles.length > 0 && timeRemaining() > 10000) {
      // Fetch recent headlines from Firestore to compare against
      const recentQuery = query(articlesRef, orderBy("createdAt", "desc"), limit(50));
      const recentSnap = await getDocs(recentQuery);
      const existingHeadlines = recentSnap.docs.map((d) => d.data().headline);

      const newHeadlines = readyArticles.map((a) => a.headline);
      const toRemove = await deduplicateByContent(newHeadlines, existingHeadlines);

      if (toRemove.length > 0) {
        const removeSet = new Set(toRemove);
        const before = readyArticles.length;
        readyArticles = readyArticles.filter((_, i) => !removeSet.has(i));
        console.log(`[cron] Semantic dedup removed ${before - readyArticles.length} duplicate stories`);
      }
    }

    // Step 7: Batch write to Firestore
    const batch = writeBatch(db);
    let processed = 0;

    for (const article of readyArticles) {
      const docId = urlHash(article.link);
      const ref = doc(db, "articles", docId);
      // Extract TL;DR line from AI summary for the description field
      let description = article.summary;
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
      skipped: articles.length - newArticles.length,
      dropped,
      elapsed: Date.now() - startTime,
    });
  } catch (err) {
    console.error("[cron]", err);
    return res.status(500).json({ error: err.message });
  }
}
