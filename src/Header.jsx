import { useEffect, useRef } from "react";
import { Compass, Star, BriefcaseBusiness, ChartLine, Bell, Sun, Moon, Zap } from "lucide-react";
import { useWatchlist } from "./watchlist.js";
import { portfolioStore, alertsStore } from "./stores.js";
import StockSearchBar from "./StockSearchBar.jsx";
import AccountMenu from "./AccountMenu.jsx";

// The sticky header, laid out as TradingView's: one row of mark, name, search,
// theme and account, then the tabs as plain text with counts. On phones the
// tabs move to a bottom bar (BottomTabBar) and the header scrolls away.

export const TABS = [
  { id: "discover", label: "Discover", short: "Discover", Icon: Compass },
  // Short-term and speculative, so only for accounts the server allows
  // (http-server.js momentumAllowed) — /api/auth/me says which
  { id: "momentum", label: "Momentum", short: "Momentum", Icon: Zap, gated: "momentum" },
  { id: "watchlist", label: "Watchlist", short: "Watchlist", Icon: Star },
  { id: "portfolio", label: "Portfolio", short: "Portfolio", Icon: BriefcaseBusiness },
  { id: "performance", label: "Performance", short: "Perf", Icon: ChartLine },
  { id: "alerts", label: "Alerts", short: "Alerts", Icon: Bell },
];

// Solid, as TradingView's: no frosted glass over the page
const HEADER_BG = { light: "var(--bg)", dark: "var(--bg)" };

export const tabsFor = account => TABS.filter(t => !t.gated || account?.features?.[t.gated]);

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
        {/* One row, as TradingView's: mark and name, search, then theme and
            account. The search drops to its own row on a phone. */}
        <div className="app-header-row" style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0" }}>
          <a href="/" aria-label="Stockwise India home" onClick={e => { e.preventDefault(); onTab("discover"); }} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, cursor: "pointer", color: "inherit", textDecoration: "none" }}>
            <img src="/stockwise-india-icon.svg" alt="" style={{ width: 24, height: 24, flexShrink: 0 }} />
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--t1)", lineHeight: 1.2, whiteSpace: "nowrap" }}>
              Stockwise <span style={{ color: "var(--t3)", fontWeight: 400 }}>India</span>
            </h1>
          </a>
          <div data-tour="search" className="app-header-search" style={{ flex: "1 1 auto", maxWidth: 420, minWidth: 0 }}>
            <StockSearchBar onAnalyze={onSearch} placeholder="Search stocks" />
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginLeft: "auto" }}>
            <button onClick={onToggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{ width: 32, height: 32, borderRadius: 4, background: "none", border: "1px solid transparent", color: "var(--t2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}>
              {theme === "dark" ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
            </button>
            <AccountMenu account={account} onLogout={onLogout} onDeleted={onDeleted} onTour={onTour} />
          </div>
        </div>

        <div className="discovery-tabs" data-tour="tabs" style={{ display: "flex", gap: 0 }}>
          {tabsFor(account).map(t => {
            const b = badges[t.id] ?? {};
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => onTab(t.id)} style={{
                padding: "8px 14px", fontSize: 14, fontWeight: active ? 600 : 400, background: "none", border: "none",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                color: active ? "var(--t1)" : "var(--t2)", cursor: "pointer", marginBottom: -1,
                transition: "color 150ms, border-color 150ms", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
              }}>
                {t.label}
                {b.count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, lineHeight: "15px", padding: "0 6px", borderRadius: 3, background: "var(--s3)", border: "1px solid var(--bdr2)", color: active ? "var(--t1)" : "var(--t2)", fontVariantNumeric: "tabular-nums" }}>{b.count}</span>
                )}
                {b.badge != null && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, lineHeight: "14px", background: b.badgeColor, color: "var(--on-accent)" }}>{b.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// The original's phone tab bar: the same five tabs, fixed to the bottom
export function BottomTabBar({ tab, onTab, theme, account }) {
  const badges = useTabBadges();
  return (
    <div className="bottom-tab-bar" data-tour="tabs" style={{ background: HEADER_BG[theme] ?? HEADER_BG.dark }}>
      {tabsFor(account).map(t => {
        const b = badges[t.id] ?? {};
        return (
          <button key={t.id} onClick={() => onTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", background: "none", border: "none", cursor: "pointer", color: tab === t.id ? "var(--accent)" : "var(--t3)", transition: "color 150ms", position: "relative" }}>
            <t.Icon size={20} strokeWidth={tab === t.id ? 2.2 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "-0.01em" }}>{t.short}</span>
            {(b.count > 0 || b.badge != null) && (
              <span style={{ position: "absolute", top: 2, right: "calc(50% - 18px)", fontSize: 8, fontWeight: 700, padding: "0 4px", borderRadius: 3, lineHeight: "14px", background: b.badgeColor || "var(--accent)", color: "var(--on-accent)", minWidth: 14, textAlign: "center" }}>
                {b.count > 0 ? b.count : b.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
