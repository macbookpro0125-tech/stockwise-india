// The Watchlist tab's dot (Header.jsx): anything new about the starred
// companies since the Watchlist page was last opened (23 Oct 2026, "what
// brings people back"). The moment it was last opened is kept in this
// browser; the server counts what came after (/api/news/watchlist-latest).
// The first visit only starts the clock, so a new account has no dot.
import { useEffect, useSyncExternalStore } from "react";
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

// One check for the whole page (7 Nov 2026). The dot is shown by every tab
// row (Header, TopBar, SideRail, the bottom bar, the phone's chrome), and each
// used to run its own check, timer and visibility listener — four or five
// calls a load, more on each phone/computer switch, a burst on each return to
// the tab. Now the first to mount starts one checker; the rest read its dot.
// It stops (and the dot clears) only when none is left for a moment, i.e.
// signed out, so signing in again checks afresh.
let dot = false;
let gen = 0;             // bumped when the dot is cleared, so a reply already on its way is ignored
let inflight = null;
let running = null;      // { timer, onSeen, onVisible } while the checker runs
let stopping = null;
const subs = new Set();
const setDot = v => { if (dot !== v) { dot = v; subs.forEach(f => f()); } };

function check() {
  if (inflight) return inflight;
  const since = read();
  if (!since) { write(new Date().toISOString()); return null; }
  const g = gen;
  inflight = api.newsWatchLatest(since)
    .then(r => { if (g === gen && running) setDot(r.newCount > 0); })
    .catch(() => { /* no dot rather than a wrong one */ })
    .finally(() => { inflight = null; });
  return inflight;
}

function start() {
  if (running) return;
  const onSeen = () => { gen++; setDot(false); };
  const onVisible = () => { if (document.visibilityState === "visible") check(); };
  running = { timer: setInterval(check, EVERY), onSeen, onVisible };
  window.addEventListener(SEEN, onSeen);
  document.addEventListener("visibilitychange", onVisible);
  check();
}

function stop() {
  if (!running) return;
  clearInterval(running.timer);
  window.removeEventListener(SEEN, running.onSeen);
  document.removeEventListener("visibilitychange", running.onVisible);
  running = null;
  gen++;
  setDot(false);
}

function subscribe(f) {
  subs.add(f);
  clearTimeout(stopping);
  return () => {
    subs.delete(f);
    if (!subs.size) { clearTimeout(stopping); stopping = setTimeout(() => { if (!subs.size) stop(); }, 1000); }
  };
}

export function useWatchNewsDot() {
  const value = useSyncExternalStore(subscribe, () => dot, () => false);
  useEffect(() => { start(); }, []);
  return value;
}
