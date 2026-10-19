import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { api } from "./api.js";
import { Logo, navigate } from "./site.jsx";

// /reset-password?token=… — the page a reset email links to. A new password
// signs the account out everywhere else and in here (server/auth.js).
export default function ResetPassword({ onDone }) {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const expired = /expired|already used/i.test(error);

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

  const backToSignIn = e => {
    e?.preventDefault?.();
    navigate("/?auth=login");
  };

  return (
    <main className="reset-page">
      <div className="reset-wrap">
        <a href="/" onClick={e => { e.preventDefault(); navigate("/"); }} className="reset-brand"><Logo /></a>
        <section className="reset-card" aria-labelledby="reset-title">
          <span className="reset-icon"><KeyRound size={21} aria-hidden="true" /></span>
          <h1 id="reset-title" className="reset-title">{token ? "Choose a new password" : "This reset link is incomplete"}</h1>
          {token ? (
            <>
              <p className="reset-copy">Use at least 8 characters. We'll sign out any other devices when you save it.</p>
              <form onSubmit={submit} className="reset-form">
                <div>
                  <label htmlFor="reset-password" style={{ display: "block", margin: "0 0 6px", fontSize: 12.5, fontWeight: 500, color: "var(--t2)" }}>New password</label>
                  <div className="auth-password">
                    <input id="reset-password" className="input-base" type={showPasswords ? "text" : "password"} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} value={password} onChange={e => { setPassword(e.target.value); if (error) setError(""); }} required autoFocus />
                    <button type="button" className="auth-eye" onClick={() => setShowPasswords(v => !v)} aria-label={showPasswords ? "Hide passwords" : "Show passwords"} aria-pressed={showPasswords}>
                      {showPasswords ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="reset-confirm" style={{ display: "block", margin: "0 0 6px", fontSize: 12.5, fontWeight: 500, color: "var(--t2)" }}>Confirm new password</label>
                  <input id="reset-confirm" className="input-base" type={showPasswords ? "text" : "password"} placeholder="Enter it again" autoComplete="new-password" minLength={8} value={confirm} onChange={e => { setConfirm(e.target.value); if (error) setError(""); }} required />
                </div>
                {error && <div role="alert" style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 8, padding: "8px 12px", lineHeight: 1.5 }}>{error}</div>}
                <button type="submit" className="btn-primary reset-submit" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
              </form>
              {expired && <button type="button" className="reset-back" onClick={backToSignIn}>Request a new reset link</button>}
            </>
          ) : (
            <>
              <p className="reset-copy">Open the link from your reset email again, or request a new one from the sign-in page.</p>
              <button type="button" className="btn-primary reset-submit" onClick={backToSignIn}>Return to sign in</button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
