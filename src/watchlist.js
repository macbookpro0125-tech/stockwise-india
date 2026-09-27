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

export async function toggleWatch(symbol) {
  const had = symbols?.has(symbol);
  symbols = new Set(symbols ?? []);
  if (had) symbols.delete(symbol); else symbols.add(symbol);
  notify();
  try {
    if (had) await api.removeWatch(symbol); else await api.addWatch(symbol);
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
