import { Fragment, useState, useEffect, useRef, useMemo } from "react";
import { profitSteps, cashSteps, cashLines, balanceParts, materialsOf, ttmOf } from "./statements.js";
import { ChartColumn } from "lucide-react";
import { Bridge, BalanceMap, FundFlow, YearChips, fmtCrShort } from "./StatementCharts.jsx";

// The original's Financials panel (stock-screener FinancialsPanel.jsx and
// FinancialsChart.jsx): a revenue/profit chart with operating margin on its
// own axis underneath, and the statements as tables. Built from this app's
// own filings (up to eight fiscal years, and the last twelve quarters) instead
// of Screener's pages, and drawn
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
  // In detail (24 Oct 2026): the expense lines under sales, each where the
  // filing has it; "  " indents a line that's part of the one above
  profitLoss: [
    ["Sales", "revenueCr", "cr"],
    ["  Raw materials & goods bought", "materialsBoughtCr", "cr"], ["  Change in stock", "inventoryChangeCr", "cr"],
    ["  Employee costs", "employeesCr", "cr"], ["  Other expenses", "otherExpensesCr", "cr"],
    ["Operating costs", "opCostsCr", "cr"], ["Material cost %", "materialCostPct", "pct"], ["Operating Profit", "operatingProfitCr", "cr"],
    ["OPM %", "opm", "pct"], ["Other Income", "otherIncomeCr", "cr"], ["Interest", "financeCostsCr", "cr"],
    ["Profit before depreciation & tax", "pbdtCr", "cr"], ["Depreciation", "depreciationCr", "cr"],
    ["Exceptional items", "exceptionalCr", "cr"], ["Profit before tax", "pbtCr", "cr"], ["Tax", "taxCr", "cr"], ["Tax rate %", "taxRate", "pct"], ["Net Profit", "profitCr", "cr"],
    ["Net margin %", "netMargin", "pct"], ["EPS in Rs", "eps", "rs"],
    ["Number of shares (Cr)", "sharesCr", "rs"], ["Dividend payout %", "payoutPct", "pct"],
  ],
  balanceSheet: [
    ["Share capital", "shareCapitalCr", "cr"], ["Reserves", "otherEquityCr", "cr"], ["Net worth (equity)", "equityCr", "cr"],
    ["  of which outside shareholders", "minorityCr", "cr"],
    ["Long-term borrowings", "ltDebtCr", "cr"], ["Short-term borrowings", "borrowingsCurrentCr", "cr"], ["Borrowings", "debtCr", "cr"],
    // Rent owed on shops, offices, aircraft — itemised in filings from FY26
    ["Lease liabilities", "leasesCr", "cr"], ["Owed to suppliers", "payablesCr", "cr"],
    ["Current liabilities", "currentLiabilitiesCr", "cr"], ["Non-current liabilities", "nonCurrentLiabilitiesCr", "cr"],
    ["Total liabilities & equity", "totalAssetsCr", "cr"],
    ["Factories & equipment", "ppeCr", "cr"], ["Work in progress (capex)", "cwipCr", "cr"], ["Goodwill & intangibles", "intangiblesAllCr", "cr"],
    ["Intangibles under development", "intangiblesUnderDevCr", "cr"],
    ["Long-term investments", "investmentsNcCr", "cr"], ["Inventory", "inventoriesCr", "cr"], ["Owed by customers", "receivablesCr", "cr"],
    ["Short-term investments", "currentInvestmentsCr", "cr"], ["Cash & bank", "cashBankCr", "cr"],
    ["Current assets", "currentAssetsCr", "cr"], ["Non-current assets", "nonCurrentAssetsCr", "cr"],
    ["Total assets", "totalAssetsCr", "cr"],
  ],
  cashFlow: [
    ["Cash from operations", "ocfCr", "cr"], ["  Tax paid", "taxesPaidOutCr", "cr"],
    ["Cash from investing", "investingCfCr", "cr"], ["  Capital spending", "capexOutCr", "cr"], ["  From selling assets", "assetSalesCr", "cr"],
    ["Cash from financing", "financingCfCr", "cr"], ["  New borrowing", "borrowedCr", "cr"], ["  Loans repaid", "repaidOutCr", "cr"],
    ["  Dividends paid", "dividendsOutCr", "cr"], ["  Interest paid", "interestOutCr", "cr"],
    ["Net change in cash", "netCashChangeCr", "cr"], ["Free cash flow", "fcfCr", "cr"],
  ],
  // Same lines as Profit & Loss, quarter by quarter, plus each quarter
  // against the same one a year earlier
  quarterly: [
    ["Sales", "revenueCr", "cr"], ["Expenses", "expensesCr", "cr"],
    ["  Raw materials & goods bought", "materialsBoughtCr", "cr"], ["  Change in stock", "inventoryChangeCr", "cr"],
    ["  Employee costs", "employeesCr", "cr"], ["  Other expenses", "otherExpensesCr", "cr"],
    ["Operating Profit", "operatingProfitCr", "cr"], ["OPM %", "opm", "pct"], ["Other Income", "otherIncomeCr", "cr"],
    ["Interest", "financeCostsCr", "cr"], ["Profit before depreciation & tax", "pbdtCr", "cr"], ["Depreciation", "depreciationCr", "cr"],
    ["Exceptional items", "exceptionalCr", "cr"], ["Profit before tax", "pbtCr", "cr"], ["Tax", "taxCr", "cr"], ["Net Profit", "profitCr", "cr"],
    ["Net margin %", "netMargin", "pct"], ["EPS in Rs", "eps", "rs"], ["Sales vs a year ago", "salesYoY", "pct"], ["Profit vs a year ago", "profitYoY", "pct"],
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

// A row's figures as a small bar chart, oldest to newest, opened from the
// row's chart button; bars grow in, a loss or outflow in red
function TrendBars({ cols, rowKey, kind }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id); }, []);
  const pts = cols.map(c => ({ label: c.label ?? shortLabel(c.fyEnd), v: c[rowKey] })).filter(p => p.v != null && isFinite(p.v));
  if (pts.length < 2) return <div style={{ fontSize: 11.5, color: "var(--t3)", padding: "8px 0" }}>Not enough years to chart.</div>;
  const hi = Math.max(0, ...pts.map(p => p.v)), lo = Math.min(0, ...pts.map(p => p.v));
  const span = hi - lo || 1;
  const first = pts.find(p => !String(p.label).includes("TTM")), last = [...pts].reverse().find(p => !String(p.label).includes("TTM"));
  const n = pts.filter(p => !String(p.label).includes("TTM")).length - 1;
  const cagr = kind === "cr" && n >= 2 && first.v > 0 && last.v > 0 ? (Math.pow(last.v / first.v, 1 / n) - 1) * 100 : null;
  return (
    <div className="trend-bars">
      <div className="trend-plot" style={{ "--zero": `${(hi / span) * 100}%` }}>
        {pts.map((p, i) => (
          <div key={p.label} className="trend-col" title={`${p.label}: ${fmtCell(p.v, kind)}`}>
            <span className="trend-val" style={MONO}>{fmtCell(p.v, kind)}</span>
            <span className="trend-area">
              <span className="trend-bar" style={{
                top: p.v >= 0 ? `${((hi - p.v) / span) * 100}%` : `${(hi / span) * 100}%`, height: `${Math.max((Math.abs(p.v) / span) * 100, 0.8)}%`,
                background: p.v < 0 ? "var(--red)" : String(p.label).includes("TTM") ? "color-mix(in srgb, var(--accent) 55%, transparent)" : "var(--accent)",
                transform: shown ? "none" : "scaleY(0)", transformOrigin: p.v >= 0 ? "bottom" : "top",
                transition: `transform 520ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 45}ms`,
              }} />
            </span>
            <span className="trend-x">{p.label}</span>
          </div>
        ))}
      </div>
      {cagr != null && <div className="trend-note">{cagr >= 0 ? "Grew" : "Shrank"} {Math.abs(cagr).toFixed(1)}% a year over {n} years.</div>}
    </div>
  );
}

