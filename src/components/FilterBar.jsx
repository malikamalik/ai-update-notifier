import { PROVIDERS } from "../data/providers";

export default function FilterBar({ activeFilter, onFilterChange, activeProviders }) {
  const visibleProviders = activeProviders
    ? Object.entries(PROVIDERS).filter(([key]) => activeProviders.has(key))
    : Object.entries(PROVIDERS);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onFilterChange("all")}
        className={`px-5 py-3 rounded-xl text-base font-medium transition-all duration-150 cursor-pointer border ${
          activeFilter === "all"
            ? "border-blue-500 text-blue-600 bg-white"
            : "border-gray-200 text-gray-600 bg-gray-50 hover:border-gray-300"
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
            className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-base font-medium transition-all duration-150 cursor-pointer border ${
              isActive
                ? "border-blue-500 text-gray-900 bg-white"
                : "border-gray-200 text-gray-600 bg-gray-50 hover:border-gray-300"
            }`}
          >
            {provider.logo ? (
              <img
                src={provider.logo}
                alt=""
                className="w-6 h-6 object-contain"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: provider.color }}
              />
            )}
            {provider.name}
          </button>
        );
      })}
    </div>
  );
}
