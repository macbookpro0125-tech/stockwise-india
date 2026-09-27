import { useState, useEffect } from "react";
import { api } from "./api.js";
import { calculateLevels, getAction } from "../server/levels.js";
import { ScoreBadge } from "./ResultsTable.jsx";

function fmtRs(n) { return n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`; }
function fmtCr(n) { return n == null ? "—" : `₹${(n / 10000000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`; }
function fmtCrValue(n) { return n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")} Cr`; }
function fmtPct(n, dp = 1) { return n == null ? "—" : `${n.toFixed(dp)}%`; }
function fmtFy(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

const sectionTitle = { fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "28px 0 8px" };
const card = { border: "1px solid var(--bdr2)", borderRadius: 14, padding: "16px 20px", marginBottom: 12, background: "var(--s2)" };

function PeHistoryTable({ m }) {
  const cell = { padding: "7px 10px", fontSize: 12, borderBottom: "1px solid var(--bdr)", textAlign: "right" };
  const head = { ...cell, fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em" };
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>This stock's P/E, last {m.peHistory.length} fiscal years</div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: "left" }}>Year ended</th>
              <th style={head}>EPS</th>
              <th style={head}>Price at year end</th>
              <th style={head}>P/E</th>
              <th style={{ ...head, textAlign: "left" }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {m.peHistory.map(y => (
              <tr key={y.fyEnd} style={{ color: y.pe == null ? "var(--t3)" : "var(--t1)" }}>
                <td style={{ ...cell, textAlign: "left" }}>{fmtFy(y.fyEnd)}</td>
                <td className="mono" style={cell}>{y.eps != null ? `₹${y.eps.toFixed(2)}` : "—"}</td>
                <td className="mono" style={cell}>{y.price != null ? fmtRs(y.price) : "—"}</td>
                <td className="mono" style={{ ...cell, fontWeight: 600 }}>{y.pe != null ? y.pe.toFixed(1) : "—"}</td>
                <td style={{ ...cell, textAlign: "left", color: "var(--t3)" }}>
                  {y.excluded ?? (y.splitFactor > 1 ? `Reported ₹${y.reportedEps}; ÷${y.splitFactor} for a later split/bonus` : "")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 8, lineHeight: 1.5 }}>
        {m.medianPe != null
          ? <>Median of {m.peYears} years: <strong style={{ color: "var(--t1)" }}>{m.medianPe.toFixed(1)}</strong> — used as the default P/E above. A median, so one unusual year can't drag it.</>
          : <>Only {m.peYears} usable year{m.peYears === 1 ? "" : "s"} — at least 3 are needed for a median, so the default stays at today's P/E.</>}
      </div>
    </div>
  );
}

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
        {suffix && <span style={{ position: "absolute", right: 10, top: 11, fontSize: 12, color: "var(--t3)" }}>{suffix}</span>}
      </div>
      {hint && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function ScoreCard({ m }) {
  const { score } = m;
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Quality score</div>
        <ScoreBadge score={score.green} max={score.applicable} />
        {m.lender && <span style={{ fontSize: 11, color: "var(--t3)" }}>Lender — debt and cash-flow checks don't apply, so it's scored out of {score.applicable}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "6px 20px" }}>
        {score.checks.map(c => (
          <div key={c.id} style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.5, color: c.ok ? "var(--t1)" : "var(--t3)" }}>
            <span style={{ color: c.ok ? "var(--green)" : "var(--red)", fontWeight: 700, width: 12, flexShrink: 0 }}>{c.ok ? "✓" : "✗"}</span>
            {c.label}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 10, lineHeight: 1.5 }}>
        The same ten checks as Stockwise. Fair-value checks use the default valuation below, not any P/E you type in.
      </div>
    </div>
  );
}

function ProsCons({ m }) {
  if (!m.pros.length && !m.cons.length) return null;
  const list = (items, color, title) => (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{title} ({items.length})</div>
      <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((p, i) => <li key={i} style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>{p}</li>)}
      </ul>
    </div>
  );
  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
        Pros &amp; Cons <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 400 }}>— worked out from the filings</span>
      </div>
      <div className="ss-pros-cons-grid" style={m.pros.length && m.cons.length ? undefined : { gridTemplateColumns: "1fr" }}>
        {m.pros.length > 0 && list(m.pros, "var(--green)", "✓ Pros")}
        {m.cons.length > 0 && list(m.cons, "var(--red)", "✗ Cons")}
      </div>
    </div>
  );
}

export default function StockDetail({ symbol, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pe, setPe] = useState("");
  const [growth, setGrowth] = useState("");
  const [mos, setMos] = useState("10");

  useEffect(() => {
    let cancelled = false;
    api.stock(symbol).then(d => {
      if (cancelled) return;
      setData(d);
      const m = d.metrics;
      // Defaults are what the Discover table used, so the same stock shows
      // the same buy prices on both screens until you change something.
      if (m?.valuationPe) setPe(m.valuationPe.toFixed(1));
      if (m) setGrowth(String(Math.round(m.growthForValuation * 10) / 10));
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [symbol]);

  if (error) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>
        <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>
        <div style={{ color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: "var(--r-sm)", padding: "14px 16px" }}>{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px", color: "var(--t3)" }}>
        Loading {symbol}…
      </div>
    );
  }

  const { quote, pnl, balanceSheet } = data;
  const m = data.metrics;
  const cmp = quote?.cmp ?? m?.cmp ?? null;
  // Recomputed on every edit, as in the original — override any field and
  // the buy ladder updates instantly.
  const levels = m?.eps > 0 ? calculateLevels(m.eps, pe, growth, mos) : null;
  const action = cmp && levels ? getAction(cmp, levels) : null;
  // At today's P/E, fair value = EPS x (CMP / EPS) = CMP by construction —
  // the ladder is then just fixed discounts off the current price.
  const peIsCurrent = m?.pe && Math.abs(Number(pe) - m.pe) < 0.05;

  const stat = (label, value, note) => ({ label, value, note });
  const stats = m ? [
    stat("Market cap", fmtCrValue(m.marketCapCr)),
    stat("P/E", m.pe ? m.pe.toFixed(1) : "—"),
    stat("EPS (full year)", m.eps != null ? `₹${m.eps.toFixed(2)}` : "—"),
    stat("Price / book", m.priceToBook != null ? m.priceToBook.toFixed(2) : "—"),
    stat("ROCE", fmtPct(m.roce)),
    stat("ROE", fmtPct(m.roe)),
    stat(`ROE (${m.roeAvgYears}Y avg)`, fmtPct(m.roeAvg)),
    stat("OPM", fmtPct(m.opm), m.lender ? "not reported by lenders" : null),
    stat("Sales growth 3Y", fmtPct(m.salesGrowth3y)),
    stat("Sales growth 5Y", fmtPct(m.salesGrowth5y)),
    stat("Profit growth 3Y", fmtPct(m.profitGrowth3y)),
    stat("Profit growth 5Y", fmtPct(m.profitGrowth5y)),
    stat("Debt / equity", m.debtToEquity != null ? `${m.debtToEquity.toFixed(2)}×` : "—"),
    stat("Dividend yield", fmtPct(m.divYield, 2)),
    stat("Payout", fmtPct(m.payoutPct, 0)),
    stat("Cash flow / profit (3Y)", fmtPct(m.ocfPat3yPct, 0)),
    stat("Promoter holding", fmtPct(m.promoterPct)),
    stat("FII holding", fmtPct(m.fiiPct)),
    stat("DII holding", fmtPct(m.diiPct)),
    stat("Promoter shares pledged", fmtPct(m.pledgedPct)),
    stat("Revenue (full year)", fmtCr(data.annual?.revenue)),
    stat("Profit (full year)", fmtCr(data.annual?.profit)),
    stat("Revenue (latest qtr)", fmtCr(pnl?.revenueQuarter)),
    stat("Profit (latest qtr)", fmtCr(pnl?.profitQuarter)),
    stat("Net worth", fmtCr(balanceSheet?.netWorth)),
    stat("Total debt", fmtCr(balanceSheet?.totalDebt)),
    stat("Net current assets (NCAV)", fmtCrValue(m.ncavCr), m.ncavCr != null && m.marketCapCr != null && m.ncavCr > m.marketCapCr ? "above market cap — a net-net" : null),
  ] : [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 80px", animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) both" }}>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16, height: 34, fontSize: 12 }}>← Back</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.02em" }}>{data.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 11, background: "var(--s3)", color: "var(--t2)", padding: "2px 8px", borderRadius: 5 }}>{data.symbol}</span>
            {m?.sector && <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 6, background: "var(--accent-glow)", color: "var(--accent)", fontWeight: 600 }}>{m.sector}</span>}
            {m?.cyclical && <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 6, background: "var(--yellow-dim)", color: "var(--yellow)", fontWeight: 600 }}>Cyclical</span>}
            {m && <ScoreBadge score={m.score.green} max={m.score.applicable} />}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{fmtRs(cmp)}</div>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>
            {quote ? `as of ${quote.asOf}` : m?.cmpDate ? `close on ${m.cmpDate}` : ""}
          </div>
        </div>
      </div>

      {data.quoteError && (
        <div style={{ fontSize: 12, color: "var(--yellow)", background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", borderRadius: "var(--r-sm)", padding: "8px 12px", margin: "16px 0" }}>
          Couldn't fetch a live price ({data.quoteError}){m?.cmp ? " — using the last daily close instead." : " — fair value and the buy ladder need a price, so those aren't shown."}
        </div>
      )}

      {!m && (
        <div style={{ ...card, marginTop: 16, color: "var(--t3)", fontSize: 13 }}>
          No usable annual results in NSE's filings for this company, so there's nothing to score or value.
        </div>
      )}

      {action && (
        <div style={{ margin: "20px 0", padding: "14px 16px", borderRadius: 12, background: "var(--s2)", border: `2px solid ${action.color}` }}>
          <span style={{ fontSize: 11, color: action.color, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Suggested action</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: action.color, marginTop: 2 }}>{action.action}</div>
          <div style={{ fontSize: 13, color: "var(--t2)", marginTop: 4 }}>{action.reason}</div>
          {/* Valuing at a historical P/E makes this common for de-rated stocks,
              and the original's stop-loss wording assumes you already hold it. */}
          {action.action === "BELOW STOP LOSS" && m.pe && Number(pe) > m.pe && (
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 8, lineHeight: 1.5 }}>
              The stop loss applies to a position bought on this ladder. If you don't hold it yet: the market prices it at a P/E of {m.pe.toFixed(1)} versus the {Number(pe).toFixed(1)} you're valuing it at. That's either deep value, or a sign the old multiple no longer applies — worth finding out why it de-rated before buying.
            </div>
          )}
        </div>
      )}

      {m && cmp && m.eps > 0 && (
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Verify & Override</div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 12 }}>Auto-filled from the filings — edit any value, the buy ladder updates live.</div>
          <div className="ss-grid-3">
            <OverrideInput
              label="P/E to value at"
              value={pe}
              onChange={setPe}
              hint={[m.medianPe != null && `5-yr median ${m.medianPe.toFixed(1)}`, m.pe && `today ${m.pe.toFixed(1)}`].filter(Boolean).join(" · ")}
            />
            <OverrideInput
              label="EPS growth p.a."
              value={growth}
              onChange={setGrowth}
              suffix="%"
              hint={m.profitGrowth5y != null ? "5-yr profit growth, capped 0–25%" : m.salesGrowth5y != null ? "5-yr sales growth, capped 0–25%" : "no 5-yr history — default 12%"}
            />
            <OverrideInput label="Margin of safety" value={mos} onChange={setMos} suffix="%" />
          </div>
          {peIsCurrent && (
            <div style={{ fontSize: 12, color: "var(--yellow)", background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", borderRadius: 8, padding: "8px 12px", marginTop: 12 }}>
              At today's P/E, fair value equals the current price by definition — the ladder is just fixed discounts off it.
              {m.medianPe != null ? " Use the 5-year median below for a real valuation." : " Enter a long-run average P/E for a real valuation."}
            </div>
          )}
          <PeHistoryTable m={m} />
        </div>
      )}

      {levels && cmp && (
        <>
          <div style={sectionTitle}>
            Buy ladder — fair value ₹{levels.fv25.toLocaleString("en-IN")} today, ₹{levels.fv27.toLocaleString("en-IN")} in 2yr at {growth}% growth
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <LadderRow label="Phase 1 — deploy 30%" price={levels.p1} cmp={cmp} />
            <LadderRow label="Phase 2 — deploy 30%" price={levels.p2} cmp={cmp} />
            <LadderRow label="Phase 3 — deploy 40%" price={levels.p3} cmp={cmp} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--t3)", marginTop: 8, padding: "0 14px" }}>
            <span>Stop loss {fmtRs(levels.stopLoss)}</span>
            <span>Target {fmtRs(levels.target)}</span>
          </div>
        </>
      )}

      {m && (
        <>
          <div style={sectionTitle}>Quality</div>
          <ScoreCard m={m} />
          <ProsCons m={m} />

          <div style={sectionTitle}>Fundamentals</div>
          <div className="ss-grid-4">
            {stats.map(s => (
              <div key={s.label} style={{ padding: "12px 14px", borderRadius: 10, background: "var(--s2)", border: "1px solid var(--bdr)" }}>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>{s.label}</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{s.value}</div>
                {s.note && <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{s.note}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 20, lineHeight: 1.7 }}>
        {m && <>Year ended {fmtFy(m.fyEnd)} ({data.annual?.scope?.toLowerCase() ?? "reported"} results) · </>}
        {pnl?.periodEnded && <>latest quarter {pnl.periodEnded} · </>}
        {m?.holdingAsOf && <>shareholding as of {m.holdingAsOf} · </>}
        {m?.sharesSource && <>share count from the {m.sharesSource} · </>}
        Filings: NSE · Live price: Yahoo Finance · Educational use only, not financial advice
      </div>
    </div>
  );
}
