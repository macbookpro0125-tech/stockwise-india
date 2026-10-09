import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, LoaderCircle, Printer } from "lucide-react";
import { api } from "./api.js";

const MONO = { fontVariantNumeric: "tabular-nums" };
const panel = { background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 16 };
const bound = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => value == null || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const money = value => value == null || !Number.isFinite(value) ? "—" : `₹${Math.round(value).toLocaleString("en-IN")}`;
const pct = value => value == null || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
const cr = value => value == null || !Number.isFinite(value) ? "—" : `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })} cr`;
const dateLabel = value => value ? new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "date unavailable";

function referencePrice(item) {
  return finite(item?.data?.quote?.cmp) ?? finite(item?.data?.metrics?.close) ?? finite(item?.data?.close?.price) ?? finite(item?.stock?.cmp);
}

function assumptionBasis(metrics, price) {
  const growth = metrics?.epsGrowth5y != null ? "reported 5-year EPS CAGR"
    : metrics?.epsGrowth3y != null ? "reported 3-year EPS CAGR"
      : metrics?.growthBasis ?? "0% EPS-growth fallback";
  const pe = metrics?.medianPe != null ? "5-year median P/E"
    : metrics?.valuationPe != null ? "valuation P/E"
      : metrics?.pe != null ? "current P/E"
        : (finite(metrics?.valuationEps) ?? finite(metrics?.eps)) > 0 && price > 0 ? "current price ÷ normalized EPS"
          : "manual P/E assumption";
  return `Base EPS growth starts from ${growth}; base P/E uses ${pe}.`;
}

function defaultAssumptions(metrics, price) {
  const sourceGrowth = metrics?.epsGrowth5y ?? metrics?.epsGrowth3y ?? metrics?.growthForValuation ?? 0;
  const baseGrowth = bound(Math.round(finite(sourceGrowth) ?? 0), -10, 30);
  const eps = finite(metrics?.valuationEps) ?? finite(metrics?.eps);
  const historyPe = finite(metrics?.medianPe) ?? finite(metrics?.valuationPe) ?? finite(metrics?.pe) ?? (eps > 0 && price > 0 ? price / eps : 0);
  return {
    bearGrowth: bound(Math.round(Math.min(0, baseGrowth - 25)), -30, 0),
    baseGrowth,
    bullGrowth: Math.round(baseGrowth + 5),
    bearPe: Math.max(1, Math.round(historyPe * 0.5)),
    basePe: Math.max(1, Math.round(historyPe)),
    bullPe: Math.max(1, Math.round(historyPe * 1.2)),
  };
}

function scenarioRows(metrics, price, years, assumptions) {
  const eps = finite(metrics?.valuationEps) ?? finite(metrics?.eps);
  const referencePe = finite(metrics?.medianPe) ?? finite(metrics?.valuationPe) ?? finite(metrics?.pe) ?? (eps > 0 && price > 0 ? price / eps : null);
  if (!(eps > 0) || !(price > 0) || !(referencePe > 0) || ![assumptions.bearPe, assumptions.basePe, assumptions.bullPe].every(value => finite(value) > 0)) return null;
  return [
    ["Bull", assumptions.bullGrowth, assumptions.bullPe],
    ["Base", assumptions.baseGrowth, assumptions.basePe],
    ["Bear", assumptions.bearGrowth, assumptions.bearPe],
  ].map(([name, growth, multiple]) => {
    const target = eps * (1 + growth / 100) ** years * multiple;
    return { name, growth, multiple, target, returnPct: (target / price - 1) * 100 };
  });
}

