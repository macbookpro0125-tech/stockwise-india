// What the company page shows in place of the P/E-history valuation when a
// company is routed to another model (server/metrics.js valuation; the
// sector-aware valuation spec of 11 Oct 2026):
//  - a bank, valued on book (server/bank-valuation.js): the formula with its
//    inputs, a cost-of-equity × growth grid so the fragility is in view, the
//    bank's own usual P/B as a cross-check, and five quarters of asset quality
//  - no fair value (a recent listing, a loss, too few usable P/E years), or
//    a model that needs data NSE's filings don't carry (an NBFC lender, a
//    holding company): why, and EV/Sales against the sector as context only
const MONO = { fontVariantNumeric: "tabular-nums" };
const panel = { border: "1px solid var(--bdr2)", borderRadius: 12, padding: 18, marginBottom: 12, background: "var(--s2)" };
const rs = v => (v == null || !Number.isFinite(v) ? "—" : `₹${Math.round(v).toLocaleString("en-IN")}`);
const crore = v => (v == null || !Number.isFinite(v) ? "—" : `₹${Math.round(v).toLocaleString("en-IN")} Cr`);
const pct = (v, dp = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(dp)}%`);
const quarterLabel = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

export const VALUED_AS = {
  earnings: "steady earner — this year's EPS × its usual P/E",
  book: "bank — justified P/B × book less net bad loans",
};

// "Valued as …" for every company, above its valuation inputs
export function ValuedAs({ valuation }) {
  if (!valuation) return null;
  const text = VALUED_AS[valuation.model] ?? (valuation.model === "needs-data" ? `${valuation.as} — valuation needs more data` : `no fair value (${valuation.as})`);
  return (
    <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 12 }}>
      <span style={{ color: "var(--t3)" }}>Valued as: </span><strong style={{ color: "var(--t1)", fontWeight: 600 }}>{text}</strong>
    </div>
  );
}

// The P/B a cost of equity gives, with the growth rate held
export function pbAt(roe, g, ke) {
  if (![roe, g, ke].every(Number.isFinite) || !(ke > g)) return null;
  return Math.max((roe - g) / (ke - g), 0.25);
}

export function BankValuation({ m, growthInput, costOfEquity, onCostOfEquity }) {
  const v = m.valuation;
  const g = Number(growthInput);
  // The filings' own figures until growth or the cost of equity is changed
  const atBaseline = Math.abs(g - v.growth) < 0.005 && costOfEquity === v.costOfEquity;
  const pb = atBaseline ? v.justifiedPb : pbAt(v.roe, g, costOfEquity);
  const fair = atBaseline ? v.fairValue : pb != null ? pb * v.adjustedBvps : null;
  const trend = m.bank?.trend ?? [];
  const row = (label, children, sub) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: "1px solid var(--bdr)", fontSize: 12.5 }}>
      <span style={{ color: "var(--t2)" }}>{label}{sub && <span style={{ display: "block", fontSize: 10.5, color: "var(--t3)", marginTop: 2 }}>{sub}</span>}</span>
      <span style={{ color: "var(--t1)", fontWeight: 600, textAlign: "right", ...MONO }}>{children}</span>
    </div>
  );
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.55, marginBottom: 8 }}>
        A bank's product is its balance sheet: its profits swing with provisions for bad loans, and its cash flow is deposits and loans moving, so it's valued on book, not on its P/E history.
      </div>
      {row("Through-cycle return on equity", pct(v.roe), `Median of the last ${v.roeYears} years, bad years included`)}
      {row("Growth retained earnings support", <>{pct(v.growthRaw)}{v.growthRaw > v.growth + 0.05 && <span style={{ color: "var(--t3)", fontWeight: 400 }}> → {pct(v.growth)}</span>}</>,
        `ROE × (1 − ${pct(v.payoutPct, 0)} paid out)${v.growthRaw > v.growth + 0.05 ? `, capped at ${pct(v.growth, 0)} — and kept 4 points under the cost of equity` : ""}. Edit "Book growth" above to change it.`)}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "7px 0", borderTop: "1px solid var(--bdr)", fontSize: 12.5 }}>
        <span style={{ color: "var(--t2)" }}>Cost of equity<span style={{ display: "block", fontSize: 10.5, color: "var(--t3)", marginTop: 2 }}>{v.psu ? "12%, a point more for a government bank" : "12%, as the cash-flow model uses"}</span></span>
        <input aria-label="Cost of equity %" type="number" step="0.5" min="6" max="25" value={costOfEquity} onChange={e => onCostOfEquity(Number(e.target.value))}
          style={{ width: 80, height: 32, padding: "0 8px", border: "1px solid var(--bdr2)", borderRadius: 7, background: "var(--s1)", color: "var(--t1)", fontSize: 12.5, textAlign: "right", ...MONO }} />
      </div>
      {row("Justified P/B", pb == null ? "—" : `${pb.toFixed(2)}×`, `(ROE − growth) ÷ (cost of equity − growth)${costOfEquity - g < 4 ? " · under 4 points apart, the multiple gets fragile" : ""}`)}
      {row("Book less net bad loans", <>{rs(v.adjustedBvps)}<span style={{ color: "var(--t3)", fontWeight: 400 }}> a share</span></>,
        v.nnpaKnown ? `${crore(v.equityCr)} equity − ${crore(v.nnpaCr)} net NPA = ${crore(v.adjustedBookCr)}` : "Net NPA not on file — book isn't adjusted")}
      {row("Today's fair value", <span style={{ color: "var(--accent)" }}>{rs(fair)}</span>, "Justified P/B × book less net bad loans")}
      {v.crossCheck != null && row("Cross-check: its usual P/B", rs(v.crossCheck), `Median P/B at the last ${v.usualPbYears} year-ends (${v.usualPb.toFixed(2)}×) × the same book — what the market has usually paid`)}

      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", margin: "16px 0 6px" }}>How fragile the multiple is</div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8, lineHeight: 1.5 }}>A point on the cost of equity, or two on growth, moves the value a lot — the formula explodes as growth nears the cost of equity, and has no finite value once growth reaches it.</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>
            <th style={{ textAlign: "left", padding: "6px 6px", color: "var(--t3)", fontWeight: 500, borderBottom: "1px solid var(--bdr2)" }}>Growth</th>
            {v.grid[0].cells.map(c => <th key={c.ke} style={{ textAlign: "right", padding: "6px 6px", color: "var(--t3)", fontWeight: 500, borderBottom: "1px solid var(--bdr2)" }}>Cost of equity<br />{c.ke}%</th>)}
          </tr></thead>
          <tbody>{v.grid.map(r => (
            <tr key={r.label}>
              <td style={{ padding: "7px 6px", color: "var(--t2)", borderBottom: "1px solid var(--bdr)" }}>{pct(r.cells[0].g)} <span style={{ color: "var(--t3)" }}>({r.label})</span></td>
              {r.cells.map(c => <td key={c.ke} style={{ padding: "7px 6px", textAlign: "right", borderBottom: "1px solid var(--bdr)", ...MONO }}>{c.pb == null ? <span style={{ color: "var(--t3)", fontSize: 11 }}>no finite value</span> : <><strong style={{ color: "var(--t1)" }}>{rs(c.value)}</strong><span style={{ display: "block", fontSize: 10.5, color: "var(--t3)" }}>P/B {c.pb.toFixed(2)}</span></>}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>

      {trend.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", margin: "16px 0 6px" }}>Asset quality, last {trend.length} quarters</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 380, borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>
                <th style={{ textAlign: "left", padding: "6px 6px", color: "var(--t3)", fontWeight: 500, borderBottom: "1px solid var(--bdr2)" }}></th>
                {trend.map(q => <th key={q.asOf} style={{ textAlign: "right", padding: "6px 6px", color: "var(--t3)", fontWeight: 500, borderBottom: "1px solid var(--bdr2)" }}>{quarterLabel(q.asOf)}</th>)}
              </tr></thead>
              <tbody>{[
                ["Gross NPA", "gnpaPct", 2], ["Net NPA", "nnpaPct", 2], ["CET1", "cet1Pct", 1], ["Tier 1", "tier1Pct", 1], ["RoA (yearly rate)", "roaPct", 2],
              ].map(([label, key, dp]) => (
                <tr key={key}>
                  <td style={{ padding: "7px 6px", color: "var(--t2)", borderBottom: "1px solid var(--bdr)", whiteSpace: "nowrap" }}>{label}</td>
                  {trend.map(q => <td key={q.asOf} style={{ padding: "7px 6px", textAlign: "right", color: "var(--t1)", borderBottom: "1px solid var(--bdr)", ...MONO }}>{pct(q[key], dp)}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 6, lineHeight: 1.5 }}>From each quarter's standalone results on NSE. Total capital adequacy (CRAR) isn't in those filings, so Tier 1 capital is shown.</div>
        </>
      )}
    </div>
  );
}

// No fair value, or one that needs data the filings don't carry
export function NoFairValue({ m }) {
  const v = m.valuation;
  const ctx = m.evToSalesSector;
  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--t1)", fontWeight: 600, marginBottom: 4 }}>{v.model === "needs-data" ? "Valuation needs more data" : "No fair value"}</div>
      <p style={{ fontSize: 12, color: "var(--t2)", margin: 0, lineHeight: 1.6 }}>{v.reason} So there are no price levels for it — the research score still rates its quality.</p>
      {v.model === "none" && m.evToSales != null && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "var(--s1)", border: "1px solid var(--bdr)", fontSize: 12, color: "var(--t2)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--t1)", ...MONO }}>EV/Sales {m.evToSales.toFixed(2)}×</strong>
          {ctx ? <> against a median of <strong style={{ color: "var(--t1)", ...MONO }}>{ctx.median.toFixed(2)}×</strong> across {ctx.n} {ctx.sector} companies.</> : "."}
          <span style={{ display: "block", fontSize: 10.5, color: "var(--t3)", marginTop: 3 }}>Enterprise value (market value plus net debt) over the latest year's revenue. Context only — not a fair value.</span>
        </div>
      )}
    </div>
  );
}

export const panelStyle = panel;
