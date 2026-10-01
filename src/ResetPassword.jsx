import { useState } from "react";
import { api } from "./api.js";
import { Logo, navigate } from "./site.jsx";

// /reset-password?token=… — the page a reset email links to. A new password
// signs the account out everywhere else and in here (server/auth.js).
export default function ResetPassword({ onDone }) {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <a href="/" onClick={e => { e.preventDefault(); navigate("/"); }} style={{ display: "inline-block", textDecoration: "none", marginBottom: 22 }}><Logo /></a>
        <div style={{ background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, padding: 24, boxShadow: "var(--sh-lg)" }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--t1)", margin: "0 0 4px" }}>Choose a new password</h1>
          {token ? (
            <>
              <p style={{ color: "var(--t3)", fontSize: 13, margin: "0 0 18px" }}>You'll be signed out on every other device.</p>
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input className="input-base" type="password" placeholder="New password (8+ characters)" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
                <input className="input-base" type="password" placeholder="The same again" autoComplete="new-password" minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} required />
                {error && <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 8, padding: "8px 12px", lineHeight: 1.5 }}>{error}</div>}
                <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save and sign in"}</button>
              </form>
            </>
          ) : (
            <p style={{ color: "var(--t2)", fontSize: 13.5, lineHeight: 1.6, margin: "8px 0 0" }}>
              This link is incomplete. Open the link from the email again, or ask for a new one from the sign-in page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
