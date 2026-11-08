import { useState, useEffect, lazy, Suspense } from "react";
// lazily: HeroSearch imports navigate from here
const HeroSearchLazy = lazy(() => import("./HeroSearch.jsx"));

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

// /chart/TCS: a stock's price chart as a page of its own (ChartPage.jsx),
// which a phone opens in a new tab from the chart's expand button
export function chartFromPath(path) {
  const m = /^\/chart\/([^/]+)\/?$/.exec(path);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).toUpperCase(); } catch { return null; }
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

// The one disclaimer line under every page (pages don't repeat it above).
// 26 Oct 2026, "can we organise this or reduce it": one short line — the
// trademark notice is on the Disclaimer page, a tap away — then the links in
// two quiet rows: the help and legal pages, and the site's public pages (which
// the app's own tabs cover, so the app leaves that row out: index.css)
const FOOT_LINK = { color: "var(--t3)", textDecoration: "none" };
export function SiteFooter() {
  return (
    <footer className="site-foot">
      <p className="site-foot-line">Not investment advice. Consult a SEBI-registered adviser · Data from NSE filings and daily closes</p>
      <nav className="site-foot-links" aria-label="About Jocular Insights">
        <SiteLink to="/help" style={FOOT_LINK}>Help</SiteLink>
        <SiteLink to="/learn" style={FOOT_LINK}>Learn</SiteLink>
        <SiteLink to="/methodology" style={FOOT_LINK}>Methodology</SiteLink>
        <SiteLink to="/about" style={FOOT_LINK}>About</SiteLink>
        <SiteLink to="/disclaimer" style={FOOT_LINK}>Disclaimer</SiteLink>
        <SiteLink to="/privacy" style={FOOT_LINK}>Privacy</SiteLink>
      </nav>
      <nav className="site-foot-links site-foot-public" aria-label="On the website">
        <SiteLink to="/stock-screener-india" style={FOOT_LINK}>Stock screener</SiteLink>
        <SiteLink to="/screens" style={FOOT_LINK}>Screens</SiteLink>
        <SiteLink to="/sectors" style={FOOT_LINK}>Sectors</SiteLink>
        <SiteLink to="/lists" style={FOOT_LINK}>Stock lists</SiteLink>
        <SiteLink to="/results-calendar" style={FOOT_LINK}>Results calendar</SiteLink>
        <SiteLink to="/results" style={FOOT_LINK}>Latest results</SiteLink>
      </nav>
    </footer>
  );
}

// The app's logo inside the app (21 Oct 2026): the glass JI as a picture
// drawn at 192 px (scripts/brand-assets.mjs) — sharp on a 3× phone up to
// 64 px, where Safari blurred the SVG's lighting — dark, or the light one in
// the light theme (index.css .brand-mark). theme="dark" pins the dark one
// (the front page's story is always dark).
// size null: the size comes from className (the header's: bigger on a phone)
export function BrandMark({ size = 32, theme, className = "" }) {
  const box = size ? { width: size, height: size } : undefined;
  return (
    <span className={`brand-mark${theme === "dark" ? " brand-mark-dark-only" : ""} ${className}`.trim()} style={box}>
      <img className="bm-dark" src="/jocular-insights-dark.png" alt="" />
      <img className="bm-light" src="/jocular-insights-light.png" alt="" />
    </span>
  );
}

// The public pages' header (8 Nov 2026, a review: "a stock site needs a
// search box at the top … no sign-up button"): the logo, the site's main
// pages, a company search, and Sign in / Create free account (or back to
// the app when signed in). A phone: the logo and the buttons, then the
// search, then the pages as a row to swipe.
const PUB_NAV = [["/screens", "Screens"], ["/sectors", "Sectors"], ["/results", "Results"], ["/lists", "Stock lists"], ["/learn", "Learn"]];
export function PublicHeader({ signedIn, onSignIn, onJoin }) {
  const here = typeof window !== "undefined" ? window.location.pathname : "";
  const go = to => e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); navigate(to); window.scrollTo(0, 0); };
  return (
    <header className="pub-head">
      <div className="pub-head-in">
        <a href="/" onClick={go("/")} className="pub-logo" aria-label="Jocular Insights, home"><Logo /></a>
        <nav className="pub-nav" aria-label="Main pages">
          {PUB_NAV.map(([to, label]) => <a key={to} href={to} onClick={go(to)} aria-current={here === to || here.startsWith(`${to}/`) ? "page" : undefined}>{label}</a>)}
        </nav>
        <Suspense fallback={<span className="pub-search" />}><HeroSearchLazy className="pub-search" compact /></Suspense>
        <div className="pub-acts">
          {signedIn
            ? <button type="button" className="btn-ghost pub-btn" onClick={() => navigate("/")}>Back to the app</button>
            : <>
              <button type="button" className="btn-ghost pub-btn" onClick={() => (onSignIn ? onSignIn() : navigate("/?auth=login"))}>Sign in</button>
              <button type="button" className="btn-primary pub-btn" onClick={() => (onJoin ? onJoin() : navigate("/?auth=signup"))}><span className="pub-long">Create free account</span><span className="pub-short">Join free</span></button>
            </>}
        </div>
      </div>
    </header>
  );
}

export function Logo({ size = 17 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <BrandMark size={Math.round(size * 1.9)} />
      <span style={{ fontSize: size, fontWeight: 500, color: "var(--t1)", letterSpacing: "-0.03em" }}>
        Jocular <span style={{ color: "var(--brand-wise)", fontWeight: 400 }}>Insights</span>
      </span>
    </span>
  );
}
