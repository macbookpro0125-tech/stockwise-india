import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  createChart, createSeriesMarkers, CandlestickSeries, BarSeries, LineSeries, AreaSeries, HistogramSeries, BaselineSeries,
  ColorType, CrosshairMode, LineStyle, LineType, PriceScaleMode,
} from "lightweight-charts";
import { ChartCandlestick, ChartNoAxesColumn, ChartLine, ChartArea, SlidersHorizontal, Minus, X, Maximize2, Minimize2, Camera, Layers, BrickWall, CandlestickChart, Slash, Eye, Pencil, Table2, Settings2, Shapes, Search, Plus, Undo2 } from "lucide-react";
import { api } from "./api.js";
import ChartTopBar from "./ChartTopBar.jsx";
import { aggregateBars, sma, ema, bollinger, rsi, macd, indexFrom } from "./chartMath.js";
import { heikinAshi, renko, renkoBox, fibLevels } from "./chartTypes.js";
import { STUDIES, lineBreak, kagi } from "./chartStudies.js";
import { pivotPoints, PIVOT_LEVELS, atr, supertrend, psar, stochastic, adx, obv, cci, williamsR, mfi, donchian, yearHigh, volumeRatio, relativeLine } from "./chartIndicators.js";

// Attribution notice (Lightweight Charts licence, Apache 2.0):
//   TradingView Lightweight Charts™ — Copyright TradingView, Inc. https://www.tradingview.com/
// The on-chart logo is off; the "Chart by TradingView" link under the chart is
// the link the licence asks for.
//
// The stock page's price chart: TradingView's open-source Lightweight Charts
// on our own daily bars, with the fair value and the user's own price levels
// (myLevels.js, when they've turned them on) drawn on the candles.
// Indicators are computed here (chartMath.js); horizontal lines are kept per
// symbol in this browser.

const MONO = { fontVariantNumeric: "tabular-nums" };
const PREFS_KEY = "stockwise-india-chart";
const LINES_KEY = "stockwise-india-chart-lines";
// your trend lines, per company: [{ t1, p1, t2, p2 }] (31 Oct 2026)
const TRENDS_KEY = "stockwise-india-chart-trends";

// your drawings, per company: [{ k, t1, p1, t2, p2, text }] (1 Nov 2026)
const DRAW_KEY = "stockwise-india-chart-draw";
// your saved set of chart settings, by name
const VIEWS_KEY = "stockwise-india-chart-views";

