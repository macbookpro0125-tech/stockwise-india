# Google Play listing — Jocular Insights (draft, 19 Oct 2026)

Paste these into Play Console → your app → Grow → Store presence → Main store
listing. Pictures are in `replica/launch/play/` (`node scripts/play-assets.mjs`
remakes them). Wording rules: research language only — no "multibagger
picks", "sure-shot", "target price", returns or buy/sell calls; Jocular
Insights is not SEBI-registered, so the listing says it's educational.

## Store listing

**App name** (30 max) — `Jocular Insights: NSE Screener` (30). The owner
wanted the name to say it's a stock screener (20 Oct 2026); "Jocular Insights:
Stock Screener" is 32, over Play's limit, so "stock screener" leads the short
description instead — Play searches both. The AdMob app is named
"Jocular Insights – Stock Screener" (only the owner sees that one).

**Short description** (80 max) —
`NSE stock screener with ready-made strategies, quality scores and fair values.` (78)

**Full description** (4,000 max; the last section added 20 Oct 2026 from
the review study, replica/fixes.md) —

```
Jocular Insights helps you research NSE-listed companies from their own filings.

STRATEGIES
Start from a ready-made strategy — quality compounders, dividend payers, undervalued growth, Graham net-nets and more — and see which companies fit it at today's close. Change any filter, or build your own screen from more than a hundred measures.

A QUALITY SCORE FROM THE FILINGS
Every company is scored out of 100 across six areas: business quality, earnings quality, balance sheet, governance, growth and valuation. Each check shows its reason. What the filings can't show is listed as not checked — never guessed.

FAIR VALUE AND PRICE LEVELS
A fair-value estimate from each company's normalized earnings and its own usual P/E (banks on book value, cyclicals on mid-cycle earnings), with reference price levels. They are estimates to help you think, not targets or advice.

THE WHOLE COMPANY ON ONE PAGE
Price and financial charts, ten years of results, quarterly figures, shareholding, peers, and the company's own announcements to NSE.

YOUR WATCHLIST, ALERTS AND PORTFOLIO
Save companies, set price alerts on the daily close, and record what you own to see your gain or loss and where each price sits against its levels.

Prices are NSE's daily closing prices; company figures update as new results are filed.

IMPORTANT
Jocular Insights is an educational research tool. It is not investment advice, and it is not registered with SEBI as an investment adviser or research analyst. Scores, fair values and levels come from rules applied to public filings and can be wrong. Do your own research and consult a SEBI-registered adviser before investing.

FREE, WITH NOTHING TO CANCEL
There is no subscription and no paid tier, so there is nothing to renew or cancel, and nothing is sold to you: no loans, no credit offers. The app shows a few ads among lists, never pop-ups or full-screen ads, and nothing is locked behind one.
```

**App category** — Finance · **Tags** — Finance, Investing, Stock market,
Research

**Contact details** — email `jocularinsights@gmail.com` · website
`https://jocularinsights.in`

**Privacy policy URL** — `https://jocularinsights.in/privacy`

## Pictures (`replica/launch/play/`)

| File | Use | Size |
|---|---|---|
| `icon-512.png` | App icon | 512 × 512 |
| `feature-graphic.png` | Feature graphic | 1024 × 500 |
| `1-strategies.png` … `6-settings.png` | Phone screenshots (2–8 allowed) | 1080 × 1920 |

## App content (Play Console → Policy → App content)

- **Privacy policy** — the URL above.
- **Ads** — Yes, the app contains ads.
- **App access** — Some features need an account: give Play's reviewers a
  test account (email and password) made on the live site for them; delete it
  after review.
- **Target audience** — 18 and over only.
- **Content rating** — answer the questionnaire as a reference/finance app:
  no violence, sexual content, gambling or user-to-user chat. Expect
  "Everyone" / PEGI 3 / IARC 3+.
- **Financial features** — the app gives stock research and market data; it
  does not offer trading, loans, payments, crypto or insurance. Choose the
  "investment research / market information" style option if offered, else
  "none of these" — read each option as Play words it on the day.
- **Data safety** — collected by the app and our server:
  - Email address (account management; required for an email account)
  - Name, if a user signs in with Google (account management; optional)
  - User-generated content: watchlist, notes, portfolio, price alerts
    (app functionality)
  - Collected by Google AdMob for ads: device or other IDs, app
    interactions, diagnostics and approximate location — copy these from
    Google's own "AdMob — Data safety" help page so the form matches it
  - Encrypted in transit: Yes (https only)
  - Users can delete their data: Yes — Settings → Delete account, and the
    privacy page explains how
  - Data isn't sold; ad data goes to Google as the ads processor
- **Government apps / news** — not applicable.

## Before the first upload

1. AdMob: the app ID and the Native and Rewarded ad unit IDs (deploy.md).
2. Build: `npm run build`, `npx cap sync android`, then
   `cd android && ./gradlew bundleRelease -PADMOB_APP_ID=<your app ID>` —
   signed with the upload key in `~/.jocular` (back that folder up).
3. Play Console: create the app, upload `app-release.aab` to **Closed
   testing**, add 12+ testers, run it 14 days (new personal accounts must),
   then apply for production.
