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

Prices are daily closing prices; company figures update as new results are filed.

IMPORTANT
Jocular Insights is an educational research tool. It is not investment advice, and it is not registered with SEBI as an investment adviser or research analyst. Scores, fair values and levels come from rules applied to public filings and can be wrong. Do your own research and consult a SEBI-registered adviser before investing.

FREE, WITH NOTHING TO CANCEL
There is no subscription and no paid tier, so there is nothing to renew or cancel, and nothing is sold to you: no loans, no credit offers. The app shows a few ads among lists. If you'd like to support it, you can choose to watch a video ad from Settings. There are no pop-ups or ads between screens, and nothing is locked behind an ad.
```

**App category** — Finance · **Tags** — Finance, Investing, Stock market,
Research

**Contact details** — email `jocularinsights@gmail.com` · website
`https://jocularinsights.in`

**Privacy policy URL** — `https://jocularinsights.in/privacy`

## Pictures (`replica/launch/play/`)

| File | Use | Size |
|---|---|---|
| `icon-512.png` | App icon (the glass JI, 21 Oct 2026; scripts/brand-assets.mjs) | 512 × 512 |
| `feature-graphic.png` | Feature graphic | 1024 × 500 |
| `1-strategies.png` … `6-settings.png` | Phone screenshots (2–8 allowed) | 1080 × 1920 |

Retaken 21 Oct 2026 after the phone redesign: strategies, a strategy's
stocks (Dividend Aristocrats: its name fits the wheel), the company page, its
Scorecard tab (not Valuation, whose price levels open on a red "below the
stop-loss level" that reads as a trade call in a store), watchlist and
settings (as you@example.com).

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

**Google sign-in in the app (20 Oct 2026):** the app signs in with Google
natively (`@capacitor-firebase/authentication`, src/socialSignIn.js). Firebase
has the Android app `com.jocularinsights.app` with the upload key's and the
debug key's SHA-1. Still to do: put `google-services.json` (Firebase →
Project settings → Jocular Insights Android) in `android/app/` — **never
build the app without it: the plugin needs it at start** — then
`npx cap sync android` and rebuild; after the first upload, add Play's app
signing key SHA-1 (Play Console → Test and release → App integrity) in
Firebase, or Google sign-in fails for installs from Play.

**20 Oct 2026:** the signed `.aab` is rebuilt with the real AdMob app ID
(`ca-app-pub-4001463380481442~5693283483`), version 1.0 (code 1), target
SDK 36, signed with the upload key in `~/.jocular`; a copy is at
`replica/launch/release/jocular-insights-1.0.aab` (not in git). The build
needs Android Studio's Java: `JAVA_HOME="/Applications/Android
Studio.app/Contents/jbr/Contents/Home"`.

