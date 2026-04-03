// /api/news — live endpoint that fetches from Bing News RSS,
// extracts article text, and generates AI summaries with TL;DR + bullets.

import { fetchAndFilterArticles, extractArticleText } from "./lib/newsCore.js";
import { generateSummary } from "./lib/openrouter.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const articles = await fetchAndFilterArticles();

    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    // Enrich top articles with AI summaries (parallel, max 5 at a time)
    const enriched = await Promise.allSettled(
      articles.slice(0, 10).map(async (a) => {
        try {
          const fullText = await extractArticleText(a.link);
          if (fullText) {
            const aiSummary = await generateSummary(fullText, a.headline, a.link);
            if (aiSummary) return { ...a, aiSummary };
          }
        } catch { /* use RSS summary as fallback */ }
        return a;
      })
    );

    const enrichedArticles = enriched
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    // Add remaining articles without enrichment
    const remaining = articles.slice(10);

    const results = [...enrichedArticles, ...remaining].map((a, i) => {
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
