import { useState, useEffect } from "react";
import { Smartphone } from "lucide-react";
import { api } from "./api.js";
import { SiteLink } from "./site.jsx";
import { preloadFirebase, signInWithProvider, sendPhoneCode, toE164 } from "./socialSignIn.js";

// The two companies' own marks, as their sign-in button guidelines ask
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);
const AppleLogo = () => (
  <svg width="15" height="18" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
  </svg>
);

const errorBox = { fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 8, padding: "8px 12px", lineHeight: 1.5 };
const socialBtn = { width: "100%", height: 42, gap: 10, fontSize: 14, fontWeight: 500 };

// Sign in with a phone number: the number, then the 6-digit SMS code
function PhoneSignIn({ config, onAuthed, onBack }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(null); // { confirm } once the SMS is sent
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async e => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try { setPending(await sendPhoneCode(config, phone, "phone-send")); setCode(""); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const verify = async e => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try { onAuthed((await pending.confirm(code)).userId); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <>
      <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--t1)", margin: "0 0 4px" }}>Continue with your phone</h2>
      {!pending ? (
        <>
          <p style={{ color: "var(--t3)", fontSize: 13, margin: "0 0 18px" }}>We'll text you a 6-digit code. Standard SMS rates may apply.</p>
          <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="input-base" style={{ width: 64, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t2)" }}>+91</span>
              <input className="input-base" type="tel" inputMode="tel" placeholder="Mobile number" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} required autoFocus />
            </div>
            <span style={{ fontSize: 11.5, color: "var(--t3)", marginTop: -4 }}>Outside India? Type the full number with its + code.</span>
            {error && <div style={errorBox}>{error}</div>}
            <button id="phone-send" type="submit" className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
          </form>
        </>
      ) : (
        <>
          <p style={{ color: "var(--t3)", fontSize: 13, margin: "0 0 18px" }}>Enter the code we sent to <strong style={{ color: "var(--t2)" }}>{toE164(phone)}</strong>.</p>
          <form onSubmit={verify} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input className="input-base" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6} pattern="\d{6}"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus style={{ letterSpacing: "0.3em", fontSize: 18, textAlign: "center" }} />
            {error && <div style={errorBox}>{error}</div>}
            <button type="submit" className="btn-primary" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify and continue"}</button>
            <button type="button" onClick={() => { setPending(null); setError(""); }}
              style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>
              Wrong number, or no SMS? Start again
            </button>
          </form>
        </>
      )}
      <button type="button" className="btn-ghost" style={{ marginTop: 14, width: "100%" }} onClick={onBack}>Other ways to sign in</button>
    </>
  );
}

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
  const [phoneMode, setPhoneMode] = useState(false);
  const [socialBusy, setSocialBusy] = useState(null);
  // What the server can offer: password reset needs email; Google / Apple /
  // phone need Firebase (its public web config comes with the answer)
  const [canReset, setCanReset] = useState(false);
  const [fb, setFb] = useState(null);
  useEffect(() => {
    api.authOptions().then(o => {
      setCanReset(!!o.passwordReset);
      if (o.firebase?.providers?.length) {
        setFb(o.firebase);
        preloadFirebase(o.firebase).catch(() => {});
      }
    }).catch(() => {});
  }, []);
  const signup = mode === "signup";
  const done = userId => { try { localStorage.setItem(RETURNING_KEY, "1"); } catch {} onAuthed(userId); };
  const card = children => (
    <div id="join" style={{ background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, padding: 24, boxShadow: "var(--sh-lg)", scrollMarginTop: 24 }}>{children}</div>
  );

  if (forgot) return card(<ForgotPassword initialEmail={email} onBack={() => setForgot(false)} />);
  if (phoneMode) return card(<PhoneSignIn config={fb} onAuthed={done} onBack={() => setPhoneMode(false)} />);

  const social = async which => {
    setError("");
    setSocialBusy(which);
    try { done((await signInWithProvider(fb, which)).userId); }
    catch (err) { if (!err.cancelled) setError(err.message); setSocialBusy(null); }
  };
  const has = p => fb?.providers.includes(p);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = signup ? await api.signup(email, password) : await api.login(email, password);
      done(result.userId);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return card(
    <>
      <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--t1)", margin: "0 0 4px" }}>
        {signup ? "Create your free account" : "Welcome back"}
      </h2>
      <p style={{ color: "var(--t3)", fontSize: 13, margin: "0 0 18px" }}>
        {signup ? "Takes a minute. No card needed." : "Sign in to your watchlist, alerts and portfolio."}
      </p>
      {fb && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {has("google") && (
            <button type="button" className="btn-ghost" style={socialBtn} disabled={!!socialBusy} onClick={() => social("google")}>
              <GoogleLogo /> {socialBusy === "google" ? "Opening Google…" : "Continue with Google"}
            </button>
          )}
          {has("apple") && (
            <button type="button" style={{ ...socialBtn, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--t1)", color: "var(--bg)", border: "1px solid var(--t1)", cursor: "pointer", fontFamily: "inherit" }} disabled={!!socialBusy} onClick={() => social("apple")}>
              <AppleLogo /> {socialBusy === "apple" ? "Opening Apple…" : "Continue with Apple"}
            </button>
          )}
          {has("phone") && (
            <button type="button" className="btn-ghost" style={socialBtn} disabled={!!socialBusy} onClick={() => { setError(""); setPhoneMode(true); }}>
              <Smartphone size={17} /> Continue with phone number
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 0", color: "var(--t3)", fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: "var(--bdr2)" }} /> or with email <span style={{ flex: 1, height: 1, background: "var(--bdr2)" }} />
          </div>
        </div>
      )}
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
    </>
  );
}
