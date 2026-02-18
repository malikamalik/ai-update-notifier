import { PROVIDERS } from "../data/providers";
import ProviderBadge from "./ProviderBadge";

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const days = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function UpdateCard({ update }) {
  const provider = PROVIDERS[update.provider];

  return (
    <div
      className="relative bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group"
      style={{ borderLeftWidth: "4px", borderLeftColor: provider?.color }}
    >
      {update.isNew && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
          New
        </span>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ProviderBadge provider={update.provider} />
          {update.isLive && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
              <span className="w-1 h-1 bg-green-500 rounded-full" />
              LIVE
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{timeAgo(update.date)}</span>
      </div>

      <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug group-hover:text-gray-700">
        {update.headline}
      </h3>

      <p className="text-sm text-gray-600 leading-relaxed mb-3">{update.summary}</p>

      <div className="flex items-center justify-between">
        {update.link && (
          <a
            href={update.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: provider?.color }}
          >
            {update.source ? `Read on ${update.source}` : "Read source"}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
