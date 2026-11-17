import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "./api.js";

// The company's financials beside other companies', one statement at a time
// (16 Nov 2026, the owner: "I should be able to compare with other companies
// also, each of them"). The latest full year from each company's own filings
// (the latest quarter for Quarterly); a few lines per statement, the ones that
// read across companies. Figures only; no verdict on which is better.

const crore = v => (v == null ? "—" : `₹${Math.round(v).toLocaleString("en-IN")} Cr`);
const pct = v => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)}%`);
const times = v => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(2)}×`);
const num = v => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(1));
const rs = v => (v == null || !Number.isFinite(v) ? "—" : `₹${v.toFixed(2)}`);
const growth = (now, then) => (now != null && then > 0 ? ((now / then) - 1) * 100 : null);

export const COMPARE_STATEMENTS = [
  { id: "profitLoss", label: "Profit & loss", rows: [
    ["Revenue", m => m?.history?.[0]?.revenueCr, crore],
    ["Operating profit", m => m?.history?.[0]?.operatingProfitCr, crore],
    ["Operating margin", m => m?.history?.[0]?.opm, pct],
    ["Net profit", m => m?.history?.[0]?.profitCr, crore],
    ["EPS", m => m?.history?.[0]?.eps, rs],
    ["Revenue growth, 5 yrs a year", m => m?.salesGrowth5y, pct],
    ["Profit growth, 5 yrs a year", m => m?.profitGrowth5y, pct],
  ] },
  { id: "quarterly", label: "Quarterly", rows: [
    ["Revenue, latest quarter", m => m?.quarters?.[0]?.revenueCr, crore],
    ["Net profit, latest quarter", m => m?.quarters?.[0]?.profitCr, crore],
    ["Revenue vs a year earlier", m => growth(m?.quarters?.[0]?.revenueCr, m?.quarters?.[4]?.revenueCr), pct],
    ["Profit vs a year earlier", m => growth(m?.quarters?.[0]?.profitCr, m?.quarters?.[4]?.profitCr), pct],
  ] },
  { id: "balanceSheet", label: "Balance sheet", rows: [
    ["Total assets", m => m?.history?.[0]?.totalAssetsCr, crore],
    ["Net worth", m => m?.history?.[0]?.equityCr, crore],
    ["Borrowings", m => m?.history?.[0]?.debtCr, crore],
    ["Cash and investments", m => m?.history?.[0]?.liquidCr, crore],
    ["Debt to equity", m => m?.history?.[0]?.debtToEquity, times],
  ] },
  { id: "cashFlow", label: "Cash flow", rows: [
    ["Cash from operations", m => m?.history?.[0]?.ocfCr, crore],
    ["Capital spending", m => m?.history?.[0]?.capexCr, crore],
    ["Free cash flow", m => m?.history?.[0]?.fcfCr, crore],
    ["Cash from operations ÷ profit", m => (m?.history?.[0]?.ocfCr != null && m.history[0].profitCr > 0 ? (m.history[0].ocfCr / m.history[0].profitCr) * 100 : null), pct],
  ] },
  { id: "ratios", label: "Ratios", rows: [
    ["Return on equity", m => m?.roe ?? m?.history?.[0]?.roe, pct],
    ["Return on capital", m => m?.roce ?? m?.history?.[0]?.roce, pct],
    ["P/E", m => m?.pe, num],
    ["Price to book", m => m?.pb, num],
    ["Dividend yield", m => m?.divYield, pct],
  ] },
];

const short = n => String(n ?? "").replace(/\s+(Limited|Ltd\.?)$/i, "");

