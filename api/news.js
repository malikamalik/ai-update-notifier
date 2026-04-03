// /api/news — live endpoint that fetches from Bing News RSS,
// extracts article text, generates AI summaries, and deduplicates by content.

import { fetchAndFilterArticles, extractArticleText, extractArticleImage } from "./lib/newsCore.js";
import { generateSummary, deduplicateByContent } from "./lib/openrouter.js";

const BATCH_SIZE = 5;

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=3600"); // 12h cache, 1h stale

  try {
    let articles = await fetchAndFilterArticles();
    console.log(`[news] Fetched ${articles.length} articles`);

    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    // Step 1: AI content dedup
    if (articles.length > 1) {
      try {
        const headlines = articles.map((a) => a.headline);
        const toRemove = await deduplicateByContent(headlines, []);
        if (toRemove.length > 0) {
          const removeSet = new Set(toRemove);
          articles = articles.filter((_, i) => !removeSet.has(i));
          console.log(`[news] Dedup removed ${toRemove.length}, ${articles.length} remaining`);
        }
      } catch (e) {
        console.warn("[news] Dedup failed:", e.message);
      }
    }

    // Step 2: Extract article text, images, and generate AI summaries in batches
    const enrichResults = await processInBatches(articles, BATCH_SIZE, async (article) => {
      try {
        // Extract image and text in parallel
        const [text, image] = await Promise.all([
          extractArticleText(article.link).catch(() => null),
          extractArticleImage(article.link).catch(() => null),
        ]);

        const inputText = text || `Headline: ${article.headline}\nDescription: ${article.summary}`;
        if (!text) console.warn(`[news] Using RSS fallback for: ${article.headline.slice(0, 50)}`);

        const aiSummary = await generateSummary(inputText, article.headline, article.link);
        if (aiSummary) {
          console.log(`[news] AI summary for: ${article.headline.slice(0, 50)}`);
        }
        return { ...article, aiSummary: aiSummary || null, image: image || null };
      } catch (e) {
        console.warn(`[news] Enrich failed for "${article.headline.slice(0, 40)}": ${e.message}`);
      }
      return article;
    });

    const enrichedArticles = enrichResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    const aiCount = enrichedArticles.filter((a) => a.aiSummary).length;
    console.log(`[news] ${aiCount}/${enrichedArticles.length} articles enriched with AI`);

    const results = enrichedArticles.map((a, i) => {
      const dateMs = a.date ? new Date(a.date).getTime() : 0;
      return {
        id: `live-${a.provider}-${i}-${now}`,
        provider: a.provider,
        headline: a.headline,
        description: a.summary,
        summary: a.aiSummary || a.summary,
        date: a.date || new Date().toISOString().split("T")[0],
        isNew: dateMs > 0 && now - dateMs < THREE_DAYS,
        link: a.link,
        source: a.source,
        image: a.image || null,
        isLive: true,
      };
    });

    results.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({ status: "ok", articles: results });
  } catch (err) {
    console.error("[api/news]", err);
    return res.status(502).json({ error: err.message });
  }
}
