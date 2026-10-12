import { useState, useEffect, useMemo, useRef } from "react";
import {
  createChart, CandlestickSeries, BarSeries, LineSeries, AreaSeries, HistogramSeries,
  ColorType, CrosshairMode, LineStyle,
} from "lightweight-charts";
import { ChartCandlestick, ChartNoAxesColumn, ChartLine, ChartArea, SlidersHorizontal, Minus, X, Maximize2, Minimize2, Camera, Layers } from "lucide-react";
import { api } from "./api.js";
import { aggregateBars, sma, ema, bollinger, rsi, macd, indexFrom } from "./chartMath.js";

// The stock page's price chart: TradingView's open-source Lightweight Charts
// on our own daily bars, with the model's price levels drawn on the candles.
// Indicators are computed here (chartMath.js); horizontal lines are kept per
// symbol in this browser.

const MONO = { fontVariantNumeric: "tabular-nums" };
const PREFS_KEY = "stockwise-india-chart";
const LINES_KEY = "stockwise-india-chart-lines";

const TYPES = [
  { id: "candles", label: "Candles", Icon: ChartCandlestick },
  { id: "bars", label: "Bars", Icon: ChartNoAxesColumn },
  { id: "line", label: "Line", Icon: ChartLine },
  { id: "area", label: "Area", Icon: ChartArea },
];
const INTERVALS = [{ id: "D", label: "D", title: "Daily" }, { id: "W", label: "W", title: "Weekly" }, { id: "M", label: "M", title: "Monthly" }];
const RANGES = [
  { id: "1M", months: 1 }, { id: "3M", months: 3 }, { id: "6M", months: 6 }, { id: "YTD" },
  { id: "1Y", months: 12 }, { id: "5Y", months: 60 }, { id: "All" },
];
// Overlay colours are for telling lines apart; the legend names each one
const INDICATORS = [
  { id: "ma20", label: "MA 20", color: "#E2A03F" },
  { id: "ma50", label: "MA 50", color: "#3B82F6" },
  { id: "ma200", label: "MA 200", color: "#D946EF" },
  { id: "ema20", label: "EMA 20", color: "#14B8A6" },
  { id: "bb", label: "Bollinger Bands (20, 2)", color: "#8B95A7" },
  { id: "volume", label: "Volume" },
  { id: "rsi", label: "RSI (14)", color: "#A78BFA" },
  { id: "macd", label: "MACD (12, 26, 9)", color: "#3B82F6" },
];
const DEFAULT_PREFS = { type: "candles", interval: "D", levels: true, ind: { ma50: true, ma200: true, volume: true } };

const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

