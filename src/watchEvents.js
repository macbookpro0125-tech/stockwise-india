// What's coming up for a watched company, in one line on the Watchlist: the
// soonest ex-date or board meeting in the next two weeks, from the events
// the evening refresh reads from NSE (market-data.js eventsBySymbol). Board
// meetings about results are left to the results line beside it. Users of
// other screeners ask to hear about their stocks' filings and dividends
// (replica/fixes.md #4); this shows them where people already look.

const WINDOW_DAYS = 14;
const DAY = 86400000;

const plusDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const shortDay = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const when = (iso, today) => (iso === today ? "today" : shortDay(iso));
const rupees = n => `₹${Number(n.toFixed(2))}`;

// "Dividend - Rs 5 Per Share/Special Dividend - Re 0.50 Per Share" → 5.5
// (the same reading as market-data.js dividendAmount, kept here so the page
// needn't load server code)
const dividendAmount = title => [...title.matchAll(/(?:Rs|Re)\.?\s*(\d+(?:\.\d+)?)/gi)].reduce((sum, m) => sum + Number(m[1]), 0);

function describe(e, today) {
  const t = e.title ?? "";
  const d = when(e.date, today);
  if (e.kind === "board") return { kind: "board", text: `Board meeting ${d}: ${t.replace(/^Board meeting:?\s*/i, "")}`.replace(/:\s*$/, "") };
  if (/dividend/i.test(t)) {
    const amount = dividendAmount(t);
    return { kind: "dividend", text: `Ex-dividend ${d}${amount > 0 ? ` · ${rupees(amount)} a share` : ""}` };
  }
  const bonus = t.match(/^bonus\s+(\d+:\d+)/i);
  if (bonus) return { kind: "bonus", text: `Ex-bonus ${bonus[1]} · ${d}` };
  if (/split/i.test(t)) return { kind: "split", text: `Ex-split · ${d}` };
  const rights = t.match(/^rights\s+(\d+:\d+)/i);
  if (rights) return { kind: "rights", text: `Rights issue ${rights[1]} · ex-date ${d}` };
  if (/^buy\s*back/i.test(t)) return { kind: "buyback", text: `Buyback · ex-date ${d}` };
  return { kind: "action", text: `${t} · ex-date ${d}` };
}

// row: a watchlist row with events [{ date, kind: "board"|"action", title }];
// today: YYYY-MM-DD (IST). Null when nothing is coming up.
export function nextEvent(row, today, days = WINDOW_DAYS) {
  const last = plusDays(today, days);
  const next = (row?.events ?? [])
    .filter(e => e?.date && e.date >= today && e.date <= last)
    .filter(e => !(e.kind === "board" && /financial results/i.test(e.title ?? "")))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return next ? { date: next.date, ...describe(next, today) } : null;
}

// Today in India, for the comparison above
export const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
