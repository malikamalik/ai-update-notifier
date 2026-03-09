// /api/articles — reads articles from Firestore for the frontend.
// Uses Firebase client SDK — no service account needed.

import { db } from "./lib/firestore.js";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore/lite";

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const articlesRef = collection(db, "articles");
    let q;

    const { provider } = req.query;
    if (provider) {
      q = query(articlesRef, where("provider", "==", provider), orderBy("date", "desc"), limit(30));
    } else {
      q = query(articlesRef, orderBy("date", "desc"), limit(30));
    }

    const snapshot = await getDocs(q);
    const now = Date.now();

    const articles = snapshot.docs.map((d) => {
      const data = d.data();
      const dateMs = data.date ? new Date(data.date).getTime() : 0;
      return {
        id: d.id,
        provider: data.provider,
        headline: data.headline,
        summary: data.summary,
        date: data.date,
        isNew: dateMs > 0 && now - dateMs < THREE_DAYS,
        link: data.url,
        source: data.source || "",
        isLive: true,
      };
    });

    return res.status(200).json({ status: "ok", articles });
  } catch (err) {
    console.error("[api/articles]", err);
    return res.status(502).json({ error: err.message });
  }
}
