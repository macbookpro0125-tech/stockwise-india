# Log

Newest first. One line per piece of work; the commit message has the detail.

## 1 Nov 2026 (overnight debug, asked for "debug everything, start to last")

- **1 Nov:** Fixed: since the app began waiting for the logo, the page's hide-until-drawn rule hid the opening's first 2.2s in the Android app, showing only the boot spinner. Check the opening with an app user agent, in real time.
- **1 Nov:** The opening's start: the point of light waits 0.4s where it can be seen and the line eases in and out (owner: too fast, the dot wasn't visible). 3.15s in all.
- **1 Nov:** The opening: the app now waits for the logo to land before building (`AfterOpening`, main.jsx), so the film has the phone to itself; the logo holds until the app has drawn.
- **1 Nov:** The opening's last part: the logo's flight into the page's logo was jumping straight to the end (a CSS transition taking over from its arrival animation). Now a real glide, 885 ms (30% slower), as the owner asked.
- **1 Nov:** Pushed to main at `c20da4a` (15 commits); live, with the health check, a stock page and /desk answering.
- **1 Nov:** The opening rebuilt for Android lag: only opacity and transform move, from precomputed keyframes and CSS delays, so the app loading behind can't stall it. Janky frames on the emulator fell from about 47% to 17–27%. The travelling shimmer and the logo's blur-in are gone.
- **1 Nov:** Android 1.2 (build 4) built and signed for the Play launch; checked on the emulator (screens, haptic, push token). AdMob reports "Publisher misconfiguration" for the real app ID until the account and store link are done.
- **Full run:** unit tests pass; all 136 end-to-end tests pass (24 skipped by design); the build is clean apart from the usual large-file warning. The live site's 10 public pages answer in under a second.
- **Fixed bugs:**
  - The Desk was stuck on "Loading" when its last list was a deleted screen; it now falls back to every company.
  - The market mood could hand out the previous day's answer while the new one was being worked out.
  - Desk and My desk on a narrow window: they stack instead of scrolling sideways or squeezing.
  - The mood bar says "Working out the market's mood…" while it loads.
- **Accessibility:** the scan of every page went from about 30 serious findings to none. Fixed:
  - footer links that were too faint
  - the "Strong/Fair/Weak" badges' labels
  - low-contrast return labels, Explore badges and dates
  - the Desk's change badges, facts list and stage tag
- **The sweep test** now covers Desk and Market map, and its time limit went up to 3 minutes.

## 31 Oct 2026

- **Price strength showed "—" locally.** The 23 Oct data file has no 9-month returns. They're now worked out from the kept daily prices, so 2,109 of 2,263 companies have a strength locally. Live had them all along (Cupid 98, TCS 56).
- **`handoff/` folder made**, so another AI or account can pick up without re-reading everything.
- **My desk: drags.** A drag released over the chart never ended, because the chart swallowed the release. It now listens in the capture phase. Titles no longer select their text; narrow cards hide their score columns.
- **My desk: free grid** (12 columns). Drag a card by its title, resize it by its corner, or use the keyboard (arrows move, Shift + arrows resize). Saved per account.
- **Desk restyled the Apple way.** The owner wanted the same concept with Apple polish, not the three-pane mockup (`~/Projects/files/desk-apple-mockup.html`).
- **My desk** with 10 cards, saved per account.
- **Market mood and patterns** on the Desk, from each company's daily bars. It takes about 3 seconds for all companies, once a day.
- **Desk became its own page and tab,** at the owner's request ("I want it separate page"). Inspired by a competitor's workspace: no copying of words, design or code.
- **Workspace renamed Screen builder.**
- **Stock pages:**
  - the fair-value hint and same-industry peers
  - Search Console checked: 31 pages indexed, about 1,270 impressions and 9 clicks in 28 days
- **Pushed** the "no words" opening and everything before it (`af9b6ca..a3fffd0`), after all tests passed. The 3D opening went to a stash.

## 30–31 Oct 2026 (already live)

Screens on a computer:
- the filter board and the Screen builder
- price strength 1–99

Market map:
- a page of its own, plus a sector brief
- an industry map on company pages

Charts:
- Heikin Ashi, Renko, Fibonacci levels and trend lines

Compare, and portfolio against the market.

Screen alerts: "a company joined your screen".

Visitors are counted only when the app actually starts in a browser.

BSE sectors fill in companies NSE doesn't classify.

The `/learn` guides, IndexNow, the new tab icons, and the opening animation.

## Earlier

