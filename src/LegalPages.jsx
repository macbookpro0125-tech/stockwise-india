import { SiteLink, SiteFooter, Logo, navigate } from "./site.jsx";

// /privacy and /disclaimer. Every statement here has to stay true to what
// the code does — check them when changing what's stored, adding analytics
// or ads, or moving hosts.

const UPDATED = "27 September 2026";
// Shown once set: a privacy policy needs a way to reach you
const CONTACT_EMAIL = null;

function PublicPage({ title, signedIn, children }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid var(--bdr)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <a href="/" onClick={e => { e.preventDefault(); navigate("/"); }} style={{ textDecoration: "none" }}><Logo /></a>
          <button className="btn-ghost" onClick={() => navigate("/")} style={{ height: 34, fontSize: 12 }}>
            {signedIn ? "← Back to the app" : "Sign in"}
          </button>
        </div>
      </header>
      <main style={{ flex: 1, width: "100%", maxWidth: 760, margin: "0 auto", padding: "40px 20px 0", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--t1)", margin: "0 0 6px" }}>{title}</h1>
        <p style={{ fontSize: 12, color: "var(--t3)", margin: "0 0 28px" }}>Last updated {UPDATED}</p>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

const H = ({ children }) => <h2 style={{ fontSize: 17, fontWeight: 650, color: "var(--t1)", margin: "30px 0 8px", letterSpacing: "-0.01em" }}>{children}</h2>;
const P = ({ children }) => <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--t2)", margin: "0 0 12px" }}>{children}</p>;
const LI = ({ children }) => <li style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--t2)", marginBottom: 8 }}>{children}</li>;
const UL = ({ children }) => <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>{children}</ul>;
const B = ({ children }) => <strong style={{ color: "var(--t1)", fontWeight: 600 }}>{children}</strong>;

export function PrivacyPage({ signedIn }) {
  return (
    <PublicPage title="Privacy policy" signedIn={signedIn}>
      <P>
        This page explains what Stockwise India keeps about you, why, and how to delete it. In short: we keep only what
        you need to use the app, we don't track you, and we don't sell or share your data.
      </P>

      <H>What we keep on our server</H>
      <UL>
        <LI><B>Your account:</B> your email address and your password. The password is stored only as a salted, one-way hash (scrypt), so nobody — including us — can read it.</LI>
        <LI><B>A sign-in cookie:</B> one cookie that keeps you signed in for up to 30 days. It's used for nothing else, scripts on the page can't read it, and it's removed when you sign out.</LI>
        <LI><B>What you save:</B> your watchlist (with the price when you added each stock and your notes on it), your price alerts, and your portfolio holdings (buy price, quantity, date and notes).</LI>
      </UL>

      <H>What stays in your browser</H>
      <P>
        Your light/dark setting, your last filters, strategies you save, your recent searches and the notes you write on
        company pages are kept in your own browser. They never reach our server. You can clear them in your browser's
        settings for this site.
      </P>

      <H>What we don't do</H>
      <UL>
        <LI>No advertising or tracking cookies, no analytics, and no third-party scripts on our pages.</LI>
        <LI>We don't sell, rent or share your personal data, and we use what you save only to show it back to you.</LI>
      </UL>

      <H>Market data from other services</H>
      <P>
        To show prices, results and news, our server fetches public market data from NSE, Yahoo Finance and Google News.
        Those requests contain only the company being looked up — never your email or anything about your account. When
        you follow a link to another site, such as NSE, that site's own privacy policy applies.
      </P>

      <H>Where it's kept, and how it's protected</H>
      <P>
        Your data is stored on servers run by our hosting provider, on our behalf. Like most websites, the hosting provider
        may keep standard server logs, such as IP addresses and the times of visits, for security and troubleshooting.
        Passwords are hashed, the sign-in cookie is sent only over a secure connection on the live site, and each account
        can see only its own data.
      </P>

      <H>How long we keep it, and deleting it</H>
      <P>
        We keep your account and what you save until you delete them. You can remove any single stock, alert or holding at
        any time. To delete everything, sign in and open <B>Account → Delete account</B> (top right). That removes your
        account and everything saved with it from our database straight away, and it can't be undone.
      </P>

      <H>Your rights</H>
      <P>
        Under India's Digital Personal Data Protection Act, 2023 you can ask to see, correct or erase your personal data,
        and to have a grievance addressed. Everything we hold about you is visible in the app, and you can correct or delete
        it there yourself.{CONTACT_EMAIL && <> For anything else, write to <B>{CONTACT_EMAIL}</B>.</>}
      </P>

      <H>Children</H>
      <P>Stockwise India is meant for adults. Please don't create an account if you're under 18.</P>

      <H>Changes to this policy</H>
      <P>
        If this changes — for example, if we add advertising — we'll update this page and the date at the top before the
        change takes effect.
      </P>
    </PublicPage>
  );
}

export function DisclaimerPage({ signedIn }) {
  return (
    <PublicPage title="Disclaimer" signedIn={signedIn}>
      <P>
        <B>Stockwise India is an educational research tool.</B> Nothing on this site is investment advice, a research
        report, or a recommendation to buy, sell or hold any security.
      </P>
      <P>
        We are <B>not registered with SEBI</B> (the Securities and Exchange Board of India) as an investment adviser or a
        research analyst.
      </P>

      <H>How the numbers are made</H>
      <P>
        Quality scores, fair values, "buy phases", stop losses, targets and the other figures are calculated automatically,
        by fixed formulas, from public data: companies' filings on NSE and market prices. They know nothing the formulas
        don't — news, management quality, or what a company will do next. Labels such as "BUY — Phase 1" describe where
        today's price sits against those formulas. They are not advice about what you should do.
      </P>

      <H>The data can be wrong or late</H>
      <P>
        Filings can be misread, restated or filed late, corporate actions such as splits and bonuses can be missed, and
        prices can be delayed or unavailable. Check any figure that matters against the company's own filings on NSE or
        BSE.
      </P>

      <H>Past results</H>
      <P>The Performance tab shows how strategies' past picks have moved. Past performance does not predict future returns.</P>

      <H>Your decisions are yours</H>
      <P>
        Investments in the securities market are subject to market risks. Read all related documents carefully before
        investing. You are responsible for your own investment decisions — consider consulting a SEBI-registered investment
        adviser. We accept no liability for any loss arising from use of this site or its data.
      </P>

      <H>Not affiliated</H>
      <P>
        Stockwise India is independent and is not affiliated with NSE, BSE, SEBI, Yahoo, Google or any company shown.
        Company names and trademarks belong to their owners.
      </P>
      <P>
        See also our <SiteLink to="/privacy">privacy policy</SiteLink>.
      </P>
    </PublicPage>
  );
}
