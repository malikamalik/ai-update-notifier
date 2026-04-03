// Shared news fetching, filtering, and deduplication logic.
// Used by both /api/news (live endpoint) and /api/cron/daily-news (cron job).

import { extract, extractFromHtml } from "@extractus/article-extractor";

const EXTRACT_TIMEOUT = 12000;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// ── Queries ─────────────────────────────────────────────────────────
export const QUERIES = [
  "ChatGPT new feature launch",
  "Claude AI new feature launch",
  "Gemini AI new feature launch",
  "Google Gemma new model launch",
  "Google AI new model launch",
  "DeepSeek AI new model launch",
  "Kimi AI new model launch",
  "Grok AI new feature launch",
  "Mistral AI new model launch",
  "GitHub Copilot new feature",
  "Perplexity AI new feature launch",
  "Llama AI new model release",
  "Figma AI new feature launch",
  "Adobe Firefly new feature",
  "Midjourney new release update",
  "UX Pilot AI new feature",
];

// ── Provider detection ──────────────────────────────────────────────
const PROVIDER_MATCHERS = [
  { provider: "openai", keywords: ["chatgpt", "openai", "gpt-5", "gpt-4", "codex", "dall-e"] },
  { provider: "anthropic", keywords: ["claude", "anthropic"] },
  { provider: "gemini", keywords: ["gemini"] },
  { provider: "google", keywords: ["google ai", "google deepmind", "gemma"] },
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

export function detectProvider(title) {
  const t = title.toLowerCase();
  for (const { provider, keywords } of PROVIDER_MATCHERS) {
    if (keywords.some((kw) => t.includes(kw))) return provider;
  }
  return null;
}

// ── Feature filtering ───────────────────────────────────────────────
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
  "open source", "open-source",
  "new version",
];

const REJECT_KEYWORDS = [
  "stock", "shares", "ipo", "valuation", "market cap", "market share",
  "funding", "raise", "billion", "investor", "investment",
  "revenue", "earnings", "profit", "quarterly", "financial results",
  "price target", "analyst", "rating", "NYSE", "NASDAQ",
  "fiscal year", "guidance", "forecast",
  "soars", "surges", "plunges", "tumbles", "climbs", "jumps",
  "selloff", "sell-off", "rally", "rebound",
  "lawsuit", "sued", "suing", "class action",
  "probe", "inquiry", "investigation", "indictment",
  "antitrust", "monopoly", "regulation", "banned", "crackdown",
  "pentagon", "military", "raid", "defense", "weapon", "troops",
  "government", "congress", "democrat", "republican", "senator",
  "deepfake", "sexual", "porn", "nude", "non-consensual",
  "controversy", "backlash", "criticized", "scandal",
  "data breach", "data leak", "security breach",
  "malware", "scam", "phishing",
  "bug ", "bug,", "exposing", "exposed",
  "opinion", "editorial", "column",
  "dating", "soulmate", "relationship", "retirement",
  "diet", "nutrition", "meal", "recipe",
  "i quit", "i canceled", "i asked", "i use the", "i hacked",
  "i signed up", "i'm fed up",
  "tricks", "tips and tricks",
  "layoff", "layoffs", "fired", "hiring freeze",
  "resign", "resignation", "stepping down",
  "acquisition", "acquires", "merger", "buys",
  "rocket", "aerospace", "space launch", "spacecraft",
  "garden", "patio", "decor", "waterproof",
  "fireflies", "firefly festival", "firefly park",
  "munition", "loitering",
  "gemini constellation", "gemini the twins", "zodiac",
  "pricing", "subscription", "free tier", "pay for",
  "how much", "worth the price", "worth the upgrade",
  "advertising", "ads ", "ad-free", "CPM", "ad revenue",
  "vs.", "vs ", "versus", "compared to", "competitor", "rivalry",
  "which one", "which is better", "vibe check", "first impressions",
  "switch to", "moved everything",
  "state employees", "executive branch", "executive-branch",
  "governor", "state workers", "massachusetts", "federal agency",
  "data centre", "data center", "infrastructure",
  "tesla", "model 3", "model y", "vehicle",
  "dirty-talking", "dirty",
  "prepares to release", "prepares to launch", "preparing to release",
  "plans to release", "plans to launch", "planning to launch",
  "expected to release", "expected to launch", "set to release",
  "about to release", "about to launch",
  "trembles", "trembling", "shakes", "shaking",
  "threatens", "threatening", "fears", "feared",
  "ahead of", "race with", "jolting race",
  "insurance marketplace", "workforce",
  "crashing", "crash", "reeling", "wipe",
  "insurance", "car insurance", "quotes available",
  "moneysupermarket", "experian",
  "beats", "on price", "cut-rate", "cut rate", "low-cost", "low cost",
  "ai race", "challenge", "rivals", "rival",
  "counter", "stealing", "distilling",
  "telecom", "ericsson", "6g", "5g",
  "bixby", "samsung",
  "accuses", "rumors",
  "flurry of",
  "move over",
  "leaked", "rumor", "reportedly",
  "azerbaijani", "language launch",
  "closed ai", "shifts to closed",
];

