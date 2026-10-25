# Jocular Insights — test plan

Run: `npm run e2e` (build, then Playwright on a private copy at 127.0.0.1:8793 with
the real market data, a throwaway accounts database, no background jobs, system
Chrome). Unit and HTTP checks: `npm test`. Every e2e test fails on a console error
or a 5xx from our server; `e2e/sweep.spec.js` also writes an accessibility scan
(axe, WCAG A/AA, serious and critical) to `test-results/axe.txt`.

There is no recon map for this app (it wasn't built as a clone), so the flows
below come from the app itself. ✅ = automated and passing, 👁 = checked by hand
in the browser, ⏳ = needs the project owner (real accounts or services).

## F01 Accounts
| Case | What | How |
| --- | --- | --- |
| F01-H1 | Sign up with email on the front page, land signed in | ✅ flows |
| F01-H2 | Sign out from the Account menu | ✅ flows |
| F01-H3 | Sign in again | ✅ flows |
| F01-N1 | Wrong password is refused with a message | ✅ flows |
| F01-N2 | Too-short password is refused | ✅ flows |
| F01-N3 | Same email twice (any case) is refused, 4xx not 5xx | ✅ flows |
| F01-E1 | Signed-out API calls (watchlist, portfolio, alerts, stock, logo) get 401 | ✅ flows |
| F01-E3 | Session ends mid-use → back to the sign-up page, not a broken page | ✅ edges |
| F01-H4 | Google / phone sign-in | ⏳ only works on localhost:5175 and the live site (Firebase domains) |
| F01-H5 | Password reset email | ⏳ needs RESEND_API_KEY on the server |

## F02 Discover
| Case | What | How |
| --- | --- | --- |
| F02-H1 | Sector + name filter narrow the list | ✅ flows |
| F02-E1 | No matches says why ("None of these N companies match…") | ✅ flows |
| F02-H2 | Share link opens the same screen in a new tab | ✅ flows |
| F02-H3 | Excel and CSV exports download a real file | ✅ flows |
| F02-H4 | Tick two rows → Compare | ✅ flows |
| F02-E2 | Watchlist only shows exactly the watched companies | ✅ edges |
| F02-E3 | Keyboard only: `/` focuses search, arrows + Enter open a company | ✅ edges |

## F03 Company page
| Case | What | How |
| --- | --- | --- |
| F03-H1 | Search → company page → Back to Discover | ✅ flows |
| F03-H2 | One page per valuation model: bank, cyclical, loss-maker, short history, NBFC lender, holding company, re-rated compounder, steady earner — each says its model and reason | ✅ sweep |
| F03-E1 | Browser back/forward between Discover and a company | ✅ edges |
| F03-N1 | Unknown symbol says so | ✅ flows |
| F03-H3 | Bank page shows recent ROE and the 7-year figure beside it (PNB) | 👁 |
| F03-H4 | Logo beside the name; Account → Company logos off removes it, survives reload | ✅ flows (F08) |

## F04 Watchlist
| Case | What | How |
| --- | --- | --- |
| F04-H1 | Watch from the company page, add a note with accents/emoji, survives reload, remove | ✅ flows |
| F04-E1 | A note longer than the limit isn't cut off silently | ✅ edges (was BUG-003) |

## F05 Portfolio
| Case | What | How |
| --- | --- | --- |
| F05-H1 | Add, edit, remove a holding | ✅ flows |
| F05-H2 | Import a broker CSV; an unknown symbol is listed, not imported | ✅ flows |
| F05-N1 | A made-up ticker is refused with a message | ✅ flows |
| F05-E1 | Double-click on Add adds one holding | ✅ edges |

## F06 Alerts
| Case | What | How |
| --- | --- | --- |
| F06-H1 | Set an alert from the company page, see it in Alerts, delete it | ✅ flows |
| F06-E1 | Double-click on Create alert makes one alert | ✅ edges |
| F06-H2 | Telegram delivery | ⏳ needs the bot key and a real chat |

## F07 Privacy between accounts
| Case | What | How |
| --- | --- | --- |
| F07-N1 | A second account sees none of the first's watchlist or portfolio | ✅ flows (and `npm test` covers alerts/notes ownership) |

## F08 Settings and other tabs
| Case | What | How |
| --- | --- | --- |
| F08-H1 | Theme and logo switches persist across a reload | ✅ flows |
| F08-H2 | Momentum, Performance, Alerts, Portfolio, Watchlist tabs open with a heading, no errors | ✅ sweep, 👁 content |

## F09 Delete account
| Case | What | How |
| --- | --- | --- |
| F09-H1 | Delete with password → signed out, the login no longer works | ✅ flows |

## Phone (Pixel 7 size)
| Case | What | How |
| --- | --- | --- |
| P-1 | Discover, a bank page and TCS don't scroll sideways | ✅ sweep |
| P-2 | Privacy and disclaimer pages fit | ✅ sweep |
| P-3 | Add a holding and open Alerts from the bottom tab bar | ✅ edges |

## M — the installed app (17 Oct 2026, `e2e/mobile.spec.js`)
The site as an app on a phone (the PWA, `replica/deploy.md` stage 1). Run in the
phone project; M-E3 is skipped on desktop, which has no bottom tab bar.
| Case | What | How |
| --- | --- | --- |
| M-H1 | `/manifest.webmanifest` is `application/manifest+json`, name, `standalone`, a 512 maskable icon; every icon and `/apple-touch-icon.png` 200 | ✅ mobile |
| M-H2 | The service worker controls the page after a reload; Chrome's installability check has no errors (bar "in-incognito", a test browser's private window) | ✅ mobile |
| M-H3 | On an iPhone: Account → Install the app shows the Add to Home Screen steps | ✅ mobile |
| M-E1 | Offline: the front page opens, logo included (from the copy made at install) | ✅ mobile |
| M-E2 | Offline: `/api/` fails — market data is never served from a copy | ✅ mobile |
| M-E3 | Bottom tabs and header buttons at least 44 × 44 px | ✅ mobile |
| M-N1 | Settings → Sign out works on a phone (BUG-005; the Account menu moved to Settings) | ✅ mobile |
| M-N2 | No hand-written counts on the front page (BUG-006) | ✅ mobile |
| M-H4 | The floating bar has Discover, Watchlist, Portfolio, Alerts, Settings; Settings switches dark mode and opens Strategy performance (bar keeps Settings lit) | ✅ mobile |
| M-H5 | Strategies: the kind chips and Search strategies narrow the cards; a search with no match says so | ✅ mobile |
| M-H6 | A strategy's stocks: a sort chip sorts, tapping it again reverses | ✅ mobile |
| M-E4 | Ads: the server's switch is off by default, no app-ads.txt without a publisher ID, none on the website; ?ads=preview shows where they go | ✅ mobile |
| M-R1 | Install on a real Android phone from Chrome's prompt; opens full screen with the icon | ⏳ needs the pushed site |
| M-R2 | Add to Home Screen on a real iPhone; status bar and safe areas look right | ⏳ needs the pushed site |

