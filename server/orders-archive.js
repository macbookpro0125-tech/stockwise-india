// Big orders day by day (20 Nov 2026, the owner: "big orders like the
// results, so I can see the previous dates"). Every order notice read is kept
// with its day (data/cache/orders-archive.json): the live feed's as they're
// read (market-news.js bigOrders, through record()), and a past day asked for
// is read once from NSE — its announcements for that day, each order notice's
// own PDF (readOrderNotice) — then kept. Sizes as each company stated them.
import { NSE_BASE, fetchJson } from "./fetch-nse.js";
import { ORDER_SUBJECT, readOrderNotice, plainLetters } from "./market-news.js";
import { nseDate } from "./company-orders.js";
import { readCache, writeCache } from "./cache-dir.js";
import { allMetrics } from "./screen.js";

const FILE = "orders-archive.json";
const KEEP_DAYS = 120;
const DAY = 86_400_000;
const istDay = iso => new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString().slice(0, 10);
const todayIst = () => istDay(new Date().toISOString());
const ddmmyyyy = day => { const [y, m, d] = day.split("-"); return `${d}-${m}-${y}`; };

let archive = null; // { orders: { id: order }, done: { day: true } }
const load = () => (archive ??= readCache(FILE, null) ?? { orders: {}, done: {} });
let saveTimer = null;
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => writeCache(FILE, archive), 2000); };

// what's kept of an order (the page adds the company's value today)
const keepOf = (o, day) => ({
  id: o.id, day, symbol: o.symbol, company: o.company, time: o.time, url: o.url ?? null,
  status: o.status, amountCr: o.amountCr ?? null, foreign: o.foreign ?? null, lowestBidder: !!o.lowestBidder,
  from: plainLetters(o.from) ?? null, what: plainLetters(o.what) ?? null, wholeContract: o.wholeContract ?? null,
});

// The live feed's orders, once read (not while "reading")
export function record(items) {
  const a = load();
  let changed = false;
  for (const o of items ?? []) {
    if (!o?.id || !o.time || o.status === "reading" || a.orders[o.id]) continue;
    a.orders[o.id] = keepOf(o, istDay(o.time));
    changed = true;
  }
  if (changed) { prune(); save(); }
}

function prune() {
  const a = load();
  const cut = new Date(Date.now() - KEEP_DAYS * DAY).toISOString().slice(0, 10);
  for (const [id, o] of Object.entries(a.orders)) if (o.day < cut) delete a.orders[id];
  for (const d of Object.keys(a.done)) if (d < cut) delete a.done[d];
}

// NSE's rows for a day → its order notices
export function orderNoticesOf(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter(r => ORDER_SUBJECT.test(r.desc ?? "") && r.seq_id && r.symbol)
    .map(r => ({ id: `nse-${r.seq_id}`, symbol: r.symbol, company: r.sm_name ?? r.symbol, time: nseDate(r.sort_date ?? r.an_dt), title: r.desc, summary: r.attchmntText && r.attchmntText !== r.desc && !/has informed the exchange/i.test(r.attchmntText) ? String(r.attchmntText) : null, url: /^https:\/\/nsearchives\.nseindia\.(com|in)\//.test(r.attchmntFile ?? "") ? r.attchmntFile : null }))
    .filter(o => o.time);
}

const reading = new Map(); // day → { left }
const failed = new Set();
const readOnce = new Set(); // today, once its notices have been read through
const lastRead = new Map(); // today → when it was last read (read again after 15 minutes)
async function readDay(day) {
  const a = load();
  const rows = await fetchJson(`${NSE_BASE}/api/corporate-announcements?index=equities&from_date=${ddmmyyyy(day)}&to_date=${ddmmyyyy(day)}`);
  if (!Array.isArray(rows)) throw new Error("NSE's announcements couldn't be read");
  const notices = orderNoticesOf(rows).filter(o => istDay(o.time) === day && !a.orders[o.id]);
  const state = { left: notices.length };
  reading.set(day, state);
  for (const n of notices) {
    const r = await readOrderNotice(n).catch(() => ({ failed: true }));
    a.orders[n.id] = keepOf({
      ...n, status: r.failed ? "unread" : r.amount ? "stated" : "none",
      amountCr: r.amount?.cr ?? null, foreign: r.amount?.currency ? { currency: r.amount.currency, mn: r.amount.mn } : null,
      lowestBidder: !!r.l1, from: r.from ?? null, what: r.what ?? null,
      wholeContract: r.amount?.wholeContract === true ? true : r.amount?.wholeContract?.cr ?? null,
    }, day);
    state.left--;
    save();
    await new Promise(res => setTimeout(res, 300));
  }
  // a day that's over is read for good; today is read again as it goes
  if (day < todayIst()) a.done[day] = true;
  save();
}

// The trading days on offer: the last 30 weekdays to today, newest last
export function recentDays(today = todayIst(), n = 30) {
  const out = [];
  for (let t = Date.parse(`${today}T00:00:00Z`); out.length < n; t -= DAY) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out.reverse();
}

// A day's orders, each once: the live feed's copy and the day's own read of
// the same notice, or a company filing the same order twice, kept once
export function dayOrders(a, day) {
  const seen = new Set();
  return Object.values(a.orders).filter(o => o.day === day)
    .sort((x, y) => x.time.localeCompare(y.time))
    .filter(o => { const k = `${o.symbol}|${o.amountCr ?? o.foreign?.mn ?? o.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// The orders of `day` (YYYY-MM-DD), biggest first, the day being read if it
// isn't kept yet: { day, items, reading, days: [{ day, count|null }] }
export function ordersOn(day) {
  const a = load();
  const days = recentDays();
  // "latest": today once it has an order, else the trading day before
  if (!days.includes(day)) {
    const today = days.at(-1);
    day = Object.values(a.orders).some(o => o.day === today) || days.length < 2 ? today : days.at(-2);
  }
  if (!a.done[day] && !reading.has(day) && !(Date.now() - (lastRead.get(day) ?? 0) < 15 * 60_000)) {
    lastRead.set(day, Date.now());
    reading.set(day, { left: null });
    // a read that failed is said so (not "no orders"), and tried again when next asked
    readDay(day).then(() => { failed.delete(day); readOnce.add(day); }, () => { failed.add(day); lastRead.delete(day); }).finally(() => reading.delete(day));
  }
  const rows = new Map((allMetrics().rows ?? []).map(r => [r.symbol, r]));
  const items = dayOrders(a, day)
    .map(o => {
      const r = rows.get(o.symbol), mcap = r?.marketCapCr ?? null;
      return { ...o, from: plainLetters(o.from), what: plainLetters(o.what), company: r?.name ?? o.company, marketCapCr: mcap, pctOfValue: o.amountCr != null && mcap > 0 ? Math.round((o.amountCr / mcap) * 1000) / 10 : null };
    });
  const rank = i => (i.amountCr != null ? 2e9 + i.amountCr : i.foreign ? 1e9 + i.foreign.mn : 0);
  items.sort((x, y) => rank(y) - rank(x) || y.time.localeCompare(x.time));
  // a count once the day's been read (today: or once it has an order)
  const count = d => { const n = dayOrders(a, d).length; return a.done[d] || readOnce.has(d) || (d === todayIst() && n) ? n : null; };
  const r = reading.get(day);
  return { day, items, reading: r ? (r.left ?? 1) : 0, failed: !r && !items.length && failed.has(day), days: days.map(d => ({ day: d, count: count(d) })) };
}
