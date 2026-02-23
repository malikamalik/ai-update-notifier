import { useState, useEffect, useCallback } from "react";
import { updates as staticUpdates } from "./data/updates";
import { fetchAllNews, hasApiKey } from "./services/newsService";
import UpdateCard from "./components/UpdateCard";
import FilterBar from "./components/FilterBar";

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

function App() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [apiConnected, setApiConnected] = useState(hasApiKey());

  const refreshNews = useCallback(async () => {
    if (!hasApiKey()) return;
    setLoading(true);
    try {
      const news = await fetchAllNews();
      if (news.length > 0) {
        setLiveUpdates(news);
        setApiConnected(true);
      } else {
        console.warn("[App] fetchAllNews returned 0 results");
        setApiConnected(false);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.warn("[App] refreshNews failed:", err.message);
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + auto-refresh
  useEffect(() => {
    refreshNews();
    const interval = setInterval(refreshNews, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshNews]);

  // Merge live + static, deduplicate by headline similarity
  const allUpdates = [...liveUpdates, ...staticUpdates].reduce(
    (acc, update) => {
      const isDupe = acc.some(
        (existing) =>
          existing.headline.toLowerCase().slice(0, 40) ===
          update.headline.toLowerCase().slice(0, 40)
      );
      if (!isDupe) acc.push(update);
      return acc;
    },
    []
  );

  // Sort by date descending
  allUpdates.sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredUpdates =
    activeFilter === "all"
      ? allUpdates
      : allUpdates.filter((u) => u.provider === activeFilter);

  const newCount = allUpdates.filter((u) => u.isNew).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                AI Update Feed
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-gray-500">
                  New features & launches from top AI providers
                </p>
                {apiConnected && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {loading && (
                <svg
                  className="w-4 h-4 text-gray-400 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              )}
              <button
                onClick={refreshNews}
                disabled={loading}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Refresh news"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              {newCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  {newCount} new
                </span>
              )}
            </div>
          </div>
          {lastRefresh && (
            <p className="text-[10px] text-gray-400 mt-1">
              Last updated:{" "}
              {lastRefresh.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" \u00b7 Auto-refreshes every 30 min"}
            </p>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Filter Bar */}
        <div className="mb-6">
          <FilterBar
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        </div>

        {/* Updates List */}
        <div className="flex flex-col gap-4">
          {filteredUpdates.length > 0 ? (
            filteredUpdates.map((update) => (
              <UpdateCard key={update.id} update={update} />
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-medium">No updates for this provider yet</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
