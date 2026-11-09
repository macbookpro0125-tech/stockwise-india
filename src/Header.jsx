import { useEffect, useId, useRef, useState } from "react";
import { Star, BriefcaseBusiness, ChartLine, Bell, Sun, Moon, Zap, Settings, Telescope, Users, SlidersHorizontal, Monitor, ChartNoAxesCombined } from "lucide-react";
import { useWatchlist } from "./watchlist.js";
import { portfolioStore, alertsStore } from "./stores.js";
import StockSearchBar from "./StockSearchBar.jsx";
import { BrandMark } from "./site.jsx";
import { tick } from "./haptics.js";
import { scrollStep } from "./tabBarScroll.js";
import AccountMenu from "./AccountMenu.jsx";
import { useWatchNewsDot } from "./watchNews.js";
import { usePhone } from "./phoneTabs.js";
import { MenuButton, PlusButton } from "./PhoneChrome.jsx";
import { createLens, EDGE } from "./liquidLens.js";
import TopBar from "./TopBar.jsx";

// The original's sticky header (stock-screener src/Discovery.jsx): logo,
// search, theme switch and account in one row, then the tabs with counts. On
// phones the tabs move to a floating bar at the bottom (BottomTabBar), the
// header is the logo and the search and scrolls away, and the theme and
// account move to the Settings tab (asked for 17 Oct 2026: the app on a phone
// as clean as a native one).

// Discover's mark: four rounded squares, filled while it's the tab you're on
// (asked for 26 Oct 2026, from a screenshot); on a computer's tab row, outlined
export function GridIcon({ size = 24, strokeWidth = 2, filled = false, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" {...rest}>
      {[[3, 3], [13, 3], [3, 13], [13, 13]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="8" height="8" rx="2.4" fill={filled ? "currentColor" : "none"} />)}
    </svg>
  );
}

// The market map's mark: uneven blocks, as the map's own boxes are
export function MapIcon({ size = 20, strokeWidth = 2, filled = false, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" {...rest}>
      {[[3, 3, 10, 18], [15, 3, 6, 8], [15, 13, 6, 3], [15, 18, 6, 3]].map(([x, y, w, h]) => <rect key={`${x}${y}`} x={x} y={y} width={w} height={h} rx="2" fill={filled ? "currentColor" : "none"} />)}
    </svg>
  );
}

export const TABS = [
  // A computer splits Discover in two (31 Oct 2026): Screeners, the ready-made
  // screens to pick from, and Workspace, where a screen is built and studied
  // (DiscoverView's two steps). A phone keeps the one Discover tab.
  { id: "discover", label: "Discover", wide: "Home", short: "Discover", Icon: GridIcon },
  { id: "workspace", label: "Screen builder", short: "Builder", Icon: SlidersHorizontal, wideOnly: true },
  // A list walked with its chart and company beside it (DeskView.jsx, 31 Oct 2026)
  { id: "desk", label: "Desk", short: "Desk", Icon: Monitor, wideOnly: true },
  // The market in detail: indices, sectors, moves, results (MarketsView.jsx, 5 Nov 2026)
  { id: "markets", label: "Markets", short: "Markets", Icon: ChartNoAxesCombined },
  // The indices and the news (ExploreView.jsx, 23 Oct 2026)
  { id: "explore", label: "Explore", short: "Explore", Icon: Telescope },
  // The market map, a page of its own (MarketMapView.jsx, 31 Oct 2026); a
  // phone reaches it from Explore and Settings, its bar keeping four tabs
  { id: "map", label: "Market map", short: "Map", Icon: MapIcon },
  // Short-term and speculative, so only for accounts the server allows
  // (http-server.js momentumAllowed) — /api/auth/me says which
  { id: "momentum", label: "Momentum", short: "Momentum", Icon: Zap, gated: "momentum" },
  { id: "watchlist", label: "Watchlist", short: "Watchlist", Icon: Star },
  { id: "portfolio", label: "Portfolio", short: "Portfolio", Icon: BriefcaseBusiness },
  { id: "performance", label: "Performance", short: "Perf", Icon: ChartLine },
  { id: "alerts", label: "Alerts", short: "Alerts", Icon: Bell },
  // The owner's visitor numbers (VisitorsView.jsx): only accounts in OWNER_EMAILS
  { id: "visitors", label: "Visitors", short: "Visitors", Icon: Users, gated: "owner" },
  // A phone's bar: Settings holds the account, the theme, Performance and
  // Momentum, so the bar keeps five tabs
  { id: "settings", label: "Settings", short: "Settings", Icon: Settings, phone: true },
];
// Explore took Alerts' place (23 Oct 2026); Alerts is in Settings, which
// moved off the bar into the top bar's menu (26 Oct 2026, PhoneChrome.jsx) —
// its button shows the dot when an alert's price is reached
const PHONE_TABS = ["discover", "watchlist", "explore", "portfolio"];

