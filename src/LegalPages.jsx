import { SiteLink, SiteFooter, Logo, navigate } from "./site.jsx";

// /privacy and /disclaimer. Every statement here has to stay true to what
// the code does — check them when changing what's stored, adding analytics
// or ads, or moving hosts.

const UPDATED = "2 October 2026";
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
        <LI><B>Your account:</B> your email address and your password. The password is stored only as a salted, one-way hash (scrypt), so nobody — including us — can read it. If you sign in with Google, Apple or your phone instead, there's no password: we keep the email or phone number they confirm, your name if they share it, and the account ID their sign-in gives us.</LI>
        <LI><B>A sign-in cookie:</B> one cookie that keeps you signed in for up to 30 days. It's used for nothing else, scripts on the page can't read it, and it's removed when you sign out.</LI>
        <LI><B>What you save:</B> your watchlist (with the price when you added each stock and your notes on it), your price alerts, and your portfolio holdings (buy price, quantity, date and notes).</LI>
        <LI><B>Telegram, only if you connect it:</B> your Telegram chat ID and the name on your Telegram account, so your alerts reach you, and when each alert was last sent. Not your phone number — Telegram doesn't give it to us. Disconnecting (on the Alerts tab, or sending /stop to the bot) removes them.</LI>
      </UL>

      <H>What stays in your browser</H>
      <P>
        Your light/dark setting, your last filters, strategies you save, your recent searches and the notes you write on
        company pages are kept in your own browser. They never reach our server. You can clear them in your browser's
        settings for this site.
      </P>

      <H>What we don't do</H>
      <UL>
        <LI>No advertising or tracking cookies, no analytics, and no third-party scripts on our pages — apart from the sign-in services below, and only when you choose them.</LI>
        <LI>We don't sell, rent or share your personal data, and we use what you save only to show it back to you — and, if you connect Telegram, to send you your own alerts there.</LI>
      </UL>

      <H>Signing in with Google, Apple or your phone</H>
      <P>
        These go through Google's Firebase Authentication. Google (or Apple) confirms who you are and tells us your email
        address or phone number, and your name if you allow it. For a phone number, Google sends the SMS code and runs its
        reCAPTCHA check to stop automated abuse. Their privacy policies cover that step; we never see your Google or Apple
        password. Signing in with email and a password uses none of this.
      </P>

      <H>Emails</H>
      <P>
        We email you only when you ask to reset your password. The email, with a link that works once for an hour, is
        delivered by our email service provider on our behalf.
      </P>

      <H>Alerts on Telegram</H>
      <P>
        If you connect Telegram, each alert message — the company, its price and your alert price — is sent to you through
        Telegram, and Telegram's own privacy policy applies to messages in your Telegram account. Nothing else about your
        account is sent.
      </P>

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
        Quality scores, research scores, fair values, price levels (the three phase levels, the stop-loss level and the
        upper level) and the other figures are calculated automatically, by fixed formulas, from public data: companies'
        filings on NSE and market prices. They know nothing the formulas don't — news, management quality, or what a
        company will do next — and checks the filings can't show, such as related-party deals or auditor resignations, are left
        out rather than guessed. The weights behind the scores are a stated starting point, not a model proven to predict
        returns. Labels such as "In the Phase 1 zone" or "Constructive, with material questions" describe the numbers.
        They are not advice about what you should do.
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
