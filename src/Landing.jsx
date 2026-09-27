import { useState, useEffect } from "react";
import { api } from "./api.js";
import AuthForm, { defaultAuthMode } from "./AuthForm.jsx";
import HowItWorks from "./HowItWorks.jsx";
import { SiteLink, SiteFooter, Logo } from "./site.jsx";

// The front page for visitors who aren't signed in: what the app does, the
// sign-up / sign-in card, the walkthrough video and the disclaimer. Every
// claim here is something the app does today — keep it that way (phone and
// email alerts are labelled as coming until they exist).

const Icon = ({ children }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const FEATURES = [
  {
    icon: <Icon><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></Icon>,
    title: "13 ready-made strategies",
    text: "Quality compounders, dividend payers, undervalued growth, Graham net-nets and more — or set your own with 19 filters.",
  },
  {
    icon: <Icon><path d="M12 3l7 3v6c0 4.4-3 7.5-7 9-4-1.5-7-4.6-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></Icon>,
    title: "A quality score from the filings",
    text: "10 checks on growth, return on capital, debt, cash conversion, promoter holding and price, from each company's latest results on NSE.",
  },
  {
    icon: <Icon><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></Icon>,
    title: "Three buy prices, worked out",
    text: "Fair value from the company's own 5-year median P/E, then Phase 1, 2 and 3 buy prices below it, with a stop loss and a target.",
  },
  {
    icon: <Icon><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></Icon>,
    title: "The whole company on one page",
    text: "A 10-point checklist, Piotroski score, price and financial charts, five quarters of shareholding, results, annual reports and news.",
  },
  {
    icon: <Icon><path d="M6 16v-5a6 6 0 1112 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 004 0" /></Icon>,
    title: "Watchlist, alerts and portfolio",
    text: "Star stocks, set price alerts and record what you own — each holding shows its profit and where it sits on its buy ladder.",
    note: "Alerts show in the app for now; phone and email alerts are coming.",
  },
  {
    icon: <Icon><path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" /></Icon>,
    title: "Compare, export, track",
    text: "Put up to 4 companies side by side, download any list to Excel, and follow how each strategy's picks perform over time.",
  },
];

const STEPS = [
  ["Pick a strategy", "Start from one of 13 screens, or set your own filters. Results come back in seconds."],
  ["Check the company", "Open any result for its score, checklist, fair value, charts and filings."],
  ["Decide your price", "Star it, set an alert at the price you want, or add it to your portfolio."],
];

const card = { background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 16 };
const sectionTitle = { fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--t1)", margin: "0 0 8px" };
const sectionLead = { fontSize: 15, color: "var(--t2)", margin: "0 0 24px", lineHeight: 1.6 };

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
      <header style={{ maxWidth: 1240, margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Logo />
        <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="landing-nav-extra"><HowItWorks label="▶ How it works" style={{ height: 34 }} /></span>
          <button className="btn-ghost" onClick={() => goAuth("login")} style={{ height: 34, fontSize: 12 }}>Sign in</button>
          <button className="btn-primary landing-nav-extra" onClick={() => goAuth("signup")} style={{ height: 34, fontSize: 12, padding: "0 14px", boxShadow: "none" }}>Get started free</button>
        </nav>
      </header>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px" }}>
        {notice && (
          <div role="status" style={{ margin: "8px 0 0", padding: "10px 14px", borderRadius: 10, background: "var(--green-dim)", border: "1px solid var(--green-bdr)", color: "var(--t1)", fontSize: 13 }}>
            {notice}
          </div>
        )}

        {/* ── Hero ── */}
        <section className="landing-hero" style={{ padding: "48px 0 40px" }}>
          <div>
            <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "rgba(0,224,190,0.08)", border: "1px solid rgba(0,224,190,0.25)", borderRadius: 999, padding: "4px 12px", marginBottom: 18 }}>
              For investors in NSE-listed companies
            </span>
            <h1 className="landing-h1" style={{ fontSize: 46, lineHeight: 1.08, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--t1)", margin: "0 0 18px" }}>
              Find quality Indian companies — and the price where they turn good value.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--t2)", margin: "0 0 26px", maxWidth: 600 }}>
              Stockwise India reads each NSE-listed company's own filings, scores it on 10 quality checks, and works out three
              buy prices below its fair value. Your watchlist, alerts and portfolio are measured against the same prices.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <button className="btn-primary" onClick={() => goAuth("signup")} style={{ height: 46 }}>Create free account</button>
              <HowItWorks label="▶ Watch how it works · 2 min" style={{ height: 46, fontSize: 14, padding: "0 18px" }} />
            </div>
            <p style={{ fontSize: 12.5, color: "var(--t3)", margin: "14px 0 0" }}>Free during early access · No card needed</p>
          </div>
          <AuthForm onAuthed={onAuthed} mode={mode} onModeChange={setMode} />
        </section>

        {/* ── The product ── */}
        <section style={{ padding: "8px 0 40px" }}>
          <div style={{ ...card, overflow: "hidden", boxShadow: "var(--sh-lg)" }}>
            <div style={{ display: "flex", gap: 6, padding: "10px 14px", borderBottom: "1px solid var(--bdr)", background: "var(--s2)" }}>
              {["#FF5F57", "#FEBC2E", "#28C840"].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.8 }} />)}
            </div>
            <img
              src="/screens/discover.jpg" width="1280" height="800" loading="lazy"
              alt="The Discover screen: a strategy's results, each company with its quality score, price, returns on capital and three buy prices"
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          </div>
          <p style={{ fontSize: 12.5, color: "var(--t3)", textAlign: "center", margin: "12px 0 0" }}>
            A strategy's results: every company scored, with its three buy prices and where today's price sits against them.
          </p>
        </section>

        {/* ── Figures ── */}
        <section className="landing-stats" style={{ padding: "0 0 48px" }}>
          {[
            [stats?.companies ? stats.companies.toLocaleString("en-IN") : "—", "NSE companies scored"],
            [stats?.strategies ?? 13, "ready-made strategies"],
            [19, "filters to tune them"],
            [fmtDate(stats?.pricesDate), "latest prices"],
          ].map(([value, label]) => (
            <div key={label} style={{ ...card, padding: "18px 20px" }}>
              <div style={{ fontSize: 26, fontWeight: 750, color: "var(--accent)", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
              <div style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </section>

        {/* ── Features ── */}
        <section style={{ padding: "0 0 48px" }}>
          <h2 style={sectionTitle}>What's inside</h2>
          <p style={sectionLead}>Everything is worked out from companies' own filings on NSE and updated every trading day.</p>
          <div className="landing-features">
            {FEATURES.map(f => (
              <div key={f.title} style={{ ...card, padding: 22 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(0,224,190,0.08)", border: "1px solid rgba(0,224,190,0.2)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 15.5, fontWeight: 650, color: "var(--t1)", margin: "0 0 6px", letterSpacing: "-0.01em" }}>{f.title}</h3>
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
                <div style={{ width: 30, height: 30, borderRadius: 15, background: "var(--accent)", color: "#07070E", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{i + 1}</div>
                <h3 style={{ fontSize: 15.5, fontWeight: 650, color: "var(--t1)", margin: "0 0 6px" }}>{title}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--t2)", margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <HowItWorks label="▶ Watch the walkthrough · 2 min" style={{ height: 40, fontSize: 13 }} />
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <section style={{ ...card, padding: "20px 22px", borderColor: "var(--yellow-bdr)", background: "var(--yellow-dim)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 650, color: "var(--t1)", margin: "0 0 6px" }}>An educational tool, not investment advice</h2>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--t2)", margin: 0 }}>
            Stockwise India isn't registered with SEBI as an investment adviser or research analyst. Scores, fair values and
            buy prices are worked out automatically from public data, can be wrong, and aren't recommendations to buy or
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
