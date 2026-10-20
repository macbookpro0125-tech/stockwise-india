# What the original app's users dislike, and what Jocular Insights does about it (20 Oct 2026)

the original app is the reference for our company page and strategies (recon.md).
This reads its users' own reviews. The reviews are research only; none of
their words go on our pages, and the original app's name goes in nothing we publish.

## The sample, honestly

**138 different reviews from 3 sources.** The sheet has 163 rows; 25 repeat
the same words ("good", "nice") and the ranking tool counts them once.

| Source | Rows | What was read |
|---|---|---|
| Google Play | 151 | The 120 newest (9 Jun – 16 Oct 2026), and the 60 Play ranks "most relevant" (Mar 2020 – Sep 2026); 29 were in both |
| App Store (India) | 10 | All the web page shows. Apple's review feed for this app returned nothing |
| Trustpilot | 2 | All there are |

Not reached:
- **Reddit:** the browser pane blocks it, and its API needs credentials we
  don't have.
- **Hacker News:** two passing mentions, neither a review.
- **MouthShut:** no listing.

Play's own score is 4.4 from 70.1K reviews, and the App Store's is 4.5 from
2.5K ratings. This sample is newest-first and leans toward complaints, so it
says what goes wrong, not how many users are happy.

Almost everything comes from Google Play, so most themes rest on one source.
"Thin" below means fewer than 3 reviews, or only one source. Quotes are copied
exactly. Play and the App Store give no link per review, so the link is the
store's reviews page. Every review is in `reviews.csv`, and the full ranking is
in `feedback.md` (made with `themes.json`, our themes for a stock research app).

## 1. What they hate

| # | Problem | Reviews | Sources | Does it apply to us? |
|---|---|---|---|---|
| 1 | Money stuck or lost moving it: US-stock funding, withdrawals, the dollar rate, digital gold | 30 | 2 | No. We never hold or move money |
| 2 | Paying and being sold to: subscriptions, auto-renewal after cancelling, "buy" pop-ups, loan offers, ads | 23 (19 of them 1–2 stars) | 2 | Partly. No subscription, but the Android app shows ads |
| 3 | Linking a broker or refreshing the portfolio | 11 | 2 | No broker login. Holdings are typed in or loaded from a broker's file |
| 4 | Support that doesn't answer | 11 | 2 | Yes. There's no help entry in the app, only an email on the legal pages |
| 5 | Logging in: one-time codes that expire, errors | 9 | 2 | Less so. We use email and password or Google, not text-message codes |
| 6 | Crowded and hard to find things in | 9 | 2 | Worth watching. Our company page is long |
| 7 | Wrong or stale figures (thin) | 6 | 1 | Yes, we must stay right. We don't show the dates the figures come from |
| 8 | Privacy: portfolio data used for loan offers, reading texts (thin) | 5 | 1 | No. The app asks for internet access only, and nothing is cross-sold |

Quotes:
1. "everytime fund add failure worst app" (Play, 1★); "I bought digital gold but cannot withdraw or sell it." (Play, 1★)
2. "every time buy subscription pop up" (Play, 1★); "They keep deducting money even after plan cancelation from their app/website." (Play, 1★)
3. "syncing broker and MF is a nightmare." (Play, 1★); "It allows only from selected brokers." (Play, 1★)
4. "emailed but no response" (Play, 1★); "even to call there is no contact number available, only need to rely on slow email support service system" (App Store, 1★)
5. "the otp that comes is deemed expired the moment i fill it in." (Play, 1★)
6. "Your app is so congested and difficult to use that I have to spend several minutes just to get a small piece of information." (Play, 1★)
7. "Further it does not update PE based on quarterly results, big lag." (Play, 1★); "It's baffling that ROCE is calculated using EBIT of FY24 and CAPITAL of FY23 because the balance sheets are not updated for FY24." (Play, 3★)
8. "using my private mutual fund and equity data to target me with loan offers against my investments crosses a boundary" (Play, 1★)

Links: Play [store link, kept privately] ·
App Store [store link, kept privately]

## 2. What is missing (asked for by name)

| # | Request | Reviews | Sources | Ours today |
|---|---|---|---|---|
| 1 | More screener filters and ratios: banks' bad loans (NPA) and CASA, every ratio in one place, filters you can reorder | 7 | 2 | We have the 5-year median P/E and quarterly year-on-year growth filters. Missing: bank filters and reordering |
| 2 | Dark mode (thin) | 7 | 1 | Done. Dark is the default, with a light switch |
| 3 | Scores as numbers, not just a word | 6 | 2 | Done. Each group is out of 100, with every check's reason |
| 4 | Holdings it can't track: bonds, gold bonds, PPF, margin positions | 5 | 2 | Not ours to do. Our portfolio is NSE shares |
| 5 | Hide what you don't use; turn off offers (thin) | 5 | 1 | We have nothing to hide or turn off |
| 6 | Alerts for watched stocks: new filings, big moves (thin) | 3 | 1 | Price alerts only. Missing: an alert when a watched company files |
| 7 | 3-month, 6-month and 3-year chart ranges (thin) | 2 | 1 | 3M and 6M done. 3Y missing |

