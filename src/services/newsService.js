// Client-side: just calls /api/news which handles everything server-side
// (fetching, filtering, deduplication, and article summary enrichment)
const FETCH_TIMEOUT = 15000;

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

function getApiUrl() {
  const base = import.meta.env.DEV ? "http://localhost:3000" : "";
  return `${base}/api/news`;
}

export async function fetchAllNews() {
  const res = await fetchWithTimeout(getApiUrl(), FETCH_TIMEOUT);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== "ok") throw new Error(data.error || "API error");
  return data.articles || [];
}

export function hasApiKey() {
  return true;
}
