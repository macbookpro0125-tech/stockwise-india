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
| Google sign-in on the domain | **Not yet**: Firebase's authorized domains lack jocularinsights.in, and the Firebase console needs 2-step verification on the owner's Google account before anyone can add it |
| Password-reset email | Not set up: a Resend account, its DNS records at Domain India, then `RESEND_API_KEY` and `EMAIL_FROM` |
| Telegram alerts | Not set up on the server: `TELEGRAM_BOT_TOKEN` |

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
