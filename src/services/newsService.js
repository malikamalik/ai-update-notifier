// Client-side: tries /api/articles (Firestore, has AI summaries) first,
// falls back to /api/news (live RSS) if Firestore endpoint is unavailable.
const FETCH_TIMEOUT = 90000; // 90s — /api/news generates AI summaries which takes time

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

function getBaseUrl() {
  return import.meta.env.VITE_API_URL || "";
}

export async function fetchAllNews() {
  const base = getBaseUrl();

  // Try Firestore endpoint first (has AI-generated TL;DR + bullet summaries)
  try {
    const res = await fetchWithTimeout(base ? base : "/api/articles", FETCH_TIMEOUT);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "ok" && data.articles?.length > 0) {
        return data.articles;
      }
    }
  } catch { /* fall through to /api/news */ }

  // Fallback to live RSS endpoint — add v param to bust stale CDN cache on deploy
  const fallbackUrl = base
    ? base.replace(/\/api\/articles$/, "/api/news")
    : "/api/news";
  const res = await fetchWithTimeout(`${fallbackUrl}?v=2`, FETCH_TIMEOUT);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== "ok") throw new Error(data.error || "API error");
  return data.articles || [];
}

export function hasApiKey() {
  return true;
}
