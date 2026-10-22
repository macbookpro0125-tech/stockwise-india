// "Why is this stock going up or down?" (asked 22 Oct 2026). What can be
// seen around a move, in plain sentences, from what the app already holds:
// the move against the market and the company's sector index, how much it
// traded, its results, its dividends and bonuses, what it told NSE, and the
// news. Never a reason of our own — a price can move with nothing on record
// to show for it, and the card says so then. The company page's "Why is it
// moving?" card (src/WhyMoving.jsx) shows it.

const DAY = 86400000;
const iso = d => new Date(d).toISOString().slice(0, 10);
const daysFrom = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const day = isoDate => new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = v => `${Math.abs(v).toFixed(1)}%`;
const moved = (name, v) => `${name} ${v >= 0.05 ? `rose ${pct(v)}` : v <= -0.05 ? `fell ${pct(v)}` : "was flat"}`;
const quote = (text, max = 180) => { const t = String(text).replace(/\s+/g, " ").trim(); return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t; };

// NSE's "21-Oct-2026 14:20:11" → "2026-10-21"
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function nseDay(s) {
  const m = String(s ?? "").match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  return m && MONTHS[m[2].toLowerCase()] != null ? iso(Date.UTC(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]))) : null;
}

// Notices that are only housekeeping — no news in them: certificates,
// newspaper copies, a results call's recording or slides, an office move
export const ROUTINE = /trading window|loss of share certificate|duplicate share|share certificate|newspaper (publication|advertisement)|compliance certificate|regulation 74|registrar|change in (rta|address)|investor complaints|statement of investor|link of recording|audio recording|transcript|investor presentation|analysts?\/?(institutional )?(investors? )?(meet|call)|earnings call|registered office|allotment of [\d,]+ (equity )?shares|grant of [\d,]+ (stock )?options|\besops?\b|\besos\b|postal ballot/i;
// A summary that is only the rule it's filed under says nothing
export const ONLY_THE_RULE = /^disclosure under regulation 30 and other applicable regulations of the sebi \(listing obligations and disclosure requirements\) regulations,? 2015\.?$/i;
// NSE's summaries open "XYZ Limited has informed the Exchange about …"
export const inOwnWords = text => {
  const t = String(text).replace(/^.*?\bhas (?:informed|intimated|submitted to) the Exchange,?\s*(?:about|regarding|that)?\s*/i, "").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : String(text);
};

// One line on a period's move: its size, and whether the market or its
// sector moved the same way (then it's "in line"), or not (its own move).
// Under 1.5% with nothing alike beside it, it's only a small move.
function moveLine(ret, label, market, sector, key) {
  const ref = sector?.[key] ?? market?.[key];
  const verb = ret > 0 ? "Up" : "Down";
  if (ref == null) return `${verb} ${pct(ret)} ${label}.`;
  const inLine = Math.abs(ref) >= 0.3 && Math.sign(ref) === Math.sign(ret) && Math.abs(ret - ref) <= Math.max(1, 0.35 * Math.abs(ret));
  if (inLine) return sector?.[key] != null
    ? `${verb} ${pct(ret)} ${label}, in line with its sector — ${moved(sector.name, sector[key])}.`
    : `${verb} ${pct(ret)} ${label}, in line with the market — ${moved(market.name, market[key])}.`;
  const others = [market?.[key] != null && moved(market.name, market[key]), sector?.[key] != null && moved(sector.name, sector[key])].filter(Boolean);
  if (Math.abs(ret) < 1.5) return `${verb} ${pct(ret)} ${label} — a small move; ${others.join(" and ")}.`;
  return `${verb} ${pct(ret)} ${label}, while ${others.join(" and ")} — mostly a move of its own.`;
}

