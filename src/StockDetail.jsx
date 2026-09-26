import { useState, useEffect } from "react";
import { api } from "./api.js";
import { calculateLevels, getAction } from "../server/levels.js";

function fmtRs(n) { return n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`; }
function fmtCr(n) { return n == null ? "—" : `₹${(n / 10000000).toFixed(1)} Cr`; }

function LadderRow({ label, price, cmp }) {
  const hit = cmp != null && price != null && cmp <= price;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: hit ? "var(--green-dim)" : "var(--s2)", border: `1px solid ${hit ? "var(--green-bdr)" : "var(--bdr)"}` }}>
      <span style={{ color: hit ? "var(--green)" : "var(--t2)", fontWeight: hit ? 700 : 500, fontSize: 13 }}>{label}</span>
      <span className="mono" style={{ color: hit ? "var(--green)" : "var(--t1)", fontWeight: 700, fontSize: 13 }}>
        {fmtRs(price)}{hit && " ✓"}
      </span>
    </div>
  );
}

function OverrideInput({ label, value, onChange, hint, suffix }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <input type="number" step="any" value={value} onChange={e => onChange(e.target.value)} className="mono" style={{ width: "100%", paddingRight: suffix ? 28 : 12 }} />
        {suffix && <span style={{ position: "absolute", right: 10, top: 10, fontSize: 12, color: "var(--t3)" }}>{suffix}</span>}
      </div>
      {hint && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export default function StockDetail({ symbol, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pe, setPe] = useState("");
  const [growth, setGrowth] = useState("12");
  const [mos, setMos] = useState("10");

  useEffect(() => {
    setData(null);
    setError("");
    api.stock(symbol).then(d => {
      setData(d);
      setPe(d.pe ? d.pe.toFixed(1) : "");
    }).catch(e => setError(e.message));
  }, [symbol]);

  if (error) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px" }}>
        <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>
        <div style={{ color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: "var(--r-sm)", padding: "14px 16px" }}>{error}</div>
      </div>
    );
  }
  if (!data) return <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px", color: "var(--t3)" }}>Loading…</div>;

  const { quote, roe, debtToEquity, holding, pnl, balanceSheet } = data;
  // Recomputed client-side on every edit, same as the original's "override
  // any field, buy ladder updates instantly" — server's levels are only the
  // at-current-P/E default.
  const levels = calculateLevels(data.eps, pe, growth, mos);
  const action = quote && levels ? getAction(quote.cmp, levels) : null;
  // At today's P/E, fair value = EPS x (CMP / EPS) = CMP by construction —
  // the ladder is then just fixed discounts off the current price and says
  // nothing about value. Flag it rather than let it pass for an analysis.
  const peIsCurrent = data.pe && Math.abs(Number(pe) - data.pe) < 0.05;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px" }}>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>← Back to Discover</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>{data.name}</h1>
          <div style={{ color: "var(--t3)", fontSize: 13, marginTop: 2 }}>{data.symbol} · NSE</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{fmtRs(quote?.cmp)}</div>
          {quote && <div style={{ fontSize: 11, color: "var(--t3)" }}>as of {quote.asOf}</div>}
        </div>
      </div>

      {data.quoteError && (
        <div style={{ fontSize: 12, color: "var(--yellow)", background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", borderRadius: "var(--r-sm)", padding: "8px 12px", margin: "16px 0" }}>
          Couldn't fetch a live price ({data.quoteError}) — fair value and the buy ladder need it, so those aren't shown.
        </div>
      )}

      {action && (
        <div style={{ margin: "20px 0", padding: "14px 16px", borderRadius: 10, background: "var(--s2)", border: "1px solid var(--bdr2)" }}>
          <span style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Suggested action</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: action.color, marginTop: 2 }}>{action.action}</div>
        </div>
      )}

      {quote && data.eps > 0 && (
        <div style={{ padding: "16px", borderRadius: 12, background: "var(--s1)", border: "1px solid var(--bdr2)", marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Verify & override</div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 12 }}>Edit any value — the buy ladder updates instantly.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <OverrideInput label="P/E to value at" value={pe} onChange={setPe} hint={data.pe ? `Current P/E ${data.pe.toFixed(1)}` : null} />
            <OverrideInput label="EPS growth p.a." value={growth} onChange={setGrowth} suffix="%" />
            <OverrideInput label="Margin of safety" value={mos} onChange={setMos} suffix="%" />
          </div>
          {peIsCurrent && (
            <div style={{ fontSize: 12, color: "var(--yellow)", background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", borderRadius: 8, padding: "8px 12px", marginTop: 12 }}>
              At today's P/E, fair value equals the current price by definition — the ladder is just fixed discounts off it. Enter this stock's 5–10 year average P/E for a real valuation.
            </div>
          )}
        </div>
      )}

      {levels && (
        <>
          <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "20px 0 8px" }}>
            Buy ladder — fair value ₹{levels.fv25} today, ₹{levels.fv27} in 2yr at {growth}% growth
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <LadderRow label="Phase 1 — deploy 30%" price={levels.p1} cmp={quote?.cmp} />
            <LadderRow label="Phase 2 — deploy 30%" price={levels.p2} cmp={quote?.cmp} />
            <LadderRow label="Phase 3 — deploy 40%" price={levels.p3} cmp={quote?.cmp} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--t3)", marginTop: 8, padding: "0 14px" }}>
            <span>Stop loss {fmtRs(levels.stopLoss)}</span>
            <span>Target {fmtRs(levels.target)}</span>
          </div>
        </>
      )}

      <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "28px 0 8px" }}>Fundamentals</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {[
          ["EPS (full year)", data.eps != null ? `₹${data.eps.toFixed(2)}` : "—"],
          ["P/E", data.pe ? data.pe.toFixed(1) : "—"],
          ["ROE (full year)", roe != null ? `${(roe * 100).toFixed(1)}%` : "—"],
          ["Debt / Equity", debtToEquity != null ? `${debtToEquity.toFixed(2)}×` : "—"],
          ["Revenue (full year)", fmtCr(data.annual?.revenue)],
          ["Profit (full year)", fmtCr(data.annual?.profit)],
          ["Revenue (latest qtr)", fmtCr(pnl.revenueQuarter)],
          ["Profit (latest qtr)", fmtCr(pnl.profitQuarter)],
          ["Promoter holding", `${holding.promoterPct}%`],
          ["Net worth", fmtCr(balanceSheet.netWorth)],
          ["Total debt", fmtCr(balanceSheet.totalDebt)],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: "12px 14px", borderRadius: 10, background: "var(--s2)", border: "1px solid var(--bdr)" }}>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>{label}</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 20 }}>
        Latest quarter ended {pnl.periodEnded} · EPS, ROE and balance sheet from the {data.epsBasis} · Source: NSE Integrated Filings
      </div>
    </div>
  );
}