export default function FinanceCompare({ symbol, m }) {
  const [statement, setStatement] = useState("profitLoss");
  const [others, setOthers] = useState([]); // [{ symbol, name, m, error }]
  const [typed, setTyped] = useState("");
  // suggestions: the biggest companies in its sector by sales (sector-share.js)
  const suggested = (m?.sectorShare?.top ?? []).filter(r => r.symbol !== symbol && !others.some(o => o.symbol === r.symbol)).slice(0, 4);
  useEffect(() => { setOthers([]); }, [symbol]);

  const add = async sym => {
    const s = String(sym || "").trim().toUpperCase();
    if (!s || s === symbol || others.some(o => o.symbol === s) || others.length >= 3) return;
    setOthers(o => [...o, { symbol: s, name: s, m: null }]);
    try {
      const d = await api.stock(s);
      setOthers(o => o.map(x => (x.symbol === s ? { symbol: s, name: d?.name ?? s, m: d?.metrics ?? null, error: d?.metrics ? null : "No filed figures" } : x)));
    } catch (e) {
      setOthers(o => o.map(x => (x.symbol === s ? { ...x, error: "Not found" } : x)));
    }
  };

  const st = COMPARE_STATEMENTS.find(x => x.id === statement);
  const cols = [{ symbol, name: m?.name ?? symbol, m }, ...others];
  return (
    <div className="fc">
      <div className="fc-kinds" role="group" aria-label="Which statement">
        {COMPARE_STATEMENTS.filter(x => x.id !== "quarterly" || m?.quarters?.length).map(x => (
          <button key={x.id} type="button" aria-pressed={statement === x.id} onClick={() => setStatement(x.id)}>{x.label}</button>
        ))}
      </div>
      <div className="fc-pick">
        {others.length < 3 && suggested.map(r => (
          <button key={r.symbol} type="button" className="fc-sugg" onClick={() => add(r.symbol)}>+ {short(r.name)}</button>
        ))}
        {others.length < 3 && (
          <form onSubmit={e => { e.preventDefault(); add(typed); setTyped(""); }} className="fc-form">
            <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="Any NSE symbol, e.g. INFY" aria-label="Add a company by its NSE symbol" />
            <button type="submit">Add</button>
          </form>
        )}
      </div>
      {others.length === 0 ? (
        <p className="fc-empty">Add up to three companies to see their {st.label.toLowerCase()} beside {short(m?.name ?? symbol)}'s.</p>
      ) : (
        <div className="fc-scroll">
          <table className="fc-table">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Figure</span></th>
                {cols.map((c, i) => (
                  <th key={c.symbol} scope="col">
                    <span>{short(c.name)}</span>
                    {i > 0 && <button type="button" aria-label={`Remove ${short(c.name)}`} onClick={() => setOthers(o => o.filter(x => x.symbol !== c.symbol))}><X size={13} /></button>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {st.rows.map(([label, get, fmt]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {cols.map(c => <td key={c.symbol}>{c.error ? (label === st.rows[0][0] ? c.error : "") : c.m ? fmt(get(c.m)) : "…"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* the same figures as bars, one group per line (17 Nov 2026, the
          owner: "in Compare give the graph also with the details") */}
      {others.length > 0 && (
        <div className="fc-chart" aria-label={`${st.label} compared, as bars`}>
          {st.rows.map(([label, get, fmt]) => {
            const vals = cols.map(c => (c.m && !c.error ? get(c.m) : null));
            const max = Math.max(...vals.map(v => (Number.isFinite(v) ? Math.abs(v) : 0)));
            if (!max) return null;
            return (
              <div key={label} className="fc-chart-g">
                <div className="fc-chart-h">{label}</div>
                {cols.map((c, i) => {
                  const v = vals[i];
                  return (
                    <div key={c.symbol} className={`fc-bar${i === 0 ? " me" : ""}`}>
                      <span className="fc-bar-n">{short(c.name)}</span>
                      <span className="fc-bar-t"><b className={v < 0 ? "neg" : ""} style={{ width: `${Number.isFinite(v) ? (Math.abs(v) / max) * 100 : 0}%` }} /></span>
                      <span className="fc-bar-v">{Number.isFinite(v) ? fmt(v) : "—"}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      <p className="fc-note">{statement === "quarterly" ? "The latest quarter each company has filed with NSE; quarters can end on different dates." : "The latest full year each company has filed with NSE; years can end on different dates."} Banks and lenders report differently, so some lines don't compare.</p>
    </div>
  );
}
