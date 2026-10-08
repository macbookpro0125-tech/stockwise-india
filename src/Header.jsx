import { useState, useEffect, useRef } from "react";
import { Compass, Star, BriefcaseBusiness, ChartLine, Bell, Sun, Moon } from "lucide-react";
import { api } from "./api.js";
import { useWatchlist } from "./watchlist.js";
import { portfolioStore, alertsStore } from "./stores.js";
import StockSearchBar from "./StockSearchBar.jsx";
import AccountMenu from "./AccountMenu.jsx";

// The original's sticky header (stock-screener src/Discovery.jsx): logo, stat
// chips and theme switch, the search bar, then the five tabs with counts. On
// phones the tabs move to a bottom bar (BottomTabBar) and the header scrolls
// away.

export const TABS = [
  { id: "discover", label: "Discover", short: "Discover", Icon: Compass },
  { id: "watchlist", label: "Watchlist", short: "Watchlist", Icon: Star },
  { id: "portfolio", label: "Portfolio", short: "Portfolio", Icon: BriefcaseBusiness },
  { id: "performance", label: "Performance", short: "Perf", Icon: ChartLine },
  { id: "alerts", label: "Alerts", short: "Alerts", Icon: Bell },
];

const HEADER_BG = { light: "rgba(255,255,255,0.82)", dark: "rgba(7,7,14,0.85)" };

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

function compact(n) {
  if (n == null) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

export default function Header({ tab, onTab, account, onLogout, onDeleted, onSearch, theme, onToggleTheme, onTour }) {
  const badges = useTabBadges();
  const [stats, setStats] = useState(null);
  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);

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
        <div style={{ padding: "12px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexShrink: 1, cursor: "pointer" }} onClick={() => onTab("discover")}>
              <img src="/stockwise-india-icon.svg" alt="" style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--t1)", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
                  Stock<span style={{ color: "var(--brand-wise)" }}>wise</span> <span style={{ color: "var(--t3)", fontWeight: 500 }}>India</span>
                </h1>
                <p className="hide-phone" style={{ fontSize: 11, color: "var(--t3)", margin: 0, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>Indian market · NSE filings</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              {[[stats?.strategies ?? "—", "Presets"], [stats?.filters ?? "—", "Filters"], [compact(stats?.companies), "Stocks"]].map(([v, l]) => (
                <div key={l} className="stat-chip" style={{ padding: "4px 10px", borderRadius: 8, background: "var(--s2)", border: "1px solid var(--bdr)", display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", fontVariantNumeric: "tabular-nums" }}>{v}</span>
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>{l}</span>
                </div>
              ))}
              <button onClick={onToggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                style={{ width: 32, height: 32, borderRadius: 8, background: "var(--s2)", border: "1px solid var(--bdr)", color: "var(--t2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}>
                {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
              </button>
              <AccountMenu account={account} onLogout={onLogout} onDeleted={onDeleted} onTour={onTour} />
            </div>
          </div>
          <div data-tour="search" style={{ marginTop: 8 }}>
            <StockSearchBar onAnalyze={onSearch} placeholder="Search any stock by name or symbol…" />
          </div>
        </div>

        <div className="discovery-tabs" data-tour="tabs" style={{ display: "flex", gap: 0 }}>
          {TABS.map(t => {
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
                  <span style={{ fontSize: 10, fontWeight: 700, lineHeight: "15px", padding: "0 6px", borderRadius: 999, background: "var(--s3)", border: "1px solid var(--bdr2)", color: active ? "var(--t1)" : "var(--t2)", fontVariantNumeric: "tabular-nums" }}>{b.count}</span>
                )}
                {b.badge != null && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 999, lineHeight: "14px", background: b.badgeColor, color: "var(--on-accent)" }}>{b.badge}</span>
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
export function BottomTabBar({ tab, onTab, theme }) {
  const badges = useTabBadges();
  return (
    <div className="bottom-tab-bar" data-tour="tabs" style={{ background: HEADER_BG[theme] ?? HEADER_BG.dark }}>
      {TABS.map(t => {
        const b = badges[t.id] ?? {};
        return (
          <button key={t.id} onClick={() => onTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", background: "none", border: "none", cursor: "pointer", color: tab === t.id ? "var(--accent)" : "var(--t3)", transition: "color 150ms", position: "relative" }}>
            <t.Icon size={20} strokeWidth={tab === t.id ? 2.2 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "-0.01em" }}>{t.short}</span>
            {(b.count > 0 || b.badge != null) && (
              <span style={{ position: "absolute", top: 2, right: "calc(50% - 18px)", fontSize: 8, fontWeight: 700, padding: "0 4px", borderRadius: 999, lineHeight: "14px", background: b.badgeColor || "var(--accent)", color: "var(--on-accent)", minWidth: 14, textAlign: "center" }}>
                {b.count > 0 ? b.count : b.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
