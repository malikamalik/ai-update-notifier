import { useNavigate } from "react-router-dom";
import { PROVIDERS } from "../data/providers";

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const hours = Math.floor((now - date) / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function readingTime(text) {
  const words = (text || "").split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

function cleanText(text) {
  if (!text) return "";
  if (text.endsWith("...") || text.endsWith("\u2026")) {
    const clean = text.replace(/\.{3}$|\u2026$/, "");
    const lastDot = clean.lastIndexOf(".");
    if (lastDot > 20) return clean.slice(0, lastDot + 1);
  }
  return text;
}

export default function UpdateCard({ update, bookmarked, onToggleBookmark }) {
  const provider = PROVIDERS[update.provider];
  const navigate = useNavigate();

  const handleClick = (e) => {
    if (e.target.closest("[data-bookmark]")) return;
    navigate(`/article/${update.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200 group cursor-pointer"
      style={{ borderLeftWidth: "4px", borderLeftColor: provider?.color }}
    >
      {/* Top section: logo + meta + headline + bookmark */}
      <div className="flex gap-4 p-4 pb-3">
        {/* Provider logo thumbnail */}
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: provider?.bgColor || "#f3f4f6" }}
        >
          {provider?.logo ? (
            <img
              src={provider.logo}
              alt={provider.name}
              className="w-9 h-9 object-contain"
              style={{ filter: "grayscale(100%) opacity(0.5)" }}
            />
          ) : (
            <span
              className="text-xl font-medium"
              style={{ color: provider?.color, opacity: 0.5 }}
            >
              {provider?.name?.charAt(0)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                <span className="font-medium text-gray-500">
                  {provider?.name}
                </span>
                <span>&middot;</span>
                <span>{timeAgo(update.date)}</span>
                <span>&middot;</span>
                <span>{readingTime(update.summary)}</span>
              </div>
              <h3 className="text-[15px] font-medium text-gray-900 leading-snug group-hover:text-gray-700">
                {update.headline}
              </h3>
            </div>

            {/* Bookmark button */}
            <button
              data-bookmark
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark();
              }}
              className={`p-1 transition-colors cursor-pointer shrink-0 mt-0.5 ${
                bookmarked ? "text-blue-500" : "text-gray-300 hover:text-gray-500"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill={bookmarked ? "currentColor" : "none"}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Description — full width below divider */}
      {(update.description || update.summary) && (
        <div className="px-4 pb-4">
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[13px] text-gray-400 leading-relaxed">
              {cleanText(update.description || update.summary.split("\n")[0])}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
