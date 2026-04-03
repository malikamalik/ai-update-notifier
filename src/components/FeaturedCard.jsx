import { useNavigate } from "react-router-dom";
import { PROVIDERS } from "../data/providers";

function readingTime(text) {
  const words = (text || "").split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

export default function FeaturedCard({ update }) {
  const provider = PROVIDERS[update.provider];
  const navigate = useNavigate();

  return (
    <div>
      <div
        onClick={() => navigate(`/article/${update.id}`)}
        className="block rounded-2xl overflow-hidden relative cursor-pointer group"
        style={{ minHeight: "260px" }}
      >
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${provider?.bgColor || "#f3f4f6"} 0%, #e5e7eb 50%, #9ca3af 100%)`,
          }}
        />

        {/* 3-dot indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          <span className="w-2 h-2 rounded-full bg-white/40" />
          <span className="w-2 h-2 rounded-full bg-white/60" />
          <span className="w-2 h-2 rounded-full bg-white/40" />
        </div>

        {/* Large watermark logo */}
        {provider?.logo && (
          <div className="absolute inset-0 flex items-center justify-center opacity-25">
            <img
              src={provider.logo}
              alt=""
              className="w-28 h-28 object-contain"
              style={{ filter: "grayscale(100%)" }}
            />
          </div>
        )}

        {/* Bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/60 to-transparent pt-16">
          <div className="flex items-center gap-2 text-white/80 text-xs mb-2">
            <span>{readingTime(update.summary)}</span>
            <span>&middot;</span>
            <span>{formatDate(update.date)}</span>
          </div>
          <h3 className="text-white text-lg font-medium leading-snug pr-28 group-hover:underline">
            {update.headline}
          </h3>
        </div>

        {/* Provider badge */}
        <div className="absolute bottom-4 right-4">
          <span className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-gray-800">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: provider?.color }}
            />
            {provider?.name}
          </span>
        </div>
      </div>

      {/* Description below the card */}
      {update.summary && (
        <div className="mt-2 px-5 py-3 bg-white rounded-xl border border-gray-100">
          <p className="text-[13px] text-gray-400 leading-relaxed">
            {cleanText(update.description || update.summary.split("\n")[0])}
          </p>
        </div>
      )}
    </div>
  );
}
