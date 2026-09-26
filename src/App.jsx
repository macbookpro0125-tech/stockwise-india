import { useState, useEffect } from "react";
import { api } from "./api.js";
import AuthForm from "./AuthForm.jsx";
import Header from "./Header.jsx";
import DiscoverView from "./DiscoverView.jsx";
import AlertsView from "./AlertsView.jsx";

export default function App() {
  const [userId, setUserId] = useState(undefined); // undefined = checking, null = signed out
  const [tab, setTab] = useState("discover");

  useEffect(() => {
    api.me().then(d => setUserId(d.userId)).catch(() => setUserId(null));
  }, []);

  if (userId === undefined) return null; // avoid a login-form flash while the session check is in flight

  if (userId === null) return <AuthForm onAuthed={setUserId} />;

  const logout = () => api.logout().then(() => setUserId(null));

  return (
    <div>
      <Header tab={tab} onTab={setTab} onLogout={logout} />
      {tab === "discover" ? <DiscoverView /> : <AlertsView />}
    </div>
  );
}