const HEADER_BG = { light: "rgba(255,255,255,0.82)", dark: "rgba(7,7,14,0.85)" };

export const tabsFor = (account, phone = false) => TABS
  .filter(t => !t.phone && !(phone && t.wideOnly) && (!t.gated || account?.features?.[t.gated]))
  .map(t => (!phone && t.wide ? { ...t, label: t.wide } : t));
const phoneTabs = PHONE_TABS.map(id => TABS.find(t => t.id === id));

// Counts and badges for the tabs, shared by the header and the bottom bar
export function useTabBadges() {
  const watchCount = useWatchlist().size;
  const watchNews = useWatchNewsDot();
  const portfolio = portfolioStore.use();
  const alerts = alertsStore.use();
  const triggered = (alerts ?? []).filter(a => a.enabled && a.triggered).length;
  return {
    watchlist: { count: watchCount, news: watchNews },
    portfolio: { count: portfolio?.holdings.length ?? 0 },
    alerts: {
      badge: triggered > 0 ? triggered : alerts?.length ? alerts.length : null,
      badgeColor: triggered > 0 ? "var(--yellow)" : "var(--accent)",
    },
  };
}

export default function Header({ tab, onTab, account, onLogout, onDeleted, onSearch, theme, onToggleTheme, onTour, onOpenIndex }) {
  const badges = useTabBadges();
  const phone = usePhone();
  // Discover's start page has a one-row header — no tab row (asked for 20 Oct
  // 2026: "not important there"); its stock lists have the row, as every
  // other page does (asked the same day). Discover says which of its two it's
  // showing (html[data-discover-step], DiscoverView.jsx) and index.css hides
  // the row on the start page.
  const onDiscover = tab === "discover" || tab === "workspace";

  // --header-h: how much of the top the pinned header covers, so bars pinned
  // below it (the stock page's action bar) sit under it at any width — 0 on
  // phones, where the header scrolls away.
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const measure = () => {
      const pinned = getComputedStyle(el).position === "sticky";
      document.documentElement.style.setProperty("--header-h", `${pinned ? el.getBoundingClientRect().height : 0}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  // a computer: the floating top bar with the pages in it (TopBar.jsx, 5 Nov 2026)
  if (!phone) return (
    <div ref={ref} className="app-header tb-host discovery-header-sticky" style={{ position: "sticky", top: 0, zIndex: 100 }}>
      <TopBar tab={tab} onTab={onTab} account={account} onLogout={onLogout} onDeleted={onDeleted} onSearch={onSearch}
        theme={theme} onToggleTheme={onToggleTheme} onTour={onTour} onOpenIndex={onOpenIndex} />
    </div>
  );
  return (
    <div ref={ref} className="app-header discovery-header-sticky" style={{ position: "sticky", top: 0, zIndex: 100, background: HEADER_BG[theme] ?? HEADER_BG.dark, borderBottom: "1px solid var(--bdr2)" }}>
      <div style={{ padding: "0 var(--page-x)" }}>
        {/* One row: logo, search, theme and account. The search sits beside
            the name rather than in a bar of its own, and the count chips
            (presets, filters, stocks) are gone. On a phone the search takes
            its own row under the name (index.css .app-header-row). */}
        <div className="app-header-row" style={{ display: "flex", alignItems: "center", gap: 20, padding: "10px 0" }}>
          {/* A phone (26 Oct 2026, after Reddit's app): the menu — Settings —
              on the left, the search with the app's mark in it, + on the right */}
          {phone && <MenuButton dot={badges.alerts.badgeColor === "var(--yellow)"} />}
          {!phone && <a href="/" aria-label="Jocular Insights home" onClick={e => { e.preventDefault(); onTab("discover"); }} style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, cursor: "pointer", color: "inherit", textDecoration: "none" }}>
            <BrandMark size={null} className="hdr-mark" />
            <div className="hide-phone" style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 16, fontWeight: 500, margin: 0, color: "var(--t1)", letterSpacing: "-0.03em", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                Jocular <span style={{ color: "var(--brand-wise)", fontWeight: 400 }}>Insights</span>
              </h1>
              <p className="hide-phone" style={{ fontSize: 11, color: "var(--t3)", margin: 0, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>Indian stock market research</p>
            </div>
          </a>}

          <div data-tour="search" className="app-header-search" style={{ flex: "1 1 auto", maxWidth: 560, minWidth: 0 }}>
            <StockSearchBar onAnalyze={onSearch} placeholder="Search stocks" lead={phone ? <BrandMark size={null} className="ssb-mark" /> : null} />
          </div>
          {phone && <PlusButton />}

          <div className="hide-phone" style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginLeft: "auto" }}>
            {phone && <button onClick={onToggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{ width: 32, height: 32, borderRadius: 8, background: "var(--s2)", border: "1px solid var(--bdr)", color: "var(--t2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}>
              {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
            </button>}
            <AccountMenu account={account} onLogout={onLogout} onDeleted={onDeleted} onTour={onTour} />
          </div>
        </div>

        {/* a computer's pages are in the bar down the left (SideRail.jsx, 26 Oct 2026) */}
        {phone && <div className={`discovery-tabs${onDiscover ? " tabs-on-discover" : ""}`} data-tour="tabs" style={{ display: "flex", gap: 0 }}>
          {tabsFor(account, true).map(t => {
            const b = badges[t.id] ?? {};
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => onTab(t.id)} style={{
                padding: "8px 16px", fontSize: 14, fontWeight: active ? 600 : 500, background: "none", border: "none",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                color: active ? "var(--t1)" : "var(--t2)", cursor: "pointer", marginBottom: -1,
                transition: "color 150ms, border-color 150ms", letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
              }}>
                <t.Icon size={15} strokeWidth={2} style={{ color: active ? "var(--accent)" : "var(--t3)" }} />
                {t.label}
                {b.news && <><span className="tab-news-dot" aria-hidden="true" /><span className="sr-only">, new from your companies</span></>}
                {b.count > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 500, lineHeight: "15px", padding: "0 6px", borderRadius: 999, background: "var(--s3)", border: "1px solid var(--bdr2)", color: active ? "var(--t1)" : "var(--t2)", fontVariantNumeric: "tabular-nums" }}>{b.count}</span>
                )}
                {b.badge != null && (
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "1px 5px", borderRadius: 999, lineHeight: "14px", background: b.badgeColor, color: "var(--on-accent)" }}>{b.badge}</span>
                )}
              </button>
            );
          })}
        </div>}
      </div>
    </div>
  );
}

// The phone bar's icons, drawn as iOS's tab bar draws its symbols (9 Nov
// 2026): a thin outline, filled when the tab is open — lucide's shapes
const STAR_D = "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";
function TabGlyph({ id, filled }) {
  // (React's ids have colons, which a url(#…) reference can trip on)
  const cut = `btb-cut${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const p = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
  const f = filled ? "currentColor" : "none";
  if (id === "discover") return <svg {...p}>{[[3, 3], [13, 3], [3, 13], [13, 13]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="8" height="8" rx="2.4" fill={f} />)}</svg>;
  if (id === "watchlist") return <svg {...p}><path fill={f} d={STAR_D} /></svg>;
  if (id === "explore") return (
    <svg {...p}>
      <path fill={f} d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44" />
      <path d="m13.56 11.747 4.332-.924" /><path d="m16 21-3.105-6.21" />
      <path fill={f} d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z" />
      <path d="m6.158 8.633 1.114 4.456" /><path d="m8 21 3.105-6.21" /><circle fill={f} cx="12" cy="13" r="2" />
    </svg>
  );
  return filled ? (
    <svg {...p}>
      <defs><mask id={cut}><rect width="24" height="24" fill="#fff" /><path d="M22 13a18.15 18.15 0 0 1-20 0" stroke="#000" strokeWidth="1.6" /><path d="M12 12h.01" stroke="#000" strokeWidth="2.6" /></mask></defs>
      <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><rect width="20" height="14" x="2" y="6" rx="2" fill="currentColor" mask={`url(#${cut})`} />
    </svg>
  ) : (
    <svg {...p}><path d="M12 12h.01" /><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M22 13a18.15 18.15 0 0 1-20 0" /><rect width="20" height="14" x="2" y="6" rx="2" /></svg>
  );
}

// A phone's tab bar: five tabs on a floating, frosted bar, the current one
// on a tinted pill (asked for 17 Oct 2026, after the Stock Screeners: India
// app). No counts; a dot when an alert's price has been reached.
//
// Reading down a page folds it into one round button, the current tab's, at
// the bottom left (as Reddit's app does, asked for 20 Oct 2026); scrolling
// back up, reaching the top, or tapping that button opens it again
// (tabBarScroll.js).
export function BottomTabBar({ tab, onTab }) {
  const badges = useTabBadges();
  const reached = badges.alerts.badgeColor === "var(--yellow)";
  const [collapsed, setCollapsed] = useState(false);
  const scroll = useRef({ collapsed: false, anchor: 0 });
  const open = () => { scroll.current = { collapsed: false, anchor: window.scrollY }; setCollapsed(false); };
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scroll.current = scrollStep(scroll.current, window.scrollY);
        setCollapsed(scroll.current.collapsed);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); };
  }, []);
  // A new tab opens with the bar open
  useEffect(open, [tab]);
  // Typing, the keyboard takes the bottom of the screen: the bar steps out
  // of its way, and comes back when the field is let go (8 Nov 2026)
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const field = el => !!el?.matches?.("textarea, [contenteditable='true'], input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file]):not([type=color])");
    let t = 0;
    const check = () => setTyping(field(document.activeElement));
    const later = () => { clearTimeout(t); t = setTimeout(check, 0); };
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", later);
    return () => { clearTimeout(t); document.removeEventListener("focusin", check); document.removeEventListener("focusout", later); };
  }, []);
  const isOn = t => tab === t.id || (t.id === "settings" && ["performance", "momentum", "alerts", "visitors"].includes(tab));
  // The one left showing when folded (Discover on a page that isn't a tab's)
  const kept = (phoneTabs.find(isOn) ?? phoneTabs[0]).id;
  // One glass lens under the tabs (asked for 21 Oct 2026: "glass movement
  // when I click on another"), redone to match a recording of iOS 26's own
  // tab bar (9 Nov 2026): a finger down on a tab sends the capsule there at
  // once, lifting into a clear drop on the way and landing back as the
  // capsule; the whole bar swells a little as it lifts (liquidLens.js).
  //
  // It can be held and slid too (23 Oct 2026, "when I press and move"): the
  // drop follows the finger exactly; each tab it crosses fills and ticks
  // (haptics.js — the Android app ticks as it goes; Safari only lets a page
  // tick on a tap, so an iPhone ticks once, on letting go), and letting go
  // opens the tab under it. A tap is a slide that didn't go anywhere.
  const [slideAt, setSlideAt] = useState(null); // the tab under a sliding finger
  const navRef = useRef(null);
  const gesture = useRef(null);
  const active = phoneTabs.findIndex(isOn);
  // the filled icon: the open tab's, or the one under a sliding finger
  const at = slideAt ?? active;
  const lensRef = useRef(null);
  const rimRef = useRef(null);
  const lens = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    const l = lens.current = createLens(navRef.current, lensRef.current, rimRef.current);
    l.place(activeRef.current);
    const again = () => l.place(activeRef.current);
    window.addEventListener("resize", again);
    // the labels' font decides the capsules' widths: measure again once it's in
    document.fonts?.ready?.then(() => { if (lens.current === l) l.place(activeRef.current); });
    return () => { window.removeEventListener("resize", again); l.destroy(); lens.current = null; };
  }, []);
  // the open tab changed, however it happened: the lens goes there
  useEffect(() => { if (!collapsed) lens.current?.select(active); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const wasCollapsed = useRef(collapsed);
  useEffect(() => {
    const l = lens.current;
    if (!l) return;
    if (collapsed) { l.hide(); wasCollapsed.current = true; return; }
    if (wasCollapsed.current) {
      // unfolding: the tabs are still sliding back into place; set it under its tab once they're there
      wasCollapsed.current = false;
      const t = setTimeout(() => lens.current?.place(activeRef.current), 320);
      return () => clearTimeout(t);
    }
  }, [collapsed]);
  // which tab is under a point: equal slots, 4.3px in from the bar's ends (the
  // bar may be swelling, so in its own measure)
  const geometry = () => {
    const r = navRef.current.getBoundingClientRect();
    const scale = r.width / (navRef.current.offsetWidth || r.width);
    const pad = EDGE * scale, each = (r.width - 2 * pad) / phoneTabs.length;
    return { r, pad, each, scale };
  };
  const tabAt = (clientX, g = geometry()) => Math.min(phoneTabs.length - 1, Math.max(0, Math.floor((clientX - g.r.left - g.pad) / g.each)));
  const onDown = e => {
    if (collapsed || !e.isPrimary || e.button > 0) return;
    const g = geometry(), i = tabAt(e.clientX, g);
    gesture.current = { id: e.pointerId, startX: e.clientX, moved: false, i, g };
    lens.current?.press(i);
  };
  const onMove = e => {
    const st = gesture.current;
    if (!st || e.pointerId !== st.id) return;
    if (!st.moved && Math.abs(e.clientX - st.startX) < 8) return; // a tap's wobble, not a slide
    if (!st.moved) { st.moved = true; navRef.current.setPointerCapture?.(e.pointerId); setSlideAt(st.i); }
    lens.current?.follow((e.clientX - st.g.r.left) / st.g.scale);
    const i = tabAt(e.clientX, st.g);
    if (i !== st.i) { st.i = i; setSlideAt(i); tick(); }
  };
  const finish = (e, cancelled) => {
    const st = gesture.current;
    if (!st || e.pointerId !== st.id) return;
    gesture.current = null;
    setSlideAt(null);
    if (cancelled) { lens.current?.release(activeRef.current); return; }
    if (st.moved) {
      // let go: the tab under the finger opens (the click a release can send
      // is ignored; gone by the next tap, which after a captured slide may
      // never come to a tab at all)
      const t = phoneTabs[st.i];
      slid.current = true;
      setTimeout(() => { slid.current = false; }, 0);
      lens.current?.release(st.i);
      if (!isOn(t)) { tick(); onTab(t.id); }
    } else lens.current?.release(); // a tap: its click opens the tab
  };
  const slid = useRef(false);
  // the drop's copy of the tabs for its middle (its rim is drawn by rimLens.js)
  const copy = phoneTabs.map((t, i) => (
    <span key={t.id} className="btb-lens-tab">
      <span className="btb-icon"><TabGlyph id={t.id} filled={i === at} /></span>
      <span className="btb-label">{t.short}</span>
    </span>
  ));
  return (
    <nav ref={navRef} className={`bottom-tab-bar${collapsed ? " collapsed" : ""}${slideAt != null ? " sliding" : ""}${typing ? " typing" : ""}`} data-tour="tabs" aria-label="Pages"
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={e => finish(e, false)} onPointerCancel={e => finish(e, true)}>
      {/* the bar's glass, a layer of its own: so the capsule and the drop
          over it can see the page through it, not only the bar */}
      <span className="btb-bg" aria-hidden="true" />
      {/* the capsule and the drop's glass, under the tabs */}
      <span ref={lensRef} className="btb-lens" aria-hidden="true">
        <span className="btb-lens-rest" />
        <span className="btb-lens-glass" />
      </span>
      {/* over the tabs, while lifted: the drop's own view of them — in place
          at its middle, bent and split into colour at its rim (rimLens.js) —
          and its edge */}
      <span ref={rimRef} className="btb-lens-top" aria-hidden="true">
        <span className="btb-lens-mid"><span className="btb-lens-row" data-k="0">{copy}</span></span>
        <canvas className="btb-lens-canvas" />
        <span className="btb-lens-shine" />
      </span>
      {phoneTabs.map((t, i) => {
        const on = isOn(t);
        const hidden = collapsed && t.id !== kept;
        const folded = collapsed && t.id === kept;
        return (
          <button key={t.id} type="button" className={`btb-tab${t.id === kept ? " btb-kept" : ""}${i === at ? " lit" : ""}`} aria-current={on ? "page" : undefined}
            tabIndex={hidden ? -1 : undefined} aria-hidden={hidden || undefined} aria-label={folded ? `${t.short}: show all tabs` : undefined}
            onClick={() => {
              if (slid.current) { slid.current = false; return; }
              if (folded) return open();
              if (!on) tick();
              onTab(t.id);
            }}>
            {/* what's drawn, apart from the button: the drop cuts this away
                under it while lifted, and the button stays tappable */}
            <span className="btb-face">
              <span className="btb-icon">
                <TabGlyph id={t.id} filled={i === at} />
                {(t.id === "alerts" || t.id === "settings") && reached && <span className="btb-dot" aria-hidden="true" />}
                {t.id === "watchlist" && badges.watchlist.news && <span className="btb-dot btb-dot-news" aria-hidden="true" />}
              </span>
              <span className="btb-label">{t.short}</span>
            </span>
            {/* the dots' meaning, after the tab's name so the name still leads */}
            {(t.id === "alerts" || t.id === "settings") && reached && <span className="sr-only">, an alert's price was reached</span>}
            {t.id === "watchlist" && badges.watchlist.news && <span className="sr-only">, new from your companies</span>}
          </button>
        );
      })}
    </nav>
  );
}
