import { useMemo, useState } from "react";

const mono = { fontVariantNumeric: "tabular-nums" };
const panel = { border: "1px solid var(--bdr2)", borderRadius: 12, padding: 18, marginBottom: 12, background: "var(--s2)" };
const field = { width: 88, height: 34, padding: "0 8px", border: "1px solid var(--bdr2)", borderRadius: 7, background: "var(--s1)", color: "var(--t1)", fontSize: 12, fontVariantNumeric: "tabular-nums" };
const money = v => v == null || !Number.isFinite(v) || v <= 0 ? "—" : `₹${Math.round(v).toLocaleString("en-IN")}`;
const pct = v => `${Number(v).toFixed(1)}%`;
const finite = v => Number.isFinite(Number(v)) ? Number(v) : null;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function fcfDcfPerShare(fcfPerShare, growthPct, discountPct, terminalPct, years = 5) {
  if (!(fcfPerShare > 0) || !(discountPct > terminalPct) || terminalPct < 0) return null;
  const g = growthPct / 100;
  const r = discountPct / 100;
  const tg = terminalPct / 100;
  let value = 0;
  for (let year = 1; year <= years; year++) {
    const cash = fcfPerShare * (1 + g) ** year;
    value += cash / (1 + r) ** year;
  }
  const terminalCash = fcfPerShare * (1 + g) ** years * (1 + tg);
  value += (terminalCash / (r - tg)) / (1 + r) ** years;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function ScenarioRow({ name, color, growth, multiple, onGrowth, onMultiple, eps, price, years }) {
  const futureEps = eps > 0 ? eps * (1 + growth / 100) ** years : null;
  const futurePrice = futureEps != null && multiple > 0 ? futureEps * multiple : null;
  const cagr = futurePrice > 0 && price > 0 ? ((futurePrice / price) ** (1 / years) - 1) * 100 : null;
  return (
    <tr>
      <td style={{ padding: "9px 8px", borderTop: "1px solid var(--bdr)", color, fontWeight: 650 }}>{name}</td>
      <td style={{ padding: "7px 8px", borderTop: "1px solid var(--bdr)", textAlign: "right" }}><input aria-label={`${name} annual EPS growth`} type="number" min="-50" max="100" step="1" value={growth} onChange={e => onGrowth(clamp(finite(e.target.value) ?? 0, -50, 100))} style={field} /></td>
      <td style={{ padding: "7px 8px", borderTop: "1px solid var(--bdr)", textAlign: "right" }}><input aria-label={`${name} terminal P/E`} type="number" min="1" max="200" step="1" value={multiple} onChange={e => onMultiple(clamp(finite(e.target.value) ?? 1, 1, 200))} style={field} /></td>
      <td style={{ padding: "9px 8px", borderTop: "1px solid var(--bdr)", textAlign: "right", ...mono }}>{money(futureEps)}</td>
      <td style={{ padding: "9px 8px", borderTop: "1px solid var(--bdr)", textAlign: "right", fontWeight: 650, ...mono }}>{money(futurePrice)}</td>
      <td style={{ padding: "9px 8px", borderTop: "1px solid var(--bdr)", textAlign: "right", ...mono }}>{cagr == null ? "—" : pct(cagr)}</td>
    </tr>
  );
}

export default function ValuationExplorer({ metrics: m, price, levels, mosPct, epsInput, peInput }) {
  const historicalPe = Number(peInput) || Number(m?.medianPe ?? m?.valuationPe ?? m?.pe) || 0;
  const baseGrowth = clamp(Number(m?.epsGrowth5y ?? m?.epsGrowth3y ?? m?.growthForValuation ?? 0), -10, 30);
  const [bearGrowth, setBearGrowth] = useState(Math.round(baseGrowth - 5));
  const [baseGrowthInput, setBaseGrowthInput] = useState(Math.round(baseGrowth));
  const [bullGrowth, setBullGrowth] = useState(Math.round(baseGrowth + 5));
  const [bearPe, setBearPe] = useState(Math.max(1, Math.round(historicalPe * 0.75)));
  const [basePe, setBasePe] = useState(Math.max(1, Math.round(historicalPe)));
  const [bullPe, setBullPe] = useState(Math.max(1, Math.round(historicalPe * 1.2)));
  const [dcfFcfGrowth, setDcfFcfGrowth] = useState(5);
  const [discountRate, setDiscountRate] = useState(12);
  const [terminalGrowth, setTerminalGrowth] = useState(4);
  const [years, setYears] = useState(5);
  const [expanded, setExpanded] = useState(false);

  const eps = Number(epsInput) || Number(m?.valuationEps) || 0;
  const fcfPerShare = m?.fcfCr > 0 && m?.sharesCr > 0 ? m.fcfCr / m.sharesCr : null;
  const dcf = useMemo(() => fcfDcfPerShare(fcfPerShare, dcfFcfGrowth, discountRate, terminalGrowth), [fcfPerShare, dcfFcfGrowth, discountRate, terminalGrowth]);
  const sensitivity = [
    { label: `Bear · ${bearGrowth}%`, growth: bearGrowth },
    { label: `Base · ${baseGrowthInput}%`, growth: baseGrowthInput },
    { label: `Bull · ${bullGrowth}%`, growth: bullGrowth },
  ];
  const multiples = [bearPe, basePe, bullPe];
  const mos = clamp(finite(mosPct) ?? 10, 0, 80);
  const safePrice = levels?.fv25 > 0 ? levels.fv25 * (1 - mos / 100) : null;
  const growthSource = m.epsGrowth5y != null ? "reported 5-year EPS CAGR" : m.epsGrowth3y != null ? "reported 3-year EPS CAGR" : m.growthBasis ?? "editable analyst assumption";

  if (!m) return null;
  return (
    <section style={panel} aria-labelledby="valuation-explorer-title">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 id="valuation-explorer-title" style={{ fontSize: 15, fontWeight: 650, margin: 0, color: "var(--t1)" }}>Valuation methods &amp; scenarios</h3>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Model outputs from reported figures and editable assumptions. Estimates are not price targets.</div>
        </div>
        <button type="button" onClick={() => setExpanded(v => !v)} className="btn-ghost" style={{ height: 30, padding: "0 10px", fontSize: 11 }}>{expanded ? "Hide assumptions" : "Show assumptions"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 9, marginTop: 14 }}>
        <div style={{ padding: 12, background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 9 }}>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>{m.medianPe != null ? "Historical P/E reference" : "Current P/E reference"}</div>
          <div style={{ marginTop: 4, fontSize: 18, color: "var(--t1)", fontWeight: 700, ...mono }}>{money(levels?.fv25)}</div>
          <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 4 }}>₹{eps.toFixed(2)} normalized EPS × {historicalPe.toFixed(1)}× {m.medianPe != null ? `5Y median (${m.peYears} usable years)` : "P/E reference"}</div>
        </div>
        <div style={{ padding: 12, background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 9 }}>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>Margin-of-safety price</div>
          <div style={{ marginTop: 4, fontSize: 18, color: "var(--t1)", fontWeight: 700, ...mono }}>{money(safePrice)}</div>
          <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 4 }}>{money(levels?.fv25)} × (1 − {mos.toFixed(1)}%); based on current normalized EPS, before growth</div>
        </div>
        <div style={{ padding: 12, background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 9 }}>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>Reported free-cash-flow yield</div>
          <div style={{ marginTop: 4, fontSize: 18, color: "var(--t1)", fontWeight: 700, ...mono }}>{m.fcfYieldPct != null ? pct(m.fcfYieldPct) : "—"}</div>
          <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 4 }}>Latest-year CFO − capex ÷ market value; unavailable for lenders or missing cash-flow data</div>
        </div>
        <div style={{ padding: 12, background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 9 }}>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>Simplified 5Y cash-flow DCF</div>
          <div style={{ marginTop: 4, fontSize: 18, color: "var(--t1)", fontWeight: 700, ...mono }}>{money(dcf)}</div>
          <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 4 }}>{dcf == null ? "Needs positive reported FCF and discount rate above terminal growth" : `FCF/share ₹${fcfPerShare.toFixed(2)} · ${dcfFcfGrowth}% FCF growth · ${discountRate}% discount · ${terminalGrowth}% terminal`}</div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 650, color: "var(--t1)" }}>{years}-year cases — edit every assumption</div>
            <div style={{ display: "flex", gap: 5 }}>
              {[3, 5].map(y => <button key={y} type="button" onClick={() => setYears(y)} className="btn-ghost" aria-pressed={years === y} style={{ height: 28, padding: "0 10px", fontSize: 11, borderColor: years === y ? "var(--accent)" : undefined, color: years === y ? "var(--accent)" : undefined }}>{y} years</button>)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8, lineHeight: 1.5 }}>Future EPS = ₹{eps.toFixed(2)} × (1 + growth)^{years}. Future price = future EPS × terminal P/E. CAGR excludes dividends. Growth defaults use {growthSource}; multiple anchors use the historical median when available. These editable assumptions are not forecasts.</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead><tr>{["Case", "EPS growth p.a.", "Terminal P/E", `FY+${years} EPS`, "Scenario price", "Price CAGR"].map((h, i) => <th key={h} style={{ textAlign: i < 1 ? "left" : "right", padding: "7px 8px", borderBottom: "1px solid var(--bdr2)", color: "var(--t3)", fontWeight: 550 }}>{h}</th>)}</tr></thead>
              <tbody>
                <ScenarioRow name="Bear" color="var(--red)" growth={bearGrowth} multiple={bearPe} onGrowth={setBearGrowth} onMultiple={setBearPe} eps={eps} price={price} years={years} />
                <ScenarioRow name="Base" color="var(--accent)" growth={baseGrowthInput} multiple={basePe} onGrowth={setBaseGrowthInput} onMultiple={setBasePe} eps={eps} price={price} years={years} />
                <ScenarioRow name="Bull" color="var(--green)" growth={bullGrowth} multiple={bullPe} onGrowth={setBullGrowth} onMultiple={setBullPe} eps={eps} price={price} years={years} />
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "12px 0 6px", fontSize: 11.5, color: "var(--t2)" }}>
            <label>FCF growth <input type="number" min="-50" max="100" step="0.5" value={dcfFcfGrowth} onChange={e => setDcfFcfGrowth(clamp(finite(e.target.value) ?? 5, -50, 100))} style={field} /> %</label>
            <label>Discount rate <input type="number" min="1" max="40" step="0.5" value={discountRate} onChange={e => setDiscountRate(clamp(finite(e.target.value) ?? 12, 1, 40))} style={field} /> %</label>
            <label>Terminal growth <input type="number" min="0" max="20" step="0.5" value={terminalGrowth} onChange={e => setTerminalGrowth(clamp(finite(e.target.value) ?? 4, 0, 20))} style={field} /> %</label>
            {discountRate <= terminalGrowth && <span style={{ color: "var(--red)" }}>Discount rate must exceed terminal growth.</span>}
          </div>
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 650, color: "var(--t1)", marginBottom: 6 }}>{years}-year price sensitivity · ₹ per share</div>
            <table style={{ width: "100%", minWidth: 470, borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead><tr><th style={{ textAlign: "left", padding: 7, color: "var(--t3)" }}>EPS growth ↓ / exit P/E →</th>{multiples.map((v, i) => <th key={`${i}-${v}`} style={{ textAlign: "right", padding: 7, color: "var(--t3)" }}>{["Bear", "Base", "Bull"][i]} · {v}×</th>)}</tr></thead>
              <tbody>{sensitivity.map(row => <tr key={row.label}><th style={{ textAlign: "left", padding: 7, borderTop: "1px solid var(--bdr)", color: "var(--t2)", fontWeight: 550 }}>{row.label}</th>{multiples.map((multiple, i) => <td key={`${row.label}-${i}`} style={{ textAlign: "right", padding: 7, borderTop: "1px solid var(--bdr)", color: "var(--t1)", ...mono }}>{money(eps > 0 ? eps * (1 + row.growth / 100) ** years * multiple : null)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--t3)", lineHeight: 1.55, marginTop: 10 }}>The DCF discounts five years of reported FCF/share plus a terminal value. It is highly sensitive to assumptions and is omitted when FCF is zero/negative or unavailable. It is not included in the research score. FCF is CFO less capex; capital structure and future reinvestment needs are not forecast.</div>
        </div>
      )}
    </section>
  );
}