const REJECT_PATTERNS = REJECT_KEYWORDS.map(
  (kw) => new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
);

export function isFeatureArticle(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (REJECT_PATTERNS.some((re) => re.test(text))) return false;
  if (!FEATURE_KEYWORDS.some((kw) => text.includes(kw))) return false;
  return true;
}

// ── Dedup by product topic ──────────────────────────────────────────
const PRODUCT_PATTERNS = [
  /\b(gemini\s+[\d.]+\s*(?:pro|flash|ultra|deep\s*think)?)/i,
  /\b(claude\s+(?:sonnet|opus|haiku|code\s+security|code|cowork)\s*[\d.]*)/i,
  /\b(gpt[-\s]?[\d.]+\w*)/i,
  /\b(kimi\s+k?[\d.]+\w*)/i,
  /\b(midjourney\s*[\d.]+)/i,
  /\b(copilot\s+coding\s+agent)/i,
  /\b(llama\s+[\d.]+\w*)/i,
  /\b(grok\s+[\d.]+\w*)/i,
  /\b(mistral\s+\w+\s*[\d.]*)/i,
  /\b(deepseek[-\s]?\w+)/i,
  /\b(claude\s+code\s+security)/i,
  /\b(lockdown\s+mode)/i,
  /\b(adobe\s+firefly\s*\w*)/i,
  /\b(figma\s+(?:ai|make)\w*)/i,
  /\b(perplexity\s+(?:\w+\s+assistant|model\s+council|comet))/i,
  /\b(copilot\s+in\s+\w+)/i,
  /\b(chatgpt\s+\w+)/i,
  /\b(gemini\s+\w+)/i,
];

function extractProductTopic(headline) {
  const h = headline.toLowerCase();
  for (const re of PRODUCT_PATTERNS) {
    const m = h.match(re);
    if (m) return m[1].trim().replace(/\s+/g, " ");
  }
  return null;
}

const STOP_WORDS = new Set([
  "googl", "gemin", "deepm", "anthr", "claud", "opena", "chatg",
  "deepe", "micro", "copil", "githu", "midjo", "adobe", "firef",
  "figma", "perpl", "mistr", "groks", "llama", "kimis", "model",
  "launc", "featu", "relea", "updat", "rolls", "intro", "annou",
]);

