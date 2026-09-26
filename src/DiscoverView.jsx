import { useState, useEffect, useCallback } from "react";
import { api } from "./api.js";

// Same traffic-light pattern as stock-screener's ResultsTable — green/yellow/red
// bands with the color vars it already uses, not a fresh palette.
function bandStyle(value, { good, ok, reverse = false }) {
  const pass = reverse ? value <= good : value >= good;
  const okPass = reverse ? value <= ok : value >= ok;
  if (pass) return { color: "var(--green)", bg: "var(--green-dim)", border: "var(--green-bdr)" };
  if (okPass) return { color: "var(--yellow)", bg: "var(--yellow-dim)", border: "var(--yellow-bdr)" };
  return { color: "var(--red)", bg: "var(--red-dim)", border: "var(--red-bdr)" };
}

function Metric({ value, fmt, ...bandArgs }) {
  const s = bandStyle(value, bandArgs);
  return (
    <span className="mono" style={{ color: s.color, fontWeight: 600, fontSize: 13 }}>
      {fmt(value)}
    </span>
  );
}

function fmtPct(n) { return `${(n * 100).toFixed(1)}%`; }
function fmtCr(n) { return `₹${Math.round(n).toLocaleString("en-IN")}`; }

const CRITERIA_FIELDS = [
  { key: "minRoe", label: "Min ROE", suffix: "%", default: 15 },
  { key: "maxDebtToEquity", label: "Max Debt/Equity", suffix: "×", default: 0.5 },
  { key: "minPromoterPct", label: "Min Promoter %", suffix: "%", default: 0 },
];

export default function DiscoverView() {
  const [criteria, setCriteria] = useState(Object.fromEntries(CRITERIA_FIELDS.map(f => [f.key, f.default])));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = useCallback(() => {
    setLoading(true);
    setError("");
    api.screen(criteria).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [criteria]);

  useEffect(run, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginBottom: 8 }}>
        {CRITERIA_FIELDS.map(f => (
          <div key={f.key}>
            <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{f.label}</div>
            <input
              type="number" step="any" value={criteria[f.key]} style={{ width: 110 }}
              onChange={e => setCriteria(c => ({ ...c, [f.key]: Number(e.target.value) }))}
            />
          </div>
        ))}
        <button className="btn-primary" onClick={run} disabled={loading}>{loading ? "Screening…" : "Run screen"}</button>
      </div>

      {data && (
        <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 16 }}>
          {data.matched} of {data.total} companies with usable data match
          {data.total < 2585 && <> — market fetch still filling in ({data.total}/2585 companies fetched so far)</>}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 13, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: "var(--r-sm)", padding: "10px 14px" }}>
          {error}
        </div>
      )}

      {data && data.results.length === 0 && !error && (
        <div style={{ color: "var(--t3)", fontSize: 13, padding: "24px 0" }}>
          No companies match these thresholds yet — try loosening them, or wait for more of the market fetch to complete.
        </div>
      )}

      {data && data.results.length > 0 && (
        <table>
          <thead>
            <tr>
              {["Company", "ROE", "Debt/Equity", "Promoter %", "Revenue (qtr)"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--bdr2)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.results.map(r => (
              <tr key={r.symbol} style={{ borderBottom: "1px solid var(--bdr)" }}>
                <td style={{ padding: "10px" }}>
                  <div style={{ fontWeight: 600 }}>{r.symbol}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>{r.name}</div>
                </td>
                <td style={{ padding: "10px" }}><Metric value={r.roe} fmt={fmtPct} good={0.20} ok={0.15} /></td>
                <td style={{ padding: "10px" }}><Metric value={r.debtToEquity} fmt={n => n.toFixed(2) + "×"} good={0.3} ok={0.5} reverse /></td>
                <td style={{ padding: "10px" }}><Metric value={r.holding.promoterPct / 100} fmt={fmtPct} good={0.5} ok={0.3} /></td>
                <td className="mono" style={{ padding: "10px", color: "var(--t2)" }}>{fmtCr(r.pnl.revenueQuarter / 10000000)} Cr</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
