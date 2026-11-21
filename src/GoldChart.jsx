import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lazyPage } from "./lazyPage.js";
import { createChart, AreaSeries, LineSeries, CandlestickSeries, ColorType, CrosshairMode } from "lightweight-charts";
import { api } from "./api.js";

// Gold and silver alone: the company pages' full chart (22 Nov 2026, the
// owner: "we need our detailed chart for this") — candles, ranges, indicators,
// drawing, full screen — on the ETF's prices from this page's public data
const PriceChartPanel = lazyPage(() => import("./PriceChartPanel.jsx"));

// The gold page's chart (20 Nov 2026, the owner: "can I show the gold
// chart?"): gold or silver on its own, through the ETF that tracks it
// (GOLDBEES, SILVERBEES: NSE's daily prices), gold shown as ₹ for 10 grams of
// 24 carat; or gold, silver and the Nifty 50 together as ₹100 put in at the
// start of the range.
// 20 Nov 2026, the owner: "why is the gold chart that simple, not like a
// regular chart, and no 5 years back": now a regular chart — line or candles,
// drag and pinch to move and zoom, the price and date where you point, the
// range's high and low — and gold back ten years (server/etf-history-old.json).

const RANGES = [["1M", 1], ["6M", 6], ["1Y", 12], ["3Y", 36], ["5Y", 60], ["10Y", 120], ["All", null]];
const MODES = [["gold", "Gold"], ["silver", "Silver"], ["compare", "Gold vs silver vs Nifty"]];
const COLOURS = { Gold: "#D4A017", Silver: "#94A3B8", "Nifty 50": null };
const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const signed = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
const monthsBack = (to, m) => { const f = new Date(`${to}T00:00:00Z`); f.setUTCMonth(f.getUTCMonth() - m); return f.toISOString().slice(0, 10); };
const firstFrom = (days, iso) => { const i = days.findIndex(d => d >= iso); return i < 0 ? days.length - 1 : i; };

