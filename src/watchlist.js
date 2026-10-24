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
    .then(d => { symbols = new Set(d.items.map(i => i.ticker)); notify(); setLists(d.lists ?? []); })
    .catch(() => { symbols = new Set(); notify(); setLists([]); })
    .finally(() => { loading = null; });
  return loading;
}

// ---- The named lists (the Watchlist page's tabs), shared the same way --------
// so a stock starred anywhere can go straight into one (SaveToList.jsx), and the
// company page's Lists button and the Watchlist page agree

let lists = null; // [{ id, name, tickers }], once loaded
const listListeners = new Set();
function setLists(next) { lists = next; listListeners.forEach(fn => fn(lists)); }

export function useWatchLists() {
  const [value, setValue] = useState(lists ?? []);
  useEffect(() => {
    listListeners.add(setValue);
    if (lists) setValue(lists); else load();
    return () => listListeners.delete(setValue);
  }, []);
  return value;
}
// (the Watchlist page has them from its own fetch)
export const primeWatchLists = next => setLists(next);

// In or out of a list: at once, the server following; a failure puts it back.
// In a list stars it.
export async function setInList(id, ticker, on) {
  const flip = add => setLists((lists ?? []).map(l => (l.id !== id ? l : { ...l, tickers: add ? [ticker, ...l.tickers.filter(t => t !== ticker)] : l.tickers.filter(t => t !== ticker) })));
  flip(on);
  if (on && !symbols?.has(ticker)) { symbols = new Set(symbols ?? []).add(ticker); notify(); }
  const request = on ? api.addToWatchList(id, ticker) : api.removeFromWatchList(id, ticker);
  saving = Promise.all([saving, request.catch(() => {})]);
  try { await request; } catch { flip(!on); }
}
export async function createList(name, tickers = []) {
  const { list } = await api.createWatchList(name, tickers);
  setLists([...(lists ?? []), list]);
  if (tickers.some(t => !symbols?.has(t))) { symbols = new Set([...(symbols ?? []), ...tickers]); notify(); }
  return list;
}
export async function renameList(id, name) {
  await api.renameWatchList(id, name);
  setLists((lists ?? []).map(l => (l.id === id ? { ...l, name } : l)));
}
export async function deleteList(id) {
  await api.deleteWatchList(id);
  setLists((lists ?? []).filter(l => l.id !== id));
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
  // unstarred: out of every list (as the server does)
  const listsBefore = lists;
  if (had && lists) setLists(lists.map(l => ({ ...l, tickers: l.tickers.filter(t => t !== symbol) })));
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
    if (had && listsBefore) setLists(listsBefore);
  }
}

// After sign-out, the next user must not see this one's stars
export function resetWatchlist() {
  symbols = null;
  lists = null;
}
