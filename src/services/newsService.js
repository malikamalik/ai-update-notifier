// Fetches AI news via our own Vercel serverless function (/api/rss)
// which proxies Google News RSS server-side — no CORS, no third-party proxy
const FETCH_TIMEOUT = 10000; // 10s timeout per request

// Grouped queries — broad enough to catch articles, filtering handles noise
// "Adobe Firefly" not "Firefly" (avoids rockets, insects, garden lights)
const GROUPED_QUERIES = [
  '"ChatGPT" OR "Claude" OR "Gemini" OR "DeepSeek" OR "Kimi"',
  '"Grok" OR "Mistral" OR "GitHub Copilot" OR "Perplexity" OR "Llama"',
  '"Figma" OR "Adobe Firefly" OR "Midjourney" OR "UX Pilot"',
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
  { provider: "adobe", keywords: ["adobe firefly", "adobe ai"] },
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

// Words that signal a real feature/product/launch article
const FEATURE_KEYWORDS = [
  "launch", "launches", "launched",
  "release", "releases", "released",
  "introduces", "introducing", "introduce",
  "rolls out", "rolling out", "rollout",
  "new feature", "new tool", "new model", "new capability",
  "now available", "now supports", "now generally available",
  "announces", "announced", "announcing",
  "unveiled", "unveils", "unveiling",
  "debuts", "debuted", "debuting",
  "ships", "shipping", "shipped",
  "upgrade", "upgraded",
  "generally available",
  "public preview",
  "integration", "plugin", "add-in",
  "open source", "open-source",
  "new version",
];

// Reject patterns — anything financial, political, legal, scandal, opinion, or unrelated
const REJECT_KEYWORDS = [
  // Financial / market / stock
  "stock", "shares", "ipo", "valuation", "market cap", "market share",
  "funding", "funding round", "raise", "billion",
  "investor", "investors", "investment",
  "revenue", "earnings", "profit", "quarterly", "financial results",
  "price target", "analyst", "rating", "sector perform",
  "buy rating", "sell rating", "outperform", "underperform",
  "NYSE", "NASDAQ", "hedge fund", "portfolio",
  "Q1 ", "Q2 ", "Q3 ", "Q4 ",
  "fiscal year", "guidance", "forecast",
  "soars", "surges", "plunges", "tumbles", "climbs", "jumps",
  "selloff", "sell-off", "rally", "rebound",
  // Legal / political / government
  "lawsuit", "sued", "suing", "class action",
  "probe", "inquiry", "investigation", "indictment",
  "antitrust", "monopoly", "regulation", "banned", "crackdown",
  "pentagon", "military", "raid", "defense", "weapon", "troops",
  "government", "congress", "democrat", "republican", "senator",
  // Scandal / controversy / negative
  "deepfake", "sexual", "porn", "nude", "non-consensual",
  "controversy", "backlash", "criticized", "scandal",
  "data breach", "data leak", "security breach",
  "malware", "scam", "phishing",
  "bug ", "bug,", "exposing", "exposed",
  // Opinion / lifestyle / fluff
  "opinion", "editorial", "column",
  "dating", "soulmate", "relationship", "retirement",
  "diet", "nutrition", "meal", "recipe",
  "i quit", "i canceled", "i asked", "i use the", "i hacked",
  "i signed up", "i'm fed up",
  "tricks", "tips and tricks",
  // Corporate / HR
  "layoff", "layoffs", "fired", "hiring freeze",
  "resign", "resignation", "stepping down",
  "acquisition", "acquires", "merger", "buys",
  // Unrelated "Firefly" matches
  "rocket", "aerospace", "space launch", "spacecraft",
  "garden", "patio", "decor", "waterproof",
  "fireflies", "firefly festival", "firefly park",
  "munition", "loitering",
  // Unrelated "Gemini" matches
  "gemini constellation", "gemini the twins", "zodiac",
  // Price / cost / ads
  "pricing", "subscription", "free tier", "pay for",
  "how much", "worth the price", "worth the upgrade",
  "advertising", "ads ", "ad-free", "CPM", "ad revenue",
  // Meta / comparison / review articles
  "vs.", "vs ", "versus", "compared to", "competitor", "rivalry",
  "which one", "which is better", "vibe check", "first impressions",
  "switch to", "moved everything",
  // Government / policy deployments (not product features)
  "state employees", "executive branch", "executive-branch",
  "governor", "state workers", "government employees",
  "massachusetts", "federal agency",
  // Infrastructure / data center (not product features)
  "data centre", "data center", "infrastructure",
  // Vehicle / car integrations
  "tesla", "model 3", "model y", "vehicle",
  "dirty-talking", "dirty",
  // Not about the product itself
  "ahead of", "race with", "jolting race",
];

const REJECT_PATTERNS = REJECT_KEYWORDS.map(
  (kw) => new RegExp(`${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")
);

function isFeatureArticle(title, description) {
  const text = `${title} ${description}`.toLowerCase();

  // Must NOT match any reject pattern
  if (REJECT_PATTERNS.some((re) => re.test(text))) return false;

  // MUST match at least one feature keyword
  if (!FEATURE_KEYWORDS.some((kw) => text.includes(kw))) return false;

  return true;
}

function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff >= 0 && diff < days * 24 * 60 * 60 * 1000;
}

function mapItemToUpdate(item, provider, index) {
  const headline = item.title?.replace(/ - .*$/, "").trim() || "Untitled";
  const source = item.source || item.title?.match(/ - (.+)$/)?.[1] || "";
  const description = item.description || "";
  const summary =
    description && description !== `${headline} ${source}`
      ? description
      : `Click to read the full article from ${source || "the source"}.`;
  return {
    id: `live-${provider}-${index}-${Date.now()}`,
    provider,
    headline,
    summary,
    date: item.pubDate || new Date().toISOString().split("T")[0],
    isNew: isWithinDays(item.pubDate, 3),
    link: item.link || "",
    source,
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
      const desc = item.description || "";

      // Detect which provider this article belongs to
      const provider = detectProvider(title);
      if (!provider) continue;

      // Filter to feature articles only
      if (!isFeatureArticle(title, desc)) continue;

      results.push(mapItemToUpdate(item, provider, results.length));
    }

    console.log(`[NewsService] Group ${groupIndex}: ${results.length} feature articles`);
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
  console.log(`[NewsService] Total: ${results.length} live feature articles`);
  return results;
}

// Always available — no API key needed
export function hasApiKey() {
  return true;
}
