# Deploy — Jocular Insights

Scope so far (17 Oct 2026): the mobile app only, at the owner's request.
The web host, domain and email sections are filled in when those go live.

## Mobile

| Stage | What people get | Cost | Status |
|---|---|---|---|
| 1. Installable web app (PWA) | Install from the site on Android and desktop; Add to Home Screen on iPhone; full screen with its own icon; opens offline | free | **Done** — `390fe56`, not yet pushed |
| 2. Google Play (Trusted Web Activity) | A Play Store listing running the same app | $25 once (Google Play developer account, owner's) | Waits for the domain and the paid server |
| 3. Apple App Store (Capacitor shell) | An App Store listing, with push notifications for price alerts — Apple rejects a website in a wrapper (guideline 4.2) | $99 a year (Apple developer account, owner's) | Waits for the domain, the paid server (alerts run there), and a D-U-N-S number to enrol as the company |

### Stage 1 checks (run 17 Oct 2026, local copy)

- `/manifest.webmanifest` 200 `application/manifest+json`; Chrome's manifest parser: no errors
- icons 200 `image/png`: `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`, `/apple-touch-icon.png` (180, edge to edge)
- `/sw.js` 200; the service worker controls the page after a reload
- Chrome `Page.getInstallabilityErrors` in a normal profile: `[]`
- network off: the front page opens, logo included; only `/api/` requests fail (by design — never cached)
- `npm test` passes; `npx playwright test --workers=1` 41/41

### Before the stores

- The domain (jocularinsights.com) live on the paid server — Play checks the
  app against `https://<domain>/.well-known/assetlinks.json`; both stores
  need the privacy policy and a support address at the domain.
- Developer accounts enrolled as the company, not a person (the listing shows
  the name). Apple needs the company's D-U-N-S number first (free, 1–2 weeks).
- Listing copy in research language: no "winning stocks", "10x" or returns
  promised; SEBI's research-analyst rules and both stores' finance reviews.
- A lawyer's view on the app's wording and the Momentum tab (off on the
  public site) before the listing goes in.
