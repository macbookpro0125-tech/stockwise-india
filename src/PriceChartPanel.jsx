import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  createChart, CandlestickSeries, BarSeries, LineSeries, AreaSeries, HistogramSeries,
  ColorType, CrosshairMode, LineStyle,
} from "lightweight-charts";
import { ChartCandlestick, ChartNoAxesColumn, ChartLine, ChartArea, SlidersHorizontal, Minus, X, Maximize2, Minimize2, Camera, Layers } from "lucide-react";
import { api } from "./api.js";
import { aggregateBars, sma, ema, bollinger, rsi, macd, indexFrom } from "./chartMath.js";
import { pivotPoints, PIVOT_LEVELS, atr, supertrend, psar, stochastic, adx, obv, cci, williamsR, mfi, donchian } from "./chartIndicators.js";

// Attribution notice (Lightweight Charts licence, Apache 2.0):
//   TradingView Lightweight Charts™ — Copyright TradingView, Inc. https://www.tradingview.com/
// The on-chart logo is off; the "Chart by TradingView" link under the chart is
// the link the licence asks for.
//
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
  { id: "1Y", months: 12 }, { id: "3Y", months: 36 }, { id: "5Y", months: 60 }, { id: "All" },
];
// Overlay colours are for telling lines apart; the legend names each one
// Grouped as the menu shows them. On the price: moving averages, trend and
// bands, pivot levels. pane: true ones get a pane of their own under it.
// Colours are for telling lines apart; the legend names each one.
const INDICATORS = [
  { id: "ma20", label: "MA 20", color: "#E2A03F", group: "Moving averages" },
  { id: "ma50", label: "MA 50", color: "#3B82F6", group: "Moving averages" },
  { id: "ma200", label: "MA 200", color: "#D946EF", group: "Moving averages" },
  { id: "ema20", label: "EMA 20", color: "#14B8A6", group: "Moving averages" },
  { id: "ema50", label: "EMA 50", color: "#F97316", group: "Moving averages" },
  { id: "ema200", label: "EMA 200", color: "#EAB308", group: "Moving averages" },
  { id: "bb", label: "Bollinger Bands (20, 2)", color: "#8B95A7", group: "Trend & bands" },
  { id: "supertrend", label: "Supertrend (10, 3)", color: "#22C55E", group: "Trend & bands" },
  { id: "psar", label: "Parabolic SAR", color: "#E879F9", group: "Trend & bands" },
  { id: "donchian", label: "Donchian channel (20)", color: "#60A5FA", group: "Trend & bands" },
  { id: "pivots", label: "Pivot points", color: "#F59E0B", group: "Levels" },
  { id: "volume", label: "Volume", group: "Volume" },
  { id: "obv", label: "On-balance volume", color: "#22D3EE", group: "Volume", pane: true },
  { id: "mfi", label: "Money flow (14)", color: "#34D399", group: "Volume", pane: true },
  { id: "rsi", label: "RSI (14)", color: "#A78BFA", group: "Oscillators", pane: true },
  { id: "macd", label: "MACD (12, 26, 9)", color: "#3B82F6", group: "Oscillators", pane: true },
  { id: "stoch", label: "Stochastic (14, 3, 3)", color: "#F472B6", group: "Oscillators", pane: true },
  { id: "adx", label: "ADX / DMI (14)", color: "#FBBF24", group: "Oscillators", pane: true },
  { id: "atr", label: "ATR (14)", color: "#A3E635", group: "Oscillators", pane: true },
  { id: "cci", label: "CCI (20)", color: "#FB923C", group: "Oscillators", pane: true },
  { id: "willr", label: "Williams %R (14)", color: "#C084FC", group: "Oscillators", pane: true },
];
const GROUPS = ["Moving averages", "Trend & bands", "Levels", "Volume", "Oscillators"];
// Pivot points: worked out from the previous week, month, quarter or year
// (chartIndicators.js), offered for periods longer than a bar
const PIVOT_KINDS = [["classic", "Classic"], ["fibonacci", "Fibonacci"], ["camarilla", "Camarilla"]];
const PIVOT_BASES = { D: [["W", "week"], ["M", "month"], ["Q", "quarter"], ["Y", "year"]], W: [["M", "month"], ["Q", "quarter"], ["Y", "year"]], M: [["Q", "quarter"], ["Y", "year"]] };
const pivotBasisFor = (interval, pref) => ((PIVOT_BASES[interval] ?? PIVOT_BASES.D).some(([id]) => id === pref) ? pref : interval === "M" ? "Y" : "M");
const PIVOT_COLORS = { P: "#F59E0B", R: "#FB7185", S: "#38BDF8" };
const DEFAULT_PREFS = { type: "candles", interval: "D", levels: true, pivotKind: "classic", pivotBasis: "M", ind: { ma50: true, ma200: true, volume: true } };