Quotes:
1. "add a few filters for banking stocks like gross and net NPA, CASA ratio etc." (Play, 4★); "Filters added in the screener can not be rearranged to have proper sequence is the biggest headache.." (Play, 2★)
3. "I wish for features like Default Probability, Quality check and Growth score, there were numbers instead of expressions like "Poor", "Satisfactory" and "Top performer"." (Play, 5★)
6. "an option to get notified if there is a significant price change in the stocks that are bookmarked." (Play, 4★)
7. "you need to add 6 months and 3 years option in the stock price graph." (Play, 4★)

## 3. What is unsolved (people the app doesn't serve well)

- **People who only want to research Indian shares.** Most of the original app's
  low ratings are about moving money and buying US stocks, and one reviewer
  asks to hide the US section altogether: "I do not want to see anything
  related to US stocks." (Play, 2★). Thin as a direct request (1 review), but
  it sits beside 30 money complaints.
- **Paying users who don't feel the paid tier is worth it.** "My yearly
  subscription is a total waste." (Play, 1★); "The "Scorecard" feature
  doesn't offer much beyond what's available in the free version" (Play, 2★).
  Thin: about 4 reviews.
- **People whose bank or broker isn't supported**: public-sector banks for
  US funding, and some brokers for linking. Not our job. We never need
  either.

## 4. Fix plan

Picked by evidence against cost. None is built yet. Each is a row in
`features.csv` (reference `no`: something to do better than the reference).

| # | What | Size | Skill | Evidence |
|---|---|---|---|---|
| 1 | **Help and feedback in Settings.** Email us with the app version and the screen filled in, plus a short "how the figures work" page: where each figure comes from, when it updates, why a score can be missing | S | replica-build | Support: 11 reviews, 2 sources |
| 2 | **Data dates on every company page.** Prices as of, latest results filed, score worked out on (already gap #12 in simplywallst-gaps.md) | S | replica-build | Wrong or stale figures: 6 (thin), and 19 across data, scores and filters, 2 sources |
| 3 | **Ads stay out of the way, as a written rule.** Ads only in lists, never a pop-up or full-screen ad, never a paid tier or a loan or credit offer; the store listing says so | S | replica-launch | Paying and being sold to: 23 reviews, 2 sources |
| 4 | **An alert when a watched company files** results, a dividend or a board meeting, from the NSE announcements we already read | M | replica-build | Alerts: 3 (thin) |
| 5 | **Bank filters in the screener**: gross and net NPA, capital ratio, provision cover (the scorecard already reads them for banks) | S–M | replica-build | Screener filters: 7 reviews, 2 sources (banks: 1) |
| 6 | **Reorder screener filters** by dragging, or with up and down buttons | S | replica-build | 1 review (thin), cheap |
| 7 | **A 3-year chart range** | S | replica-build | 2 reviews (thin), very cheap |

Pricing and billing complaints go to `/replica-launch`. Our answer is that
there's nothing to pay.

## 5. The angle

**A. Nothing to pay, nothing to cancel.**
For Indian investors tired of subscription pop-ups, auto-renewals and loan
offers in their research app, Jocular Insights is free stock research from
NSE filings: nothing to subscribe to, nothing to cancel, nothing sold to you.
Evidence: paying and being sold to, 23 reviews across 2 sources, 19 of them
1–2 stars.

**B. Research, not a broker.**
For investors who just want to study Indian companies, Jocular Insights never
touches your money: no wallet, no funding, no withdrawals to get stuck.
Evidence: moving money, 30 reviews across 2 sources. These are mostly people
who want US investing, which we don't offer, so they're not our users.

**C. Numbers you can check.**
For investors who want to see why a stock scores what it does, every
Jocular Insights score shows its reasons and the filing it came from.
Evidence: wrong or stale figures, scores and filters, 19 reviews across 2
sources. Several of these are requests we already meet.

**Recommended: A.** It answers the largest complaint our users could
actually have, it's already true (the Play listing says "Nothing in the app is
locked behind an ad"), and it costs nothing to keep. It holds only if ads stay
in lists, so fix #3 is part of it. C supports A on the company page. B
describes what we are, but it isn't a reason to choose us.
