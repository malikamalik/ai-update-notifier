import { useState } from "react";
import { PROVIDERS } from "../data/providers";

export default function ProviderBadge({ provider }) {
  const info = PROVIDERS[provider];
  const [imgError, setImgError] = useState(false);

  if (!info) return null;

  const isSvg = info.logo?.endsWith(".svg");

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: info.bgColor, color: info.color }}
    >
      {info.logo && !imgError ? (
        <img
          src={info.logo}
          alt={info.name}
          className="w-4 h-4 object-contain"
          style={isSvg ? { filter: `brightness(0) saturate(100%)` } : undefined}
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
          style={{ backgroundColor: info.color }}
        >
          {info.name.charAt(0)}
        </span>
      )}
      {info.name}
    </span>
  );
}
