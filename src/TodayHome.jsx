import { Suspense, useEffect, useRef, useState } from "react";
import { lazyPage } from "./lazyPage.js";
// the chart library loads with the chart, not with the app (22 Nov 2026: it
// was ~185 KB of the first download for one small chart)
const MarketChart = lazyPage(() => import("./MarketChart.jsx"));
import BigOrders from "./BigOrders.jsx";
import HomeGold from "./HomeGold.jsx";
import { usePhone } from "./phoneTabs.js";
import { tick } from "./haptics.js";
import BigNum from "./BigNum.jsx";
import { ChevronRight, Plus } from "lucide-react";
import { api } from "./api.js";
import { cardName } from "./stockName.js";
import HowItWorks from "./HowItWorks.jsx";
import { ScreenIcon } from "./PhoneScreens.jsx";
import { navigate } from "./site.jsx";
import { tabsFor } from "./Header.jsx";
import { CalendarDays, Layers3, BookOpen, FileBarChart, BarChart3, Award, ShieldCheck, Coins, Building2, Sprout, Shield, TrendingUp } from "lucide-react";

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

// Every part of the app from one place (1 Nov 2026, the owner: "every option in
// this page"), by name, with what it's for. The bar's own list, so a new page or
// one kept to some accounts turns up here by itself.
const ABOUT = {
  discover: "All the ready-made screens", workspace: "Build your own filter", desk: "A list with its charts beside it",
  markets: "Indices, sectors and the big moves", gold: "Gold by carat, gold bonds and ETFs", explore: "Indices and news", map: "The market, by size and move", momentum: "Short-term moves", watchlist: "Companies you follow",
  portfolio: "What you hold", performance: "How screens have done", alerts: "Your price and results alerts",
};
const SITE_PAGES = [
  { id: "calendar", path: "/results-calendar", label: "Results calendar", about: "Who reports, and when", Icon: CalendarDays },
  { id: "results", path: "/results", label: "Latest results", about: "Who just reported, and how", Icon: FileBarChart },
  { id: "sectors", path: "/sectors", label: "Sectors", about: "Companies by sector", Icon: Layers3 },
  { id: "lists", path: "/lists", label: "Categories", about: "Nifty 50, defence, under ₹100…", Icon: Layers3 },
  { id: "guides", path: "/learn", label: "Guides", about: "How to read the numbers", Icon: BookOpen },
];

// A results day in the app's Markets, not the website's calendar page (11 Nov
// 2026: "from the home screen when I press calendar, where am I going" — it
// left the app for the public page). date: a day, "next" or "latest".
export function openResults(onOpenTab, date = "next") {
  if (!onOpenTab) { navigate(date === "latest" ? "/results" : "/results-calendar"); return; }
  window.history.pushState({ ...(window.history.state ?? {}), resultsDay: date }, "");
  onOpenTab("markets");
}
const IN_APP = { calendar: "next", results: "latest" };

const PAGE_GROUPS = [
  { title: "Find companies", items: ["discover", "workspace", "desk", "guides"] },
  { title: "The market", items: ["markets", "gold", "explore", "map", "momentum", "calendar", "results", "sectors"] },
  { title: "Your things", items: ["watchlist", "portfolio", "performance", "alerts"] },
];

