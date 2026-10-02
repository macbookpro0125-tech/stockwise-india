import { useEffect, useState } from "react";

const card = { border: "1px solid var(--bdr2)", borderRadius: 12, padding: 18, marginBottom: 12, background: "var(--s2)" };
const pct = v => v == null ? "not available" : `${v.toFixed(1)}%`;
const THESIS_KEY = "stockwise-investment-thesis";
const loadThesis = symbol => {
  try { return { case: "", marketGap: "", breakers: "", ...(JSON.parse(localStorage.getItem(THESIS_KEY) || "{}")[symbol] ?? {}) }; }
  catch { return { case: "", marketGap: "", breakers: "" }; }
};

export default function ThesisMonitor({ metrics: m }) {
  const [thesis, setThesis] = useState(() => loadThesis(m?.symbol));
  useEffect(() => {
    if (!m?.symbol) return;
    try {
      const all = JSON.parse(localStorage.getItem(THESIS_KEY) || "{}");
      all[m.symbol] = thesis;
      localStorage.setItem(THESIS_KEY, JSON.stringify(all));
    } catch {}
  }, [m?.symbol, thesis]);
  if (!m) return null;
  const monitors = [];
  if (m.salesGrowth3y != null) monitors.push({ label: "Revenue trend", detail: `Three-year sales CAGR is ${pct(m.salesGrowth3y)}. Check future filings for acceleration or a sustained slowdown.` });
  if (m.opm != null && m.opm5y != null) monitors.push({ label: "Operating margin", detail: `Latest margin is ${pct(m.opm)} versus a five-year average of ${pct(m.opm5y)}; watch whether the gap persists.` });
  if (m.fcfCr != null) monitors.push({ label: "Cash generation", detail: `Latest reported free cash flow is ₹${m.fcfCr.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr. Check whether cash conversion remains consistent with earnings.` });
  if (m.debtToEquity != null) monitors.push({ label: "Leverage", detail: `Debt/equity is ${m.debtToEquity.toFixed(2)}×. Review any sustained increase alongside interest coverage and cash flow.` });
  if (m.promoterPct != null) monitors.push({ label: "Ownership", detail: `Promoters hold ${pct(m.promoterPct)}${m.pledgedPct == null ? "; pledge data is unavailable" : `; ${pct(m.pledgedPct)} of promoter shares are pledged`}. Compare with the next shareholding filing.` });

  const strengths = (m.pros ?? []).slice(0, 4);
  const risks = (m.cons ?? []).slice(0, 4);
  const editStyle = { width: "100%", minHeight: 62, resize: "vertical", boxSizing: "border-box", border: "1px solid var(--bdr2)", borderRadius: 8, background: "var(--s1)", color: "var(--t1)", padding: "8px 10px", font: "inherit", fontSize: 12, lineHeight: 1.5 };
  return (
    <section style={card} aria-labelledby="thesis-monitor-title">
      <h3 id="thesis-monitor-title" style={{ fontSize: 15, fontWeight: 650, margin: "0 0 4px", color: "var(--t1)" }}>Investment case &amp; what to monitor</h3>
      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 13, lineHeight: 1.5 }}>Evidence-led prompts from reported figures. These are not forecasts or automatic thesis-break signals.</div>
      <div className="ss-pros-cons-grid">
        <div>
          <div style={{ fontSize: 12, fontWeight: 650, color: "var(--green)", marginBottom: 7 }}>Observed strengths</div>
          {strengths.length ? <ul style={{ margin: 0, paddingLeft: 17, display: "grid", gap: 6 }}>{strengths.map((s, i) => <li key={i} style={{ fontSize: 12, lineHeight: 1.5, color: "var(--t2)" }}>{s}</li>)}</ul> : <div style={{ fontSize: 12, color: "var(--t3)" }}>No strength signal could be established from available filings.</div>}
          {risks.length > 0 && <>
            <div style={{ fontSize: 12, fontWeight: 650, color: "var(--yellow)", margin: "14px 0 7px" }}>Current cautions</div>
            <ul style={{ margin: 0, paddingLeft: 17, display: "grid", gap: 6 }}>{risks.map((s, i) => <li key={i} style={{ fontSize: 12, lineHeight: 1.5, color: "var(--t2)" }}>{s}</li>)}</ul>
          </>}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 650, color: "var(--t1)", marginBottom: 7 }}>What to review in the next filing</div>
          {monitors.length ? <ul style={{ margin: 0, paddingLeft: 17, display: "grid", gap: 8 }}>{monitors.map((x, i) => <li key={i} style={{ fontSize: 12, lineHeight: 1.5, color: "var(--t2)" }}><strong style={{ color: "var(--t1)" }}>{x.label}:</strong> {x.detail}</li>)}</ul> : <div style={{ fontSize: 12, color: "var(--t3)" }}>Too few current observations to build company-specific monitoring prompts.</div>}
        </div>
      </div>
      <div style={{ marginTop: 16, paddingTop: 13, borderTop: "1px solid var(--bdr)" }}>
        <div style={{ fontSize: 12, fontWeight: 650, color: "var(--t1)", marginBottom: 8 }}>Your investment thesis</div>
        <div className="ss-grid-3">
          {[
            ["case", "Why could this business compound?", "Your view on business quality, returns, and reinvestment."],
            ["marketGap", "What might the market be missing?", "Write the evidence that supports your differentiated view."],
            ["breakers", "What would change your view?", "Set measurable conditions to review, based on this company."],
          ].map(([key, label, placeholder]) => (
            <label key={key} style={{ fontSize: 11.5, color: "var(--t2)" }}>{label}<textarea value={thesis[key]} onChange={e => setThesis(s => ({ ...s, [key]: e.target.value }))} placeholder={placeholder} style={{ ...editStyle, display: "block", marginTop: 5 }} /></label>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 7 }}>Saved in this browser on this device; not sent to Stockwise's server.</div>
      </div>
    </section>
  );
}
