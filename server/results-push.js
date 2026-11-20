// A watchlist company's quarterly results, to the account's phones (20 Nov
// 2026, the owner agreed: "Results today" alerts). Results reach the app with
// the evening data (data-refresh.yml, from 16:45 IST — refresh-trigger.js);
// the next 15-minute tick after that (news-push.js startNewsPush) sends each
// watched company's newly filed quarter once: its profit and sales against a
// year earlier, as NSE's filing gives them. Each send is kept
// (results_push_sent), so a quarter goes once, and only quarters filed in the
// last two days are sent, so nobody gets a pile of old ones.
import { db } from "./db.js";
import { allMetrics } from "./screen.js";
import { pushToUser } from "./push.js";
import { niceName } from "../src/stockName.js";

db.exec(`CREATE TABLE IF NOT EXISTS results_push_sent (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  fy_end TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, symbol, fy_end)
)`);

const DAY = 86_400_000;
// "Q2 FY27" from a quarter's end date
export const quarterName = end => { const [y, m] = String(end).split("-").map(Number); return y && m ? `Q${m >= 4 ? Math.ceil((m - 3) / 3) : 4} FY${String(m >= 4 ? y + 1 : y).slice(2)}` : null; };
const crore = v => `₹${Math.abs(v) >= 100 ? Math.round(Math.abs(v)).toLocaleString("en-IN") : Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 1 })} crore`;
const pct = v => `${Math.abs(v) >= 100 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(1)}%`;
const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// "Profit ₹13,934 crore, up 14.9% from a year ago." — a loss said as one;
// no change when there's no year-ago profit to compare with
export function profitLine(q) {
  if (q.profitCr == null) return null;
  if (q.profitCr < 0) return `Loss of ${crore(q.profitCr)}.`;
  const move = q.profitYoY == null ? "" : `, ${q.profitYoY >= 0 ? "up" : "down"} ${pct(q.profitYoY)} from a year ago`;
  return `Profit ${crore(q.profitCr)}${move}.`;
}
export function salesLine(q) {
  if (q.revenueCr == null) return null;
  const move = q.salesYoY == null ? "" : `, ${q.salesYoY >= 0 ? "up" : "down"} ${pct(q.salesYoY)}`;
  return `Sales ${crore(q.revenueCr)}${move}.`;
}
// in a list: "TCS profit +14.9%"
const brief = r => {
  const q = r.quarters[0], name = niceName(r.name) || r.symbol;
  if (q.profitCr != null && q.profitCr < 0) return `${name} a loss`;
  return q.profitYoY == null ? `${name} profit ${crore(q.profitCr ?? 0)}` : `${name} profit ${q.profitYoY >= 0 ? "+" : "−"}${pct(q.profitYoY)}`;
};

// The message for the watched companies' new results (rows from allMetrics,
// each with quarters[0]); null for none
export function resultsPush(rows) {
  if (!rows.length) return null;
  if (rows.length === 1) {
    const [r] = rows, q = r.quarters[0], qn = quarterName(q.fyEnd);
    return {
      title: `${niceName(r.name) || r.symbol}: ${qn} results`,
      body: short([profitLine(q), salesLine(q)].filter(Boolean).join(" ") || `Its ${qn} results are in.`, 180),
      data: { path: `/stock/${encodeURIComponent(r.symbol)}/results/${qn.toLowerCase().replace(" ", "-")}` },
    };
  }
  const big = [...rows].sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0));
  return {
    title: `${rows.length} of your watchlist posted results`,
    body: short(`${big.slice(0, 3).map(brief).join(", ")}${rows.length > 3 ? ` and ${rows.length - 3} more` : ""}.`, 180),
    data: { tab: "watchlist" },
  };
}

// push: (userId, message) => Promise<boolean>, injectable for the tests
export async function pushWatchlistResults({ push = pushToUser, log = console.error, now = new Date(), rows = null } = {}) {
  const all = rows ?? allMetrics().rows;
  const from = new Date(now.getTime() + 330 * 60_000 - 2 * DAY).toISOString().slice(0, 10);
  const fresh = new Map(all.filter(r => { const q = r.quarters?.[0]; return q?.filed && q.filed >= from && (q.profitCr != null || q.revenueCr != null); }).map(r => [r.symbol, r]));
  if (!fresh.size) return { sent: 0 };
  const users = db.prepare("SELECT DISTINCT u.id FROM users u JOIN push_tokens t ON t.user_id = u.id").all();
  const wasSent = db.prepare("SELECT 1 FROM results_push_sent WHERE user_id = ? AND symbol = ? AND fy_end = ?");
  const mark = db.prepare("INSERT OR IGNORE INTO results_push_sent (user_id, symbol, fy_end, sent_at) VALUES (?, ?, ?, ?)");
  let sent = 0;
  for (const u of users) {
    const watched = db.prepare("SELECT ticker FROM watchlist WHERE user_id = ?").all(u.id).map(r => r.ticker);
    const due = watched.map(s => fresh.get(s)).filter(r => r && !wasSent.get(u.id, r.symbol, r.quarters[0].fyEnd));
    const message = resultsPush(due);
    if (!message) continue;
    if (await push(u.id, message, { log })) sent++;
    // marked either way: a phone that can't be reached isn't sent the same quarter every 15 minutes
    for (const r of due) mark.run(u.id, r.symbol, r.quarters[0].fyEnd, now.toISOString());
  }
  return { sent };
}
