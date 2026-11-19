import { useEffect, useState } from "react";
import { Calculator } from "lucide-react";
import { planPosition } from "./positionPlan.js";

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

// Arithmetic on the user's own levels (myLevels.js): their capital, split
// across their three levels as they choose (equal to start), and the loss if
// their stop were reached. Shown only while they have levels.
export default function PhasePositionPlanner({ levels }) {
  const [capital, setCapital] = useState(() => String(readCapital()));
  const [lossLimit, setLossLimit] = useState("");
  const [split, setSplit] = useState(["34", "33", "33"]);
  const { entries, stopAbove, result } = planPosition({ capital, maxLoss: lossLimit, levels, split });

  useEffect(() => {
    try { localStorage.setItem("momentumCapital", String(Number(capital) || 0)); } catch {}
  }, [capital]);

  const field = (label, value, set, hint) => (
    <label style={{ display: "block", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 12, color: "var(--t3)", marginBottom: 4 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="number" inputMode="decimal" min="0" step="1000" value={value} onChange={event => set(event.target.value)} className="input-base" style={{ height: 38, fontSize: 14, minWidth: 0, width: "100%", boxSizing: "border-box", fontVariantNumeric: "tabular-nums" }} />
      </span>
      {hint && <span style={{ display: "block", fontSize: 11, color: "var(--t3)", marginTop: 3 }}>{hint}</span>}
    </label>
  );

  if (!levels || !entries.length) return null;

  return (
    <section aria-labelledby="phase-position-title" style={{ border: "1px solid var(--bdr2)", borderRadius: 12, padding: 18, marginBottom: 12, background: "var(--s2)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <Calculator size={18} style={{ color: "var(--accent)", marginTop: 2, flexShrink: 0 }} />
        <div>
          <h3 id="phase-position-title" style={{ fontSize: 14, fontWeight: 400, color: "var(--t1)", margin: 0 }}>Position sizing worksheet</h3>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--t3)", margin: "3px 0 0" }}>Arithmetic on your own levels (set in Your price levels below): your capital, split across your three levels the way you choose, and the loss if your stop were reached.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 10 }}>
        {field("Capital to model (₹)", capital, setCapital)}
        {field("Your maximum planned loss (₹)", lossLimit, setLossLimit, "Optional. Share counts shrink if the loss at your stop exceeds this amount.")}
      </div>
      <div style={{ marginTop: 10 }}>
        <span style={{ display: "block", fontSize: 12, color: "var(--t3)", marginBottom: 4 }}>How much of the capital goes to each level (parts — 1, 1, 1 is equal)</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {entries.map(row => (
            <label key={row.level} style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 11, color: "var(--t3)", marginBottom: 3, ...mono }}>Level {row.level} · {money(row.entry)}</span>
              <input type="number" inputMode="decimal" min="0" step="1" aria-label={`Part at level ${row.level}`} value={split[row.level - 1]} onChange={event => setSplit(prev => prev.map((v, j) => (j === row.level - 1 ? event.target.value : v)))} className="input-base" style={{ height: 34, fontSize: 13, width: 96, boxSizing: "border-box", ...mono }} />
            </label>
          ))}
        </div>
      </div>
      {stopAbove.length > 0 && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: "10px 0 0", lineHeight: 1.5 }}>Your stop ({money(Number(levels.stopLoss))}) is at or above level {stopAbove.join(" and ")}. A stop should sit below every price you buy at — change it in Your price levels below.</p>}

      {result && (
        <>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", minWidth: 300, borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{["Level", "Shares", "Amount used", "Loss at stop"].map((label, index) => <th key={label} style={{ textAlign: index === 0 ? "left" : "right", padding: "7px 6px", color: "var(--t3)", fontWeight: 400, borderBottom: "1px solid var(--bdr2)", whiteSpace: "nowrap" }}>{label}</th>)}</tr></thead>
              <tbody>{result.tranches.map(row => (
                <tr key={row.level}>
                  <td style={{ padding: "8px 6px", color: "var(--t1)", borderBottom: "1px solid var(--bdr)", whiteSpace: "nowrap" }}>{row.level}<span style={{ color: "var(--t3)", ...mono }}> · {money(row.entry)}</span></td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "var(--t1)", borderBottom: "1px solid var(--bdr)", ...mono }}>{row.shares.toLocaleString("en-IN")}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "var(--t1)", borderBottom: "1px solid var(--bdr)", ...mono }}>{money(row.used)}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "var(--red)", borderBottom: "1px solid var(--bdr)", ...mono }}>{row.loss == null ? "—" : row.loss > 0 ? `−${money(row.loss)}` : money(0)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8, marginTop: 10 }}>
            {[
              ["Total modeled amount", money(result.invested), "var(--t1)"],
              ["Cash left unallocated", money(result.reserve), "var(--t1)"],
              ["Estimated loss at your stop", result.lossAtStop == null ? "Set a stop to see this" : <>−{money(result.lossAtStop)}<span style={{ display: "block", fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{result.lossPct.toFixed(1)}% of your capital</span></>, result.lossAtStop == null ? "var(--t3)" : "var(--red)"],
            ].map(([label, value, color]) => <div key={label} style={{ padding: "9px 10px", border: "1px solid var(--bdr)", borderRadius: 8, background: "var(--s1)" }}><div style={{ fontSize: 11, color: "var(--t3)" }}>{label}</div><div style={{ fontSize: 14, fontWeight: 400, color, marginTop: 3, ...mono }}>{value}</div></div>)}
          </div>
          {result.scaled && <p style={{ fontSize: 11, color: "var(--yellow)", margin: "8px 0 0", lineHeight: 1.5 }}>Share counts were cut so the loss at your stop stays within {money(Number(lossLimit))}; the rest stays as unallocated cash.</p>}
          {result.tooSmall.length > 0 && <p style={{ fontSize: 11, color: "var(--yellow)", margin: "8px 0 0", lineHeight: 1.5 }}>The cash for level {result.tooSmall.join(" and ")} is less than one share's price, so it buys none — raise the capital or give that level more parts.</p>}
        </>
      )}

      <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5, margin: "10px 0 0" }}>Hypothetical arithmetic on the numbers you entered, not a recommendation. Assumes all three levels fill and your stop is executed exactly; gaps, slippage, fees and taxes can change the result. It does not account for your existing holdings or portfolio exposure.</p>
    </section>
  );
}
