// Vercel serverless function — fetches Google News RSS server-side
// No CORS issues, no third-party proxy, no rate limits
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  const googleRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:14d&hl=en-US&gl=US&ceid=US:en`;

  try {
    const response = await fetch(googleRssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AIUpdateNotifier/1.0)",
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Google News returned HTTP ${response.status}`,
      });
    }

    const xml = await response.text();
    const items = parseRssXml(xml);

    return res.status(200).json({ status: "ok", items });
  } catch (err) {
    console.error("[api/rss]", err.message);
    return res.status(502).json({ error: err.message });
  }
}

// Lightweight RSS XML parser — extracts <item> elements
function parseRssXml(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const rawDesc = extractTag(block, "description");
    const rawPubDate = extractTag(block, "pubDate");

    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      description: stripHtml(rawDesc),
      pubDate: formatDate(rawPubDate),
      source: extractTagAttr(block, "source"),
    });
  }

  return items;
}

function extractTag(xml, tag) {
  // Try CDATA first, then plain text
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const plainMatch = xml.match(plainRe);
  if (plainMatch) return plainMatch[1].trim();

  return "";
}

function extractTagAttr(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(re);
  return match ? match[1].trim() : "";
}

// Strip all HTML (both raw tags and HTML-entity-encoded tags) from description
function stripHtml(html) {
  if (!html) return "";
  return html
    // Decode HTML entities first
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Now strip all HTML tags
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Convert RFC 2822 date ("Wed, 18 Feb 2026 03:37:44 GMT") to ISO date ("2026-02-18")
function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split("T")[0];
  } catch {
    return dateStr;
  }
}
