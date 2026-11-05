import { useEffect, useRef, useState } from "react";
import { createChart, AreaSeries, ColorType } from "lightweight-charts";
import { ChevronRight, Plus } from "lucide-react";
import { api } from "./api.js";
import HowItWorks from "./HowItWorks.jsx";
import { ScreenIcon } from "./PhoneScreens.jsx";
import { navigate } from "./site.jsx";
import { tabsFor } from "./Header.jsx";
import { CalendarDays, Layers3, BookOpen } from "lucide-react";

// A computer's home once signed in (1 Nov 2026, the owner: "I want something
// good" of the hero and its bright cards): what's happened to the market and to
// your companies, then the screens. The same calm grouped boxes as a phone's
// Screeners; the whole list of screens, with their tools, stays underneath.
const num = n => (n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = n => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%`);
const tone = n => (n == null ? "var(--t3)" : n >= 0 ? "var(--green)" : "var(--red)");
const day = d => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const short = s => String(s ?? "").replace(/ (Limited|Ltd\.?)$/i, "");
const WATCH_ROWS = 8, QUICK_SCREENS = 6;

// A few stars over the still sky that slowly brighten and dim, each in its own time
const TWINKLES = Array.from({ length: 44 }, (_, i) => ({
  left: `${(i * 37.3 + 4) % 100}%`, top: `${(i * 23.7 + 3) % 70}%`,
  animationDuration: `${4 + (i * 1.7) % 5}s`, animationDelay: `${-((i * 2.3) % 8)}s`,
}));

// Streaks: each crosses in a second or two, then waits its turn
const SHOOTING = Array.from({ length: 20 }, (_, i) => ({
  left: `${22 + (i * 41.7) % 80}%`, top: `${1 + (i * 17.3) % 56}%`,
  animationDelay: `${(i * 3.7) % 29}s`, animationDuration: `${17 + (i * 7) % 21}s`,
}));

// J and I drawn as constellations, floating freely and slowly through the sky
const LETTER_J = [[[26, 6], [62, 3], [94, 8]], [[62, 3], [66, 52], [60, 98], [40, 122], [16, 116], [6, 94]]];
const LETTER_I = [[[6, 8], [34, 4], [62, 7]], [[34, 4], [32, 62], [35, 120]], [[6, 124], [35, 120], [64, 125]]];
function StarLetter({ points, className }) {
  const dots = [...new Set(points.flat().map(p => p.join()))].map(p => p.split(",").map(Number));
  return (
    <svg className={`td-star-letter ${className}`} viewBox="-6 -6 112 142" aria-hidden="true">
      {points.map((line, i) => <polyline key={i} points={line.map(p => p.join()).join(" ")} />)}
      {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2 : 1.5} />)}
    </svg>
  );
}

// A bright star's six thin rays, fading outwards, with a soft glow at the heart
function sixPoints(c, x, y, len) {
  const alpha = c.globalAlpha;
  const halo = c.createRadialGradient(x, y, 0, x, y, len * 0.6);
  halo.addColorStop(0, "rgba(255,255,255,0.28)"); halo.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = halo; c.fillRect(x - len, y - len, len * 2, len * 2);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3, dx = Math.cos(a) * len, dy = Math.sin(a) * len;
    const g = c.createLinearGradient(x - dx, y - dy, x + dx, y + dy);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "#fff"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.strokeStyle = g; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke();
  }
  c.fillStyle = "#fff"; c.globalAlpha = alpha;
}

// Stars that keep travelling: one picture, painted twice side by side and slid
// by exactly one copy, so it runs for ever without a jump. One sliding layer each.
function StarStream({ count, size, seed: start, className, points = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, c = cv?.getContext?.("2d");
    if (!c) return;
    const w = Math.round(cv.clientWidth / 2), h = cv.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * 2 * dpr; cv.height = h * dpr;
    c.scale(dpr, dpr);
    let seed = start;
    const rnd = () => { seed = (seed * 16807) % 2147483647; rnd.last = seed / 2147483647; return rnd.last; };
    c.fillStyle = "#fff";
    for (let i = 0; i < count; i++) {
      const x = rnd() * w, y = rnd() * h, r = size * (0.6 + rnd() * 0.7);
      c.globalAlpha = 0.45 + rnd() * 0.55;
      for (const at of [x, x + w]) {
        if (points) sixPoints(c, at, y, 8 + rnd.last * 14);
        c.beginPath(); c.arc(at, y, points ? 1.2 : r, 0, Math.PI * 2); c.fill();
      }
    }
  }, [count, size, start, points]);
  return <canvas ref={ref} className={`td-stream ${className}`} aria-hidden="true" />;
}

// The front page's night sky, painted once on two layers that the browser
// slides past each other, so moving it costs next to nothing: no 3D scene. The same stars at every visit.
function StarField() {
  const ref = useRef(null), nearRef = useRef(null);
  useEffect(() => {
    const far = ref.current, near = nearRef.current;
    if (!far?.getContext || !near) return undefined;
    // each layer is PAD larger all round than the sky, so it can drift without showing an edge
    const PAD = 44, w = far.clientWidth - PAD * 2, h = far.clientHeight - PAD * 2, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const open = cv => { cv.width = (w + PAD * 2) * dpr; cv.height = (h + PAD * 2) * dpr; const c = cv.getContext("2d"); c.scale(dpr, dpr); c.translate(PAD, PAD); return c; };
    let ctx = open(far);
    const nearCtx = open(near);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const skyH = Math.min(h, 760);
    const glow = (x, y, r, color) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const star = (x, y, r, a, color = "#fff") => { ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    const rays = (x, y, len, a) => {
      ctx.globalAlpha = a;
      for (const [dx, dy] of [[1, 0], [0, 1], [0.7, 0.7], [0.7, -0.7]]) {
        const far = dx && dy ? len * 0.6 : len;
        const g = ctx.createLinearGradient(x - dx * far, y - dy * far, x + dx * far, y + dy * far);
        g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.95)"); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(x - dx * far, y - dy * far); ctx.lineTo(x + dx * far, y + dy * far); ctx.stroke();
      }
    };
    // The Milky Way: a band of soft colour across the sky, thick with faint stars
    const across = t => ({ x: t * w, y: skyH * (0.72 - 0.6 * t) });
    ctx.globalAlpha = 1;
    for (let i = 0; i < 26; i++) {
      const p = across(rnd()), col = ["rgba(86,100,210,0.12)", "rgba(150,100,230,0.1)", "rgba(40,170,170,0.06)"][i % 3];
      glow(p.x, p.y + (rnd() - 0.5) * 70, 110 + rnd() * 150, col);
    }
    for (let i = 0; i < 1000; i++) {
      const p = across(rnd()), off = (rnd() + rnd() + rnd() - 1.5) * 130;
      star(p.x, p.y + off, 0.35 + rnd() * 0.3, 0.3 + rnd() * 0.45);
    }
    // the whole sky
    const tints = ["#fff", "#fff", "#fff", "#CFE0FF", "#FFE9CF"];
    for (let i = 0; i < 950; i++) star(rnd() * (w + PAD * 2) - PAD, rnd() * (h + PAD * 2) - PAD, rnd() < 0.94 ? 0.35 + rnd() * 0.35 : 0.8 + rnd() * 0.4, 0.35 + rnd() * 0.65, tints[Math.floor(rnd() * tints.length)]);
    ctx = nearCtx;
    // Constellations: the teal lines of the front page's film, joining a few groups
    for (let c = 0; c < 6; c++) {
      let x = (0.04 + ((c * 0.17 + rnd() * 0.06) % 0.92)) * w, y = (c % 2 ? 0.1 + rnd() * 0.25 : 0.62 + rnd() * 0.3) * skyH;
      if (x > w * 0.25 && x < w * 0.75 && y < skyH * 0.55) y = skyH * 0.08;
      const n = 4 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const nx = x + (rnd() - 0.3) * 90, ny = y + (rnd() - 0.5) * 70;
        ctx.globalAlpha = 0.42; ctx.strokeStyle = "#00E0BE"; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
        star(x, y, 1.5, 0.95);
        x = nx; y = ny;
      }
      star(x, y, 1.5, 0.95);
    }
    // bright stars with rays, and one great one off to the side of the headline
    for (let i = 0; i < 16; i++) {
      const x = rnd() * w, y = rnd() * skyH;
      ctx.globalAlpha = 1; glow(x, y, 12, "rgba(255,255,255,0.3)");
      rays(x, y, 9 + rnd() * 16, 0.8); star(x, y, 1.3, 1);
    }
    const bigX = w * 0.88, bigY = skyH * 0.24;
    ctx.globalAlpha = 1;
    glow(bigX, bigY, 170, "rgba(255,220,170,0.16)"); glow(bigX, bigY, 40, "rgba(255,255,255,0.6)");
    rays(bigX, bigY, 130, 0.9); star(bigX, bigY, 2.6, 1);
    ctx.globalAlpha = 1;
    // nothing moves while the sky is scrolled out of view
    const hero = far.parentElement;
    // (the sheet covers the sky rather than scrolling it away, so a marker a screen
    // tall says when it's gone)
    const io = new IntersectionObserver(([e]) => hero.classList.toggle("td-still", !e.isIntersecting));
    io.observe(hero.previousElementSibling);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <canvas ref={ref} className="td-sky" aria-hidden="true" />
      <canvas ref={nearRef} className="td-sky td-sky-near" aria-hidden="true" />
      <div className="td-tints" aria-hidden="true"><i /><i /></div>
      <StarStream count={170} size={0.7} seed={11} className="td-stream-slow" />
      <StarStream count={60} size={1.1} seed={29} className="td-stream-fast" />
      <StarStream count={6} size={1} seed={53} className="td-stream-big" points />
      {SHOOTING.map((t, i) => <span key={i} className="td-shoot" aria-hidden="true" style={t} />)}
      {TWINKLES.map((t, i) => <span key={i} className="td-twinkle" aria-hidden="true" style={t} />)}
    </>
  );
}

// The market's last year, large, as the first thing in the summary. Our own
// index history: the Nifty 500's closes, kept with any company's prices.
function MarketChart({ closes }) {
  const host = useRef(null);
  useEffect(() => {
    if (!host.current || !(closes?.length > 1)) return undefined;
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const up = closes.at(-1)[1] >= closes[0][1], line = v(up ? "--green" : "--red");
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "rgba(0, 0, 0, 0)" }, textColor: v("--t3"), fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false }, localization: { locale: "en-IN", priceFormatter: p => Math.round(p).toLocaleString("en-IN") },
      handleScroll: false, handleScale: false,
    });
    // plain rgba: chart drawing can't rely on color-mix() (the line vanished in Safari)
    const m = /^#([0-9a-f]{6})$/i.exec(line), n = m ? parseInt(m[1], 16) : 0x808080;
    const fill = `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0.22)`, none = `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
    const series = chart.addSeries(AreaSeries, { lineColor: line, lineWidth: 2, topColor: fill, bottomColor: none, priceLineVisible: false });
    series.setData(closes.map(([time, value]) => ({ time, value })));
    chart.timeScale().fitContent();
    // the whole year across the box, whatever its width becomes (it was left
    // squeezed to one side when the window changed size)
    const ro = new ResizeObserver(() => chart.timeScale().fitContent());
    ro.observe(host.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [closes]);
  return <div ref={host} className="td-chart" role="img" aria-label="The Nifty 500 over the last year" />;
}

