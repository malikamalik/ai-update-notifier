// /api/news — live endpoint that uses Gemini web research to fetch AI news,
// enriches with TL;DR summaries and images, deduplicates, and returns JSON.

import { extractArticleImage, detectProvider, isFeatureArticle } from "./lib/newsCore.js";
import { researchAiNews } from "./lib/geminiResearch.js";
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
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");

  try {
    const researched = await researchAiNews();
    console.log(`[news] Gemini research returned ${researched.length} articles`);

    // Normalize + filter to tracked providers only
    const articles = researched
      .map((a) => ({
        link: a.url,
        headline: a.headline,
        source: a.source || "",
        provider: detectProvider(a.headline) || detectProvider(a.description) || a.provider || null,
        date: a.publication_date,
        description: a.description,
        summary: a.description,
      }))
      .filter((a) => a.provider && a.provider !== "misc")
      .filter((a) => isFeatureArticle(a.headline, a.description));

    console.log(`[news] ${articles.length} pass feature filter`);

    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    // Enrich: generate TL;DR + fetch og:image
    const enrichResults = await processInBatches(articles, BATCH_SIZE, async (article) => {
      try {
        const [aiSummary, image] = await Promise.all([
          generateSummary(article.description, article.headline).catch(() => null),
          extractArticleImage(article.link).catch(() => null),
        ]);
        return { ...article, aiSummary: aiSummary || null, image: image || null };
      } catch (e) {
        console.warn(`[news] Enrich failed for "${article.headline.slice(0, 40)}": ${e.message}`);
        return article;
      }
    });

    const enrichedArticles = enrichResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    const aiCount = enrichedArticles.filter((a) => a.aiSummary).length;
    console.log(`[news] ${aiCount}/${enrichedArticles.length} enriched with AI summaries`);

    // Semantic dedup
    let deduped = enrichedArticles;
    if (enrichedArticles.length > 0) {
      const toRemove = await deduplicateByContent(enrichedArticles, []);
      if (toRemove.length > 0) {
        const removeSet = new Set(toRemove);
        deduped = enrichedArticles.filter((_, i) => !removeSet.has(i));
        console.log(`[news] Semantic dedup removed ${toRemove.length} duplicates`);
      }
    }

    const results = deduped.map((a, i) => {
      const dateMs = a.date ? new Date(a.date).getTime() : 0;
      let description = a.description;
      if (a.aiSummary) {
        const tldrMatch = a.aiSummary.match(/^TL;?DR:?\s*(.+?)(?:\n|$)/i);
        if (tldrMatch) description = tldrMatch[1].trim();
      }
      return {
        id: `live-${a.provider}-${i}-${now}`,
        provider: a.provider,
        headline: a.headline,
        description,
        summary: a.aiSummary || a.description,
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