function wordSet(text) {
  return new Set(
    text.toLowerCase()
      .replace(/[''`]/g, "")
      .split(/[\s-]+/)
      .filter((w) => w.length > 3)
      .map((w) => w.slice(0, 5))
      .filter((w) => !STOP_WORDS.has(w))
  );
}

function wordOverlap(a, b) {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const w of setA) if (setB.has(w)) shared++;
  return shared / Math.min(setA.size, setB.size);
}

export function deduplicateArticles(articles) {
  const unique = [];
  const seenTopics = new Set();

  for (const article of articles) {
    const topic =
      extractProductTopic(article.headline) ||
      extractProductTopic(article.summary || "");

    if (topic) {
      const key = `${article.provider}::${topic}`;
      if (seenTopics.has(key)) continue;
      seenTopics.add(key);
    }

    const isDupe = unique.some(
      (u) =>
        u.provider === article.provider &&
        wordOverlap(article.headline, u.headline) >= 0.4
    );
    if (isDupe) continue;

    unique.push(article);
  }
  return unique;
}

// ── RSS parsing (Bing News format) ──────────────────────────────────
export function parseBingRss(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = extractTag(block, "title");
    const rawLink = extractTag(block, "link");
    const description = decodeEntities(extractTag(block, "description"));
    const rawPubDate = extractTag(block, "pubDate");
    const source =
      extractTag(block, "News:Source") ||
      extractTag(block, "source") ||
      "";

    const realUrlMatch = rawLink.match(/url=([^&]+)/);
    const link = realUrlMatch
      ? decodeURIComponent(realUrlMatch[1])
      : rawLink;

    items.push({ title, link, description, pubDate: formatDate(rawPubDate), source });
  }
  return items;
}

function extractTag(xml, tag) {
  const cdataRe = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`
  );
  const m1 = xml.match(cdataRe);
  if (m1) return m1[1].trim();
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const m2 = xml.match(plainRe);
  return m2 ? m2[1].trim() : "";
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toISOString().split("T")[0];
  } catch {
    return dateStr;
  }
}

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/<[^>]*>/g, "")
    .trim();
}

// ── Summary cleanup ─────────────────────────────────────────────────
const JUNK_SUMMARY_PATTERNS = [
  /join.*club/i,
  /enter your email/i,
  /sign you up/i,
  /newsletter/i,
  /click to read/i,
  /read the full article/i,
  /subscribe/i,
  /the post .* appeared first on/i,
];

export function cleanSummary(summary) {
  if (!summary || summary.length < 50) return null;
  let cleaned = summary.replace(/\s*The post .* appeared first on .*$/i, "").trim();
  if (!cleaned || cleaned.length < 50) return null;
  if (JUNK_SUMMARY_PATTERNS.some((re) => re.test(cleaned))) {
    const firstSentence = cleaned.match(/^(.{40,}?[.!])\s/);
    if (firstSentence && !JUNK_SUMMARY_PATTERNS.some((re) => re.test(firstSentence[1]))) {
      return firstSentence[1];
    }
    return null;
  }
  return cleaned;
}

// ── Article text extraction ─────────────────────────────────────────
function htmlToText(content) {
  const paragraphs = content
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

  return paragraphs.length > 0 ? paragraphs.join("\n\n") : null;
}

export async function extractArticleText(url) {
  // Skip MSN — client-rendered SPA, no extractable content
  if (url.includes("msn.com")) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT);

  try {
    // Fetch HTML ourselves with browser headers to avoid 403/429 blocks
    const res = await fetch(url, {
      signal: controller.signal,
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const html = await res.text();
    const article = await extractFromHtml(html, url);
    if (!article || !article.content) return null;

    return htmlToText(article.content);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── Fetch + filter pipeline ─────────────────────────────────────────
export async function fetchAndFilterArticles() {
  const rssResults = await Promise.all(
    QUERIES.map(async (q) => {
      const url = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&count=15&mkt=en-US`;
      try {
        const r = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AIUpdateNotifier/1.0)" },
        });
        if (!r.ok) return [];
        return parseBingRss(await r.text());
      } catch {
        return [];
      }
    })
  );

  let articles = [];
  for (const items of rssResults) {
    for (const item of items) {
      if (item.link.includes("msn.com")) continue; // MSN is client-rendered, skip
      const provider = detectProvider(item.title);
      if (!provider) continue;
      if (!isFeatureArticle(item.title, item.description)) continue;

      const headline = item.title.replace(/ - .*$/, "").trim();
      const summary = cleanSummary(item.description);
      if (!summary) continue;
      articles.push({
        headline,
        summary,
        date: item.pubDate,
        link: item.link,
        source: item.source,
        provider,
      });
    }
  }

  articles = deduplicateArticles(articles);
  return articles.slice(0, 30);
}
