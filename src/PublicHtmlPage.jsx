import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Logo, SiteFooter, navigate } from "./site.jsx";
import { useJoin, JoinCard, JoinBar } from "./PublicJoin.jsx";

// The server-written public pages (server/seo-pages.js: a company's
// financials, results and earnings calls, /explore and /news) shown as the
// server wrote them, so what search engines index and what people read are
// the same. The first visit uses the copy written into the page (main.jsx
// keeps it); moving here inside the app fetches it. Links inside stay in the
// app.
export const isPublicHtmlPath = path => path === "/explore" || path === "/news" || /^\/stock\/[^/]+\/(financials|earnings-call|results\/q[1-4]-fy\d\d)$/.test(path);

export default function PublicHtmlPage({ path, signedIn }) {
  const first = typeof window !== "undefined" && window.__PUBLIC_PAGE__?.path === path ? window.__PUBLIC_PAGE__ : null;
  const [page, setPage] = useState(first);
  const [error, setError] = useState("");
  const [join, box] = useJoin();
  useEffect(() => {
    if (page?.path === path) { document.title = page.title; return; }
    let live = true;
    setPage(null); setError("");
    api.publicPage(path).then(p => { if (live) { setPage(p); document.title = p.title; } }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  // a link to another of the site's pages opens in the app
  const onClick = e => {
    const a = e.target.closest?.("a");
    const href = a?.getAttribute("href");
    if (!href || !href.startsWith("/") || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    navigate(href);
    window.scrollTo(0, 0);
  };
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid var(--bdr)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <a href="/" onClick={e => { e.preventDefault(); navigate("/"); }} style={{ textDecoration: "none" }}><Logo /></a>
          <button className="btn-ghost" onClick={() => (signedIn ? navigate("/") : join(null, "signin"))} style={{ height: 34, fontSize: 12 }}>{signedIn ? "← Back to the app" : "Sign in"}</button>
        </div>
      </header>
      {error && <p className="nw-empty" style={{ padding: 20 }}>{error}</p>}
      {!page && !error && <div className="nw-skel" role="status" aria-label="Loading" style={{ padding: 20 }}>{[0, 1, 2].map(i => <span key={i} />)}</div>}
      {/* the server's own HTML (every value escaped there: seo-pages.js) */}
      {page && <div className="public-html" onClick={onClick} dangerouslySetInnerHTML={{ __html: page.body }} />}
      {page && !signedIn && (
        <div className="pj-wrap">
          <JoinCard title="Go further with a free account" onJoin={join} why="Create a free account to see each company's full analysis."
            points={["Every NSE company's 7 questions, answered from its filings", "Screens, a watchlist and price alerts", "Results and filings from the companies you follow"]} />
        </div>
      )}
      {!signedIn && <JoinBar label="Jocular Insights" why="Create a free account to see each company's full analysis." onJoin={join} />}
      {box}
      <SiteFooter />
    </div>
  );
}