function StatementTable({ history, rows, note, extraCols = [] }) {
  const [open, setOpen] = useState(null);
  const years = [...[...history].reverse(), ...extraCols]; // oldest on the left, as Screener lays it out; TTM last
  const shown = rows.filter(([, key]) => years.some(y => y[key] != null));
  if (!shown.length) return <div style={{ fontSize: 12, color: "var(--t3)", padding: "20px 0" }}>Not in this company's filings.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 520 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11.5, color: "var(--t3)", borderBottom: "1px solid var(--bdr2)", position: "sticky", left: 0, background: "var(--s2)" }}>Item</th>
            {years.map(y => (
              <th key={y.label ?? y.fyEnd} style={{ textAlign: "right", padding: "8px 10px", fontSize: 10, color: y.ttm ? "var(--accent)" : "var(--t3)", whiteSpace: "nowrap", borderBottom: "1px solid var(--bdr2)", background: y.ttm ? "color-mix(in srgb, var(--accent) 6%, transparent)" : undefined }} title={y.ttm ? `The last four quarters, to ${periodLabel(y.fyEnd)}` : undefined}>{y.label ?? periodLabel(y.fyEnd)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map(([label, key, kind]) => {
            const id = key + label, isOpen = open === id;
            return (
              <Fragment key={id}>
                <tr className={`fin-row${isOpen ? " open" : ""}`}>
                  <td style={{ padding: label.startsWith("  ") ? "4px 6px 4px 18px" : "4px 6px", color: label.startsWith("  ") ? "var(--t3)" : "var(--t2)", fontSize: label.startsWith("  ") ? 11.5 : undefined, whiteSpace: "nowrap", position: "sticky", left: 0, background: "var(--s2)", borderBottom: "1px solid var(--bdr)", zIndex: 1 }}>
                    <button type="button" className="fin-label" onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen} title="Show as a chart">
                      <span>{label.trim()}</span><ChartColumn size={12} aria-hidden="true" className="fin-chart-icon" />
                    </button>
                  </td>
                  {years.map(y => (
                    <td key={y.label ?? y.fyEnd} style={{ padding: "7px 10px", textAlign: "right", color: y[key] == null ? "var(--t3)" : "var(--t1)", whiteSpace: "nowrap", borderBottom: "1px solid var(--bdr)", background: y.ttm ? "color-mix(in srgb, var(--accent) 6%, transparent)" : undefined, ...MONO }}>
                      {fmtCell(y[key], kind)}
                    </td>
                  ))}
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={years.length + 1} style={{ padding: 0, borderBottom: "1px solid var(--bdr)" }}>
                      <div className="fin-trend"><TrendBars cols={years} rowKey={key} kind={kind} /></div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 8 }}>
        Figures in ₹ Crore unless marked. Tap a line to see it as a chart.{extraCols.some(c => c.ttm) ? " TTM is the last four quarters added up." : ""} {years.at(-1)?.scope ? `${years.at(-1).scope} results` : "Results"} from NSE filings; EPS on today's share count.{note ? ` ${note}` : ""}
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
          <div style={{ fontWeight: 500, marginBottom: 4 }}>{points[hover].period}</div>
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

// The few lines worked out from the filed ones, for the tables: payments
// shown as outflows (filed as positive amounts)
const neg = v => (v == null ? null : -Math.abs(v));
const withDerived = h => ({
  ...h,
  materialsAllCr: materialsOf(h),
  materialsBoughtCr: h.materialsCr != null || h.purchasesCr != null ? (h.materialsCr ?? 0) + (h.purchasesCr ?? 0) : null,
  materialCostPct: materialsOf(h) != null && h.revenueCr > 0 ? (materialsOf(h) / h.revenueCr) * 100 : null,
  pbdtCr: h.pbtCr != null && h.depreciationCr != null ? h.pbtCr + h.depreciationCr : null,
  // dividends paid in the year (the cash-flow line) against its profit
  payoutPct: h.dividendsPaidCr != null && (h.profitOwnersCr ?? h.profitCr) > 0 ? (Math.abs(h.dividendsPaidCr) / (h.profitOwnersCr ?? h.profitCr)) * 100 : null,
  opCostsCr: h.expensesCr != null ? h.expensesCr - (h.depreciationCr ?? 0) - (h.financeCostsCr ?? 0) : null,
  taxRate: h.taxCr != null && h.pbtCr > 0 ? (h.taxCr / h.pbtCr) * 100 : null,
  netMargin: h.profitCr != null && h.revenueCr > 0 ? (h.profitCr / h.revenueCr) * 100 : null,
  intangiblesAllCr: h.goodwillCr != null || h.intangiblesCr != null ? (h.goodwillCr ?? 0) + (h.intangiblesCr ?? 0) : null,
  taxesPaidOutCr: neg(h.taxesPaidCr), capexOutCr: neg(h.capexCr), repaidOutCr: neg(h.repaidCr),
  dividendsOutCr: neg(h.dividendsPaidCr), interestOutCr: neg(h.interestPaidCr),
});

// A statement's picture for one year, with the years to pick from (newest
// first); nothing when no year has enough lines for one
function YearPicture({ history, tab }) {
  const pictured = history.filter(h => (tab === "profitLoss" ? profitSteps(h) : tab === "cashFlow" ? cashSteps(h) : balanceParts(h)));
  const [at, setAt] = useState(0);
  if (!pictured.length) return null;
  const h = pictured[Math.min(at, pictured.length - 1)];
  const fy = `FY${h.fyEnd.slice(2, 4)}`;
  return (
    <div className="stm-picture">
      <YearChips years={pictured} at={Math.min(at, pictured.length - 1)} onPick={setAt} />
      {tab === "profitLoss" && <Bridge steps={profitSteps(h)} caption={`How ${fy}'s sales of ${fmtCrShort(h.revenueCr)} became a net profit of ${fmtCrShort(h.profitCr)}: green adds, red takes away.`} />}
      {tab === "balanceSheet" && <BalanceMap parts={balanceParts(h)} />}
      {tab === "cashFlow" && (
        <>
          <Bridge steps={cashSteps(h)} caption={`Cash that came in (green) or went out (red) in ${fy}, and what that did to the cash it holds.`} />
          {cashLines(h).length > 0 && (
            <ul className="stm-lines">
              {cashLines(h).map(l => <li key={l.label}><span>{l.label}</span><span style={{ color: l.value >= 0 ? "var(--green)" : "var(--red)", ...MONO }}>{l.value >= 0 ? "+" : ""}{fmtCrShort(l.value)}</span></li>)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default function FinancialsPanel({ history: filed, quarters: filedQuarters = [], template }) {
  const [tab, setTab] = useState("summary");
  const history = useMemo(() => (filed ?? []).map(withDerived), [filed]);
  const quarters = useMemo(() => (filedQuarters ?? []).map(withDerived), [filedQuarters]);
  const ttm = useMemo(() => { const t = ttmOf(filedQuarters); return t ? withDerived(t) : null; }, [filedQuarters]);
  if (!history?.length) return null;

  const points = [...history].reverse()
    .map(h => ({ period: periodLabel(h.fyEnd), short: shortLabel(h.fyEnd), revenue: h.revenueCr, profit: h.profitCr, margin: h.opm }))
    // Years with nothing reported are dropped, not charted as zeros
    .filter(p => p.revenue != null || p.profit != null);

  const TABS = [
    { id: "summary", label: "Summary" },
    ...(quarters.length ? [{ id: "quarterly", label: "Quarterly" }] : []),
    { id: "profitLoss", label: "Profit & Loss" },
    { id: "balanceSheet", label: "Balance Sheet" },
    { id: "cashFlow", label: "Cashflow" },
    { id: "ratios", label: "Ratios" },
  ];

  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--s2)", padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)", marginBottom: 12, letterSpacing: "-0.01em" }}>Financials</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            height: 30, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 400, cursor: "pointer",
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
        : tab === "quarterly"
          ? <StatementTable history={quarters} rows={STATEMENTS.quarterly} note="Each quarter is its own three months; the last two columns compare with the same quarter a year earlier." />
          : <>
            {["profitLoss", "balanceSheet", "cashFlow"].includes(tab) && <YearPicture key={tab} history={history} tab={tab} />}
            {tab === "cashFlow" && <FundFlow history={history} />}
            <StatementTable
            history={history}
            extraCols={tab === "profitLoss" && ttm ? [ttm] : []}
            rows={template === "BANKING" && tab === "ratios" ? STATEMENTS.ratios.filter(([label]) => label !== "Debt / equity") : STATEMENTS[tab]}
            note={template === "BANKING" && tab === "ratios" ? "Debt/equity is not shown for banks because deposits are operating funding, not comparable corporate borrowing." : null}
          />
          </>}
    </div>
  );
}