- **23 Oct:** News/Explore went live. The repo history was rewritten to remove a competitor's name; old clones must never be pushed.
- **17–23 Oct:** ChatGPT pushed half-done work twice; the owner stopped using it on this repo.
- **1 Nov 2026 (Claude Opus):** Filmed the opening in the Android app and fixed what the films showed: white web view, an empty gap before the film, the line half gone when first seen, and the logo fading out instead of flying (the app's header wasn't drawn yet; then the 3D sky stalled the flight). Native changes are in app 1.3 (build 5). On the emulator the front page's text still takes about a second to appear after the logo lands.
- **1 Nov 2026 (Claude Opus):** The Android opening's fixes (`4c19b85`) are live; the owner is checking on his phone.
- **1 Nov 2026 (Claude Opus):** Owner: small lag as the logo goes in, white screen on iPhone. Filmed on Android: the sky built under the flight, and the dot ran late. The page now builds before the flight, the dot and logo start together, and the first paint is dark. iPhone itself unchecked.
- **1 Nov 2026 (Claude Opus):** The opening's ending and dark first paint (`8348850`) are live; the owner is checking on his phones.
- **1 Nov 2026 (Claude Opus):** Search Console: front page and the sector pages not yet on Google requested. Confirmed: front page, consumer-durables, services, utilities. Unconfirmed (timeout): construction-materials, oil-gas-and-consumable-fuels, forest-materials.
- **1 Nov 2026 (Claude Opus):** The BSE lookup now also asks about companies with a sector but no industry (410, mostly large ones). Not yet run against BSE, which refuses this computer; the GitHub data job will.
- **1 Nov 2026 (Claude Opus):** My desk's cards have a visible edge, a tinted title bar and lines between list rows. The owner's words were unclear ("can't see the difference in between"); read as cards blending into the page.
- **1 Nov 2026 (Claude Opus):** My desk's cards are light glass over soft teal, violet and blue glows, with an accent glow under the pointer (computers only; a phone has no hover).
- **1 Nov 2026 (Claude Opus):** The owner asked for My desk's glass and glow on the whole app. Done at the end of `src/index.css` for the big cards; small rows stay plain, per their earlier dislike of glowing bubbles.
- **1 Nov 2026 (Claude Opus):** Pushed on the owner's word with 2 e2e tests failing, both also failing on main's styles while nseindia.com refused this computer: F04-H1 (clicks Add, moves on before the save returns; the POST awaits a listing check) and N-H3 (reads a filing from NSE). The add itself was seen working. Rerun them when NSE answers; F04-H1 may need a wait for the save.
- **1 Nov 2026 (Claude Opus):** iPhone recording: about 2.5 s of white, then the film with its line already drawn. Held the film's clock and removed the pale first paint; launch screen dark in `ios/` for the next build.
- **1 Nov 2026 (Claude Opus):** The glow showed the phone stock bar's solid colour as a box: the bar now runs edge to edge under the header.
- **1 Nov 2026 (Claude Opus):** iPhone opening fixes and the phone stock bar are live. Full tests: 135 passed, N-H3 failed (needs NSE, unreachable from this computer); F04-H1 passed, so it was a timing failure. A Watchlist quick-action sheet was mocked up and parked by the owner.
- **1 Nov 2026 (Claude Opus):** iPhone Home Screen: Google sign-in hung for ever, a limit of pop-ups there. Hidden there, with a note; Safari keeps it. Not checked on a real iPhone.
- **1 Nov 2026 (Claude Opus):** From the owner's recording: the sign-in card showed the email step until the server's sign-in options arrived. It now waits for them; with no answer it still falls back to email.
- **1 Nov 2026 (Claude Opus):** Performance: a screen's name opens the screen and its companies (through `?strategy=`), as the owner asked.
- **1 Nov 2026 (Claude Opus):** Chart upgrade from the owner's broker-app screenshots. Left out: intraday timeframes, open interest, plain VWAP (no such data); Anchored VWAP runs from the year's start only, and indicators have no settings for their periods. A second chart click within 0.5 s counts as a double click, so it's ignored.
- **1 Nov 2026 (Claude Opus):** Phone's full-screen chart matched to the owner's Kite screenshot, in our own colours; no Buy/Sell, rotate or refresh buttons.
- **1 Nov 2026 (Claude Opus):** Chart upgrade, Performance link and sign-in fixes are live. Tests: 136 passed, N-H3 failed (needs NSE, unreachable from this computer). D-1 passed here but failed some runs earlier (`.desk-title span` matched 2 elements), not yet explained. Minute and hour charts declined by the owner for now: they need paid licensed data.
- **1 Nov 2026 (Claude Opus):** Desktop: the second logo removed and the Screen builder and Desk icons told apart (sliders, monitor).
- **1 Nov 2026 (Claude Opus):** The owner didn't like the header logo removed: put back. Keep both logos on a computer.
- **1 Nov 2026 (Claude Opus):** New signed-in computer home, committed locally for the owner to judge. Phones keep their own home. `ScreensHome.jsx` now serves no computer page.
- **1 Nov 2026 (Claude Opus):** Home: the opening is one screen and stays put; Market summary rises over it like a sheet, peeking at the bottom of the first screen.
- **1 Nov 2026 (Claude Opus):** Home's sky: the owner asked for J and I to travel and collide. Built in CSS (`.td-meet`); not yet live.
- **1 Nov 2026 (Claude Opus):** J and I collision removed: the owner found it ugly.
- **1 Nov 2026 (Claude Opus):** J and I collision rebuilt to be simple, as the owner asked: thin white letters, a soft pulse, one hairline ring. No tails, burst colour or logo.
- **1 Nov 2026 (Claude Opus):** Collision dropped at the owner's word: J and I are now constellations floating slowly and freely.
- **1 Nov 2026 (Claude Opus):** Home's sky and product shot redrawn for sharp screens at the owner's request.
- **1 Nov 2026 (Claude Opus):** Home: more room between and inside the Market summary sections.
