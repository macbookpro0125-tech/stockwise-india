import { useState, useEffect } from "react";
import { api } from "./api.js";
import AuthDialog from "./AuthDialog.jsx";
import HowItWorks from "./HowItWorks.jsx";
import PriceStrip from "./PriceStrip.jsx";
import { SiteLink, SiteFooter } from "./site.jsx";
import StarFilm from "./StarFilm.jsx";

// The front page for visitors who aren't signed in: the scroll film at the
// top (StarFilm, with its own bar and buttons), then what the app does,
// the walkthrough video and the disclaimer. Sign-in is a dialog (AuthDialog).
// Every claim here is something the app does today — keep it that way (phone
// and email alerts are labelled as coming until they exist).

const Icon = ({ children }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const FEATURES = [
  {
    icon: <Icon><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></Icon>,
    title: "Ready-made strategies",
    text: "Quality compounders, dividend payers, undervalued growth, Graham net-nets and more — or build your own from every metric, each as a range.",
  },
  {
    icon: <Icon><path d="M12 3l7 3v6c0 4.4-3 7.5-7 9-4-1.5-7-4.6-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></Icon>,
    title: "A quality score from the filings",
    text: "Out of 100 across six areas — business, earnings, balance sheet, governance, growth and valuation — from each company's results on NSE. What the filings can't show is listed, never guessed.",
  },
  {
    icon: <Icon><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></Icon>,
    title: "Fair value and price levels",
    text: "Fair value uses normalized earnings and the company's own 5-year median P/E, capped at twice its sector's median when it runs far above its peers. Banks use book value. Model price levels are reference points, not trade instructions.",
  },
  {
    icon: <Icon><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></Icon>,
    title: "The whole company on one page",
    text: "A research dashboard with every check explained, Piotroski score, price and financial charts, five quarters of shareholding, results, annual reports and news.",
  },
  {
    icon: <Icon><path d="M6 16v-5a6 6 0 1112 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 004 0" /></Icon>,
    title: "Watchlist, alerts and portfolio",
    text: "Star stocks, set price alerts and record what you own — each holding shows its profit and where its price sits against its levels.",
    note: "Price alerts use the latest daily close. Telegram delivery requires server setup; SMS and email alerts aren't available yet.",
  },
  {
    icon: <Icon><path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" /></Icon>,
    title: "Compare, export, track",
    text: "Compare up to 5 companies side by side, build a sourced investment brief, download lists to Excel, and follow how strategy picks perform over time.",
  },
];

const STEPS = [
  ["Pick a strategy", "Start from a ready-made screen, or set your own filters. Results come back in seconds."],
  ["Check the company", "Open any result for its research dashboard — every check explained — fair value, charts and filings."],
  ["Decide your price", "Star it, set an alert at the price you want, or add it to your portfolio."],
];

const card = { background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 16 };
const sectionTitle = { fontSize: 26, fontWeight: 500, letterSpacing: "-0.03em", color: "var(--t1)", margin: "0 0 8px" };
const sectionLead = { fontSize: 15, color: "var(--t2)", margin: "0 0 24px", lineHeight: 1.6 };

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function Landing({ onAuthed, notice }) {
  // The sign-in dialog: "login", "signup", or closed
  const [auth, setAuth] = useState(() => new URLSearchParams(window.location.search).get("auth") === "login" ? "login" : null);
  const [stats, setStats] = useState(null);
  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);

  // The header and hero buttons open the sign-in dialog in the right mode
  const goAuth = m => setAuth(m);
  const closeAuth = () => {
    setAuth(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("auth")) {
      url.searchParams.delete("auth");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  };

  return (
    <div id="top" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {(new URLSearchParams(window.location.search).has("screen") || notice) && <div className="landing-notices">
        {new URLSearchParams(window.location.search).has("screen") && <div role="status" style={{ margin: "8px auto 0", maxWidth: 1240, padding: "10px 14px", borderRadius: 10, background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", color: "var(--t1)", fontSize: 13 }}>Someone shared a screen with you. Sign in or create a free account and it opens straight away.</div>}
        {notice && <div role="status" style={{ margin: "8px auto 0", maxWidth: 1240, padding: "10px 14px", borderRadius: 10, background: "var(--green-dim)", border: "1px solid var(--green-bdr)", color: "var(--t1)", fontSize: 13 }}>{notice}</div>}
      </div>}
      {/* Kept, either can go back here: DomeFilm.jsx (the dome picture film), and
          CinematicStory.jsx (+ ./story-colours.css), the earlier scroll story */}
      <StarFilm onJoin={() => goAuth("signup")} onLogin={() => goAuth("login")} stats={stats} />
      <PriceStrip />
      {auth && <AuthDialog mode={auth} onModeChange={setAuth} onAuthed={onAuthed} onClose={closeAuth} />}
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 20px 0" }}>
        {/* ── The product ── */}
        <section id="product-preview" style={{ padding: "8px 0 40px", scrollMarginTop: 24 }}>
          <div style={{ ...card, overflow: "hidden", boxShadow: "var(--sh-lg)" }}>
            <div style={{ display: "flex", gap: 6, padding: "10px 14px", borderBottom: "1px solid var(--bdr)", background: "var(--s2)" }}>
              {["#FF5F57", "#FEBC2E", "#28C840"].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.8 }} />)}
            </div>
            <img
              src="/screens/discover.jpg" width="1280" height="800" loading="lazy"
              alt="The Discover screen: a strategy's results, each company with its quality and research scores, price, P/E and returns on capital"
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          </div>
          <p style={{ fontSize: 12.5, color: "var(--t3)", textAlign: "center", margin: "12px 0 0" }}>
            A strategy's results: every company scored, with its price levels and where today's price sits against them.
          </p>
        </section>

        {/* ── Figures ── */}
        <section className="landing-stats" style={{ padding: "0 0 48px" }}>
          {[
            [stats?.companies ? stats.companies.toLocaleString("en-IN") : "—", "NSE companies scored"],
            [stats?.strategies ?? "—", "ready-made strategies"],
            [stats?.filters ?? "—", "filters to tune them"],
            [fmtDate(stats?.pricesDate), "latest prices"],
          ].map(([value, label]) => (
            <div key={label} style={{ ...card, padding: "18px 20px" }}>
              <div style={{ fontSize: 26, fontWeight: 550, color: "var(--accent)", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
              <div style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </section>

        {/* ── Features ── */}
        <section id="research-features" style={{ padding: "0 0 48px", scrollMarginTop: 24 }}>
          <h2 style={sectionTitle}>What's inside</h2>
          <p style={sectionLead}>Prices update each trading day; company financials refresh as new filings are published on NSE.</p>
          <div className="landing-features">
            {FEATURES.map(f => (
              <div key={f.title} style={{ ...card, padding: 22 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 15.5, fontWeight: 450, color: "var(--t1)", margin: "0 0 6px", letterSpacing: "-0.01em" }}>{f.title}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--t2)", margin: 0 }}>{f.text}</p>
                {f.note && <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--t3)", margin: "8px 0 0" }}>{f.note}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section style={{ padding: "0 0 48px" }}>
          <h2 style={sectionTitle}>How it works</h2>
          <p style={sectionLead}>Three steps — or watch the two-minute walkthrough.</p>
          <div className="landing-steps">
            {STEPS.map(([title, text], i) => (
              <div key={title} style={{ ...card, padding: 22 }}>
                <div style={{ width: 30, height: 30, borderRadius: 15, background: "var(--accent)", color: "var(--on-accent)", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{i + 1}</div>
                <h3 style={{ fontSize: 15.5, fontWeight: 450, color: "var(--t1)", margin: "0 0 6px" }}>{title}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--t2)", margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <HowItWorks label="Watch the walkthrough · 2 min" style={{ height: 40, fontSize: 13 }} />
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <section style={{ ...card, padding: "20px 22px", borderColor: "var(--yellow-bdr)", background: "var(--yellow-dim)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 450, color: "var(--t1)", margin: "0 0 6px" }}>An educational tool, not investment advice</h2>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--t2)", margin: 0 }}>
            Jocular Insights isn't registered with SEBI as an investment adviser or research analyst. Scores, fair values and
            price levels are worked out automatically from public data, can be wrong, and aren't recommendations to buy or
            sell. <SiteLink to="/disclaimer">Read the full disclaimer</SiteLink>.
          </p>
        </section>

        {/* ── Last call ── */}
        <section style={{ textAlign: "center", padding: "56px 0 8px" }}>
          <h2 style={{ ...sectionTitle, fontSize: 28 }}>Start with a strategy — it's free.</h2>
          <p style={{ ...sectionLead, margin: "0 0 20px" }}>No card needed during early access.</p>
          <button className="btn-primary" onClick={() => goAuth("signup")} style={{ height: 46 }}>Create free account</button>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