export default function GoldChart() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("gold");
  const [range, setRange] = useState("1Y");
  const [kind, setKind] = useState(() => { try { return localStorage.getItem("gc-kind") === "candles" ? "candles" : "line"; } catch { return "line"; } });
  const [tip, setTip] = useState(null);
  const [span, setSpan] = useState(null); // the days in view: [first index, last index]
  const host = useRef(null);
  useEffect(() => { api.publicGoldSilverChart().then(setData).catch(() => setData({ series: [] })); }, []);
  // RBI's gram price (server/rbi-gold.js), to turn the gold ETF's price into
  // gold's: ₹101 a GOLDBEES unit meant nothing to anyone
  const [gram, setGram] = useState(null);
  useEffect(() => { api.publicGoldSilver().then(d => setGram(d?.gram ?? null)).catch(() => {}); }, []);
  // ₹ for 10 g of 24 carat per rupee of GOLDBEES: RBI's price against the
  // ETF's average close on the three days RBI averaged
  const tenGram = useMemo(() => {
    const gb = data?.series?.find(x => x.symbol === "GOLDBEES");
    if (!gb || !gram?.price || !gram.days?.length) return null;
    const closes = gram.days.map(d => gb.closes[gb.days.indexOf(d)]).filter(c => c > 0);
    return closes.length === gram.days.length ? (gram.price * 10) / (closes.reduce((a, c) => a + c, 0) / closes.length) : null;
  }, [data, gram]);
  const asGold = mode === "gold" && tenGram != null;
  const compare = mode === "compare";
  const pickKind = k => { setKind(k); try { localStorage.setItem("gc-kind", k); } catch { /* private window */ } };

  const to = data?.to ?? data?.series?.[0]?.days.at(-1);
  const months = RANGES.find(r => r[0] === range)[1];
  // a range is offered when every series in the view reaches back that far
  const reaches = (s, m) => m == null || s.days[0] <= new Date(Date.parse(`${monthsBack(to, m)}T00:00:00Z`) + 10 * 864e5).toISOString().slice(0, 10);
  const inView = useMemo(() => (data?.series ?? []).filter(s => (compare ? true : s.label.toLowerCase() === mode)), [data, mode, compare]);
  const ok = r => inView.length > 0 && inView.every(s => reaches(s, r[1]));
  // today's price after the last close, while the market is open (or since it closed, before the evening's data)
  const withLive = s => {
    const l = data?.live?.[s.symbol];
    if (!(l && l.date > s.days.at(-1))) return s;
    const p = l.price;
    return { ...s, days: [...s.days, l.date], opens: [...(s.opens ?? []), p], highs: [...(s.highs ?? []), p], lows: [...(s.lows ?? []), p], closes: [...s.closes, p], liveAt: l.at };
  };
  // one view's series. Alone: every day kept (the range is what's in view, and
  // you can drag back further); compared: cut to the range, from ₹100
  const lines = useMemo(() => (to ? inView.map(s => {
    let x = withLive(s);
    if (compare && months != null) { const i = firstFrom(x.days, monthsBack(x.days.at(-1), months)); x = { ...x, days: x.days.slice(i), closes: x.closes.slice(i), opens: null, highs: null, lows: null }; }
    const k = asGold && s.symbol === "GOLDBEES" ? tenGram : 1;
    const m = arr => arr?.map(v => (v == null ? null : v * k)) ?? null;
    return { ...x, opens: m(x.opens), highs: m(x.highs), lows: m(x.lows), closes: m(x.closes) };
  }).filter(s => s.days.length > 1) : []), [inView, months, to, data, asGold, tenGram, compare]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (data && !ok(RANGES.find(r => r[0] === range))) { const best = [...RANGES].reverse().find(r => r[1] != null && ok(r)); if (best) setRange(best[0]); } }, [data, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const candles = kind === "candles" && !compare && !!lines[0]?.opens?.every(v => v > 0);
  const etf = !compare ? (data?.series ?? []).find(s => s.label.toLowerCase() === mode) ?? null : null;
  const loadEtf = useCallback(() => {
    const s = withLive(etf);
    // gold as ₹ for 10 g of 24 carat, as the page says it; silver as its ETF
    const k = s.symbol === "GOLDBEES" && tenGram ? tenGram : 1;
    const r2 = v => Math.round(v * k * 100) / 100;
    const at = (arr, i) => r2(arr?.[i] > 0 ? arr[i] : s.closes[i]);
    return Promise.resolve({ symbol: s.symbol, source: "NSE", keptFrom: s.days[0], bars: s.days.map((date, i) => ({ date, open: at(s.opens, i), high: at(s.highs, i), low: at(s.lows, i), close: r2(s.closes[i]), volume: null })) });
  }, [etf, data, tenGram]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!host.current || !lines.length) return undefined;
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const hex = (raw, fb) => (/^#[0-9a-f]{6}$/i.test(raw) ? raw : fb);
    const money = p => (compare ? `₹${Math.round(p)}` : p >= 1000 ? `₹${Math.round(p).toLocaleString("en-IN")}` : `₹${p.toFixed(2)}`);
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "rgba(0, 0, 0, 0)" }, textColor: v("--t3"), fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: v("--bdr") } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderVisible: false, rightOffset: 3, minBarSpacing: 0.05 },
      // the finger's height isn't a value: no label for it when compared (22 Nov 2026: a grey "₹64" no one could read)
      crosshair: { mode: CrosshairMode.Normal, horzLine: { style: 3, color: v("--bdr2"), labelVisible: !compare, labelBackgroundColor: "#475569" }, vertLine: { style: 3, color: v("--bdr2"), labelBackgroundColor: "#475569" } },
      localization: { locale: "en-IN", priceFormatter: money },
      // drag sideways and pinch to move and zoom, as any chart; a finger
      // moving up and down still scrolls the page, and a mouse wheel too
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: { time: true, price: false }, axisDoubleClickReset: true },
    });
    const made = lines.map(s => {
      const colour = hex(COLOURS[s.label] ?? v("--accent"), "#2563eb");
      const base = s.closes[0];
      const values = compare ? s.closes.map(c => (c / base) * 100) : s.closes;
      let series;
      // the legend says each line's value; tags on the scale hid its numbers
      if (compare) series = chart.addSeries(LineSeries, { color: colour, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
      else if (candles) {
        const up = hex(v("--green"), "#16a34a"), down = hex(v("--red"), "#dc2626");
        series = chart.addSeries(CandlestickSeries, { upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down, priceLineVisible: false });
        series.setData(s.days.map((time, i) => ({ time, open: s.opens[i], high: s.highs[i], low: s.lows[i], close: s.closes[i] })));
        return { s, values };
      } else {
        const n = parseInt(colour.slice(1), 16), rgba = a => `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
        series = chart.addSeries(AreaSeries, { lineColor: colour, lineWidth: 2, topColor: rgba(0.25), bottomColor: rgba(0), priceLineVisible: false, lastValueVisible: true });
      }
      series.setData(s.days.map((time, i) => ({ time, value: values[i] })));
      return { s, values };
    });
    chart.subscribeCrosshairMove(p => {
      if (!p?.time || !p.point || p.point.x < 0) { setTip(null); return; }
      setTip({ x: p.point.x, date: p.time, rows: made.map(({ s, values }) => { const i = s.days.indexOf(p.time); return { label: s.label, value: values[i], o: s.opens?.[i], h: s.highs?.[i], l: s.lows?.[i] }; }).filter(r => r.value != null) });
    });
    // what's in view, for the change, high and low over it
    const days = lines[0].days;
    const onRange = r => {
      if (!r) return;
      const a = Math.max(0, Math.ceil(r.from)), b = Math.min(days.length - 1, Math.floor(r.to));
      setSpan(b > a ? [a, b] : null);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    // the range picked: its days in view (when compared, the series is cut to it already)
    if (compare || months == null) chart.timeScale().fitContent();
    else {
      const from = firstFrom(days, monthsBack(days.at(-1), months));
      chart.timeScale().setVisibleLogicalRange({ from: from - 0.5, to: days.length - 1 + 3 });
    }
    return () => { chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange); chart.remove(); };
  }, [lines, mode, asGold, candles, months, compare]);

  if (!data) return <div className="gc-chart gc-wait" aria-label="Loading the chart" />;
  if (!data.series.length) return null;
  const s0 = lines[0];
  const note = compare
    ? "₹100 put in at the start of the range, through GOLDBEES, SILVERBEES and NIFTYBEES (after the funds' costs). The silver ETF began trading in 2022, so this goes back as far as that. Drag the chart sideways to go back, pinch to zoom."
    : asGold
      ? `The price of 10 grams of 24-carat gold, estimated: the gold ETF GOLDBEES's daily prices, matched to RBI's ₹${gram.price.toLocaleString("en-IN")} a gram for ${day(gram.redeemOn)}. Over years it may read up to about 1% a year high, the fund's costs. A jeweller adds making charges and 3% GST.`
      : mode === "silver"
        ? "The silver ETF SILVERBEES, the largest silver fund on NSE: one unit, not a gram, moving as silver's price does. It began trading in 2022."
        : "The gold ETF GOLDBEES, the largest gold fund on NSE: one unit, not a gram, moving as gold's price does.";
  // compared: each line's value where the finger is, else at the end
  const at = s => { const r = tip?.rows.find(x => x.label === s.label); return r ? r.value : (s.closes.at(-1) / s.closes[0]) * 100; };
  return (
    <section className="gs-card gc">
      <div className="gc-modes" role="tablist" aria-label="Chart">
        {MODES.map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={mode === id} className={mode === id ? "on" : ""} onClick={() => setMode(id)}>{l}</button>)}
      </div>
      {!compare && etf ? (
        <Suspense fallback={<div className="gc-chart gc-wait" aria-label="Loading the chart" />}>
          <PriceChartPanel key={etf.symbol} symbol={etf.symbol} name={mode === "gold" ? (tenGram ? "Gold, 10 g of 24 carat" : "Gold (GOLDBEES)") : "Silver (SILVERBEES)"} load={loadEtf} label={mode === "gold" ? (tenGram ? "Gold, 10 g ₹" : "GOLDBEES") : "SILVERBEES"} />
        </Suspense>
      ) : (
        <>
          <div className="gc-legend">
            {lines.map(s => {
              const v = at(s);
              return (
                <span key={s.label}>
                  <i style={{ background: COLOURS[s.label] ?? "var(--accent)" }} />
                  {s.label} <b>₹{Math.round(v)}</b> <em className={v >= 100 ? "up" : "down"}>{signed(v - 100)}</em>
                </span>
              );
            })}
            <small>{s0 ? (tip ? `${day(s0.days[0])} – ${day(tip.date)}` : `${day(s0.days[0])} – ${day(s0.days.at(-1))}${s0.liveAt ? `, today's price at ${(([h, mi]) => `${Number(h) % 12 || 12}:${mi} ${Number(h) < 12 ? "am" : "pm"}`)(s0.liveAt.split(":"))}` : ", the last close"}`) : ""}</small>
          </div>
          <div className="gc-wrap">
            <div ref={host} className="gc-chart" role="img" aria-label="Gold, silver and the Nifty 50, ₹100 put in at the start" />
          </div>
          <div className="gc-bar">
            <div className="gc-ranges" role="group" aria-label="Range">
              {RANGES.map(r => <button key={r[0]} type="button" aria-pressed={range === r[0]} disabled={!ok(r)} onClick={() => setRange(r[0])}>{r[0]}</button>)}
            </div>
          </div>
        </>
      )}
      <p className="gs-note">{note} NSE's daily prices; before Oct 2021 from NSE's archived daily files, on today's unit.</p>
    </section>
  );
}