const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

const fmtNum = n => (n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtRs = n => (n == null ? "—" : "₹" + fmtNum(n));
const fmtVol = n => (n == null ? "—" : n < 0 ? `−${fmtVol(-n)}` : n >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(2)} L` : Number(n).toLocaleString("en-IN"));
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

// The chart on a page of its own (/chart/TCS, ChartPage.jsx): what the expand
// button opens in a new tab on a phone, where full screen isn't available or
// leaves no room. The levels and name ride along in the address.
export function chartPageUrl(symbol, name, levels) {
  const q = new URLSearchParams();
  if (name) q.set("n", name);
  if (levels) q.set("lv", LEVEL_KEYS.map(k => (levels[k] > 0 ? Math.round(levels[k] * 100) / 100 : "")).join(","));
  const qs = q.toString();
  return `/chart/${encodeURIComponent(symbol)}${qs ? `?${qs}` : ""}`;
}
export const LEVEL_KEYS = ["target", "fv25", "p1", "p2", "p3", "stopLoss"];

// page: drawn as the whole page (ChartPage.jsx) — fills the window, no card
export default function PriceChartPanel({ symbol, name, levels, page = false }) {
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
  const [vh, setVh] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));
  const [expanded, setExpanded] = useState(false);
  const [levelTags, setLevelTags] = useState([]);
  const [pivotNow, setPivotNow] = useState(null);

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
    if (!page) return;
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [page]);

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

  // Expand on a phone: the chart over the whole screen, on top of the page,
  // which stays where it was. It's a history entry, so Back (the browser's,
  // or Android's, App.jsx) closes it. It used to open /chart/… in a new tab,
  // which in the Android app could mean leaving the app.
  useEffect(() => {
    if (!expanded) return;
    const onPop = () => { if (!window.history.state?.chartOverlay) setExpanded(false); };
    const onKey = e => { if (e.key === "Escape") closeExpanded(); };
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      // Settings and lines changed in the expanded chart carry back here
      const p = readJson(PREFS_KEY, DEFAULT_PREFS);
      setPrefs({ ...DEFAULT_PREFS, ...p, ind: { ...(p.ind ?? DEFAULT_PREFS.ind) } });
      setLines(readJson(LINES_KEY, {})[symbol] ?? []);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);
  const openExpanded = e => {
    e.preventDefault();
    window.history.pushState({ ...(window.history.state ?? {}), chartOverlay: true }, "");
    setExpanded(true);
  };
  function closeExpanded() {
    if (window.history.state?.chartOverlay) window.history.back();
    else setExpanded(false);
  }

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
  const extraPanes = INDICATORS.filter(i => i.pane && prefs.ind[i.id]).length;
  const pivotBasis = pivotBasisFor(prefs.interval, prefs.pivotBasis);
  const height = page
    ? Math.max(300, vh - (narrow ? 330 : 260))   // pane proportions only; the page lays out by flex
    : fullscreen
      ? Math.max(320, vh - (narrow ? 210 : 150))
      : (narrow ? 380 : 400) + extraPanes * (narrow ? 90 : 110);

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
        // No logo over the candles: the licence asks for a link to TradingView
        // on the page, which the credit under the chart gives instead
        attributionLogo: false,
      },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, rightOffset: 3, minBarSpacing: 0.5 },
      localization: { locale: "en-IN" },
      kineticScroll: { touch: !reducedMotion(), mouse: false },
      // An up-or-down swipe over the chart scrolls the page, as on any other
      // part of it; sideways drags pan and pinches zoom. On the chart's own
      // page there's nothing to scroll, so vertical drags move the price scale.
      handleScroll: { vertTouchDrag: page, horzTouchDrag: true, mouseWheel: true, pressedMouseMove: true },
    });
    chartRef.current = chart;

    // Today's candle while the market is open (bar.partial, set by the server)
    // is drawn at half strength: a price in progress, not a close
    const ohlc = bars.map(b => {
      const bar = { time: b.date, open: b.open, high: b.high, low: b.low, close: b.close };
      if (!b.partial) return bar;
      const col = alpha(b.close >= b.open ? c.up : c.down, 0.45);
      return { ...bar, color: col, wickColor: col, borderColor: col };
    });
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
    // On a phone whole rupees above ₹100: ".00" on every label cost the candles
    // a fifth of the screen's width
    const priceFormat = { type: "custom", minMove: 0.01, formatter: p => (p < 0 ? "" : narrow && Math.abs(p) >= 100 ? Math.round(p).toLocaleString("en-IN") : fmtNum(p)) };
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
    main.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: withVolume ? (narrow ? 0.15 : 0.24) : 0.06 } });

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
    if (prefs.ind.ema50) legendSeries.push({ label: "EMA 50", color: ind("ema50").color, values: ema(closes, 50), series: overlay(ema(closes, 50), ind("ema50").color) });
    if (prefs.ind.ema200) legendSeries.push({ label: "EMA 200", color: ind("ema200").color, values: ema(closes, 200), series: overlay(ema(closes, 200), ind("ema200").color) });
    if (prefs.ind.donchian) {
      const d = donchian(bars, 20), col = ind("donchian").color;
      overlay(d.upper, col, { lineWidth: 1 });
      overlay(d.mid, col, { lineWidth: 1, lineStyle: LineStyle.Dotted });
      overlay(d.lower, col, { lineWidth: 1 });
      legendSeries.push({ label: "DC", color: col, values: d.mid, fmt: i => `${fmtNum(d.upper[i])} / ${fmtNum(d.lower[i])}` });
    }
    // The chart joins a line across missing points, and a point's colour
    // paints the segment that starts at it: so a line breaks where its point
    // before the break is transparent
    if (prefs.ind.supertrend) {
      // Green while it trends up, red while down, and no line across the
      // candles where it flips from one side to the other
      const st = supertrend(bars, 10, 3);
      const s = chart.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(bars.map((b, i) => (st.value[i] == null ? { time: b.date }
        : { time: b.date, value: st.value[i], color: st.up[i + 1] != null && st.up[i + 1] !== st.up[i] ? "transparent" : st.up[i] ? c.up : c.down })));
      legendSeries.push({ label: "Supertrend", color: ind("supertrend").color, values: st.value, fmt: i => (st.value[i] == null ? "—" : `${fmtNum(st.value[i])} ${st.up[i] ? "up" : "down"}`) });
    }
    if (prefs.ind.psar) {
      const sar = psar(bars), col = ind("psar").color;
      overlay(sar, col, { lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: narrow ? 1.5 : 2 });
      legendSeries.push({ label: "SAR", color: col, values: sar });
    }
    // Pivots: a line per level for each period, broken where the next period
    // starts (its last point transparent); left out of the price scale's
    // range, so far ones don't squash the candles
    let pivotsLatest = null;
    if (prefs.ind.pivots) {
      const pv = pivotPoints(bars, pivotBasis, prefs.pivotKind);
      for (const L of PIVOT_LEVELS) {
        const s = chart.addSeries(LineSeries, {
          color: PIVOT_COLORS[L[0]], lineWidth: L === "P" ? 1.5 : 1, lineStyle: L === "P" ? LineStyle.Solid : LineStyle.Dashed,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: () => null,
        });
        s.setData(bars.map((b, i) => (pv[L][i] == null ? { time: b.date } : { time: b.date, value: pv[L][i], ...(pv.starts[i + 1] ? { color: "transparent" } : {}) })));
      }
      const lastI = bars.length - 1;
      if (pv.P[lastI] != null) pivotsLatest = Object.fromEntries(PIVOT_LEVELS.map(L => [L, pv[L][lastI]]));
    }
    setPivotNow(pivotsLatest);

    if (withVolume) {
      const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", priceLineVisible: false, lastValueVisible: false });
      vol.priceScale().applyOptions({ scaleMargins: { top: narrow ? 0.88 : 0.8, bottom: 0 } });
      vol.setData(bars.map(b => ({ time: b.date, value: b.volume ?? 0, color: alpha(b.close >= b.open ? c.up : c.down, 0.45) })));
    }

    let pane = 1;
    const paneHeight = narrow ? 90 : 110;
    // Each pane indicator in the menu's order, one pane each, with its usual
    // guide lines (70/30 for RSI, 80/20 for Stochastic and MFI…)
    const fixed = (lo, hi) => () => ({ priceRange: { minValue: lo, maxValue: hi } });
    const guides = (s, levelsAt) => { for (const lvl of levelsAt) s.createPriceLine({ price: lvl, color: c.t3, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false }); };
    const paneLine = (vals, color, opts = {}) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true, ...opts }, pane);
      s.setData(toLine(vals));
      return s;
    };
    for (const def of INDICATORS.filter(i => i.pane && prefs.ind[i.id])) {
      const col = def.color;
      if (def.id === "rsi") {
        const r = rsi(closes, 14);
        guides(paneLine(r, col, { autoscaleInfoProvider: fixed(0, 100) }), [70, 30]);
        legendSeries.push({ label: "RSI", color: col, values: r, pane: true });
      } else if (def.id === "macd") {
        const m = macd(closes);
        const h = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane);
        h.setData(bars.map((b, i) => (m.hist[i] == null ? { time: b.date } : { time: b.date, value: m.hist[i], color: alpha(m.hist[i] >= 0 ? c.up : c.down, 0.5) })));
        paneLine(m.line, col, { lastValueVisible: false });
        paneLine(m.signal, "#F59E0B", { lastValueVisible: false });
        legendSeries.push({ label: "MACD", color: col, values: m.line, pane: true, fmt: i => `${fmtNum(m.line[i])}  sig ${fmtNum(m.signal[i])}` });
      } else if (def.id === "stoch") {
        const st = stochastic(bars, 14, 3, 3);
        guides(paneLine(st.k, col, { autoscaleInfoProvider: fixed(0, 100) }), [80, 20]);
        paneLine(st.d, "#F59E0B", { lastValueVisible: false, autoscaleInfoProvider: fixed(0, 100) });
        legendSeries.push({ label: "Stoch", color: col, values: st.k, pane: true, fmt: i => `%K ${fmtNum(st.k[i])} %D ${fmtNum(st.d[i])}` });
      } else if (def.id === "adx") {
        const a = adx(bars, 14);
        guides(paneLine(a.adx, col), [25]);
        paneLine(a.plusDI, c.up, { lineWidth: 1, lastValueVisible: false });
        paneLine(a.minusDI, c.down, { lineWidth: 1, lastValueVisible: false });
        legendSeries.push({ label: "ADX", color: col, values: a.adx, pane: true, fmt: i => `${fmtNum(a.adx[i])} +DI ${fmtNum(a.plusDI[i])} −DI ${fmtNum(a.minusDI[i])}` });
      } else if (def.id === "atr") {
        const a = atr(bars, 14);
        paneLine(a, col);
        legendSeries.push({ label: "ATR", color: col, values: a, pane: true });
      } else if (def.id === "cci") {
        const v = cci(bars, 20);
        guides(paneLine(v, col), [100, -100]);
        legendSeries.push({ label: "CCI", color: col, values: v, pane: true });
      } else if (def.id === "willr") {
        const v = williamsR(bars, 14);
        guides(paneLine(v, col, { autoscaleInfoProvider: fixed(-100, 0) }), [-20, -80]);
        legendSeries.push({ label: "%R", color: col, values: v, pane: true });
      } else if (def.id === "mfi") {
        const v = mfi(bars, 14);
        guides(paneLine(v, col, { autoscaleInfoProvider: fixed(0, 100) }), [80, 20]);
        legendSeries.push({ label: "MFI", color: col, values: v, pane: true });
      } else if (def.id === "obv") {
        const v = obv(bars);
        paneLine(v, col, { priceFormat: { type: "volume" } });
        legendSeries.push({ label: "OBV", color: col, values: v, pane: true, fmt: i => fmtVol(v[i]) });
      }
      pane++;
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
      // A phone's price scale is too short for six more labels: they hid its
      // numbers. There each line gets a small tag drawn over the chart
      // (levelTags below), and the list above the chart gives its price.
      main.createPriceLine({ price: l.price, color: resolve(l.color), lineWidth: 1, lineStyle: l.style, axisLabelVisible: !narrow, title: narrow ? "" : l.title });
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

    // The level tags on a phone, placed where each line is drawn: the price
    // scale rescales as the view moves, so they're placed again each time.
    // Tags closer than a tag's height step left rather than overlap.
    let frame = 0;
    const placeTags = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const items = [
          ...(narrow ? levelLines.map(l => ({ key: l.title, text: l.short, color: resolve(l.color), price: l.price })) : []),
          ...(pivotsLatest ? PIVOT_LEVELS.map(L => ({ key: `pivot-${L}`, text: L, color: PIVOT_COLORS[L[0]], price: pivotsLatest[L] })) : []),
        ];
        if (!items.length || chartRef.current !== chart) { setLevelTags([]); return; }
        const paneH = chart.panes()[0]?.getHeight?.() ?? host.clientHeight;
        const right = chart.priceScale("right").width() + 4;
        const placed = [];
        for (const t of items.sort((a, b) => b.price - a.price)) {
          const y = main.priceToCoordinate(t.price);
          if (y == null || y < 8 || y > paneH - 8) continue;
          const near = placed.filter(p => Math.abs(p.y - y) < 15).length;
          placed.push({ ...t, y, right: right + near * 48 });
        }
        setLevelTags(placed);
      });
    };
    placeTags();
    chart.timeScale().subscribeVisibleLogicalRangeChange(placeTags);
    // the chart's height settles after this (the full-screen chart fills the
    // screen by flex), and a taller chart rescales its prices
    const tagRo = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(placeTags);
    tagRo?.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      tagRo?.disconnect();
      keepView.current = { bars, range: chart.timeScale().getVisibleLogicalRange() };
      chart.remove();
      chartRef.current = null; mainRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, prefs.type, prefs.ind, prefs.pivotKind, pivotBasis, levelLines, lines, themeTick, narrow, symbol, height, page]);

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
  const group = { display: "inline-flex", gap: 4, flexWrap: narrow ? "nowrap" : "wrap" };
  const sheetLabel = { margin: "0 0 6px 2px", fontSize: 11, fontWeight: 650, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--t3)" };
  const basisWord = (PIVOT_BASES[prefs.interval] ?? PIVOT_BASES.D).find(([id]) => id === pivotBasis)?.[1] ?? "month";
  // Every indicator, in its group; pivot points open their own settings
  const picker = compact => (
    <div style={{ display: "grid", gap: compact ? 10 : 6 }}>
      {GROUPS.map(g => (
        <div key={g}>
          <div style={{ ...sheetLabel, margin: compact ? sheetLabel.margin : "4px 0 2px 8px" }}>{g}</div>
          <div role="group" aria-label={g} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2 }}>
            {INDICATORS.filter(i => i.group === g).map(i => (
              <label key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: compact ? 40 : 32, padding: "0 8px", borderRadius: 6, fontSize: 13, color: "var(--t1)", cursor: "pointer" }}>
                <input type="checkbox" checked={!!prefs.ind[i.id]} onChange={() => toggleInd(i.id)} />
                {i.color && <span aria-hidden="true" style={{ width: 10, height: 3, borderRadius: 2, background: i.color, flexShrink: 0 }} />}
                {compact ? i.label.replace(/ \(.*\)$/, "") : i.label}
              </label>
            ))}
          </div>
          {g === "Levels" && prefs.ind.pivots && (
            <div style={{ display: "grid", gap: 6, margin: "4px 0 2px 8px" }}>
              <div role="group" aria-label="Pivot type" style={compact ? { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4 } : { display: "flex", gap: 4, flexWrap: "wrap" }}>
                {PIVOT_KINDS.map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setPref({ pivotKind: id })} aria-pressed={prefs.pivotKind === id} style={btn(prefs.pivotKind === id, { height: compact ? 34 : 28, fontSize: 11.5, justifyContent: "center", ...(compact ? { padding: 0 } : {}) })}>{label}</button>
                ))}
              </div>
              <div role="group" aria-label="Pivots from the previous" style={compact
                ? { display: "grid", gridTemplateColumns: `auto repeat(${(PIVOT_BASES[prefs.interval] ?? PIVOT_BASES.D).length}, minmax(0, 1fr))`, gap: 4, alignItems: "center", fontSize: 11.5, color: "var(--t3)" }
                : { display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", fontSize: 11.5, color: "var(--t3)" }}>
                <span>{compact ? "From" : "From the last"}</span>
                {(PIVOT_BASES[prefs.interval] ?? PIVOT_BASES.D).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setPref({ pivotBasis: id })} aria-pressed={pivotBasis === id} aria-label={`From the last ${label}`} style={btn(pivotBasis === id, { height: compact ? 34 : 28, fontSize: 11.5, justifyContent: "center", ...(compact ? { padding: 0 } : {}) })}>{label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div ref={cardRef} className={page ? "chart-page-card" : undefined} style={page
      // The chart page is a column the height of the screen: every control
      // keeps its size and the chart takes what's left (className below)
      ? { background: "var(--s2)", padding: narrow ? "10px 10px 12px" : 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }
      : { border: "1px solid var(--bdr2)", borderRadius: fullscreen ? 0 : 14, background: "var(--s2)", padding: narrow ? 12 : 16, marginBottom: 16, ...(fullscreen ? { overflow: "auto" } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: narrow ? 8 : 12, flexWrap: narrow ? "nowrap" : "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
          Share price
          {data?.symbol && !narrow && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 8 }}>{data.symbol}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          {rangeChange != null && (
            // The sign carries the direction too, so it's never colour alone
            <div style={{ fontSize: 13, fontWeight: 700, color: rangeChange >= 0 ? "var(--green)" : "var(--red)", ...MONO }}>
              {rangeChange >= 0 ? "+" : "−"}{Math.abs(rangeChange).toFixed(1)}%
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 6 }}>{narrow ? (range === "All" ? "all" : range) : `over ${range === "All" ? "all history" : range}`}</span>
            </div>
          )}
          {/* A phone expands the chart over the whole screen (see openExpanded) */}
          {narrow && !page && (
            <a href={chartPageUrl(symbol, name, levels)} onClick={openExpanded} aria-label="Expand the chart to full screen" style={{ ...btn(false), textDecoration: "none", gap: 6 }}>
              <Maximize2 size={14} aria-hidden="true" />Expand
            </a>
          )}
        </div>
      </div>

      {/* Toolbar. A phone has one row — the bar interval and "Chart options",
          which opens everything else below it; the row of every control
          scrolled sideways there and hid most of them. */}
      <div ref={menuRef}>
      {!narrow ? (
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

        <div style={{ position: "relative" }}>
          <button type="button" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-haspopup="true" style={btn(menuOpen || activeInd > 0)}>
            <SlidersHorizontal size={14} aria-hidden="true" />Indicators{activeInd > 0 && <span style={MONO}> · {activeInd}</span>}
          </button>
          {menuOpen && !narrow && (
            <div role="group" aria-label="Indicators" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, width: 440, maxHeight: "min(70vh, 560px)", overflowY: "auto", overscrollBehavior: "contain", padding: 6, borderRadius: 10, background: "var(--s3)", border: "1px solid var(--bdr2)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
              {picker(false)}
            </div>
          )}
        </div>

        <button type="button" onClick={() => setPref({ levels: !prefs.levels })} aria-pressed={prefs.levels} disabled={!levels} title="Fair value, reference levels and stop-loss from the valuation model" style={btn(prefs.levels && !!levels, !levels ? { opacity: 0.5, cursor: "not-allowed" } : {})}>
          <Layers size={14} aria-hidden="true" />Levels
        </button>
        <button type="button" onClick={() => setDrawing(d => !d)} aria-pressed={drawing} title="Horizontal line: click the chart, or type a price" style={btn(drawing)}>
          <Minus size={14} aria-hidden="true" />H-Line
        </button>

        <div style={{ ...group, marginLeft: narrow ? 0 : "auto", flexWrap: "nowrap" }}>
          <button type="button" onClick={snapshot} title="Save the chart as an image" aria-label="Save the chart as an image" style={btn(false)}><Camera size={14} aria-hidden="true" /></button>
          {!narrow && !page && document.fullscreenEnabled && (
            <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"} style={btn(fullscreen)}>
              {fullscreen ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div role="group" aria-label="Bar interval" style={group}>
            {INTERVALS.map(iv => (
              <button key={iv.id} type="button" onClick={() => pickInterval(iv.id)} aria-pressed={prefs.interval === iv.id} title={iv.title} aria-label={iv.title} style={btn(prefs.interval === iv.id, { minWidth: 40, justifyContent: "center" })}>{iv.label}</button>
            ))}
          </div>
          <button type="button" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-controls={`chart-options-${symbol}${page ? "-page" : ""}`} style={btn(menuOpen, { marginLeft: "auto" })}>
            <SlidersHorizontal size={14} aria-hidden="true" />Chart options{activeInd > 0 && <span style={MONO}> · {activeInd}</span>}
          </button>
        </div>
      )}
      {menuOpen && narrow && (
        <div id={`chart-options-${symbol}${page ? "-page" : ""}`} role="group" aria-label="Chart options" style={{ display: "grid", gap: 12, padding: 10, marginBottom: 8, borderRadius: 12, background: "var(--s3)", border: "1px solid var(--bdr2)" }}>
          <div>
            <div style={sheetLabel}>Chart type</div>
            <div role="group" aria-label="Chart type" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4 }}>
              {TYPES.map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => setPref({ type: id })} aria-pressed={prefs.type === id} style={btn(prefs.type === id, { flexDirection: "column", height: 52, gap: 3, padding: 0, justifyContent: "center", fontSize: 11 })}>
                  <Icon size={16} aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          </div>
          <div role="group" aria-label="Indicators">{picker(true)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4 }}>
            <button type="button" onClick={() => setPref({ levels: !prefs.levels })} aria-pressed={prefs.levels} disabled={!levels} style={btn(prefs.levels && !!levels, { justifyContent: "center", ...(!levels ? { opacity: 0.5, cursor: "not-allowed" } : {}) })}>
              <Layers size={14} aria-hidden="true" />Levels
            </button>
            <button type="button" onClick={() => { setDrawing(d => !d); setMenuOpen(false); }} aria-pressed={drawing} style={btn(drawing, { justifyContent: "center" })}>
              <Minus size={14} aria-hidden="true" />Line
            </button>
            <button type="button" onClick={snapshot} style={btn(false, { justifyContent: "center" })}>
              <Camera size={14} aria-hidden="true" />Image
            </button>
          </div>
        </div>
      )}
      </div>

      {levelLines.length > 0 && last && (
        <ul aria-label="Model price levels" style={{ ...(narrow ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "2px 12px" } : { display: "flex", flexWrap: "wrap", gap: "4px 14px" }), listStyle: "none", margin: "0 0 8px", padding: 0, fontSize: 12, color: "var(--t2)", ...MONO }}>
          {levelLines.map(l => {
            const d = (l.price - last.close) / last.close * 100;
            return (
              <li key={l.title} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", minWidth: 0 }}>
                <span aria-hidden="true" style={{ width: 14, flexShrink: 0, borderTop: `2px ${l.style === LineStyle.Solid ? "solid" : l.style === LineStyle.Dotted ? "dotted" : "dashed"} ${l.color}` }} />
                {/* Phones: short names, whole rupees and percents, so each fits one line */}
                <span style={{ color: "var(--t1)" }}>{narrow ? l.short : l.title}</span> {narrow ? `₹${Math.round(l.price).toLocaleString("en-IN")}` : fmtRs(l.price)}
                <span style={{ color: "var(--t3)" }}>{d >= 0 ? "+" : "−"}{Math.abs(d).toFixed(narrow ? 0 : 1)}%</span>
              </li>
            );
          })}
        </ul>
      )}

      {pivotNow && (
        <div aria-label="Pivot points" style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", alignItems: "baseline", margin: "0 0 8px", fontSize: 12, color: "var(--t2)", ...MONO }}>
          <span style={{ color: "var(--t3)", fontFamily: "inherit" }}>{PIVOT_KINDS.find(([id]) => id === prefs.pivotKind)?.[1] ?? "Classic"} pivots, from the last {basisWord}:</span>
          {PIVOT_LEVELS.map(L => (
            <span key={L} style={{ whiteSpace: "nowrap" }}><b style={{ color: PIVOT_COLORS[L[0]], fontWeight: 650 }}>{L}</b> {narrow && Math.abs(pivotNow[L]) >= 100 ? Math.round(pivotNow[L]).toLocaleString("en-IN") : fmtNum(pivotNow[L])}</span>
          ))}
        </div>
      )}

      {(drawing || lines.length > 0) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8, fontSize: 12, color: "var(--t2)" }}>
          {drawing && (
            <form onSubmit={addTyped} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span>{narrow ? "Tap the chart, or type a price:" : "Click the chart, or type a price:"}</span>
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

      <div style={page ? { position: "relative", flex: "1 1 auto", minHeight: 240, display: "flex", flexDirection: "column" } : { position: "relative" }}>
        {loading && !data && <div style={{ height, display: "flex", alignItems: "center", color: "var(--t3)", fontSize: 12 }}>Loading price history…</div>}
        {error && !loading && !data && (
          <div style={{ height, display: "flex", alignItems: "center", color: "var(--t3)", fontSize: 12, lineHeight: 1.6 }}>No price history available for this symbol. {error}</div>
        )}
        {data && bars.length < 2 && !loading && (
          <div style={{ height, display: "flex", alignItems: "center", color: "var(--t3)", fontSize: 12 }}>Not enough trading days to draw a chart.</div>
        )}

        {bars.length >= 2 && (
          <>
            {/* Legend: over the chart as on TradingView; above it on a phone,
                where over it would cover a third of the candles */}
            {legend && (
              <div aria-hidden="true" style={narrow
                ? { minHeight: 40, marginBottom: 4, fontSize: 11.5, lineHeight: 1.7, color: "var(--t2)", ...MONO }
                : { position: "absolute", top: 6, left: 8, zIndex: 3, pointerEvents: "none", fontSize: 12, lineHeight: 1.6, color: "var(--t2)", ...MONO, textShadow: "0 0 4px var(--s2), 0 0 4px var(--s2)" }}>
                {(() => {
                  const b = legend.bar, ohlc = prefs.type === "candles" || prefs.type === "bars";
                  const v = n => <b style={{ color: "var(--t1)", fontWeight: 600 }}>{fmtNum(n)}</b>;
                  const change = legend.change != null && (
                    <span style={{ color: legend.change >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                      {legend.change >= 0 ? "+" : "−"}{fmtNum(Math.abs(legend.change))} ({legend.change >= 0 ? "+" : "−"}{Math.abs(legend.changePct).toFixed(2)}%)
                    </span>
                  );
                  const vol = prefs.ind.volume && b.volume != null && <span>Vol <b style={{ color: "var(--t1)", fontWeight: 600 }}>{fmtVol(b.volume)}</b></span>;
                  // A phone puts the close and change first, open/high/low under them
                  return narrow ? (
                    <>
                      <div className="chart-row" style={{ gap: 8 }}>
                        <span style={{ color: "var(--t1)", fontWeight: 600 }}>{b.date}{b.partial && <span style={{ color: "var(--yellow)", fontWeight: 500 }}> · in progress</span>}</span>
                        <span>C {v(b.close)}</span>{change}
                      </div>
                      {ohlc && <div className="chart-row" style={{ gap: 8 }}><span>O {v(b.open)} H {v(b.high)} L {v(b.low)}</span>{vol}</div>}
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: "var(--t1)", fontWeight: 600 }}>{b.date}{b.partial && <span style={{ color: "var(--yellow)", fontWeight: 500 }}> · in progress</span>}</span>
                      {ohlc ? <span>O {v(b.open)} H {v(b.high)} L {v(b.low)} C {v(b.close)}</span> : <span>C {v(b.close)}</span>}
                      {change}{vol}
                    </div>
                  );
                })()}
                {legend.extra.filter(x => !x.pane).length > 0 && (
                  <div className={narrow ? "chart-row" : undefined} style={narrow ? { gap: 10 } : { display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {legend.extra.filter(x => !x.pane).map(x => <span key={x.label}><span style={{ color: x.color }}>{x.label}</span> {x.text}</span>)}
                  </div>
                )}
                {legend.extra.filter(x => x.pane).length > 0 && (
                  <div className={narrow ? "chart-row" : undefined} style={narrow ? { gap: 10 } : { display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {legend.extra.filter(x => x.pane).map(x => <span key={x.label}><span style={{ color: x.color }}>{x.label}</span> {x.text}</span>)}
                  </div>
                )}
              </div>
            )}
            {levelTags.length > 0 && (
              <div aria-hidden="true" style={{ position: "relative", height: 0, zIndex: 2 }}>
                {levelTags.map(t => (
                  <span key={t.key} className="chart-level-tag" style={{ top: t.y, right: t.right, color: t.color, borderColor: t.color }}>{t.text}</span>
                ))}
              </div>
            )}
            <div
              ref={hostRef}
              role="figure"
              aria-label={`${name || symbol} ${prefs.type} chart, ${INTERVALS.find(i => i.id === prefs.interval)?.title.toLowerCase()} bars, ${first?.date} to ${last?.date}. ${last?.partial ? "Latest price, today in progress," : "Last close"} ${fmtRs(last?.close)}${rangeChange != null ? `, ${rangeChange >= 0 ? "up" : "down"} ${Math.abs(rangeChange).toFixed(1)} percent over ${range === "All" ? "all history" : range}` : ""}.${levelLines.length ? ` Levels shown: ${levelLines.map(l => `${l.title} ${fmtRs(l.price)}`).join(", ")}.` : ""}`}
              style={{ ...(page ? { flex: 1, minHeight: 200 } : { height }), width: "100%", cursor: drawing ? "crosshair" : undefined, opacity: loading ? 0.6 : 1 }}
            />
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div role="group" aria-label="Date range" style={narrow ? { display: "grid", gridTemplateColumns: `repeat(${RANGES.length}, minmax(0, 1fr))`, gap: 4, width: "100%" } : group}>
          {RANGES.map(r => (
            <button key={r.id} type="button" onClick={() => pickRange(r.id)} aria-pressed={range === r.id} style={btn(range === r.id, narrow ? { minWidth: 0, padding: 0, justifyContent: "center", fontSize: 11.5 } : { minWidth: 38, justifyContent: "center" })}>{r.id}</button>
          ))}
        </div>
        <span style={{ marginLeft: narrow ? 0 : "auto", fontSize: 10, color: "var(--t3)" }}>
          {data?.stale ? `${data.staleReason} · ` : ""}{INTERVALS.find(i => i.id === prefs.interval)?.title} bars · Yahoo Finance · {narrow ? "drag sideways to pan, pinch to zoom" : "drag to pan, scroll to zoom"}
          {" · "}<a href="https://www.tradingview.com/" target="_blank" rel="noopener" style={{ color: "inherit" }}>Chart by TradingView</a>
        </span>
      </div>

      {expanded && createPortal(
        <div className="chart-overlay" role="dialog" aria-modal="true" aria-label={`${name || symbol} price chart`}>
          <div className="chart-overlay-bar">
            <h2>{symbol}{name && <span> · {name}</span>}</h2>
            <button type="button" onClick={closeExpanded} aria-label="Close the full-screen chart" autoFocus><X size={18} aria-hidden="true" /></button>
          </div>
          <PriceChartPanel symbol={symbol} name={name} levels={levels} page />
        </div>,
        document.body,
      )}
    </div>
  );
}
