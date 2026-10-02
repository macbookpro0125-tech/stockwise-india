import { useState, useEffect } from "react";

// The pages with their own web address: the front page, /privacy,
// /disclaimer and each stock page (/stock/TCS) — so they can be linked to,
// refreshed, and left with the browser's Back button. The tabs switch views
// without changing the address.

const NAVIGATE = "stockwise:navigate";

export function navigate(path, { replace = false, state = null } = {}) {
  if (path !== window.location.pathname) window.history[replace ? "replaceState" : "pushState"](state, "", path);
  window.dispatchEvent(new Event(NAVIGATE));
  window.scrollTo(0, 0);
}

// /stock/M%26M -> "M&M"; null for any other address
export function stockFromPath(path) {
  const m = /^\/stock\/([^/]+)\/?$/.exec(path);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).toUpperCase(); } catch { return null; }
}
export const stockPath = symbol => `/stock/${encodeURIComponent(symbol)}`;

export function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    window.addEventListener(NAVIGATE, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(NAVIGATE, update);
    };
  }, []);
  return path;
}

// A real link (it can be opened in a new tab or copied), handled in place on
// a plain click
export function SiteLink({ to, newTab = false, style, children }) {
  const onClick = e => {
    if (newTab || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={onClick} target={newTab ? "_blank" : undefined} rel={newTab ? "noreferrer" : undefined}
      style={{ color: "var(--t2)", textDecoration: "underline", textDecorationColor: "var(--bdr3)", textUnderlineOffset: 3, ...style }}>
      {children}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--bdr)", marginTop: 56, padding: "22px var(--page-x) 30px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 24px", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--t3)" }}>
        <span>Stockwise India · An educational tool, not investment advice</span>
        <nav style={{ display: "flex", gap: 18 }}>
          <SiteLink to="/disclaimer">Disclaimer</SiteLink>
          <SiteLink to="/privacy">Privacy</SiteLink>
        </nav>
      </div>
    </footer>
  );
}

export function Logo({ size = 17 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <img src="/stockwise-india-icon.svg" alt="" style={{ width: size * 1.9, height: size * 1.9, borderRadius: 9 }} />
      <span style={{ fontSize: size, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.03em" }}>
        Stock<span style={{ color: "var(--brand-wise)" }}>wise</span> <span style={{ color: "var(--t3)", fontWeight: 500 }}>India</span>
      </span>
    </span>
  );
}
