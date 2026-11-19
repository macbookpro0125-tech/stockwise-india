// The orders one company told NSE it won over the last year, for its page's
// "Orders won" (19 Nov 2026, the owner: if a company gets a contract "it
// should be shown"). Each order's size is read from the company's own notice
// (market-news.js readOrderNotice, order-amount.js); a notice that doesn't
// state one says so. Kept twelve hours, each notice read once.
import { NSE_BASE, fetchJson } from "./fetch-nse.js";
import { cached } from "./company-extras.js";
import { ORDER_SUBJECT, readOrderNotice } from "./market-news.js";
import { allMetrics } from "./screen.js";

const DAY = 86_400_000;
const MAX = 12;
const read = new Map(); // NSE seq_id → { amount, l1 } | { failed }
const ddmmyyyy = t => { const d = new Date(t + 5.5 * 3600_000); return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`; };
const NSE_FILE = /^https:\/\/nsearchives\.nseindia\.(com|in)\//;
// "19-Nov-2026 22:30:12" -> ISO
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
export function nseDate(s) {
  // "2026-11-19 17:39:35" (sort_date), IST
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(s ?? ""));
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0)) - 5.5 * 3600_000).toISOString();
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(s ?? ""));
  if (!m || MON[m[2]] == null) return null;
  return new Date(Date.UTC(+m[3], MON[m[2]], +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)) - 5.5 * 3600_000).toISOString();
}

// NSE's rows -> the order notices, newest first, a re-filed notice once
export function orderRows(rows) {
  const seen = new Set();
  return (rows ?? [])
    .filter(r => ORDER_SUBJECT.test(r.desc ?? "") && r.seq_id)
    .map(r => ({ id: String(r.seq_id), time: nseDate(r.sort_date ?? r.an_dt), title: r.desc, summary: r.attchmntText && r.attchmntText !== r.desc && !/has informed the exchange/i.test(r.attchmntText) ? String(r.attchmntText) : null, url: NSE_FILE.test(r.attchmntFile ?? "") ? r.attchmntFile : null }))
    .filter(o => o.time)
    .sort((a, b) => b.time.localeCompare(a.time))
    .filter(o => { const k = `${o.time.slice(0, 10)}|${o.summary ?? o.url}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function companyOrders(symbol, now = Date.now()) {
  return cached(`orders:${symbol}`, 12 * 3600_000, async () => {
    const rows = await fetchJson(`${NSE_BASE}/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(symbol)}&from_date=${ddmmyyyy(now - 365 * DAY)}&to_date=${ddmmyyyy(now)}`);
    if (!Array.isArray(rows)) throw new Error("NSE's announcements couldn't be read");
    const list = orderRows(rows);
    for (const o of list.slice(0, MAX)) {
      if (read.has(o.id)) continue;
      read.set(o.id, await readOrderNotice(o));
      await new Promise(r => setTimeout(r, 250));
    }
    const mcap = allMetrics().rows.find(r => r.symbol === symbol)?.marketCapCr ?? null;
    const orders = list.slice(0, MAX).map(o => {
      const r = read.get(o.id) ?? {};
      const cr = r.amount?.cr ?? null;
      return {
        id: o.id, time: o.time, url: o.url, summary: o.summary,
        status: r.failed ? "unread" : r.amount ? "stated" : "none",
        amountCr: cr, foreign: r.amount?.currency ? { currency: r.amount.currency, mn: r.amount.mn } : null,
        lowestBidder: !!r.l1,
        from: r.from ?? null, what: r.what ?? null,
        wholeContract: r.amount?.wholeContract === true ? true : r.amount?.wholeContract?.cr ?? null,
        pctOfValue: cr != null && mcap > 0 ? Math.round((cr / mcap) * 1000) / 10 : null,
      };
    });
    return { orders, total: list.length, marketCapCr: mcap };
  });
}
