import { useState } from "react";
import { cardName } from "./stockName.js";

// Peers on a phone (19 Nov 2026, the owner: on the phone peers should show
// "quarterly results, profit and loss and so on" — the wide table needed a
// sideways swipe and cut its headings). One subject at a time, picked from
// chips: two or three figures per company that fit the screen, a thin bar
// under the first so who is bigger shows at a glance, this company marked.
// The computer keeps the full table (PeersPanel.jsx).

// ₹ crore, the unit in the heading: "13,934", or "9.15L" for lakh crore
const cr = v => {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(2)}L` : Math.round(v).toLocaleString("en-IN");
};
const pct = v => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)}%`);
const chg = v => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1)}%`);
const times = v => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(1));
const toneOf = v => (v == null || !Number.isFinite(v) ? undefined : v >= 0 ? "var(--green)" : "var(--red)");
const qLabel = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }) : null);

// Each subject: its columns — [heading, value of a row, format, colour?];
// the first column is the one the bars measure
const subjectsFor = fin => [
  { id: "quarter", label: "Quarterly results", cols: [
    ["Profit, ₹ cr", r => r.qProfitCr, cr],
    [fin ? "Income, ₹ cr" : "Sales, ₹ cr", r => r.qRevenueCr, cr],
    ["Profit vs a year ago", r => r.qProfitGrowthYoY, chg, true],
  ], note: rows => {
    const ends = [...new Set(rows.map(r => r.latestQuarter).filter(Boolean))];
    return `The latest quarter each company has filed with NSE${ends.length === 1 ? `, to ${qLabel(ends[0])}` : "; quarters can end on different dates"}. "Vs a year ago" is against the same quarter last year.`;
  } },
  { id: "pl", label: "Profit & loss", cols: [
    ["Profit, ₹ cr", r => r.profitCr, cr],
    [fin ? "Income, ₹ cr" : "Sales, ₹ cr", r => r.revenueCr, cr],
    ["Margin", r => (r.lender || r.insurer ? r.netMargin : r.opm), pct],
  ], note: () => "The latest full year. Margin is operating profit as a share of sales (net profit for banks, lenders and insurers)." },
  { id: "growth", label: "Growth", cols: [
    ["Profit, 3 yrs", r => r.profitGrowth3y, chg, true],
    ["Sales, 3 yrs", r => r.salesGrowth3y, chg, true],
    ["Profit, last qtr", r => r.qProfitGrowthYoY, chg, true],
  ], note: () => "Growth a year over the last three full years, and the latest quarter against the same quarter a year earlier." },
  { id: "balance", label: "Balance sheet", cols: fin ? [
    ["Net worth, ₹ cr", r => r.equityCr, cr],
    ["Total assets, ₹ cr", r => r.totalAssetsCr, cr],
    ["Assets ÷ net worth", r => (r.totalAssetsCr > 0 && r.equityCr > 0 ? r.totalAssetsCr / r.equityCr : null), times],
  ] : [
    ["Net worth, ₹ cr", r => r.equityCr, cr],
    ["Debt, ₹ cr", r => (r.lender || r.insurer ? null : r.totalDebtCr), cr],
    ["Debt ÷ equity", r => (r.lender || r.insurer ? null : r.debtToEquity), times],
  ], note: () => (fin
    ? "At the end of the latest full year. A bank lends out far more than its own money: assets ÷ net worth shows how many times over."
    : "At the end of the latest full year. A bank's or insurer's borrowing is its business, so debt isn't shown for them.") },
  { id: "value", label: "Valuation", cols: [
    ["Market value, ₹ cr", r => r.marketCapCr, cr],
    ["P/E", r => r.pe, times],
    ["Price ÷ book", r => r.priceToBook, times],
  ], note: () => "At the last NSE close. \"L\" is lakh crore." },
  { id: "returns", label: "Returns", cols: fin ? [
    ["Return on equity", r => r.roe, pct],
    ["Return on assets", r => r.roa, pct],
    ["Price, 1 year", r => r.ret1y, chg, true],
  ] : [
    ["Return on capital", r => (r.lender || r.insurer ? r.roe : r.roce), pct],
    ["Return on equity", r => r.roe, pct],
    ["Price, 1 year", r => r.ret1y, chg, true],
  ], note: () => (fin ? "The latest full year's profit against the owners' money (equity) and against everything the company holds (assets)." : "Return on capital is shown as return on equity for banks, lenders and insurers.") },
];

export default function PeersPhone({ rows, symbol, onAnalyze }) {
  const [subject, setSubject] = useState("quarter");
  // a group of banks, lenders or insurers gets their own columns
  const fin = rows.filter(r => r.lender || r.insurer).length * 2 > rows.length;
  const SUBJECTS = subjectsFor(fin);
  const s = SUBJECTS.find(x => x.id === subject);
  const [, firstGet] = s.cols[0];
  const max = Math.max(0, ...rows.map(r => Math.abs(firstGet(r) ?? 0)).filter(Number.isFinite));

  return (
    <div className="pp">
      <div className="pp-chips" role="tablist" aria-label="Compare peers by">
        {SUBJECTS.map(x => (
          <button key={x.id} type="button" role="tab" aria-selected={subject === x.id} className="pp-chip" onClick={() => setSubject(x.id)}>{x.label}</button>
        ))}
      </div>
      <div className="pp-head" aria-hidden="true">
        <span>Company</span>
        {s.cols.map(([h]) => <span key={h}>{h}</span>)}
      </div>
      <ul className="pp-list" role="tabpanel" aria-label={s.label}>
        {rows.map(r => {
          const isThis = r.symbol === symbol;
          const first = firstGet(r);
          return (
            <li key={r.symbol} className={`pp-row${isThis ? " pp-this" : ""}`}>
              <span className="pp-name">
                {isThis
                  ? <b>{cardName(r.name)}</b>
                  : <button type="button" onClick={() => onAnalyze?.(r.symbol)}>{cardName(r.name)}</button>}
                {isThis && <small>This stock</small>}
              </span>
              {s.cols.map(([h, get, fmt, toned], i) => {
                const v = get(r);
                return (
                  <span key={h} className="pp-val" style={{ color: toned ? toneOf(v) : undefined }}>
                    {fmt(v)}
                    {i === 0 && max > 0 && Number.isFinite(first) && (
                      <span className="pp-bar" aria-hidden="true"><b className={first < 0 ? "neg" : ""} style={{ width: `${Math.max(2, (Math.abs(first) / max) * 100)}%` }} /></span>
                    )}
                  </span>
                );
              })}
            </li>
          );
        })}
      </ul>
      <p className="pp-note">{s.note(rows)}</p>
    </div>
  );
}