// Every part of the app from one place (1 Nov 2026, the owner: "every option in
// this page"), by name, with what it's for. The bar's own list, so a new page or
// one kept to some accounts turns up here by itself.
const ABOUT = {
  discover: "All the ready-made screens", workspace: "Build your own filter", desk: "A list with its charts beside it",
  explore: "Indices and news", map: "The market, by size and move", momentum: "Short-term moves", watchlist: "Companies you follow",
  portfolio: "What you hold", performance: "How screens have done", alerts: "Your price and results alerts",
};
const SITE_PAGES = [
  { id: "calendar", path: "/results-calendar", label: "Results calendar", about: "Who reports, and when", Icon: CalendarDays },
  { id: "sectors", path: "/sectors", label: "Sectors", about: "Companies by sector", Icon: Layers3 },
  { id: "guides", path: "/learn", label: "Guides", about: "How to read the numbers", Icon: BookOpen },
];

const PAGE_GROUPS = [
  { title: "Find companies", items: ["discover", "workspace", "desk", "guides"] },
  { title: "The market", items: ["explore", "map", "momentum", "calendar", "sectors"] },
  { title: "Your things", items: ["watchlist", "portfolio", "performance", "alerts"] },
];

export default function TodayHome({ visible = true, onOpenStock, onOpenTab, onOpenIndex, onPickScreen, onCreate, account = null, continueCard = null, newsTile = null, children }) {
  const [presets, setPresets] = useState([]);
  useEffect(() => { api.presets().then(p => setPresets(p ?? [])).catch(() => {}); }, []);

  // The header and the left bar go black with the sky while it's on screen, on the
  // light theme too (index.css html.td-night), and back as the sheet comes up over it
  const sheetRef = useRef(null);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const top = sheetRef.current?.getBoundingClientRect().top ?? 0;
      const bar = document.querySelector(".app-header")?.getBoundingClientRect().bottom ?? 0;
      document.documentElement.classList.toggle("td-night", visible && top > bar);
    };
    const soon = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
      document.documentElement.classList.remove("td-night");
    };
  }, [visible]);

  const tabs = tabsFor(account);
  // A soft light that follows the mouse across a card: only the position changes,
  // once a frame at most, and the browser draws the rest (index.css .td-box::after)
  const spot = useRef({ card: null, x: 0, y: 0, frame: 0 });
  const moveSpot = e => {
    if (e.pointerType !== "mouse") return;
    const s = spot.current;
    s.card = e.target.closest?.(".td-box") ?? null;
    s.x = e.clientX; s.y = e.clientY;
    s.frame ||= requestAnimationFrame(() => {
      s.frame = 0;
      if (!s.card) return;
      const r = s.card.getBoundingClientRect();
      s.card.style.setProperty("--spot-x", `${s.x - r.left}px`);
      s.card.style.setProperty("--spot-y", `${s.y - r.top}px`);
    });
  };

  const seeAll = () => document.getElementById("all-screeners")?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  return (
    <div className="td-page">
      {/* The opening, on black whichever the theme: one line, one button, and the
          visitors' page's night sky, as a still picture. Then the product, fading into the page. */}
      <div className="td-sky-watch" aria-hidden="true" />
      <section className="td-hero" aria-labelledby="td-hero-title">
        <StarField />
        <StarLetter className="td-star-j" points={LETTER_J} />
        <StarLetter className="td-star-i" points={LETTER_I} />
        <h2 id="td-hero-title">India's markets, read from the source.</h2>
        <p>Every NSE company, scored on what it files. Find the few worth your time.</p>
        <button type="button" className="td-cta" onClick={onCreate}>Start screening</button>
        <div className="td-shot">
          <img src="/screens/home-shot.jpg" alt="Jocular Insights listing companies that match a screen, with their quality scores" width="1280" height="800" />
        </div>
        <div className="td-shot-fade" aria-hidden="true" />
        <button type="button" className="td-shot-pill" onClick={seeAll}>See every screener<ChevronRight size={15} aria-hidden="true" /></button>
      </section>

      {/* Stays still as you scroll, and this comes up over it, like a tab pulled up */}
      <div ref={sheetRef} className="td-sheet" onPointerMove={moveSpot}>
    <div className="td">
      <MarketSummary visible={visible} onOpenStock={onOpenStock} onOpenTab={onOpenTab} onOpenIndex={onOpenIndex} />

      <section className="td-box td-screens" aria-label="Screeners">
        <div className="td-head">
          <h3>Screeners</h3>
          <span className="td-head-acts">
            <button type="button" onClick={seeAll}>See all{presets.length ? ` ${presets.length}` : ""}</button>
            <button type="button" onClick={onCreate}><Plus size={13} aria-hidden="true" />Create new screen</button>
          </span>
        </div>
        {presets.slice(0, QUICK_SCREENS).map(p => (
          <button key={p.id} type="button" className="td-screen" onClick={() => onPickScreen?.(p)}>
            <span className="td-screen-icon"><ScreenIcon p={p} size={18} /></span>
            <span>{p.name}<small>{p.description}</small></span>
          </button>
        ))}
      </section>

      <h3 className="td-menu-title">Everything in the app</h3>
      <nav className="td-box td-all-pages" aria-label="Everything in the app">
        {PAGE_GROUPS.map(g => (
          <div key={g.title} className="td-page-group">
            <h3>{g.title}</h3>
            {g.items.map(id => {
              const tab = tabs.find(t => t.id === id), site = SITE_PAGES.find(p => p.id === id);
              if (!tab && !site) return null; // a page this account doesn't have
              const Icon = (tab ?? site).Icon;
              return (
                <button key={id} type="button" onClick={() => (site ? navigate(site.path) : id === "discover" ? seeAll() : onOpenTab?.(id))}>
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{(tab ?? site).label}<small>{tab ? ABOUT[id] : site.about}</small></span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {continueCard}
      {newsTile && <div className="td-news">{newsTile}</div>}

      <section id="all-screeners" className="td-all" aria-labelledby="sh-popular">
        <h2 id="sh-popular" className="td-all-title">All screeners</h2>
        {children}
      </section>
    </div>
      </div>
    </div>
  );
}

// The Market summary (4 Nov 2026: shared with a phone's home, PhoneScreens.jsx):
// the Nifty 500's year, the major indices, the watchlist's biggest moves, what
// sits under its fair value, and the results coming up
export function MarketSummary({ visible = true, onOpenStock, onOpenTab, onOpenIndex }) {
  // 5 Nov 2026 ("when I click on those cards it's not working"): every card
  // opens something — an index its page in Explore, a results day the calendar
  const openIndex = name => (onOpenIndex ? onOpenIndex(name) : onOpenTab?.("explore"));
  const [strip, setStrip] = useState(null);
  const [watch, setWatch] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [market, setMarket] = useState(null);
  useEffect(() => {
    api.marketStrip().then(setStrip).catch(() => {});
    api.publicResultsCalendar().then(setCalendar).catch(() => {});
    api.prices("RELIANCE", "1y").then(d => setMarket(d?.benchmark?.closes ?? null)).catch(() => {});
  }, []);
  // again on coming back: a company may have been starred on its page
  useEffect(() => {
    if (visible) api.watchlist().then(setWatch).catch(() => setWatch({ results: [] }));
  }, [visible]);
  const rows = watch?.results ?? [];
  const mine = new Set(rows.map(r => r.symbol));
  const moved = [...rows].sort((a, b) => Math.abs(b.ret1d ?? 0) - Math.abs(a.ret1d ?? 0)).slice(0, WATCH_ROWS);
  const under = rows.filter(r => r.fv25 > 0 && r.cmp > 0 && r.cmp < r.fv25).map(r => ({ r, by: (1 - r.cmp / r.fv25) * 100 })).sort((a, b) => b.by - a.by).slice(0, 3);
  const coming = (calendar?.days ?? []).slice(0, 3).map(d => {
    const yours = (d.companies ?? []).filter(c => mine.has(c.symbol));
    return { date: d.date, yours, count: d.count };
  });
  return (
    <>
      <div className="td-top">
        <div>
          <h2 className="td-title">Market summary</h2>
          <p className="td-sub">
            {strip?.asOf ? `Prices at NSE's close on ${day(strip.asOf)}` : "The market at its last close"}
            {rows.length > 0 && ` · ${rows.length} ${rows.length === 1 ? "company" : "companies"} on your watchlist`}
          </p>
        </div>
        <HowItWorks plain label="See how it works" />
      </div>

      <div className="td-grid td-summary">
        {market?.length > 1 && (
          <section className="td-box td-big td-click" aria-label="Nifty 500" role="link" tabIndex={0} title="Open the Nifty 500"
            onClick={() => openIndex("Nifty 500")} onKeyDown={e => { if (e.key === "Enter") openIndex("Nifty 500"); }}>
            <div className="td-big-head">
              <div><h3>Nifty 500</h3><b>{num(market.at(-1)[1])}</b> <i style={{ color: tone(market.at(-1)[1] - market[0][1]) }}>{pct(((market.at(-1)[1] - market[0][1]) / market[0][1]) * 100)}</i> <small>over the year</small></div>
            </div>
            <MarketChart closes={market} />
          </section>
        )}
        {strip?.indices?.length > 0 && (
          <section className="td-box" aria-label="The market">
            <div className="td-head"><h3>Major indices</h3><button type="button" onClick={() => onOpenTab?.("explore")}>Explore</button></div>
            {strip.indices.slice(0, 6).map(m => (
              <button key={m.name} type="button" className="td-index" onClick={() => openIndex(m.name)}>
                <span className="td-name">{m.name}</span>
                <span className="td-index-nums"><b>{num(m.close)}</b><i style={{ color: tone(m.changePct) }}>{pct(m.changePct)}</i></span>
              </button>
            ))}
          </section>
        )}
      </div>

      <div className="td-grid">
        <section className="td-box" aria-label="Your watchlist">
          <div className="td-head"><h3>Your watchlist</h3>{rows.length > 0 && <button type="button" onClick={() => onOpenTab?.("watchlist")}>Open all</button>}</div>
          {watch && rows.length === 0 && (
            <p className="td-empty">Nothing here yet. Search for a company above and star it, and its moves, fair value and results dates show here each day.</p>
          )}
          {moved.map(r => (
            <button key={r.symbol} type="button" className="td-row" onClick={() => onOpenStock?.(r.symbol)}>
              <span className="td-name">{short(r.name)}<small>{r.sector ?? r.symbol}</small></span>
              <span>₹{num(r.cmp)}</span>
              <span style={{ color: tone(r.ret1d) }}>{pct(r.ret1d)}</span>
            </button>
          ))}
        </section>

        <div className="td-side">
          {under.length > 0 && (
            <section className="td-box" aria-label="Needs a look">
              <div className="td-head"><h3>Needs a look</h3></div>
              {under.map(({ r, by }) => (
                <button key={r.symbol} type="button" className="td-line" onClick={() => onOpenStock?.(r.symbol)}>
                  <span>{short(r.name)}</span><em>{by.toFixed(0)}% under fair value</em>
                </button>
              ))}
            </section>
          )}
          {coming.length > 0 && (
            <section className="td-box" aria-label="Results coming">
              <div className="td-head"><h3>Results coming</h3><button type="button" onClick={() => navigate("/results-calendar")}>Calendar</button></div>
              {coming.map(c => (
                <button key={c.date} type="button" className="td-line" onClick={() => navigate("/results-calendar")}>
                  <span className={c.yours.length ? undefined : "td-quiet"}>{c.yours.length ? c.yours.map(y => short(y.name)).join(", ") : `${c.count} ${c.count === 1 ? "company" : "companies"}`}</span>
                  <em>{day(c.date)}</em>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