## A — the Android app (17 Oct 2026, by hand on the emulator, Android 17, `ADS=test`)
| Case | What | Result |
| --- | --- | --- |
| A-1 | The app opens the site; sign in with email; the phone layout as on the web | 👁 pass |
| A-2 | A medium ad card after the third strategy, in the app's colours; Google's validator: no implementation issues | 👁 pass |
| A-3 | An ad card after the tenth stock row | 👁 pass |
| A-4 | Settings → Watch an ad: Google's sample video plays, is rewarded, "Thank you" | 👁 pass (after the fix below) |
| A-5 | No network: our offline page; Try again returns to the app | 👁 pass (reconnecting by itself needs https — the live site) |
| A-6 | Our icon in the app list; dark launch screen; status bar dark with light icons | 👁 pass |
| A-7 | Google sign-in hidden in the app (Google refuses it in a web view) | 👁 pass |
| A-8 | A real phone, real ads, Play's pre-launch report | ⏳ needs the owner's AdMob and Play accounts |

Found and fixed on the way: on an emulator or a registered test phone the ad
plugin ignores its own test switch and asks for the ad unit it's given — with
none it got "no fill". The server now hands out Google's published sample
units in test mode. Seen only on the emulator: rows drawn twice while
scrolling with its software renderer (SwiftShader) — gone with `-gpu host`,
so not the app.

## Not covered (and why)
- Payments: none built yet.
- Real devices: emulated phone only; a real iPhone/Android pass is still pending.
- Offline: automated for the installed app (M-E1, M-E2). Slow network: not automated yet.
- Time zones: the app shows NSE dates as filed; the alert schedule is IST-only by design.
