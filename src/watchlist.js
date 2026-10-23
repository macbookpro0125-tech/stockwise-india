import { useState, useEffect } from "react";
import { api } from "./api.js";

// One shared copy of the signed-in user's watchlist symbols, so every star on
// the page (table rows, stock page, header count) agrees without each
// fetching it. Stars update at once; the server call follows, and a failure
// puts the star back.

let symbols = null; // Set, once loaded
let loading = null;
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn(symbols));

function load() {
  loading ??= api.watchlist()
    .then(d => { symbols = new Set(d.items.map(i => i.ticker)); notify(); })
    .catch(() => { symbols = new Set(); notify(); })
    .finally(() => { loading = null; });
  return loading;
}

export function useWatchlist() {
  const [set, setSet] = useState(symbols ?? new Set());
  useEffect(() => {
    listeners.add(setSet);
    if (symbols) setSet(symbols); else load();
    return () => listeners.delete(setSet);
  }, []);
  return set;
}

// price: what the page showed when starred (the card shows the move since);
// the server uses the day's close when none is given
// Resolves once every star or unstar sent so far has reached the server, so a
// list fetched after a star includes it (NewsView's My watchlist)
let saving = Promise.resolve();
export const watchSaved = () => saving;

export const WATCH_ADDED = "watch-added";

export async function toggleWatch(symbol, price) {
  const had = symbols?.has(symbol);
  symbols = new Set(symbols ?? []);
  if (had) symbols.delete(symbol); else symbols.add(symbol);
  notify();
  const request = had ? api.removeWatch(symbol) : api.addWatch(symbol, price);
  saving = Promise.all([saving, request.catch(() => {})]);
  try {
    await request;
    // a company starred: the Android app may offer its notifications (PushAsk.jsx)
    if (!had && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(WATCH_ADDED, { detail: { symbol } }));
  } catch {
    symbols = new Set(symbols);
    if (had) symbols.add(symbol); else symbols.delete(symbol);
    notify();
  }
}

// After sign-out, the next user must not see this one's stars
export function resetWatchlist() {
  symbols = null;
}
