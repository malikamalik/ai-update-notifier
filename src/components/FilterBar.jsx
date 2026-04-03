import { PROVIDERS } from "../data/providers";

export default function FilterBar({ activeFilter, onFilterChange, activeProviders }) {
  // Only show providers that have articles
  const visibleProviders = activeProviders
    ? Object.entries(PROVIDERS).filter(([key]) => activeProviders.has(key))
    : Object.entries(PROVIDERS);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onFilterChange("all")}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer border ${
          activeFilter === "all"
            ? "border-blue-500 text-blue-600 bg-white"
            : "border-gray-200 text-gray-600 bg-white hover:border-gray-300"
        }`}
      >
        All
      </button>
      {visibleProviders.map(([key, provider]) => {
        const isActive = activeFilter === key;
        return (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer border ${
              isActive
                ? "border-blue-500 text-gray-900 bg-white"
                : "border-gray-200 text-gray-600 bg-white hover:border-gray-300"
            }`}
          >
            <img
              src={provider.logo}
              alt=""
              className="w-4 h-4 object-contain"
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
