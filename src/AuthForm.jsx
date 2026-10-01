import { useState, useEffect } from "react";
import { api } from "./api.js";
import { SiteLink } from "./site.jsx";

// Sign-up / sign-in card on the front page. The front page can switch the
// mode (its "Sign in" and "Create free account" buttons); a browser that has
// signed in before opens on "Sign in".
const RETURNING_KEY = "stockwise-india-returning";

export function defaultAuthMode() {
  try { return localStorage.getItem(RETURNING_KEY) ? "login" : "signup"; } catch { return "signup"; }
}

// "Forgot password?": the email box and, once sent, the same message whether
// or not the email has an account (the server answers alike)
function ForgotPassword({ initialEmail, onBack }) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try { await api.forgotPassword(email); setSent(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--t1)", margin: "0 0 4px" }}>Reset your password</h2>
      {sent ? (
        <p style={{ color: "var(--t2)", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 4px" }}>
          If an account exists for <strong>{email.trim()}</strong>, an email with a reset link is on its way. The link works once, for one hour — check your spam folder if it doesn't arrive.
        </p>
      ) : (
        <>
          <p style={{ color: "var(--t3)", fontSize: 13, margin: "0 0 18px" }}>We'll email you a link to choose a new one.</p>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input className="input-base" type="email" placeholder="Email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
            {error && <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 8, padding: "8px 12px" }}>{error}</div>}
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          </form>
        </>
      )}
      <button type="button" className="btn-ghost" style={{ marginTop: 14, width: "100%" }} onClick={onBack}>Back to sign in</button>
    </>
  );
}

export default function AuthForm({ onAuthed, mode, onModeChange }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  // Password reset is offered only where the server can send email
  const [canReset, setCanReset] = useState(false);
  useEffect(() => { api.authOptions().then(o => setCanReset(!!o.passwordReset)).catch(() => {}); }, []);
  const signup = mode === "signup";

  if (forgot) {
    return (
      <div id="join" style={{ background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, padding: 24, boxShadow: "var(--sh-lg)", scrollMarginTop: 24 }}>
        <ForgotPassword initialEmail={email} onBack={() => setForgot(false)} />
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = signup ? await api.signup(email, password) : await api.login(email, password);
      try { localStorage.setItem(RETURNING_KEY, "1"); } catch {}
      onAuthed(result.userId);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div id="join" style={{ background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, padding: 24, boxShadow: "var(--sh-lg)", scrollMarginTop: 24 }}>
      <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--t1)", margin: "0 0 4px" }}>
        {signup ? "Create your free account" : "Welcome back"}
      </h2>
      <p style={{ color: "var(--t3)", fontSize: 13, margin: "0 0 18px" }}>
        {signup ? "Takes a minute. No card needed." : "Sign in to your watchlist, alerts and portfolio."}
      </p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input id="auth-email" className="input-base" type="email" placeholder="Email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="input-base" type="password" placeholder={signup ? "Password (8+ characters)" : "Password"} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} required />
        {!signup && canReset && (
          <button type="button" onClick={() => { setForgot(true); setError(""); }}
            style={{ alignSelf: "flex-end", background: "none", border: "none", padding: 0, marginTop: -2, fontSize: 12.5, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>
            Forgot password?
          </button>
        )}
        {error && (
          <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 8, padding: "8px 12px" }}>
            {error}
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Working…" : signup ? "Create free account" : "Sign in"}
        </button>
      </form>
      {signup && (
        <p style={{ fontSize: 11.5, color: "var(--t3)", lineHeight: 1.6, margin: "12px 0 0" }}>
          By creating an account you agree to the <SiteLink to="/disclaimer" newTab>disclaimer</SiteLink> and <SiteLink to="/privacy" newTab>privacy policy</SiteLink>.
        </p>
      )}
      <button
        type="button"
        className="btn-ghost"
        style={{ marginTop: 14, width: "100%" }}
        onClick={() => { onModeChange(signup ? "login" : "signup"); setError(""); }}
      >
        {signup ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  );
}
