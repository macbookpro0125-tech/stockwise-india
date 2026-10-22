import { useState, useEffect } from "react";
import { api } from "./api.js";
import { QualityBadge } from "./ResearchBadges.jsx";
import { usePhone } from "./phoneTabs.js";
import { cardName } from "./stockName.js";

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
  ["Quality", r => <QualityBadge research={r.research} />],
];
// A phone shows a few columns at a time, so the ones that compare companies
// come first and the price, which doesn't, last
const PHONE_ORDER = ["Mkt Cap", "P/E", "ROCE", "Sales Gr 3Y", "Quality", "Div Yld", "Net Profit", "Sales", "EV / EBITDA", "FCF yield", "CMP"];
const PHONE_COLUMNS = PHONE_ORDER.map(name => COLUMNS.find(([c]) => c === name));

export default function PeersPanel({ symbol, onAnalyze }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const phone = usePhone();

  useEffect(() => {
    let cancelled = false;
    api.panel(symbol, "peers").then(d => { if (!cancelled) setData(d); }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [symbol]);

  if (!data && !error) return null;
  const rows = data?.rows ?? [];
  // the top 10, and this company wherever it ranks
  const top = rows.slice(0, 10);
  const me = rows.find(r => r.symbol === symbol);
  const shown = showAll ? rows : me && !top.includes(me) ? [...top, me] : top;
  const columns = phone ? PHONE_COLUMNS : COLUMNS;
  const top30 = data?.topCount ?? rows.length;

  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--s2)", padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)", letterSpacing: "-0.01em" }}>
        Peers
        {data?.peerLabel && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 8 }}>{data.peerLabel}</span>}
      </div>
      <p style={{ fontSize: 11, color: "var(--t3)", margin: "4px 0 12px", lineHeight: 1.5 }}>
        {data?.peerBasis === "name"
          ? <>Companies in the {data.peerLabel} sector, largest first{data.total > top30 ? ` (top ${top30} of ${data.total})` : ""}. NSE doesn't classify this company, so its sector here comes from its name — right for about 19 companies in 20. Peer medians exclude this company.</>
          : <>Companies in the same NSE {data?.peerBasis ?? "sector or industry"}, largest first{data?.total > top30 ? ` (top ${top30} of ${data.total})` : ""}. Peer medians exclude this company. NSE sectors can combine different industries, so this is a broad comparison group rather than a set of exact product competitors.</>}
      </p>

      {error && <div style={{ fontSize: 12, color: "var(--t3)", padding: "16px 0" }}>Could not load peers — {error}</div>}
      {data && !data.peerBasis && (
        <div style={{ fontSize: 12, color: "var(--t3)", padding: "8px 0" }}>NSE hasn't put this company in a sector or industry, and its name doesn't say which it's in, so there's no fair group to compare it with. Most companies outside NSE's top 750 aren't classified by NSE.</div>
      )}

      {data?.benchmark && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 12px" }}>
        {[
          ["Peer median EV/EBITDA", data.benchmark.evToEbitda != null ? `${num(data.benchmark.evToEbitda)}× · ${data.benchmark.evToEbitdaN} peers` : `Not enough peers (${data.benchmark.evToEbitdaN}/5)`],
          ["Peer median FCF yield", data.benchmark.fcfYieldPct != null ? `${pct(data.benchmark.fcfYieldPct)} · ${data.benchmark.fcfYieldN} peers` : `Not enough peers (${data.benchmark.fcfYieldN}/5)`],
        ].map(([label, value]) => <div key={label} style={{ minWidth: 150, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bdr)", background: "var(--s1)" }}><div style={{ fontSize: 10.5, color: "var(--t3)" }}>{label}</div><div style={{ fontSize: 12, color: "var(--t1)", fontWeight: 450, marginTop: 3 }}>{value}</div></div>)}
      </div>}


      {rows.length > 0 && (
        <>
          {phone && <p className="peers-swipe">Swipe the table sideways for more →</p>}
          <div className="peers-scroll">
            <table className="peers-table">
              <thead>
                <tr>
                  <th className="peers-name">Company</th>
                  {columns.map(([c]) => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const isThis = r.symbol === symbol;
                  const name = phone ? cardName(r.name) : r.name;
                  return (
                    <tr key={r.symbol} className={isThis ? "peers-this" : undefined}>
                      <td className="peers-name" title={r.name}>
                        {isThis
                          ? <span className="peers-co" style={{ color: "var(--accent)", fontWeight: 500 }}>{name}</span>
                          : <button type="button" className="stock-link peers-co" onClick={() => onAnalyze?.(r.symbol)}>{name}</button>}
                        {isThis && <span className="peers-this-tag">THIS STOCK</span>}
                      </td>
                      {columns.map(([c, fmt]) => <td key={c} style={MONO}>{fmt(r)}</td>)}
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
