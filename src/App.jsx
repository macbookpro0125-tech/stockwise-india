import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "./api.js";
import AuthForm from "./AuthForm.jsx";
import Header, { BottomTabBar } from "./Header.jsx";
import DiscoverView from "./DiscoverView.jsx";
import WatchlistView from "./WatchlistView.jsx";
import PortfolioView from "./PortfolioView.jsx";
import PerformanceView from "./PerformanceView.jsx";
import AlertsView from "./AlertsView.jsx";
import StockDetail from "./StockDetail.jsx";
import { resetWatchlist } from "./watchlist.js";
import { portfolioStore, alertsStore } from "./stores.js";

// Dark by default, as the original; the choice is remembered in this browser
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("stockwise-india-theme") || "dark"; } catch { return "dark"; }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("stockwise-india-theme", theme); } catch {}
  }, [theme]);
  const toggle = useCallback(() => setTheme(t => (t === "dark" ? "light" : "dark")), []);
  return [theme, toggle];
}

export default function App() {
  const [userId, setUserId] = useState(undefined); // undefined = checking, null = signed out
  const [tab, setTab] = useState("discover");
  const [theme, toggleTheme] = useTheme();
  // { symbol, at } rather than a bare symbol: searching the same symbol again
  // (e.g. retrying after an error) must re-fetch, and an unchanged string
  // wouldn't re-render at all.
  const [open, setOpen] = useState(null);
  // Where the Discover list was scrolled to, so Back lands on the same row
  const discoverScroll = useRef(0);

  const openSymbol = (symbol) => {
    if (!open) discoverScroll.current = window.scrollY;
    setOpen({ symbol, at: Date.now() });
    window.scrollTo(0, 0);
  };
  const closeStock = () => {
    setOpen(null);
    requestAnimationFrame(() => window.scrollTo(0, discoverScroll.current));
  };

  useEffect(() => {
    api.me().then(d => setUserId(d.userId)).catch(() => setUserId(null));
  }, []);

  if (userId === undefined) return null; // avoid a login-form flash while the session check is in flight

  if (userId === null) return <AuthForm onAuthed={setUserId} />;

  // The next person to sign in on this browser must not see this one's data
  const logout = () => api.logout().then(() => {
    resetWatchlist();
    portfolioStore.reset();
    alertsStore.reset();
    setUserId(null);
  });
  const goTab = (t) => { setOpen(null); setTab(t); window.scrollTo(0, 0); };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Header tab={open ? null : tab} onTab={goTab} onLogout={logout} onSearch={openSymbol} theme={theme} onToggleTheme={toggleTheme} />
      <div style={{ height: 16 }} />
      {open && <StockDetail key={open.at} symbol={open.symbol} onBack={closeStock} onOpenStock={openSymbol} />}
      {/* Kept mounted (hidden) while a stock is open, so its filters and
          results are still there on Back. */}
      {tab === "discover" && <div hidden={!!open}><DiscoverView onOpenStock={openSymbol} /></div>}
      {!open && tab === "watchlist" && <WatchlistView onOpenStock={openSymbol} />}
      {!open && tab === "portfolio" && <PortfolioView onOpenStock={openSymbol} />}
      {!open && tab === "performance" && <PerformanceView onOpenStock={openSymbol} />}
      {!open && tab === "alerts" && <AlertsView onOpenStock={openSymbol} />}
      {/* Not on a stock page: that has its own bottom Back button on phones,
          as the original's stock page did */}
      {!open && <BottomTabBar tab={tab} onTab={goTab} theme={theme} />}
    </div>
  );
}
