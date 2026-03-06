// /api/article — extracts full article content from a given URL on demand.
// Called per-article when the user wants to read the full text.

import { extract } from "@extractus/article-extractor";

const EXTRACT_TIMEOUT = 8000; // 8s max per article

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=172800"); // cache 24h

    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: "Missing ?url= parameter" });
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT);

        const article = await extract(url, {
            signal: controller.signal,
        });
        clearTimeout(timer);

        if (!article || !article.content) {
            return res.status(200).json({ status: "ok", content: null });
        }

        // article.content is HTML — extract text from <p> tags and other block elements
        const paragraphs = article.content
            .split(/<\/(?:p|div|h[1-6]|li|blockquote)>/gi)
            .map((chunk) =>
                chunk
                    .replace(/<[^>]*>/g, "")
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&nbsp;/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
            )
            .filter((p) => p.length > 30);

        return res.status(200).json({
            status: "ok",
            content: paragraphs.length > 0 ? paragraphs : null,
        });
    } catch (err) {
        console.error("[api/article]", err.message);
        return res.status(200).json({ status: "ok", content: null });
    }
}
