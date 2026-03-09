// /api/news — live endpoint that fetches from Bing News RSS on demand.
// Kept as a fallback / manual testing endpoint. Frontend now uses /api/articles.

import { fetchAndFilterArticles } from "./lib/newsCore.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const articles = await fetchAndFilterArticles();

    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    const results = articles.map((a, i) => {
      const dateMs = a.date ? new Date(a.date).getTime() : 0;
      return {
        id: `live-${a.provider}-${i}-${now}`,
        provider: a.provider,
        headline: a.headline,
        summary: a.summary,
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
