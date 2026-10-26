import { useEffect, useState } from "react";
import { api } from "./api.js";

// The phone's Screeners page (PhoneScreens.jsx): the screeners starred to
// its top — kept with the account, so every device shows the same ones — and
// what joined or left each since it was last opened (server/
// screen-favourites.js); and the ones opened lately, kept on this device.

let favourites = null; // [id], in the order starred
let changes = {}; // { id: { joinedCount, leftCount, joined, left, seenAt } }
let today = {}; // { id: { avg1d, best, worst, resultsCount, results } } — the starred ones' day
let pricesDate = null;
let loading = null;
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn());

const load = () => (loading ??= api.screensHome()
  .then(d => { favourites = d.favourites ?? []; changes = d.changes ?? {}; today = d.today ?? {}; pricesDate = d.pricesDate ?? null; emit(); })
  .catch(() => { favourites ??= []; emit(); })
  .finally(() => { loading = null; }));

export const screensHome = {
  load,
  favourites: () => favourites ?? [],
  changes: () => changes,
  isFavourite: id => (favourites ?? []).includes(id),
  toggle(id) {
    const next = this.isFavourite(id) ? favourites.filter(x => x !== id) : [...(favourites ?? []), id];
    favourites = next;
    emit();
    // a new star starts from today's companies on the server; read it back
    return api.saveFavouriteScreens(next).then(() => load()).catch(() => load());
  },
  // Opening a screener: its companies noted, so its change starts again
  opened(id) {
    noteRecent(id);
    if (changes[id]) { changes = { ...changes, [id]: { ...changes[id], joinedCount: 0, leftCount: 0, joined: [], left: [], seenAt: new Date().toISOString() } }; emit(); }
    api.markScreenSeen(id).catch(() => {});
  },
  reset() { favourites = null; changes = {}; today = {}; pricesDate = null; emit(); },
};

// Kept mounted pages redraw when any of it changes
export function useScreensHome() {
  const [, setN] = useState(0);
  useEffect(() => {
    const fn = () => setN(n => n + 1);
    listeners.add(fn);
    if (favourites == null) load();
    return () => listeners.delete(fn);
  }, []);
  return { favourites: screensHome.favourites(), changes, today, pricesDate, recents: recents(), loaded: favourites != null };
}

// The last screeners opened on this device, newest first: [{ id, at }]
const RECENT_KEY = "stockwise-recent-screens";
const MAX_RECENT = 8;
function recents() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter(r => r && typeof r.id === "string"); } catch { return []; }
}
function noteRecent(id) {
  try {
    const next = [{ id, at: Date.now() }, ...recents().filter(r => r.id !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
  emit();
}
export const forgetRecentScreens = () => { try { localStorage.removeItem(RECENT_KEY); } catch {} emit(); };

// "2 h ago", "Yesterday", "Mon", "12 Oct"
export function whenOpened(at, now = Date.now()) {
  const mins = Math.round((now - at) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 12) return `${Math.round(mins / 60)} h ago`;
  const day = d => new Date(d).toDateString();
  const yesterday = new Date(now - 864e5);
  if (day(at) === day(now)) return "Today";
  if (day(at) === day(yesterday)) return "Yesterday";
  if (now - at < 6 * 864e5) return new Date(at).toLocaleDateString("en-IN", { weekday: "short" });
  return new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
