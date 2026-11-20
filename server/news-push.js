// News from a watchlist's companies, to the account's phones (push.js): the
// Watchlist tab's dot (src/watchNews.js), for when the app is closed. Every
// 15 minutes from 8 in the morning to 10 at night (IST), so nobody is woken;
// what came overnight goes in the morning's first message. Each account
// keeps the time of the newest item it was sent (users.push_news_at): an
// item goes once, and a phone added later starts from then, not from the
// last four days.
import { db } from "./db.js";
import { watchlistNews, bigOrders, ORDER_SUBJECT } from "./market-news.js";
import { record as recordOrders } from "./orders-archive.js";
import { pushReady, pushToUser } from "./push.js";
import { niceName } from "../src/stockName.js";

const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
// the watched company it's about: a filing's own, or the one a headline names
const about = (i, symbols) => niceName(i.company ?? (i.companies?.find(c => symbols.has(c.symbol)) ?? i.companies?.[0])?.name ?? "") || "News";

// An order a watched company announced, said with its size (20 Nov 2026, the
// owner agreed: an alert when a watchlist company wins an order), from the
// notice as Big orders read it (market-news.js bigOrders); null when the
// notice gave no size, so the filing's own title is used
const crore = v => `₹${v >= 100 ? Math.round(v).toLocaleString("en-IN") : v.toLocaleString("en-IN", { maximumFractionDigits: 2 })} crore`;
const dollars = f => `${f.currency === "EUR" ? "€" : "US$"}${f.mn.toLocaleString("en-IN", { maximumFractionDigits: 2 })} million`;
export function orderLine(o) {
  if (!o || o.status !== "stated" || (o.amountCr == null && !o.foreign)) return null;
  const size = o.amountCr != null ? crore(o.amountCr) : dollars(o.foreign);
  // "announced", not "won": some are letters of award or an MoU, as the notice says
  const head = o.lowestBidder ? `Named the lowest bidder for ${size}` : `Announced an order of ${size}`;
  const parts = [o.pctOfValue != null ? `${o.pctOfValue >= 1 ? Math.round(o.pctOfValue) : o.pctOfValue}% of its market value` : null, o.from ? `from ${o.from}` : null].filter(Boolean);
  return { head, more: parts.join(", "), what: o.what ?? null };
}

// The message for the new items (newest first) about the watched companies;
// null for none. orders: the Big orders read so far, by filing id
export function newsPush(items, symbols = new Set(), orders = new Map()) {
  if (!items.length) return null;
  const line = i => { const o = orderLine(orders.get(i.id)); return o ? `${o.head}${o.more ? ` (${o.more})` : ""}` : i.title; };
  if (items.length === 1) {
    const [i] = items;
    const o = orderLine(orders.get(i.id));
    if (o) return { title: `${about(i, symbols)}: ${o.head.charAt(0).toLowerCase()}${o.head.slice(1)}`, body: short([o.more && `${o.more.charAt(0).toUpperCase()}${o.more.slice(1)}.`, o.what].filter(Boolean).join(" ") || i.title, 180), data: { news: i.id } };
    return { title: about(i, symbols), body: short(i.title, 180), data: { news: i.id } };
  }
  const names = [...new Set(items.map(i => about(i, symbols)))];
  return {
    title: `${items.length} updates from your watchlist`,
    body: short(`${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}: ${line(items[0])}`, 180),
    data: { tab: "watchlist" },
  };
}

// push: (userId, message) => Promise<boolean>, injectable for the tests
export async function pushWatchlistNews({ push = pushToUser, log = console.error, now = new Date(), orders = new Map() } = {}) {
  const users = db.prepare("SELECT DISTINCT u.id, u.push_news_at FROM users u JOIN push_tokens t ON t.user_id = u.id").all();
  let sent = 0;
  for (const u of users) {
    const symbols = new Set(db.prepare("SELECT ticker FROM watchlist WHERE user_id = ?").all(u.id).map(r => r.ticker));
    // the first check only starts the clock
    if (!u.push_news_at) { db.prepare("UPDATE users SET push_news_at = ? WHERE id = ?").run(now.toISOString(), u.id); continue; }
    if (!symbols.size) continue;
    const items = await watchlistNews(symbols, u.push_news_at);
    // an order notice still being read (up to 30 minutes): wait for its size
    if (items.some(i => ORDER_SUBJECT.test(i.title ?? "") && orders.get(i.id)?.status === "reading" && now - Date.parse(i.time) < 30 * 60_000)) continue;
    const message = newsPush(items, symbols, orders);
    if (!message) continue;
    if (await push(u.id, message, { log })) sent++;
    // moved on either way: a phone that can't be reached isn't sent the same item every 15 minutes
    db.prepare("UPDATE users SET push_news_at = ? WHERE id = ?").run(items[0].time, u.id);
  }
  return { users: users.length, sent };
}

// IST is UTC+5:30 all year
const istHour = () => new Date(Date.now() + 330 * 60_000).getUTCHours();

export function startNewsPush({ everyMs = 15 * 60_000, log = console.error } = {}) {
  const tick = async () => {
    const h = istHour();
    if (!pushReady() || h < 8 || h >= 22) return;
    try {
      // the orders read so far (and kept for Big orders' days, orders-archive.js)
      const big = await bigOrders().catch(() => null);
      if (big) recordOrders(big.items);
      const orders = new Map((big?.items ?? []).map(o => [o.id, o]));
      const { sent } = await pushWatchlistNews({ log, orders });
      if (sent) log(`[news-push] sent to ${sent} account${sent === 1 ? "" : "s"}`);
    } catch (e) {
      log(`[news-push] ${e.message}`);
    }
  };
  setTimeout(tick, 2 * 60_000);
  setInterval(tick, everyMs);
}