const TYPES = [
  { id: "candles", label: "Candles", Icon: ChartCandlestick },
  { id: "bars", label: "Bars", Icon: ChartNoAxesColumn },
  { id: "line", label: "Line", Icon: ChartLine },
  { id: "area", label: "Area", Icon: ChartArea },
  // 31 Oct 2026: candles averaged with the one before, and bricks per move
  { id: "heikin", label: "Heikin Ashi", Icon: CandlestickChart },
  { id: "renko", label: "Renko", Icon: BrickWall },
  // 1 Nov 2026: the rest of a broker's list that daily bars can draw
  { id: "hollow", label: "Hollow candle", Icon: ChartCandlestick },
  { id: "hlc", label: "HLC bar", Icon: ChartNoAxesColumn },
  { id: "vertex", label: "Vertex line", Icon: ChartLine },
  { id: "step", label: "Step", Icon: ChartLine },
  { id: "baseline", label: "Baseline", Icon: ChartArea },
  { id: "scatter", label: "Scatter", Icon: ChartLine },
  { id: "histogram", label: "Histogram", Icon: ChartNoAxesColumn },
  { id: "linebreak", label: "Line break", Icon: BrickWall },
  { id: "kagi", label: "Kagi", Icon: ChartLine },
];
// Made from the closes alone, with time dropping out of the axis
const BRICKS = new Set(["renko", "linebreak", "kagi"]);
const DRAW_TOOLS = [
  { id: "trend", label: "Trend line", points: 2 },
  { id: "hline", label: "Horizontal", points: 1 },
  { id: "vertical", label: "Vertical", points: 1 },
  { id: "segment", label: "Segment", points: 2 },
  { id: "arrow", label: "Arrow", points: 2 },
  { id: "rect", label: "Rectangle", points: 2 },
  { id: "ellipse", label: "Ellipse", points: 2 },
  { id: "fib", label: "Fib retracement", points: 2 },
  { id: "avg", label: "Average line", points: 2 },
  { id: "note", label: "Note", points: 1 },
];
const svgEsc = t => String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
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
  { id: "high52", label: "52-week high", color: "#C9A227", group: "Levels" },
  { id: "fib", label: "Fibonacci levels (year's low to high)", color: "#A78BFA", group: "Levels" },
  { id: "volume", label: "Volume", group: "Volume" },
  { id: "volx", label: "Volume vs 50-day average", color: "#94A3B8", group: "Volume", pane: true },
  { id: "obv", label: "On-balance volume", color: "#22D3EE", group: "Volume", pane: true },
  { id: "mfi", label: "Money flow (14)", color: "#34D399", group: "Volume", pane: true },
  { id: "rs", label: "Against the Nifty 500", color: "#22C55E", group: "Market", pane: true },
  { id: "rsi", label: "RSI (14)", color: "#A78BFA", group: "Oscillators", pane: true },
  { id: "macd", label: "MACD (12, 26, 9)", color: "#3B82F6", group: "Oscillators", pane: true },
  { id: "stoch", label: "Stochastic (14, 3, 3)", color: "#F472B6", group: "Oscillators", pane: true },
  { id: "adx", label: "ADX / DMI (14)", color: "#FBBF24", group: "Oscillators", pane: true },
  { id: "atr", label: "ATR (14)", color: "#A3E635", group: "Oscillators", pane: true },
  { id: "cci", label: "CCI (20)", color: "#FB923C", group: "Oscillators", pane: true },
  { id: "willr", label: "Williams %R (14)", color: "#C084FC", group: "Oscillators", pane: true },
];
const STUDY_COLORS = ["#22D3EE", "#F472B6", "#A3E635", "#FBBF24", "#818CF8", "#FB7185", "#2DD4BF", "#C084FC", "#F97316", "#60A5FA", "#E879F9", "#84CC16"];
for (const [i, st] of STUDIES.entries()) INDICATORS.push({ id: st.id, label: st.label, group: st.group, pane: !!st.pane, study: st, color: STUDY_COLORS[i % STUDY_COLORS.length] });
const GROUPS = ["Moving averages", "Trend & bands", "Price lines", "Levels", "Volume", "Market", "Oscillators", "Volatility & statistics", "Patterns"];
// Pivot points: worked out from the previous week, month, quarter or year
// (chartIndicators.js), offered for periods longer than a bar
const PIVOT_KINDS = [["classic", "Classic"], ["fibonacci", "Fibonacci"], ["camarilla", "Camarilla"]];
const PIVOT_BASES = { D: [["W", "week"], ["M", "month"], ["Q", "quarter"], ["Y", "year"]], W: [["M", "month"], ["Q", "quarter"], ["Y", "year"]], M: [["Q", "quarter"], ["Y", "year"]] };
const pivotBasisFor = (interval, pref) => ((PIVOT_BASES[interval] ?? PIVOT_BASES.D).some(([id]) => id === pref) ? pref : interval === "M" ? "Y" : "M");
const PIVOT_COLORS = { P: "#F59E0B", R: "#FB7185", S: "#38BDF8" };
const DEFAULT_PREFS = { type: "candles", interval: "D", levels: true, pivotKind: "classic", pivotBasis: "M", ind: { ma50: true, ma200: true, volume: true, high52: true } };

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
// compact: shorter, in a phone's Summary — the full height is a tap away (⤢)
export default function PriceChartPanel({ symbol, name, levels, page = false, compact = false }) {
  const [prefs, setPrefs] = useState(() => {
    const p = readJson(PREFS_KEY, DEFAULT_PREFS);
    return { ...DEFAULT_PREFS, ...p, ind: { ...(p.ind ?? DEFAULT_PREFS.ind) } };
  });
  // a phone's full-screen chart opens close up, so each candle can be read
  const [range, setRange] = useState(() => (page && typeof window !== "undefined" && window.innerWidth < 560 ? "3M" : "1Y"));
  const [span, setSpan] = useState("5y");       // how much history is loaded
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lines, setLines] = useState(() => readJson(LINES_KEY, {})[symbol] ?? []);
  const [drawing, setDrawing] = useState(false);
  // a trend line: off, or waiting for its first or second point
  const [trends, setTrends] = useState(() => readJson(TRENDS_KEY, {})[symbol] ?? []);
  const [trendFrom, setTrendFrom] = useState(null); // null: off; true: waiting; { t, p }: the first point
  const trendRef = useRef(null);
  trendRef.current = trendFrom;
  const saveTrends = next => { setTrends(next); writeJson(TRENDS_KEY, { ...readJson(TRENDS_KEY, {}), [symbol]: next }); };
  useEffect(() => { setTrends(readJson(TRENDS_KEY, {})[symbol] ?? []); setTrendFrom(null); }, [symbol]);
  const [typedPrice, setTypedPrice] = useState("");
  // one sheet open under the toolbar at a time
  const [pop, setPop] = useState(null); // "type" | "views" | "draw" | "settings"
  const togglePop = id => { setMenuOpen(false); setPop(p => (p === id ? null : id)); };
  const [indQuery, setIndQuery] = useState("");
  const [views, setViews] = useState(() => readJson(VIEWS_KEY, []));
  const [viewName, setViewName] = useState("");
  const saveViews = next => { setViews(next); writeJson(VIEWS_KEY, next); };
  // A drawing tool waiting for its points, and what's been drawn on this company
  const [tool, setTool] = useState(null); // { id, from?: { t, p } }
  const toolRef = useRef(null);
  toolRef.current = tool;
  const [noteText, setNoteText] = useState("");
  const noteRef = useRef("");
  noteRef.current = noteText;
  const [draws, setDraws] = useState(() => readJson(DRAW_KEY, {})[symbol] ?? []);
  const drawsRef = useRef(draws);
  drawsRef.current = draws;
  const paintRef = useRef(null), svgRef = useRef(null);
  const saveDraws = next => { setDraws(next); writeJson(DRAW_KEY, { ...readJson(DRAW_KEY, {}), [symbol]: next }); };
  useEffect(() => { setDraws(readJson(DRAW_KEY, {})[symbol] ?? []); setTool(null); }, [symbol]);
  useEffect(() => { paintRef.current?.(); }, [draws]);
  // the candle tapped, with its figures in a card over the chart
  const [picked, setPicked] = useState(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [legend, setLegend] = useState(null);
  const [themeTick, setThemeTick] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  // the card's width from the start (a phone's is the window less its
  // margins), so the chart isn't built wide and then again narrow
  const [boxW, setBoxW] = useState(() => (typeof window !== "undefined" ? Math.min(720, window.innerWidth - 32) : 720));
  const [menuOpen, setMenuOpen] = useState(false);
  const [vh, setVh] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));
  const [expanded, setExpanded] = useState(false);
  const [overlaySym, setOverlaySym] = useState(symbol);
  const [volTop, setVolTop] = useState(null);
  const [levelTags, setLevelTags] = useState([]);
  const [pivotNow, setPivotNow] = useState(null);

  const cardRef = useRef(null), hostRef = useRef(null), menuRef = useRef(null);
  const chartRef = useRef(null), mainRef = useRef(null);
  const drawingRef = useRef(false);
  const keepView = useRef(null);   // the zoom to restore when only overlays change
  drawingRef.current = drawing;

  useEffect(() => { writeJson(PREFS_KEY, prefs); }, [prefs]);
  useEffect(() => { setPicked(null); }, [symbol, prefs.interval, prefs.type]);
  useEffect(() => {
    if (!pop && !tableOpen) return undefined;
    const away = e => { if (pop && !menuRef.current?.contains(e.target)) setPop(null); };
    const esc = e => { if (e.key === "Escape") { setPop(null); setTableOpen(false); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [pop, tableOpen]);
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
    setOverlaySym(symbol);
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

  // Heikin Ashi averages the bars; Renko replaces them with bricks, one per
  // box the close moves — time drops out, so a brick's day is kept as
  // realDate and the time axis is hidden
  const box = useMemo(() => renkoBox(data?.bars ?? []), [data]);
  const bars = useMemo(() => {
    const daily = data?.bars ?? [];
    if (prefs.type === "renko") {
      const start = Date.parse(`${daily[0]?.date ?? "2000-01-03"}T00:00:00Z`);
      return renko(daily, box).map((b, i) => ({ date: new Date(start + i * 86400000).toISOString().slice(0, 10), realDate: b.date,
        open: b.open, close: b.close, high: Math.max(b.open, b.close), low: Math.min(b.open, b.close), volume: null }));
    }
    if (BRICKS.has(prefs.type)) {
      const start = Date.parse(`${daily[0]?.date ?? "2000-01-03"}T00:00:00Z`);
      const day = i => new Date(start + i * 86400000).toISOString().slice(0, 10);
      if (prefs.type === "linebreak") return lineBreak(daily).map((b, i) => ({ date: day(i), realDate: b.date, open: b.open, close: b.close, high: Math.max(b.open, b.close), low: Math.min(b.open, b.close), volume: null }));
      return kagi(daily).map((k, i) => ({ date: day(i), realDate: k.date, open: k.value, close: k.value, high: k.value, low: k.value, up: k.up, volume: null }));
    }
    const agg = aggregateBars(daily, prefs.interval);
    return prefs.type === "heikin" ? heikinAshi(agg) : agg;
  }, [data, prefs.interval, prefs.type, box]);
  const narrow = boxW < 560;
  const isBrick = BRICKS.has(prefs.type);
  const extraPanes = isBrick ? 0 : INDICATORS.filter(i => i.pane && prefs.ind[i.id] && (i.id !== "rs" || data?.benchmark)).length;
  const pivotBasis = pivotBasisFor(prefs.interval, prefs.pivotBasis);
  const height = page
    ? Math.max(300, vh - (narrow ? 330 : 260))   // pane proportions only; the page lays out by flex
    : fullscreen
      ? Math.max(320, vh - (narrow ? 210 : 150))
      : (compact ? 250 : narrow ? 380 : 400) + extraPanes * (narrow ? 90 : 110);

  // Kept while the prices stay the same: the company page hands over a new
  // levels object each time it redraws, and a new list rebuilt the whole
  // chart with it (26 Oct 2026, a phone froze for it as the page scrolled)
  const levelsKey = LEVEL_KEYS.map(k => levels?.[k] ?? "").join("|");
  const levelLines = useMemo(() => {
    if (!prefs.levels || !levels) return [];
    return [
      { price: levels.target, title: "Your upper", short: "Upper", color: "var(--red)", style: LineStyle.Dashed },
      { price: levels.fv25, title: "Fair value", short: "FV", color: "var(--accent)", style: LineStyle.Solid },
      { price: levels.p1, title: "Your L1", short: "L1", color: "var(--green)", style: LineStyle.Dotted },
      { price: levels.p2, title: "Your L2", short: "L2", color: "var(--green)", style: LineStyle.Dotted },
      { price: levels.p3, title: "Your L3", short: "L3", color: "var(--green)", style: LineStyle.Dotted },
      { price: levels.stopLoss, title: "Your stop", short: "Stop", color: "var(--red)", style: LineStyle.Dashed },
    ].filter(l => l.price > 0);
  }, [prefs.levels, levelsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyRange = (id, chart = chartRef.current) => {
    if (!chart || bars.length < 2) return;
    const last = bars.length - 1;
    const r = RANGES.find(x => x.id === id);
    if (!r || id === "All" || BRICKS.has(prefs.type)) { chart.timeScale().fitContent(); return; }
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
      timeScale: { borderColor: c.border, rightOffset: 3, minBarSpacing: 0.5, visible: !isBrick },
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
    // A phone's full-screen chart: volume in a pane of its own, under the candles
    const volPane = page && narrow && withVolume && !isBrick;

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
    if (prefs.type === "hollow") {
      main = chart.addSeries(CandlestickSeries, { ...base, upColor: "rgba(0,0,0,0)", downColor: c.down, wickUpColor: c.up, wickDownColor: c.down, borderUpColor: c.up, borderDownColor: c.down, borderVisible: true });
      main.setData(ohlc.map(({ open, high, low, close, time }) => ({ time, open, high, low, close })));
    } else if (prefs.type === "hlc") {
      main = chart.addSeries(BarSeries, { ...base, upColor: c.up, downColor: c.down, openVisible: false });
      main.setData(ohlc);
    } else if (prefs.type === "vertex" || prefs.type === "scatter" || prefs.type === "step") {
      main = chart.addSeries(LineSeries, { ...base, color: c.accent, lineWidth: prefs.type === "step" ? 2 : 1.5, lineType: prefs.type === "step" ? LineType.WithSteps : LineType.Simple, lineVisible: prefs.type !== "scatter", pointMarkersVisible: prefs.type !== "step", pointMarkersRadius: 2 });
      main.setData(bars.map(b => ({ time: b.date, value: b.close })));
    } else if (prefs.type === "baseline") {
      main = chart.addSeries(BaselineSeries, { ...base, baseValue: { type: "price", price: bars[0].close }, topLineColor: c.up, bottomLineColor: c.down, topFillColor1: alpha(c.up, 0.25), topFillColor2: alpha(c.up, 0.02), bottomFillColor1: alpha(c.down, 0.02), bottomFillColor2: alpha(c.down, 0.25), lineWidth: 2 });
      main.setData(bars.map(b => ({ time: b.date, value: b.close })));
    } else if (prefs.type === "histogram") {
      main = chart.addSeries(HistogramSeries, { ...base });
      main.setData(bars.map(b => ({ time: b.date, value: b.close, color: alpha(b.close >= b.open ? c.up : c.down, 0.7) })));
    } else if (prefs.type === "kagi") {
      main = chart.addSeries(LineSeries, { ...base, color: c.up, lineWidth: 2, lineType: LineType.WithSteps });
      main.setData(bars.map(b => ({ time: b.date, value: b.close, color: b.up ? c.up : c.down })));
    } else if (prefs.type === "candles" || prefs.type === "heikin" || prefs.type === "renko" || prefs.type === "linebreak") {
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
    main.priceScale().applyOptions({ mode: prefs.log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal, invertScale: !!prefs.invert, scaleMargins: { top: narrow ? 0.13 : 0.08, bottom: withVolume && !volPane ? (narrow ? 0.15 : 0.24) : 0.06 } });

    // Warm-up bars stay as whitespace, so every series shares the same time axis
    const toLine = vals => bars.map((b, i) => (vals[i] == null || !Number.isFinite(vals[i]) ? { time: b.date } : { time: b.date, value: vals[i] }));
    const overlay = (vals, color, opts = {}) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...opts });
      s.setData(toLine(vals));
      return s;
    };
    const legendSeries = [];
    const ind = id => INDICATORS.find(x => x.id === id);
    // On a phone a moving average's value sits on the price scale in its
    // colour, rather than in a line of text over the chart
    const maOpts = narrow ? { lastValueVisible: true, priceFormat } : {};
    if (prefs.ind.ma20) legendSeries.push({ label: "MA 20", color: ind("ma20").color, values: sma(closes, 20), series: overlay(sma(closes, 20), ind("ma20").color, maOpts) });
    if (prefs.ind.ma50) legendSeries.push({ label: "MA 50", color: ind("ma50").color, values: sma(closes, 50), series: overlay(sma(closes, 50), ind("ma50").color, maOpts) });
    if (prefs.ind.ma200) legendSeries.push({ label: "MA 200", color: ind("ma200").color, values: sma(closes, 200), series: overlay(sma(closes, 200), ind("ma200").color, maOpts) });
    if (prefs.ind.ema20) legendSeries.push({ label: "EMA 20", color: ind("ema20").color, values: ema(closes, 20), series: overlay(ema(closes, 20), ind("ema20").color, maOpts) });
    if (prefs.ind.bb) {
      const b = bollinger(closes, 20, 2), col = ind("bb").color;
      overlay(b.upper, col, { lineStyle: LineStyle.Dashed, lineWidth: 1 });
      overlay(b.mid, col, { lineWidth: 1 });
      overlay(b.lower, col, { lineStyle: LineStyle.Dashed, lineWidth: 1 });
      legendSeries.push({ label: "BB", color: col, values: b.mid, fmt: i => `${fmtNum(b.upper[i])} / ${fmtNum(b.lower[i])}` });
    }
    if (prefs.ind.ema50) legendSeries.push({ label: "EMA 50", color: ind("ema50").color, values: ema(closes, 50), series: overlay(ema(closes, 50), ind("ema50").color, maOpts) });
    if (prefs.ind.ema200) legendSeries.push({ label: "EMA 200", color: ind("ema200").color, values: ema(closes, 200), series: overlay(ema(closes, 200), ind("ema200").color, maOpts) });
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
    // The longer list on the price (chartStudies.js): one colour per line
    const tint = (col, k, n) => (n < 2 || k === 0 ? col : STUDY_COLORS[(STUDY_COLORS.indexOf(col) + k) % STUDY_COLORS.length]);
    if (!isBrick) for (const def of INDICATORS.filter(i => i.study && !i.pane && prefs.ind[i.id])) {
      const made = def.study.calc(bars);
      made.forEach((l, k) => overlay(l.values, tint(def.color, k, made.length), { lineWidth: 1 }));
      if (made[0]) legendSeries.push({ label: made[0].label, color: def.color, values: made[0].values });
      if (def.study.markers) {
        const marks = def.study.markers(bars);
        createSeriesMarkers(main, marks.map(m => ({ time: bars[m.index].date, position: m.under ? "belowBar" : "aboveBar", shape: m.under ? "arrowUp" : "arrowDown", size: 0.1, color: def.color, text: narrow ? "" : m.text })));
      }
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

    if (volPane) {
      const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false }, 1);
      vol.setData(bars.map(b => ({ time: b.date, value: b.volume ?? 0, color: alpha(b.close >= b.open ? c.up : c.down, 0.7) })));
    } else if (withVolume) {
      const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", priceLineVisible: false, lastValueVisible: false });
      vol.priceScale().applyOptions({ scaleMargins: { top: narrow ? 0.88 : 0.8, bottom: 0 } });
      vol.setData(bars.map(b => ({ time: b.date, value: b.volume ?? 0, color: alpha(b.close >= b.open ? c.up : c.down, 0.45) })));
    }

    let pane = volPane ? 2 : 1;
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
    for (const def of INDICATORS.filter(i => i.pane && prefs.ind[i.id] && !isBrick)) {
      const col = def.color;
      if (def.study) {
        const made = def.study.calc(bars);
        const fmt = def.study.volume ? { priceFormat: { type: "volume" } } : {};
        const scale = def.study.range ? { autoscaleInfoProvider: fixed(...def.study.range) } : {};
        let firstLine = null;
        made.forEach((l, k) => {
          let s;
          if (l.hist) {
            s = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane);
            s.setData(bars.map((b, i) => (l.values[i] == null || !Number.isFinite(l.values[i]) ? { time: b.date } : { time: b.date, value: l.values[i], color: alpha(l.values[i] >= 0 ? c.up : c.down, 0.5) })));
          } else s = paneLine(l.values, tint(col, k, made.length), { lastValueVisible: k === 0, ...fmt, ...scale });
          firstLine ??= s;
        });
        if (firstLine && def.study.guides) guides(firstLine, def.study.guides);
        if (made[0]) legendSeries.push({ label: made[0].label, color: col, values: made[0].values, pane: true, fmt: def.study.volume ? (i => fmtVol(made[0].values[i])) : undefined });
        pane++;
        continue;
      }
      // (no line against the market when the index's days aren't kept)
      if (def.id === "rs" && !data?.benchmark) continue;
      if (def.id === "rs") {
        // Rising: doing better than the market; falling: worse. 100 is the first bar shown loaded.
        const v = relativeLine(bars, data.benchmark.closes);
        guides(paneLine(v, col), [100]);
        legendSeries.push({ label: "vs Nifty 500", color: col, values: v, pane: true, fmt: i => (v[i] == null ? "—" : fmtNum(v[i])) });
      } else if (def.id === "volx") {
        // Each bar's volume against the 50 before it; the dashed line is a usual day
        const v = volumeRatio(bars, 50);
        const h = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false, priceFormat: { type: "custom", minMove: 0.1, formatter: x => `${x.toFixed(1)}×` } }, pane);
        h.setData(bars.map((b, i) => (v[i] == null ? { time: b.date } : { time: b.date, value: v[i], color: alpha(b.close >= b.open ? c.up : c.down, v[i] >= 1.5 ? 0.85 : 0.35) })));
        guides(h, [1]);
        legendSeries.push({ label: "Vol ×avg", color: col, values: v, pane: true, fmt: i => (v[i] == null ? "—" : `${v[i].toFixed(1)}×`) });
      } else if (def.id === "rsi") {
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
    // The year's high, labelled with how far the price is below it
    if (prefs.ind.high52) {
      const hi = yearHigh(data?.bars);
      if (hi) main.createPriceLine({ price: hi.price, color: ind("high52").color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true,
        title: narrow ? "52w high" : hi.belowPct < 0.05 ? "52-week high · at it" : `52-week high · ${hi.belowPct.toFixed(1)}% below` });
    }
    // Fibonacci levels between the year's low and high, worked out, not drawn
    if (prefs.ind.fib) {
      const f = fibLevels(data?.bars);
      if (f) for (const l of f.levels) main.createPriceLine({ price: l.price, color: ind("fib").color, lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: !narrow, title: narrow ? "" : `Fib ${(l.ratio * 100).toFixed(1)}%` });
    }
    // Your trend lines, each from its first point on to the latest bar
    if (!isBrick && bars.length) {
      const lastDay = bars[bars.length - 1].date;
      const days = d => Date.parse(`${d}T00:00:00Z`) / 86400000;
      for (const t of trends) {
        const slope = (t.p2 - t.p1) / Math.max(1, days(t.t2) - days(t.t1));
        const s2 = chart.addSeries(LineSeries, { color: c.text, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: () => null });
        const end = days(lastDay) > days(t.t2) ? lastDay : t.t2;
        s2.setData([{ time: t.t1, value: t.p1 }, ...(end !== t.t1 ? [{ time: end, value: t.p1 + slope * (days(end) - days(t.t1)) }] : [])]);
      }
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
      const at = legendAt(i == null ? bars.length - 1 : Math.min(i, bars.length - 1));
      // active: a bar is pointed at or touched (a phone then shows its values)
      setLegend(at && { ...at, active: i != null });
    });
    chart.subscribeClick(param => {
      // A drawing tool: one point, or the first and then the second
      const t0 = toolRef.current;
      if (t0 && t0.id !== "trend" && t0.id !== "hline" && param.point) {
        const price = mainRef.current?.coordinateToPrice(param.point.y);
        const li = param.logical != null ? Math.max(0, Math.min(bars.length - 1, Math.round(param.logical))) : null;
        if (price == null || !(price > 0) || li == null) return;
        const here = { t: bars[li].date, p: Math.round(price * 100) / 100 };
        const def = DRAW_TOOLS.find(d => d.id === t0.id);
        if (def.points === 2 && !t0.from) { setTool({ ...t0, from: here }); return; }
        const made = def.points === 1 ? { k: def.id, t1: here.t, p1: here.p, ...(def.id === "note" ? { text: noteRef.current.trim() || "Note" } : {}) } : { k: def.id, t1: t0.from.t, p1: t0.from.p, t2: here.t, p2: here.p };
        saveDraws([...drawsRef.current, made]);
        setTool(null);
        return;
      }
      // a trend line: the first click its start, the second its end
      if (trendRef.current && param.point && param.time) {
        const price = mainRef.current?.coordinateToPrice(param.point.y);
        if (price == null || !(price > 0)) return;
        const p = Math.round(price * 100) / 100, t = typeof param.time === "string" ? param.time : null;
        if (!t) return;
        if (trendRef.current === true) { setTrendFrom({ t, p }); return; }
        const a = trendRef.current;
        if (a.t === t) return;
        const [first, second] = a.t < t ? [a, { t, p }] : [{ t, p }, a];
        setTrendFrom(null);
        saveTrends([...(readJson(TRENDS_KEY, {})[symbol] ?? []), { t1: first.t, p1: first.p, t2: second.t, p2: second.p }]);
        return;
      }
      if (!drawingRef.current || !param.point) return;
      const price = mainRef.current?.coordinateToPrice(param.point.y);
      if (price == null || !(price > 0)) return;
      setDrawing(false);
      const rounded = Math.round(price * 100) / 100;
      saveLines([...(readJson(LINES_KEY, {})[symbol] ?? []), rounded]);
    });
    // A plain tap on a candle: its figures in a card (1 Nov 2026)
    chart.subscribeClick(param => {
      if (toolRef.current || drawingRef.current || trendRef.current || !param.point || param.logical == null) return;
      const i = Math.round(param.logical);
      if (i < 0 || i >= bars.length) return;
      setPicked({ bar: bars[i], prev: bars[i - 1] ?? null });
    });

    // Your drawings, in an SVG over the price pane, placed afresh as the view moves
    const paintDraws = () => {
      const svg = svgRef.current;
      if (!svg || chartRef.current !== chart) return;
      const rows = BRICKS.has(prefs.type) ? [] : drawsRef.current;
      if (!rows.length) { svg.innerHTML = ""; return; }
      const ts = chart.timeScale();
      const X = d => ts.logicalToCoordinate(indexFrom(bars, d));
      const Y = p => main.priceToCoordinate(p);
      const ink = c.text;
      const paneH = chart.panes()[0]?.getHeight?.() ?? host.clientHeight;
      const paneW = host.clientWidth - chart.priceScale("right").width();
      let html = `<defs><clipPath id="cd-${symbol}"><rect x="0" y="0" width="${paneW}" height="${paneH}"/></clipPath><marker id="cdh-${symbol}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${ink}"/></marker></defs><g clip-path="url(#cd-${symbol})" fill="none" stroke="${ink}" stroke-width="1.5">`;
      for (const d of rows) {
        const x1 = X(d.t1), y1 = Y(d.p1), x2 = d.t2 ? X(d.t2) : null, y2 = d.t2 ? Y(d.p2) : null;
        if (x1 == null || y1 == null) continue;
        if (d.k === "vertical") html += `<line x1="${x1}" x2="${x1}" y1="0" y2="${paneH}"/>`;
        else if (d.k === "note") html += `<circle cx="${x1}" cy="${y1}" r="3" fill="${ink}"/><text x="${x1 + 7}" y="${y1 + 4}" fill="${ink}" stroke="none" font-size="12">${svgEsc(d.text ?? "Note")}</text>`;
        else if (x2 == null || y2 == null) continue;
        else if (d.k === "segment") html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        else if (d.k === "arrow") html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#cdh-${symbol})"/>`;
        else if (d.k === "rect") html += `<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" fill="${alpha(c.accent, 0.1)}"/>`;
        else if (d.k === "ellipse") html += `<ellipse cx="${(x1 + x2) / 2}" cy="${(y1 + y2) / 2}" rx="${Math.abs(x2 - x1) / 2}" ry="${Math.abs(y2 - y1) / 2}" fill="${alpha(c.accent, 0.1)}"/>`;
        else if (d.k === "fib") for (const r of [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]) { const y = Y(d.p1 + (d.p2 - d.p1) * r); if (y != null) html += `<line x1="${Math.min(x1, x2)}" x2="${Math.max(x1, x2)}" y1="${y}" y2="${y}" stroke-width="1"/><text x="${Math.min(x1, x2) + 3}" y="${y - 3}" fill="${ink}" stroke="none" font-size="10">${(r * 100).toFixed(1)}%</text>`; }
        else if (d.k === "avg") { const a = indexFrom(bars, d.t1 < d.t2 ? d.t1 : d.t2), z = indexFrom(bars, d.t1 < d.t2 ? d.t2 : d.t1), w = bars.slice(a, z + 1), m = w.reduce((n, b) => n + b.close, 0) / (w.length || 1), y = Y(m); if (y != null) html += `<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke-dasharray="5 3"/><text x="${Math.min(x1, x2) + 3}" y="${y - 4}" fill="${ink}" stroke="none" font-size="10">Avg ${fmtNum(m)}</text>`; }
      }
      svg.innerHTML = `${html}</g>`;
    };
    paintRef.current = paintDraws;

    const kept = keepView.current;
    // (a chart redrawn while hidden — another tab of a phone's company page —
    // had no view to keep, and restoring that nothing threw)
    if (kept && kept.bars === bars && kept.range) chart.timeScale().setVisibleLogicalRange(kept.range);
    else applyRange(range, chart);

    // The level tags on a phone, placed where each line is drawn: the price
    // scale rescales as the view moves, so they're placed again each time.
    // Tags closer than a tag's height step left rather than overlap.
    let frame = 0;
    const placeTags = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        paintDraws();
        setVolTop(volPane ? chart.panes()[0]?.getHeight?.() ?? null : null);
        const items = [
          ...(narrow ? levelLines.map(l => ({ key: l.title, text: `${l.short} ${Math.round(l.price).toLocaleString("en-IN")}`, color: resolve(l.color), price: l.price })) : []),
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
          placed.push({ ...t, y, right: right + near * 84 });
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
      chartRef.current = null; mainRef.current = null; paintRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, prefs.type, prefs.ind, prefs.pivotKind, pivotBasis, levelLines, lines, trends, themeTick, narrow, symbol, height, page, prefs.log, prefs.invert]);

  const zoom = by => {
    const ts = chartRef.current?.timeScale(), r = ts?.getVisibleLogicalRange();
    if (!r) return;
    const mid = r.to - (r.to - r.from) * 0.35, half = ((r.to - r.from) * by) / 2;
    ts.setVisibleLogicalRange({ from: mid - half * 1.3, to: mid + half * 0.7 });
  };
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
  // the change over the range from the real closes, not bricks or averaged candles
  const priceBars = useMemo(() => (prefs.type === "renko" || prefs.type === "heikin" ? aggregateBars(data?.bars ?? [], prefs.interval) : bars), [bars, data, prefs.type, prefs.interval]);
  const rangeBars = useMemo(() => {
    const bars = priceBars;
    if (bars.length < 2) return null;
    const r = RANGES.find(x => x.id === range);
    if (range === "All" || !r) return bars;
    const lastDate = bars.at(-1).date;
    // from the last close before the range, as the returns table counts a
    // year (the close on or before the same day a year back) — starting at the
    // first bar inside it gave a 1Y of −18.4% beside the table's −16.9%
    return bars.slice(Math.max(0, indexFrom(bars, range === "YTD" ? `${lastDate.slice(0, 4)}-01-01` : monthsBack(lastDate, r.months)) - 1));
  }, [priceBars, range]);
  const rangeChange = rangeBars && rangeBars.length > 1 ? ((rangeBars.at(-1).close - rangeBars[0].close) / rangeBars[0].close) * 100 : null;
  const activeInd = INDICATORS.filter(i => prefs.ind[i.id]).length;

  const btn = (active, extra = {}) => ({
    display: "inline-flex", alignItems: "center", gap: 5, height: narrow ? 34 : 30, padding: narrow ? "0 10px" : "0 9px",
    borderRadius: 7, fontSize: 12, fontWeight: 400, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${active ? "var(--accent)" : "var(--bdr2)"}`,
    background: active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--s3)",
    color: active ? "var(--accent)" : "var(--t2)", ...extra,
  });
  const group = { display: "inline-flex", gap: 4, flexWrap: narrow ? "nowrap" : "wrap" };
  // A phone's icon row: square-ish buttons, a segmented D/W/M
  const iconBtn = (active, extra = {}) => btn(active, { width: 40, height: 36, padding: 0, gap: 2, justifyContent: "center", ...extra });
  const seg = active => ({
    minWidth: 30, height: 30, padding: "0 6px", border: 0, borderRadius: 7, fontFamily: "inherit", fontSize: 12, fontWeight: 450, cursor: "pointer",
    background: active ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "transparent", color: active ? "var(--accent)" : "var(--t2)",
  });
  const sheetLabel = { margin: "0 0 6px 2px", fontSize: 11, fontWeight: 450, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--t3)" };
  const basisWord = (PIVOT_BASES[prefs.interval] ?? PIVOT_BASES.D).find(([id]) => id === pivotBasis)?.[1] ?? "month";
  // Every indicator, in its group; pivot points open their own settings
  const q = indQuery.trim().toLowerCase();
  const onNow = INDICATORS.filter(i => prefs.ind[i.id]);
  const picker = compact => (
    <div style={{ display: "grid", gap: compact ? 10 : 6 }}>
      <div style={{ position: "relative" }}>
        <Search size={14} aria-hidden="true" style={{ position: "absolute", left: 9, top: 10, color: "var(--t3)" }} />
        <input type="search" value={indQuery} onChange={e => setIndQuery(e.target.value)} placeholder={`Search ${INDICATORS.length} indicators`} aria-label="Search indicators" style={{ width: "100%", height: 34, padding: "0 8px 0 30px", fontSize: compact ? 16 : 13, boxSizing: "border-box" }} />
      </div>
      {!q && onNow.length > 0 && (
        <div>
          <div style={{ ...sheetLabel, margin: compact ? sheetLabel.margin : "4px 0 2px 8px" }}>On now</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {onNow.map(i => (
              <span key={i.id} className="chart-chip"><span>{i.label.replace(/ \(.*\)$/, "")}</span><button type="button" onClick={() => toggleInd(i.id)} aria-label="Turn off" title="Turn off"><X size={12} aria-hidden="true" /></button></span>
            ))}
            <button type="button" onClick={() => setPrefs(p => ({ ...p, ind: {} }))} style={btn(false, { height: 28, fontSize: 11.5 })}>Clear all</button>
          </div>
        </div>
      )}
      {q && !INDICATORS.some(i => i.label.toLowerCase().includes(q)) && <p style={{ margin: 8, fontSize: 13, color: "var(--t3)" }}>Nothing by that name.</p>}
      {GROUPS.filter(g => !q || INDICATORS.some(i => i.group === g && i.label.toLowerCase().includes(q))).map(g => (
        <div key={g}>
          <div style={{ ...sheetLabel, margin: compact ? sheetLabel.margin : "4px 0 2px 8px" }}>{g}</div>
          <div role="group" aria-label={g} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2 }}>
            {INDICATORS.filter(i => i.group === g && (!q || i.label.toLowerCase().includes(q))).map(i => (
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

  // The pivots, listed: above the chart on a wide screen, under the range
  // buttons on a phone, where the top stays clean. The user's levels aren't
  // listed here — the Levels section does, and the lines carry their values
  // (on the price scale, or on a phone in the tags)
  const levelLists = (
    <>
        {pivotNow && (
          <div aria-label="Pivot points" style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", alignItems: "baseline", margin: "0 0 8px", fontSize: 12, color: "var(--t2)", ...MONO }}>
            <span style={{ color: "var(--t3)", fontFamily: "inherit" }}>{PIVOT_KINDS.find(([id]) => id === prefs.pivotKind)?.[1] ?? "Classic"} pivots, from the last {basisWord}:</span>
            {PIVOT_LEVELS.map(L => (
              <span key={L} style={{ whiteSpace: "nowrap" }}><b style={{ color: PIVOT_COLORS[L[0]], fontWeight: 450 }}>{L}</b> {narrow && Math.abs(pivotNow[L]) >= 100 ? Math.round(pivotNow[L]).toLocaleString("en-IN") : fmtNum(pivotNow[L])}</span>
            ))}
          </div>
        )}
    </>
  );

  const tileBtn = active => btn(active, { flexDirection: "column", height: 52, gap: 3, padding: "0 2px", justifyContent: "center", fontSize: 11, whiteSpace: "normal", lineHeight: 1.15, textAlign: "center" });
  const sheet = { display: "grid", gap: 10, padding: 10, marginBottom: 8, borderRadius: 12, background: "var(--s3)", border: "1px solid var(--bdr2)" };
  const typeTiles = (
    <div role="group" aria-label="Chart type" style={{ display: "grid", gridTemplateColumns: `repeat(${narrow ? 4 : 8}, minmax(0, 1fr))`, gap: 4 }}>
      {TYPES.map(({ id, label, Icon }) => (
        <button key={id} type="button" onClick={() => { setPref({ type: id }); setPop(null); }} aria-pressed={prefs.type === id} style={tileBtn(prefs.type === id)}><Icon size={16} aria-hidden="true" />{label}</button>
      ))}
    </div>
  );
  const applyView = v => { keepView.current = null; setPrefs(p => ({ ...p, type: v.type, interval: v.interval, ind: { ...v.ind }, pivotKind: v.pivotKind ?? p.pivotKind, pivotBasis: v.pivotBasis ?? p.pivotBasis, log: !!v.log, invert: !!v.invert })); setPop(null); };
  const saveView = e => {
    e.preventDefault();
    const n = viewName.trim();
    if (!n) return;
    saveViews([...views.filter(v => v.name !== n), { name: n, type: prefs.type, interval: prefs.interval, ind: prefs.ind, pivotKind: prefs.pivotKind, pivotBasis: prefs.pivotBasis, log: !!prefs.log, invert: !!prefs.invert }]);
    setViewName("");
  };
  const pickTool = id => {
    setPop(null); setDrawing(false); setTrendFrom(null); setTool(null);
    if (id === "hline") setDrawing(true);
    else if (id === "trend") setTrendFrom(true);
    else setTool({ id });
  };
  const toolLabel = id => DRAW_TOOLS.find(d => d.id === id)?.label ?? id;
  const sheets = (
    <>
      {pop === "type" && <div style={sheet}><div style={sheetLabel}>Chart type</div>{typeTiles}</div>}
      {pop === "views" && (
        <div role="group" aria-label="Saved views" style={sheet}>
          <div style={sheetLabel}>Saved views</div>
          {views.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--t3)" }}>Set up the chart as you like it, then save it here to bring it back with one tap.</p>}
          {views.map(v => (
            <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" onClick={() => applyView(v)} style={btn(false, { flex: 1, justifyContent: "flex-start", height: 38, overflow: "hidden" })}>{v.name}</button>
              <button type="button" onClick={() => saveViews(views.filter(x => x !== v))} aria-label={`Delete the view ${v.name}`} style={btn(false, { width: 38, height: 38, padding: 0, justifyContent: "center" })}><X size={14} aria-hidden="true" /></button>
            </div>
          ))}
          <form onSubmit={saveView} style={{ display: "flex", gap: 6 }}>
            <input value={viewName} onChange={e => setViewName(e.target.value)} placeholder="Name this view" aria-label="Name this view" maxLength={40} style={{ flex: 1, minWidth: 0, height: 38, fontSize: narrow ? 16 : 13 }} />
            <button type="submit" disabled={!viewName.trim()} style={btn(false, { height: 38 })}><Plus size={14} aria-hidden="true" />Save view</button>
          </form>
          <p style={{ margin: 0, fontSize: 11, color: "var(--t3)" }}>Kept on this device.</p>
        </div>
      )}
      {pop === "draw" && (
        <div role="group" aria-label="Drawing tools" style={sheet}>
          <div style={sheetLabel}>Draw on the chart</div>
          {isBrick ? <p style={{ margin: 0, fontSize: 13, color: "var(--t3)" }}>Drawing needs a chart with dates. Switch from {TYPES.find(t => t.id === prefs.type)?.label} to use it.</p> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${narrow ? 3 : 5}, minmax(0, 1fr))`, gap: 4 }}>
                {DRAW_TOOLS.map(d => <button key={d.id} type="button" onClick={() => pickTool(d.id)} style={btn(false, { height: 38, justifyContent: "center", fontSize: 12, padding: "0 4px" })}>{d.label}</button>)}
              </div>
              <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Text for a note (optional)" aria-label="Text for a note" maxLength={60} style={{ height: 36, fontSize: narrow ? 16 : 13 }} />
            </>
          )}
        </div>
      )}
      {pop === "settings" && (
        <div role="group" aria-label="Chart settings" style={sheet}>
          <div style={sheetLabel}>Price scale</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--t1)" }}><input type="checkbox" checked={!!prefs.log} onChange={() => setPref({ log: !prefs.log })} />Log scale</label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--t1)" }}><input type="checkbox" checked={!!prefs.invert} onChange={() => setPref({ invert: !prefs.invert })} />Upside down</label>
          <button type="button" onClick={() => { keepView.current = null; setPrefs({ ...DEFAULT_PREFS, ind: { ...DEFAULT_PREFS.ind } }); setPop(null); }} style={btn(false, { justifySelf: "start", height: 34 })}>Back to the usual chart</button>
        </div>
      )}
    </>
  );
  const tableBars = tableOpen ? [...priceBars].reverse().slice(0, 500) : [];
  const copyTable = () => {
    const text = ["Date\tOpen\tHigh\tLow\tClose\tVolume", ...[...tableBars].map(b => `${b.date}\t${b.open}\t${b.high}\t${b.low}\t${b.close}\t${b.volume ?? ""}`)].join("\n");
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  };

  return (
    <div ref={cardRef} className={page ? "chart-page-card" : undefined} style={page
      // The chart page is a column the height of the screen: every control
      // keeps its size and the chart takes what's left (className below)
      ? { background: "var(--s2)", padding: narrow ? "10px 10px 12px" : 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }
      : { border: "1px solid var(--bdr2)", borderRadius: fullscreen ? 0 : 14, background: "var(--s2)", padding: narrow ? 12 : 16, marginBottom: 16, ...(fullscreen ? { overflow: "auto" } : {}) }}>
      {/* A phone keeps the top clean: no heading row — the change sits in
          the chart's corner and Expand in the icon row below */}
      {!narrow && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)", letterSpacing: "-0.01em" }}>
          Share price
          {data?.symbol && !narrow && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 8 }}>{data.symbol}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          {rangeChange != null && (
            // The sign carries the direction too, so it's never colour alone
            <div style={{ fontSize: 13, fontWeight: 500, color: rangeChange >= 0 ? "var(--green)" : "var(--red)", ...MONO }}>
              {rangeChange >= 0 ? "+" : "−"}{Math.abs(rangeChange).toFixed(1)}%
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 6 }}>{narrow ? (range === "All" ? "all" : range) : `over ${range === "All" ? "all history" : range}`}</span>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Toolbar. A phone has one row — the bar interval and "Chart options",
          which opens everything else below it; the row of every control
          scrolled sideways there and hid most of them. */}
      <div ref={menuRef}>
      {!narrow ? (
      <div role="toolbar" aria-label="Chart settings" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <div role="group" aria-label="Chart type" style={group}>
          {TYPES.slice(0, 6).map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setPref({ type: id })} aria-pressed={prefs.type === id} title={label} aria-label={narrow ? label : undefined} style={btn(prefs.type === id)}>
              <Icon size={14} aria-hidden="true" />{!narrow && label}
            </button>
          ))}
          <button type="button" onClick={() => togglePop("type")} aria-expanded={pop === "type"} style={btn(pop === "type" || !TYPES.slice(0, 6).some(t => t.id === prefs.type))}><Shapes size={14} aria-hidden="true" />{TYPES.slice(6).find(t => t.id === prefs.type)?.label ?? "More"}</button>
        </div>
        <div role="group" aria-label="Bar interval" style={group}>
          {INTERVALS.map(iv => (
            <button key={iv.id} type="button" onClick={() => pickInterval(iv.id)} aria-pressed={prefs.interval === iv.id} title={iv.title} aria-label={iv.title} style={btn(prefs.interval === iv.id, { minWidth: 32, justifyContent: "center" })}>{iv.label}</button>
          ))}
        </div>

        <div style={{ position: "relative" }}>
          <button type="button" onClick={() => { setPop(null); setMenuOpen(o => !o); }} aria-expanded={menuOpen} aria-haspopup="true" style={btn(menuOpen || activeInd > 0)}>
            <SlidersHorizontal size={14} aria-hidden="true" />Indicators{activeInd > 0 && <span style={MONO}> · {activeInd}</span>}
          </button>
          {menuOpen && !narrow && (
            <div role="group" aria-label="Indicators" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, width: 440, maxHeight: "min(70vh, 560px)", overflowY: "auto", overscrollBehavior: "contain", padding: 6, borderRadius: 10, background: "var(--s3)", border: "1px solid var(--bdr2)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
              {picker(false)}
            </div>
          )}
        </div>

        <button type="button" onClick={() => setPref({ levels: !prefs.levels })} aria-pressed={prefs.levels} disabled={!levels} title="Fair value, and your own price levels if you've turned them on" style={btn(prefs.levels && !!levels, !levels ? { opacity: 0.5, cursor: "not-allowed" } : {})}>
          <Layers size={14} aria-hidden="true" />Levels
        </button>
        <button type="button" onClick={() => togglePop("draw")} aria-expanded={pop === "draw"} style={btn(pop === "draw" || drawing || !!trendFrom || !!tool)}><Pencil size={14} aria-hidden="true" />Draw</button>
        <button type="button" onClick={() => togglePop("views")} aria-expanded={pop === "views"} style={btn(pop === "views")}><Eye size={14} aria-hidden="true" />Views</button>
        <button type="button" onClick={() => setTableOpen(true)} style={btn(false)}><Table2 size={14} aria-hidden="true" />Table</button>
        <button type="button" onClick={() => togglePop("settings")} aria-expanded={pop === "settings"} aria-label="Chart settings" title="Chart settings" style={btn(pop === "settings" || !!prefs.log || !!prefs.invert)}><Settings2 size={14} aria-hidden="true" /></button>

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
        <div role="toolbar" aria-label="Chart settings" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          {/* One row that slides sideways, so every tool has a proper finger's width */}
          <div className="chart-tools-row">
            <div role="group" aria-label="Bar interval" style={{ display: "inline-flex", flex: "none", gap: 2, padding: 2, borderRadius: 9, background: "var(--s3)", border: "1px solid var(--bdr2)" }}>
              {INTERVALS.map(iv => (
                <button key={iv.id} type="button" onClick={() => pickInterval(iv.id)} aria-pressed={prefs.interval === iv.id} title={iv.title} aria-label={iv.title} style={seg(prefs.interval === iv.id)}>{iv.label}</button>
              ))}
            </div>
            <button type="button" onClick={() => togglePop("type")} aria-expanded={pop === "type"} aria-label={`Chart type: ${TYPES.find(t => t.id === prefs.type)?.label}`} style={iconBtn(pop === "type")}><ChartCandlestick size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => { setPop(null); setMenuOpen(o => !o); }} aria-expanded={menuOpen} aria-controls={`chart-options-${symbol}${page ? "-page" : ""}`} aria-label={`Indicators${activeInd > 0 ? `, ${activeInd} on` : ""}`} style={iconBtn(menuOpen || activeInd > 0)}>
              <span aria-hidden="true" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: 15, fontWeight: 400 }}>ƒx</span>
              {activeInd > 0 && <span aria-hidden="true" style={{ fontSize: 10, fontWeight: 500, ...MONO }}>{activeInd}</span>}
            </button>
            <button type="button" onClick={() => togglePop("draw")} aria-expanded={pop === "draw"} aria-label="Draw on the chart" style={iconBtn(pop === "draw" || drawing || !!trendFrom || !!tool)}><Pencil size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => togglePop("views")} aria-expanded={pop === "views"} aria-label="Saved views" style={iconBtn(pop === "views")}><Eye size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => setTableOpen(true)} aria-label="Table of prices" style={iconBtn(false)}><Table2 size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => setPref({ levels: !prefs.levels })} aria-pressed={prefs.levels && !!levels} disabled={!levels} aria-label="Fair value and your price levels" style={iconBtn(prefs.levels && !!levels, !levels ? { opacity: 0.45, cursor: "not-allowed" } : {})}><Layers size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => togglePop("settings")} aria-expanded={pop === "settings"} aria-label="Chart settings" style={iconBtn(pop === "settings" || !!prefs.log || !!prefs.invert)}><Settings2 size={16} aria-hidden="true" /></button>
            <button type="button" onClick={snapshot} aria-label="Save the chart as an image" style={iconBtn(false)}><Camera size={16} aria-hidden="true" /></button>
          </div>
          {!page && (
            <a href={chartPageUrl(symbol, name, levels)} onClick={openExpanded} aria-label="Expand the chart to full screen" style={iconBtn(false, { flex: "none", textDecoration: "none" })}><Maximize2 size={16} aria-hidden="true" /></a>
          )}
        </div>
      )}
      {menuOpen && narrow && (
        <div id={`chart-options-${symbol}${page ? "-page" : ""}`} role="group" aria-label="Indicators" style={{ ...sheet, maxHeight: "60vh", overflowY: "auto", overscrollBehavior: "contain" }}>
          {picker(true)}
        </div>
      )}
      {sheets}
      </div>

      {!narrow && levelLists}

      {tool && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 12, color: "var(--t2)" }}>
          <span>{toolLabel(tool.id)}: {narrow ? "tap" : "click"} {DRAW_TOOLS.find(d => d.id === tool.id).points === 1 ? "the spot" : tool.from ? "its second point" : "its first point"}.</span>
          <button type="button" onClick={() => setTool(null)} style={btn(false, { height: 28 })}>Cancel</button>
        </div>
      )}
      {draws.length > 0 && !isBrick && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8, fontSize: 12 }}>
          {draws.map((d, i) => (
            <span key={`${d.k}-${d.t1}-${i}`} className="chart-chip"><span>{d.k === "note" ? d.text : toolLabel(d.k)}</span><button type="button" onClick={() => saveDraws(draws.filter((_, j) => j !== i))} aria-label={`Remove this ${toolLabel(d.k)}`}><X size={12} aria-hidden="true" /></button></span>
          ))}
          <button type="button" onClick={() => saveDraws(draws.slice(0, -1))} aria-label="Undo the last drawing" style={btn(false, { height: 28 })}><Undo2 size={13} aria-hidden="true" /></button>
          {draws.length > 1 && <button type="button" onClick={() => saveDraws([])} style={btn(false, { height: 28, fontSize: 11.5 })}>Clear drawings</button>}
        </div>
      )}
      {/* Trend lines: what to click while drawing, and each one drawn, removable */}
      {(trendFrom || trends.length > 0 || isBrick) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8, fontSize: 12, color: "var(--t2)" }}>
          {prefs.type === "renko" && <span>Renko: one brick for each ₹{box?.toLocaleString("en-IN")} the close moves; time isn't to scale, so the dates are in the legend.</span>}
          {prefs.type === "linebreak" && <span>Line break: a new bar only when the close passes the last three; time isn't to scale.</span>}
          {prefs.type === "kagi" && <span>Kagi: the line turns when the close comes back 4% from its last extreme; time isn't to scale.</span>}
          {trendFrom === true && <span>{narrow ? "Tap" : "Click"} the trend line's first point.</span>}
          {trendFrom && trendFrom !== true && <span>Now {narrow ? "tap" : "click"} its second point.</span>}
          {!isBrick && trends.map((t, i) => (
            <span key={`${t.t1}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 2, height: narrow ? 34 : 26, padding: "0 2px 0 9px", borderRadius: 999, border: "1px solid var(--bdr2)", background: "var(--s3)", color: "var(--t1)", ...MONO }}>
              ⟋ {fmtRs(t.p1)} → {fmtRs(t.p2)}
              <button type="button" onClick={() => saveTrends(trends.filter((_, j) => j !== i))} aria-label={`Remove the trend line from ${fmtRs(t.p1)} to ${fmtRs(t.p2)}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: narrow ? 32 : 22, minHeight: narrow ? 32 : 22, border: 0, background: "none", color: "var(--t2)", cursor: "pointer", padding: 0, borderRadius: 999 }}>
                <X size={13} aria-hidden="true" />
              </button>
            </span>
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
            {/* Legend, over the chart. On a phone one quiet line in the corner —
                the symbol, close and change — and a touched bar's values while
                a finger is on the chart; the price pane leaves room for it */}
            {legend && narrow && (
              <div aria-hidden="true" style={{ position: "absolute", top: 4, left: 6, right: 62, zIndex: 3, pointerEvents: "none", fontSize: 11, lineHeight: 1.55, color: "var(--t2)", ...MONO, textShadow: "0 0 4px var(--s2), 0 0 4px var(--s2)" }}>
                {(() => {
                  const b = legend.bar, ohlc = prefs.type === "candles" || prefs.type === "bars" || prefs.type === "heikin";
                  const n = x => (Math.abs(x) >= 100 ? Math.round(x).toLocaleString("en-IN") : fmtNum(x));
                  const pct = legend.changePct != null && (
                    <span style={{ color: legend.change >= 0 ? "var(--green)" : "var(--red)", fontWeight: 400 }}>{legend.change >= 0 ? "+" : "−"}{Math.abs(legend.changePct).toFixed(2)}%</span>
                  );
                  const extras = legend.extra;
                  return legend.active ? (
                    <>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <span style={{ color: "var(--t1)", fontWeight: 400 }}>{new Date(`${b.realDate ?? b.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" })}</span>{" "}
                        {ohlc && <>O {n(b.open)} H {n(b.high)} L {n(b.low)} </>}C <b style={{ color: "var(--t1)", fontWeight: 450 }}>{fmtNum(b.close)}</b> {pct}
                      </div>
                      {extras.length > 0 && (
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {extras.map((x, k) => <span key={x.label}>{k > 0 && " "}<span style={{ color: x.color }}>{x.label}</span> {x.text}</span>)}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <b style={{ color: "var(--t1)", fontWeight: 500 }}>{symbol}</b> {fmtNum(b.close)} {pct}
                      {b.partial && <span style={{ color: "var(--yellow)" }}> · today</span>}
                      {rangeChange != null && <span style={{ color: "var(--t3)" }}> · {range === "All" ? "all" : range} <span style={{ color: rangeChange >= 0 ? "var(--green)" : "var(--red)" }}>{rangeChange >= 0 ? "+" : "−"}{Math.abs(rangeChange).toFixed(1)}%</span></span>}
                    </div>
                  );
                })()}
              </div>
            )}
            {legend && !narrow && (
              <div aria-hidden="true" style={{ position: "absolute", top: 6, left: 8, zIndex: 3, pointerEvents: "none", fontSize: 12, lineHeight: 1.6, color: "var(--t2)", ...MONO, textShadow: "0 0 4px var(--s2), 0 0 4px var(--s2)" }}>
                {(() => {
                  const b = legend.bar, ohlc = prefs.type === "candles" || prefs.type === "bars" || prefs.type === "heikin";
                  const v = n => <b style={{ color: "var(--t1)", fontWeight: 400 }}>{fmtNum(n)}</b>;
                  const change = legend.change != null && (
                    <span style={{ color: legend.change >= 0 ? "var(--green)" : "var(--red)", fontWeight: 400 }}>
                      {legend.change >= 0 ? "+" : "−"}{fmtNum(Math.abs(legend.change))} ({legend.change >= 0 ? "+" : "−"}{Math.abs(legend.changePct).toFixed(2)}%)
                    </span>
                  );
                  const vol = prefs.ind.volume && b.volume != null && <span>Vol <b style={{ color: "var(--t1)", fontWeight: 400 }}>{fmtVol(b.volume)}</b></span>;
                  // A phone puts the close and change first, open/high/low under them
                  return narrow ? (
                    <>
                      <div className="chart-row" style={{ gap: 8 }}>
                        <span style={{ color: "var(--t1)", fontWeight: 400 }}>{b.realDate ?? b.date}{b.partial && <span style={{ color: "var(--yellow)", fontWeight: 500 }}> · in progress</span>}</span>
                        <span>C {v(b.close)}</span>{change}
                      </div>
                      {ohlc && <div className="chart-row" style={{ gap: 8 }}><span>O {v(b.open)} H {v(b.high)} L {v(b.low)}</span>{vol}</div>}
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: "var(--t1)", fontWeight: 400 }}>{b.realDate ?? b.date}{b.partial && <span style={{ color: "var(--yellow)", fontWeight: 500 }}> · in progress</span>}</span>
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
            <svg ref={svgRef} aria-hidden="true" className="chart-draw-layer" />
            {page && narrow && (
              <div className="chart-zoom" style={volTop != null ? { top: volTop - 50 } : { bottom: 42 }}>
                <button type="button" onClick={() => zoom(1.4)} aria-label="Zoom out">−</button>
                <button type="button" onClick={() => zoom(0.7)} aria-label="Zoom in">+</button>
              </div>
            )}
            {page && narrow && volTop != null && <span className="chart-vol-label" aria-hidden="true" style={{ top: volTop + 6 }}>Volume</span>}
            {picked && (() => {
              const b = picked.bar, ch = picked.prev ? b.close - picked.prev.close : null, pct = picked.prev?.close ? (ch / picked.prev.close) * 100 : null;
              return (
                <div className="chart-candle-card" role="status">
                  <button type="button" onClick={() => setPicked(null)} aria-label="Close the day's figures"><X size={14} aria-hidden="true" /></button>
                  <div className="chart-candle-date">{new Date(`${b.realDate ?? b.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}{b.partial ? " · in progress" : ""}</div>
                  <div className="chart-candle-close">{fmtRs(b.close)}{pct != null && <span style={{ color: ch >= 0 ? "var(--green)" : "var(--red)" }}> {ch >= 0 ? "+" : "−"}{Math.abs(pct).toFixed(2)}%</span>}</div>
                  <dl>
                    <div><dt>Open</dt><dd>{fmtNum(b.open)}</dd></div>
                    <div><dt>High</dt><dd>{fmtNum(b.high)}</dd></div>
                    <div><dt>Low</dt><dd>{fmtNum(b.low)}</dd></div>
                    <div><dt>Volume</dt><dd>{fmtVol(b.volume)}</dd></div>
                  </dl>
                </div>
              );
            })()}
            <div
              ref={hostRef}
              role="figure"
              aria-label={`${name || symbol} ${prefs.type} chart, ${INTERVALS.find(i => i.id === prefs.interval)?.title.toLowerCase()} bars, ${first?.date} to ${last?.date}. ${last?.partial ? "Latest price, today in progress," : "Last close"} ${fmtRs(last?.close)}${rangeChange != null ? `, ${rangeChange >= 0 ? "up" : "down"} ${Math.abs(rangeChange).toFixed(1)} percent over ${range === "All" ? "all history" : range}` : ""}.${levelLines.length ? ` Levels shown: ${levelLines.map(l => `${l.title} ${fmtRs(l.price)}`).join(", ")}.` : ""}`}
              style={{ ...(page ? { flex: 1, minHeight: 200 } : { height }), width: "100%", cursor: drawing ? "crosshair" : undefined, opacity: loading ? 0.6 : 1 }}
            />
          </>
        )}
      </div>

      {page && narrow ? (
        <div className="chart-page-foot">
          {rangeChange != null && <span className="chart-page-chg">Chg. <b style={{ color: rangeChange >= 0 ? "var(--green)" : "var(--red)" }}>{rangeChange >= 0 ? "+" : "−"}{Math.abs(rangeChange).toFixed(2)}%</b></span>}
          <div role="group" aria-label="Date range" className="chart-page-ranges">
            {RANGES.map(r => <button key={r.id} type="button" onClick={() => pickRange(r.id)} aria-pressed={range === r.id}>{r.id}</button>)}
          </div>
          <a href="https://www.tradingview.com/" target="_blank" rel="noopener" className="chart-page-credit">Chart by TradingView</a>
        </div>
      ) : (
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div role="group" aria-label="Date range" style={narrow ? { display: "grid", gridTemplateColumns: `repeat(${RANGES.length}, minmax(0, 1fr))`, gap: 4, width: "100%" } : group}>
          {RANGES.map(r => (
            <button key={r.id} type="button" onClick={() => pickRange(r.id)} aria-pressed={range === r.id} style={btn(range === r.id, narrow ? { minWidth: 0, padding: 0, justifyContent: "center", fontSize: 11.5 } : { minWidth: 38, justifyContent: "center" })}>{r.id}</button>
          ))}
        </div>
        <span style={{ marginLeft: narrow ? 0 : "auto", fontSize: 10, color: "var(--t3)" }}>
          {data?.stale ? `${data.staleReason} · ` : ""}{INTERVALS.find(i => i.id === prefs.interval)?.title} bars · NSE closes{data?.keptFrom ? ` from ${new Date(`${data.keptFrom}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })}` : ""} · {narrow ? "drag sideways to pan, pinch to zoom, tap a candle for its figures" : "drag to pan, scroll to zoom, click a candle for its figures"}
          {" · "}<a href="https://www.tradingview.com/" target="_blank" rel="noopener" style={{ color: "inherit" }}>Chart by TradingView</a>
        </span>
      </div>
      )}
      {narrow && pivotNow && <div style={{ marginTop: 10 }}>{levelLists}</div>}

      {tableOpen && createPortal(
        <div className="chart-table-wrap" role="dialog" aria-modal="true" aria-label={`${symbol} prices`} onClick={e => { if (e.target === e.currentTarget) setTableOpen(false); }}>
          <div className="chart-table-card">
            <div className="chart-table-head">
              <h2>{symbol}</h2>
              <button type="button" onClick={copyTable} style={btn(copied)}>{copied ? "Copied" : "Copy"}</button>
              <button type="button" onClick={() => setTableOpen(false)} aria-label="Close the table" style={btn(false, { padding: "0 8px" })}><X size={15} aria-hidden="true" /></button>
            </div>
            <div className="chart-table-scroll">
              <table>
                <thead><tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Change</th><th>Volume</th></tr></thead>
                <tbody>
                  {tableBars.map((b, i) => {
                    const prev = tableBars[i + 1], pct = prev?.close ? ((b.close - prev.close) / prev.close) * 100 : null;
                    return <tr key={b.date}><td>{new Date(`${b.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" })}</td><td>{fmtNum(b.open)}</td><td>{fmtNum(b.high)}</td><td>{fmtNum(b.low)}</td><td>{fmtNum(b.close)}</td><td style={{ color: pct == null ? undefined : pct >= 0 ? "var(--green)" : "var(--red)" }}>{pct == null ? "—" : `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(2)}%`}</td><td>{fmtVol(b.volume)}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {expanded && createPortal(
        <div className="chart-overlay" role="dialog" aria-modal="true" aria-label={`${name || symbol} price chart`}>
          <ChartTopBar symbol={overlaySym} onSymbol={setOverlaySym} onClose={closeExpanded} />
          <PriceChartPanel key={overlaySym} symbol={overlaySym} name={overlaySym === symbol ? name : ""} levels={overlaySym === symbol ? levels : null} page />
        </div>,
        document.body,
      )}
    </div>
  );
}