// A headline names the company: its name's first word, or first two when
// the first says little on its own ("The India Cements Limited" → "India Cements")
const GENERIC = new Set(["india", "indian", "national", "state", "new", "united", "general", "the", "shree", "shri", "sri"]);
function namesIt(name, title) {
  if (!name) return true;
  const words = String(name).replace(/\b(limited|ltd\.?)\b/gi, "").replace(/^the\s+/i, "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const key = (GENERIC.has(words[0].toLowerCase()) && words[1] ? words.slice(0, 2) : words.slice(0, 1)).join(" ").toLowerCase();
  return String(title).toLowerCase().includes(key);
}

export function describeMove({ asOf, row, market = null, sector = null, filings = [], news = [] }) {
  const moves = [], points = [];
  if (!asOf || !row) return { asOf: asOf ?? null, moves, points, quiet: false };
  const on = `on ${day(asOf)}`;

  if (row.ret1d != null) {
    moves.push(Math.abs(row.ret1d) < 0.5
      ? { period: "day", ret: row.ret1d, text: `Little changed ${on} (${row.ret1d >= 0 ? "+" : "−"}${pct(row.ret1d)}).` }
      : { period: "day", ret: row.ret1d, text: moveLine(row.ret1d, on, market, sector, "d1") });
  }
  if (row.ret1w != null && Math.abs(row.ret1w) >= 3) moves.push({ period: "week", ret: row.ret1w, text: moveLine(row.ret1w, `over the week to ${day(asOf)}`, market, sector, "w1") });

  // Results filed in the last week
  const filed = row.latestQuarterFiled;
  if (filed && daysFrom(filed, asOf) >= 0 && daysFrom(filed, asOf) <= 7) {
    const parts = [
      row.qSalesGrowthYoY != null && `sales ${row.qSalesGrowthYoY >= 0 ? "up" : "down"} ${Math.round(Math.abs(row.qSalesGrowthYoY))}%`,
      row.qProfitGrowthYoY != null && `profit ${row.qProfitGrowthYoY >= 0 ? "up" : "down"} ${Math.round(Math.abs(row.qProfitGrowthYoY))}%`,
    ].filter(Boolean);
    const quarter = row.latestQuarter ? ` for the quarter to ${day(row.latestQuarter)}` : "";
    points.push({ kind: "results", date: filed, text: `Reported its results${quarter} on ${day(filed)}${parts.length ? `: ${parts.join(", ")} from a year earlier` : ""}.` });
  }

  // Dividends, bonuses and splits: just past (they move the price that day) or coming
  for (const e of row.events ?? []) {
    const gap = daysFrom(e.date, asOf); // > 0: past
    if (e.kind === "action" && gap >= 0 && gap <= 7) {
      const amount = String(e.title).match(/(?:Rs|Re)\.?\s*(\d+(?:\.\d+)?)/i)?.[1];
      if (/dividend/i.test(e.title)) points.push({ kind: "action", date: e.date, text: `Went ex-dividend on ${day(e.date)}${amount ? ` (₹${amount} a share)` : ""}: that day the price falls by about the dividend, which goes to the shareholders on record.` });
      else if (/bonus|split|sub-division|consolidation/i.test(e.title)) points.push({ kind: "action", date: e.date, text: `${quote(e.title, 80)} — ex-date ${day(e.date)}. The price adjusts for the change in shares; the figures here are on today's share basis.` });
      else points.push({ kind: "action", date: e.date, text: `${quote(e.title, 100)} — ex-date ${day(e.date)}.` });
    } else if (gap < 0 && gap >= -7) {
      const purpose = String(e.title).split(":").slice(1).join(":").trim();
      if (e.kind === "board" && /result/i.test(e.title)) points.push({ kind: "ahead", date: e.date, text: `Results are due: a board meeting on ${day(e.date)}${purpose ? ` (${purpose})` : ""}.` });
      else if (e.kind === "board") points.push({ kind: "ahead", date: e.date, text: `A board meeting on ${day(e.date)}${purpose ? ` (${purpose})` : ""}.` });
      else points.push({ kind: "ahead", date: e.date, text: `${quote(e.title, 100)} — ex-date ${day(e.date)}.` });
    }
  }

  // What it told NSE in the last week, in its own words
  const resultsSaid = points.some(p => p.kind === "results");
  const told = filings
    .map(f => ({ ...f, day: nseDay(f.date) }))
    .filter(f => f.day && daysFrom(f.day, asOf) >= -1 && daysFrom(f.day, asOf) <= 6 && !ROUTINE.test(`${f.title} ${f.summary ?? ""}`) && !ONLY_THE_RULE.test(String(f.summary ?? "").trim())
      && !(resultsSaid && /financial results/i.test(`${f.title} ${f.summary ?? ""}`)))
    .slice(0, 3);
  // a category only where it's worth reading closely, not "results / governance"
  for (const f of told) points.push({ kind: "filing", date: f.day, label: f.review && f.review.priority !== "Routine disclosure" ? f.review.category : null, url: f.url ?? null, text: `Told NSE on ${day(f.day)}: “${quote(inOwnWords(f.summary || f.title))}”` });

  const ratio = row.volume1d != null && row.avgVolume1m > 0 ? row.volume1d / row.avgVolume1m : null;
  if (ratio >= 2) points.push({ kind: "volume", text: `Traded ${ratio.toFixed(1)} times its usual daily volume (its one-month average) — far more buying and selling than usual.` });
  else if (ratio >= 1.5) points.push({ kind: "volume", text: `Traded ${ratio.toFixed(1)} times its usual daily volume (its one-month average) — more buying and selling than usual.` });

  if (row.downFrom52wHigh != null && row.downFrom52wHigh <= 1) points.push({ kind: "range", text: "At its 52-week high." });
  else if (row.upFrom52wLow != null && row.upFrom52wLow <= 1) points.push({ kind: "range", text: "At its 52-week low." });

  // The news of the last few days: headlines as published, linked — those
  // naming the company (a news search for "Sterlite Technologies share price"
  // also brought another company's quote page)
  const recent = news.filter(n => n.date && daysFrom(iso(n.date), asOf) >= -1 && daysFrom(iso(n.date), asOf) <= 3 && namesIt(row.name, n.title));
  for (const n of recent.slice(0, 3)) {
    points.push({ kind: "news", date: iso(n.date), source: n.publisher ?? null, url: n.url ?? null, text: `“${quote(n.title, 160)}”` });
  }

  // A real move with nothing on record beside it: said so, not explained away
  const moving = moves.some(m => Math.abs(m.ret) >= 0.5);
  const quiet = moving && !points.some(p => ["results", "action", "filing", "news", "volume"].includes(p.kind));
  if (quiet) points.push({ kind: "quiet", text: "Nothing in NSE's records or the news in the last week goes with this move. Prices also move on the market's mood, large trades by funds, and news that isn't in these sources." });
  return { asOf, moves, points, quiet };
}

// For the company page: the record around the latest move. Filings and news
// are fetched (and cached) as their own tabs do; either failing leaves the
// rest, and says which source couldn't be read.
export async function stockMoves(symbol) {
  const { allMetrics } = await import("./screen.js");
  const { loadMarketSnapshot } = await import("./market-data.js");
  const { companyFilings, companyNews } = await import("./company-extras.js");
  const row = allMetrics().rows.find(r => r.symbol === symbol) ?? null;
  const snap = loadMarketSnapshot();
  const idx = snap?.indexReturns ?? {};
  const market = idx["Nifty 50"] ? { name: "NIFTY 50", ...idx["Nifty 50"] } : null;
  const sector = row?.sectorIndex && idx[row.sectorIndex] ? { name: row.sectorIndex, ...idx[row.sectorIndex] } : null;
  const [filings, news] = await Promise.allSettled([companyFilings(symbol), row ? companyNews(row.name) : Promise.resolve({ news: [] })]);
  const unread = [filings.status === "rejected" || filings.value?.error ? "NSE's filings" : null, news.status === "rejected" ? "the news" : null].filter(Boolean);
  return {
    ...describeMove({
      asOf: snap?.pricesDate ?? null, row, market, sector,
      filings: filings.status === "fulfilled" ? filings.value?.announcements ?? [] : [],
      news: news.status === "fulfilled" ? news.value?.news ?? [] : [],
    }),
    unread,
  };
}
