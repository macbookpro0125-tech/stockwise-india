import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Maximize2, Minimize2, Search, X, Plus, Minus, Scan } from "lucide-react";
import { api } from "./api.js";
import { niceName } from "./stockName.js";
import { breadth, groupMove, layoutHeat } from "./heatLayout.js";
import { useWatchlist } from "./watchlist.js";
import { portfolioStore } from "./stores.js";
import { crShort, label, shortDate } from "./ExploreView.jsx";

// The map, 31 Oct 2026 ("have you seen Finviz's maps"): companies grouped in a
// block for each sector and, where there's room, each industry; the Nifty 500
// and the whole market; boxes by market value or all the same size; a year of
// periods; a card on hover with the company's industry beside it; a sector
// opened on its own; and the whole screen for it on a computer. Then (the same
// day): coloured by more than the move, the user's own watchlist and portfolio
// as maps, and how many rose and fell, in each sector and in all. And: a
// company found by name, a screen's results as a map, a mark on those with
// results in the coming week, and F&O, PSU and theme filters. And a real
// zoom ("when I zoom in, the details it doesn't show should show"): the map is
// laid out again at the zoomed size, so a box too small for its name gets one.
const HEAT_SETS = [["Nifty 50", "NIFTY 50"], ["Nifty Bank", "Bank Nifty"], ["Nifty Next 50", "Next 50"], ["NIFTY Midcap 100", "Midcap 100"], ["NIFTY Smallcap 100", "Smallcap 100"], ["NIFTY 500", "Nifty 500"], ["all", "All NSE"], ["sectors", "Sectors"], ["watchlist", "My watchlist"], ["portfolio", "My portfolio"]];
const MINE = new Set(["watchlist", "portfolio", "screen"]);
// The quick filters: everything, F&O stocks, government-owned, or one theme ("theme:Defence")
const ONLY = [["", "All companies"], ["fno", "F&O stocks"], ["psu", "PSUs"]];
const passes = (only, i) => !only || (only === "fno" ? i.fno : only === "psu" ? i.psu : i.themes?.includes(only.slice(6)));
const dayMonth = d => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
// [id, label, the move that's full colour, in words]
const HEAT_PERIODS = [["1d", "1D", 3, "the day"], ["1w", "1W", 6, "the week"], ["1m", "1M", 10, "the month"], ["3m", "3M", 15, "three months"], ["6m", "6M", 20, "six months"], ["1y", "1Y", 30, "the year"]];
// Deeper green or red the bigger the move, full at ±3% a day (±6% a week, ±10% a month…)
export const heatColor = (c, limit) => {
  const t = Math.min(1, Math.abs(c) / limit);
  if (Math.abs(c) < 0.05) return "var(--s3)";
  return `color-mix(in srgb, ${c > 0 ? "#1f9d55" : "#d64545"} ${Math.round(28 + 62 * t)}%, var(--s2))`;
};
export const pct = c => `${c > 0 ? "+" : c < 0 ? "−" : ""}${Math.abs(c).toFixed(2)}%`;
const sign = c => (c > 0 ? "+" : c < 0 ? "−" : "");
const clamp = (v, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
// −1 red … +1 green, as a move at the limit
const diverge = t => heatColor(clamp(t), 1);
// a figure that has no good or bad side (volume, delivery): one hue, deeper the more
const deeper = t => `color-mix(in srgb, #3b82f6 ${Math.round(16 + 74 * clamp(t, 0, 1))}%, var(--s2))`;

// What the boxes can be coloured by. Each: its figure from an item (null: none), how
// strongly it colours (−1…1, or 0…1 for one hue), how it's written on the box, and the
// ends of its key. The P/E is against its own sector's median, so a bank isn't set
// against a software company.
const COLOUR_BY = [
  { id: "move", label: "Price move", get: i => i.change, t: (v, c) => v / c.limit, text: v => `${sign(v)}${Math.abs(v).toFixed(2)}%`,
    key: c => [`−${c.limit}%`, `+${c.limit}%`], words: w => `the move over ${w}` },
  { id: "vsNifty", label: "Move vs Nifty 50", get: i => i.vsNifty, t: (v, c) => v / c.limit, text: v => `${sign(v)}${Math.abs(v).toFixed(1)} pts`,
    key: c => [`${c.limit} pts behind`, `${c.limit} pts ahead`], words: w => `ahead of or behind the Nifty 50 over ${w}` },
  { id: "high", label: "Distance from 52-week high", get: i => i.down52, t: v => 1 - Math.min(v, 40) / 20, text: v => (v < 0.5 ? "At high" : `−${v.toFixed(0)}%`),
    key: () => ["40% below", "At the high"], words: () => "how far below its 52-week high" },
  { id: "volume", label: "Volume vs 50-day average", get: i => i.volX, one: true, t: v => (v > 1 ? Math.log2(v) / 2 : 0), text: v => `${v.toFixed(1)}×`,
    key: () => ["Usual", "4× usual"], words: () => "the day's volume against its 50-day average" },
  { id: "delivery", label: "Delivery % (1 month)", get: i => i.delivery, one: true, t: v => (v - 20) / 50, text: v => `${Math.round(v)}%`,
    key: () => ["20%", "70%+"], words: () => "the share of traded shares taken for delivery, a month's average" },
  { id: "strength", label: "Price strength (1–99)", get: i => i.strength, t: v => (v - 50) / 49, text: v => `${Math.round(v)}`,
    key: () => ["1", "99"], words: () => "price strength, 1 to 99" },
  { id: "quality", label: "Quality score", get: i => i.quality, t: v => (v - 50) / 35, text: v => `${Math.round(v)}`,
    key: () => ["Weak", "Strong"], words: () => "the quality score" },
  { id: "pe", label: "P/E vs its sector", get: i => (i.pe > 0 ? i.pe : null), t: (v, c, i) => { const m = c.medians.get(i.sector || "Other"); return m ? (m - v) / m : 0; }, text: v => `P/E ${v.toFixed(0)}`,
    key: () => ["Dearer than its sector", "Cheaper"], words: () => "the P/E against its sector's median" },
  { id: "gain", label: "My gain or loss", mine: "portfolio", get: i => i.gainPct, t: v => v / 30, text: v => `${sign(v)}${Math.abs(v).toFixed(1)}%`,
    key: () => ["−30%", "+30%"], words: () => "your gain or loss on what you paid" },
];
// an item's colour, the figure on its box, and whether it's pale (dark letters in the light theme)
function paint(mode, i, ctx) {
  const v = mode.get(i);
  if (v == null || Number.isNaN(v)) return { bg: "var(--s3)", text: "—", pale: true, missing: true };
  const t = mode.t(v, ctx, i);
  return { bg: mode.one ? deeper(t) : diverge(t), text: mode.text(v), pale: Math.abs(t) < 0.5 };
}

// A name in n lines, split evenly (DRREDDY: DRR / ED / DY, not DRR / EDD / Y)
function evenly(name, n) {
  const lines = [];
  for (let i = 0, at = 0; i < n; i++) { const len = Math.ceil((name.length - at) / (n - i)); lines.push(name.slice(at, at + len)); at += len; }
  return lines;
}

// how wide a run of bold capitals is, in ems: W and M wider, I and punctuation narrower
const ems = str => [...str].reduce((w, c) => w + (/[WM]/.test(c) ? 0.98 : /[I1.,'\-&]/.test(c) ? 0.42 : /\d/.test(c) ? 0.66 : 0.76), 0);
// Each tile's label: the name as large as the box allows, whole, on one line where it reads
// well, else on two or three lines, or running up a tall thin tile. Down to 5.5 px, so even a
// phone's smallest tiles say whose they are ("write something in the tiles itself", 23 Oct
// 2026). The move only where there's room too.
export function fitLabel(t, name, move) {
  const ways = [];
  for (const up of t.h > t.w * 1.4 ? [false, true] : [false]) {
    const along = up ? t.h : t.w, across = up ? t.w : t.h;
    for (const n of [1, 2, 3]) {
      if (n > 1 && name.length < n * 2) continue;
      const per = Math.max(...evenly(name, n).map(ems));
      for (const withMove of [true, false]) {
        const size = Math.min(n === 1 ? 22 : 16, Math.max(9, Math.sqrt(t.w * t.h) / 4.6), (along - 6) / per,
          (across - 4) / (n * 1.15 + (withMove ? 0.8 * 1.2 : 0)), withMove ? (along - 6) / (move.length * 0.6 * 0.8) : Infinity);
        ways.push({ up, n, withMove, size });
      }
    }
  }
  // The first that reads well, the move kept wherever it fits: one line at 8.5 px or more, two
  // lines, running up the tile, two lines up it, three lines (7.5 px); then the same, smaller
  // (5 px); the name alone only where even that leaves no room for the move
  const rank = o => (o.withMove ? 0 : 10) + (o.up ? [2, 3, 5][o.n - 1] : [0, 1, 4][o.n - 1]);
  const order = [...ways].sort((a, b) => rank(a) - rank(b));
  const pick = order.find(o => o.withMove && o.size >= (o.n === 1 && !o.up ? 8.5 : 7.5))
    ?? order.find(o => o.withMove && o.size >= 5)
    ?? order.find(o => o.size >= 5.5)
    ?? ways.reduce((a, b) => (b.size > a.size ? b : a));
  const named = pick.size >= 5;
  return { lines: evenly(name, pick.n), up: pick.up, size: pick.size, named, moved: named && pick.withMove };
}

// How far the map zooms in, and how it's kept inside its frame
const MAX_ZOOM = 12;
const clampView = (v, w, h) => {
  const z = Math.max(1, Math.min(MAX_ZOOM, v.z));
  return { z, x: Math.max(0, Math.min(w * z - w, v.x)), y: Math.max(0, Math.min(h * z - h, v.y)) };
};

const canHover = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

// The card beside the pointer: the company, its move, and how its industry moved with it.
// Fixed to the window, so the map's edge never clips it; it measures itself and stays on screen.
function HeatCard({ t, items, limit, words, at, mode, ctx }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: at.x + 16, top: at.y + 12 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width: w, height: h } = el.getBoundingClientRect();
    const left = at.x + 16 + w > window.innerWidth - 8 ? Math.max(8, at.x - 16 - w) : at.x + 16;
    const top = Math.max(8, Math.min(at.y + 12, window.innerHeight - h - 8));
    setPos(p => (p.left === left && p.top === top ? p : { left, top }));
  }, [at.x, at.y, t]);
  // its industry; a company NSE gives no industry, its sector
  const by = t.industry ? "industry" : t.sector ? "sector" : null;
  const peers = t.symbol && by ? items.filter(i => i[by] === t[by]).sort((a, b) => b.cap - a.cap).slice(0, 8) : [];
  if (t.symbol && peers.length && !peers.some(p => p.symbol === t.symbol)) peers[peers.length - 1] = t;
  return (
    <div ref={ref} className="ex-heat-card" style={pos} aria-hidden="true">
      <div className="ex-hc-top">
        <span className="ex-hc-name">{t.symbol ? niceName(t.name ?? t.symbol) : label(t.index)}</span>
        <span className={`ex-hc-move ${t.change >= 0 ? "up" : "down"}`}>{pct(t.change)}</span>
      </div>
      <div className="ex-hc-sub">
        {t.symbol ? <>{t.symbol}{t.industry || t.sector ? ` · ${t.industry || t.sector}` : ""}</> : "Sector index"}
      </div>
      {t.symbol && (
        <div className="ex-hc-facts">
          {t.close != null && <span>₹{t.close.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>}
          <span>Value {crShort(t.cap)}</span>
          <span>over {words}</span>
        </div>
      )}
      {t.resultsOn && <div className="ex-hc-colour"><span className="ex-hc-dot" aria-hidden="true" /> Results on <b>{dayMonth(t.resultsOn)}</b></div>}
      {t.symbol && mode.id !== "move" && <div className="ex-hc-colour">{mode.label}: <b>{paint(mode, t, ctx).text}</b></div>}
      {t.symbol && mode.id !== "gain" && t.gainPct != null && <div className="ex-hc-colour">Your gain: <b>{pct(t.gainPct)}</b></div>}
      {peers.length > 1 && (
        <>
          <div className="ex-hc-head">{by === "industry" ? "Its industry" : "Its sector"}</div>
          <ul className="ex-hc-peers">
            {peers.map(p => (
              <li key={p.symbol} className={p.symbol === t.symbol ? "me" : ""}>
                <i style={{ background: heatColor(p.change, limit) }} />
                <span className="ex-hc-sym">{p.symbol}</span>
                <span className={`ex-hc-pm ${p.change >= 0 ? "up" : "down"}`}>{pct(p.change)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// A sector in brief, under the map when it's opened on its own: its rises and falls, its
// middle P/E now against its last five year-ends, results due, its industries, its index
function SectorBrief({ name, period, words, onOpenStock, onOpenIndex }) {
  const [b, setB] = useState(null);
  useEffect(() => { setB(null); api.sectorBrief(name, period).then(setB).catch(() => setB({ failed: true })); }, [name, period]);
  if (!b) return <div className="nw-skel mm-brief-wait" role="status" aria-label={`Loading ${name}`}>{[0, 1, 2].map(i => <span key={i} />)}</div>;
  if (b.failed) return null;
  const peMax = Math.max(...b.peYears.map(y => y.pe), b.medianPe ?? 0) || 1;
  const Row = ({ r }) => (
    <li><button type="button" className="mm-brief-co" onClick={() => onOpenStock(r.symbol)}>
      <span className="mm-brief-sym">{r.symbol}</span><span className="mm-brief-name">{niceName(r.name)}</span>
      <span className={`mm-brief-move ${r.change >= 0 ? "up" : "down"}`}>{pct(r.change)}</span>
    </button></li>
  );
  return (
    <section className="mm-brief" aria-labelledby="mm-brief-h">
      <div className="mm-brief-top">
        <h3 className="ex-h" id="mm-brief-h">{name} in brief</h3>
        {b.index && onOpenIndex && <button type="button" className="ex-heat-back" onClick={() => onOpenIndex(b.index)}>{b.index}: its year and news ›</button>}
      </div>
      <p className="mm-brief-lede">{b.count} companies, worth {crShort(b.marketCapCr)} together{b.medianPe ? `; the middle P/E is ${b.medianPe.toFixed(1)}` : ""}{b.peYears.length > 1 ? `, against ${Math.min(...b.peYears.map(y => y.pe)).toFixed(0)} to ${Math.max(...b.peYears.map(y => y.pe)).toFixed(0)} at its last ${b.peYears.length} year-ends` : ""}.</p>
      <div className="mm-brief-grid">
        <div>
          <h4 className="mm-brief-h4">Rose most over {words}</h4>
          {b.risers.length ? <ol className="mm-brief-list">{b.risers.map(r => <Row key={r.symbol} r={r} />)}</ol> : <p className="mm-brief-none">None rose.</p>}
        </div>
        <div>
          <h4 className="mm-brief-h4">Fell most over {words}</h4>
          {b.fallers.length ? <ol className="mm-brief-list">{b.fallers.map(r => <Row key={r.symbol} r={r} />)}</ol> : <p className="mm-brief-none">None fell.</p>}
        </div>
        {b.peYears.length > 1 && (
          <div>
            <h4 className="mm-brief-h4">Middle P/E, year by year</h4>
            <div className="mm-pe" role="img" aria-label={`Middle P/E: ${b.peYears.map(y => `${y.year} ${y.pe}`).join(", ")}${b.medianPe ? `, now ${b.medianPe.toFixed(1)}` : ""}`}>
              {[...b.peYears.map(y => ({ label: `Mar ${y.year.slice(2)}`, pe: y.pe })), ...(b.medianPe ? [{ label: "Now", pe: b.medianPe, now: true }] : [])].map(y => (
                <span key={y.label} className={`mm-pe-col${y.now ? " now" : ""}`}>
                  <span className="mm-pe-v">{y.pe.toFixed(0)}</span>
                  <span className="mm-pe-bar" style={{ height: `${Math.max(6, (y.pe / peMax) * 64)}px` }} />
                  <span className="mm-pe-l">{y.label}</span>
                </span>
              ))}
            </div>
            <p className="mm-brief-note">Each year the middle of its companies' own P/Es at the year-end price.</p>
          </div>
        )}
        <div>
          <h4 className="mm-brief-h4">Results in the next two weeks</h4>
          {b.results.length ? <ul className="mm-brief-list">{b.results.map(r => (
            <li key={r.symbol}><button type="button" className="mm-brief-co" onClick={() => onOpenStock(r.symbol)}>
              <span className="mm-brief-date">{dayMonth(r.date)}</span><span className="mm-brief-name">{niceName(r.name)}</span>
            </button></li>
          ))}</ul> : <p className="mm-brief-none">None on NSE's calendar.</p>}
        </div>
      </div>
      {b.industries.length > 1 && (
        <div className="mm-brief-inds" aria-label="Its industries">
          {b.industries.map(i => <span key={i.name} className="mm-brief-ind">{i.name} <b className={i.change >= 0 ? "up" : "down"}>{i.change == null ? "—" : pct(i.change)}</b> <small>{i.count}</small></span>)}
        </div>
      )}
    </section>
  );
}

export default function MarketMapView({ onOpenStock, onOpenIndex, screen = null, request = null }) {
  const [set, setSet] = useState("Nifty 50");
  const [period, setPeriod] = useState("1d");
  const [size, setSize] = useState("cap");
  const [colour, setColour] = useState("move");
  const [only, setOnly] = useState("");
  const [find, setFind] = useState("");
  // from a company page: the whole market, its sector open, the company found
  useEffect(() => { if (request) { setSet("all"); setOnly(""); setFocus(request.sector ?? null); setFind(request.find ?? ""); } }, [request?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  // a screen sent from the Workspace opens as its own map
  useEffect(() => { if (screen?.symbols?.length) { setSet("screen"); setFocus(null); } }, [screen?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const [focus, setFocus] = useState(null);
  const [full, setFull] = useState(false);
  // the zoom: how far in (z) and which part is in the frame (x, y, in the zoomed map's pixels)
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [hover, setHover] = useState(null);
  const [data, setData] = useState(null);
  const [width, setWidth] = useState(0);
  const [screenH, setScreenH] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  const box = useRef(null), fullBtn = useRef(null);
  // full screen: the map fills what the choices above it leave
  const [fullTop, setFullTop] = useState(150);
  useLayoutEffect(() => { if (full && box.current) setFullTop(box.current.offsetTop); }, [full, width, screenH, set, focus]);
  // on the page: the map fills the window under the choices (its top, from the page's top)
  const [pageTop, setPageTop] = useState(260);
  useLayoutEffect(() => { if (!full && box.current) setPageTop(box.current.getBoundingClientRect().top + window.scrollY); }, [full, width, set, focus, data == null]);
  useEffect(() => {
    const onResize = () => setScreenH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // The user's own: the watchlist's symbols, or the portfolio's holdings (a company bought in
  // several lots taken together: its shares, and what they cost)
  const watch = useWatchlist();
  const portfolio = portfolioStore.use();
  const held = useMemo(() => {
    const m = new Map();
    for (const h of portfolio?.holdings ?? []) {
      const was = m.get(h.ticker) ?? { qty: 0, invested: 0 };
      m.set(h.ticker, { qty: was.qty + h.qty, invested: was.invested + h.qty * h.buyPrice });
    }
    return m;
  }, [portfolio]);
  const mine = set === "watchlist" ? [...(watch ?? [])].sort() : set === "portfolio" ? [...held.keys()].sort() : set === "screen" ? (screen?.symbols ?? []).slice(0, 600) : null;
  const mineKey = mine?.join(",") ?? "";
  useEffect(() => {
    setData(null); setHover(null);
    if (mine && !mine.length) { setData({ items: [], empty: true }); return; }
    (mine ? api.heatmap("list", period, mine) : api.heatmap(set, period)).then(setData).catch(() => setData({ items: [], pending: true }));
  }, [set, period, mineKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // The whole screen: the page behind stays still, Esc or the button comes back
  useEffect(() => {
    if (!full) return;
    const onResize = () => setScreenH(window.innerHeight);
    const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); setFull(false); } };
    onResize();
    const root = document.documentElement, before = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey, true);
    fullBtn.current?.focus();
    return () => { root.style.overflow = before; window.removeEventListener("resize", onResize); window.removeEventListener("keydown", onKey, true); };
  }, [full]);

  const [, , limit, words] = HEAT_PERIODS.find(([p]) => p === period);
  const grouped = set !== "sectors";
  const big = set === "all" || set === "NIFTY 500";
  // a phone's is taller than wide, so its smaller tiles have room for a name
  const height = full ? Math.max(320, screenH - fullTop - 52)
    : width < 640 ? Math.round(width * (big ? 2 : 1.6)) : Math.round(Math.max(560, screenH - 150));
  // a holding's box is the size of what it's worth to you
  const items = useMemo(() => (data?.items ?? []).map(i => {
    const h = set === "portfolio" ? held.get(i.symbol) : null;
    const worth = h && i.close > 0 ? h.qty * i.close : null;
    const gainPct = h && worth != null && h.invested > 0 ? (worth / h.invested - 1) * 100 : null;
    return { ...i, cap: i.weight, worth, gainPct, weight: size === "equal" ? 1 : worth ?? i.weight };
  }), [data, size, set, held]);
  // the themes these companies are in, for the filter; a theme none of them has is dropped
  const themes = useMemo(() => [...new Set(items.flatMap(i => i.themes ?? []))].sort(), [items]);
  const onlyNow = only.startsWith("theme:") && !themes.includes(only.slice(6)) ? "" : only;
  const allItems = items;
  const modes = COLOUR_BY.filter(m => !m.mine || m.mine === set);
  const mode = set === "sectors" ? COLOUR_BY[0] : modes.find(m => m.id === colour) ?? COLOUR_BY[0];
  // each sector's median P/E, for "P/E vs its sector"
  const medians = useMemo(() => {
    const by = new Map();
    for (const i of items) if (i.pe > 0) { const k = i.sector || "Other"; if (!by.has(k)) by.set(k, []); by.get(k).push(i.pe); }
    return new Map([...by].map(([k, list]) => { list.sort((a, b) => a - b); return [k, list[Math.floor(list.length / 2)]]; }));
  }, [items]);
  const ctx = useMemo(() => ({ limit, medians }), [limit, medians]);
  const kept = useMemo(() => (onlyNow ? allItems.filter(i => passes(onlyNow, i)) : allItems), [allItems, onlyNow]);
  const sectors = useMemo(() => {
    const seen = new Map();
    for (const i of kept) if (i.symbol) seen.set(i.sector || "Other", (seen.get(i.sector || "Other") ?? 0) + i.cap);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [kept]);
  // a sector that isn't in this list any more: back to the whole map
  const zoom = grouped && focus && sectors.includes(focus) ? focus : null;
  // laid out at the zoomed size, so a zoomed-in box has the room, and the words, of a big one
  const { tiles, heads } = useMemo(() => layoutHeat(kept, width * view.z, height * view.z, { group: grouped, focus: zoom }), [kept, width, height, grouped, zoom, view.z]);
  // only what's in the frame, and half a frame round it, is drawn
  const near = r => r.x + r.w >= view.x - width / 2 && r.x <= view.x + width * 1.5 && r.y + r.h >= view.y - height / 2 && r.y <= view.y + height * 1.5;
  const laid = useMemo(() => tiles.filter(near).map(t => {
    const name = t.symbol ?? label(t.index);
    const { bg, text: move, pale } = paint(mode, t, ctx);
    // a box bigger than the frame: its words go in the part of it that's in view
    const vx = Math.max(t.x, view.x), vy = Math.max(t.y, view.y);
    const seen = { x: vx - t.x, y: vy - t.y, w: Math.min(t.x + t.w, view.x + width) - vx, h: Math.min(t.y + t.h, view.y + height) - vy };
    const cut = view.z > 1 && seen.w > 20 && seen.h > 20 && (seen.w < t.w - 1 || seen.h < t.h - 1);
    const fit = fitLabel(cut ? { ...t, w: seen.w, h: seen.h } : t, name, move);
    // a big box says more: the company's name, then its price
    const room = cut ? seen : t;
    const more = t.symbol && fit.moved && room.w >= 130 && room.h >= 84;
    return { t, name, ...fit, move, bg, pale, at: cut ? seen : null, long: more ? niceName(t.name ?? t.symbol) : null, price: more && room.h >= 110 && t.close != null ? `₹${t.close.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : null };
  }), [tiles, mode, ctx, view.x, view.y, width, height]); // eslint-disable-line react-hooks/exhaustive-deps
  const inView = zoom ? kept.filter(i => (i.sector || "Other") === zoom) : kept;
  const zoomMove = zoom ? groupMove(inView) : null;
  // the whole map's move: by market value, or for a portfolio by what each holding is worth
  const counts = breadth(inView), allMove = groupMove(set === "portfolio" ? inView.map(i => ({ ...i, cap: i.worth ?? 0 })) : inView);
  const missing = set === "sectors" ? 0 : inView.filter(i => mode.get(i) == null).length;
  const shown = zoom ? tiles.length : kept.length;
  // Find: a company by its symbol or name; its box lights up and the rest dim
  const q = find.trim().toLowerCase();
  const hits = useMemo(() => (q ? new Set(kept.filter(i => i.symbol && (i.symbol.toLowerCase().startsWith(q) || (q.length > 2 && (i.name ?? "").toLowerCase().includes(q)))).map(i => i.symbol)) : null), [q, kept]);
  // found in a sector that isn't open: the whole map again
  useEffect(() => { if (hits?.size && zoom && !tiles.some(t => hits.has(t.symbol))) setFocus(null); }, [hits]); // eslint-disable-line react-hooks/exhaustive-deps
  const firstHit = hits?.size ? tiles.find(t => hits.has(t.symbol)) : null;

  // the boxes don't change as the pointer moves: made once, so the card follows without redrawing 1,600 of them
  const tileEls = useMemo(() => laid.map(({ t, name, lines, up, named, moved, size: fs, move, bg, pale, long, price, at }, k) => (
          <button key={t.symbol ?? t.index} type="button" data-tile={k} className={`ex-tile${pale ? " pale" : ""}${hits?.has(t.symbol) ? " hit" : ""}`}
            aria-label={`${t.name ? niceName(t.name) : name}, ${t.change >= 0 ? "up" : "down"} ${Math.abs(t.change).toFixed(2)}% over ${words}${mode.id !== "move" ? `; ${mode.label}: ${move}` : ""}${t.resultsOn ? `; results on ${dayMonth(t.resultsOn)}` : ""}`}
            onClick={() => { if (!dragged.current) open(t); }}
            style={{ left: t.x, top: t.y, width: t.w, height: t.h, background: bg }}>
            {t.resultsOn && t.w >= 14 && t.h >= 14 && <span className="ex-tile-dot" aria-hidden="true" />}
            {named && (
              <span className={`ex-tile-in${up ? " up" : ""}${at ? " seen" : ""}`} style={at ? { left: at.x, top: at.y, width: at.w, height: at.h } : undefined}>
                <span className="ex-tile-name" style={{ fontSize: fs }}>{lines.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{l}</Fragment>)}</span>
                {moved && <span className="ex-tile-chg" style={{ fontSize: Math.min(15, Math.max(fs * 0.8, fs >= 10 ? 8 : 0)) }}>{move}</span>}
                {long && <span className="ex-tile-more">{long}</span>}
                {price && <span className="ex-tile-more">{price}</span>}
              </span>
            )}
          </button>
        )), [laid, words, mode, hits]); // eslint-disable-line react-hooks/exhaustive-deps
  // a card fixed to the window would be left behind by a scroll
  const hovering = hover != null;
  useEffect(() => {
    if (!hovering) return;
    const off = () => setHover(null);
    window.addEventListener("scroll", off, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", off, { capture: true });
  }, [hovering]);

  // ── Zooming and moving ──
  // zoom to z2 keeping the point (cx, cy) of the frame where it is
  const zoomAt = (cx, cy, z2, base = viewRef.current) => {
    const z = Math.max(1, Math.min(MAX_ZOOM, z2));
    setView(clampView({ z, x: (base.x + cx) * (z / base.z) - cx, y: (base.y + cy) * (z / base.z) - cy }, width, height));
  };
  // a new map, or a new size of frame: the whole of it again
  useEffect(() => { setView({ z: 1, x: 0, y: 0 }); }, [set, size, zoom, onlyNow, width, height]);
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };
  // Pinch on a trackpad (a wheel with Ctrl) or Ctrl/⌘ + scroll zooms; zoomed in, scrolling
  // moves the map until it reaches an edge, then the page scrolls on
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = e => {
      const r = el.getBoundingClientRect(), v = viewRef.current, { width: w, height: h } = sizeRef.current;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // a trackpad's pinch comes in small steps, a mouse wheel's in big ones: a notch is about 1.3×
        const z = Math.max(1, Math.min(MAX_ZOOM, v.z * Math.exp(-Math.max(-40, Math.min(40, dy)) * 0.0065)));
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        setView(clampView({ z, x: (v.x + cx) * (z / v.z) - cx, y: (v.y + cy) * (z / v.z) - cy }, w, h));
        return;
      }
      if (v.z <= 1) return;
      const next = clampView({ ...v, x: v.x + dx, y: v.y + dy }, w, h);
      if (next.x === v.x && next.y === v.y) return;
      e.preventDefault();
      setView(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  // Drag to move (zoomed in); two fingers pinch. A drag isn't a click on the box it ends on.
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const dragged = useRef(false);
  const down = e => {
    if (e.button > 0 || e.target.closest?.(".mm-zoom")) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = box.current.getBoundingClientRect(), pts = [...pointers.current.values()];
    dragged.current = false;
    if (pts.length === 2) {
      const mid = { x: (pts[0].x + pts[1].x) / 2 - r.left, y: (pts[0].y + pts[1].y) / 2 - r.top };
      gesture.current = { kind: "pinch", dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mid, base: viewRef.current };
    } else gesture.current = { kind: "drag", sx: e.clientX, sy: e.clientY, base: viewRef.current };
  };
  useEffect(() => {
    const move = e => {
      if (!pointers.current.has(e.pointerId) || !gesture.current) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture.current, { width: w, height: h } = sizeRef.current;
      if (g.kind === "pinch" && pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()], r = box.current.getBoundingClientRect();
        const mid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
        const z = Math.max(1, Math.min(MAX_ZOOM, g.base.z * Math.hypot(a.x - b.x, a.y - b.y) / g.dist));
        dragged.current = true;
        setHover(null);
        setView(clampView({ z, x: (g.base.x + g.mid.x) * (z / g.base.z) - mid.x, y: (g.base.y + g.mid.y) * (z / g.base.z) - mid.y }, w, h));
      } else if (g.kind === "drag" && g.base.z > 1) {
        const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
        if (!dragged.current && Math.hypot(dx, dy) < 5) return;
        dragged.current = true;
        setHover(null);
        setView(clampView({ ...g.base, x: g.base.x - dx, y: g.base.y - dy }, w, h));
      }
    };
    const up = e => {
      if (!pointers.current.delete(e.pointerId)) return;
      if (pointers.current.size === 1 && gesture.current?.kind === "pinch") {
        // one finger left after a pinch: it drags from here
        const [p] = [...pointers.current.values()];
        gesture.current = { kind: "drag", sx: p.x, sy: p.y, base: viewRef.current };
      } else if (!pointers.current.size) {
        gesture.current = null;
        // the click that ends a drag comes after this: let it pass, then clear
        setTimeout(() => { dragged.current = false; }, 0);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, []);
  // found while zoomed in, out of the frame: brought into the middle of it
  useEffect(() => {
    if (!firstHit || view.z <= 1) return;
    const inFrame = firstHit.x + firstHit.w > view.x && firstHit.x < view.x + width && firstHit.y + firstHit.h > view.y && firstHit.y < view.y + height;
    if (!inFrame) setView(v => clampView({ ...v, x: firstHit.x + firstHit.w / 2 - width / 2, y: firstHit.y + firstHit.h / 2 - height / 2 }, width, height));
  }, [firstHit?.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const track = e => {
    if (!canHover() || gesture.current) return;
    const el = e.target.closest?.("[data-tile]");
    if (!el) { setHover(null); return; }
    setHover({ i: Number(el.dataset.tile), x: e.clientX, y: e.clientY });
  };
  const open = t => { setFull(false); t.symbol ? onOpenStock(t.symbol) : onOpenIndex(t.index); };

  return (
    <section className={`mm-page${full ? " ex-heat-fullscreen" : ""}`} aria-labelledby="mm-title" role={full ? "dialog" : undefined} aria-modal={full || undefined}>
      <div className="ex-heat-title">
        <div>
          <h2 className="nw-page-title mm-title" id="mm-title">Market map</h2>
          {!full && <p className="nw-lede mm-lede">Every company a box, sized by its market value and coloured by its move, or by whatever you pick under Colour. Hover for its industry; click a sector's name to open it.</p>}
        </div>
        <button ref={fullBtn} type="button" className="ex-heat-full-btn" aria-pressed={full} aria-label={full ? "Leave full screen" : "Full screen"} title={full ? "Leave full screen (Esc)" : "Full screen"} onClick={() => setFull(f => !f)}>
          {full ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
        </button>
      </div>
      <div className="ex-heat-bar">
        <div className="ph-chips ex-heat-sets" role="group" aria-label="Which companies">
          {HEAT_SETS.map(([id, l]) => <button key={id} type="button" className="ph-chip" aria-pressed={set === id} onClick={() => { setSet(id); setFocus(null); }}>{l}</button>)}
          {screen?.symbols?.length > 0 && <button type="button" className="ph-chip" aria-pressed={set === "screen"} onClick={() => { setSet("screen"); setFocus(null); }}>Screen: {screen.name}</button>}
        </div>
        <div className="ex-heat-opts">
          <div className="ex-ranges ex-heat-periods" role="group" aria-label="Over">
            {HEAT_PERIODS.map(([p, l]) => <button key={p} type="button" className="ex-range" aria-pressed={period === p} onClick={() => setPeriod(p)}>{l}</button>)}
          </div>
          {grouped && (
            <div className="ex-ranges ex-heat-size" role="group" aria-label="Box size">
              <button type="button" className="ex-range" aria-pressed={size === "cap"} onClick={() => setSize("cap")}>By value</button>
              <button type="button" className="ex-range" aria-pressed={size === "equal"} onClick={() => setSize("equal")}>Equal</button>
            </div>
          )}
          {set !== "sectors" && (
            <label className="mm-find">
              <Search size={15} aria-hidden="true" />
              <input type="search" placeholder="Find a company" aria-label="Find a company on the map" value={find} onChange={e => setFind(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && firstHit) open(firstHit); if (e.key === "Escape") setFind(""); }} />
              {find && <button type="button" aria-label="Clear" onClick={() => setFind("")}><X size={14} aria-hidden="true" /></button>}
            </label>
          )}
          {set !== "sectors" && (
            <select className="ex-heat-sector" aria-label="Show" value={onlyNow} onChange={e => { setOnly(e.target.value); setFocus(null); }}>
              {ONLY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {themes.length > 0 && <optgroup label="Themes">{themes.map(t => <option key={t} value={`theme:${t}`}>{t}</option>)}</optgroup>}
            </select>
          )}
          {set !== "sectors" && (
            <select className="ex-heat-sector" aria-label="Colour by" value={mode.id} onChange={e => setColour(e.target.value)}>
              {modes.map(m => <option key={m.id} value={m.id}>Colour: {m.label}</option>)}
            </select>
          )}
          {grouped && sectors.length > 1 && (
            <select className="ex-heat-sector" aria-label="Sector" value={zoom ?? ""} onChange={e => setFocus(e.target.value || null)}>
              <option value="">All sectors</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      </div>
      {zoom && (
        <div className="ex-heat-zoom">
          <button type="button" className="ex-heat-back" onClick={() => setFocus(null)}><ArrowLeft size={15} aria-hidden="true" />All sectors</button>
          <span className="ex-heat-zoom-name">{zoom}</span>
          <span className={`ex-hc-move ${zoomMove >= 0 ? "up" : "down"}`}>{pct(zoomMove)}</span>
        </div>
      )}
      {inView.length > 1 && (
        <div className="mm-breadth" aria-label={`Over ${words}: ${counts.up} rose, ${counts.down} fell, ${counts.flat} unchanged`}>
          <span className="mm-b-text">
            <b className="up">{counts.up} up</b> · <b className="down">{counts.down} down</b>{counts.flat ? ` · ${counts.flat} unchanged` : ""}
            {set !== "sectors" && <> · <span className={allMove >= 0 ? "up" : "down"}>{pct(allMove)}</span> {set === "portfolio" ? "on your holdings" : "by market value"}</>}
            <span className="mm-b-over"> over {words}</span>
          </span>
          <span className="mm-b-bar" aria-hidden="true">
            <i className="up" style={{ flexGrow: counts.up }} /><i style={{ flexGrow: counts.flat }} /><i className="down" style={{ flexGrow: counts.down }} />
          </span>
        </div>
      )}
      {q && <p className="mm-find-note" role="status">{hits.size ? `${hits.size === 1 ? `${firstHit?.symbol ?? "1 company"} is lit` : `${hits.size} companies match`}${firstHit ? " · Enter opens it" : ""}` : `Nothing here matches “${find.trim()}”${set !== "all" ? ". Try All NSE." : "."}`}</p>}
      <div ref={box} className={`ex-heat${grouped ? " grouped" : ""}${hits?.size ? " finding" : ""}${view.z > 1 ? " zoomed" : ""}`} style={{ height, touchAction: view.z > 1 ? "none" : "pan-y" }}
        onPointerDown={down} onPointerMove={track} onPointerLeave={() => setHover(null)}>
        {data == null && <div className="ex-heat-wait" role="status">Drawing the heat map…</div>}
        {data?.empty && <div className="ex-heat-wait">{set === "watchlist" ? "Your watchlist is empty. Star companies and they'll show here." : set === "screen" ? "This screen found no companies." : "No holdings yet. Add them on the Portfolio page and they'll show here."}</div>}
        {data && !data.empty && !data.pending && allItems.length > 0 && kept.length === 0 && <div className="ex-heat-wait">None of these companies is in that group.</div>}
        {data?.pending && <div className="ex-heat-wait">{set === "NIFTY 500" ? "The Nifty 500's companies arrive with the evening data update." : "The heat map arrives with the evening data update."}</div>}
        <div className="ex-heat-world" style={{ transform: `translate3d(${-view.x}px, ${-view.y}px, 0)` }}>
        {heads.filter(h => h.kind === "sector" && h.head && near(h)).map(h => (
          <button key={`s-${h.name}`} type="button" className="ex-heat-head" style={{ left: h.x, top: h.y, width: h.w, height: h.head }}
            aria-label={`Open ${h.name} on its own: ${h.count} companies, ${h.change >= 0 ? "up" : "down"} ${Math.abs(h.change).toFixed(2)}% over ${words}, ${h.up} rose and ${h.down} fell`}
            onClick={() => { if (!dragged.current) setFocus(h.name); }}>
            <span className="ex-heat-head-name">{h.name}</span>
            {h.w >= 210 && <span className="ex-heat-head-br"><span className="up">{h.up}▲</span> <span className="down">{h.down}▼</span></span>}
            <span className="ex-heat-head-move">{pct(h.change)}</span>
          </button>
        ))}
        {heads.filter(h => h.kind === "industry" && h.head && near(h)).map(h => (
          <span key={`i-${h.name}`} className="ex-heat-sub" style={{ left: h.x, top: h.y, width: h.w, height: h.head }} aria-hidden="true">{h.name}</span>
        ))}
        {tileEls}
        </div>
        {kept.length > 0 && (
          <div className="mm-zoom" role="group" aria-label="Zoom">
            <button type="button" aria-label="Zoom out" disabled={view.z <= 1} onClick={() => zoomAt(width / 2, height / 2, view.z / 1.6)}><Minus size={16} aria-hidden="true" /></button>
            <span className="mm-zoom-at" aria-live="polite">{view.z < 1.05 ? "1×" : `${view.z.toFixed(view.z < 10 ? 1 : 0)}×`}</span>
            <button type="button" aria-label="Zoom in" disabled={view.z >= MAX_ZOOM} onClick={() => zoomAt(width / 2, height / 2, view.z * 1.6)}><Plus size={16} aria-hidden="true" /></button>
            {view.z > 1 && <button type="button" aria-label="Fit the whole map" title="The whole map" onClick={() => setView({ z: 1, x: 0, y: 0 })}><Scan size={15} aria-hidden="true" /></button>}
          </div>
        )}
        {hover && laid[hover.i] && <HeatCard t={laid[hover.i].t} items={items} limit={limit} words={words} at={hover} mode={mode} ctx={ctx} />}
      </div>
      <div className="ex-heat-key">
        <span>{set === "sectors" ? "Each sector's index" : `Size: ${size === "equal" ? "all the same" : set === "portfolio" ? "what your holding is worth" : "market value"} · ${shown} ${zoom ? `${zoom} ` : ""}companies${data?.floorCr ? ` over ₹${data.floorCr} cr` : data?.members && data.items.length < data.members ? ` of ${data.members}` : ""}`} · colour: {mode.words(words)}{data?.asOf ? ` to the close on ${shortDate(data.asOf)}` : ""}
          <span className="mm-missing"> · zoom: {canHover() ? "pinch, or Ctrl/⌘ and scroll, or + and −; drag to move" : "pinch, or + and −; drag to move"}</span>
          {kept.some(i => i.resultsOn) && <span className="mm-missing"> · <span className="ex-hc-dot" aria-hidden="true" /> results in the next 7 days</span>}
          {set === "screen" && screen?.symbols?.length > 600 && <span className="mm-missing"> · the screen's first 600 of {screen.symbols.length}</span>}
          {missing > 0 && <span className="mm-missing">{missing === inView.length ? ` · ${mode.label} isn't in today's figures yet; it comes with the evening update` : ` · grey: ${missing} with no figure`}</span>}</span>
        <span className="ex-heat-scale" aria-hidden="true">{(() => {
          const [lo, hi] = mode.key(ctx);
          return <><i style={{ background: mode.one ? deeper(0) : diverge(-1) }} />{lo}{!mode.one && <><i style={{ background: "var(--s3)" }} />{mode.id === "move" ? "0" : ""}</>}<i style={{ background: mode.one ? deeper(1) : diverge(1) }} />{hi}</>;
        })()}</span>
      </div>
      {zoom && set !== "sectors" && <SectorBrief name={zoom} period={period} words={words} onOpenStock={t => open({ symbol: t })} onOpenIndex={onOpenIndex} />}
    </section>
  );
}
