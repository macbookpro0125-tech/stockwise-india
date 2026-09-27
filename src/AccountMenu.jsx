import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { api } from "./api.js";
import { SiteLink } from "./site.jsx";

// The header's Account button: who's signed in, Sign out, and Delete account
// — the way to erase everything that the privacy page points to.
export default function AccountMenu({ email, onLogout, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const item = { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "9px 12px", borderRadius: 8, fontSize: 13, color: "var(--t1)", cursor: "pointer" };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn-ghost" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ height: 32, fontSize: 12, padding: "0 12px", whiteSpace: "nowrap" }}>
        Account ▾
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 240, zIndex: 200, background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 6, boxShadow: "var(--sh-lg)" }}>
          {email && (
            <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid var(--bdr)", marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: "var(--t3)" }}>Signed in as</div>
              <div style={{ fontSize: 13, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={email}>{email}</div>
            </div>
          )}
          <button role="menuitem" style={item} onClick={() => { setOpen(false); onLogout(); }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--s3)"; }} onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
            Sign out
          </button>
          <button role="menuitem" style={{ ...item, color: "var(--red)" }} onClick={() => { setOpen(false); setConfirming(true); }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--red-dim)"; }} onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
            Delete account…
          </button>
        </div>
      )}
      {/* Into <body>: the header's backdrop blur would otherwise make it the
          frame for this position: fixed popup and shut it inside the header */}
      {confirming && createPortal(<DeleteAccountModal email={email} onClose={() => setConfirming(false)} onDeleted={onDeleted} />, document.body)}
    </div>
  );
}

function DeleteAccountModal({ email, onClose, onDeleted }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.deleteAccount(password);
      onDeleted();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <form onSubmit={submit} style={{ background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, padding: 26, width: 420, maxWidth: "100%", boxShadow: "var(--sh-lg)" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>Delete your account?</h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--t2)", margin: "0 0 10px" }}>
          This permanently deletes <strong style={{ color: "var(--t1)" }}>{email || "your account"}</strong> and everything saved with it:
          your watchlist and its notes, your price alerts and your portfolio. It can't be undone.
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--t3)", margin: "0 0 16px" }}>
          Filters, saved strategies, company-page notes and search history live in this browser, not on our server — clear
          them in your browser's settings for this site. <SiteLink to="/privacy" newTab>Privacy policy</SiteLink>
        </p>
        <input className="input-base" type="password" placeholder="Your password, to confirm" autoComplete="current-password" autoFocus
          value={password} onChange={e => setPassword(e.target.value)} required />
        {error && (
          <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="submit" disabled={busy || !password}
            style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: busy || !password ? "var(--s4)" : "var(--red)", color: busy || !password ? "var(--t3)" : "#fff", fontSize: 14, fontWeight: 600, cursor: busy || !password ? "not-allowed" : "pointer" }}>
            {busy ? "Deleting…" : "Delete my account"}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy} style={{ flex: 1, height: 44 }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
