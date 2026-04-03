import { useState, useEffect, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import { updates as staticUpdates } from "./data/updates";
import { fetchAllNews, hasApiKey } from "./services/newsService";
import UpdateCard from "./components/UpdateCard";
import FeaturedCard from "./components/FeaturedCard";
import FilterBar from "./components/FilterBar";
import ArticlePage from "./components/ArticlePage";

const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour
const STALE_THRESHOLD = 30 * 60 * 1000; // 30 minutes
const CACHE_KEY = "ai-update-notifier-live";
const BOOKMARKS_KEY = "ai-update-notifier-bookmarks";

function loadCachedUpdates() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return { updates: [], timestamp: null };
    const { updates, timestamp } = JSON.parse(cached);
    return { updates: updates || [], timestamp: timestamp ? new Date(timestamp) : null };
  } catch {
    return { updates: [], timestamp: null };
  }
}

function saveCachedUpdates(updates) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ updates, timestamp: new Date().toISOString() }));
  } catch { /* localStorage full or unavailable */ }
}

function loadBookmarks() {
  try {
    return new Set(JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveBookmarks(bookmarks) {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...bookmarks]));
  } catch { /* localStorage full or unavailable */ }
}

function FeedPage({ allUpdates, activeFilter, setActiveFilter, bookmarks, toggleBookmark }) {
  const [showBookmarks, setShowBookmarks] = useState(false);
  const activeProviders = new Set(allUpdates.map((u) => u.provider));

  let filteredUpdates =
    activeFilter === "all"
      ? allUpdates
      : allUpdates.filter((u) => u.provider === activeFilter);

  const featured = !showBookmarks ? filteredUpdates[0] : null;
  const restUpdates = showBookmarks
    ? filteredUpdates.filter((u) => bookmarks.has(String(u.id)))
    : filteredUpdates.slice(1);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-8">
          <FilterBar activeFilter={activeFilter} onFilterChange={(f) => { setActiveFilter(f); setShowBookmarks(false); }} activeProviders={activeProviders} />
        </div>

        {featured && (
          <section className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">New AI Signals</h2>
            <FeaturedCard update={featured} />
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {showBookmarks ? "Bookmarks" : "All Signals"}
            </h2>
            <button
              onClick={() => setShowBookmarks(!showBookmarks)}
              className={`text-sm font-medium cursor-pointer transition-colors ${
                showBookmarks ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {showBookmarks ? "All Signals" : "Bookmarks"}
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {restUpdates.length > 0 ? (
              restUpdates.map((update) => (
                <UpdateCard
                  key={update.id}
                  update={update}
                  bookmarked={bookmarks.has(String(update.id))}
                  onToggleBookmark={() => toggleBookmark(String(update.id))}
                />
              ))
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p className="font-medium">
                  {showBookmarks ? "No bookmarks yet" : "No updates for this provider yet"}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function App() {
  const [activeFilter, setActiveFilter] = useState("all");
  const cached = loadCachedUpdates();
  const [liveUpdates, setLiveUpdates] = useState(cached.updates);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(cached.timestamp);
  const [apiConnected, setApiConnected] = useState(hasApiKey());
  const [bookmarks, setBookmarks] = useState(loadBookmarks);

  const toggleBookmark = useCallback((id) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveBookmarks(next);
      return next;
    });
  }, []);

  const refreshNews = useCallback(async () => {
    if (!hasApiKey()) return;
    setLoading(true);
    try {
      const news = await fetchAllNews();
      if (news.length > 0) {
        setLiveUpdates(news);
        saveCachedUpdates(news);
        setApiConnected(true);
      } else {
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

  useEffect(() => {
    refreshNews();
    const interval = setInterval(refreshNews, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshNews]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const age = lastRefresh ? Date.now() - lastRefresh.getTime() : Infinity;
      if (age > STALE_THRESHOLD) refreshNews();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshNews, lastRefresh]);

  const allUpdates = [...liveUpdates, ...staticUpdates].reduce(
    (acc, update) => {
      const h = update.headline.toLowerCase();
      const isDupe = acc.some((existing) => {
        // Basic client-side dedup — server handles content-level dedup via AI
        return existing.headline.toLowerCase().slice(0, 50) === h.slice(0, 50);
      });
      if (!isDupe) acc.push(update);
      return acc;
    },
    []
  );

  allUpdates.sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <Routes>
      <Route
        path="/"
        element={
          <FeedPage
            allUpdates={allUpdates}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            bookmarks={bookmarks}
            toggleBookmark={toggleBookmark}
          />
        }
      />
      <Route
        path="/article/:id"
        element={<ArticlePage allUpdates={allUpdates} />}
      />
    </Routes>
  );
}

export default App;
