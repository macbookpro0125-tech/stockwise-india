import { SiteLink, SiteFooter, Logo, navigate } from "./site.jsx";
import { problemMailto } from "./help.js";

// /privacy, /disclaimer and /help. Every statement here has to stay true to what
// the code does — check them when changing what's stored, adding analytics
// or ads, or moving hosts.

const UPDATED = "18 October 2026";
// Shown once set: a privacy policy needs a way to reach you
const CONTACT_EMAIL = "jocularinsights@gmail.com";

// onSignIn: the page's own sign-in box (PublicJoin.jsx), else the front page
export function PublicPage({ title, signedIn, updated = UPDATED, children, onSignIn = null }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid var(--bdr)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <a href="/" onClick={e => { e.preventDefault(); navigate("/"); }} style={{ textDecoration: "none" }}><Logo /></a>
          <button className="btn-ghost" onClick={() => (!signedIn && onSignIn ? onSignIn() : navigate("/"))} style={{ height: 34, fontSize: 12 }}>
            {signedIn ? "← Back to the app" : "Sign in"}
          </button>
        </div>
      </header>
      <main style={{ flex: 1, width: "100%", maxWidth: 760, margin: "0 auto", padding: "40px 20px 0", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.03em", color: "var(--t1)", margin: "0 0 6px" }}>{title}</h1>
        <p style={{ fontSize: 12, color: "var(--t3)", margin: "0 0 28px" }}>Last updated {updated}</p>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

const H = ({ children }) => <h2 style={{ fontSize: 17, fontWeight: 450, color: "var(--t1)", margin: "30px 0 8px", letterSpacing: "-0.01em" }}>{children}</h2>;
const P = ({ children }) => <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--t2)", margin: "0 0 12px" }}>{children}</p>;
const LI = ({ children }) => <li style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--t2)", marginBottom: 8 }}>{children}</li>;
const UL = ({ children }) => <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>{children}</ul>;
const B = ({ children }) => <strong style={{ color: "var(--t1)", fontWeight: 400 }}>{children}</strong>;

export function PrivacyPage({ signedIn }) {
  return (
    <PublicPage title="Privacy policy" signedIn={signedIn} updated="28 October 2026">
      <P>
        This page explains what Jocular Insights keeps about you, why, and how to delete it. In short: we use your
        account and saved data to provide the service, and we don't sell your personal data. The website uses no analytics
        services — we only count visits anonymously on our own server, without cookies. The website may show ads from
        Google AdSense and the mobile apps ads from Google AdMob, which process ad-related information as explained below.
        We don't send Google your account or saved investing data.
      </P>

      <H>What we keep on our server</H>
      <UL>
        <LI><B>Your account:</B> your email address and your password. The password is stored only as a salted, one-way hash (scrypt), so nobody — including us — can read it. If you sign in with Google, Apple or your phone instead, there's no password: we keep the email or phone number they confirm, your name if they share it, and the account ID their sign-in gives us.</LI>
        <LI><B>A sign-in cookie:</B> one cookie that keeps you signed in for up to 30 days. It's used for nothing else, scripts on the page can't read it, and it's removed when you sign out.</LI>
        <LI><B>What you save:</B> your watchlist (with the price when you added each stock and your notes on it), your price alerts, your portfolio holdings (buy price, quantity, date and notes), the investment thesis and the notes you write on a company's page, and the strategies you save on Discover.</LI>
        <LI><B>Phone notifications, only if you turn them on</B> (in the Android app): a token from Google's Firebase Cloud Messaging that lets us send notifications to that phone — your watchlist companies' news, a reminder the evening before one of them announces its results, and your price alerts. The notification goes through Google; its text is the company's news or your alert. Turning notifications off, or signing out, deletes the token.</LI>
        <LI><B>The weekly email, only if you turn it on</B> (Settings or the Account menu): we use your account's email address to send, on Sunday mornings, your starred companies' week, their news and their coming results, through our email provider (Resend). Every email has a link that turns it off at once, without signing in; we also keep when it was last sent.</LI>
        <LI><B>Visit counts, anonymous:</B> how many people loaded our pages each day and week, how many signed-in accounts opened the app each day, and the number of page loads — totals only, also split by the page you arrived on, the name of the site a link came from (such as Google or Reddit, never the full address), the kind of device (phone, computer or our app), the hour, and the country, looked up from your connection's address on our own server (using MaxMind's GeoLite2 data) — only the country is kept. To count each visitor once, your connection's address and browser are turned into a code with a secret that is deleted at the end of each day (and week), so the code can't identify you or follow you across days. No cookie is used, and no address is stored.</LI>
        <LI><B>Telegram, only if you connect it:</B> your Telegram chat ID and the name on your Telegram account, so your alerts reach you, and when each alert was last sent. Not your phone number — Telegram doesn't give it to us. Disconnecting (on the Alerts tab, or sending /stop to the bot) removes them.</LI>
      </UL>

      <H>What stays in your browser</H>
      <P>
        Your light/dark setting, whether company logos are shown, your last filters, your recent searches and which guided tours you've seen are kept in
        your own browser. They never reach our server. A
        thesis you're editing is also kept here until it's saved to your account. You can clear all of this in your
        browser's settings for this site.
      </P>

      <H>What we don't do</H>
      <UL>
        <LI>On the website (and the web app installed from it): no tracking or analytics services (only the anonymous visit counts above, on our own server), and no third-party scripts on our pages besides Google's ad script when website ads are on (below), and the sign-in services below, and only when you choose them. The Android and iPhone apps show ads; see "Ads in the Android and iPhone apps" below.</LI>
        <LI>We don't sell your personal data or share your saved account information for advertising. Service providers process only the information needed for features you use, as described below.</LI>
      </UL>

      <H>Signing in with Google, Apple or your phone</H>
      <P>
        These go through Google's Firebase Authentication. Google (or Apple) confirms who you are and tells us your email
        address or phone number, and your name if you allow it. For a phone number, Google sends the SMS code and runs its
        reCAPTCHA check to stop automated abuse. Their privacy policies cover that step; we never see your Google or Apple
        password. Signing in with email and a password uses none of this.
      </P>

      <H>Ads on the website</H>
      <P>
        The website may show ads from Google AdSense: a few cards marked "Ad" among the strategies and the stock lists —
        never a banner over the page or an ad that covers it. To show and measure them and to prevent fraud, Google and
        its partners use cookies and similar technology, and may use your visits to this and other sites to choose ads
        (personalised ads). Where the law asks for it (for example in the EU or the UK), Google's consent message asks
        you first. You can turn off personalised ads at adssettings.google.com, and read how Google uses this at
        policies.google.com/technologies/partner-sites. We don't give Google your email, your watchlist, your portfolio
        or anything else you save.
      </P>

      <H>Ads in the Android and iPhone apps</H>
      <P>
        The apps from the Google Play Store and the Apple App Store show ads from Google AdMob: a few marked "Ad" among
        the strategies and the stock lists, and a short video in Settings only if you choose "Watch an ad". Nothing in
        the app is locked behind an ad. To show and measure ads and to prevent fraud, Google's ads software in the app
        collects your device's advertising ID, your IP address and how you interact with the ads. Where the law asks for
        it (for example in the EU or the UK), Google's consent form asks you first, and on an iPhone ads are personalised
        only if you allow tracking. We don't give Google your email, your watchlist, your portfolio or anything else
        you save. You can reset your advertising ID or turn off personalised ads in your phone's settings. How Google
        uses this is described at policies.google.com/technologies/partner-sites.
      </P>

      <H>Emails</H>
      <P>
        We email you only to check your address when you sign up (a 6-digit code that works for 15 minutes) and when you
        ask to reset your password (a link that works once for an hour). These emails are delivered by our email service
        provider on our behalf.
      </P>

      <H>Alerts on Telegram</H>
      <P>
        If you connect Telegram, each alert message — the company, its price and your alert price — is sent to you through
        Telegram, and Telegram's own privacy policy applies to messages in your Telegram account. Nothing else about your
        account is sent.
      </P>

      <H>Market data from other services</H>
      <P>
        To show prices, results and news, our server fetches public market data from NSE and headlines from Google News.
        For company logos it fetches each company's icon from the company's own website or, where that has none we can
        use, from a public directory of Indian listed-company logos (api.dharun.dev); your browser only ever loads them
        from our server. Those requests contain only the company being looked up — never your email or anything about
        your account. When
        you follow a link to another site, such as NSE, that site's own privacy policy applies.
      </P>
      <P>
        A company page can show a short AI summary of its latest price move, written by Anthropic's Claude. Our server
        sends Anthropic only that company's public facts — its price moves, results, filings with NSE and news headlines —
        never your email or anything about your account.
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
        it there yourself.{CONTACT_EMAIL && <> For privacy questions or requests, email <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)" }}>{CONTACT_EMAIL}</a>.</>}
      </P>

      <H>Children</H>
      <P>Jocular Insights is meant for adults. Please don't create an account if you're under 18.</P>

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
        <B>Jocular Insights is an educational research tool.</B> Nothing on this site is investment advice, a research
        report, or a recommendation to buy, sell or hold any security.
      </P>
      <P>
        We are <B>not registered with SEBI</B> (the Securities and Exchange Board of India) as an investment adviser or a
        research analyst.
      </P>

      <H>How the numbers are made</H>
      <P>
        Quality scores, research scores, fair values and the other figures are calculated automatically, by fixed
        formulas, from public data: companies'
        filings on NSE and market prices. They know nothing the formulas don't — news, management quality, or what a
        company will do next — and checks the filings can't show, such as related-party deals or competitive position, are left
        out rather than guessed. The weights behind the scores are a stated starting point, not a model proven to predict
        returns. Labels describe the displayed figures; they do not tell you to buy or sell. Price levels are yours: the
        app shows none until you turn them on and choose your own margin of safety, gaps, stop and upper level (or type a
        stock's levels by hand), and then only does the arithmetic. They are not advice about what you should do.
      </P>

      <H>The data can be wrong or late</H>
      <P>
        Filings can be misread, restated or filed late, corporate actions such as splits and bonuses can be missed, and
        prices can be delayed or unavailable. Check any figure that matters against the company's own filings on NSE or
        BSE. The AI summary on a company page is written by an AI from the facts shown beside it and can still get
        something wrong; the facts themselves are the record.
      </P>

      <H>Past results</H>
      <P>The Performance tab shows how strategy picks have moved and tracks monthly research-score cohorts prospectively against the NIFTY 500. Score tracking uses split-adjusted price returns, excludes dividends, and reports names without a current quote as unpriced. It is an early study of eligible listed companies, not a historical backtest; past or prospective performance does not predict future returns.</P>

      <H>Your decisions are yours</H>
      <P>
        Investments in the securities market are subject to market risks. Read all related documents carefully before
        investing. You are responsible for your own investment decisions — consider consulting a SEBI-registered investment
        adviser. We accept no liability for any loss arising from use of this site or its data.
      </P>

      <H>Not affiliated</H>
      <P>
        Jocular Insights is independent and is not affiliated with NSE, BSE, SEBI, Google or any company shown.
        Company names, logos and trademarks belong to their owners. They are shown only to identify each company, and
        showing them doesn't mean a company endorses Jocular Insights. A company can ask us to remove its logo by
        writing to <a href="mailto:jocularinsights@gmail.com" style={{ color: "var(--accent)" }}>jocularinsights@gmail.com</a>;
        we take it down promptly.
      </P>
      <P>
        See also our <SiteLink to="/privacy">privacy policy</SiteLink>.
      </P>
    </PublicPage>
  );
}

// /about: who runs the site, where its data comes from, how to reach us (the
// same words the server writes for search engines: seo.js aboutPageHtml)
export function AboutPage({ signedIn }) {
  return (
    <PublicPage title="About Jocular Insights" signedIn={signedIn} updated="25 October 2026">
      <P>
        Jocular Insights is an independent research tool for India's stock market, built and run in India. It reads every
        NSE-listed company's own filings and turns them into figures, scores and pictures anyone can check.
      </P>
      <H>Where the data comes from</H>
      <UL>
        <LI><B>Company results, balance sheets, cash flows and segment figures:</B> the quarterly and annual filings each company makes to NSE.</LI>
        <LI><B>Products, exports and customers:</B> the Business Responsibility and Sustainability Report the largest companies file each year.</LI>
        <LI><B>Prices:</B> NSE's daily closing prices, updated each trading evening.</LI>
        <LI><B>Shareholding, board meetings and corporate actions:</B> NSE's filings and calendar.</LI>
      </UL>
      <H>How the figures are made</H>
      <P>
        Every figure is worked out by fixed rules, the same for every company, and each score shows the checks behind it.
        The <SiteLink to="/methodology">methodology</SiteLink> explains them in full, and <SiteLink to="/help">How the figures work</SiteLink> says when each one changes.
      </P>
      <H>What it isn't</H>
      <P>
        Jocular Insights is not registered with SEBI as an investment adviser or research analyst. Nothing here is a
        recommendation to buy, sell or hold anything. See the <SiteLink to="/disclaimer">disclaimer</SiteLink>.
      </P>
      <H>Contact</H>
      <P>Write to <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)" }}>{CONTACT_EMAIL}</a> — for a figure that looks wrong, a question, or anything else.</P>
    </PublicPage>
  );
}

