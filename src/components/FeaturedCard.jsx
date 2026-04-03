import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PROVIDERS } from "../data/providers";

function readingTime(text) {
  const words = (text || "").split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDescription(update) {
  const summary = update.summary || "";
  const tldrMatch = summary.match(/^TL;?DR:?\s*(.+?)(?:\n|$)/i);
  if (tldrMatch) return tldrMatch[1].trim();
  const text = update.description || summary.split("\n")[0];
  if (text.endsWith("...") || text.endsWith("\u2026")) {
    const clean = text.replace(/\.{3}$|\u2026$/, "");
    const lastDot = clean.lastIndexOf(".");
    if (lastDot > 20) return clean.slice(0, lastDot + 1);
  }
  return text;
}

export default function FeaturedCarousel({ updates }) {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  if (!updates || updates.length === 0) return null;

  const featured = updates.slice(0, 5); // max 5 in carousel
  const update = featured[current];
  const provider = PROVIDERS[update.provider];

  return (
    <div>
      <div
        onClick={() => navigate(`/article/${update.id}`)}
        className="block rounded-2xl overflow-hidden relative cursor-pointer group"
        style={{ minHeight: "260px" }}
      >
        {/* Background: article image or gradient */}
        {update.image ? (
          <>
            <img
              src={update.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${provider?.bgColor || "#f3f4f6"} 0%, #e5e7eb 50%, #9ca3af 100%)`,
              }}
            />
            {provider?.logo && (
              <div className="absolute inset-0 flex items-center justify-center opacity-25">
                <img src={provider.logo} alt="" className="w-28 h-28 object-contain" style={{ filter: "grayscale(100%)" }} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </>
        )}

        {/* Dot indicators */}
        {featured.length > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {featured.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  i === current ? "bg-white/90" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        {/* Bottom overlay text */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
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
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: provider?.color }} />
            {provider?.name}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="mt-2 px-5 py-3 bg-white rounded-xl border border-gray-100">
        <p className="text-[13px] text-gray-400 leading-relaxed">
          {getDescription(update)}
        </p>
      </div>
    </div>
  );
}
