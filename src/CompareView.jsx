import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { api } from "./api.js";
import { QualityBadge, overallTone } from "./ResearchBadges.jsx";

// Ported from stock-screener's src/components/CompareView.jsx: up to four
// stocks side by side — the research score and its groups, fundamentals and
// price levels from the Discover table, technicals fetched per stock.

function Sparkline({ prices }) {
  if (!prices?.length) return <span style={{ color: "var(--t3)", fontSize: 11 }}>—</span>;
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const W = 80, H = 28;
  const pts = prices.map((p, i) => `${((i / (prices.length - 1)) * W).toFixed(1)},${(H - ((p - min) / range) * (H - 2) - 1).toFixed(1)}`).join(" ");
  const up = prices[prices.length - 1] >= prices[0];
  return (
    <svg width={W} height={H}>
      <polyline points={pts} fill="none" stroke={up ? "var(--green)" : "var(--red)"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const SETUP_COLOR = { momentum: "var(--green)", pullback: "var(--accent)", base: "var(--yellow)", extended: "var(--yellow)", correction: "var(--red)", developing: "var(--t2)" };
const rs = v => (v ? `₹${Math.round(v).toLocaleString("en-IN")}` : "—");

// A score with its word ("52 Fair"), or a dash when it couldn't be scored
const scored = (v, word, color = "var(--t3)") => (v == null
  ? <span style={{ color: "var(--t3)" }}>—</span>
  : <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(v)} <span style={{ fontSize: 11, fontWeight: 500, color }}>{word}</span></span>);
const GROUP_ROWS = [["business", "Business quality"], ["earnings", "Earnings quality"], ["balance", "Balance sheet"], ["governance", "Governance"], ["growth", "Growth"]];
const RESEARCH_ROWS = [
  { key: "quality", label: "Quality score", fmt: s => <QualityBadge research={s.research} /> },
  { key: "overall", label: "Overall research score", fmt: s => scored(s.research?.overall, s.research?.stance, overallTone(s.research?.overall).color) },
  ...GROUP_ROWS.map(([id, label]) => ({
    key: id, label,
    fmt: s => (id === "balance" && s.lender ? <span style={{ color: "var(--t3)", fontWeight: 500, fontSize: 12 }}>Not scored for lenders</span> : scored(s.research?.groups?.[id], "/100")),
  })),
  { key: "valuation", label: "Valuation", fmt: s => scored(s.research?.valuation, s.research?.valuationLabel) },
  { key: "technical", label: "Technical setup", fmt: s => scored(s.research?.technical, s.research?.technicalLabel) },
  { key: "risk", label: "Risk (higher = riskier)", fmt: s => scored(s.research?.risk, s.research?.riskLabel) },
];

const ROW_METRICS = [
  { key: "cmp", label: "CMP (₹)", fmt: s => rs(s.cmp) },
  { key: "pe", label: "P/E", fmt: s => (s.pe ? s.pe.toFixed(1) : "—") },
  { key: "roce", label: "ROCE %", fmt: s => (s.roce != null ? `${s.roce.toFixed(1)}%` : "—") },
  { key: "mcap", label: "Mkt Cap (Cr)", fmt: s => (s.marketCapCr ? (s.marketCapCr >= 1000 ? `${(s.marketCapCr / 1000).toFixed(1)}K` : Math.round(s.marketCapCr)) : "—") },
  { key: "divYield", label: "Div Yield", fmt: s => (s.divYield ? `${s.divYield.toFixed(1)}%` : "—") },
  { key: "p1", label: "Phase 1 level", fmt: s => rs(s.safeBuyPrice) },
  { key: "p3", label: "Phase 3 level", fmt: s => rs(s.p3) },
  { key: "stopLoss", label: "Stop-loss level", fmt: s => rs(s.stopLoss) },
  { key: "target", label: "Upper level (FV+10%)", fmt: s => rs(s.target) },
];

const TECH_METRICS = [
  { key: "setup", label: "Setup State", fmt: t => (t?.setupState ? t.setupState.charAt(0).toUpperCase() + t.setupState.slice(1) : "—") },
  { key: "ema", label: "EMA Signal", fmt: t => (t?.emaSignal ? (t.emaSignal === "bullish" ? "▲ Bullish" : "▼ Bearish") : "—") },
  { key: "ema9", label: "9 EMA", fmt: t => (t?.ema9 ? `₹${t.ema9.toLocaleString("en-IN")}` : "—") },
  { key: "ema20", label: "20 EMA", fmt: t => (t?.ema20 ? `₹${t.ema20.toLocaleString("en-IN")}` : "—") },
  { key: "rsi", label: "RSI-14", fmt: t => t?.rsi14 ?? "—" },
  { key: "vs20", label: "% vs 20 EMA", fmt: t => (t?.pctAboveEma20 != null ? `${t.pctAboveEma20 > 0 ? "+" : ""}${t.pctAboveEma20}%` : "—") },
  { key: "ret20", label: "Return 20D", fmt: t => (t?.return20d != null ? `${t.return20d > 0 ? "+" : ""}${t.return20d}%` : "—") },
  { key: "ret60", label: "Return 60D", fmt: t => (t?.return60d != null ? `${t.return60d > 0 ? "+" : ""}${t.return60d}%` : "—") },
  { key: "spark", label: "60D Chart", isSparkline: true },
];

export default function CompareView({ stocks, onClose }) {
  const [techData, setTechData] = useState({});
  const [techLoading, setTechLoading] = useState({});

  useEffect(() => {
    for (const s of stocks) {
      if (techData[s.symbol] || techLoading[s.symbol]) continue;
      setTechLoading(p => ({ ...p, [s.symbol]: true }));
      api.panel(s.symbol, "technicals")
        .then(j => setTechData(p => ({ ...p, [s.symbol]: j })))
        .catch(() => {})
        .finally(() => setTechLoading(p => ({ ...p, [s.symbol]: false })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks]);

  const cols = `180px repeat(${stocks.length}, minmax(140px, 1fr))`;
  const section = { padding: "8px 16px 4px", fontSize: 11.5, fontWeight: 600, color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 5%, transparent)", borderBottom: "1px solid var(--bdr)" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "color-mix(in srgb, var(--bg) 96%, transparent)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)", overflowY: "auto", padding: "20px 16px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--t1)", margin: 0 }}>Compare stocks ({stocks.length})</h2>
          <button onClick={onClose} className="btn-ghost" style={{ height: 34 }}><X size={15} /> Close</button>
        </div>

        <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bdr2)", overflowX: "auto", boxShadow: "var(--sh-md)" }}>
          <div style={{ minWidth: 180 + stocks.length * 140 }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--bdr)" }}>
              <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--t3)", fontWeight: 600 }}>Metric</div>
              {stocks.map(s => (
                <div key={s.symbol} style={{ padding: "12px 14px", borderLeft: "1px solid var(--bdr)", background: "var(--surf)" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>{s.symbol}</div>
                </div>
              ))}
            </div>

            <div style={section}>Research score</div>
            {RESEARCH_ROWS.map(row => (
              <div key={row.key} style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--bdr)" }}>
                <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--t2)", display: "flex", alignItems: "center" }}>{row.label}</div>
                {stocks.map(s => (
                  <div key={s.symbol} style={{ padding: "10px 14px", borderLeft: "1px solid var(--bdr)", fontSize: 13, fontWeight: 600, color: "var(--t1)", display: "flex", alignItems: "center" }}>{row.fmt(s)}</div>
                ))}
              </div>
            ))}

            <div style={section}>Fundamentals</div>
            {ROW_METRICS.map(row => (
              <div key={row.key} style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--bdr)" }}>
                <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--t2)", display: "flex", alignItems: "center" }}>{row.label}</div>
                {stocks.map(s => (
                  <div key={s.symbol} style={{ padding: "10px 14px", borderLeft: "1px solid var(--bdr)", fontSize: 13, fontWeight: 600, color: "var(--t1)", display: "flex", alignItems: "center" }}>{row.fmt(s)}</div>
                ))}
              </div>
            ))}

            <div style={section}>Technical (9 EMA / 20 EMA)</div>
            {TECH_METRICS.map(row => (
              <div key={row.key} style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--bdr)" }}>
                <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--t2)", display: "flex", alignItems: "center" }}>{row.label}</div>
                {stocks.map(s => {
                  const tech = techData[s.symbol];
                  let content;
                  if (techLoading[s.symbol]) content = <span style={{ color: "var(--t3)", fontSize: 11 }}>loading…</span>;
                  else if (!tech) content = <span style={{ color: "var(--t3)" }}>—</span>;
                  else if (row.isSparkline) content = <Sparkline prices={tech.sparkline} />;
                  else {
                    const val = row.fmt(tech);
                    const color = row.key === "ema" ? (tech.emaSignal === "bullish" ? "var(--green)" : "var(--red)")
                      : row.key === "setup" ? SETUP_COLOR[tech.setupState]
                        : ["vs20", "ret20", "ret60"].includes(row.key) ? (parseFloat(val) >= 0 ? "var(--green)" : "var(--red)")
                          : row.key === "rsi" ? (tech.rsi14 > 70 ? "var(--red)" : tech.rsi14 < 30 ? "var(--green)" : "var(--t1)")
                            : "var(--t1)";
                    content = <span style={{ color }}>{val}</span>;
                  }
                  return <div key={s.symbol} style={{ padding: "10px 14px", borderLeft: "1px solid var(--bdr)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>{content}</div>;
                })}
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", marginTop: 16 }}>
          Technical data from Yahoo Finance. Fundamentals from NSE filings. Educational purposes only.
        </p>
      </div>
    </div>
  );
}
