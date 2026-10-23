import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { lazyPage } from "./lazyPage.js";
import ExploreView from "./ExploreView.jsx";
import PublicStock from "./PublicStock.jsx";
import { api } from "./api.js";
import Landing from "./Landing.jsx";
import { PrivacyPage, DisclaimerPage, HelpPage } from "./LegalPages.jsx";
import MethodologyPage from "./MethodologyPage.jsx";
import StockScreenerPage from "./StockScreenerPage.jsx";
import ResetPassword from "./ResetPassword.jsx";
import { usePath, navigate, stockFromPath, stockPath, chartFromPath, SiteFooter } from "./site.jsx";
import Header, { BottomTabBar, TABS } from "./Header.jsx";
import PriceStrip from "./PriceStrip.jsx";
import DiscoverView from "./DiscoverView.jsx";
import Tour, { APP_TOUR, STOCK_TOUR } from "./Tour.jsx";
import { resetWatchlist } from "./watchlist.js";
import { portfolioStore, alertsStore } from "./stores.js";
import { strategiesStore, notesStore } from "./accountData.js";
import { useAdPause } from "./ads.jsx";
import { noteAppOpened, companyPageClosed } from "./rateApp.js";
import { onPushTap, refreshPush, forgetPush } from "./push.js";

// Keep the first Discover screen small; load account tabs and full stock
// research only when the user opens them.
const WatchlistView = lazyPage(() => import("./WatchlistView.jsx"));
const PortfolioView = lazyPage(() => import("./PortfolioView.jsx"));
const PerformanceView = lazyPage(() => import("./PerformanceView.jsx"));
const AlertsView = lazyPage(() => import("./AlertsView.jsx"));
const MomentumView = lazyPage(() => import("./MomentumView.jsx"));
const SettingsView = lazyPage(() => import("./SettingsView.jsx"));
const StockDetail = lazyPage(() => import("./StockDetail.jsx"));
const ChartPage = lazyPage(() => import("./ChartPage.jsx"));

