// OpenRouter API wrapper for generating article summaries.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const TIMEOUT = 20000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

const SYSTEM_PROMPT = `You are a tech news article summarizer. Your job is to write a detailed, informative summary of the given AI product article.

Rules:
- Write EXACTLY 2-3 paragraphs, separated by blank lines (two newlines between each paragraph)
- Each paragraph should be 3-5 sentences long
- Paragraph 1: What was launched/released/announced and by which company
- Paragraph 2: Key details — what the product/feature does, technical specifics, how it works
- Paragraph 3 (if applicable): Availability, pricing, who can use it, what platforms it's on
- Be factual and specific. Include names, numbers, and details from the article
- Do NOT start with "The article discusses..." or similar meta-phrasing. Jump straight into the facts
- Do NOT include opinions or speculation`;

async function callOpenRouter(userContent, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 800,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || null;
    if (!summary) throw new Error("Empty response from model");

    // Validate: must have at least 2 paragraphs (1+ blank line separator)
    if (!summary.includes("\n\n")) {
      console.warn("[openrouter] Summary missing paragraph breaks, reformatting");
      const sentences = summary.split(/(?<=[.!?])\s+/);
      if (sentences.length >= 4) {
        const mid = Math.ceil(sentences.length / 2);
        return sentences.slice(0, mid).join(" ") + "\n\n" + sentences.slice(mid).join(" ");
      }
    }

    return summary;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function generateSummary(articleText, headline, articleUrl) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  // Build the best possible context for the model
  let userContent = `Article headline: ${headline}\n`;
  if (articleUrl) userContent += `Article URL: ${articleUrl}\n`;
  userContent += `\nArticle content:\n${articleText.slice(0, 8000)}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const summary = await callOpenRouter(userContent, apiKey);
      return summary;
    } catch (err) {
      console.error(`[openrouter] Attempt ${attempt + 1}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }

  console.error(`[openrouter] All ${MAX_RETRIES} attempts failed for "${headline.slice(0, 50)}..."`);
  return null;
}
