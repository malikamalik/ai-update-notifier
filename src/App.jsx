import { useState, useEffect, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import { updates as staticUpdates } from "./data/updates";
import { fetchAllNews, hasApiKey } from "./services/newsService";
import UpdateCard from "./components/UpdateCard";
import FeaturedCarousel from "./components/FeaturedCard";
import FilterBar from "./components/FilterBar";
import ArticlePage from "./components/ArticlePage";

const REFRESH_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
const STALE_THRESHOLD = 6 * 60 * 60 * 1000; // 6 hours
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

function formatLastUpdated(date) {
  if (!date) return "";
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function FeedPage({ allUpdates, activeFilter, setActiveFilter, bookmarks, toggleBookmark, loading, lastRefresh, refreshNews }) {
  const [showBookmarks, setShowBookmarks] = useState(false);
  const activeProviders = new Set(allUpdates.map((u) => u.provider));

  let filteredUpdates =
    activeFilter === "all"
      ? allUpdates
      : allUpdates.filter((u) => u.provider === activeFilter);

  const showFeatured = activeFilter === "all" && !showBookmarks;
  const featuredUpdates = showFeatured ? filteredUpdates.slice(0, 5) : [];
  const restUpdates = showBookmarks
    ? filteredUpdates.filter((u) => bookmarks.has(String(u.id)))
    : filteredUpdates;

  const articleCount = allUpdates.length;
  const providerCount = new Set(allUpdates.map((u) => u.provider)).size;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-medium text-gray-900 tracking-tight">AI Signals</h1>
            {loading && (
              <svg className="w-4 h-4 text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mb-6">
          <FilterBar activeFilter={activeFilter} onFilterChange={(f) => { setActiveFilter(f); setShowBookmarks(false); }} activeProviders={activeProviders} />
        </div>

        {/* Featured */}
        {featuredUpdates.length > 0 && (
          <section className="mb-4">
            <h2 className="text-lg font-medium text-gray-900 mb-3">New AI Signals</h2>
            <FeaturedCarousel updates={featuredUpdates} />
          </section>
        )}

        {/* All Signals */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-gray-900">
              {showBookmarks ? "Bookmarks" : "All Signals"}
            </h2>
            <button
              onClick={() => setShowBookmarks(!showBookmarks)}
              className={`text-xs font-medium cursor-pointer transition-colors ${
                showBookmarks ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {showBookmarks ? "All Signals" : "Bookmarks"}
            </button>
          </div>

          <div className="flex flex-col gap-3">
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

        {/* Footer */}
        <footer className="mt-10 pt-6 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-300">
            AI Signals — Tracking updates from {providerCount}+ AI providers
          </p>
          <p className="text-[11px] text-gray-300 mt-0.5">
            Refreshes every 12 hours
          </p>
        </footer>
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
      const getPhrases = (s) => {
        const words = s.match(/\b[a-z0-9]+\b/g) || [];
        const phrases = new Set();
        for (let i = 0; i < words.length - 1; i++) {
          phrases.add(words[i] + " " + words[i + 1]);
        }
        return phrases;
      };
      const phrases = getPhrases(h);
      const isDupe = acc.some((existing) => {
        const eh = existing.headline.toLowerCase();
        if (eh.slice(0, 50) === h.slice(0, 50)) return true;
        const ePhrases = getPhrases(eh);
        let shared = 0;
        let hasVersionMatch = false;
        for (const p of phrases) {
          if (ePhrases.has(p)) {
            shared++;
            if (/\d/.test(p)) hasVersionMatch = true;
          }
        }
        if (hasVersionMatch || shared >= 3) return true;
        return false;
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
            loading={loading}
            lastRefresh={lastRefresh}
            refreshNews={refreshNews}
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
