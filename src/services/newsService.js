// Uses Google News RSS (free, no API key) via rss2json.com (free CORS proxy)
const RSS2JSON_URL = "https://api.rss2json.com/v1/api.json";

// Tight queries: product name + "launches" / "rolls out" / "introduces" / "new feature"
const PROVIDER_QUERIES = {
  openai: '"ChatGPT"+"launches"+OR+"rolls out"+OR+"new feature"+OR+"introduces"',
  anthropic: '"Claude"+"launches"+OR+"rolls out"+OR+"new feature"+OR+"introduces"',
  gemini: '"Gemini"+"launches"+OR+"rolls out"+OR+"new feature"+OR+"new model"',
  google: '"Google AI"+"launches"+OR+"new feature"+OR+"introduces"',
  deepseek: '"DeepSeek"+"launches"+OR+"releases"+OR+"new model"+OR+"new feature"',
  kimi: '"Kimi"+OR+"Moonshot AI"+"launches"+OR+"releases"+OR+"new feature"',
  meta: '"Llama"+"launches"+OR+"releases"+OR+"new model"+OR+"new feature"',
  xai: '"Grok"+"launches"+OR+"new feature"+OR+"rolls out"+OR+"introduces"',
  mistral: '"Mistral"+"launches"+OR+"releases"+OR+"new model"+OR+"new feature"',
  microsoft: '"Copilot"+"launches"+OR+"new feature"+OR+"rolls out"+OR+"introduces"',
  perplexity: '"Perplexity"+"launches"+OR+"new feature"+OR+"rolls out"',
  figma: '"Figma"+"launches"+OR+"new feature"+OR+"new tool"+OR+"introduces"',
  adobe: '"Firefly"+OR+"Adobe AI"+"launches"+OR+"new feature"+OR+"introduces"',
  midjourney: '"Midjourney"+"launches"+OR+"new version"+OR+"new feature"+OR+"V7"+OR+"V8"',
  uxpilot: '"UX Pilot"+"launches"+OR+"new feature"+OR+"introduces"',
};

// Words that signal a feature/product article
const FEATURE_KEYWORDS = [
  "launch", "launches", "launched",
  "release", "releases", "released",
  "introduces", "introducing", "introduce",
  "rolls out", "rolling out", "rollout",
  "new feature", "new tool", "new model",
  "now available", "now supports",
  "announces", "unveiled", "unveils",
  "adds", "added", "adding",
  "ships", "shipping",
  "upgrade", "upgraded",
  "update", "updated",
  "beta", "preview",
  "v2", "v3", "v4", "v5", "v6", "v7", "v8",
  "integration", "plugin", "add-in",
  "api", "sdk",
];

// Words that signal non-feature noise — reject these
const REJECT_KEYWORDS = [
  "lawsuit", "sued", "suing",
  "ipo", "valuation", "funding", "raises",
  "stock", "shares", "investor",
  "layoff", "fired", "hiring freeze",
  "regulation", "ban", "banned",
  "controversy", "backlash", "criticized",
  "opinion", "editorial",
  "competitor", "rivalry",
  "revenue", "earnings", "profit",
  "acquisition", "acquires", "merger",
  "security breach", "hack", "data leak",
  "antitrust", "monopoly",
];

function isFeatureArticle(title, description) {
  const text = `${title} ${description}`.toLowerCase();

  // Reject if it matches noise keywords
  const hasReject = REJECT_KEYWORDS.some((kw) => text.includes(kw));
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
  const batchSize = 3;

  for (let i = 0; i < providers.length; i += batchSize) {
    const batch = providers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((p) => fetchProviderNews(p))
    );
    results.push(...batchResults.flat());

    // Longer delay between batches to avoid rss2json.com rate limits
    if (i + batchSize < providers.length) {
      await new Promise((r) => setTimeout(r, 1500));
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