// good morning / afternoon / evening, by the hour in India
function greeting() {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function TodayHome({ visible = true, onOpenStock, onOpenTab, onOpenIndex, onPickScreen, onCreate, account = null, continueCard = null, newsTile = null, children }) {
  const [presets, setPresets] = useState([]);
  useEffect(() => { api.presets().then(p => setPresets(p ?? [])).catch(() => {}); }, []);

  // (the header no longer goes black with a sky: the banner is gone, 21 Nov 2026)
  const sheetRef = useRef(null);
  useEffect(() => { document.documentElement.classList.remove("td-night"); }, []);

  const tabs = tabsFor(account);
  // Every screener, at the foot of Home only when asked for (21 Nov 2026, the
  // owner: "why do we need the screeners here?"): See every screener / See all
  // open it and go to it
  const [allOpen, setAllOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const seeAll = () => {
    setAllOpen(true);
    requestAnimationFrame(() => document.getElementById("all-screeners")?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  };

  return (
    <div className="td-page td-flat">
      {/* A greeting, not the visitors' pitch (21 Nov 2026, the Home review: the
          starry banner filled a signed-in person's first screen; the market
          now comes first). The banner and its picture are gone. */}
      <header className="td-hello">
        <div>
          <h2 id="td-hero-title">{greeting()}{account?.name ? `, ${account.name.split(" ")[0]}` : ""}</h2>
          {summary && (
            <p className="td-hello-line">
              Nifty 50 <b className={summary.nifty >= 0 ? "up" : "down"}>{summary.nifty >= 0 ? "▲" : "▼"}{Math.abs(summary.nifty).toFixed(2)}%</b> at the {day(summary.asOf)} close
              {summary.reporting > 0 && <> · {summary.reporting} of your companies report results this week</>}
            </p>
          )}
        </div>
        <span className="td-hello-acts">
          <button type="button" className="td-cta" onClick={onCreate}>Start screening</button>
          <button type="button" className="td-hello-link" onClick={seeAll}>See every screener<ChevronRight size={15} aria-hidden="true" /></button>
        </span>
      </header>

      {/* Stays still as you scroll, and this comes up over it, like a tab pulled up */}
      <div ref={sheetRef} className="td-sheet">
    <div className="td">
      <MarketSummary visible={visible} onOpenStock={onOpenStock} onOpenTab={onOpenTab} onOpenIndex={onOpenIndex} onSummary={setSummary} />

      {continueCard}
      {newsTile && <div className="td-news">{newsTile}</div>}
      <HomeCategories />

      {/* below the news (21 Nov 2026, the owner: "move what's new today up, everything in the app down") */}
      {/* every page, one row of links (21 Nov 2026, the Home review: the big
          three-column box repeated the top bar) */}
      <nav className="td-links" aria-label="Everything in the app">
        {PAGE_GROUPS.flatMap(g => g.items).map(id => {
          const tab = tabs.find(t => t.id === id), site = SITE_PAGES.find(p => p.id === id);
          if (!tab && !site) return null; // a page this account doesn't have
          if (id === "discover") return null; // Home itself
          const Icon = (tab ?? site).Icon;
          return (
            <button key={id} type="button" title={tab ? ABOUT[id] : site.about} onClick={() => (IN_APP[id] && onOpenTab ? openResults(onOpenTab, IN_APP[id]) : site ? navigate(site.path) : onOpenTab?.(id))}>
              <Icon size={15} strokeWidth={1.9} aria-hidden="true" />{(tab ?? site).label}
            </button>
          );
        })}
      </nav>

      {/* last on the page, the full list opening under it (21 Nov 2026, the owner) */}
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

      {allOpen && (
        <section id="all-screeners" className="td-all" aria-labelledby="sh-popular">
          <h2 id="sh-popular" className="td-all-title">All screeners</h2>
          {children}
        </section>
      )}
    </div>
      </div>
    </div>
  );
}

// The Market summary (4 Nov 2026: shared with a phone's home, PhoneScreens.jsx):
// the Nifty 50's year, the major indices, the watchlist's biggest moves, what
// sits under its fair value, and the results coming up
// The stock lists on Home (17 Nov 2026; redrawn the same day — "not looking
// good": a pile of pills): eight tiles, each with its icon, name and how many
// companies it holds today (from /api/public/lists)
const HOME_LISTS = [
  ["nifty-50-stocks", "Nifty 50", BarChart3], ["highest-rated-stocks", "Highest scores", Award],
  ["debt-free-stocks", "Debt-free", ShieldCheck], ["high-dividend-yield-stocks", "High dividend", Coins],
  ["large-cap-stocks", "Large caps", Building2], ["small-cap-stocks", "Small caps", Sprout],
  ["defence-stocks", "Defence", Shield], ["52-week-high-stocks", "52-week highs", TrendingUp],
];
// The day's movers in one card with tabs (19 Nov 2026, the owner: "top mover
// should have losers and other options there: most active, 52 week high, low
// and so on"). Companies worth ₹1,000 crore or more (server/explore.js).
const MOVER_TABS = [
  ["gainers", "Gainers", r => <span style={{ color: tone(r.change) }}>{pct(r.change)}</span>],
  ["losers", "Losers", r => <span style={{ color: tone(r.change) }}>{pct(r.change)}</span>],
  ["active", "Most active", r => <span className="td-mv-note">₹{Math.round(r.valueCr).toLocaleString("en-IN")} cr traded</span>],
  ["highs", "52-week high", r => <span className="td-mv-note">{r.offPct > 0 ? `${r.offPct.toFixed(1)}% below` : "At its high"}</span>],
  ["lows", "52-week low", r => <span className="td-mv-note">{r.offPct > 0 ? `${r.offPct.toFixed(1)}% above` : "At its low"}</span>],
  ["surge", "Volume surge", r => <span className="td-mv-note">{r.volX.toFixed(1)}× usual</span>],
];
const MOVER_NOTE = {
  active: "The most shares traded by value on the day.",
  highs: "Closed at, or within 2% of, the highest price of the last 52 weeks.",
  lows: "Closed at, or within 2% of, the lowest price of the last 52 weeks.",
  surge: "Traded at least twice its usual daily volume (the last month's average), on ₹1 crore or more.",
};
function HomeMovers({ movers, onOpenStock, onOpenTab, bare = false }) {
  const tabs = MOVER_TABS.filter(([id]) => movers[id]?.length);
  const [tab, setTab] = useState("gainers");
  const current = tabs.find(([id]) => id === tab) ?? tabs[0];
  if (!current) return null;
  const [id, , right] = current;
  return (
    <section className={bare ? "td-mv td-mv-bare" : "td-box td-mv"} aria-label="Top movers today">
      {!bare && <div className="td-head"><h3>Top movers today</h3><button type="button" onClick={() => onOpenTab?.("markets")}>Markets</button></div>}
      <div className="td-mv-tabs" role="tablist" aria-label="Which movers">
        {tabs.map(([t, label]) => <button key={t} type="button" role="tab" aria-selected={t === id} onClick={e => { setTab(t); e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }); }}>{label}</button>)}
      </div>
      <div role="tabpanel" aria-label={current[1]}>
        {movers[id].slice(0, 6).map(r => (
          <button key={r.symbol} type="button" className="td-row" onClick={() => onOpenStock?.(r.symbol)}>
            <span className="td-name">{short(r.name)}<small>{r.sector ?? r.symbol}</small></span>
            <span>₹{num(r.close)}</span>
            {right(r)}
          </button>
        ))}
      </div>
      {MOVER_NOTE[id] && <p className="td-mv-foot">{MOVER_NOTE[id]}</p>}
    </section>
  );
}

// A computer's Top movers and Big orders, one card with two tabs; the one last
// looked at opens next time
function HomeMoves({ movers, onOpenStock, onOpenTab }) {
  const [tab, setTab] = useState(() => { try { return localStorage.getItem("home-moves") === "orders" ? "orders" : "movers"; } catch { return "movers"; } });
  const [orders, setOrders] = useState(null);
  const pick = t => { setTab(t); try { localStorage.setItem("home-moves", t); } catch { /* private window */ } };
  const show = !movers ? "orders" : tab;
  const allOrders = () => { try { sessionStorage.setItem("open-orders", "1"); } catch { /* private window */ } onOpenTab?.("markets"); };
  return (
    <section className="td-box td-moves" aria-label="Today's moves and big orders">
      <div className="td-head">
        <div className="td-moves-tabs" role="tablist" aria-label="Show">
          {movers && <button type="button" role="tab" aria-selected={show === "movers"} onClick={() => pick("movers")}>Top movers today</button>}
          <button type="button" role="tab" aria-selected={show === "orders"} onClick={() => pick("orders")}>Big orders{orders ? ` · ${orders}` : ""}</button>
        </div>
        {show === "movers" && <button type="button" onClick={() => onOpenTab?.("markets")}>Markets</button>}
      </div>
      <div role="tabpanel">
        {show === "movers"
          ? <HomeMovers bare movers={movers} onOpenStock={onOpenStock} onOpenTab={onOpenTab} />
          : <BigOrders bare home onOpenStock={onOpenStock} onSeeAll={allOrders} onCount={setOrders} />}
      </div>
    </section>
  );
}

// The phone's Home: the moves, the indices, the big orders and the
// categories as cards that swipe sideways, as the Favourites do (20 Nov 2026,
// the owner: "this kind of swipe cards"; a computer keeps its cards side by
// side). Top movers first; the card last looked at opens next time.
const HOME_TABS = [["movers", "Top movers"], ["indices", "Indices"], ["orders", "Big orders"], ["lists", "Categories"]];
function HomeTabs({ strip, movers, listCounts, openIndex, onOpenStock, onOpenTab }) {
  const [at, setAt] = useState(() => { try { const i = HOME_TABS.findIndex(([id]) => id === localStorage.getItem("home-tab")); return i < 0 ? 0 : i; } catch { return 0; } });
  const [orders, setOrders] = useState(null);
  const rail = useRef(null), dots = useRef(null);
  // a card's width and the gap (offsetWidth: the scaling below doesn't change it)
  const step = () => (rail.current?.firstElementChild?.offsetWidth ?? 0) + 12;
  const still = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Drawn with the finger, every frame (20 Nov 2026, "improve the card
  // motion"): the cards either side smaller and dimmer, coming up to full as
  // they reach the middle; the rail as tall as the card in view, between two
  // as it moves (no empty space under a short card); the dot stretching
  // toward the next. Straight onto the page, not through React, so it keeps up.
  const paint = () => {
    const r = rail.current, st = step();
    if (!r || !st) return;
    const cards = [...r.children], pos = Math.max(0, Math.min(cards.length - 1, r.scrollLeft / st));
    const i0 = Math.floor(pos), i1 = Math.min(i0 + 1, cards.length - 1);
    // the height doesn't change under the finger (20 Nov 2026, the owner:
    // the cards "jump or skip" — a phone re-snaps a rail whose size changes
    // mid-swipe): while moving it only grows to fit the two cards in view,
    // and settles to the one in view once the swipe ends (settle below)
    const need = Math.max(cards[i0].offsetHeight, cards[i1].offsetHeight) + 6;
    if (!r.style.height || need > parseFloat(r.style.height)) r.style.height = `${need}px`;
    const calm = still();
    cards.forEach((c, i) => {
      const d = Math.min(1, Math.abs(i - pos));
      c.style.transform = calm ? "" : `scale(${(1 - 0.05 * d).toFixed(4)})`;
      c.style.opacity = calm ? "" : (1 - 0.35 * d).toFixed(3);
    });
    [...(dots.current?.children ?? [])].forEach((dot, i) => { dot.style.width = `${6 + 10 * Math.max(0, 1 - Math.abs(i - pos))}px`; });
  };
  const frame = useRef(0), settleTimer = useRef(0);
  // the swipe over: the rail to the height of the card in view, smoothly
  const settle = () => {
    const r = rail.current, st = step();
    if (!r || !st) return;
    const card = r.children[Math.round(r.scrollLeft / st)];
    if (card) r.style.height = `${card.offsetHeight + 6}px`;
  };
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, 160);
    const i = Math.max(0, Math.min(HOME_TABS.length - 1, Math.round((rail.current?.scrollLeft ?? 0) / (step() || 1))));
    if (i !== at) { setAt(i); tick(); try { localStorage.setItem("home-tab", HOME_TABS[i][0]); } catch { /* private window */ } }
  };
  // back to the card last looked at, without a slide; drawn again when a
  // card's contents change height (the moves arriving, another list picked)
  useEffect(() => {
    const r = rail.current;
    if (!r) return undefined;
    if (at) r.scrollLeft = at * step();
    paint(); settle();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { paint(); settle(); }) : null;
    [...r.children].forEach(c => ro?.observe(c));
    return () => { ro?.disconnect(); cancelAnimationFrame(frame.current); clearTimeout(settleTimer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the first time, the cards lean left and back once, to show they swipe
  useEffect(() => {
    let seen = true;
    try { seen = localStorage.getItem("home-cards-hinted") === "1"; } catch { /* private window: no hint */ }
    if (seen || at || still()) return undefined;
    const t = setTimeout(() => {
      const r = rail.current;
      if (!r || r.scrollLeft > 4) return;
      [...r.children].forEach(c => c.animate?.([{ translate: "0 0" }, { translate: "-44px 0" }, { translate: "0 0" }], { duration: 900, easing: "cubic-bezier(0.3, 0, 0.2, 1)" }));
      try { localStorage.setItem("home-cards-hinted", "1"); } catch { /* private window */ }
    }, 1200);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const go = i => rail.current?.scrollTo({ left: i * step(), behavior: "smooth" });
  const card = (id, title, more, body, right = null) => (
    <section key={id} className="hc" aria-label={title}>
      <div className="hc-head"><h3>{title}</h3>{right}</div>
      <div className="hc-body">{body}</div>
      {more && <button type="button" className="hc-more" onClick={more[1]}>{more[0]}<ChevronRight size={14} aria-hidden="true" /></button>}
    </section>
  );
  // Big orders day by day on Markets (21 Nov 2026: the card's "All" opened
  // Markets' start, not the orders)
  const openOrdersDay = () => { try { sessionStorage.setItem("open-orders", "1"); } catch { /* private window */ } onOpenTab?.("markets"); };
  return (
    <div className="hc-wrap">
      <div className="ps-favs hc-rail" ref={rail} onScroll={onScroll} role="group" aria-label="The market today: swipe for more">
        {card("movers", "Top movers today", ["Every rise and fall in Markets", () => onOpenTab?.("markets")],
          movers ? <HomeMovers bare movers={movers} onOpenStock={onOpenStock} onOpenTab={onOpenTab} /> : <p className="td-empty">Reading the day's moves…</p>)}
        {card("indices", "Indices", ["Every index", () => onOpenTab?.("explore")], <>
          {(strip?.indices ?? []).slice(0, 7).map(m => (
            <button key={m.name} type="button" className="td-index" onClick={() => openIndex(m.name)}>
              <span className="td-name">{m.name}</span>
              <span className="td-index-nums"><b>{num(m.close)}</b><i style={{ color: tone(m.changePct) }}>{pct(m.changePct)}</i></span>
            </button>
          ))}
          {!strip?.indices?.length && <p className="td-empty">Reading the indices…</p>}
        </>)}
        {card("orders", "Big orders", null, <BigOrders bare home onOpenStock={onOpenStock} onSeeAll={openOrdersDay} onCount={setOrders} />,
          orders ? <button type="button" className="hc-link" onClick={openOrdersDay}>All {orders}</button> : null)}
        {card("lists", "Explore by category", ["All categories", () => navigate("/lists")],
          <div className="td-listgrid">
            {HOME_LISTS.map(([slug, label, Icon]) => (
              <button key={slug} type="button" className="td-listtile" onClick={() => navigate(`/lists/${slug}`)}>
                <span className="td-listicon" aria-hidden="true"><Icon size={18} strokeWidth={1.8} /></span>
                <span className="td-listtext"><b>{label}</b>{listCounts[slug] != null && <small>{listCounts[slug].toLocaleString("en-IN")} companies</small>}</span>
                <ChevronRight size={16} className="td-listgo" aria-hidden="true" />
              </button>
            ))}
          </div>)}
      </div>
      <div className="ps-dots hc-dots" role="tablist" aria-label="Cards" ref={dots}>
        {HOME_TABS.map(([id, label], i) => <button key={id} type="button" role="tab" aria-selected={i === at} aria-label={label} className={i === at ? "on" : ""} onClick={() => go(i)} />)}
      </div>
    </div>
  );
}

// A computer's categories (17 Nov 2026: "very hard to find, very deep in
// Markets"), under What's new today (21 Nov 2026, the owner: "move this
// explore by category below the what's new")
function HomeCategories() {
  const [listCounts, setListCounts] = useState({});
  useEffect(() => {
    api.publicLists().then(d => setListCounts(Object.fromEntries((d?.groups ?? []).flatMap(g => g.lists ?? []).map(l => [l.slug, l.count])))).catch(() => {});
  }, []);
  return (
    <section className="td-box td-lists" aria-label="Explore by category">
      <div className="td-head"><h3>Explore by category</h3><button type="button" onClick={() => navigate("/lists")}>All categories</button></div>
      <div className="td-listgrid">
        {HOME_LISTS.map(([slug, label, Icon]) => (
          <button key={slug} type="button" className="td-listtile" onClick={() => navigate(`/lists/${slug}`)}>
            <span className="td-listicon" aria-hidden="true"><Icon size={18} strokeWidth={1.8} /></span>
            <span className="td-listtext"><b>{label}</b>{listCounts[slug] != null && <small>{listCounts[slug].toLocaleString("en-IN")} companies</small>}</span>
            <ChevronRight size={16} className="td-listgo" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

export function MarketSummary({ visible = true, onOpenStock, onOpenTab, onOpenIndex, onSummary = null }) {
  // the card of tabs on a phone; a computer keeps its cards side by side
  const phone = usePhone();
  // 5 Nov 2026 ("when I click on those cards it's not working"): every card
  // opens something — an index its page in Explore, a results day the calendar
  const openIndex = name => (onOpenIndex ? onOpenIndex(name) : onOpenTab?.("explore"));
  const [strip, setStrip] = useState(null);
  const [watch, setWatch] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [market, setMarket] = useState(null);
  // the day's biggest moves (17 Nov 2026, the owner: "the top mover list in the home")
  const [movers, setMovers] = useState(null);
  const [listCounts, setListCounts] = useState({});
  useEffect(() => {
    api.publicLists().then(d => setListCounts(Object.fromEntries((d?.groups ?? []).flatMap(g => g.lists ?? []).map(l => [l.slug, l.count])))).catch(() => {});
    api.marketStrip().then(setStrip).catch(() => {});
    api.movers("1d").then(setMovers).catch(() => {});
    api.publicResultsCalendar().then(setCalendar).catch(() => {});
    // the Nifty 50's year (8 Nov 2026: "I want Nifty 50 here, not 500, it makes it confusing")
    api.exploreIndex("Nifty 50").then(d => setMarket(d?.days?.length ? d.days.map((day, k) => [day, d.closes[k]]).filter(([, c]) => c != null) : null)).catch(() => {});
  }, []);
  // again on coming back: a company may have been starred on its page
  useEffect(() => {
    if (visible) api.watchlist().then(setWatch).catch(() => setWatch({ results: [] }));
  }, [visible]);
  const rows = watch?.results ?? [];
  const mine = new Set(rows.map(r => r.symbol));
  const moved = [...rows].sort((a, b) => Math.abs(b.ret1d ?? 0) - Math.abs(a.ret1d ?? 0)).slice(0, WATCH_ROWS);
  const under = rows.filter(r => r.fv25 > 0 && r.cmp > 0 && r.cmp < r.fv25).map(r => ({ r, by: (1 - r.cmp / r.fv25) * 100 })).sort((a, b) => b.by - a.by).slice(0, 3);
  // each day's names (5 Nov 2026, "show some stocks' names"): yours first, then
  // the biggest reporting, three at most, and how many more
  const coming = (calendar?.days ?? []).slice(0, 3).map(d => {
    const all = d.companies ?? [];
    const yours = all.filter(c => mine.has(c.symbol));
    const names = [...yours, ...all.filter(c => !mine.has(c.symbol))].slice(0, 3);
    return { date: d.date, yours, names, more: Math.max(0, (d.count ?? all.length) - names.length) };
  });
  // one line for the greeting above (21 Nov 2026, the Home review): the Nifty's
  // day and how many of your companies report in the next week
  const nifty = strip?.indices?.find(m => /^nifty 50$/i.test(m.name));
  const weekEnd = strip?.asOf ? new Date(Date.parse(`${strip.asOf}T00:00:00Z`) + 8 * 864e5).toISOString().slice(0, 10) : null;
  const reporting = weekEnd ? new Set((calendar?.days ?? []).filter(d => d.date <= weekEnd).flatMap(d => (d.companies ?? []).filter(c => mine.has(c.symbol)).map(c => c.symbol))).size : 0;
  const summary = nifty ? { nifty: nifty.changePct, asOf: strip.asOf, reporting } : null;
  useEffect(() => { onSummary?.(summary); }, [summary?.nifty, summary?.asOf, summary?.reporting]); // eslint-disable-line react-hooks/exhaustive-deps
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
          <section className="td-box td-big td-click" aria-label="Nifty 50" role="link" tabIndex={0} title="Open the Nifty 50"
            onClick={() => openIndex("Nifty 50")} onKeyDown={e => { if (e.key === "Enter") openIndex("Nifty 50"); }}>
            <div className="td-big-head">
              <div><h3>Nifty 50</h3><b><BigNum text={num(market.at(-1)[1])} /></b> <i style={{ color: tone(market.at(-1)[1] - market[0][1]) }}>{pct(((market.at(-1)[1] - market[0][1]) / market[0][1]) * 100)}</i> <small>over the year</small></div>
            </div>
            <Suspense fallback={<div className="td-chart" aria-hidden="true" />}><MarketChart closes={market} /></Suspense>
          </section>
        )}
        {/* indices, movers, big orders and categories as one card of tabs (20 Nov 2026, the owner: "like tabs, to save space") */}
        {phone
          ? <HomeTabs strip={strip} movers={movers} listCounts={listCounts} openIndex={openIndex} onOpenStock={onOpenStock} onOpenTab={onOpenTab} />
          : <>
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
          </>}
      </div>

      {/* gold, under the market (20 Nov 2026, the owner: "gold price to the Home screen") */}
      <HomeGold onOpen={() => onOpenTab?.("gold")} />

      {/* no companies starred yet: the day's moves come first, not an empty box */}
      {!phone && watch && rows.length === 0 && <HomeMoves movers={movers} onOpenStock={onOpenStock} onOpenTab={onOpenTab} />}
      {/* yours first, right under the market (21 Nov 2026, the owner's go-ahead on the Home review) */}
      <div className="td-grid">
        {(phone || !watch || rows.length > 0) && <section className="td-box" aria-label="Your watchlist">
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
        </section>}

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
              <div className="td-head"><h3>Results coming</h3><button type="button" onClick={() => openResults(onOpenTab)}>Calendar</button></div>
              {coming.map(c => (
                <button key={c.date} type="button" className="td-line" onClick={() => openResults(onOpenTab, c.date)}>
                  <span className="td-coming">
                    <span className="td-coming-names">{c.names.map((y, i) => <span key={y.symbol}>{i > 0 && ", "}<b className={mine.has(y.symbol) ? "td-yours" : undefined}>{cardName(y.name)}</b></span>)}</span>
                    {c.more > 0 && <small>+{c.more}</small>}
                  </span>
                  <em>{day(c.date)}</em>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>


      {!(!phone && watch && rows.length === 0) && <>
      {/* a computer: the day's moves and the big orders as one card of two tabs
          (21 Nov 2026, the Home review: a screen less to scroll) */}
      {!phone && <HomeMoves movers={movers} onOpenStock={onOpenStock} onOpenTab={onOpenTab} />}
      </>}
    </>
  );
}
