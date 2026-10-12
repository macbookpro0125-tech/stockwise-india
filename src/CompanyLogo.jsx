import { useState, useEffect } from "react";

// A company's logo, small, from this server (/api/logo, server/logos.js).
// Logos can be switched off from the Account menu; the choice is kept in this
// browser. A company with no logo shows nothing — or, where `slot` keeps a
// list's names lined up, an empty space of the same size.
const KEY = "stockwise-india-logos";
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

// Symbols whose logo failed this session, so lists don't ask again
const missing = new Set();

export default function CompanyLogo({ symbol, size = 20, slot = false }) {
  const on = useLogosShown();
  const [failed, setFailed] = useState(() => missing.has(symbol));
  useEffect(() => { setFailed(missing.has(symbol)); }, [symbol]);
  if (!on || !symbol) return null;
  const box = { width: size, height: size, flex: "0 0 auto", borderRadius: Math.round(size / 4) };
  if (failed) return slot ? <span aria-hidden="true" style={{ ...box, display: "inline-block" }} /> : null;
  return (
    <img src={`/api/logo/${encodeURIComponent(symbol)}`} alt="" width={size} height={size} loading="lazy" decoding="async"
      onError={() => { missing.add(symbol); setFailed(true); }}
      style={{ ...box, objectFit: "contain", background: "#fff", border: "1px solid var(--bdr)", display: "inline-block" }} />
  );
}
