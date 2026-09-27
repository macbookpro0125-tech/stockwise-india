import { useState, useEffect, useRef } from "react";
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
  { id: "discover", label: "Discover", short: "Discover", icon: "◎" },
  { id: "watchlist", label: "Watchlist", short: "Watchlist", icon: "☆" },
  { id: "portfolio", label: "Portfolio", short: "Portfolio", icon: "◈" },
  { id: "performance", label: "Performance", short: "Perf", icon: "▲" },
  { id: "alerts", label: "Alerts", short: "Alerts", icon: "◉" },
];

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

// The Discover filter panel's controls (CriteriaPanel.jsx)
const FILTER_COUNT = 19;

function compact(n) {
  if (n == null) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

export default function Header({ tab, onTab, email, onLogout, onDeleted, onSearch, theme, onToggleTheme }) {
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
    <div ref={ref} className="app-header discovery-header-sticky" style={{ position: "sticky", top: 0, zIndex: 100, background: theme === "light" ? "rgba(244,245,247,0.88)" : "rgba(7,7,14,0.85)", borderBottom: "1px solid var(--bdr2)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ padding: "12px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexShrink: 1, cursor: "pointer" }} onClick={() => onTab("discover")}>
              <img src="/stockwise-india-icon.svg" alt="" style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--t1)", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
                  Stock<span style={{ color: "var(--brand-wise)" }}>wise</span> <span style={{ color: "var(--t3)", fontWeight: 500 }}>India</span>
                </h1>
                <p style={{ fontSize: 11, color: "var(--t3)", margin: 0, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>Indian market · NSE filings</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              {[[stats?.strategies ?? "—", "Presets"], [FILTER_COUNT, "Filters"], [compact(stats?.companies), "Stocks"]].map(([v, l]) => (
                <div key={l} className="stat-chip" style={{ padding: "4px 10px", borderRadius: 8, background: "var(--s2)", border: "1px solid var(--bdr)", display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{v}</span>
                  <span style={{ fontSize: 10, color: "var(--t3)" }}>{l}</span>
                </div>
              ))}
              <button onClick={onToggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                style={{ width: 32, height: 32, borderRadius: 8, background: "var(--s2)", border: "1px solid var(--bdr)", color: "var(--t2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0, padding: 0 }}>
                {theme === "dark" ? "☀" : "☾"}
              </button>
              <AccountMenu email={email} onLogout={onLogout} onDeleted={onDeleted} />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <StockSearchBar onAnalyze={onSearch} placeholder="Search any stock by name or symbol…" />
          </div>
        </div>

        <div className="discovery-tabs" style={{ display: "flex", gap: 0 }}>
          {TABS.map(t => {
            const b = badges[t.id] ?? {};
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => onTab(t.id)} style={{
                padding: "8px 18px", fontSize: 13, fontWeight: 500, background: "none", border: "none",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                color: active ? "var(--t1)" : "var(--t2)", cursor: "pointer", marginBottom: -1,
                transition: "all 150ms", letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
              }}>
                <span style={{ fontSize: 11, opacity: active ? 1 : 0.75 }}>{t.icon}</span>
                {t.label}
                {b.count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, lineHeight: "15px", padding: "0 6px", borderRadius: 999, background: "var(--s3)", border: "1px solid var(--bdr2)", color: active ? "var(--t1)" : "var(--t2)", fontVariantNumeric: "tabular-nums" }}>{b.count}</span>
                )}
                {b.badge != null && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 999, lineHeight: "14px", background: b.badgeColor, color: "#07070E" }}>{b.badge}</span>
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
    <div className="bottom-tab-bar" style={{ background: theme === "light" ? "rgba(244,245,247,0.88)" : "rgba(7,7,14,0.85)" }}>
      {TABS.map(t => {
        const b = badges[t.id] ?? {};
        return (
          <button key={t.id} onClick={() => onTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 0", background: "none", border: "none", cursor: "pointer", color: tab === t.id ? "var(--accent)" : "var(--t3)", transition: "color 150ms", position: "relative" }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "-0.01em" }}>{t.short}</span>
            {(b.count > 0 || b.badge != null) && (
              <span style={{ position: "absolute", top: 2, right: "calc(50% - 18px)", fontSize: 8, fontWeight: 700, padding: "0 4px", borderRadius: 999, lineHeight: "14px", background: b.badgeColor || "var(--accent)", color: "#07070E", minWidth: 14, textAlign: "center" }}>
                {b.count > 0 ? b.count : b.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
