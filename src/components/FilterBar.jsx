import { PROVIDERS } from "../data/providers";

export default function FilterBar({ activeFilter, onFilterChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onFilterChange("all")}
        className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer ${
          activeFilter === "all"
            ? "bg-gray-900 text-white shadow-sm"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        All Updates
      </button>
      {Object.entries(PROVIDERS).map(([key, provider]) => {
        const isActive = activeFilter === key;
        return (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer ${
              isActive
                ? "text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            style={isActive ? { backgroundColor: provider.color } : undefined}
          >
            <img
              src={provider.logo}
              alt=""
              className="w-4 h-4 object-contain"
              style={
                isActive
                  ? { filter: "brightness(0) invert(1)" }
                  : { filter: "brightness(0) saturate(100%)" }
              }
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
            {provider.name}
          </button>
        );
      })}
    </div>
  );
}
