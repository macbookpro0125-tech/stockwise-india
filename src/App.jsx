import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "./api.js";
import Landing from "./Landing.jsx";
import { PrivacyPage, DisclaimerPage } from "./LegalPages.jsx";
import ResetPassword from "./ResetPassword.jsx";
import { usePath, navigate, stockFromPath, stockPath, SiteFooter } from "./site.jsx";
import Header, { BottomTabBar, TABS } from "./Header.jsx";
import PriceStrip from "./PriceStrip.jsx";
import DiscoverView from "./DiscoverView.jsx";
import WatchlistView from "./WatchlistView.jsx";
import PortfolioView from "./PortfolioView.jsx";
import PerformanceView from "./PerformanceView.jsx";
import AlertsView from "./AlertsView.jsx";
import MomentumView from "./MomentumView.jsx";
import StockDetail from "./StockDetail.jsx";
import Tour, { APP_TOUR, STOCK_TOUR } from "./Tour.jsx";
import { resetWatchlist } from "./watchlist.js";
import { portfolioStore, alertsStore } from "./stores.js";
import { strategiesStore, notesStore } from "./accountData.js";

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

// Which tours each account has seen in this browser: { "<id>:<email>": { app, stock } }
const TOURS_KEY = "stockwise-tours";
const toursSeen = owner => { try { return JSON.parse(localStorage.getItem(TOURS_KEY) || "{}")[owner] ?? {}; } catch { return {}; } };
const markToursSeen = (owner, names) => {
  try {
    const all = JSON.parse(localStorage.getItem(TOURS_KEY) || "{}");
    all[owner] = { ...all[owner], ...Object.fromEntries(names.map(n => [n, true])) };
    localStorage.setItem(TOURS_KEY, JSON.stringify(all));
  } catch {}
};

