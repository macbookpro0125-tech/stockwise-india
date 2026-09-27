import { useState, useEffect, useRef } from "react";
import { api } from "./api.js";
import AuthForm from "./AuthForm.jsx";
import Header from "./Header.jsx";
import DiscoverView from "./DiscoverView.jsx";
import AlertsView from "./AlertsView.jsx";
import WatchlistView from "./WatchlistView.jsx";
import StockDetail from "./StockDetail.jsx";
import { resetWatchlist } from "./watchlist.js";

export default function App() {
  const [userId, setUserId] = useState(undefined); // undefined = checking, null = signed out
  const [tab, setTab] = useState("discover");
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

  const logout = () => api.logout().then(() => { resetWatchlist(); setUserId(null); });
  const goTab = (t) => { setOpen(null); setTab(t); window.scrollTo(0, 0); };

  return (
    <div>
      <Header tab={open ? null : tab} onTab={goTab} onLogout={logout} onSearch={openSymbol} />
      {open && <StockDetail key={open.at} symbol={open.symbol} onBack={closeStock} onOpenStock={openSymbol} />}
      {/* Kept mounted (hidden) while a stock is open, so its filters and
          results are still there on Back. */}
      {tab === "discover" && <div hidden={!!open}><DiscoverView onOpenStock={openSymbol} /></div>}
      {tab === "watchlist" && !open && <WatchlistView onOpenStock={openSymbol} />}
      {tab === "alerts" && !open && <AlertsView />}
    </div>
  );
}
