// Holdings imported from a broker's export (Zerodha Console or Kite, Groww,
// Upstox, Angel One… as CSV or Excel). The browser reads the file and sends
// only each row's symbol, ISIN or name, quantity and average price; this
// matches them to NSE's list of listed companies. Linking a broker account
// was other apps' users' most common complaint (~40 of 240 low ratings, Oct
// 2026: links that fail, brokers missing, one demat at a time) — a file
// works with any broker and can't break.

export const MAX_IMPORT_ROWS = 500;

// "Tata Consultancy Services Ltd." -> "tata consultancy services"
const nameKey = s => String(s ?? "").toLowerCase()
  .replace(/&/g, " and ")
  .replace(/\b(limited|ltd|ltd\.|pvt|private|the|inc|corporation|corp|co|company)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ").trim();

// "1,234.50", "₹ 1234.5", " 10 " -> number
export function numberOf(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v ?? "").replace(/[₹,\s]/g, "").replace(/^Rs\.?/i, ""));
  return Number.isFinite(n) ? n : null;
}

// Kite writes "INFY", exports elsewhere "INFY-EQ", "INFY.NS", "NSE:INFY"
const symbolOf = s => String(s ?? "").trim().toUpperCase()
  .replace(/^(NSE|BSE)[:\s]+/, "").replace(/\.(NS|BO)$/, "").replace(/-(EQ|BE|BZ|SM|ST)$/, "").trim();

// rows: [{ symbol, isin, name, qty, avgPrice }]; list: NSE's equity list
// ({ symbol, name, isin }); held: symbols already in the portfolio.
// Each row comes back with what it matched and whether it can be added.
export function resolveImportRows(rows, list, held = new Set()) {
  const bySymbol = new Map(list.map(s => [s.symbol, s]));
  const byIsin = new Map(list.filter(s => s.isin).map(s => [s.isin.toUpperCase(), s]));
  const byName = new Map();
  for (const s of list) {
    const k = nameKey(s.name);
    if (k) byName.set(k, byName.has(k) ? null : s); // two companies, one name: no match
  }
  const seen = new Set();
  return rows.slice(0, MAX_IMPORT_ROWS).map((r, i) => {
    const qty = numberOf(r.qty), avgPrice = numberOf(r.avgPrice);
    const isin = String(r.isin ?? "").trim().toUpperCase();
    const match = bySymbol.get(symbolOf(r.symbol)) ?? (isin ? byIsin.get(isin) : null) ?? byName.get(nameKey(r.name)) ?? null;
    const base = { row: i + 1, from: [r.symbol, isin, r.name].filter(Boolean).join(" · ").slice(0, 120), qty, avgPrice };
    if (!match) return { ...base, status: "unknown", reason: "Not a company share on NSE's list — an ETF, fund, bond or BSE-only share?" };
    if (!(qty > 0)) return { ...base, symbol: match.symbol, name: match.name, status: "invalid", reason: "No quantity" };
    if (!(avgPrice > 0)) return { ...base, symbol: match.symbol, name: match.name, status: "invalid", reason: "No average price" };
    if (seen.has(match.symbol)) return { ...base, symbol: match.symbol, name: match.name, status: "duplicate", reason: "Already earlier in this file" };
    seen.add(match.symbol);
    if (held.has(match.symbol)) return { ...base, symbol: match.symbol, name: match.name, status: "held", reason: "Already in your portfolio" };
    return { ...base, symbol: match.symbol, name: match.name, status: "ok" };
  });
}
