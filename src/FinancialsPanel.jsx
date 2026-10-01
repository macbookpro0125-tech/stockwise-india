import { useState, useEffect, useRef, useMemo } from "react";

// The original's Financials panel (stock-screener FinancialsPanel.jsx and
// FinancialsChart.jsx): a revenue/profit chart with operating margin on its
// own axis underneath, and the statements as tables. Built from this app's
// own filings (up to six fiscal years) instead of Screener's pages, and drawn
// as plain SVG instead of with the charting library the original used.

const MONO = { fontVariantNumeric: "tabular-nums" };

function fmtCr(n) {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 100000) return `${(n / 100000).toFixed(2)}L`;
  if (a >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n * 100) / 100);
}

const periodLabel = iso => new Date(`${iso}T00:00:00Z`).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const shortLabel = iso => new Date(`${iso}T00:00:00Z`).toLocaleString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

// kind: "cr" (₹ Crore), "pct", "rs" (rupees per share), "x" (times)
const STATEMENTS = {
  profitLoss: [
    ["Sales", "revenueCr", "cr"], ["Expenses", "expensesCr", "cr"], ["Operating Profit", "operatingProfitCr", "cr"],
    ["OPM %", "opm", "pct"], ["Other Income", "otherIncomeCr", "cr"], ["Depreciation", "depreciationCr", "cr"],
    ["Interest", "financeCostsCr", "cr"], ["Profit before tax", "pbtCr", "cr"], ["Net Profit", "profitCr", "cr"],
    ["EPS in Rs", "eps", "rs"],
  ],
  balanceSheet: [
    ["Net worth (equity)", "equityCr", "cr"], ["Borrowings", "debtCr", "cr"], ["Total assets", "totalAssetsCr", "cr"],
    ["Current assets", "currentAssetsCr", "cr"], ["Current liabilities", "currentLiabilitiesCr", "cr"],
  ],
  cashFlow: [
    ["Cash from operations", "ocfCr", "cr"], ["Capital spending", "capexCr", "cr"], ["Free cash flow", "fcfCr", "cr"],
  ],
  ratios: [
    ["ROE %", "roe", "pct"], ["ROCE %", "roce", "pct"], ["OPM %", "opm", "pct"], ["Debt / equity", "debtToEquity", "x"],
  ],
};

function fmtCell(v, kind) {
  if (v == null || !isFinite(v)) return "—";
  if (kind === "pct") return `${v.toFixed(1)}%`;
  if (kind === "rs") return v.toFixed(2);
  if (kind === "x") return v.toFixed(2);
  return fmtCr(v);
}

