// Gemini 3 Flash API wrapper — article summaries, description fixing, semantic dedup.

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
const TIMEOUT = 20000;
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 2000];

// ── Shared API helpers ─────────────────────────────────────────────

function geminiBody(systemPrompt, userContent, maxTokens, options = {}) {
  const config = {
    maxOutputTokens: maxTokens,
    thinkingConfig: { thinkingBudget: 0 }, // no reasoning needed for summaries
  };
  if (options.jsonSchema) {
    config.responseMimeType = "application/json";
    config.responseSchema = options.jsonSchema;
  } else {
    config.responseMimeType = "text/plain";
  }
  return {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: config,
  };
}

function extractGeminiText(data) {
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

async function callGeminiRaw(url, body, apiKey, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── TL;DR summary generation ───────────────────────────────────────

const SUMMARY_SYSTEM = `You are a concise news wire editor who writes TL;DR summaries of AI product news.

Output format — follow this exactly:
TL;DR: [one sentence, under 20 words, capturing the core announcement.]
• [describe specifically what launched, what it does, and who it is for.]
• [include a concrete technical detail, benchmark, model name, parameter count, or pricing figure.]
• [state when and where it is available, what platforms it supports, or what real-world impact it has.]

Rules:
- Plain text only. Never use asterisks, hash symbols, backticks, or any markdown syntax.
- Every line must end with a full stop (period).
- Each bullet MUST be a full, descriptive sentence of 15 to 30 words. Never write short phrases like "New model launched." or "Available now." — always include specific details from the article.
- Each bullet must add new information not already stated in the TL;DR line or other bullets. Never repeat or rephrase the same point.
- Every claim must be directly stated in the provided text. Do not infer or fabricate details.
- If the article is short on details, still write complete sentences using what is available rather than padding with vague filler.
- Never reference the article itself or say you cannot access a URL.
- Write in English only. Do not include any non-English text.
- Convert all prices and currencies to approximate USD equivalents (e.g. Rs 339 becomes approximately $4, AUD 155 becomes approximately $103).
- Never mention the news source, author name, or publication in the summary.
- No opinions, speculation, or preamble. Start directly with TL;DR:`;

const SUMMARY_EXAMPLES = `Here are two examples of the exact format:

<example>
Article headline: Google Releases Gemma 3 Open Model

TL;DR: Google released Gemma 3, a new open-weights AI model that rivals larger proprietary systems.
• The model ships in four sizes from 1B to 27B parameters and supports a 128k token context window for long-form tasks.
• Gemma 3 matches GPT-3.5 Turbo on standard reasoning benchmarks while running efficiently on a single GPU.
• Weights are available now on Hugging Face, Kaggle, and Google AI Studio under a permissive research license.
</example>

<example>
Article headline: Jio Launches Rs 339 Plan With Google Gemini Pro Access

TL;DR: Jio launched a monthly plan bundling Google Gemini Pro with mobile data for approximately $4.
• The plan includes full Google Gemini Pro access normally valued at approximately $415 per year alongside 1.5 GB of daily high-speed data.
• Subscribers get a 30-day validity period with unlimited calling and standard SMS included in the bundle.
• This makes Jio the first Indian telecom to bundle a premium AI subscription directly into a mobile recharge plan.
</example>

Now summarize the following article. Start directly with TL;DR:`;

function buildSummaryPrompt(articleText, headline) {
  return `${SUMMARY_EXAMPLES}

<article>
Headline: ${headline}

${articleText}
</article>`;
}

async function callSummary(userContent, apiKey) {
  const body = geminiBody(SUMMARY_SYSTEM, userContent, 512);
  const data = await callGeminiRaw(GEMINI_URL, body, apiKey, TIMEOUT);
  let text = extractGeminiText(data);
  if (!text) throw new Error("Empty response from model");

  // Light cleanup — backup only, prompt + API settings handle formatting
  text = text
    .replace(/\*\*/g, "")
    .replace(/^#{1,3}\s*/gm, "")
    .trim();

  // Normalize bullet characters to •
  text = text.split("\n").map((line) => {
    const m = line.match(/^\s*(?:[*\-]|\u2022)\s*(.+)/);
    return m ? `\u2022 ${m[1].trim()}` : line;
  }).join("\n");

  // Validate structure
  const lines = text.split("\n").filter((l) => l.trim());
  const tldrLine = lines.find((l) => /^TL;DR:\s*.+/i.test(l));
  const bullets = lines.filter((l) => l.startsWith("\u2022 "));

  if (tldrLine && bullets.length >= 2) {
    return `${tldrLine}\n${bullets.slice(0, 3).join("\n")}`;
  }

  // Fallback: if model returned bullets but TL;DR is just a label or missing
  if (bullets.length >= 3) {
    return `TL;DR: ${bullets[0].replace(/^\u2022 /, "")}\n${bullets.slice(1, 4).join("\n")}`;
  }

  // Last resort: split sentences
  const clean = text.replace(/^TL;DR:\s*/im, "");
  const sentences = clean.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
  if (sentences.length >= 2) {
    return `TL;DR: ${sentences[0]}\n${sentences.slice(1, 4).map((s) => `\u2022 ${s}`).join("\n")}`;
  }

  return text;
}

export async function generateSummary(articleText, headline) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[gemini] No GEMINI_API_KEY set");
    return null;
  }

  const userContent = buildSummaryPrompt(articleText.slice(0, 8000), headline);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callSummary(userContent, apiKey);
    } catch (err) {
      console.error(`[gemini] Attempt ${attempt + 1}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }

  console.error(`[gemini] All ${MAX_RETRIES} attempts failed for "${headline.slice(0, 50)}..."`);
  return null;
}

// ── Fix truncated RSS descriptions ─────────────────────────────────

const FIX_DESC_SYSTEM = `You complete truncated news descriptions into a single factual sentence.
Output only the completed sentence. Under 40 words. Plain text, no markdown, no quotes.
Write in English only. Use USD for any prices. Do not mention the news source or author.`;

export async function fixTruncatedDescription(description, headline) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return description;

  try {
    const body = geminiBody(
      FIX_DESC_SYSTEM,
      `Headline: ${headline}\nTruncated: ${description}`,
      256,
    );
    const data = await callGeminiRaw(GEMINI_URL, body, apiKey, 10000);
    const fixed = extractGeminiText(data);
    return fixed && fixed.length > 20 ? fixed.replace(/\*\*/g, "") : description;
  } catch {
    return description;
  }
}

// ── Semantic deduplication (JSON structured output) ────────────────

const DEDUP_SYSTEM = `You identify duplicate news articles covering the same story or announcement.

Two articles are duplicates if they report on the same event, product launch, or announcement, even if they come from different sources, use different headlines, or emphasize different aspects.

Compare EXISTING articles against NEW candidates.
Return the indices of NEW articles to REMOVE because they duplicate an existing or earlier new article.
For new-vs-new duplicates, keep the lower index.`;

export async function deduplicateByContent(newArticles, existingArticles) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || newArticles.length === 0) return [];

  const fmt = (a, tag, i) =>
    `${tag}${i}: [${a.provider || "?"}] ${a.headline} — ${(a.description || a.summary || "").slice(0, 120)}`;

  const existingBlock = existingArticles.map((a, i) => fmt(a, "E", i)).join("\n");
  const newBlock = newArticles.map((a, i) => fmt(a, "N", i)).join("\n");

  try {
    const body = geminiBody(
      DEDUP_SYSTEM,
      `EXISTING:\n${existingBlock || "(none)"}\n\nNEW:\n${newBlock}`,
      256,
      {
        jsonSchema: {
          type: "ARRAY",
          items: { type: "INTEGER" },
        },
      },
    );
    const data = await callGeminiRaw(GEMINI_URL, body, apiKey, 20000);
    const text = extractGeminiText(data) || "[]";
    const indices = JSON.parse(text);
    if (!Array.isArray(indices)) return [];
    return indices.filter((i) => Number.isInteger(i) && i >= 0 && i < newArticles.length);
  } catch {
    return [];
  }
}
