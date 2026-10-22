# Deploy — Jocular Insights

Scope so far (17 Oct 2026): the mobile app only, at the owner's request.
Plan changed the same day: one Capacitor app for both stores (not a Trusted
Web Activity for Play), because the ads the owner wants — AdMob's in-list
cards and rewarded video — need the native AdMob SDK.
The domain `jocularinsights.in` was registered on 17 Oct 2026. Its NIXI identity
and registrant-email checks are complete; Domain India says the initial safety
hold will lift automatically by 18 Oct 2026 at 22:40. The domain is not yet
connected to the app host, and the paid web host and domain email are still
pending.

## Web host and domain (19 Oct 2026)

| What | State |
|---|---|
| Render service `stockwise-india` | Starter plan (0.5 CPU, 512 MB), Singapore; `render.yaml` describes it |
| Persistent disk | 1 GB at `/var/data` (`DATA_DIR`): the accounts database and market data; Render snapshots it daily |
| Data | `DATA_JOBS=pull`: the evening refresh's data-latest release; alerts and backups run on the server |
| Domain | https://jocularinsights.in (A record to Render), `www` redirects to it; TLS by Render |
| `APP_URL` | https://jocularinsights.in (set 19 Oct) |
| Blueprint Auto Sync | **Off** (19 Oct): `render.yaml` said free plan and no disk while the dashboard ran paid with a disk; a sync could have undone that |
| Google sign-in on the domain | **Live** (checked 22 Oct 2026): jocularinsights.in is in Firebase's authorized domains (with stockwise-india.onrender.com), the site's /api/auth/options offers Google, and the button opens Firebase's sign-in window without an unauthorized-domain error; the owner signed in with Google on a laptop the same day |
| Monitoring | **On (22 Oct 2026):** `.github/workflows/site-watch.yml` runs `scripts/site-watch.mjs` every 30 minutes — the home page, its app script, /api/health (data under 100 hours old, no failed data pull or job), three looks two minutes apart. A failed run makes GitHub email the account that last changed the workflow's schedule. Render restarts a crashed server on its own |
| Password-reset email | **Live (22 Oct 2026):** Resend (jocularinsights@gmail.com), domain jocularinsights.in verified (region Tokyo; DNS at Domain India: TXT `resend._domainkey`, CNAME `send` → send.forge.rmta.net, CNAME `rsend` → rsend-apne1.forge.rmta.net, TXT `_dmarc` `v=DMARC1; p=none;`; no MX). Render has `RESEND_API_KEY`, `EMAIL_FROM` = `Jocular Insights <no-reply@jocularinsights.in>`, `APP_URL`. Checked on the live site: a sign-up returns 202 and its code email is delivered; a password reset is delivered with its link to jocularinsights.in/reset-password |
| Telegram alerts | Not set up on the server: `TELEGRAM_BOT_TOKEN` |
| AI summary of a move | **Off** until `ANTHROPIC_API_KEY` is set in Render (the owner creates the key at console.anthropic.com; never in the repository). Optional `AI_MODEL` (default `claude-opus-5-5`). Cost: one request per company per trading day, about ₹1 each on Opus 5.5 at low effort; at most 60 an hour per account |

## Mobile