// index.html's title, shown again when no stock page is open
const TITLE = document.title;

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
  const loadAccount = () => api.me().then(d => setAccount({ userId: d.userId, email: d.email ?? null, phone: d.phone ?? null, name: d.name ?? null, hasPassword: d.hasPassword !== false, features: d.features ?? {} })).catch(() => setAccount(null));
  useEffect(() => { loadAccount(); }, []);
  // Saved strategies and My Notes come with the account
  useEffect(() => {
    if (!account?.userId) return;
    strategiesStore.load();
    notesStore.load();
  }, [account?.userId]);

  // The address decides which stock is open: Back/Forward, a refresh and a
  // shared link all land here
  const pathStock = stockFromPath(path);
  useEffect(() => {
    if (pathStock) {
      setOpen(o => (o?.symbol === pathStock ? o : { symbol: pathStock, at: Date.now() }));
    } else {
      setOpen(o => {
        if (o) requestAnimationFrame(() => window.scrollTo(0, discoverScroll.current));
        return null;
      });
    }
  }, [pathStock]);
  useEffect(() => {
    document.title = open ? `${open.symbol} · Stockwise India` : TITLE;
  }, [open?.symbol]);

  // The guided tour: Discover's the first time an account signs in here, the
  // company page's the first time it opens one; again from the Account menu.
  // It starts once the page it explains has drawn (its rows, its scores).
  const [tour, setTour] = useState(null); // "app" | "stock" | null
  const [tourAsked, setTourAsked] = useState(null);
  const owner = account ? `${account.userId}:${account.email ?? account.phone ?? ""}` : null;
  useEffect(() => {
    if (!owner || tour) return;
    const seen = toursSeen(owner);
    const want = tourAsked ?? (open ? (!seen.stock && "stock") : (tab === "discover" && !seen.app && "app"));
    if (!want || (want === "stock") !== !!open) return;
    const ready = want === "stock" ? '[data-tour="research"]' : '[data-tour="row"]';
    const started = Date.now();
    let timer;
    const check = () => {
      // A company with no scores never gets its tour; Discover's waits ~10 s
      if (document.querySelector(ready) || (want === "app" && Date.now() - started > 10000)) { setTourAsked(null); setTour(want); }
      else timer = setTimeout(check, 300);
    };
    timer = setTimeout(check, 500);
    return () => clearTimeout(timer);
  }, [owner, tour, tourAsked, open?.symbol, tab]);
  const finishTour = reason => {
    // Skipping means "no tours": the company page's isn't offered later either
    markToursSeen(owner, reason === "skip" ? ["app", "stock"] : [tour]);
    setTour(null);
  };
  const askForTour = () => {
    if (stockFromPath(window.location.pathname)) { setTourAsked("stock"); return; }
    setTab("discover");
    window.scrollTo(0, 0);
    setTourAsked("app");
  };

  // /privacy and /disclaimer are for everyone, signed in or not
  if (path === "/privacy") return <PrivacyPage signedIn={!!account} />;
  if (path === "/disclaimer") return <DisclaimerPage signedIn={!!account} />;
  // The page a reset email links to: saving signs in, then into the app
  if (path === "/reset-password") return <ResetPassword onDone={() => { setTab("discover"); navigate("/"); loadAccount(); }} />;

  if (account === undefined) return null; // avoid a front-page flash while the session check is in flight

  if (account === null) {
    // A shared stock link stays where it points once the visitor signs in
    return <Landing notice={notice} onAuthed={() => { setNotice(null); setTab("discover"); if (!stockFromPath(window.location.pathname)) navigate("/"); loadAccount(); }} />;
  }

  // A stock page is a page of its own (/stock/TCS): the browser's Back
  // button returns to the list it was opened from, and a refresh or a shared
  // link opens the same stock
  const openSymbol = (symbol) => {
    if (!open) discoverScroll.current = window.scrollY;
    // depth = stock pages since the list, so the page's Back button can
    // return to the list even after hopping from stock to peer
    const depth = (stockFromPath(window.location.pathname) ? window.history.state?.depth ?? 0 : 0) + 1;
    if (stockFromPath(window.location.pathname) !== symbol) navigate(stockPath(symbol), { state: { fromApp: true, depth } });
    setOpen({ symbol, at: Date.now() });
    window.scrollTo(0, 0);
  };
  // The page's Back button ("Back to Discover") returns to the list; the
  // browser's Back steps one page at a time. A stock page opened straight
  // from a link has nothing behind it, so it goes to Discover.
  const closeStock = () => {
    const depth = window.history.state?.fromApp ? window.history.state.depth ?? 1 : 0;
    if (depth) window.history.go(-depth);
    else navigate("/", { replace: true });
  };

  // The next person to sign in on this browser must not see this one's data
  const signedOut = (message = null) => {
    resetWatchlist();
    portfolioStore.reset();
    alertsStore.reset();
    strategiesStore.reset();
    notesStore.reset();
    setOpen(null);
    setTour(null);
    setNotice(message);
    setAccount(null);
    navigate("/");
  };
  const logout = () => api.logout().then(() => signedOut());
  const accountDeleted = () => signedOut("Your account and everything saved with it have been deleted.");
  const goTab = (t) => { if (open) navigate("/"); setOpen(null); setTab(t); window.scrollTo(0, 0); };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <PriceStrip onOpenStock={openSymbol} />
      <Header tab={open ? null : tab} onTab={goTab} account={account} onLogout={logout} onDeleted={accountDeleted} onSearch={openSymbol} theme={theme} onToggleTheme={toggleTheme} onTour={askForTour} />
      <div style={{ height: 16 }} />
      {open && <StockDetail key={open.at} symbol={open.symbol} account={account} onBack={closeStock} backTo={TABS.find(t => t.id === tab)?.label} onOpenStock={openSymbol} />}
      {/* Kept mounted (hidden) while a stock is open, so its filters and
          results are still there on Back. */}
      {tab === "discover" && <div hidden={!!open}><DiscoverView onOpenStock={openSymbol} /></div>}
      {!open && tab === "watchlist" && <WatchlistView onOpenStock={openSymbol} />}
      {!open && tab === "portfolio" && <PortfolioView onOpenStock={openSymbol} />}
      {!open && tab === "performance" && <PerformanceView onOpenStock={openSymbol} />}
      {!open && tab === "alerts" && <AlertsView onOpenStock={openSymbol} />}
      {!open && tab === "momentum" && account?.features?.momentum && <MomentumView onOpenStock={openSymbol} />}
      <SiteFooter />
      {/* On a company page too: the tab it was opened from stays lit */}
      <BottomTabBar tab={tab} onTab={goTab} theme={theme} account={account} />
      {tour && <Tour key={tour} steps={tour === "app" ? APP_TOUR : STOCK_TOUR} onFinish={finishTour} />}
    </div>
  );
}
