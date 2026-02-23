// /api/news — fetches from Bing News RSS (which includes real article descriptions),
// filters to feature-only articles, deduplicates, and returns enriched results.

// Individual queries per provider — Bing doesn't support complex OR with quotes
// All run in parallel from our own server, so speed is fine
const QUERIES = [
  "ChatGPT new feature launch",
  "Claude AI new feature launch",
  "Gemini AI new feature launch",
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
  // Financial
  "stock", "shares", "ipo", "valuation", "market cap", "market share",
  "funding", "raise", "billion", "investor", "investment",
  "revenue", "earnings", "profit", "quarterly", "financial results",
  "price target", "analyst", "rating", "NYSE", "NASDAQ",
  "fiscal year", "guidance", "forecast",
  "soars", "surges", "plunges", "tumbles", "climbs", "jumps",
  "selloff", "sell-off", "rally", "rebound",
  // Legal / political
  "lawsuit", "sued", "suing", "class action",
  "probe", "inquiry", "investigation", "indictment",
  "antitrust", "monopoly", "regulation", "banned", "crackdown",
  "pentagon", "military", "raid", "defense", "weapon", "troops",
  "government", "congress", "democrat", "republican", "senator",
  // Scandal
  "deepfake", "sexual", "porn", "nude", "non-consensual",
  "controversy", "backlash", "criticized", "scandal",
  "data breach", "data leak", "security breach",
  "malware", "scam", "phishing",
  "bug ", "bug,", "exposing", "exposed",
  // Opinion / lifestyle
  "opinion", "editorial", "column",
  "dating", "soulmate", "relationship", "retirement",
  "diet", "nutrition", "meal", "recipe",
  "i quit", "i canceled", "i asked", "i use the", "i hacked",
  "i signed up", "i'm fed up",
  "tricks", "tips and tricks",
  // Corporate
  "layoff", "layoffs", "fired", "hiring freeze",
  "resign", "resignation", "stepping down",
  "acquisition", "acquires", "merger", "buys",
  // Unrelated
  "rocket", "aerospace", "space launch", "spacecraft",
  "garden", "patio", "decor", "waterproof",
  "fireflies", "firefly festival", "firefly park",
  "munition", "loitering",
  "gemini constellation", "gemini the twins", "zodiac",
  // Price / ads
  "pricing", "subscription", "free tier", "pay for",
  "how much", "worth the price", "worth the upgrade",
  "advertising", "ads ", "ad-free", "CPM", "ad revenue",
  // Comparison / review
  "vs.", "vs ", "versus", "compared to", "competitor", "rivalry",
  "which one", "which is better", "vibe check", "first impressions",
  "switch to", "moved everything",
  // Government deployments
  "state employees", "executive branch", "executive-branch",
  "governor", "state workers", "massachusetts", "federal agency",
  // Infrastructure
  "data centre", "data center", "infrastructure",
  // Vehicle
  "tesla", "model 3", "model y", "vehicle",
  "dirty-talking", "dirty",
  // Noise
  "ahead of", "race with", "jolting race",
  "insurance marketplace", "workforce",
  "crashing", "crash", "reeling", "wipe",
  // Third-party launches on AI platforms (not the AI product's own feature)
  "insurance", "car insurance", "quotes available",
  "moneysupermarket", "experian",
  // Price comparisons
  "beats", "on price", "cut-rate", "cut rate", "low-cost", "low cost",
  // General AI race / rivalry articles
  "ai race", "challenge", "rivals", "rival",
  "counter", "stealing", "distilling",
  // Telecom / partnerships (not product features)
  "telecom", "ericsson", "6g", "5g",
  // Samsung / Bixby
  "bixby", "samsung",
  // Not the AI provider's own feature
  "accuses", "rumors",
  "flurry of",
  // Competitor framing / not about the detected provider
  "move over",
  // Leaks / rumors
  "leaked", "rumor", "reportedly",
  // Locale / language launches (not features)
  "azerbaijani", "language launch",
  // Closed / shifting strategy
  "closed ai", "shifts to closed",
];

const REJECT_PATTERNS = REJECT_KEYWORDS.map(
  (kw) => new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
);

function isFeatureArticle(title, description) {
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

// Words that appear in almost every article for a provider — exclude from overlap
const STOP_WORDS = new Set([
  "googl", "gemin", "deepm", "anthr", "claud", "opena", "chatg",
  "deepe", "micro", "copil", "githu", "midjo", "adobe", "firef",
  "figma", "perpl", "mistr", "groks", "llama", "kimis", "model",
  "launc", "featu", "relea", "updat", "rolls", "intro", "annou",
]);

function wordSet(text) {
  // Use first 5 chars of each word (crude stemming: "compare"/"compares" both → "compa")
  return new Set(
    text.toLowerCase()
      .replace(/[''`]/g, "")
      .split(/[\s\-]+/)
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

function deduplicateArticles(articles) {
  const unique = [];
  const seenTopics = new Set();

  for (const article of articles) {
    // Check both headline and summary for product topic
    const topic =
      extractProductTopic(article.headline) ||
      extractProductTopic(article.summary || "");

    // Topic-based dedup
    if (topic) {
      const key = `${article.provider}::${topic}`;
      if (seenTopics.has(key)) continue;
      seenTopics.add(key);
    }

    // Word-overlap dedup (always check, regardless of topic)
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
function parseBingRss(xml) {
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

    // Extract real article URL from Bing redirect link
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

function formatDate(dateStr) {
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

function cleanSummary(summary, source) {
  if (!summary || summary.length < 50) return `Read more on ${source}.`;
  // Strip trailing "The post ... appeared first on ..." patterns
  let cleaned = summary.replace(/\s*The post .* appeared first on .*$/i, "").trim();
  if (!cleaned || cleaned.length < 50) return `Read more on ${source}.`;
  if (JUNK_SUMMARY_PATTERNS.some((re) => re.test(cleaned))) {
    // Try to salvage the first sentence only if it's not junk itself
    const firstSentence = cleaned.match(/^(.{40,}?[.!])\s/);
    if (firstSentence && !JUNK_SUMMARY_PATTERNS.some((re) => re.test(firstSentence[1]))) {
      return firstSentence[1];
    }
    return `Read more on ${source}.`;
  }
  return cleaned;
}

// ── Main handler ────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    // 1. Fetch all Bing News RSS queries in parallel (fast — our own server)
    const rssResults = await Promise.all(
      QUERIES.map(async (q) => {
        const url = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&count=10&mkt=en-US`;
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

    // 2. Flatten, detect providers, filter to feature articles
    let articles = [];
    for (const items of rssResults) {
      for (const item of items) {
        const provider = detectProvider(item.title);
        if (!provider) continue;
        if (!isFeatureArticle(item.title, item.description)) continue;

        const headline = item.title.replace(/ - .*$/, "").trim();
        articles.push({
          headline,
          summary: cleanSummary(item.description, item.source),
          date: item.pubDate,
          link: item.link,
          source: item.source,
          provider,
        });
      }
    }

    // 3. Deduplicate
    articles = deduplicateArticles(articles);

    // 4. Build final response (max 20 articles)
    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    const results = articles.slice(0, 20).map((a, i) => {
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
