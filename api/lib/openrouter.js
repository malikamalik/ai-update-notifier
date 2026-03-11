// OpenRouter API wrapper for generating article summaries.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const TIMEOUT = 20000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

const SYSTEM_PROMPT = `You are a tech news article summarizer. Your job is to extract the key points from the given AI product article.

Rules:
- Write EXACTLY 3-4 bullet points
- Each bullet point should be 1-2 sentences, concise and factual
- Start each bullet with "• " (bullet character followed by a space)
- Point 1: What was launched/released/announced and by which company
- Point 2: What the product/feature does or how it works
- Point 3: Key technical details, numbers, or specifics
- Point 4 (if applicable): Availability, pricing, or who can use it
- Be factual and specific. Include names, numbers, and details from the article
- Do NOT start with "The article discusses..." or similar meta-phrasing. Jump straight into the facts
- Do NOT include opinions or speculation
- Do NOT use markdown formatting like ** or ## — just plain text bullets`;

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
        max_tokens: 400,
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

    // Validate: must have bullet points
    const bulletCount = (summary.match(/^[•\-\*]/gm) || []).length;
    if (bulletCount < 3) {
      console.warn(`[openrouter] Only ${bulletCount} bullets found, reformatting`);
      const sentences = summary.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
      if (sentences.length >= 3) {
        return sentences.slice(0, 4).map((s) => `• ${s.replace(/^[•\-\*]\s*/, "")}`).join("\n");
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
