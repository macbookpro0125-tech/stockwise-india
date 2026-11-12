import { useEffect, useState } from "react";
import { api } from "./api.js";
import { SiteFooter, navigate, PublicHeader } from "./site.jsx";
import { useJoin, JoinCard, JoinBar } from "./PublicJoin.jsx";

// The server-written public pages (server/seo-pages.js: a company's
// financials, results and earnings calls, /explore, /news and the /learn
// guides) shown as the
// server wrote them, so what search engines index and what people read are
// the same. The first visit uses the copy written into the page (main.jsx
// keeps it); moving here inside the app fetches it. Links inside stay in the
// app.
export const isPublicHtmlPath = path => path === "/explore" || path === "/news" || path === "/results" || /^\/learn(\/[a-z0-9-]+)?$/.test(path) || /^\/stock\/[^/]+\/(financials|earnings-call|results\/q[1-4]-fy\d\d)$/.test(path);

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
  // "Email me before X's next results" (results pages, 11 Nov 2026): signed
  // in, the company goes on the watchlist (the results reminder goes out the
  // evening before its board meeting); signed out, the sign-up box, then the same
  const [watched, setWatched] = useState(null);
  useEffect(() => { if (!watched) return; const t = setTimeout(() => setWatched(null), 3500); return () => clearTimeout(t); }, [watched]);
  const onClick = e => {
    const w = e.target.closest?.("[data-watch]");
    if (w) {
      const symbol = w.getAttribute("data-watch"), name = w.getAttribute("data-name") || symbol;
      // on the watchlist, and the results email on (an account without an
      // email address — a phone sign-up — gets the watchlist only)
      const add = async () => {
        await api.addWatch(symbol);
        const mail = await api.setResultsEmail(true).then(r => r.on).catch(() => false);
        setWatched({ name, mail });
      };
      if (signedIn) add().catch(() => {});
      else join(`Create a free account and we'll email you the evening before ${name}'s next results.`, "signup", add);
      return;
    }
    // a link to another of the site's pages opens in the app
    const a = e.target.closest?.("a");
    const href = a?.getAttribute("href");
    if (!href || !href.startsWith("/") || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    navigate(href);
    window.scrollTo(0, 0);
  };
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <PublicHeader signedIn={signedIn} onSignIn={() => join(null, "signin")} onJoin={() => join("Create a free account to see each company's full analysis.")} />
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
      {watched && <div className="pj-toast" role="status">{watched.mail ? `${watched.name} is on your watchlist. We'll email you the evening before its next results.` : `${watched.name} is on your watchlist.`}</div>}
      {box}
      <SiteFooter />
    </div>
  );
}
