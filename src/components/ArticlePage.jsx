import { useParams, useNavigate } from "react-router-dom";
import { PROVIDERS } from "../data/providers";

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Parse AI-generated summary (TL;DR + bullets). Returns empty points if no AI summary. */
function parseSummary(summary) {
  if (!summary) return { tldr: "", points: [] };

  const lines = summary.split("\n").map((l) => l.trim()).filter(Boolean);

  // Look for AI-generated TL;DR + bullet points
  const tldrLine = lines.find((l) => /^TL;?DR:?\s/i.test(l));
  const bullets = lines.filter((l) => /^[•\-*]\s/.test(l));

  if (tldrLine && bullets.length > 0) {
    return {
      tldr: tldrLine.replace(/^TL;?DR:?\s*/i, "").trim(),
      points: bullets.map((b) => b.replace(/^[•\-*]\s*/, "").trim()),
    };
  }

  // Try splitting multi-sentence summaries
  const clean = summary.replace(/\.{3}$|…$/, "");
  const sentences = clean
    .replace(/([.!?])\s+/g, "$1|SPLIT|")
    .split("|SPLIT|")
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (sentences.length >= 4) {
    return { tldr: sentences[0], points: sentences.slice(1, 5) };
  }

  if (sentences.length >= 2) {
    return { tldr: sentences[0], points: sentences.slice(1) };
  }

  // Single sentence — just use as TL;DR, no fake bullets
  const text = (sentences[0] || summary).replace(/\.{3}$|…$/, "").trim();
  return { tldr: text.endsWith(".") ? text : text + ".", points: [] };
}

export default function ArticlePage({ allUpdates }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const update = allUpdates.find((u) => String(u.id) === id);

  if (!update) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">Article not found</p>
          <button
            onClick={() => navigate("/")}
            className="text-blue-500 hover:underline cursor-pointer"
          >
            Back to feed
          </button>
        </div>
      </div>
    );
  }

  const provider = PROVIDERS[update.provider];
  const { tldr, points } = parseSummary(update.summary);

  // Show description only if it's meaningfully different from TL;DR
  const desc = update.description || "";
  const showDescription =
    desc.length > 0 &&
    desc.toLowerCase().slice(0, 40) !== tldr.toLowerCase().slice(0, 40) &&
    desc.toLowerCase().slice(0, 40) !== update.summary?.toLowerCase().slice(0, 40);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto">
        {/* Hero banner with back button overlay */}
        <div className="relative rounded-b-2xl overflow-hidden" style={{ height: "240px" }}>
          {update.image ? (
            <>
              <img src={update.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-black/5" />
            </>
          ) : (
            <>
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${provider?.bgColor || "#f3f4f6"} 0%, #ddd 50%, #9ca3af 100%)`,
                }}
              />
              {provider?.logo && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <img src={provider.logo} alt="" className="w-28 h-28 object-contain opacity-30" style={{ filter: "grayscale(100%)" }} />
                </div>
              )}
            </>
          )}

          <button
            onClick={() => navigate("/")}
            className="absolute top-4 left-4 w-10 h-10 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors cursor-pointer z-10"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        </div>

        {/* Article content */}
        <div className="px-6 py-8">
          <div className="flex items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: provider?.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: provider?.color }} />
              {provider?.name}
            </span>
            <span className="text-sm text-gray-400">{formatDate(update.date)}</span>
          </div>

          <h1 className="text-[28px] font-medium text-gray-900 leading-tight mb-4">
            {update.headline}
          </h1>

          {showDescription && (
            <p className="text-base text-gray-400 leading-relaxed mb-6">
              {desc}
            </p>
          )}

          <hr className="border-gray-200 mb-6" />

          <div className="mb-5">
            <p className="text-base text-gray-700 leading-relaxed">
              TL;DR: {tldr}
            </p>
          </div>

          {points.length > 0 && (
            <ul className="space-y-4 mb-6">
              {points.map((point, i) => (
                <li key={i} className="flex gap-3 text-base text-gray-700 leading-relaxed">
                  <span className="text-gray-400 mt-0.5 shrink-0">&#8226;</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}

          <hr className="border-gray-200 mb-6" />

          {update.link && (
            <a
              href={update.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: provider?.color }}
            >
              Read full article
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
