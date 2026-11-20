import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, AreaSeries, LineSeries, ColorType } from "lightweight-charts";
import { api } from "./api.js";

// The gold page's chart (20 Nov 2026, the owner: "can I show the gold
// chart?"): gold or silver on its own, through the ETF that tracks it
// (GOLDBEES, SILVERBEES: its price a unit, from NSE's daily closes), or gold,
// silver and the Nifty 50 together as ₹100 put in at the start of the range.

const RANGES = [["1M", 1], ["6M", 6], ["1Y", 12], ["3Y", 36], ["5Y", 60], ["10Y", 120]];
const MODES = [["gold", "Gold"], ["silver", "Silver"], ["compare", "Gold vs silver vs Nifty"]];
const COLOURS = { Gold: "#D4A017", Silver: "#94A3B8", "Nifty 50": null };
const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const signed = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

const cut = (s, months, to) => {
  const from = new Date(`${to}T00:00:00Z`); from.setUTCMonth(from.getUTCMonth() - months);
  const iso = from.toISOString().slice(0, 10);
  const i = s.days.findIndex(d => d >= iso);
  return i < 0 ? { days: [], closes: [] } : { days: s.days.slice(i), closes: s.closes.slice(i) };
};

export default function GoldChart() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("gold");
  const [range, setRange] = useState("1Y");
  const [tip, setTip] = useState(null);
  const host = useRef(null);
  useEffect(() => { api.publicGoldSilverChart().then(setData).catch(() => setData({ series: [] })); }, []);

  const months = RANGES.find(r => r[0] === range)[1];
  const to = data?.to ?? data?.series?.[0]?.days.at(-1);
  // a range is offered when every series in the view reaches back that far
  const reaches = (s, m) => { const f = new Date(`${to}T00:00:00Z`); f.setUTCMonth(f.getUTCMonth() - m); return s.days[0] <= new Date(f.getTime() + 10 * 864e5).toISOString().slice(0, 10); };
  const inView = useMemo(() => (data?.series ?? []).filter(s => (mode === "compare" ? true : s.label.toLowerCase() === mode)), [data, mode]);
  const ok = r => inView.length > 0 && inView.every(s => reaches(s, r[1]));
  const lines = useMemo(() => (to ? inView.map(s => ({ ...s, ...cut(s, months, to) })).filter(s => s.days.length > 1) : []), [inView, months, to]);
  useEffect(() => { if (data && !ok(RANGES.find(r => r[0] === range))) { const best = [...RANGES].reverse().find(ok); if (best) setRange(best[0]); } }, [data, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!host.current || !lines.length) return undefined;
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const hex = (raw, fb) => (/^#[0-9a-f]{6}$/i.test(raw) ? raw : fb);
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "rgba(0, 0, 0, 0)" }, textColor: v("--t3"), fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: v("--bdr") } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false },
      crosshair: { horzLine: { visible: false, labelVisible: false }, vertLine: { labelVisible: false, style: 3, color: v("--bdr2") } },
      localization: { locale: "en-IN", priceFormatter: p => (mode === "compare" ? `₹${Math.round(p)}` : `₹${p.toFixed(p < 1000 ? 2 : 0)}`) },
      handleScroll: false, handleScale: false,
    });
    const made = lines.map(s => {
      const colour = hex(COLOURS[s.label] ?? v("--accent"), "#2563eb");
      const base = s.closes[0];
      const values = mode === "compare" ? s.closes.map(c => (c / base) * 100) : s.closes;
      let series;
      if (mode === "compare") series = chart.addSeries(LineSeries, { color: colour, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
      else {
        const n = parseInt(colour.slice(1), 16), rgba = a => `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
        series = chart.addSeries(AreaSeries, { lineColor: colour, lineWidth: 2, topColor: rgba(0.25), bottomColor: rgba(0), priceLineVisible: false, lastValueVisible: false });
      }
      series.setData(s.days.map((time, i) => ({ time, value: values[i] })));
      return { s, values };
    });
    chart.subscribeCrosshairMove(p => {
      if (!p?.time || !p.point || p.point.x < 0) { setTip(null); return; }
      setTip({ x: p.point.x, date: p.time, rows: made.map(({ s, values }) => ({ label: s.label, value: values[s.days.indexOf(p.time)] })).filter(r => r.value != null) });
    });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [lines, mode]);

  if (!data) return <div className="gc-chart gc-wait" aria-label="Loading the chart" />;
  if (!data.series.length) return null;
  const w = host.current?.clientWidth ?? 0;
  return (
    <section className="gs-card gc">
      <div className="gc-modes" role="tablist" aria-label="Chart">
        {MODES.map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={mode === id} className={mode === id ? "on" : ""} onClick={() => setMode(id)}>{l}</button>)}
      </div>
      <div className="gc-legend">
        {lines.map(s => {
          const move = (s.closes.at(-1) / s.closes[0] - 1) * 100;
          return (
            <span key={s.label}>
              <i style={{ background: COLOURS[s.label] ?? "var(--accent)" }} />
              {mode === "compare" ? s.label : <b>₹{s.closes.at(-1).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>}
              {" "}<em className={move >= 0 ? "up" : "down"}>{signed(move)}</em>
            </span>
          );
        })}
        <small>{lines[0] ? `${day(lines[0].days[0])} – ${day(lines[0].days.at(-1))}` : ""}</small>
      </div>
      <div className="gc-wrap">
        <div ref={host} className="gc-chart" role="img" aria-label={mode === "compare" ? "Gold, silver and the Nifty 50, ₹100 put in at the start" : `${mode} through its ETF`} />
        {tip && (
          <div className="mk-chart-tip" style={{ left: Math.min(Math.max(tip.x - 90, 0), Math.max(0, w - 190)) }}>
            <span className="mk-chart-tip-d">{day(tip.date)}</span>
            {tip.rows.map(r => <span key={r.label} className="mk-chart-tip-b">{mode === "compare" ? `${r.label}: ₹${Math.round(r.value)}` : `₹${r.value.toFixed(2)}`}</span>)}
          </div>
        )}
      </div>
      <div className="gc-ranges" role="group" aria-label="Range">
        {RANGES.map(r => <button key={r[0]} type="button" aria-pressed={range === r[0]} disabled={!ok(r)} onClick={() => setRange(r[0])}>{r[0]}</button>)}
      </div>
      <p className="gs-note">
        {mode === "compare"
          ? "₹100 put in at the start of the range, through GOLDBEES, SILVERBEES and NIFTYBEES (after the funds' costs)."
          : `The price of one unit of ${mode === "gold" ? "GOLDBEES" : "SILVERBEES"}, the largest ${mode} ETF, which follows the price of ${mode} in India.`}
        {" "}NSE's daily closes. A greyed range: the history here doesn't reach that far yet.
      </p>
    </section>
  );
}
