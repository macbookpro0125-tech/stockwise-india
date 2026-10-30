import { useEffect, useRef, useState } from "react";
import { Star, BriefcaseBusiness, ChartLine, Bell, Sun, Moon, Zap, Settings, Telescope, Users, PanelsLeftRight } from "lucide-react";
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
import { createLens } from "./liquidLens.js";

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

export const TABS = [
  // A computer splits Discover in two (31 Oct 2026): Screeners, the ready-made
  // screens to pick from, and Workspace, where a screen is built and studied
  // (DiscoverView's two steps). A phone keeps the one Discover tab.
  { id: "discover", label: "Discover", wide: "Screeners", short: "Discover", Icon: GridIcon },
  { id: "workspace", label: "Workspace", short: "Workspace", Icon: PanelsLeftRight, wideOnly: true },
  // The indices and the news (ExploreView.jsx, 23 Oct 2026)
  { id: "explore", label: "Explore", short: "Explore", Icon: Telescope },
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

export default function Header({ tab, onTab, account, onLogout, onDeleted, onSearch, theme, onToggleTheme, onTour }) {
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
              <h1 style={{ fontSize: 17, fontWeight: 500, margin: 0, color: "var(--t1)", letterSpacing: "-0.03em", lineHeight: 1.2, whiteSpace: "nowrap" }}>
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
                padding: "8px 16px", fontSize: 13.5, fontWeight: active ? 600 : 500, background: "none", border: "none",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                color: active ? "var(--t1)" : "var(--t2)", cursor: "pointer", marginBottom: -1,
                transition: "color 150ms, border-color 150ms", letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
              }}>
                <t.Icon size={15} strokeWidth={2} style={{ color: active ? "var(--accent)" : "var(--t3)" }} />
                {t.label}
                {b.news && <><span className="tab-news-dot" aria-hidden="true" /><span className="sr-only">, new from your companies</span></>}
                {b.count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 500, lineHeight: "15px", padding: "0 6px", borderRadius: 999, background: "var(--s3)", border: "1px solid var(--bdr2)", color: active ? "var(--t1)" : "var(--t2)", fontVariantNumeric: "tabular-nums" }}>{b.count}</span>
                )}
                {b.badge != null && (
                  <span style={{ fontSize: 9, fontWeight: 500, padding: "1px 5px", borderRadius: 999, lineHeight: "14px", background: b.badgeColor, color: "var(--on-accent)" }}>{b.badge}</span>
                )}
              </button>
            );
          })}
        </div>}
      </div>
    </div>
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
  const isOn = t => tab === t.id || (t.id === "settings" && ["performance", "momentum", "alerts", "visitors"].includes(tab));
  // The one left showing when folded (Discover on a page that isn't a tab's)
  const kept = (phoneTabs.find(isOn) ?? phoneTabs[0]).id;
  // One glass lens under the tabs (asked for 21 Oct 2026: "glass movement
  // when I click on another"): it slides to the tab pressed — on the press,
  // not the release — stretching the way it goes and settling, as iOS's tab
  // bar does.
  //
  // And it can be held and slid (23 Oct 2026, from another app: "when I
  // press and move"): a finger on the bar lifts the lens into a larger,
  // clearer glass that follows the finger exactly; each tab it crosses lights
  // and ticks (haptics.js — the Android app ticks as it goes; Safari only
  // lets a page tick on a tap, so an iPhone ticks once, on letting go), and
  // letting go opens the tab under it, the lens springing into place. A tap
  // is a slide that didn't go anywhere.
  const [pressed, setPressed] = useState(null);
  const [drag, setDrag] = useState(null); // { x } — the lens's centre, px from the bar's left
  const navRef = useRef(null);
  const gesture = useRef(null);
  const active = phoneTabs.findIndex(isOn);
  const at = pressed ?? active;
  // The lens itself is drawn frame by frame (liquidLens.js): it lifts into a
  // clear drop under a finger, follows a slide, and springs onto the tab
  const lensRef = useRef(null);
  const lens = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    lens.current = createLens(navRef.current, lensRef.current);
    lens.current.place(activeRef.current);
    const again = () => lens.current?.place(activeRef.current);
    window.addEventListener("resize", again);
    return () => { window.removeEventListener("resize", again); lens.current?.destroy(); lens.current = null; };
  }, []);
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
    // (held, the bar is a touch larger: the finger's place in the bar's own measure)
    if (drag) l.follow(drag.x * navRef.current.offsetWidth / navRef.current.getBoundingClientRect().width);
    else if (pressed != null) l.lift(pressed);
    else l.drop(active);
  }, [pressed, drag, active, collapsed]);
  // which tab is under a point, and where the lens may go
  const geometry = () => {
    const r = navRef.current.getBoundingClientRect();
    const pad = 4, inner = r.width - 2 * pad, each = inner / phoneTabs.length;
    return { r, pad, each };
  };
  const tabAt = (clientX, g = geometry()) => Math.min(phoneTabs.length - 1, Math.max(0, Math.floor((clientX - g.r.left - g.pad) / g.each)));
  const onDown = e => {
    if (collapsed || !e.isPrimary || e.button > 0) return;
    const g = geometry(), i = tabAt(e.clientX, g);
    gesture.current = { id: e.pointerId, startX: e.clientX, moved: false, i, g };
    setPressed(i);
  };
  const onMove = e => {
    const st = gesture.current;
    if (!st || e.pointerId !== st.id) return;
    if (!st.moved && Math.abs(e.clientX - st.startX) < 8) return; // a tap's wobble, not a slide
    if (!st.moved) { st.moved = true; navRef.current.setPointerCapture?.(e.pointerId); }
    const { r, pad, each } = st.g;
    const x = Math.min(r.width - pad - each / 2, Math.max(pad + each / 2, e.clientX - r.left));
    setDrag({ x, each });
    const i = tabAt(e.clientX, st.g);
    if (i !== st.i) { st.i = i; setPressed(i); tick(); }
  };
  const finish = (e, cancelled) => {
    const st = gesture.current;
    if (!st || e.pointerId !== st.id) return;
    gesture.current = null;
    setDrag(null);
    if (cancelled) { setPressed(null); return; }
    // let go: the tab under the finger opens; a tap is left to its click
    if (st.moved) {
      const t = phoneTabs[st.i];
      // (the click a release can send ignored; gone by the next tap, which
      // after a captured slide may never come to a tab at all)
      slid.current = true;
      setTimeout(() => { slid.current = false; }, 0);
      setPressed(null);
      if (!isOn(t)) { tick(); onTab(t.id); }
    } else {
      setTimeout(() => setPressed(null), 350);
    }
  };
  // the click that follows a slide's release isn't a tap of its own
  const slid = useRef(false);
  // inside the drop: the tabs again, in colour, which it magnifies
  const copy = phoneTabs.map(t => (
    <span key={t.id} className="btb-lens-tab">
      <span className="btb-icon">{t.Icon === GridIcon ? <GridIcon size={22} strokeWidth={1.9} filled /> : <t.Icon size={21} strokeWidth={2.3} />}</span>
      <span className="btb-label">{t.short}</span>
    </span>
  ));
  return (
    <nav ref={navRef} className={`bottom-tab-bar${collapsed ? " collapsed" : ""}${drag ? " sliding" : ""}`} data-tour="tabs" aria-label="Pages"
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={e => finish(e, false)} onPointerCancel={e => finish(e, true)}>
      <span ref={lensRef} className="btb-lens" aria-hidden="true">
        <span className="btb-lens-rest" />
        <span className="btb-lens-glass">
          <span className="btb-lens-mag"><span className="btb-lens-row">{copy}</span></span>
          <span className="btb-lens-rim"><span className="btb-lens-row">{copy}</span></span>
        </span>
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
              setPressed(null); if (folded) return open(); if (!on) tick(); onTab(t.id);
            }}>
            <span className="btb-icon">
              {t.Icon === GridIcon
                ? <GridIcon size={22} strokeWidth={1.9} filled={i === at} aria-hidden="true" />
                : <t.Icon size={21} strokeWidth={i === at ? 2.3 : 2} aria-hidden="true" />}
              {(t.id === "alerts" || t.id === "settings") && reached && <span className="btb-dot" aria-hidden="true" />}
              {t.id === "watchlist" && badges.watchlist.news && <span className="btb-dot btb-dot-news" aria-hidden="true" />}
            </span>
            <span className="btb-label">{t.short}</span>
            {/* the dots' meaning, after the tab's name so the name still leads */}
            {(t.id === "alerts" || t.id === "settings") && reached && <span className="sr-only">, an alert's price was reached</span>}
            {t.id === "watchlist" && badges.watchlist.news && <span className="sr-only">, new from your companies</span>}
          </button>
        );
      })}
    </nav>
  );
}
