import { useState, useEffect } from "react";
import { api } from "./api.js";
import { QualityBadge } from "./ResearchBadges.jsx";

// The original's Peers panel (stock-screener PeersPanel.jsx), from this app's
// own data: companies in the same NSE sector, largest first. The original used
// Screener's narrower industry pages; NSE only publishes sectors.

const MONO = { fontVariantNumeric: "tabular-nums" };

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
  ["EV / EBITDA", r => num(r.evToEbitda)],
  ["FCF yield", r => pct(r.fcfYieldPct)],
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
        {data?.peerLabel && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 8 }}>{data.peerLabel}</span>}
      </div>
      <p style={{ fontSize: 11, color: "var(--t3)", margin: "4px 0 12px", lineHeight: 1.5 }}>
        Companies in the same NSE {data?.peerBasis ?? "sector or industry"}, largest first{data?.total > rows.length ? ` (top ${rows.length} of ${data.total})` : ""}. Peer medians exclude this company.
      </p>

      {error && <div style={{ fontSize: 12, color: "var(--t3)", padding: "16px 0" }}>Could not load peers — {error}</div>}
      {data && !data.peerBasis && (
        <div style={{ fontSize: 12, color: "var(--t3)", padding: "8px 0" }}>NSE doesn't publish a sector or industry for this company, so there are no comparable peers here.</div>
      )}

      {data?.benchmark && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 12px" }}>
        {[
          ["Peer median P/E", data.benchmark.pe != null ? `${num(data.benchmark.pe)}× · ${data.benchmark.peN} peers` : `Not enough positive P/E peers (${data.benchmark.peN}/5)`],
          ["Peer median EV/EBITDA", data.benchmark.evToEbitda != null ? `${num(data.benchmark.evToEbitda)}× · ${data.benchmark.evToEbitdaN} peers` : `Not enough peers (${data.benchmark.evToEbitdaN}/5)`],
          ["Peer median FCF yield", data.benchmark.fcfYieldPct != null ? `${pct(data.benchmark.fcfYieldPct)} · ${data.benchmark.fcfYieldN} peers` : `Not enough peers (${data.benchmark.fcfYieldN}/5)`],
        ].map(([label, value]) => <div key={label} style={{ minWidth: 150, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bdr)", background: "var(--s1)" }}><div style={{ fontSize: 10.5, color: "var(--t3)" }}>{label}</div><div style={{ fontSize: 12, color: "var(--t1)", fontWeight: 650, marginTop: 3 }}>{value}</div></div>)}
      </div>}

      {rows.length > 0 && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 920 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11.5, color: "var(--t3)", borderBottom: "1px solid var(--bdr2)", position: "sticky", left: 0, background: "var(--s2)" }}>Company</th>
                  {COLUMNS.map(([c]) => (
                    <th key={c} style={{ textAlign: "right", padding: "8px 10px", fontSize: 11.5, color: "var(--t3)", whiteSpace: "nowrap", borderBottom: "1px solid var(--bdr2)" }}>{c}</th>
                  ))}
                  <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 11.5, color: "var(--t3)", borderBottom: "1px solid var(--bdr2)" }}>Quality</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const isThis = r.symbol === symbol;
                  return (
                    <tr key={r.symbol} style={{ background: isThis ? "color-mix(in srgb, var(--accent) 6%, transparent)" : undefined }}>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap", position: "sticky", left: 0, background: isThis ? "var(--s3)" : "var(--s2)", borderBottom: "1px solid var(--bdr)" }}>
                        <span onClick={() => !isThis && onAnalyze?.(r.symbol)} style={{ color: isThis ? "var(--accent)" : "var(--t2)", fontWeight: isThis ? 700 : 500, cursor: isThis ? "default" : "pointer" }}>
                          {r.name}
                        </span>
                        {isThis && <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: 6 }}>THIS STOCK</span>}
                      </td>
                      {COLUMNS.map(([c, fmt]) => (
                        <td key={c} style={{ padding: "7px 10px", textAlign: "right", whiteSpace: "nowrap", color: "var(--t1)", borderBottom: "1px solid var(--bdr)", ...MONO }}>{fmt(r)}</td>
                      ))}
                      <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: "1px solid var(--bdr)" }}><QualityBadge research={r.research} /></td>
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
