import { useState } from "react";
import { api } from "./api.js";
import HowItWorks from "./HowItWorks.jsx";

export default function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = mode === "login" ? await api.login(email, password) : await api.signup(email, password);
      onAuthed(result.userId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Stockwise India</h1>
      <p style={{ color: "var(--t2)", fontSize: 13, marginBottom: 28 }}>
        {mode === "login" ? "Sign in to your account" : "Create an account"}
      </p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && (
          <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 8, padding: "8px 12px" }}>
            {error}
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button
        className="btn-ghost"
        style={{ marginTop: 14, width: "100%" }}
        onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setError(""); }}
      >
        {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
      {/* For visitors deciding whether to sign up */}
      <HowItWorks label="▶ See how it works (2 min)" style={{ marginTop: 10, width: "100%", height: 40, fontSize: 13 }} />
    </div>
  );
}
