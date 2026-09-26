import { useState, useEffect } from "react";
import { api } from "./api.js";
import AuthForm from "./AuthForm.jsx";
import Header from "./Header.jsx";
import DiscoverView from "./DiscoverView.jsx";
import AlertsView from "./AlertsView.jsx";
import StockDetail from "./StockDetail.jsx";

export default function App() {
  const [userId, setUserId] = useState(undefined); // undefined = checking, null = signed out
  const [tab, setTab] = useState("discover");
  // { symbol, at } rather than a bare symbol: searching the same symbol again
  // (e.g. retrying after an error) must re-fetch, and an unchanged string
  // wouldn't re-render at all.
  const [open, setOpen] = useState(null);
  const openSymbol = (symbol) => setOpen({ symbol, at: Date.now() });

  useEffect(() => {
    api.me().then(d => setUserId(d.userId)).catch(() => setUserId(null));
  }, []);

  if (userId === undefined) return null; // avoid a login-form flash while the session check is in flight

  if (userId === null) return <AuthForm onAuthed={setUserId} />;

  const logout = () => api.logout().then(() => setUserId(null));
  const goTab = (t) => { setOpen(null); setTab(t); };

  return (
    <div>
      <Header tab={open ? null : tab} onTab={goTab} onLogout={logout} onSearch={openSymbol} />
      {open
        ? <StockDetail key={open.at} symbol={open.symbol} onBack={() => setOpen(null)} />
        : tab === "discover" ? <DiscoverView onOpenStock={openSymbol} /> : <AlertsView />}
    </div>
  );
}