// Dark by default, as the original; the choice is remembered in this browser
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("stockwise-india-theme") || "dark"; } catch { return "dark"; }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("stockwise-india-theme", theme); } catch {}
    // The phone's status bar and the browser's bar take the page's colour;
    // in the Android and iPhone apps, its clock and icons the theme's
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#F5F6F8" : "#080810");
    if (window.Capacitor?.isNativePlatform?.()) {
      import("@capacitor/core").then(({ SystemBars, SystemBarsStyle }) => SystemBars.setStyle({ style: theme === "light" ? SystemBarsStyle.Light : SystemBarsStyle.Dark })).catch(() => {});
    }
  }, [theme]);
  // Cross-fades the two themes (View Transitions); instant without support or with reduced motion
  const toggle = useCallback(() => {
    const next = (document.documentElement.getAttribute("data-theme") === "light") ? "dark" : "light";
    const apply = () => {
      document.documentElement.setAttribute("data-theme", next);
      flushSync(() => setTheme(next));
    };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) { apply(); return; }
    document.startViewTransition(apply);
  }, []);
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
  // someone not signed in, on a company's public page, asked to sign in
  const [wantsSignIn, setWantsSignIn] = useState(false);
  const [theme, toggleTheme] = useTheme();
  // { symbol, at } rather than a bare symbol: searching the same symbol again
  // (e.g. retrying after an error) must re-fetch, and an unchanged string
  // wouldn't re-render at all.
  const [open, setOpen] = useState(null);
  // An item to open on the News page, from Discover's card
  const [newsOpen, setNewsOpen] = useState(null);
  // …and an index, from the price strip
  const [indexOpen, setIndexOpen] = useState(null);
  // Where the Discover list was scrolled to, so Back lands on the same row
  const discoverScroll = useRef(0);
  // Native Android Back walks the app's tab history after leaving a stock or
  // linked page. Tabs do not add browser history entries on the web.
  const tabHistory = useRef([]);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  // Ratings on Play, in the Android app (rateApp.js): each day it's used,
  // and each company page left — the pause when Play's card may come
  useEffect(() => { if (account?.userId) noteAppOpened(); }, [account?.userId]);
  const hadOpen = useRef(false);
  useEffect(() => {
    if (hadOpen.current && !open && account?.userId) companyPageClosed();
    hadOpen.current = !!open;
  }, [open, account?.userId]);

  const goTab = (t) => {
    if (t !== tabRef.current) tabHistory.current.push(tabRef.current);
    if (open) navigate("/");
    setOpen(null);
    tabRef.current = t;
    setTab(t);
    window.scrollTo(0, 0);
  };

  // A tapped phone notification (push.js) opens what it's about: an alert's
  // company, a news item, or the Watchlist for several
  const pushTap = useRef(null);
  pushTap.current = d => {
    // by its address, which also works while the account is still loading
    if (d.stock) navigate(stockPath(String(d.stock)), { state: { fromApp: true, depth: 1 } });
    else if (d.news) { setNewsOpen(String(d.news)); goTab("explore"); }
    else if (d.tab === "watchlist") goTab("watchlist");
  };
  useEffect(() => onPushTap(d => pushTap.current(d)), []);
  useEffect(() => { if (account?.userId) refreshPush(); }, [account?.userId]);

  // Capacitor's listener lets us handle system Back consistently with the
  // app's own stock routes and tab navigation, then exit from the root.
  useEffect(() => {
    if (window.Capacitor?.getPlatform?.() !== "android") return;
    let cancelled = false;
    let listener;
    import("@capacitor/app").then(({ App: NativeApp }) =>
      NativeApp.addListener("backButton", ({ canGoBack }) => {
        const currentPath = window.location.pathname;
        const stock = stockFromPath(currentPath);
        const chart = chartFromPath(currentPath);

        // A chart expanded over the page (PriceChartPanel.jsx) is its own
        // history entry: Back closes it, and the page stays where it was
        if (window.history.state?.chartOverlay) {
          window.history.back();
          return;
        }
        // So is a strategy's ⓘ page on a phone (StrategyPicker.jsx)
        if (window.history.state?.strategyInfo) {
          window.history.back();
          return;
        }
        // And a news item or an index open on the Explore page (ExploreView.jsx)
        if (window.history.state?.newsItem || window.history.state?.exploreIndex) {
          window.history.back();
          return;
        }

        if (chart) {
          if (canGoBack) window.history.back();
          else navigate(stockPath(chart), { replace: true });
          return;
        }

        if (stock) {
          const depth = window.history.state?.fromApp ? window.history.state.depth ?? 1 : 0;
          if (depth) window.history.go(-depth);
          else navigate("/", { replace: true });
          return;
        }

        if (["/privacy", "/disclaimer", "/help", "/methodology", "/reset-password"].includes(currentPath)) {
          if (canGoBack) window.history.back();
          else navigate("/", { replace: true });
          return;
        }

        // Discover's second page (a strategy's stocks) is a history entry on
        // "/" itself (DiscoverView): Back returns to the strategies, not out
        // of the app
        if (window.history.state?.discoverStep === "stocks") {
          window.history.back();
          return;
        }

        const previousTab = tabHistory.current.pop();
        if (previousTab) {
          tabRef.current = previousTab;
          setTab(previousTab);
          window.scrollTo(0, 0);
          return;
        }

        if (currentPath !== "/" && canGoBack) window.history.back();
        else NativeApp.exitApp();
      })
    ).then(handle => {
      if (cancelled) handle.remove();
      else listener = handle;
    }).catch(() => {});
    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, []);

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
    // Keep a company's server-written title while its public page is shown;
    // the page's own title is more useful than the app's generic one.
    if (account === undefined || (account === null && pathStock)) return;
    document.title = open ? `${open.symbol} · Jocular Insights` : TITLE;
  }, [open?.symbol, account, pathStock]);

  // The store app's ad cards sit over the page: hidden while a company page
  // covers the kept Discover list (ads.jsx)
  useAdPause(!!open);

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
    goTab("discover");
    window.scrollTo(0, 0);
    setTourAsked("app");
  };

  // /privacy, /disclaimer and /help are for everyone, signed in or not
  if (path === "/privacy") return <PrivacyPage signedIn={!!account} />;
  if (path === "/disclaimer") return <DisclaimerPage signedIn={!!account} />;
  if (path === "/help") return <HelpPage signedIn={!!account} />;
  if (path === "/methodology") return <MethodologyPage signedIn={!!account} />;
  if (path === "/stock-screener-india") return <StockScreenerPage signedIn={!!account} />;
  // The page a reset email links to: saving signs in, then into the app
  if (path === "/reset-password") return <ResetPassword onDone={() => { tabHistory.current = []; tabRef.current = "discover"; setTab("discover"); navigate("/"); loadAccount(); }} />;

  if (account === undefined) {
    // Keep a crawlable company's summary visible while the session check is in
    // flight. main.jsx reads the JSON beside the server-written HTML before
    // React replaces the root; a signed-in visitor moves into the full app.
    if (wantsSignIn) return <Landing notice={notice} onAuthed={() => { setNotice(null); tabHistory.current = []; tabRef.current = "discover"; setTab("discover"); if (!stockFromPath(window.location.pathname) && !chartFromPath(window.location.pathname)) navigate("/"); loadAccount(); }} />;
    const publicSymbol = stockFromPath(path);
    const initialPublicStock = window.__PUBLIC_STOCK__;
    if (publicSymbol && initialPublicStock?.symbol === publicSymbol) return <PublicStock symbol={publicSymbol} initial={initialPublicStock} onSignIn={() => setWantsSignIn(true)} />;
    return null; // avoid a front-page flash while the session check is in flight
  }

  if (account === null) {
    // A company's page shows its public summary first (PublicStock.jsx, 23 Oct
    // 2026); its Sign in button opens the front page, the link kept
    if (stockFromPath(path) && !wantsSignIn) return <PublicStock symbol={stockFromPath(path)} initial={window.__PUBLIC_STOCK__} onSignIn={() => setWantsSignIn(true)} />;
    // A shared stock or chart link stays where it points once the visitor signs in
    return <Landing notice={notice} onAuthed={() => { setNotice(null); tabHistory.current = []; tabRef.current = "discover"; setTab("discover"); if (!stockFromPath(window.location.pathname) && !chartFromPath(window.location.pathname)) navigate("/"); loadAccount(); }} />;
  }

  // /chart/TCS: the price chart alone, whole-screen (the phone's expand button)
  const chartSymbol = chartFromPath(path);
  if (chartSymbol) {
    return (
      <Suspense fallback={<div role="status" style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--t3)", fontSize: 13 }}>Loading the chart…</div>}>
        <ChartPage symbol={chartSymbol} />
      </Suspense>
    );
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
    tabHistory.current = [];
    tabRef.current = "discover";
    setTab("discover");
    setNotice(message);
    setAccount(null);
    navigate("/");
  };
  const logout = () => forgetPush().finally(() => api.logout().then(() => signedOut()));
  const accountDeleted = () => signedOut("Your account and everything saved with it have been deleted.");
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <PriceStrip onOpenStock={openSymbol} onOpenIndex={name => { setIndexOpen(name); goTab("explore"); }} />
      <Header tab={open ? null : tab} onTab={goTab} account={account} onLogout={logout} onDeleted={accountDeleted} onSearch={openSymbol} theme={theme} onToggleTheme={toggleTheme} onTour={askForTour} />
      <div style={{ height: 16 }} />
      {/* A phone: the page's name in large type, as a native app's (index.css .phone-title) */}
      {!open && tab !== "discover" && <h2 className="phone-title phone-only" style={{ padding: "0 var(--page-x)" }}>{TABS.find(t => t.id === tab)?.label === "Performance" ? "Strategy performance" : TABS.find(t => t.id === tab)?.label}</h2>}
      <Suspense fallback={<div role="status" style={{ minHeight: 220, display: "grid", placeItems: "center", color: "var(--t3)", fontSize: 13 }}>Loading this screen…</div>}>
        {open && <StockDetail key={open.at} symbol={open.symbol} account={account} onBack={closeStock} backTo={TABS.find(t => t.id === tab)?.label} onOpenStock={openSymbol} />}
        {/* Kept mounted (hidden) while a stock is open, so its filters and
            results are still there on Back. */}
        {tab === "discover" && <div hidden={!!open}><DiscoverView onOpenStock={openSymbol} theme={theme} onOpenNews={id => { setNewsOpen(id ?? null); goTab("explore"); }} /></div>}
        {!open && tab === "watchlist" && <WatchlistView onOpenStock={openSymbol} onOpenNews={id => { setNewsOpen(id); goTab("explore"); }} />}
        {!open && tab === "portfolio" && <PortfolioView onOpenStock={openSymbol} />}
        {!open && tab === "performance" && <PerformanceView onOpenStock={openSymbol} />}
        {!open && tab === "alerts" && <AlertsView onOpenStock={openSymbol} />}
        {/* Kept mounted (hidden) under a company page too, as Discover is: Back
            returns to the heat map or the news where they were */}
        {tab === "explore" && <div hidden={!!open}><ExploreView onOpenStock={openSymbol} openId={newsOpen} onOpened={() => setNewsOpen(null)} openIndexName={indexOpen} onIndexOpened={() => setIndexOpen(null)} /></div>}
        {!open && tab === "momentum" && account?.features?.momentum && <MomentumView onOpenStock={openSymbol} />}
        {!open && tab === "settings" && <SettingsView account={account} theme={theme} onToggleTheme={toggleTheme} onTab={goTab} onLogout={logout} onDeleted={accountDeleted} onTour={askForTour} />}
      </Suspense>
      <SiteFooter />
      {/* On a company page too: the tab it was opened from stays lit */}
      <BottomTabBar tab={tab} onTab={goTab} />
      {tour && <Tour key={tour} steps={tour === "app" ? APP_TOUR : STOCK_TOUR} onFinish={finishTour} />}
    </div>
  );
}
