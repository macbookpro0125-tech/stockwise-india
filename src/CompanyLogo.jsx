import { useState, useEffect } from "react";
import { initials } from "./stockName.js";
import { imageLooksVisible } from "./logoInk.js";

// A company's logo, small, from this server (/api/logo, server/logos.js).
// Logos can be switched off from the Account menu; the choice is kept in this
// browser. A company with no logo shows nothing — or, where `slot` keeps a
// list's names lined up, an empty space of the same size; or, given
// `fallback` (the company's name), a tile with its letters, so a list card
// always has its company's mark (the phone's stock cards).
const KEY = "stockwise-india-logos";
// Logo files are backfilled while the app is running; version the image URL
// with this build date so a previous cached 404 cannot hide a newly added logo.
const LOGO_VERSION = typeof __BUILD_DATE__ === "undefined" ? "dev" : __BUILD_DATE__;
const logoSrc = symbol => `/api/logo/${encodeURIComponent(symbol)}?v=${encodeURIComponent(LOGO_VERSION)}`;
const listeners = new Set();
let shown = (() => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } })();

export function logosShown() { return shown; }
export function setLogosShown(on) {
  shown = on;
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
  listeners.forEach(fn => fn(on));
}
export function useLogosShown() {
  const [on, setOn] = useState(shown);
  useEffect(() => { listeners.add(setOn); return () => listeners.delete(setOn); }, []);
  return on;
}

// The server hands logos to signed-in readers only (http-server.js), so a
// signed-out page (the public company page, the results calendar) shows the
// letters without asking — and nothing is asked until App knows which it is
let signedIn;
const authListeners = new Set();
export function setLogosSignedIn(on) {
  if (signedIn === on) return;
  signedIn = on;
  authListeners.forEach(fn => fn(on));
}
function useSignedIn() {
  const [on, setOn] = useState(signedIn);
  useEffect(() => { authListeners.add(setOn); setOn(signedIn); return () => authListeners.delete(setOn); }, []);
  return on === true;
}

// Symbols whose logo failed this session, so lists don't ask again
const missing = new Set();

export default function CompanyLogo({ symbol, size = 20, slot = false, fallback = null }) {
  const shownByUser = useLogosShown();
  const on = useSignedIn() && shownByUser;
  const [failed, setFailed] = useState(() => missing.has(symbol));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setFailed(missing.has(symbol)); setLoaded(false); }, [symbol]);
  // a logo that failed, or loaded but wouldn't show on the white tile
  // (logoInk.js: blank or banner-shaped) — the letters instead
  const drop = () => { missing.add(symbol); setFailed(true); };
  const box = { width: size, height: size, flex: "0 0 auto", borderRadius: Math.round(size / 4) };
  // With a fallback: the letters first, the logo over them only once it has
  // loaded — no blank white square while it comes, or if it never does
  if (fallback != null) {
    return (
      <span aria-hidden="true" style={{ ...box, position: "relative", display: "inline-block" }}>
        <span className="logo-tile" style={{ ...box, fontSize: Math.round(size * 0.36) }}>{initials(fallback)}</span>
        {on && symbol && !failed && (
          <img src={logoSrc(symbol)} alt="" width={size} height={size} loading="lazy" decoding="async"
            onLoad={e => (imageLooksVisible(e.currentTarget) ? setLoaded(true) : drop())} onError={drop}
            style={{ ...box, position: "absolute", inset: 0, objectFit: "contain", background: "#fff", border: "1px solid var(--bdr)", opacity: loaded ? 1 : 0, transition: "opacity 160ms ease" }} />
        )}
      </span>
    );
  }
  if (!on || !symbol) return null;
  if (failed) return slot ? <span aria-hidden="true" style={{ ...box, display: "inline-block" }} /> : null;
  return (
    <img src={logoSrc(symbol)} alt="" width={size} height={size} loading="lazy" decoding="async"
      onLoad={e => { if (!imageLooksVisible(e.currentTarget)) drop(); }} onError={drop}
      style={{ ...box, objectFit: "contain", background: "#fff", border: "1px solid var(--bdr)", display: "inline-block" }} />
  );
}
