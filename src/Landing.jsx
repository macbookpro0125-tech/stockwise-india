import { useState, useEffect } from "react";
import { api } from "./api.js";
import AuthForm, { defaultAuthMode } from "./AuthForm.jsx";
import HowItWorks from "./HowItWorks.jsx";
import PriceStrip from "./PriceStrip.jsx";
import { SiteLink, SiteFooter, Logo } from "./site.jsx";

// The front page for visitors who aren't signed in: what the app does, the
// sign-up / sign-in card, the walkthrough video and the disclaimer. Every
// claim here is something the app does today — keep it that way (phone and
// email alerts are labelled as coming until they exist).

const FEATURES = [
  {
    title: "13 ready-made strategies",
    text: "Quality compounders, dividend payers, undervalued growth, Graham net-nets and more — or build your own from 99 metrics, each as a range.",
  },
  {
    title: "A quality score from the filings",
    text: "Out of 100 across six areas — business, earnings, balance sheet, governance, growth and valuation — from each company's results on NSE. What the filings can't show is listed, never guessed.",
  },
  {
    title: "Fair value and price levels",
    text: "A valuation reference from the company's own 5-year median P/E, plus three model price levels, a stop-loss level and an upper level. These are reference points, not trade instructions.",
  },
  {
    title: "The whole company on one page",
    text: "A research dashboard with every check explained, Piotroski score, price and financial charts, five quarters of shareholding, results, annual reports and news.",
  },
  {
    title: "Watchlist, alerts and portfolio",
    text: "Star stocks, set price alerts and record what you own — each holding shows its profit and where its price sits against its levels.",
    note: "Price alerts use the latest daily close. Telegram delivery requires server setup; SMS and email alerts aren't available yet.",
  },
  {
    title: "Compare, export, track",
    text: "Compare up to 5 companies side by side, build a sourced investment brief, download lists to Excel, and follow how strategy picks perform over time.",
  },
];

const STEPS = [
  ["Pick a strategy", "Start from one of 13 screens, or set your own filters. Results come back in seconds."],
  ["Check the company", "Open any result for its research dashboard — every check explained — fair value, charts and filings."],
  ["Decide your price", "Star it, set an alert at the price you want, or add it to your portfolio."],
];

