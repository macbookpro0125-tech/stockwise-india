import { useState, useEffect } from "react";
import { Smartphone, Mail, MailCheck, ChevronLeft, Eye, EyeOff } from "lucide-react";
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
const label = { display: "block", margin: "0 0 6px", fontSize: 12.5, fontWeight: 500, color: "var(--t2)" };

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
      <h2 className="auth-title">Continue with your phone</h2>
      {!pending ? (
        <>
          <p className="auth-sub">We'll text you a 6-digit code. Standard SMS rates may apply.</p>
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
          <p className="auth-sub">Enter the code we sent to <strong style={{ color: "var(--t2)" }}>{toE164(phone)}</strong>.</p>
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

// Sign-up or sign-in: the front page picks the mode (its "Sign in" and
// "Create free account" buttons); a browser that has signed in before opens
// on "Sign in".
const RETURNING_KEY = "stockwise-india-returning";

export function defaultAuthMode() {
  try { return localStorage.getItem(RETURNING_KEY) ? "login" : "signup"; } catch { return "signup"; }
}

// Keep the same confirmation for known and unknown addresses; it should not
// be possible to use the reset form to discover which emails have accounts.
function ForgotPassword({ initialEmail, onBack, available }) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try { await api.forgotPassword(email.trim()); setSent(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return (
    <>
      {available === false ? (
        <div className="auth-sent" role="status">
          <span className="auth-sent-icon"><Mail size={22} aria-hidden="true" /></span>
          <h2 className="auth-title">Reset email isn't set up yet</h2>
          <p className="auth-sub">Automated password resets aren't available right now. Email <a href="mailto:jocularinsights@gmail.com">jocularinsights@gmail.com</a> for help signing in.</p>
        </div>
      ) : sent ? (
        <div className="auth-sent" role="status" aria-live="polite">
          <span className="auth-sent-icon"><MailCheck size={22} aria-hidden="true" /></span>
          <h2 className="auth-title">Check your inbox</h2>
          <p className="auth-sub">
            If an account exists for <strong>{email.trim()}</strong>, we sent a password reset link. It works once and expires in one hour.
          </p>
          <p className="auth-help">Can't find it? Check your spam folder or try another address.</p>
          <button type="button" className="auth-link auth-link-centered" onClick={() => { setSent(false); setError(""); }}>
            Try a different email
          </button>
        </div>
      ) : (
        <>
          <h2 className="auth-title">Reset your password</h2>
          <p className="auth-sub">Enter the email linked to your account and we'll send you a secure reset link.</p>
          <form onSubmit={submit} className="auth-form">
            <div>
              <label htmlFor="auth-reset-email" style={label}>Email</label>
              <input id="auth-reset-email" className="input-base" type="email" placeholder="you@example.com" autoComplete="email" autoCapitalize="none" spellCheck="false" autoFocus value={email} onChange={e => { setEmail(e.target.value); if (error) setError(""); }} required />
            </div>
            {error && <div role="alert" style={errorBox}>{error}</div>}
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          </form>
        </>
      )}
      <button type="button" className="btn-ghost auth-back-full" onClick={onBack}>Back to sign in</button>
    </>
  );
}

// The sign-in flow inside the sign-in dialog (AuthDialog.jsx), in steps like
// a trading site's: first the ways in (Google, phone — whatever the server
// offers — and email), then the chosen one. With email the only way in, it
// opens straight on the email step.
// onProgress(0–1): how far along the form is, for the sky beside it
export default function AuthForm({ onAuthed, mode, onModeChange, onProgress }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("choose"); // "choose" | "email" | "phone" | "forgot"
  const [socialBusy, setSocialBusy] = useState(null);
  // What the server can offer: password reset needs email; Google / Apple /
  // phone need Firebase (its public web config comes with the answer)
  const [canReset, setCanReset] = useState(null);
  const [fb, setFb] = useState(null);
  useEffect(() => {
    api.authOptions().then(o => {
      setCanReset(!!o.passwordReset);
      // Inside the Android and iPhone apps Google and Apple refuse to sign in
      // through the app's web view (Google's "disallowed_useragent"), so the
      // app offers email (and phone) until they're added as native sign-ins
      const inApp = !!window.Capacitor?.isNativePlatform?.();
      const providers = (o.firebase?.providers ?? []).filter(p => !inApp || p === "phone");
      if (providers.length) {
        setFb({ ...o.firebase, providers });
        preloadFirebase(o.firebase).catch(() => {});
      }
    }).catch(() => setCanReset(false));
  }, []);
  const signup = mode === "signup";
  const hasChoices = !!fb?.providers?.length;
  const shown = step === "choose" && !hasChoices ? "email" : step;
  // email chosen, a real-looking address, a password that's long enough
  useEffect(() => {
    if (!onProgress) return;
    let v = shown === "choose" ? 0 : 0.2;
    if (shown === "email") {
      if (/^\S+@\S+\.\S+$/.test(email.trim())) v = 0.55;
      v += 0.45 * Math.min(1, password.length / 8);
    }
    onProgress(Math.min(1, v));
  }, [shown, email, password, onProgress]);
  const done = userId => { try { localStorage.setItem(RETURNING_KEY, "1"); } catch {} onAuthed(userId); };
  const back = () => { setStep("choose"); setError(""); };
  const Back = () => (
    <button type="button" className="auth-back" onClick={back}><ChevronLeft size={18} aria-hidden="true" /> Back</button>
  );
  const switchMode = (
    <p className="auth-switch">
      {signup ? "Already have an account?" : "New to Jocular Insights?"}{" "}
      <button type="button" onClick={() => { onModeChange(signup ? "login" : "signup"); setError(""); }}>{signup ? "Sign in" : "Create an account"}</button>
    </p>
  );

  if (shown === "forgot") return <div className="auth-step"><ForgotPassword initialEmail={email} available={canReset} onBack={() => { setStep("email"); setError(""); }} /></div>;
  if (shown === "phone") return <div className="auth-step"><PhoneSignIn config={fb} onAuthed={done} onBack={back} /></div>;

  const social = async which => {
    setError("");
    setSocialBusy(which);
    try { done((await signInWithProvider(fb, which)).userId); }
    catch (err) { if (!err.cancelled) setError(err.message); setSocialBusy(null); }
  };
  const has = p => fb?.providers.includes(p);

  if (shown === "choose") return (
    <div className="auth-step">
      <h2 className="auth-title">{signup ? "Create your account" : "Welcome back"}</h2>
      <p className="auth-sub">{signup ? "Free while in early access. No card needed." : "Your watchlist, alerts and portfolio are waiting."}</p>
      <div className="auth-choices">
        {has("google") && (
          <button type="button" className="auth-choice auth-choice-primary" disabled={!!socialBusy} onClick={() => social("google")}>
            <GoogleLogo /> {socialBusy === "google" ? "Opening Google…" : "Continue with Google"}
          </button>
        )}
        {has("apple") && (
          <button type="button" className="auth-choice" disabled={!!socialBusy} onClick={() => social("apple")}>
            <AppleLogo /> {socialBusy === "apple" ? "Opening Apple…" : "Continue with Apple"}
          </button>
        )}
        <button type="button" className="auth-choice" onClick={() => { setError(""); setStep("email"); }}>
          <Mail size={18} aria-hidden="true" /> Continue with email
        </button>
        {has("phone") && (
          <button type="button" className="auth-choice" disabled={!!socialBusy} onClick={() => { setError(""); setStep("phone"); }}>
            <Smartphone size={18} aria-hidden="true" /> Continue with phone number
          </button>
        )}
      </div>
      {error && <div style={{ ...errorBox, marginTop: 12 }}>{error}</div>}
      <p className="auth-legal">
        By continuing you agree to the <SiteLink to="/disclaimer" newTab>disclaimer</SiteLink> and <SiteLink to="/privacy" newTab>privacy policy</SiteLink>.
      </p>
      {switchMode}
    </div>
  );

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = signup ? await api.signup(email.trim(), password) : await api.login(email.trim(), password);
      done(result.userId);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-step">
      {hasChoices && <Back />}
      <h2 className="auth-title">{signup ? "Create your account" : "Welcome back"}</h2>
      <p className="auth-sub">{signup ? "Free while in early access. No card needed." : "Sign in with the email and password for your account."}</p>
      <form onSubmit={submit} className="auth-form">
        <div>
          <label htmlFor="auth-email" style={label}>Email</label>
          <input id="auth-email" className="input-base" type="email" placeholder="you@example.com" autoComplete="email" autoCapitalize="none" spellCheck="false" value={email} onChange={e => { setEmail(e.target.value); if (error) setError(""); }} required autoFocus />
        </div>
        <div>
          <label htmlFor="auth-password" style={label}>Password</label>
          <div className="auth-password">
            <input id="auth-password" className="input-base" type={showPassword ? "text" : "password"} placeholder={signup ? "8 or more characters" : ""} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 8 : undefined} value={password} onChange={e => { setPassword(e.target.value); if (error) setError(""); }} required />
            <button type="button" className="auth-eye" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {!signup && (
            <div className="auth-link-row">
              <button type="button" className="auth-link" onClick={() => { setStep("forgot"); setPassword(""); setShowPassword(false); setError(""); }}>Forgot password?</button>
            </div>
          )}
        </div>
        {error && <div role="alert" style={errorBox}>{error}</div>}
        <button type="submit" className="btn-primary auth-submit" disabled={busy}>
          {busy ? "Working…" : signup ? "Create free account" : "Sign in"}
        </button>
      </form>
      {signup && (
        <p className="auth-legal">
          By creating an account you agree to the <SiteLink to="/disclaimer" newTab>disclaimer</SiteLink> and <SiteLink to="/privacy" newTab>privacy policy</SiteLink>.
        </p>
      )}
      {switchMode}
    </div>
  );
}
