// Fetches AI news via our own Vercel serverless function (/api/rss)
// which proxies Google News RSS server-side — no CORS, no third-party proxy
const FETCH_TIMEOUT = 10000; // 10s timeout per request

// 3 grouped queries — each uses OR between product names
const GROUPED_QUERIES = [
  '"ChatGPT" OR "Claude" OR "Gemini" OR "DeepSeek" OR "Kimi"',
  '"Grok" OR "Mistral" OR "Copilot" OR "Perplexity" OR "Llama"',
  '"Figma" OR "Firefly" OR "Midjourney" OR "UX Pilot"',
];

// Map article titles to providers by detecting product/company names
const PROVIDER_MATCHERS = [
  { provider: "openai", keywords: ["chatgpt", "openai", "gpt-5", "gpt-4", "codex", "dall-e"] },
  { provider: "anthropic", keywords: ["claude", "anthropic"] },
  { provider: "gemini", keywords: ["gemini"] },
  { provider: "google", keywords: ["google ai", "google deepmind"] },
  { provider: "deepseek", keywords: ["deepseek"] },
  { provider: "kimi", keywords: ["kimi", "moonshot ai", "moonshot"] },
  { provider: "meta", keywords: ["llama", "meta ai"] },
  { provider: "xai", keywords: ["grok", "xai", "x.ai"] },
  { provider: "mistral", keywords: ["mistral"] },
  { provider: "microsoft", keywords: ["copilot", "microsoft ai"] },
  { provider: "perplexity", keywords: ["perplexity"] },
  { provider: "figma", keywords: ["figma"] },
  { provider: "adobe", keywords: ["firefly", "adobe ai", "adobe firefly"] },
  { provider: "midjourney", keywords: ["midjourney"] },
  { provider: "uxpilot", keywords: ["ux pilot", "uxpilot"] },
];

function detectProvider(title) {
  const t = title.toLowerCase();
  for (const { provider, keywords } of PROVIDER_MATCHERS) {
    if (keywords.some((kw) => t.includes(kw))) return provider;
  }
  return null;
}

// Words that signal a feature/product article
const FEATURE_KEYWORDS = [
  "launch", "launches", "launched",
  "release", "releases", "released",
  "introduces", "introducing", "introduce",
  "rolls out", "rolling out", "rollout",
  "new feature", "new tool", "new model", "new capability",
  "now available", "now supports",
  "announces", "announced", "announcing",
  "unveiled", "unveils", "unveiling",
  "debuts", "debuted", "debuting",
  "adds", "added", "adding",
  "ships", "shipping", "shipped",
  "upgrade", "upgraded",
  "update", "updated",
  "beta", "preview", "general availability",
  "v2", "v3", "v4", "v5", "v6", "v7", "v8",
  "integration", "plugin", "add-in",
  "api", "sdk",
  "open source", "open-source",
  "powered by", "built on",
];

// Words that signal non-feature noise (matched with word boundaries)
const REJECT_KEYWORDS = [
  "lawsuit", "sued", "suing",
  "ipo", "valuation", "funding round",
  "stock price", "stock drop", "stock fall", "stock slide",
  "shares drop", "shares fall", "shares slide",
  "investor", "investors",
  "layoff", "layoffs", "fired", "hiring freeze",
  "regulation", "banned", "crackdown",
  "controversy", "backlash", "criticized",
  "opinion", "editorial",
  "competitor", "rivalry",
  "revenue", "earnings", "profit",
  "acquisition", "acquires", "merger",
  "security breach", "data leak", "data breach",
  "antitrust", "monopoly",
];

const REJECT_PATTERNS = REJECT_KEYWORDS.map(
  (kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")
);

function isFeatureArticle(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const hasReject = REJECT_PATTERNS.some((re) => re.test(text));
  if (hasReject) return false;
  const hasFeature = FEATURE_KEYWORDS.some((kw) => text.includes(kw));
  return hasFeature;
}

function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff >= 0 && diff < days * 24 * 60 * 60 * 1000;
}

function cleanHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
    .slice(0, 350);
}

function mapItemToUpdate(item, provider, index) {
  const description = cleanHtml(item.description || "");
  return {
    id: `live-${provider}-${index}-${Date.now()}`,
    provider,
    headline: item.title?.replace(/ - .*$/, "").trim() || "Untitled",
    summary: description || "Click to read the full article.",
    date:
      item.pubDate?.split(" ")[0] ||
      new Date().toISOString().split("T")[0],
    isNew: isWithinDays(item.pubDate, 3),
    link: item.link || "",
    source: item.source || item.title?.match(/ - (.+)$/)?.[1] || "",
    isLive: true,
  };
}

// Fetch with timeout so the spinner never hangs
function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Build the API URL — works in both dev (localhost) and prod (Vercel)
function getApiUrl(query) {
  const base = import.meta.env.DEV ? "http://localhost:3000" : "";
  return `${base}/api/rss?q=${encodeURIComponent(query)}`;
}

async function fetchGroupedNews(query, groupIndex) {
  try {
    const res = await fetchWithTimeout(getApiUrl(query), FETCH_TIMEOUT);

    if (!res.ok) {
      console.warn(`[NewsService] Group ${groupIndex}: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (data.status !== "ok") {
      console.warn(`[NewsService] Group ${groupIndex}: API error`, data.error || "");
      return [];
    }

    const results = [];
    for (const item of data.items || []) {
      const title = item.title || "";
      const desc = cleanHtml(item.description || "");

      // Detect which provider this article belongs to
      const provider = detectProvider(title);
      if (!provider) continue;

      // Filter to feature articles only
      if (!isFeatureArticle(title, desc)) continue;

      results.push(mapItemToUpdate(item, provider, results.length));
    }

    console.log(`[NewsService] Group ${groupIndex}: ${results.length} articles`);
    return results;
  } catch (err) {
    const reason = err.name === "AbortError" ? "timeout" : err.message;
    console.warn(`[NewsService] Group ${groupIndex}: ${reason}`);
    return [];
  }
}

export async function fetchAllNews() {
  // Fetch all 3 groups in parallel — our own API, no rate limits
  const promises = GROUPED_QUERIES.map((query, i) =>
    fetchGroupedNews(query, i + 1)
  );

  const allResults = await Promise.all(promises);
  const results = allResults.flat();

  // Sort by date descending
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  console.log(`[NewsService] Total: ${results.length} live articles`);
  return results;
}

// Always available — no API key needed
export function hasApiKey() {
  return true;
}
