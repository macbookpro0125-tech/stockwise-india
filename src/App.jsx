import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "./api.js";
import Landing from "./Landing.jsx";
import { PrivacyPage, DisclaimerPage } from "./LegalPages.jsx";
import ResetPassword from "./ResetPassword.jsx";
import { usePath, navigate, SiteFooter } from "./site.jsx";
import Header, { BottomTabBar, TABS } from "./Header.jsx";
import PriceStrip from "./PriceStrip.jsx";
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
  const path = usePath();
  // undefined = checking, null = signed out, else { userId, email }
  const [account, setAccount] = useState(undefined);
  // A one-off message for the front page (e.g. after deleting an account)
  const [notice, setNotice] = useState(null);
  const [tab, setTab] = useState("discover");
  const [theme, toggleTheme] = useTheme();
  // { symbol, at } rather than a bare symbol: searching the same symbol again
  // (e.g. retrying after an error) must re-fetch, and an unchanged string
  // wouldn't re-render at all.
  const [open, setOpen] = useState(null);
  // Where the Discover list was scrolled to, so Back lands on the same row
  const discoverScroll = useRef(0);

  // email or phone (a phone sign-in has no email), name, and whether there is a password at all
  const loadAccount = () => api.me().then(d => setAccount({ userId: d.userId, email: d.email ?? null, phone: d.phone ?? null, name: d.name ?? null, hasPassword: d.hasPassword !== false })).catch(() => setAccount(null));
  useEffect(() => { loadAccount(); }, []);

  // /privacy and /disclaimer are for everyone, signed in or not
  if (path === "/privacy") return <PrivacyPage signedIn={!!account} />;
  if (path === "/disclaimer") return <DisclaimerPage signedIn={!!account} />;
  // The page a reset email links to: saving signs in, then into the app
  if (path === "/reset-password") return <ResetPassword onDone={() => { setTab("discover"); navigate("/"); loadAccount(); }} />;

  if (account === undefined) return null; // avoid a front-page flash while the session check is in flight

  if (account === null) {
    return <Landing notice={notice} onAuthed={() => { setNotice(null); setTab("discover"); navigate("/"); loadAccount(); }} />;
  }

  const openSymbol = (symbol) => {
    if (!open) discoverScroll.current = window.scrollY;
    setOpen({ symbol, at: Date.now() });
    window.scrollTo(0, 0);
  };
  const closeStock = () => {
    setOpen(null);
    requestAnimationFrame(() => window.scrollTo(0, discoverScroll.current));
  };

  // The next person to sign in on this browser must not see this one's data
  const signedOut = (message = null) => {
    resetWatchlist();
    portfolioStore.reset();
    alertsStore.reset();
    setOpen(null);
    setNotice(message);
    setAccount(null);
    navigate("/");
  };
  const logout = () => api.logout().then(() => signedOut());
  const accountDeleted = () => signedOut("Your account and everything saved with it have been deleted.");
  const goTab = (t) => { setOpen(null); setTab(t); window.scrollTo(0, 0); };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <PriceStrip onOpenStock={openSymbol} />
      <Header tab={open ? null : tab} onTab={goTab} account={account} onLogout={logout} onDeleted={accountDeleted} onSearch={openSymbol} theme={theme} onToggleTheme={toggleTheme} />
      <div style={{ height: 16 }} />
      {open && <StockDetail key={open.at} symbol={open.symbol} account={account} onBack={closeStock} backTo={TABS.find(t => t.id === tab)?.label} onOpenStock={openSymbol} />}
      {/* Kept mounted (hidden) while a stock is open, so its filters and
          results are still there on Back. */}
      {tab === "discover" && <div hidden={!!open}><DiscoverView onOpenStock={openSymbol} /></div>}
      {!open && tab === "watchlist" && <WatchlistView onOpenStock={openSymbol} />}
      {!open && tab === "portfolio" && <PortfolioView onOpenStock={openSymbol} />}
      {!open && tab === "performance" && <PerformanceView onOpenStock={openSymbol} />}
      {!open && tab === "alerts" && <AlertsView onOpenStock={openSymbol} />}
      <SiteFooter />
      {/* Not on a stock page: that has its own bottom Back button on phones,
          as the original's stock page did */}
      {!open && <BottomTabBar tab={tab} onTab={goTab} theme={theme} />}
    </div>
  );
}