// Laid out as TradingView's pages: flat sections split by hairlines, plain
// headings, no icon tiles, badges or floating cards
const card = { background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 4 };
const sectionTitle = { fontSize: 24, fontWeight: 700, color: "var(--t1)", margin: "0 0 6px" };
const sectionLead = { fontSize: 15, color: "var(--t2)", margin: "0 0 20px", lineHeight: 1.6 };

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function Landing({ onAuthed, notice }) {
  const [mode, setMode] = useState(defaultAuthMode);
  const [stats, setStats] = useState(null);
  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);

  // The header and hero buttons bring the card into view in the right mode
  const goAuth = m => {
    setMode(m);
    document.getElementById("join")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => document.getElementById("auth-email")?.focus({ preventScroll: true }), 400);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <PriceStrip />
      <header style={{ maxWidth: 1240, margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Logo />
        <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="landing-nav-extra"><HowItWorks label="How it works" style={{ height: 34 }} /></span>
          <button className="btn-ghost" onClick={() => goAuth("login")} style={{ height: 34, fontSize: 12 }}>Sign in</button>
          <button className="btn-primary landing-nav-extra" onClick={() => goAuth("signup")} style={{ height: 34, fontSize: 12, padding: "0 14px", boxShadow: "none" }}>Get started free</button>
        </nav>
      </header>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px" }}>
        {new URLSearchParams(window.location.search).has("screen") && (
          <div role="status" style={{ margin: "8px 0 0", padding: "10px 14px", borderRadius: 4, background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", color: "var(--t1)", fontSize: 13 }}>
            Someone shared a screen with you. Sign in or create a free account and it opens straight away.
          </div>
        )}
        {notice && (
          <div role="status" style={{ margin: "8px 0 0", padding: "10px 14px", borderRadius: 4, background: "var(--green-dim)", border: "1px solid var(--green-bdr)", color: "var(--t1)", fontSize: 13 }}>
            {notice}
          </div>
        )}

        {/* ── Hero ── */}
        <section className="landing-hero" style={{ padding: "48px 0 40px" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--t2)", margin: "0 0 12px" }}>
              For investors in NSE-listed companies
            </p>
            <h1 className="landing-h1" style={{ fontSize: 40, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--t1)", margin: "0 0 16px" }}>
              Find quality Indian companies — and the price where they turn good value.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--t2)", margin: "0 0 26px", maxWidth: 600 }}>
              Stockwise India reads each NSE-listed company's own filings, scores its quality out of 100, and works out three
              price levels below its fair value. Your watchlist, alerts and portfolio are measured against the same levels.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <button className="btn-primary" onClick={() => goAuth("signup")} style={{ height: 46 }}>Create free account</button>
              <HowItWorks label="Watch how it works · 2 min" style={{ height: 46, fontSize: 14, padding: "0 18px" }} />
            </div>
            <p style={{ fontSize: 12.5, color: "var(--t3)", margin: "14px 0 0" }}>Free during early access · No card needed</p>
          </div>
          <AuthForm onAuthed={onAuthed} mode={mode} onModeChange={setMode} />
        </section>

        {/* ── The product ── */}
        <section style={{ padding: "8px 0 40px" }}>
          <div style={{ ...card, overflow: "hidden" }}>
            <img
              src="/screens/discover.jpg" width="1280" height="800" loading="lazy"
              alt="The Discover screen: a strategy's results, each company with its quality score, research score, price, returns on capital and price levels"
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          </div>
          <p style={{ fontSize: 13, color: "var(--t3)", margin: "10px 0 0" }}>
            A strategy's results: every company scored, with its price levels and where today's price sits against them.
          </p>
        </section>

        {/* ── Figures ── */}
        <section className="landing-stats" style={{ padding: "0 0 48px", gap: 0, borderTop: "1px solid var(--bdr)", borderBottom: "1px solid var(--bdr)" }}>
          {[
            [stats?.companies ? stats.companies.toLocaleString("en-IN") : "—", "NSE companies scored"],
            [stats?.strategies ?? 13, "ready-made strategies"],
            [stats?.filters ?? "—", "filters to tune them"],
            [fmtDate(stats?.pricesDate), "latest prices"],
          ].map(([value, label]) => (
            <div key={label} className="landing-stat" style={{ padding: "16px 20px 16px 0" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--t1)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
              <div style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </section>

        {/* ── Features ── */}
        <section style={{ padding: "0 0 48px" }}>
          <h2 style={sectionTitle}>What's inside</h2>
          <p style={sectionLead}>Prices update each trading day; company financials refresh as new filings are published on NSE.</p>
          <div className="landing-features">
            {FEATURES.map(f => (
              <div key={f.title} style={{ padding: "18px 0", borderTop: "1px solid var(--bdr)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", margin: "0 0 6px" }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--t2)", margin: 0 }}>{f.text}</p>
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
              <div key={title} style={{ padding: "16px 0", borderTop: "2px solid var(--bdr2)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t3)", marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", margin: "0 0 6px" }}>{title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--t2)", margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <HowItWorks label="Watch the walkthrough · 2 min" style={{ height: 40, fontSize: 13 }} />
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <section style={{ ...card, padding: "20px 22px", borderColor: "var(--yellow-bdr)", background: "var(--yellow-dim)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 650, color: "var(--t1)", margin: "0 0 6px" }}>An educational tool, not investment advice</h2>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--t2)", margin: 0 }}>
            Stockwise India isn't registered with SEBI as an investment adviser or research analyst. Scores, fair values and
            price levels are worked out automatically from public data, can be wrong, and aren't recommendations to buy or
            sell. <SiteLink to="/disclaimer">Read the full disclaimer</SiteLink>.
          </p>
        </section>

        {/* ── Last call ── */}
        <section style={{ padding: "48px 0 8px" }}>
          <h2 style={sectionTitle}>Start with a strategy — it's free.</h2>
          <p style={{ ...sectionLead, margin: "0 0 20px" }}>No card needed during early access.</p>
          <button className="btn-primary" onClick={() => goAuth("signup")} style={{ height: 46 }}>Create free account</button>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
