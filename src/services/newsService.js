// Uses Google News RSS (free, no API key) via rss2json.com (free CORS proxy)
const RSS2JSON_URL = "https://api.rss2json.com/v1/api.json";

// Short, focused queries: product name AND'd with action verbs via Google search syntax
// Format: "product" "verb1" OR "verb2" — Google reads as: product AND (verb1 OR verb2)
const VERBS = '"launches"+OR+"announces"+OR+"rolls out"+OR+"releases"+OR+"unveils"+OR+"new feature"';

const PROVIDER_QUERIES = {
  openai: `"ChatGPT"+${VERBS}`,
  anthropic: `"Claude"+${VERBS}`,
  gemini: `"Gemini"+${VERBS}+OR+"new model"`,
  google: `"Google AI"+${VERBS}`,
  deepseek: `"DeepSeek"+${VERBS}+OR+"new model"`,
  kimi: `"Kimi"+${VERBS}`,
  meta: `"Llama"+${VERBS}+OR+"new model"`,
  xai: `"Grok"+${VERBS}`,
  mistral: `"Mistral"+${VERBS}+OR+"new model"`,
  microsoft: `"Copilot"+${VERBS}`,
  perplexity: `"Perplexity"+${VERBS}`,
  figma: `"Figma"+${VERBS}+OR+"new tool"`,
  adobe: `"Firefly"+${VERBS}`,
  midjourney: `"Midjourney"+${VERBS}+OR+"new version"`,
  uxpilot: `"UX Pilot"+${VERBS}`,
};

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

// Words that signal non-feature noise — reject these (matched with word boundaries)
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

// Pre-build regex patterns for word-boundary matching (avoids substring false positives)
const REJECT_PATTERNS = REJECT_KEYWORDS.map(
  (kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")
);

function isFeatureArticle(title, description) {
  const text = `${title} ${description}`.toLowerCase();

  // Reject if it matches noise keywords (word-boundary match to avoid "hack" matching "Hacker News" etc.)
  const hasReject = REJECT_PATTERNS.some((re) => re.test(text));
  if (hasReject) return false;

  // Accept if it matches feature keywords
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
  const description = cleanHtml(item.description || item.content || "");
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
    source: item.title?.match(/ - (.+)$/)?.[1] || "",
    isLive: true,
  };
}

export async function fetchProviderNews(provider) {
  const query = PROVIDER_QUERIES[provider];
  if (!query) return [];

  const googleRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:14d&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(
      `${RSS2JSON_URL}?rss_url=${encodeURIComponent(googleRssUrl)}`
    );
    if (!res.ok) {
      console.warn(`[NewsService] ${provider}: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (data.status !== "ok") {
      console.warn(`[NewsService] ${provider}: API status "${data.status}"`, data.message || "");
      return [];
    }

    // Filter to feature-only articles, then take top 2
    const featureArticles = (data.items || []).filter((item) => {
      const title = item.title || "";
      const desc = cleanHtml(item.description || item.content || "");
      return isFeatureArticle(title, desc);
    });

    return featureArticles
      .slice(0, 2)
      .map((item, i) => mapItemToUpdate(item, provider, i));
  } catch (err) {
    console.warn(`[NewsService] ${provider}: fetch failed —`, err.message);
    return [];
  }
}

export async function fetchAllNews() {
  const providers = Object.keys(PROVIDER_QUERIES);
  const results = [];
  const batchSize = 2;

  for (let i = 0; i < providers.length; i += batchSize) {
    const batch = providers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((p) => fetchProviderNews(p))
    );
    results.push(...batchResults.flat());

    // 2.5s delay between batches — rss2json.com free tier needs ~1 req/sec max
    if (i + batchSize < providers.length) {
      await new Promise((r) => setTimeout(r, 2500));
    }
  }

  // Sort by date descending
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  return results;
}

// Always available — no API key needed
export function hasApiKey() {
  return true;
}