1. AdMob: the app ID and the Native and Rewarded ad unit IDs (deploy.md).
2. Build: `npm run build`, `npx cap sync android`, then
   `cd android && ./gradlew bundleRelease -PADMOB_APP_ID=<your app ID>` —
   signed with the upload key in `~/.jocular` (backed up 21 Oct 2026: the .jks is in the jocularinsights@gmail.com Google Drive; its two passwords are in the owner's password manager, not in Drive).
3. Play Console: create the app, upload `app-release.aab` to **Closed
   testing**, add 12+ testers, run it 14 days (new personal accounts must),
   then apply for production.

**21 Oct 2026:** the new logo (the owner's glass JI) is in the app's icons, the Play icon and feature graphic and the pictures; the `.aab` was rebuilt with it (19.3 MB) and copied to `replica/launch/release/jocular-insights-1.0.aab`. Upload that one.

**22 Oct 2026:** version code 2 (still 1.0) adds Google's in-app review (the "Rate the app" row in Settings and the rating card after a week of use, src/rateApp.js). Copied to `replica/launch/release/jocular-insights-1.0-code2.aab` (19.4 MB). In the draft closed-test release, remove the code-1 bundle and add this one: Play doesn't take a version code twice. The in-app card only appears for installs from Play, never for a build installed by hand.

## Play Console status (21 Oct 2026)

The developer account (personal, jocularinsights@gmail.com) is verified: identity, Android device and phone. The app "Jocular Insights: NSE Screener" (`com.jocularinsights.app`, free) is created. Saved in App content: privacy policy, sign in details (the reviewer account is jocularinsights+review@gmail.com, made on the live site; the owner typed its password into Play, it isn't kept here), ads (yes), content rating (Everyone / PEGI 3 / 3+), target audience (18 and over), data safety (as listed above, plus in-app search history as processed in real time, portfolio holdings as "other financial info", deletion at /privacy), government apps (no), financial features (none), health (none), advertising ID (yes: advertising, analytics, fraud prevention); store settings: Finance, jocularinsights@gmail.com, https://jocularinsights.in. The store listing text is saved as a draft. Left: upload the icon, feature graphic and phone screenshots (`replica/launch/play/`), then the closed test (countries, testers, upload the .aab).

**Closed test (21 Oct 2026):** the track "Closed testing - Alpha" is for India, with feedback to jocularinsights@gmail.com. Release 1 (1.0) is a draft: the .aab uploaded (API 24+, target 36), release notes in English. Play App Signing is on; its key's SHA-1 `C7:99:20:6F:6C:FF:7D:E3:92:88:88:4D:D5:97:55:50:67:2A:E1:D5` (SHA-256 `30:CC:0E:5F:…:16:F9`) is added to the Firebase Android app beside the upload and debug keys, so Google sign-in works for installs from Play. Left: the testers (12+, an email list or a Google Group), then Preview and confirm → Send for review.

**Screenshots without other companies' logos (22 Oct 2026):** `scripts/play-assets.mjs` now turns the app's company-logo setting off, so each company shows its letters and the store listing carries no other company's trademark. The six phone screenshots were retaken; the ones uploaded to Play Console on 21 Oct (with Sanofi's, TCS's and Infosys's logos) need replacing with these.

**24 Oct 2026:** the store icon is now the white logo (the owner's silver JI artwork on white, `replica/launch/play/icon-512.png`), saved in the default store listing. The closed-test draft release holds version code 3 (1.1: phone notifications and the white launcher icon), named "3 (1.1)". Left: the testers (12+, 8 so far), then Preview and confirm, then Send for review.

**24 Oct 2026, Data safety:** Device or other IDs, collected, now also for **App functionality** (the Firebase Cloud Messaging token for phone notifications, version code 3), beside Analytics, Advertising and Fraud prevention; shared unchanged (Analytics, Advertising, Fraud prevention: AdMob) — FCM is a service provider, which the form exempts from "shared". Saved ("Change saved. Send for review in Publishing overview"). Goes to review with the closed-test release.

**24 Oct 2026, testers:** an email list "Jocular testers" with 12 testers (the owner's list, given in chat) is attached to Closed testing - Alpha and saved — the track shows 3 of 4 complete. Play refused to save one address as typed (mohd.ahjadkhan…): it accepted the owner's correction (mohd.amjadkhan2125@gmail.com). A whole list that includes an address Play rejects fails with only "Your changes couldn't be saved"; adding in batches found it. Left: Send the release to Google for review (owner to confirm), then share the opt-in link.

**24 Oct 2026, sent for review** (the owner said yes): the release "3 (1.1)" saved (2 warnings, both optional: no deobfuscation file, no native debug symbols), then Publishing overview → "Submit 14 changes for review" → "Send changes for review". 14 changes: the closed-test release, India, the testers list and feedback email, the store listing (white icon), app content (data safety). Status: "Changes in review"; Play's quick checks first (up to 14 minutes), then Google's review ("typically within 7 days"). Managed publishing is off, so the test reaches the testers once approved. Next: the opt-in link (Testers tab → How testers join), sent to the 12; the 14 days count from 12 opted in.

**24 Oct 2026, approved:** "App update published" — Closed testing - Alpha is Active, latest release 3 (1.1). Testers list "Jocular testers" now 14 (two spares added). Opt-in link (join on the web): https://play.google.com/apps/testing/com.jocularinsights.app — then install from https://play.google.com/store/apps/details?id=com.jocularinsights.app. The 14 days count from 12 opted in.