function FinancialBars({ history }) {
  const rows = [...(history ?? [])].slice(0, 4).reverse();
  const max = Math.max(0, ...rows.flatMap(row => [row.revenueCr ?? 0, row.operatingProfitCr ?? 0, row.profitCr ?? 0]));
  if (!rows.length || max <= 0) return <div style={{ color: "var(--t3)", fontSize: 11 }}>Annual chart is not available from the filings.</div>;
  return (
    <div role="img" aria-label="Annual revenue, operating profit and net profit in rupees crore" style={{ display: "flex", alignItems: "end", gap: 12, minHeight: 112, paddingTop: 10 }}>
      {rows.map(row => (
        <div key={row.fyEnd} style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "end", justifyContent: "center", gap: 3, height: 82, borderBottom: "1px solid var(--bdr2)" }}>
            {[[row.revenueCr, "var(--accent)", "Revenue"], [row.operatingProfitCr, "var(--blue, #0A84FF)", "Operating profit"], [row.profitCr, "var(--green)", "Net profit"]].map(([value, color, label]) => (
              <span key={label} title={`${label}: ${cr(value)}`} style={{ width: "22%", height: `${Math.max(2, Math.max(0, value ?? 0) / max * 76)}px`, maxHeight: 76, borderRadius: "4px 4px 0 0", background: value != null && value < 0 ? "var(--red)" : color, opacity: value == null ? 0.18 : 0.86 }} />
            ))}
          </div>
          <div style={{ fontSize: 9.5, color: "var(--t3)", marginTop: 5, whiteSpace: "nowrap" }}>{row.fyEnd?.slice(0, 4)}</div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 9.5, color: "var(--t3)", alignSelf: "end", paddingBottom: 1 }}>
        {[["Revenue", "var(--accent)"], ["Operating profit", "var(--blue, #0A84FF)"], ["Net profit", "var(--green)"]].map(([label, color]) => <span key={label} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><i style={{ width: 7, height: 7, borderRadius: 2, background: color }} />{label}</span>)}
      </div>
    </div>
  );
}

function ScoreBar({ value }) {
  const score = finite(value);
  const color = score == null ? "var(--t3)" : score >= 65 ? "var(--green)" : score >= 45 ? "var(--yellow)" : "var(--red)";
  return (
    <div style={{ height: 6, borderRadius: 99, background: "var(--s3)", overflow: "hidden", margin: "8px 0" }}>
      {score != null && <div style={{ width: `${bound(score, 0, 100)}%`, height: "100%", borderRadius: 99, background: color }} />}
    </div>
  );
}

function TechnicalNote({ technical }) {
  if (!technical) return <span style={{ color: "var(--t3)" }}>Technical data unavailable.</span>;
  const signal = technical.emaSignal === "bullish" ? "Bullish" : technical.emaSignal === "bearish" ? "Bearish" : technical.emaSignal ? "Neutral" : null;
  const words = [technical.setupState, signal && `${signal} EMA signal`, finite(technical.rsi14) != null && `RSI ${Math.round(technical.rsi14)}`].filter(Boolean);
  return <span style={{ color: "var(--t2)" }}>{words.length ? words.map((word, i) => <span key={`${word}-${i}`}>{i ? " · " : ""}{word}</span>) : "Technical summary unavailable."} {technical.asOf && <span style={{ color: "var(--t3)" }}>· through {dateLabel(technical.asOf)}</span>}</span>;
}

