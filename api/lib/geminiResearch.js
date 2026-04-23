// Gemini 3 Flash web research — live AI news fetch via Google Search grounding.
// Replaces Bing RSS + article text extraction pipeline.

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
const TIMEOUT = 120000;

const PROVIDERS = [
  "openai", "anthropic", "gemini", "google", "meta",
  "mistral", "deepseek", "xai", "microsoft", "perplexity",
  "cohere", "huggingface", "stability", "adobe", "midjourney",
  "figma", "cursor", "runway", "elevenlabs", "heygen",
  "canva", "julius", "gamma", "n8n", "replit",
  "lovable", "uxpilot", "wispr", "kimi",
];

function buildResearchPrompt(todayIso) {
  return `Today is ${todayIso}.

You are an AI news researcher. Use Google Search to find GENUINE AI product launch announcements, feature releases, and model releases from the last 48 hours (between ${shiftDate(todayIso, -2)} and ${todayIso}).

FOCUS ON THESE AI PRODUCTS AND COMPANIES:
- Chat & reasoning models: ChatGPT, GPT-5, GPT-6, Claude, Claude Code, Claude Cowork, Gemini, Grok, DeepSeek, Kimi (Moonshot), Mistral, Llama, Cohere, NotebookLM, Perplexity
- Image generation: DALL-E, Imagen, Midjourney, Stable Diffusion, Adobe Firefly, Canva AI
- Video generation: Sora, Veo, Runway ML, Runway Gen-, HeyGen
- Voice & audio: ElevenLabs, Wispr Flow
- Coding agents: Cursor, GitHub Copilot, Replit Agent, Lovable, Claude Code, Codex
- Productivity & data: Julius AI, Gamma, n8n, UX Pilot, Figma AI
- Open-source model hubs: Hugging Face, Gemma, Llama, Mistral weights
- Research labs: OpenAI, Anthropic, Google DeepMind, Meta AI / FAIR, Mistral, DeepSeek, xAI

STRICT: Only return articles about products from the companies and tools listed above. Do not include articles about AI tools from other companies, even if they are notable launches.

PRIORITIZE OFFICIAL SOURCES:
- openai.com/index/* and openai.com/blog/*
- anthropic.com/news/*
- deepmind.google/blog/* and blog.google/technology/ai/*
- notebooklm.google.com updates
- ai.meta.com/blog/*, about.fb.com/news/*, engineering.fb.com/*
- mistral.ai/news/*
- x.ai/blog/* and x.ai/news/*
- huggingface.co/blog/*
- perplexity.ai/blog/*
- stability.ai/news/*
- cursor.com/blog/*, cursor.so/blog/*
- replit.com/site/blog
- elevenlabs.io/blog
- runwayml.com/news, runwayml.com/blog
- heygen.com/blog
- canva.com/newsroom/*, canva.com/blog/*
- julius.ai/blog, gamma.app/blog
- n8n.io/blog, lovable.dev/blog
- uxpilot.ai/blog, wispr.io/blog or wispr.ai/blog
- moonshot.ai/news (Kimi)
- deepseek.com/news

ALSO ACCEPT reputable third-party tech coverage:
TechCrunch, The Verge, VentureBeat, Ars Technica, SiliconAngle, Wired, InfoQ, 9to5Google, 9to5Mac, Bloomberg, Reuters.

EXCLUDE:
- Rumors, leaks, speculation ("reportedly", "rumored", "is said to")
- Listicles and roundups ("top 10", "best AI tools", "vs")
- Stock, funding, valuation, IPO news
- Lawsuits, investigations, controversies
- Opinion pieces, editorials, reviews
- Non-English articles
- Articles older than 48 hours
- news.google.com URLs
- msn.com URLs
- Duplicate coverage: if multiple outlets report the same story, keep only the official announcement OR the earliest primary report

FORMATTING RULES:
- Clean the headline: strip trailing source suffixes like " - TechCrunch", " | The Verge", " — VentureBeat", trailing domains like "- github.blog", and trailing hashes/codes.
- source: publication name only (e.g. "TechCrunch", "OpenAI", "Anthropic"). No URLs.
- provider: MUST be one of: ${PROVIDERS.join(", ")}. Map products to providers: ChatGPT/GPT/Codex/DALL-E/Sora → openai. Claude/Claude Code/Claude Cowork → anthropic. Gemini → gemini. NotebookLM/Imagen/Veo/Gemma/DeepMind → google. Llama → meta. Grok → xai. Copilot/GitHub Copilot → microsoft. Kimi/Moonshot → kimi. DO NOT include articles about AI tools from companies outside this explicit list. If the article is not about one of these specific providers/products, omit it entirely.
- publication_date: ISO 8601 date (YYYY-MM-DD). If you can't verify the exact date, omit the article.
- url: direct link to the article. NEVER a news.google.com redirect URL. Resolve aggregator links to the original article.
- description: 2-3 factual sentences describing what launched/changed. Plain English. No opinions. No source name mentions. Include specific model names, version numbers, and features.

Return AT LEAST 10 distinct articles if that many real launches exist. Do not fabricate articles.`;
}

function shiftDate(iso, days) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    articles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          headline: { type: "STRING" },
          url: { type: "STRING" },
          source: { type: "STRING" },
          provider: { type: "STRING" },
          publication_date: { type: "STRING" },
          description: { type: "STRING" },
        },
        required: ["headline", "url", "source", "provider", "publication_date", "description"],
      },
    },
  },
  required: ["articles"],
};

export async function researchAiNews() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[research] No GEMINI_API_KEY set");
    return [];
  }

  const today = new Date().toISOString().split("T")[0];
  const prompt = buildResearchPrompt(today);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          maxOutputTokens: 32768,
        },
      }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn("[research] Empty response");
      return [];
    }

    const parsed = JSON.parse(text);
    const articles = Array.isArray(parsed.articles) ? parsed.articles : [];

    // Filter out bad entries defensively
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 3); // slight grace for timezone edges

    const cleaned = articles.filter((a) => {
      if (!a.url || !a.headline || !a.description) return false;
      if (a.url.includes("news.google.com")) return false;
      if (a.url.includes("msn.com")) return false;
      if (!/^https?:\/\//.test(a.url)) return false;
      // Skip non-English (3+ consecutive non-ASCII chars)
      if (/[^\x00-\x7F]{3,}/.test(a.headline)) return false;
      // Date sanity check
      const pubDate = new Date(a.publication_date);
      if (isNaN(pubDate.getTime())) return false;
      if (pubDate < cutoff) return false;
      // Provider must be recognized
      if (!PROVIDERS.includes(a.provider)) return false;
      return true;
    });

    // Log search metadata if Gemini returned it
    const queries = data.candidates?.[0]?.groundingMetadata?.webSearchQueries;
    if (queries?.length) {
      console.log(`[research] Gemini searched: ${queries.slice(0, 5).join(" | ")}`);
    }

    return cleaned;
  } catch (err) {
    clearTimeout(timer);
    console.error("[research] Error:", err.message);
    return [];
  }
}