// /help: how the figures work and how to reach us. Users of other Indian
// screeners complain most about support that never answers and figures that
// lag without saying so (replica/fixes.md), so this says plainly where each
// figure comes from, when it changes, and who to write to.
export function HelpPage({ signedIn }) {
  return (
    <PublicPage title="How the figures work" signedIn={signedIn} updated="20 October 2026">
      <P>
        Everything in Jocular Insights is worked out from public data by fixed rules. This page says where each figure
        comes from, when it changes, and why one can be missing. If something looks wrong, <a href={problemMailto()} style={{ color: "var(--accent)" }}>tell us</a>.
      </P>

      <H>Where the figures come from</H>
      <UL>
        <LI><B>Company results:</B> the quarterly and annual results each company files with NSE. Ratios such as P/E, ROE and debt to equity are calculated from them.</LI>
        <LI><B>Prices and returns:</B> NSE's daily closing prices, and NSE's index closes for comparisons with the NIFTY 50 and sector indices. The price chart, its technicals and the latest close at the top of a company page use the same NSE daily prices.</LI>
        <LI><B>Shareholding and announcements:</B> the shareholding patterns and announcements companies file with NSE.</LI>
      </UL>

      <H>When they change</H>
      <P>
        Each weekday evening, after NSE publishes the day's prices, we read the closing prices and the results companies
        have filed since the last check. If that run fails, it is tried again the next morning. So prices are the last
        trading day's close, and new results usually appear the evening they are filed.
      </P>
      <P>
        Every company page ends with <B>Where these figures come from</B>: the close the returns use, the latest quarter
        and year filed and when, and when its filings were last read.
      </P>

      <H>Why a figure or score can be missing</H>
      <UL>
        <LI>The company hasn't filed enough years for a check that needs them, such as five-year growth.</LI>
        <LI>The check doesn't apply. Banks and other lenders are judged on bad loans and capital instead of debt to equity.</LI>
        <LI>The filings can't show it, such as related-party deals or forecasts. Those are left out, never guessed.</LI>
        <LI>A company whose latest audited year is about 18 months behind the rest has stopped filing, and drops out of the screener.</LI>
      </UL>

      <H>Scores, fair values and levels</H>
      <P>
        The quality score is out of 100, across six groups: business quality, earnings quality, balance sheet,
        governance, growth and valuation. Every check shows its reason on the company's Scorecard. A fair value is an
        estimate from each company's normalized earnings and its own usual P/E, capped at twice its sector's (banks on book
        value). For the exact group weights, missing-data rules, bank model and limitations, see the <SiteLink to="/methodology">full scoring and valuation methodology</SiteLink>. These are estimates to help you think, not targets or advice; see the <SiteLink to="/disclaimer">disclaimer</SiteLink>.
      </P>

      <H>What it costs</H>
      <P>
        Nothing. There is no subscription, so there is nothing to renew or cancel, and nothing is sold to you: no loans,
        no credit offers, no paid tier. The Android app shows a few ads among lists, never in front of what you are
        reading, and nothing is ever locked behind one.
      </P>

      <H>Contact us</H>
      <P>
        Email <a href={problemMailto()} style={{ color: "var(--accent)" }}>jocularinsights@gmail.com</a>. The email opens with the page you were on and the
        app's version filled in. Tell us the company and the figure that looks wrong; a screenshot helps. For
        privacy requests, see the <SiteLink to="/privacy">privacy policy</SiteLink>.
      </P>
    </PublicPage>
  );
}
