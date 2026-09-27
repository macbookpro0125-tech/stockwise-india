import { useState, useEffect } from "react";
import { api } from "./api.js";
import { ScoreBadge } from "./ResultsTable.jsx";

// The original's Peers panel (stock-screener PeersPanel.jsx), from this app's
// own data: companies in the same NSE sector, largest first. The original used
// Screener's narrower industry pages; NSE only publishes sectors.

const MONO = { fontFamily: '"SF Mono","SFMono-Regular",Menlo,monospace', fontVariantNumeric: "tabular-nums" };

function fmtCr(v) {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 100000) return `${(v / 100000).toFixed(2)}L`;
  if (a >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(Math.round(v));
}
const num = (v, dp = 1) => (v == null ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: dp }));
const pct = v => (v == null ? "—" : `${v.toFixed(1)}%`);

const COLUMNS = [
  ["CMP", r => (r.cmp == null ? "—" : `₹${num(r.cmp, r.cmp < 100 ? 2 : 0)}`)],
  ["P/E", r => num(r.pe)],
  ["Mkt Cap", r => fmtCr(r.marketCapCr)],
  ["Div Yld", r => pct(r.divYield)],
  ["Net Profit", r => fmtCr(r.profitCr)],
  ["Sales", r => fmtCr(r.revenueCr)],
  ["Sales Gr 3Y", r => pct(r.salesGrowth3y)],
  ["ROCE", r => pct(r.roce)],
];

export default function PeersPanel({ symbol, onAnalyze }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.panel(symbol, "peers").then(d => { if (!cancelled) setData(d); }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [symbol]);

  if (!data && !error) return null;
  const rows = data?.rows ?? [];
  const shown = showAll ? rows : rows.slice(0, 10);

  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--s2)", padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
        Peers
        {data?.sector && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 8 }}>{data.sector}</span>}
      </div>
      <p style={{ fontSize: 11, color: "var(--t3)", margin: "4px 0 12px", lineHeight: 1.5 }}>
        Companies in this stock's NSE sector, largest first{data?.total > rows.length ? ` (top ${rows.length} of ${data.total})` : ""}.
      </p>

      {error && <div style={{ fontSize: 12, color: "var(--t3)", padding: "16px 0" }}>Could not load peers — {error}</div>}
      {data && !data.sector && (
        <div style={{ fontSize: 12, color: "var(--t3)", padding: "8px 0" }}>NSE doesn't publish a sector for this company, so there are no peers to compare with.</div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--bdr2)", position: "sticky", left: 0, background: "var(--s2)" }}>Company</th>
                  {COLUMNS.map(([c]) => (
                    <th key={c} style={{ textAlign: "right", padding: "8px 10px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", borderBottom: "1px solid var(--bdr2)" }}>{c}</th>
                  ))}
                  <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--bdr2)" }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const isThis = r.symbol === symbol;
                  return (
                    <tr key={r.symbol} style={{ background: isThis ? "rgba(0,224,190,0.06)" : undefined }}>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap", position: "sticky", left: 0, background: isThis ? "var(--s3)" : "var(--s2)", borderBottom: "1px solid var(--bdr)" }}>
                        <span onClick={() => !isThis && onAnalyze?.(r.symbol)} style={{ color: isThis ? "var(--accent)" : "var(--t2)", fontWeight: isThis ? 700 : 500, cursor: isThis ? "default" : "pointer" }}>
                          {r.name}
                        </span>
                        {isThis && <span style={{ fontSize: 9, color: "var(--accent)", marginLeft: 6 }}>THIS STOCK</span>}
                      </td>
                      {COLUMNS.map(([c, fmt]) => (
                        <td key={c} style={{ padding: "7px 10px", textAlign: "right", whiteSpace: "nowrap", color: "var(--t1)", borderBottom: "1px solid var(--bdr)", ...MONO }}>{fmt(r)}</td>
                      ))}
                      <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: "1px solid var(--bdr)" }}><ScoreBadge score={r.score.green} max={r.score.applicable} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > 10 && (
            <button onClick={() => setShowAll(s => !s)} className="btn-ghost" style={{ height: 30, padding: "0 14px", fontSize: 11, borderRadius: 8, marginTop: 10 }}>
              {showAll ? "Show top 10" : `Show all ${rows.length}`}
            </button>
          )}
          <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 8 }}>Profit and sales for the latest full year. Amounts in ₹ Crore.</p>
        </>
      )}
    </div>
  );
}