| Stage | What people get | Cost | Status |
|---|---|---|---|
| 1. Installable web app (PWA) | Install from the site on Android and desktop; Add to Home Screen on iPhone; full screen with its own icon; opens offline | free | **Done** — `390fe56`, not yet pushed |
| 2. Google Play (Capacitor app, `android/`) | A Play Store app running the live site, with AdMob ads (cards in the lists, "Watch an ad" in Settings) | $25 once (Google Play developer account, owner's); AdMob free | **Built and run on the emulator** with Google's sample ads (17 Oct 2026); waits for the owner's AdMob and Play accounts, and paid hosting/DNS for `jocularinsights.in` |
| 3. Apple App Store (the same Capacitor app, `ios/` to add) | An App Store listing, with the same ads and push notifications for price alerts — Apple rejects a website in a wrapper (guideline 4.2) | $99 a year (Apple developer account, owner's) | Waits for paid hosting/DNS for `jocularinsights.in`, a D-U-N-S number, and a Mac on macOS 15 or later (this one is on 13; Apple's current Xcode needs 15) — or GitHub's Macs |

### Stage 1 checks (run 17 Oct 2026, local copy)

- `/manifest.webmanifest` 200 `application/manifest+json`; Chrome's manifest parser: no errors
- icons 200 `image/png`: `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`, `/apple-touch-icon.png` (180, edge to edge)
- `/sw.js` 200; the service worker controls the page after a reload
- Chrome `Page.getInstallabilityErrors` in a normal profile: `[]`
- network off: the front page opens, logo included; only `/api/` requests fail (by design — never cached)
- `npm test` passes; `npx playwright test --workers=1` 41/41

### Before the stores

- The domain (`jocularinsights.in`) connected to the paid server — Play checks the
  app against `https://<domain>/.well-known/assetlinks.json`; both stores
  need the privacy policy and a support address at the domain.
- Developer accounts enrolled as the company, not a person (the listing shows
  the name). Apple needs the company's D-U-N-S number first (free, 1–2 weeks).
- Listing copy in research language: no "winning stocks", "10x" or returns
  promised; SEBI's research-analyst rules and both stores' finance reviews.
- A lawyer's view on the app's wording and the Momentum tab (off on the
  public site) before the listing goes in.

## Stage 2: the Android app (17 Oct 2026)

What's built (`capacitor.config.ts`, `android/`, `src/ads.jsx`):

- A Capacitor 8 app (`com.jocularinsights.app`) that opens the live site
  (`APP_URL`, default https://stockwise-india.onrender.com — switch to the
  domain when it's live). Our icon and dark launch screen
  (`scripts/android-assets.mjs`), our own offline page that reconnects by
  itself (`public/app-offline.html`), status bar in the theme's colours.
- Ads only in the app, from Google AdMob: a medium native ad card after the
  third strategy and every sixth after it, and after every tenth stock row;
  "Watch an ad" in Settings → Support the app. Nothing is locked behind an ad
  (owner's choice: no credits). Google's consent form where the law asks for
  one. The website and the installed web app show none.
- The ads rule (20 Oct 2026, from reviews of other Indian screeners —
  replica/fixes.md): cards among lists and the opt-in rewarded ad only. Never
  a banner, a full-screen or app-open ad, a paid tier, or a loan or credit
  offer. `src/adsRule.test.js` (in `npm test`) fails if one is added; the
  Play listing promises it.
- The server's switch, set in Render — no new app release needed:
  `ADS=off` (default) | `test` (Google's sample ads) | `live` with
  `ADMOB_ANDROID_NATIVE`, `ADMOB_ANDROID_REWARDED` (and `ADMOB_IOS_*` later),
  and `ADMOB_PUBLISHER_ID` for `/app-ads.txt`.
- Google and Apple sign-in are hidden inside the app (Google refuses sign-in
  in an app's web view); email sign-in works. Native Google sign-in is a
  later step (`@capacitor-firebase/authentication`).

Checked on the Android emulator (Android 17, local copy, `ADS=test`): sign-in,
the phone layout, the medium ad card among the strategies and the stock rows
(Google's validator: "No implementation issues found"), "Watch an ad" played
to the end and was rewarded, the offline page and Try again, the launcher icon.

### AdMob (20 Oct 2026)

Account: **jocularinsights@gmail.com**, payments account "AdSense (India)",
publisher `pub-4001463380481442`. Payment profile: started; the "Payment
setup incomplete" banner still showed on 20 Oct — the account and the app are
reviewed only once it clears.

| | ID |
|---|---|
| App "Jocular Insights – Stock Screener" (Android) | `ca-app-pub-4001463380481442~5693283483` — in `android/gradle.properties` |
| Native advanced "List cards" | `ca-app-pub-4001463380481442/5035552798` |
| Rewarded "Support the app" | `ca-app-pub-4001463380481442/4217295148` |

None of these are secrets (they ship inside the app). On Render: `ADS=test`
until AdMob approves the app (Google's sample ads, so nobody taps our own
real ones), `ADMOB_ANDROID_NATIVE` and `ADMOB_ANDROID_REWARDED` set to the
units above, `ADMOB_PUBLISHER_ID=pub-4001463380481442` (serves
`/app-ads.txt`); then `ADS=live`.

### The owner's steps, in order

1. **AdMob account** (admob.google.com, signed in as the company's Google
   account): add the app "Jocular Insights" for Android; create two ad units —
   **Native advanced** and **Rewarded**. Note the app ID (`ca-app-pub-…~…`)
   and the two unit IDs (`ca-app-pub-…/…`).
2. **AdMob → Privacy & messaging**: create the GDPR consent message (and the
   US states one) — the app shows Google's form only once these exist.
3. **AdMob → Blocking controls**: block categories you don't want beside
   research — e.g. "Get rich quick", gambling, and, if you choose, trading
   and crypto apps. Ads stay Google's; you choose what's allowed.
4. **Google Play Console** ($25 once): create the app `com.jocularinsights.app`;
   new personal accounts must run a closed test with 12 testers for 14 days
   before production. Fill in the Data safety form for AdMob from Google's own
   guide ("Prepare your app for Data safety", AdMob help) — it lists what
   the ads software collects (device IDs, app interactions and more).
5. Give me the AdMob app ID and the two unit IDs; I set `ADS=live` and the
   `ADMOB_*` variables in Render, build the signed release
   (`./gradlew bundleRelease -PADMOB_APP_ID=…`, with an upload key you keep),
   and you upload the `.aab` to Play.

What the ads earn depends on how many people use the app and where they
are; rates for Indian users are among the lower ones, so ads add up only
with thousands of daily users. AdMob's reports show the real figures once
live ads run.

### Deploys and the 20–30 second gap (20 Oct 2026)

The service has a disk (accounts database, market data), and Render can't
hand a disk from the old server to the new one without stopping the old one
first, so every deploy leaves 20–30 seconds in which Render answers with its
own "502 Bad Gateway" page (logs, 20 Oct: "Deploying…" 10:12:03, server up
10:12:21, live 10:12:31). Our server itself starts in under a second.

What the app does about it:
- `src/api.js` waits out Render's 502 page (HTML; our own errors are JSON),
  retrying for up to ~45 s with "Jocular Insights is updating — reconnecting…"
  showing (`main.jsx`). Writes are sent again too: that page means the
  request never reached the server. A dropped connection is not retried —
  that's being offline. Tested in `src/apiRetry.test.js`.
- `public/sw.js` opens the last copy of the app for a page that gets the
  502, so a reload mid-deploy shows the app, not Render's page. A first-ever
  visit during the gap still sees Render's page.

To make deploys gapless the disk has to go: accounts in a managed database
(Render Postgres, or a hosted SQLite such as Turso) and the market data
pulled in at start (`DATA_JOBS=pull` already does). Not done — a migration of
every account query. Until then, push outside market hours when possible.

### Email: sign-up codes and password reset (20 Oct 2026)

Anyone could type any email at sign-up. With email set up, sign-up now
sends a 6-digit code and makes the account only when it comes back
(15 minutes, five tries); "Forgot password" switches on with the same
settings. Without them sign-up works as before. A verified Google sign-in
with an email whose account was never proven takes it over (the typed
password is removed, its sessions end).

The owner's steps (Claude doesn't sign up or paste keys):
1. resend.com — sign up with jocularinsights@gmail.com (free: 3,000
   emails a month, 100 a day).
2. Domains → Add domain → `jocularinsights.in`; add the DNS records Resend
   lists (an MX and a TXT on `send`, a TXT on `resend._domainkey`) where the
   domain's DNS is managed, then Verify.
3. API Keys → Create API key (sending access) → copy it.
4. Render → stockwise-india → Environment: `RESEND_API_KEY` = the key,
   `EMAIL_FROM` = `Jocular Insights <no-reply@jocularinsights.in>`,
   `APP_URL` = `https://jocularinsights.in` → Save (it redeploys).

