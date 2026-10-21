import { useEffect, useRef, useState } from "react";
import { Compass, Star, BriefcaseBusiness, ChartLine, Bell, Sun, Moon, Zap, Settings } from "lucide-react";
import { useWatchlist } from "./watchlist.js";
import { portfolioStore, alertsStore } from "./stores.js";
import StockSearchBar from "./StockSearchBar.jsx";
import { BrandMark } from "./site.jsx";
import { tick } from "./haptics.js";
import { scrollStep } from "./tabBarScroll.js";
import AccountMenu from "./AccountMenu.jsx";

// The original's sticky header (stock-screener src/Discovery.jsx): logo,
// search, theme switch and account in one row, then the tabs with counts. On
// phones the tabs move to a floating bar at the bottom (BottomTabBar), the
// header is the logo and the search and scrolls away, and the theme and
// account move to the Settings tab (asked for 17 Oct 2026: the app on a phone
// as clean as a native one).

export const TABS = [
  { id: "discover", label: "Discover", short: "Discover", Icon: Compass },
  // Short-term and speculative, so only for accounts the server allows
  // (http-server.js momentumAllowed) — /api/auth/me says which
  { id: "momentum", label: "Momentum", short: "Momentum", Icon: Zap, gated: "momentum" },
  { id: "watchlist", label: "Watchlist", short: "Watchlist", Icon: Star },
  { id: "portfolio", label: "Portfolio", short: "Portfolio", Icon: BriefcaseBusiness },
  { id: "performance", label: "Performance", short: "Perf", Icon: ChartLine },
  { id: "alerts", label: "Alerts", short: "Alerts", Icon: Bell },
  // A phone's bar: Settings holds the account, the theme, Performance and
  // Momentum, so the bar keeps five tabs
  { id: "settings", label: "Settings", short: "Settings", Icon: Settings, phone: true },
];
const PHONE_TABS = ["discover", "watchlist", "portfolio", "alerts", "settings"];

const HEADER_BG = { light: "rgba(255,255,255,0.82)", dark: "rgba(7,7,14,0.85)" };

export const tabsFor = account => TABS.filter(t => !t.phone && (!t.gated || account?.features?.[t.gated]));
const phoneTabs = PHONE_TABS.map(id => TABS.find(t => t.id === id));

// Counts and badges for the tabs, shared by the header and the bottom bar
export function useTabBadges() {
  const watchCount = useWatchlist().size;
  const portfolio = portfolioStore.use();
  const alerts = alertsStore.use();
  const triggered = (alerts ?? []).filter(a => a.enabled && a.triggered).length;
  return {
    watchlist: { count: watchCount },
    portfolio: { count: portfolio?.holdings.length ?? 0 },
    alerts: {
      badge: triggered > 0 ? triggered : alerts?.length ? alerts.length : null,
      badgeColor: triggered > 0 ? "var(--yellow)" : "var(--accent)",
    },
  };
}