function StatementTable({ history, rows }) {
  const years = [...history].reverse(); // oldest on the left, as Screener lays it out
  const shown = rows.filter(([, key]) => years.some(y => y[key] != null));
  if (!shown.length) return <div style={{ fontSize: 12, color: "var(--t3)", padding: "20px 0" }}>Not in this company's filings.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 520 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11.5, color: "var(--t3)", borderBottom: "1px solid var(--bdr2)", position: "sticky", left: 0, background: "var(--s2)" }}>Item</th>
            {years.map(y => (
              <th key={y.fyEnd} style={{ textAlign: "right", padding: "8px 10px", fontSize: 10, color: "var(--t3)", whiteSpace: "nowrap", borderBottom: "1px solid var(--bdr2)" }}>{periodLabel(y.fyEnd)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map(([label, key, kind]) => (
            <tr key={key + label}>
              <td style={{ padding: "7px 10px", color: "var(--t2)", whiteSpace: "nowrap", position: "sticky", left: 0, background: "var(--s2)", borderBottom: "1px solid var(--bdr)" }}>{label}</td>
              {years.map(y => (
                <td key={y.fyEnd} style={{ padding: "7px 10px", textAlign: "right", color: y[key] == null ? "var(--t3)" : "var(--t1)", whiteSpace: "nowrap", borderBottom: "1px solid var(--bdr)", ...MONO }}>
                  {fmtCell(y[key], kind)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 8 }}>
        Figures in ₹ Crore unless marked. {years.at(-1)?.scope ? `${years.at(-1).scope} results` : "Results"} from NSE filings; EPS on today's share count.
      </p>
    </div>
  );
}

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(Math.round(el.getBoundingClientRect().width));
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return [ref, w];
}

// Nice round axis ticks covering [min, max]
function ticks(min, max, count = 4) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

const MARGIN = { top: 42, right: 14, bottom: 34, left: 54 };

/**
 * Revenue and profit per year — one measure, one axis, in rupees. Operating
 * margin is a percentage and can't share it (a hidden second scale would put
 * the line by the "500" gridline where that line means ₹500 Cr), so it gets
 * its own plot underneath on the same years.
 */
function FinancialsChart({ points }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const height = 240;
  const showMargin = points.some(p => p.margin != null);

  const layout = useMemo(() => {
    if (!width) return null;
    const innerW = width - MARGIN.left - MARGIN.right, innerH = height - MARGIN.top - MARGIN.bottom;
    const vals = points.flatMap(p => [p.revenue, p.profit]).filter(v => v != null);
    const t = ticks(Math.min(0, ...vals), Math.max(0, ...vals));
    const lo = t[0], hi = t.at(-1);
    const y = v => innerH - ((v - lo) / (hi - lo || 1)) * innerH;
    const band = innerW / points.length;
    const barW = Math.max(3, (band * 0.72) / 2 - 2);
    return { innerW, innerH, t, y, band, barW };
  }, [width, points]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {layout && (
        <svg width={width} height={height} style={{ display: "block", overflow: "visible" }} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="fcRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--green)" stopOpacity="0.95" /><stop offset="100%" stopColor="var(--green)" stopOpacity="0.55" /></linearGradient>
            <linearGradient id="fcProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0.55" /></linearGradient>
          </defs>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {layout.t.map(v => (
              <g key={v}>
                <line x1={0} x2={layout.innerW} y1={layout.y(v)} y2={layout.y(v)} stroke="var(--bdr)" />
                <text x={-6} y={layout.y(v) + 3} fontSize={9} fill="var(--t3)" textAnchor="end" style={MONO}>{fmtCr(v)}</text>
              </g>
            ))}
            {points.map((p, i) => {
              const x0 = i * layout.band + (layout.band - (layout.barW * 2 + 2)) / 2;
              return (
                <g key={p.period} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
                  <rect x={i * layout.band} y={0} width={layout.band} height={layout.innerH} fill="transparent" />
                  {[[p.revenue, "url(#fcRevenue)", 0], [p.profit, "url(#fcProfit)", layout.barW + 2]].map(([v, fill, dx], j) => {
                    // A year the filing didn't give is a gap, never a zero bar
                    if (v == null) return null;
                    const bx = x0 + dx, by = Math.min(layout.y(0), layout.y(v)), bh = Math.max(1, Math.abs(layout.y(0) - layout.y(v)));
                    return (
                      <g key={j}>
                        <rect x={bx} y={by} width={layout.barW} height={bh} rx={3} fill={fill} />
                        {/* Rotated value on the bar, dropped where it would collide */}
                        {layout.barW >= 11 && (
                          <text x={bx + layout.barW / 2} y={by - 5} fontSize={9} fill="var(--t2)" transform={`rotate(-90, ${bx + layout.barW / 2}, ${by - 5})`} style={MONO}>{fmtCr(v)}</text>
                        )}
                      </g>
                    );
                  })}
                  <text x={i * layout.band + layout.band / 2} y={layout.innerH + 16} fontSize={9} fill="var(--t3)" textAnchor="middle">{p.short}</text>
                </g>
              );
            })}
            {layout.t[0] < 0 && <line x1={0} x2={layout.innerW} y1={layout.y(0)} y2={layout.y(0)} stroke="var(--t3)" strokeDasharray="3 3" />}
          </g>
        </svg>
      )}

      {hover != null && layout && (
        <div style={{ position: "absolute", top: 4, left: Math.min(width - 170, Math.max(0, MARGIN.left + hover * layout.band + layout.band / 2 - 80)), width: 160, background: "var(--s3)", border: "1px solid var(--bdr2)", borderRadius: 8, padding: "8px 10px", fontSize: 11, boxShadow: "0 4px 18px rgba(0,0,0,0.35)", pointerEvents: "none" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{points[hover].period}</div>
          {[["Revenue", points[hover].revenue, "var(--green)"], ["Profit", points[hover].profit, "var(--accent)"]].map(([l, v, c]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 10, ...MONO }}>
              <span style={{ color: "var(--t3)" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: c, marginRight: 5 }} />{l}</span>
              <span>{v == null ? "not reported" : `${fmtCr(v)} Cr`}</span>
            </div>
          ))}
          {points[hover].margin != null && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, ...MONO }}>
              <span style={{ color: "var(--t3)" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--yellow)", marginRight: 5 }} />Margin</span>
              <span>{points[hover].margin.toFixed(1)}%</span>
            </div>
          )}
        </div>
      )}

      {showMargin && layout && <MarginChart points={points} width={width} band={layout.band} />}

      <div style={{ display: "flex", gap: 16, fontSize: 10, color: "var(--t3)", marginTop: 2, flexWrap: "wrap" }}>
        {[["Revenue", "var(--green)"], ["Profit", "var(--accent)"], ...(showMargin ? [["Operating margin", "var(--yellow)"]] : [])].map(([l, c]) => (
          <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: c }} />{l}
          </span>
        ))}
        <span style={{ marginLeft: "auto" }}>₹ Crore · margin charted separately in %</span>
      </div>
    </div>
  );
}

function MarginChart({ points, width, band }) {
  const h = 76, top = 6, bottom = 18, innerH = h - top - bottom;
  const vals = points.map(p => p.margin).filter(v => v != null);
  const t = ticks(Math.min(0, ...vals), Math.max(1, ...vals), 2);
  const lo = t[0], hi = t.at(-1);
  const y = v => innerH - ((v - lo) / (hi - lo || 1)) * innerH;
  const drawn = points.map((p, i) => ({ ...p, cx: i * band + band / 2 })).filter(p => p.margin != null);
  return (
    <>
      <div style={{ fontSize: 10, color: "var(--t3)", margin: "6px 0 0 54px" }}>Operating margin %</div>
      <svg width={width} height={h} style={{ display: "block", overflow: "visible" }}>
        <g transform={`translate(${MARGIN.left},${top})`}>
          {t.map(v => (
            <g key={v}>
              <line x1={0} x2={width - MARGIN.left - MARGIN.right} y1={y(v)} y2={y(v)} stroke="var(--bdr)" />
              <text x={-6} y={y(v) + 3} fontSize={9} fill="var(--t3)" textAnchor="end" style={MONO}>{Math.round(v)}%</text>
            </g>
          ))}
          <path d={drawn.map((p, i) => `${i ? "L" : "M"}${p.cx.toFixed(1)},${y(p.margin).toFixed(1)}`).join(" ")} fill="none" stroke="var(--yellow)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {drawn.map(p => <circle key={p.period} cx={p.cx} cy={y(p.margin)} r={2.5} fill="var(--yellow)" />)}
        </g>
      </svg>
    </>
  );
}

export default function FinancialsPanel({ history }) {
  const [tab, setTab] = useState("summary");
  if (!history?.length) return null;

  const points = [...history].reverse()
    .map(h => ({ period: periodLabel(h.fyEnd), short: shortLabel(h.fyEnd), revenue: h.revenueCr, profit: h.profitCr, margin: h.opm }))
    // Years with nothing reported are dropped, not charted as zeros
    .filter(p => p.revenue != null || p.profit != null);

  const TABS = [
    { id: "summary", label: "Summary" },
    { id: "profitLoss", label: "Profit & Loss" },
    { id: "balanceSheet", label: "Balance Sheet" },
    { id: "cashFlow", label: "Cashflow" },
    { id: "ratios", label: "Ratios" },
  ];

  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--s2)", padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 12, letterSpacing: "-0.01em" }}>Financials</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            height: 30, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${tab === t.id ? "var(--accent)" : "var(--bdr2)"}`,
            background: tab === t.id ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--s3)",
            color: tab === t.id ? "var(--accent)" : "var(--t2)",
            transition: "all 120ms",
          }}>{t.label}</button>
        ))}
      </div>
      {tab === "summary"
        ? (points.length >= 2
          ? <FinancialsChart points={points} />
          : <div style={{ fontSize: 12, color: "var(--t3)", padding: "24px 0" }}>Not enough reported years to chart. The tables show everything available.</div>)
        : <StatementTable history={history} rows={STATEMENTS[tab]} />}
    </div>
  );
}
