import { useEffect, useMemo } from "react";
import { ArrowLeft, X } from "lucide-react";
import PriceChartPanel, { LEVEL_KEYS } from "./PriceChartPanel.jsx";
import { navigate, stockPath } from "./site.jsx";

// A stock's price chart as a page of its own (/chart/TCS). On a phone the
// chart's expand button opens this in a new tab: the whole screen for the
// chart, without the stock page around it. The company name and the model's
// levels come in the address (chartPageUrl in PriceChartPanel.jsx), so the
// page draws the same levels the stock page showed, custom inputs included.
export default function ChartPage({ symbol }) {
  const { name, levels } = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    const vals = (q.get("lv") || "").split(",").map(v => (v === "" ? null : Number(v)));
    const lv = Object.fromEntries(LEVEL_KEYS.map((k, i) => [k, Number.isFinite(vals[i]) && vals[i] > 0 ? vals[i] : null]));
    return { name: q.get("n") || "", levels: LEVEL_KEYS.some(k => lv[k]) ? lv : null };
  }, []);

  useEffect(() => { document.title = `${symbol} chart · Stockwise India`; }, [symbol]);

  // Opened in a new tab, closing it returns to the stock page left open in the
  // tab before; opened any other way (a shared link), there's no tab to return
  // to, so it goes to the stock page here
  const close = () => {
    window.close();
    setTimeout(() => { if (!window.closed) navigate(stockPath(symbol)); }, 150);
  };

  const barBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 40, minWidth: 40, padding: "0 12px", borderRadius: 4, border: "1px solid var(--bdr2)", background: "var(--s3)", color: "var(--t1)", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textDecoration: "none" };

  return (
    // Exactly one screen tall (dvh: a phone's address bar comes and goes)
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--s2)", color: "var(--t1)" }}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "10px 10px 6px", paddingTop: "max(10px, env(safe-area-inset-top))" }}>
        <a href={stockPath(symbol)} onClick={e => { e.preventDefault(); navigate(stockPath(symbol)); }} aria-label={`Back to ${symbol}'s stock page`} style={barBtn}>
          <ArrowLeft size={16} aria-hidden="true" />
        </a>
        <h1 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {symbol}{name && <span style={{ fontWeight: 500, color: "var(--t3)", fontSize: 13 }}> · {name}</span>}
        </h1>
        <button type="button" onClick={close} aria-label="Close the chart" style={barBtn}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <PriceChartPanel symbol={symbol} name={name} levels={levels} page />
    </div>
  );
}
