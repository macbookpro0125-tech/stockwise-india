import { useState, useEffect } from "react";

// The few pages with their own web address: the front page, /privacy and
// /disclaimer — so they can be linked to and shared. The app itself switches
// views without changing the address.

const NAVIGATE = "stockwise:navigate";

export function navigate(path) {
  if (path !== window.location.pathname) window.history.pushState(null, "", path);
  window.dispatchEvent(new Event(NAVIGATE));
  window.scrollTo(0, 0);
}

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
    <footer style={{ borderTop: "1px solid var(--bdr)", marginTop: 56, padding: "22px 20px 30px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "10px 24px", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--t3)" }}>
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
