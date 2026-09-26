import { useState, useEffect } from "react";
import { api } from "./api.js";
import AuthForm from "./AuthForm.jsx";
import AlertsView from "./AlertsView.jsx";

export default function App() {
  const [userId, setUserId] = useState(undefined); // undefined = checking, null = signed out

  useEffect(() => {
    api.me().then(d => setUserId(d.userId)).catch(() => setUserId(null));
  }, []);

  if (userId === undefined) return null; // avoid a login-form flash while the session check is in flight

  if (userId === null) return <AuthForm onAuthed={setUserId} />;

  return <AlertsView onLogout={() => api.logout().then(() => setUserId(null))} />;
}