export default function InvestmentBriefView({ stocks, onClose }) {
  const symbolsKey = stocks.map(stock => stock.symbol).join(",");
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [capitalText, setCapitalText] = useState("100000");
  const [years, setYears] = useState(1);
  const [assumptions, setAssumptions] = useState({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setItems({});
    setAssumptions({});
    const current = stocks;
    Promise.all(current.map(async stock => {
      const [financialResult, technicalResult] = await Promise.allSettled([api.stock(stock.symbol), api.panel(stock.symbol, "technicals")]);
      return {
        stock,
        data: financialResult.status === "fulfilled" ? financialResult.value : null,
        technical: technicalResult.status === "fulfilled" ? technicalResult.value : null,
        error: financialResult.status === "rejected" ? financialResult.reason?.message ?? "Financial data could not be loaded." : null,
      };
    })).then(results => {
      if (!active) return;
      const next = Object.fromEntries(results.map(item => [item.stock.symbol, item]));
      setItems(next);
      setAssumptions(Object.fromEntries(results.map(item => [item.stock.symbol, defaultAssumptions(item.data?.metrics, referencePrice(item))])));
      setLoading(false);
    });
    return () => { active = false; };
    // symbolsKey keeps this effect stable if the parent re-renders its array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  const capital = Math.max(0, finite(capitalText) ?? 0);
  const ranked = useMemo(() => Object.values(items).sort((a, b) => {
    const scoreA = finite(a.data?.metrics?.research?.overall?.score ?? a.stock.research?.overall);
    const scoreB = finite(b.data?.metrics?.research?.overall?.score ?? b.stock.research?.overall);
    if (scoreA == null && scoreB == null) return a.stock.name.localeCompare(b.stock.name);
    if (scoreA == null) return 1;
    if (scoreB == null) return -1;
    return scoreB - scoreA;
  }), [items]);

  const portfolioCases = ["Bull", "Base", "Bear"].map(name => {
    const allocations = ranked.map(item => {
      const metrics = item.data?.metrics;
      const price = referencePrice(item);
      const cases = scenarioRows(metrics, price, years, assumptions[item.stock.symbol] ?? defaultAssumptions(metrics, price));
      return cases?.find(test => test.name === name) ?? null;
    });
    if (!ranked.length || allocations.some(row => !row)) return { name, value: null, changePct: null };
    const perStock = capital / ranked.length;
    const valueDirect = allocations.reduce((sum, row, index) => {
      const item = ranked[index];
      const metrics = item.data.metrics;
      const price = finite(item.data?.quote?.cmp) ?? finite(metrics?.close) ?? finite(item.data?.close?.price) ?? finite(item.stock.cmp);
      return sum + perStock * (row.target / price);
    }, 0);
    return { name, value: Number.isFinite(valueDirect) ? valueDirect : null, changePct: capital > 0 ? ((valueDirect / capital) - 1) * 100 : 0 };
  });

  const updateAssumption = (symbol, key, value) => setAssumptions(previous => ({
    ...previous,
    [symbol]: { ...(previous[symbol] ?? defaultAssumptions(items[symbol]?.data?.metrics, referencePrice(items[symbol]))), [key]: value },
  }));
  const printBrief = () => {
    const sections = [...document.querySelectorAll(".investment-brief-print details")];
    const openBefore = sections.map(section => section.open);
    sections.forEach(section => { section.open = true; });
    window.print();
    sections.forEach((section, index) => { section.open = openBefore[index]; });
  };

  return (
    <div className="investment-brief-print" style={{ position: "fixed", inset: 0, zIndex: 400, overflowY: "auto", background: "var(--bg)", padding: "20px var(--page-x) 48px" }}>
      <div style={{ maxWidth: 1050, margin: "0 auto" }}>
        <div className="brief-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <button onClick={onClose} className="btn-ghost" style={{ height: 34 }}><ArrowLeft size={15} /> Back to comparison</button>
          <button onClick={printBrief} className="btn-ghost" style={{ height: 34 }}><Printer size={15} /> Print / Save PDF</button>
        </div>

        <header style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}><FileText size={14} /> StockWise research brief</div>
          <h1 style={{ fontSize: "clamp(23px, 4vw, 34px)", color: "var(--t1)", margin: "7px 0 5px", letterSpacing: "-.03em" }}>A sourced view of your selected stocks</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--t3)" }}>{ranked.length || stocks.length} stocks · generated {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · research scores are comparisons, not buy or sell signals.</p>
        </header>

        <section style={{ ...panel, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Illustrative portfolio scenarios</div>
              <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 3 }}>Equal-weight allocation: {money(capital / Math.max(1, stocks.length))} per stock. Change the capital and horizon.</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
              <label style={{ fontSize: 10.5, color: "var(--t3)" }}>Capital (₹)<input aria-label="Investment capital in rupees" type="number" min="0" step="1000" value={capitalText} onChange={event => setCapitalText(event.target.value)} style={{ display: "block", width: 150, height: 34, border: "1px solid var(--bdr2)", borderRadius: 7, padding: "0 9px", marginTop: 4, background: "var(--s1)", color: "var(--t1)", font: "inherit", ...MONO }} /></label>
              <div role="group" aria-label="Scenario horizon" style={{ display: "flex", gap: 4 }}>
                {[1, 3, 5].map(value => <button key={value} type="button" onClick={() => setYears(value)} aria-pressed={years === value} className="btn-ghost" style={{ height: 34, borderColor: years === value ? "var(--accent)" : undefined, color: years === value ? "var(--accent)" : undefined }}>{value} {value === 1 ? "year" : "years"}</button>)}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 14 }}>
            {portfolioCases.map(test => <div key={test.name} style={{ padding: 12, borderRadius: 9, background: "var(--s1)", border: "1px solid var(--bdr)" }}>
              <div style={{ fontSize: 11, color: "var(--t3)" }}>{test.name} case · {years} {years === 1 ? "year" : "years"}</div>
              <div style={{ fontSize: 20, fontWeight: 750, color: test.name === "Bull" ? "var(--green)" : test.name === "Bear" ? "var(--red)" : "var(--t1)", marginTop: 3, ...MONO }}>{test.value == null ? "—" : money(test.value)}</div>
              <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 2 }}>{test.value == null ? "Needs valid EPS, price and P/E for every selected stock." : `Illustrative ${test.changePct < 0 ? "loss" : "gain"}: ${money(Math.abs(test.value - capital))} (${pct(test.changePct)})`}</div>
            </div>)}
          </div>
          <p style={{ fontSize: 10.5, color: "var(--t3)", lineHeight: 1.5, margin: "10px 0 0" }}>These are assumption-based price scenarios, not forecasts or probabilities. Equal weights; dividends, taxes, fees and future share issues are excluded. Actual losses can be larger than the bear case.</p>
        </section>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", margin: "18px 0 10px", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 18, color: "var(--t1)", margin: 0 }}>Selected stocks, ranked by research score</h2>
          <span style={{ fontSize: 10.5, color: "var(--t3)" }}>Higher score means stronger fit to the published rules, not higher expected return.</span>
        </div>

        {loading && <div style={{ ...panel, textAlign: "center", color: "var(--t3)" }}><LoaderCircle size={17} className="spin" style={{ verticalAlign: "-4px", marginRight: 7 }} />Loading filings and technical data…</div>}
        <div style={{ display: "grid", gap: 12 }}>
          {ranked.map((item, index) => {
            const metrics = item.data?.metrics;
            const score = finite(metrics?.research?.overall?.score ?? item.stock.research?.overall);
            const price = referencePrice(item);
            const priceAsOf = item.data?.quote?.asOf ?? metrics?.provenance?.marketPrice?.date ?? item.data?.close?.date ?? null;
            const currentAssumptions = assumptions[item.stock.symbol] ?? defaultAssumptions(metrics, price);
            const cases = scenarioRows(metrics, price, years, currentAssumptions);
            const latest = metrics?.history?.[0];
            const quarter = metrics?.quarters?.[0];
            const overall = metrics?.research?.overall;
            return (
              <article key={item.stock.symbol} style={panel}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".06em" }}>#{index + 1} · {item.stock.symbol}</div>
                    <h3 style={{ fontSize: 19, color: "var(--t1)", margin: "3px 0 0" }}>{item.data?.name ?? item.stock.name}</h3>
                    <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 3 }}>{metrics?.sector ?? item.stock.sector ?? "NSE listed company"}{metrics?.lender ? " · Lender" : ""}{metrics?.cyclical ? " · Cyclical" : ""}</div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 90 }}>
                    <div style={{ fontSize: 22, lineHeight: 1.1, fontWeight: 750, color: overall?.score != null ? (overall.score >= 65 ? "var(--green)" : overall.score >= 45 ? "var(--yellow)" : "var(--red)") : "var(--t3)", ...MONO }}>{score == null ? "—" : `${Math.round(score)}/100`}</div>
                    <div style={{ fontSize: 9.5, color: "var(--t3)" }}>{overall?.stance ?? "Not rated"}</div>
                  </div>
                </div>
                <ScoreBar value={score} />
                <div style={{ fontSize: 11, color: "var(--t2)" }}>{overall?.text ?? item.stock.research?.stance ?? "No overall research score is available."}</div>
                {metrics?.research?.summary && <p style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5, margin: "7px 0 0" }}>{metrics.research.summary}</p>}
                {item.error && <div role="note" style={{ fontSize: 11, color: "var(--yellow)", marginTop: 7 }}>{item.error}</div>}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))", gap: 8, marginTop: 12 }}>
                  {[
                    ["Reference price", `${money(price)}${priceAsOf ? ` · ${dateLabel(priceAsOf)}` : ""}`],
                    ["Quality", metrics?.research?.quality == null ? "Not rated" : `${Math.round(metrics.research.quality)}/100`],
                    ["Valuation", metrics?.research?.valuation?.label ?? item.stock.research?.valuationLabel ?? "Not rated"],
                    ["Risk", metrics?.research?.risk?.label ?? item.stock.research?.riskLabel ?? "Unavailable"],
                    ["Dividend yield", metrics?.divYield == null ? "Not reported" : `${metrics.divYield.toFixed(2)}%`],
                  ].map(([label, value]) => <div key={label} style={{ padding: "8px 9px", borderRadius: 8, background: "var(--s1)" }}><div style={{ fontSize: 9.5, color: "var(--t3)" }}>{label}</div><div style={{ fontSize: 11.5, fontWeight: 650, color: "var(--t1)", marginTop: 3, ...MONO }}>{value}</div></div>)}
                </div>

                <details style={{ marginTop: 12 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 650, color: "var(--accent)" }}>Illustrative {years}-year price scenarios</summary>
                  {cases ? <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7, marginTop: 9 }}>
                      {cases.map(test => <div key={test.name} className="brief-case" style={{ padding: 9, borderRadius: 8, background: "var(--s1)", border: "1px solid var(--bdr)" }}>
                        <div style={{ fontSize: 10, color: "var(--t3)" }}>{test.name}</div><div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginTop: 2, ...MONO }}>{money(test.target)}</div><div style={{ fontSize: 10.5, color: test.returnPct >= 0 ? "var(--green)" : "var(--red)" }}>{pct(test.returnPct)} price return</div><div style={{ fontSize: 9.5, color: "var(--t3)", marginTop: 3 }}>EPS growth {pct(test.growth)} · exit P/E {test.multiple}×</div>
                      </div>)}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 8 }}>Edit EPS growth and exit P/E. {assumptionBasis(metrics, price)}</div>
                    <div style={{ overflowX: "auto", marginTop: 6 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, minWidth: 410 }}>
                        <thead><tr>{["Case", "Annual EPS growth %", "Exit P/E"].map((label, i) => <th key={label} style={{ textAlign: i ? "right" : "left", padding: "5px 4px", color: "var(--t3)", fontWeight: 550 }}>{label}</th>)}</tr></thead>
                        <tbody>{[["Bear", "bearGrowth", "bearPe"], ["Base", "baseGrowth", "basePe"], ["Bull", "bullGrowth", "bullPe"]].map(([label, growthKey, peKey]) => <tr key={label}>
                          <td style={{ padding: "5px 4px", color: "var(--t2)" }}>{label}</td>
                          {[growthKey, peKey].map((key, i) => <td key={key} style={{ padding: "4px", textAlign: "right" }}><input aria-label={`${item.stock.name} ${label} ${i ? "exit P/E" : "EPS growth"}`} type="number" step="1" value={currentAssumptions[key]} onChange={event => updateAssumption(item.stock.symbol, key, bound(finite(event.target.value) ?? 0, i ? 1 : -50, i ? 200 : 100))} style={{ width: 88, height: 29, borderRadius: 6, border: "1px solid var(--bdr2)", padding: "0 7px", background: "var(--bg)", color: "var(--t1)", textAlign: "right", ...MONO }} /></td>)}
                        </tr>)}</tbody>
                      </table>
                    </div>
                  </> : <p style={{ fontSize: 11, color: "var(--t3)" }}>A scenario needs positive normalized EPS, a reference price and a valid P/E assumption.</p>}
                </details>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 13 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)" }}>Annual financials · ₹ crore</div>
                    <FinancialBars history={metrics?.history} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4, marginTop: 7, fontSize: 9.5, color: "var(--t3)" }}>
                      {[["Revenue", latest?.revenueCr], ["Operating profit", latest?.operatingProfitCr], ["Net profit", latest?.profitCr]].map(([label, value]) => <div key={label}><span>{label}</span><div style={{ fontSize: 10, color: "var(--t2)", fontWeight: 650, ...MONO }}>{cr(value)}</div></div>)}
                    </div>
                    <div style={{ fontSize: 9.5, color: "var(--t3)", marginTop: 4 }}>{latest?.fyEnd ? `Latest filed year ended ${dateLabel(latest.fyEnd)} · ${latest.scope ?? "scope not stated"}` : "Annual filing data unavailable."}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)" }}>Latest quarter</div>
                    {quarter ? <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.7, color: "var(--t2)" }}>
                      <div>{dateLabel(quarter.fyEnd)} · Revenue {cr(quarter.revenueCr)} {quarter.salesYoY != null && <strong style={{ color: quarter.salesYoY >= 0 ? "var(--green)" : "var(--red)" }}>{pct(quarter.salesYoY)} YoY</strong>}</div>
                      <div>Net profit {cr(quarter.profitCr)} {quarter.profitYoY != null && <strong style={{ color: quarter.profitYoY >= 0 ? "var(--green)" : "var(--red)" }}>{pct(quarter.profitYoY)} YoY</strong>}</div>
                    </div> : <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 8 }}>Quarterly results unavailable.</div>}
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", marginTop: 12 }}>Technical snapshot</div>
                    <div style={{ fontSize: 10.5, lineHeight: 1.5, marginTop: 5 }}><TechnicalNote technical={item.technical} /></div>
                    <div style={{ fontSize: 9.5, color: "var(--t3)", marginTop: 6 }}>Short-term price signals describe momentum and can reverse; they are not forecasts.</div>
                  </div>
                </div>

                <div style={{ fontSize: 9.5, color: "var(--t3)", borderTop: "1px solid var(--bdr)", paddingTop: 8, marginTop: 12 }}>
                  Fundamentals: {metrics?.provenance?.financials?.source ?? "NSE filings"} · {metrics?.provenance?.financials?.scope ?? "scope not stated"} · {metrics?.provenance?.financials?.filedAt ? `filed ${dateLabel(metrics.provenance.financials.filedAt)}` : "filing date unavailable"}. Market price as of {dateLabel(priceAsOf)}. {" "}<a href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(item.stock.symbol)}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Open NSE quote and filings ↗</a>
                </div>
              </article>
            );
          })}
        </div>

        <footer style={{ ...panel, marginTop: 14, fontSize: 10.5, color: "var(--t3)", lineHeight: 1.55 }}>
          StockWise scores are rule-based summaries of reported data, not validated predictions of returns. Scenario values use normalized EPS × assumed EPS growth × assumed exit P/E; they are not price targets, and their assumptions are not probabilities. Check the linked company filings and your own circumstances. This brief is for research and education, not a buy or sell recommendation.
        </footer>
      </div>
    </div>
  );
}
