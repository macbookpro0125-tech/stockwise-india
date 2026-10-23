// The Watchlist tab's dot (Header.jsx): anything new about the starred
// companies since the Watchlist page was last opened (23 Oct 2026, "what
// brings people back"). The moment it was last opened is kept in this
// browser; the server counts what came after (/api/news/watchlist-latest).
// The first visit only starts the clock, so a new account has no dot.
import { useEffect, useState } from "react";
import { api } from "./api.js";

const KEY = "watch-news-seen";
const SEEN = "watch-news-seen-changed";
const EVERY = 15 * 60 * 1000;

const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = v => { try { localStorage.setItem(KEY, v); } catch { /* private mode: no dot, no harm */ } };

export function markWatchNewsSeen() {
  write(new Date().toISOString());
  window.dispatchEvent(new Event(SEEN));
}

export function useWatchNewsDot() {
  const [dot, setDot] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const since = read();
      if (!since) { write(new Date().toISOString()); return; }
      try { const r = await api.newsWatchLatest(since); if (alive) setDot(r.newCount > 0); } catch { /* no dot rather than a wrong one */ }
    };
    const onSeen = () => setDot(false);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    check();
    const t = setInterval(check, EVERY);
    window.addEventListener(SEEN, onSeen);
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; clearInterval(t); window.removeEventListener(SEEN, onSeen); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return dot;
}
