// "Tell me when a company joins my screen" (31 Oct 2026). Once a day, after
// the evening's prices arrive, each account's saved screens that have it
// switched on are run again; the companies that have joined since the last
// check go in one message, to the account's phones (push.js) and Telegram
// when linked. The match state is the one the app's "N new" badges read
// (user-notes.js checkStrategyMatches), so a company named here is also new
// on the screen's card until the screen is opened. A screen's first check
// only records what it matches: no message about everything at once.
import { db } from "./db.js";
import { listStrategies, checkStrategyMatches } from "./user-notes.js";
import { allMetrics, matchingSymbols, marketCurrent, marketReady } from "./screen.js";
import { loadMarketSnapshot } from "./market-data.js";
import { pushReady, pushToUser } from "./push.js";
import { sendTelegram, escapeHtml, telegramToken } from "./telegram.js";
import { niceName } from "../src/stockName.js";

const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const names = (list, nameOf, n = 3) => `${list.slice(0, n).map(nameOf).join(", ")}${list.length > n ? ` and ${list.length - n} more` : ""}`;

// groups: [{ screen, symbols }] with something in each; null for none
export function screenArrivalsPush(groups, nameOf = s => s) {
  if (!groups.length) return null;
  const total = groups.reduce((t, g) => t + g.symbols.length, 0);
  if (groups.length === 1 && total === 1) {
    return { title: `${nameOf(groups[0].symbols[0])} joined “${groups[0].screen}”`, body: "It now passes every filter in your screen. Open it to see why.", data: { tab: "discover" } };
  }
  return {
    title: `${total} new ${total === 1 ? "company" : "companies"} in your screens`,
    body: short(groups.map(g => `${g.screen}: ${names(g.symbols, nameOf)}`).join(" · "), 180),
    data: { tab: "discover" },
  };
}

export function screenArrivalsTelegram(groups, nameOf = s => s) {
  const lines = groups.map(g => `<b>${escapeHtml(g.screen)}</b>: ${escapeHtml(names(g.symbols, nameOf, 8))}`);
  return `New in your screens today\n${lines.join("\n")}\n\nThey now pass every filter in the screen. Open Jocular Insights to see them.`;
}

// One pass over the accounts; injectable for the tests
export async function notifyScreenArrivals({ pricesDate, push = pushReady() ? pushToUser : null, send = telegramToken() ? sendTelegram : null, log = console.error, matching = matchingSymbols, nameOf } = {}) {
  if (!pricesDate) return { users: 0, sent: 0 };
  const byName = nameOf ?? (() => { const m = new Map(allMetrics().rows.map(r => [r.symbol, niceName(r.name)])); return s => m.get(s) ?? s; })();
  const rows = db.prepare(`
    SELECT s.user_id, u.telegram_chat_id AS chat_id, u.screen_alert_date,
      EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_id = s.user_id) AS has_phone
    FROM saved_strategies s JOIN users u ON u.id = s.user_id`).all();
  let sent = 0, checked = 0;
  for (const u of rows) {
    if (u.screen_alert_date === pricesDate) continue;
    const strategies = listStrategies(u.user_id);
    if (!strategies.some(p => p.notify)) continue;
    checked++;
    const symbolsById = Object.create(null);
    for (const p of strategies) {
      if (!p.custom || !Array.isArray(p.filters)) continue;
      symbolsById[p.id] = matching(p.filters.length ? { filters: p.filters } : p.criteria ?? { filters: [] });
    }
    const states = checkStrategyMatches(u.user_id, strategies, symbolsById);
    const groups = strategies.filter(p => p.notify && states[p.id]?.fresh?.length).map(p => ({ screen: p.name, symbols: states[p.id].fresh }));
    db.prepare("UPDATE users SET screen_alert_date = ? WHERE id = ?").run(pricesDate, u.user_id);
    if (!groups.length) continue;
    let delivered = false;
    if (u.chat_id && send) {
      try { await send(u.chat_id, screenArrivalsTelegram(groups, byName)); delivered = true; }
      catch (e) { log(`[screen-alerts] Telegram for account ${u.user_id}: ${e.message}`); }
    }
    if (push && u.has_phone && await push(u.user_id, screenArrivalsPush(groups, byName), { log })) delivered = true;
    if (delivered) sent++;
  }
  return { users: checked, sent };
}

// IST is UTC+5:30 all year; nobody is woken
const istHour = () => new Date(Date.now() + 330 * 60_000).getUTCHours();

// Every 30 minutes from 8 in the morning to 10 at night (IST): runs once the
// market in hand is the latest snapshot's, once per price date per account
export function startScreenAlerts({ everyMs = 30 * 60_000, log = console.error } = {}) {
  const tick = async () => {
    const h = istHour();
    if (h < 8 || h >= 22) return;
    try {
      await marketReady();
      if (!marketCurrent()) return; // a rebuild for new prices is under way: next time
      const { users, sent } = await notifyScreenArrivals({ pricesDate: loadMarketSnapshot()?.pricesDate, log });
      if (users) log(`[screen-alerts] checked ${users} account${users === 1 ? "" : "s"}, told ${sent}`);
    } catch (e) {
      log(`[screen-alerts] ${e.message}`);
    }
  };
  setTimeout(tick, 3 * 60_000);
  setInterval(tick, everyMs);
}
