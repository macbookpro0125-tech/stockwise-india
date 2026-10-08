import { useEffect, useState } from "react";
import { Calculator } from "lucide-react";

const mono = { fontVariantNumeric: "tabular-nums" };
const money = value => `₹${Math.round(value).toLocaleString("en-IN")}`;
const readCapital = () => {
  try {
    const value = Number(localStorage.getItem("momentumCapital"));
    return value > 0 ? value : 100000;
  } catch {
    return 100000;
  }
};

export default function PhasePositionPlanner({ levels }) {
  const [capital, setCapital] = useState(() => String(readCapital()));
  const [lossLimit, setLossLimit] = useState("");
  const cap = Number(capital);
  const maxLoss = Number(lossLimit);
  const entries = [levels?.p1, levels?.p2, levels?.p3].map(Number).filter(value => value > 0);
  const stop = Number(levels?.stopLoss);

  useEffect(() => {
    try { localStorage.setItem("momentumCapital", String(Number(capital) || 0)); } catch {}
  }, [capital]);

  let result = null;
  if (cap > 0 && entries.length) {
    const perLevelBudget = cap / entries.length;
    const raw = entries.map(entry => ({
      entry,
      budget: perLevelBudget,
      shares: Math.floor(perLevelBudget / entry),
    }));
    const rawLoss = stop > 0
      ? raw.reduce((sum, row) => sum + row.shares * Math.max(0, row.entry - stop), 0)
      : null;
    const scale = maxLoss > 0 && rawLoss > maxLoss ? maxLoss / rawLoss : 1;
    const tranches = raw.map(row => ({ ...row, shares: Math.floor(row.shares * scale) }));
    const invested = tranches.reduce((sum, row) => sum + row.shares * row.entry, 0);
    const lossAtStop = stop > 0
      ? tranches.reduce((sum, row) => sum + row.shares * Math.max(0, row.entry - stop), 0)
      : null;
    result = { tranches, invested, reserve: Math.max(0, cap - invested), lossAtStop, scaled: scale < 1 };
  }

  const field = (label, value, set, hint) => (
    <label style={{ display: "block", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 11.5, color: "var(--t3)", marginBottom: 4 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="number" inputMode="decimal" min="0" step="1000" value={value} onChange={event => set(event.target.value)} className="input-base" style={{ height: 38, fontSize: 13.5, minWidth: 0, width: "100%", boxSizing: "border-box", fontVariantNumeric: "tabular-nums" }} />
      </span>
      {hint && <span style={{ display: "block", fontSize: 10.5, color: "var(--t3)", marginTop: 3 }}>{hint}</span>}
    </label>
  );

  if (!levels || !entries.length) return null;

  return (
    <section aria-labelledby="phase-position-title" style={{ border: "1px solid var(--bdr2)", borderRadius: 12, padding: 18, marginBottom: 12, background: "var(--s2)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <Calculator size={18} style={{ color: "var(--accent)", marginTop: 2, flexShrink: 0 }} />
        <div>
          <h3 id="phase-position-title" style={{ fontSize: 14.5, fontWeight: 650, color: "var(--t1)", margin: 0 }}>Position sizing worksheet</h3>
          <p style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--t3)", margin: "3px 0 0" }}>Illustrates an equal cash split across the three model levels. Enter your own capital and, optionally, the maximum loss you choose.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 10 }}>
        {field("Capital to model (₹)", capital, setCapital)}
        {field("Your maximum planned loss (₹)", lossLimit, setLossLimit, "Optional. Share counts shrink if the modeled stop loss exceeds this amount.")}
      </div>

      {result && (
        <>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", minWidth: 470, borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead><tr>{["Model level", "Price", "Cash budget", "Illustrative shares", "Amount used"].map((label, index) => <th key={label} style={{ textAlign: index === 0 ? "left" : "right", padding: "7px 6px", color: "var(--t3)", fontWeight: 550, borderBottom: "1px solid var(--bdr2)", whiteSpace: "nowrap" }}>{label}</th>)}</tr></thead>
              <tbody>{result.tranches.map((row, index) => (
                <tr key={index}>
                  <td style={{ padding: "8px 6px", color: "var(--t1)", borderBottom: "1px solid var(--bdr)" }}>Level {index + 1}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "var(--t1)", borderBottom: "1px solid var(--bdr)", ...mono }}>{money(row.entry)}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "var(--t2)", borderBottom: "1px solid var(--bdr)", ...mono }}>{money(row.budget)}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "var(--t1)", borderBottom: "1px solid var(--bdr)", ...mono }}>{row.shares.toLocaleString("en-IN")}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "var(--t1)", borderBottom: "1px solid var(--bdr)", ...mono }}>{money(row.shares * row.entry)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8, marginTop: 10 }}>
            {[
              ["Total modeled amount", money(result.invested), "var(--t1)"],
              ["Cash left unallocated", money(result.reserve), "var(--t1)"],
              ["Estimated loss at displayed stop", result.lossAtStop == null ? "—" : `−${money(result.lossAtStop)}`, "var(--red)"],
            ].map(([label, value, color]) => <div key={label} style={{ padding: "9px 10px", border: "1px solid var(--bdr)", borderRadius: 8, background: "var(--s1)" }}><div style={{ fontSize: 10.5, color: "var(--t3)" }}>{label}</div><div style={{ fontSize: 13.5, fontWeight: 650, color, marginTop: 3, ...mono }}>{value}</div></div>)}
          </div>
          {result.scaled && <p style={{ fontSize: 11, color: "var(--yellow)", margin: "8px 0 0", lineHeight: 1.5 }}>The equal-split share counts were reduced to fit your chosen loss limit.</p>}
          {maxLoss > 0 && result.lossAtStop != null && result.lossAtStop > maxLoss && <p style={{ fontSize: 11, color: "var(--yellow)", margin: "8px 0 0", lineHeight: 1.5 }}>Rounding leaves the estimate slightly above your chosen limit; lower the limit or review the share counts.</p>}
        </>
      )}

      <p style={{ fontSize: 10.5, color: "var(--t3)", lineHeight: 1.5, margin: "10px 0 0" }}>Hypothetical arithmetic from the values above, not a recommendation. Assumes all three levels fill and the displayed stop is executed exactly; gaps, slippage, fees and taxes can change the result.</p>
    </section>
  );
}
