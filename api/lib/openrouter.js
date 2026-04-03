// Claude API wrapper for generating article summaries.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT = 20000;
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 2000];

const SYSTEM_PROMPT = `You summarize AI product news articles. You are given the article text directly — do NOT say you cannot access it.

Rules:
- Start with "TL;DR: " followed by a single concise sentence (max ~20 words) that captures the core news
- Then add exactly 3 bullet points with key details, each starting with "• "
- Each bullet should be a brief phrase or single sentence — punchy and scannable
- Highlight the top 3 things from the article: what it is, key details/numbers, and availability or impact
- ONLY use facts explicitly stated in the provided text. Never invent, assume, or fabricate details
- If the provided text is short, write a shorter summary — but still only use what is given
- Do NOT reference the article itself ("the article says...", "according to the article...")
- Do NOT say you cannot access a URL or need more information
- Do NOT include opinions or speculation
- Do NOT use markdown formatting like ** or ## — just plain text
- Jump straight into the facts`;

async function callClaude(userContent, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userContent },
        ],
        max_tokens: 400,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }

    const data = await res.json();
    const summary = data.content?.[0]?.text?.trim() || null;
    if (!summary) throw new Error("Empty response from model");

    // Validate: must have TL;DR line and at least 2 bullets
    const hasTldr = /^TL;DR:/im.test(summary);
    const bulletCount = (summary.match(/^[•\-\*]/gm) || []).length;
    if (!hasTldr || bulletCount < 2) {
      console.warn(`[claude] Missing TL;DR or only ${bulletCount} bullets, reformatting`);
      const sentences = summary.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
      if (sentences.length >= 2) {
        const tldr = `TL;DR: ${sentences[0].replace(/^(TL;DR:\s*|[•\-\*]\s*)/i, "")}`;
        const bullets = sentences.slice(1, 4).map((s) => `• ${s.replace(/^[•\-\*]\s*/, "")}`).join("\n");
        return `${tldr}\n${bullets}`;
      }
    }

    return summary;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function fixTruncatedDescription(description, headline) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return description;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        system: "You rewrite truncated news descriptions into a single complete sentence. Output ONLY the sentence, nothing else. Keep it factual and under 40 words. No quotes, no markdown.",
        messages: [
          { role: "user", content: `Headline: ${headline}\nTruncated description: ${description}` },
        ],
        max_tokens: 100,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return description;
    const data = await res.json();
    const fixed = data.content?.[0]?.text?.trim();
    return fixed && fixed.length > 20 ? fixed : description;
  } catch {
    clearTimeout(timer);
    return description;
  }
}

export async function deduplicateByContent(newHeadlines, existingHeadlines) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || newHeadlines.length === 0) return [];

  const existingList = existingHeadlines.map((h, i) => `E${i}: ${h}`).join("\n");
  const newList = newHeadlines.map((h, i) => `N${i}: ${h}`).join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        system: `You identify duplicate news articles covering the same story/announcement.
Given EXISTING articles (already stored) and NEW articles (candidates), find NEW articles that cover the same story as an EXISTING article OR as another NEW article.
For NEW-vs-NEW duplicates, keep the one with the lower index.
Output ONLY a JSON array of NEW indices to REMOVE (e.g. [1,3,5]). Output [] if no duplicates. No explanation.`,
        messages: [
          { role: "user", content: `EXISTING:\n${existingList || "(none)"}\n\nNEW:\n${newList}` },
        ],
        max_tokens: 200,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || "[]";
    const match = text.match(/\[[\d,\s]*\]/);
    if (!match) return [];
    const indices = JSON.parse(match[0]);
    return indices.filter((i) => Number.isInteger(i) && i >= 0 && i < newHeadlines.length);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

export async function generateSummary(articleText, headline, articleUrl) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[claude] No ANTHROPIC_API_KEY set");
    return null;
  }

  let userContent = `Article headline: ${headline}\n\nArticle content:\n${articleText.slice(0, 8000)}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const summary = await callClaude(userContent, apiKey);
      return summary;
    } catch (err) {
      console.error(`[claude] Attempt ${attempt + 1}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }

  console.error(`[claude] All ${MAX_RETRIES} attempts failed for "${headline.slice(0, 50)}..."`);
  return null;
}
