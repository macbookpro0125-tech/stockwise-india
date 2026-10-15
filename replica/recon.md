# Recon — stock page (S-STOCK)

Reference: Tickertape's public stock page (looked at as a visitor, 15 Oct 2026,
1440px wide). Layout and behaviour only; no code, text, icons or images taken.

## What the reference does

| Area | What it is | Ours (StockWise data) |
|---|---|---|
| Left column, sticky | Identity card: logo, company name, watch toggle, exchange, big price, day change | `StockSide.jsx`: logo, name, symbol · NSE · sector, price + its source and date, 1W / 1M / 1Y returns to the last NSE close, Watch and Alert |
| Left column, under it | Scorecard: six verdict rows (icon, name, coloured word, one line, chevron) | Scorecard from `research`: business, earnings, balance sheet, governance, growth, valuation, technical setup, red flags; each row opens that group's checks |
| Main, top | Underlined tabs, sticky, jump to sections (scroll-spy) | `SectionNav` regrouped into 8 tabs |
| Overview | Price chart with range buttons, then three cards: sector, size (cap class + rank), risk vs index | `PriceChartPanel`, then `StockSnapshot.jsx`: sector + tags, size class by SEBI rank (counted live), risk label + beta to NIFTY 50 |
| Key metrics | Grid of ratios | P/E (TTM), P/B, dividend yield, ROE, ROCE, debt/equity, EPS (TTM), 52-week range |
| Later sections | Company profile, peers, financial statements (tabs), holdings (bars + history), events, news | Existing panels: about, events, research dashboard, valuation, financials, shareholding, technicals, peers, filings, notes |

## States

- Loading: page spinner (existing), skeleton for the size rank.
- No filings (`metrics` null): identity card and chart only; scorecard says there is nothing to score.
- Lender: business/earnings groups "doesn't apply" — row shows "n/a".
- Quote stale / quote error: notices above the overview (existing).
- Phone (≤ 900px): one column; identity card and scorecard first, tabs pin under the header.

## Not copied

Promotions, Pro locks, forecasts and analyst ratings (we have no such data),
user-count badges.

# Recon — sign-in (S-AUTH) and the orbit animation

Reference: TradingView's homepage and sign-in dialog, looked at as a visitor
(16 Oct 2026, 1440px). Layout and behaviour only; nothing copied.

| Area | What the reference does | Ours |
|---|---|---|
| Sign-in surface | Full-window dialog in two halves; left a large rounded panel with a moving scene, a short line, a pause button; right the logo, a close button, the steps, a sign-up link at the foot | `AuthDialog.jsx`: Earth from orbit (`Orbit.jsx`), "Read the filings first. Then decide.", pause; logo, ✕, steps, switch link |
| Step 1 | One main provider, more options, "or", Email | Google and phone (only what the server offers, `/api/auth/options`), "or", Continue with email; straight to email when email is the only way |
| Step 2 | Back arrow, "Sign in with email", labelled email and password (eye), forgot link, remember me, Sign in | Back, labelled Email and Password with show/hide, Forgot (when reset is on), Sign in / Create free account. No "remember me" (sessions already persist) |
| Home animation | Earth from orbit: sunrise on the horizon, city lights, glowing price lines | `Orbit.jsx`: canvas, drawn from scratch; lines are decoration, not data. In the sign-in panel; the front page is another session's work |