const fmtNum = n => (n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtRs = n => (n == null ? "—" : "₹" + fmtNum(n));
const fmtVol = n => (n == null ? "—" : n >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(2)} L` : Number(n).toLocaleString("en-IN"));
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// Canvas can't read color-mix(); our tokens are hex, so tint them here
const alpha = (hex, a) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const monthsBack = (iso, months) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
};
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function PriceChartPanel({ symbol, name, levels }) {
  const [prefs, setPrefs] = useState(() => {
    const p = readJson(PREFS_KEY, DEFAULT_PREFS);
    return { ...DEFAULT_PREFS, ...p, ind: { ...(p.ind ?? DEFAULT_PREFS.ind) } };
  });
  const [range, setRange] = useState("1Y");
  const [span, setSpan] = useState("5y");       // how much history is loaded
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lines, setLines] = useState(() => readJson(LINES_KEY, {})[symbol] ?? []);
  const [drawing, setDrawing] = useState(false);
  const [typedPrice, setTypedPrice] = useState("");
  const [legend, setLegend] = useState(null);
  const [themeTick, setThemeTick] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [boxW, setBoxW] = useState(720);
  const [menuOpen, setMenuOpen] = useState(false);

  const cardRef = useRef(null), hostRef = useRef(null), menuRef = useRef(null);
  const chartRef = useRef(null), mainRef = useRef(null);
  const drawingRef = useRef(false);
  const keepView = useRef(null);   // the zoom to restore when only overlays change
  drawingRef.current = drawing;

  useEffect(() => { writeJson(PREFS_KEY, prefs); }, [prefs]);
  useEffect(() => { setLines(readJson(LINES_KEY, {})[symbol] ?? []); }, [symbol]);
  const saveLines = next => {
    setLines(next);
    writeJson(LINES_KEY, { ...readJson(LINES_KEY, {}), [symbol]: next });
  };

  // Rebuild in the new theme's colours when the theme switch flips data-theme
  useEffect(() => {
    const mo = new MutationObserver(() => setThemeTick(t => t + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === cardRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBoxW(Math.round(el.getBoundingClientRect().width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const away = e => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const esc = e => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [menuOpen]);

  useEffect(() => {
    if (!drawing) return;
    const esc = e => { if (e.key === "Escape") setDrawing(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [drawing]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    api.prices(symbol, span)
      .then(j => { if (!cancelled) setData(j); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, span]);

  const bars = useMemo(() => aggregateBars(data?.bars ?? [], prefs.interval), [data, prefs.interval]);
  const narrow = boxW < 560;
  const extraPanes = (prefs.ind.rsi ? 1 : 0) + (prefs.ind.macd ? 1 : 0);
  const height = fullscreen
    ? Math.max(320, (typeof window !== "undefined" ? window.innerHeight : 800) - (narrow ? 210 : 150))
    : (narrow ? 300 : 400) + extraPanes * (narrow ? 90 : 110);

  const levelLines = useMemo(() => {
    if (!prefs.levels || !levels) return [];
    return [
      { price: levels.target, title: "Upper level", short: "Upper", color: "var(--red)", style: LineStyle.Dashed },
      { price: levels.fv25, title: "Fair value", short: "FV", color: "var(--accent)", style: LineStyle.Solid },
      { price: levels.p1, title: "Ref 1", short: "Ref 1", color: "var(--green)", style: LineStyle.Dotted },
      { price: levels.p2, title: "Ref 2", short: "Ref 2", color: "var(--green)", style: LineStyle.Dotted },
      { price: levels.p3, title: "Ref 3", short: "Ref 3", color: "var(--green)", style: LineStyle.Dotted },
      { price: levels.stopLoss, title: "Stop-loss", short: "Stop", color: "var(--red)", style: LineStyle.Dashed },
    ].filter(l => l.price > 0);
  }, [prefs.levels, levels]);

  const applyRange = (id, chart = chartRef.current) => {
    if (!chart || bars.length < 2) return;
    const last = bars.length - 1;
    const r = RANGES.find(x => x.id === id);
    if (!r || id === "All") { chart.timeScale().fitContent(); return; }
    const lastDate = bars[last].date;
    const from = id === "YTD" ? `${lastDate.slice(0, 4)}-01-01` : monthsBack(lastDate, r.months);
    chart.timeScale().setVisibleLogicalRange({ from: indexFrom(bars, from) - 0.5, to: last + 3 });
  };

  // Build the chart. It's rebuilt whole when the data, type or overlays change
  // (cheap at a few thousand bars); the visible span carries over unless the
  // bars themselves changed.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || bars.length < 2) return;
    const c = {
      bg: cssVar("--s2"), text: cssVar("--t2"), grid: cssVar("--bdr"), border: cssVar("--bdr2"),
      up: cssVar("--green"), down: cssVar("--red"), accent: cssVar("--accent"), t3: cssVar("--t3"),
    };
    const resolve = v => (v?.startsWith("var(") ? cssVar(v.slice(4, -1)) : v);

    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: c.bg }, textColor: c.text,
        fontFamily: getComputedStyle(document.body).fontFamily, fontSize: narrow ? 11 : 12,
        panes: { separatorColor: c.border, separatorHoverColor: alpha(c.accent, 0.2), enableResize: true },
      },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, rightOffset: 3, minBarSpacing: 0.5 },
      localization: { locale: "en-IN" },
      kineticScroll: { touch: !reducedMotion(), mouse: false },
    });
    chartRef.current = chart;

    const ohlc = bars.map(b => ({ time: b.date, open: b.open, high: b.high, low: b.low, close: b.close }));
    const closes = bars.map(b => b.close);
    const withVolume = prefs.ind.volume && bars.some(b => b.volume != null);

    // The price scale stretches to take in levels just beyond the candles, not
    // far ones: a fair value 75% above the price would squash the candles flat.
    // Every level, near or far, is listed with its distance above the chart.
    const levelPrices = levelLines.map(l => l.price);
    const autoscaleInfoProvider = levelPrices.length
      ? original => {
          const res = original();
          if (!res?.priceRange) return res;
          const { minValue: lo, maxValue: hi } = res.priceRange;
          const pad = (hi - lo) * 0.25;
          const near = levelPrices.filter(p => p >= lo - pad && p <= hi + pad);
          return near.length ? { ...res, priceRange: { minValue: Math.min(lo, ...near), maxValue: Math.max(hi, ...near) } } : res;
        }
      : undefined;
    // No price below zero: the room left under the candles for volume would
    // otherwise label the price axis down to −1,000 on long ranges
    const priceFormat = { type: "custom", minMove: 0.01, formatter: p => (p < 0 ? "" : fmtNum(p)) };
    const base = { priceLineColor: c.t3, autoscaleInfoProvider, priceFormat };

    let main;
    if (prefs.type === "candles") {
      main = chart.addSeries(CandlestickSeries, { ...base, upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down, borderVisible: false });
      main.setData(ohlc);
    } else if (prefs.type === "bars") {
      main = chart.addSeries(BarSeries, { ...base, upColor: c.up, downColor: c.down, thinBars: false });
      main.setData(ohlc);
    } else if (prefs.type === "line") {
      main = chart.addSeries(LineSeries, { ...base, color: c.accent, lineWidth: 2 });
      main.setData(bars.map(b => ({ time: b.date, value: b.close })));
    } else {
      main = chart.addSeries(AreaSeries, { ...base, lineColor: c.accent, topColor: alpha(c.accent, 0.28), bottomColor: alpha(c.accent, 0.02), lineWidth: 2 });
      main.setData(bars.map(b => ({ time: b.date, value: b.close })));
    }
    mainRef.current = main;
    main.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: withVolume ? 0.24 : 0.06 } });

    // Warm-up bars stay as whitespace, so every series shares the same time axis
    const toLine = vals => bars.map((b, i) => (vals[i] == null ? { time: b.date } : { time: b.date, value: vals[i] }));
    const overlay = (vals, color, opts = {}) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...opts });
      s.setData(toLine(vals));
      return s;
    };
    const legendSeries = [];
    const ind = id => INDICATORS.find(x => x.id === id);
    if (prefs.ind.ma20) legendSeries.push({ label: "MA 20", color: ind("ma20").color, values: sma(closes, 20), series: overlay(sma(closes, 20), ind("ma20").color) });
    if (prefs.ind.ma50) legendSeries.push({ label: "MA 50", color: ind("ma50").color, values: sma(closes, 50), series: overlay(sma(closes, 50), ind("ma50").color) });
    if (prefs.ind.ma200) legendSeries.push({ label: "MA 200", color: ind("ma200").color, values: sma(closes, 200), series: overlay(sma(closes, 200), ind("ma200").color) });
    if (prefs.ind.ema20) legendSeries.push({ label: "EMA 20", color: ind("ema20").color, values: ema(closes, 20), series: overlay(ema(closes, 20), ind("ema20").color) });
    if (prefs.ind.bb) {
      const b = bollinger(closes, 20, 2), col = ind("bb").color;
      overlay(b.upper, col, { lineStyle: LineStyle.Dashed, lineWidth: 1 });
      overlay(b.mid, col, { lineWidth: 1 });
      overlay(b.lower, col, { lineStyle: LineStyle.Dashed, lineWidth: 1 });
      legendSeries.push({ label: "BB", color: col, values: b.mid, fmt: i => `${fmtNum(b.upper[i])} / ${fmtNum(b.lower[i])}` });
    }

    if (withVolume) {
      const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", priceLineVisible: false, lastValueVisible: false });
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      vol.setData(bars.map(b => ({ time: b.date, value: b.volume ?? 0, color: alpha(b.close >= b.open ? c.up : c.down, 0.45) })));
    }

    let pane = 1;
    const paneHeight = narrow ? 90 : 110;
    if (prefs.ind.rsi) {
      const r = rsi(closes, 14), col = ind("rsi").color;
      const s = chart.addSeries(LineSeries, { color: col, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true, autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) }, pane);
      s.setData(toLine(r));
      for (const lvl of [70, 30]) s.createPriceLine({ price: lvl, color: c.t3, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
      legendSeries.push({ label: "RSI", color: col, values: r, pane: true });
      pane++;
    }
    if (prefs.ind.macd) {
      const m = macd(closes), col = ind("macd").color;
      const h = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane);
      h.setData(bars.map((b, i) => (m.hist[i] == null ? { time: b.date } : { time: b.date, value: m.hist[i], color: alpha(m.hist[i] >= 0 ? c.up : c.down, 0.5) })));
      const l = chart.addSeries(LineSeries, { color: col, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false }, pane);
      l.setData(toLine(m.line));
      const s = chart.addSeries(LineSeries, { color: "#F59E0B", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false }, pane);
      s.setData(toLine(m.signal));
      legendSeries.push({ label: "MACD", color: col, values: m.line, pane: true, fmt: i => `${fmtNum(m.line[i])}  sig ${fmtNum(m.signal[i])}` });
    }

    // Proportions, not pixel heights: autoSize lays the panes out after this
    // runs, and fixed heights set here were overridden (RSI ended up a sliver).
    // The price pane keeps its base height; each indicator pane gets paneHeight.
    const panes = chart.panes();
    if (panes.length > 1) {
      panes[0].setStretchFactor((height - paneHeight * (panes.length - 1)) / paneHeight);
      panes.slice(1).forEach(p => p.setStretchFactor(1));
    }

    for (const l of levelLines) {
      main.createPriceLine({ price: l.price, color: resolve(l.color), lineWidth: 1, lineStyle: l.style, axisLabelVisible: true, title: narrow ? "" : l.title });
    }
    for (const p of lines) {
      main.createPriceLine({ price: p, color: c.text, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" });
    }

    // Legend: the hovered bar, or the latest when the pointer leaves
    const legendAt = i => {
      if (i == null || i < 0 || i >= bars.length) return null;
      const b = bars[i], prev = bars[i - 1];
      return {
        bar: b, change: prev ? b.close - prev.close : null, changePct: prev ? ((b.close - prev.close) / prev.close) * 100 : null,
        extra: legendSeries.map(s => ({ label: s.label, color: s.color, pane: s.pane, text: s.fmt ? s.fmt(i) : fmtNum(s.values[i]) })),
      };
    };
    setLegend(legendAt(bars.length - 1));
    chart.subscribeCrosshairMove(param => {
      const i = param.logical != null && param.point ? Math.round(param.logical) : null;
      setLegend(legendAt(i == null ? bars.length - 1 : Math.min(i, bars.length - 1)));
    });
    chart.subscribeClick(param => {
      if (!drawingRef.current || !param.point) return;
      const price = mainRef.current?.coordinateToPrice(param.point.y);
      if (price == null || !(price > 0)) return;
      setDrawing(false);
      const rounded = Math.round(price * 100) / 100;
      saveLines([...(readJson(LINES_KEY, {})[symbol] ?? []), rounded]);
    });

    const kept = keepView.current;
    if (kept && kept.bars === bars) chart.timeScale().setVisibleLogicalRange(kept.range);
    else applyRange(range, chart);

    return () => {
      keepView.current = { bars, range: chart.timeScale().getVisibleLogicalRange() };
      chart.remove();
      chartRef.current = null; mainRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, prefs.type, prefs.ind, levelLines, lines, themeTick, narrow, symbol, height]);

  const pickRange = id => {
    setRange(id);
    if (id === "All" && span !== "max") { keepView.current = null; setSpan("max"); return; }
    applyRange(id);
  };
  const setPref = patch => setPrefs(p => ({ ...p, ...patch }));
  const toggleInd = id => setPrefs(p => ({ ...p, ind: { ...p.ind, [id]: !p.ind[id] } }));
  const pickInterval = id => { keepView.current = null; setPref({ interval: id }); };

  const addTyped = e => {
    e.preventDefault();
    const v = Number(String(typedPrice).replace(/[₹,\s]/g, ""));
    if (!(v > 0)) return;
    saveLines([...lines, Math.round(v * 100) / 100]);
    setTypedPrice(""); setDrawing(false);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else cardRef.current?.requestFullscreen?.();
  };
  const snapshot = () => {
    const canvas = chartRef.current?.takeScreenshot();
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${symbol}-${prefs.interval}-${bars.at(-1)?.date ?? "chart"}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  };

  const first = bars[0], last = bars.at(-1);
  const rangeBars = useMemo(() => {
    if (bars.length < 2) return null;
    const r = RANGES.find(x => x.id === range);
    if (range === "All" || !r) return bars;
    const lastDate = bars.at(-1).date;
    return bars.slice(indexFrom(bars, range === "YTD" ? `${lastDate.slice(0, 4)}-01-01` : monthsBack(lastDate, r.months)));
  }, [bars, range]);
  const rangeChange = rangeBars && rangeBars.length > 1 ? ((rangeBars.at(-1).close - rangeBars[0].close) / rangeBars[0].close) * 100 : null;
  const activeInd = INDICATORS.filter(i => prefs.ind[i.id]).length;

  const btn = (active, extra = {}) => ({
    display: "inline-flex", alignItems: "center", gap: 5, height: narrow ? 34 : 30, padding: narrow ? "0 10px" : "0 9px",
    borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${active ? "var(--accent)" : "var(--bdr2)"}`,
    background: active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--s3)",
    color: active ? "var(--accent)" : "var(--t2)", ...extra,
  });
  const group = { display: "inline-flex", gap: 4, flexWrap: "wrap" };

  return (
    <div ref={cardRef} style={{ border: "1px solid var(--bdr2)", borderRadius: fullscreen ? 0 : 14, background: "var(--s2)", padding: narrow ? 12 : 16, marginBottom: 16, ...(fullscreen ? { overflow: "auto" } : {}) }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
          Share price
          {data?.symbol && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 8 }}>{data.symbol}</span>}
        </div>
        {rangeChange != null && (
          // The sign carries the direction too, so it's never colour alone
          <div style={{ fontSize: 13, fontWeight: 700, color: rangeChange >= 0 ? "var(--green)" : "var(--red)", ...MONO }}>
            {rangeChange >= 0 ? "+" : "−"}{Math.abs(rangeChange).toFixed(1)}%
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 6 }}>over {range === "All" ? "all history" : range}</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div role="toolbar" aria-label="Chart settings" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <div role="group" aria-label="Chart type" style={group}>
          {TYPES.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setPref({ type: id })} aria-pressed={prefs.type === id} title={label} aria-label={narrow ? label : undefined} style={btn(prefs.type === id)}>
              <Icon size={14} aria-hidden="true" />{!narrow && label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Bar interval" style={group}>
          {INTERVALS.map(iv => (
            <button key={iv.id} type="button" onClick={() => pickInterval(iv.id)} aria-pressed={prefs.interval === iv.id} title={iv.title} aria-label={iv.title} style={btn(prefs.interval === iv.id, { minWidth: 32, justifyContent: "center" })}>{iv.label}</button>
          ))}
        </div>

        <div ref={menuRef} style={{ position: "relative" }}>
          <button type="button" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-haspopup="true" style={btn(menuOpen || activeInd > 0)}>
            <SlidersHorizontal size={14} aria-hidden="true" />Indicators{activeInd > 0 && <span style={MONO}> · {activeInd}</span>}
          </button>
          {menuOpen && (
            <div role="group" aria-label="Indicators" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, minWidth: 230, padding: 6, borderRadius: 10, background: "var(--s3)", border: "1px solid var(--bdr2)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
              {INDICATORS.map(i => (
                <label key={i.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 8px", borderRadius: 6, fontSize: 13, color: "var(--t1)", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!prefs.ind[i.id]} onChange={() => toggleInd(i.id)} />
                  {i.color && <span aria-hidden="true" style={{ width: 12, height: 3, borderRadius: 2, background: i.color, flexShrink: 0 }} />}
                  {i.label}
                </label>
              ))}
            </div>
          )}
        </div>

        <button type="button" onClick={() => setPref({ levels: !prefs.levels })} aria-pressed={prefs.levels} disabled={!levels} title="Fair value, reference levels and stop-loss from the valuation model" style={btn(prefs.levels && !!levels, !levels ? { opacity: 0.5, cursor: "not-allowed" } : {})}>
          <Layers size={14} aria-hidden="true" />Levels
        </button>
        <button type="button" onClick={() => setDrawing(d => !d)} aria-pressed={drawing} title="Horizontal line: click the chart, or type a price" style={btn(drawing)}>
          <Minus size={14} aria-hidden="true" />H-Line
        </button>

        <div style={{ ...group, marginLeft: "auto" }}>
          <button type="button" onClick={snapshot} title="Save the chart as an image" aria-label="Save the chart as an image" style={btn(false)}><Camera size={14} aria-hidden="true" /></button>
          {document.fullscreenEnabled && (
            <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"} style={btn(fullscreen)}>
              {fullscreen ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>

      {levelLines.length > 0 && last && (
        <ul aria-label="Model price levels" style={{ ...(narrow ? { display: "grid", gridTemplateColumns: "1fr 1fr" } : { display: "flex", flexWrap: "wrap" }), gap: "4px 14px", listStyle: "none", margin: "0 0 8px", padding: 0, fontSize: 12, color: "var(--t2)", ...MONO }}>
          {levelLines.map(l => {
            const d = (l.price - last.close) / last.close * 100;
            return (
              <li key={l.title} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", minWidth: 0 }}>
                <span aria-hidden="true" style={{ width: 14, borderTop: `2px ${l.style === LineStyle.Solid ? "solid" : l.style === LineStyle.Dotted ? "dotted" : "dashed"} ${l.color}` }} />
                {/* Phones: short names, whole rupees and percents, so each fits one line */}
                <span style={{ color: "var(--t1)" }}>{narrow ? l.short : l.title}</span> {narrow ? `₹${Math.round(l.price).toLocaleString("en-IN")}` : fmtRs(l.price)}
                <span style={{ color: "var(--t3)" }}>{d >= 0 ? "+" : "−"}{Math.abs(d).toFixed(narrow ? 0 : 1)}%</span>
              </li>
            );
          })}
        </ul>
      )}

      {(drawing || lines.length > 0) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8, fontSize: 12, color: "var(--t2)" }}>
          {drawing && (
            <form onSubmit={addTyped} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span>Click the chart, or type a price:</span>
              <input aria-label="Line price in rupees" inputMode="decimal" value={typedPrice} onChange={e => setTypedPrice(e.target.value)} placeholder="₹" autoFocus style={{ width: 96, height: 30 }} />
              <button type="submit" style={btn(false)}>Add</button>
            </form>
          )}
          {lines.map((p, i) => (
            <span key={`${p}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 2, height: narrow ? 34 : 26, padding: "0 2px 0 9px", borderRadius: 999, border: "1px solid var(--bdr2)", background: "var(--s3)", color: "var(--t1)", ...MONO }}>
              {fmtRs(p)}
              <button type="button" onClick={() => saveLines(lines.filter((_, j) => j !== i))} aria-label={`Remove line at ${fmtRs(p)}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: narrow ? 32 : 22, minHeight: narrow ? 32 : 22, border: 0, background: "none", color: "var(--t2)", cursor: "pointer", padding: 0, borderRadius: 999 }}>
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
          {lines.length > 1 && <button type="button" onClick={() => saveLines([])} style={{ ...btn(false), height: 26 }}>Clear lines</button>}
        </div>
      )}

      <div style={{ position: "relative" }}>
        {loading && !data && <div style={{ height, display: "flex", alignItems: "center", color: "var(--t3)", fontSize: 12 }}>Loading price history…</div>}
        {error && !loading && !data && (
          <div style={{ height, display: "flex", alignItems: "center", color: "var(--t3)", fontSize: 12, lineHeight: 1.6 }}>No price history available for this symbol. {error}</div>
        )}
        {data && bars.length < 2 && !loading && (
          <div style={{ height, display: "flex", alignItems: "center", color: "var(--t3)", fontSize: 12 }}>Not enough trading days to draw a chart.</div>
        )}

        {bars.length >= 2 && (
          <>
            {/* Legend over the chart, as on TradingView: the hovered bar's OHLC */}
            {legend && (
              <div aria-hidden="true" style={{ position: "absolute", top: 6, left: 8, zIndex: 3, pointerEvents: "none", fontSize: narrow ? 11 : 12, lineHeight: 1.6, color: "var(--t2)", ...MONO, textShadow: "0 0 4px var(--s2), 0 0 4px var(--s2)" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: "var(--t1)", fontWeight: 600 }}>{legend.bar.date}</span>
                  {prefs.type === "candles" || prefs.type === "bars" ? (
                    <span>O <b style={{ color: "var(--t1)", fontWeight: 600 }}>{fmtNum(legend.bar.open)}</b> H <b style={{ color: "var(--t1)", fontWeight: 600 }}>{fmtNum(legend.bar.high)}</b> L <b style={{ color: "var(--t1)", fontWeight: 600 }}>{fmtNum(legend.bar.low)}</b> C <b style={{ color: "var(--t1)", fontWeight: 600 }}>{fmtNum(legend.bar.close)}</b></span>
                  ) : (
                    <span>C <b style={{ color: "var(--t1)", fontWeight: 600 }}>{fmtNum(legend.bar.close)}</b></span>
                  )}
                  {legend.change != null && (
                    <span style={{ color: legend.change >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                      {legend.change >= 0 ? "+" : "−"}{fmtNum(Math.abs(legend.change))} ({legend.change >= 0 ? "+" : "−"}{Math.abs(legend.changePct).toFixed(2)}%)
                    </span>
                  )}
                  {prefs.ind.volume && legend.bar.volume != null && <span>Vol <b style={{ color: "var(--t1)", fontWeight: 600 }}>{fmtVol(legend.bar.volume)}</b></span>}
                </div>
                {legend.extra.filter(x => !x.pane).length > 0 && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {legend.extra.filter(x => !x.pane).map(x => <span key={x.label}><span style={{ color: x.color }}>{x.label}</span> {x.text}</span>)}
                  </div>
                )}
                {legend.extra.filter(x => x.pane).length > 0 && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {legend.extra.filter(x => x.pane).map(x => <span key={x.label}><span style={{ color: x.color }}>{x.label}</span> {x.text}</span>)}
                  </div>
                )}
              </div>
            )}
            <div
              ref={hostRef}
              role="figure"
              aria-label={`${name || symbol} ${prefs.type} chart, ${INTERVALS.find(i => i.id === prefs.interval)?.title.toLowerCase()} bars, ${first?.date} to ${last?.date}. Last close ${fmtRs(last?.close)}${rangeChange != null ? `, ${rangeChange >= 0 ? "up" : "down"} ${Math.abs(rangeChange).toFixed(1)} percent over ${range === "All" ? "all history" : range}` : ""}.${levelLines.length ? ` Levels shown: ${levelLines.map(l => `${l.title} ${fmtRs(l.price)}`).join(", ")}.` : ""}`}
              style={{ height, width: "100%", cursor: drawing ? "crosshair" : undefined, opacity: loading ? 0.6 : 1 }}
            />
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div role="group" aria-label="Date range" style={group}>
          {RANGES.map(r => (
            <button key={r.id} type="button" onClick={() => pickRange(r.id)} aria-pressed={range === r.id} style={btn(range === r.id, { minWidth: narrow ? 44 : 38, justifyContent: "center" })}>{r.id}</button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--t3)" }}>
          {data?.stale ? `${data.staleReason} · ` : ""}{INTERVALS.find(i => i.id === prefs.interval)?.title} bars · Yahoo Finance · drag to pan, scroll to zoom
        </span>
      </div>
    </div>
  );
}