export default function Header({ tab, onTab, account, onLogout, onDeleted, onSearch, theme, onToggleTheme, onTour }) {
  const badges = useTabBadges();
  // Discover's start page has a one-row header — no tab row (asked for 20 Oct
  // 2026: "not important there"); its stock lists have the row, as every
  // other page does (asked the same day). Discover says which of its two it's
  // showing (html[data-discover-step], DiscoverView.jsx) and index.css hides
  // the row on the start page.
  const onDiscover = tab === "discover";

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
          <a href="/" aria-label="Jocular Insights home" onClick={e => { e.preventDefault(); onTab("discover"); }} style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, cursor: "pointer", color: "inherit", textDecoration: "none" }}>
            <BrandMark size={null} className="hdr-mark" />
            <div className="hide-phone" style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 17, fontWeight: 500, margin: 0, color: "var(--t1)", letterSpacing: "-0.03em", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                Jocular <span style={{ color: "var(--brand-wise)", fontWeight: 400 }}>Insights</span>
              </h1>
              <p className="hide-phone" style={{ fontSize: 11, color: "var(--t3)", margin: 0, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>NSE stock research</p>
            </div>
          </a>

          <div data-tour="search" className="app-header-search" style={{ flex: "1 1 auto", maxWidth: 560, minWidth: 0 }}>
            <StockSearchBar onAnalyze={onSearch} placeholder="Search stocks" />
          </div>

          <div className="hide-phone" style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginLeft: "auto" }}>
            <button onClick={onToggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{ width: 32, height: 32, borderRadius: 8, background: "var(--s2)", border: "1px solid var(--bdr)", color: "var(--t2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}>
              {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
            </button>
            <AccountMenu account={account} onLogout={onLogout} onDeleted={onDeleted} onTour={onTour} />
          </div>
        </div>

        <div className={`discovery-tabs${onDiscover ? " tabs-on-discover" : ""}`} data-tour="tabs" style={{ display: "flex", gap: 0 }}>
          {tabsFor(account).map(t => {
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
                {b.count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 500, lineHeight: "15px", padding: "0 6px", borderRadius: 999, background: "var(--s3)", border: "1px solid var(--bdr2)", color: active ? "var(--t1)" : "var(--t2)", fontVariantNumeric: "tabular-nums" }}>{b.count}</span>
                )}
                {b.badge != null && (
                  <span style={{ fontSize: 9, fontWeight: 500, padding: "1px 5px", borderRadius: 999, lineHeight: "14px", background: b.badgeColor, color: "var(--on-accent)" }}>{b.badge}</span>
                )}
              </button>
            );
          })}
        </div>
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
  const isOn = t => tab === t.id || (t.id === "settings" && ["performance", "momentum"].includes(tab));
  // The one left showing when folded (Discover on a page that isn't a tab's)
  const kept = (phoneTabs.find(isOn) ?? phoneTabs[0]).id;
  // One glass lens under the tabs (asked for 21 Oct 2026: "glass movement
  // when I click on another"): it slides to the tab pressed — on the press,
  // not the release — stretching the way it goes and settling, as iOS's tab
  // bar does. A press that turns into a scroll puts it back.
  const [pressed, setPressed] = useState(null);
  // (let go after the tap has opened its tab — a touch's pointerleave comes
  // before its click, and clearing then flicked the lens back for a frame)
  const release = useRef(0);
  useEffect(() => () => clearTimeout(release.current), []);
  const at = pressed ?? phoneTabs.findIndex(isOn);
  const from = useRef(at);
  const moves = useRef(0);
  if (from.current !== at) { moves.current += 1; }
  const distance = Math.abs(at - from.current);
  useEffect(() => { from.current = at; });
  return (
    <nav className={`bottom-tab-bar${collapsed ? " collapsed" : ""}`} data-tour="tabs" aria-label="Pages">
      {at >= 0 && (
        <span className={`btb-glass${moves.current ? " go" : ""}${pressed != null ? " pressing" : ""}`} aria-hidden="true"
          style={{ "--i": at, "--n": phoneTabs.length, "--d": Math.min(distance || 1, 4) }}>
          <span key={moves.current} className="btb-glass-body" />
        </span>
      )}
      {phoneTabs.map((t, i) => {
        const on = isOn(t);
        const hidden = collapsed && t.id !== kept;
        const folded = collapsed && t.id === kept;
        return (
          <button key={t.id} type="button" className={`btb-tab${t.id === kept ? " btb-kept" : ""}${i === at ? " lit" : ""}`} aria-current={on ? "page" : undefined}
            tabIndex={hidden ? -1 : undefined} aria-hidden={hidden || undefined} aria-label={folded ? `${t.short}: show all tabs` : undefined}
            onPointerDown={e => { if (!collapsed && e.isPrimary) setPressed(i); }}
            onPointerCancel={() => setPressed(null)}
            onPointerUp={() => { clearTimeout(release.current); release.current = setTimeout(() => setPressed(null), 350); }}
            onClick={() => { setPressed(null); if (folded) return open(); if (!on) tick(); onTab(t.id); }}>
            <span className="btb-icon">
              <t.Icon size={22} strokeWidth={i === at ? 2.3 : 2} aria-hidden="true" />
              {t.id === "alerts" && reached && <span className="btb-dot" aria-label="An alert's price was reached" />}
            </span>
            <span className="btb-label">{t.short}</span>
          </button>
        );
      })}
    </nav>
  );
}
