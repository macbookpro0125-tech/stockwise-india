// News from a watchlist's companies, to the account's phones (push.js): the
// Watchlist tab's dot (src/watchNews.js), for when the app is closed. Every
// 15 minutes from 8 in the morning to 10 at night (IST), so nobody is woken;
// what came overnight goes in the morning's first message. Each account
// keeps the time of the newest item it was sent (users.push_news_at): an
// item goes once, and a phone added later starts from then, not from the
// last four days.
import { db } from "./db.js";
import { watchlistNews } from "./market-news.js";
import { pushReady, pushToUser } from "./push.js";
import { niceName } from "../src/stockName.js";

const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
// the watched company it's about: a filing's own, or the one a headline names
const about = (i, symbols) => niceName(i.company ?? (i.companies?.find(c => symbols.has(c.symbol)) ?? i.companies?.[0])?.name ?? "") || "News";

// The message for the new items (newest first) about the watched companies;
// null for none
export function newsPush(items, symbols = new Set()) {
  if (!items.length) return null;
  if (items.length === 1) {
    const [i] = items;
    return { title: about(i, symbols), body: short(i.title, 180), data: { news: i.id } };
  }
  const names = [...new Set(items.map(i => about(i, symbols)))];
  return {
    title: `${items.length} updates from your watchlist`,
    body: short(`${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}: ${items[0].title}`, 180),
    data: { tab: "watchlist" },
  };
}

// push: (userId, message) => Promise<boolean>, injectable for the tests
export async function pushWatchlistNews({ push = pushToUser, log = console.error, now = new Date() } = {}) {
  const users = db.prepare("SELECT DISTINCT u.id, u.push_news_at FROM users u JOIN push_tokens t ON t.user_id = u.id").all();
  let sent = 0;
  for (const u of users) {
    const symbols = new Set(db.prepare("SELECT ticker FROM watchlist WHERE user_id = ?").all(u.id).map(r => r.ticker));
    // the first check only starts the clock
    if (!u.push_news_at) { db.prepare("UPDATE users SET push_news_at = ? WHERE id = ?").run(now.toISOString(), u.id); continue; }
    if (!symbols.size) continue;
    const items = await watchlistNews(symbols, u.push_news_at);
    const message = newsPush(items, symbols);
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
      const { sent } = await pushWatchlistNews({ log });
      if (sent) log(`[news-push] sent to ${sent} account${sent === 1 ? "" : "s"}`);
    } catch (e) {
      log(`[news-push] ${e.message}`);
    }
  };
  setTimeout(tick, 2 * 60_000);
  setInterval(tick, everyMs);
}
