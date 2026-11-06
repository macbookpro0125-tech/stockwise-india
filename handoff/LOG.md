# Log

Newest first. One line per piece of work; the commit message has the detail.

## 5 Nov 2026

- **5 Nov:** Pushed `11d1e3b..4c78350`: Markets page, What to watch timeline, full-width news, map logos, coloured results bars. Live in about 80 s.
- **5 Nov:** Pushed `11d1e3b` (chart red/green line, full-screen height): live in about 80 s. What to watch: Lately and Coming up, committed.
- **5 Nov:** Pushed `37c74e9..e2d1eab` (home: wider, clickable cards, results names): live in about 100 s. Flaky test noted: F03-E1 in `e2e/edges.spec.js` (7 HDFC Bank headings for a moment after Forward).
- **5 Nov:** Pushed `a0c4571..37c74e9` (solid surfaces, faster opening): live in about 90 s, with a brief 502 during the switch-over.
- **5 Nov:** Play listing rewritten for "stocks"/"screener" searches and filled in Play Console as a draft (owner away; AI declaration and sending are theirs).
- **5 Nov:** The opening "stays long, gets stuck": on a computer the logo sat about 1 s after the film waiting for the page, which only started building at 2.75 s. A computer now starts at 1.5 s (`APP_START_MS_COMPUTER`) and waits at most 0.6 s. Signed out: 5.4 → 4.4 s.
- **5 Nov:** Solid top bar and cards on a computer (the owner: the page showed through while scrolling).
- **5 Nov:** The stars stay as they are (owner).

## 4 Nov 2026

- **4 Nov:** Pushed `e741f7a..a0c4571` (desktop speed): live in about 80 s.
- **4 Nov:** Desktop lag: per-card blur removed, the strip and sky pause while scrolling, the sky is hidden when covered, and the sheet's glows are no longer fixed. Measurement note: the browser pane caps any endless animation near 38 fps on this Mac, and headless Chrome without a screen shows false GPU backpressure; check on a real computer.
- **4 Nov:** Pushed `3885578..e741f7a` (phone batch, /builder): live in about 90 s.
- **4 Nov:** The owner's phone list:
  - Favourites, when empty, is one line, and the computer's Market summary now shows on a phone's home.
  - In short shows the overall score at the top right.
  - "What it does" is a paragraph built only from filings.
  - The quarterly view gets the latest quarter's tiles and 8-quarter bars; quarters no longer say "a year over N years".
  - Crowded bar charts show the first, last and tapped values only.
  - A finger on the price numbers stretches or squeezes the scale.
- **4 Nov:** Screen builder at `/builder` on a computer, so a reload stays there and other pages go back to `/`. New test `e2e/builder-address.spec.js`; full suite 138 passed.
- **4 Nov:** Play: 1.3 approved and published to closed testing (3 Nov). 12 testers for 11 of 14 days, so production access can be applied for around 7 Nov. Trader status still to declare (owner).
- **4 Nov:** Pushed the chart type list at `3885578` (full tests passed first).

## 3 Nov 2026

- **3 Nov:** Phone chart: chart types as a one-column list instead of a grid of tiles.
- **3 Nov:** Pushed the phone chart fixes at `157e5bb`; live in about 80 s.
- **3 Nov:** Pushed the guides (`77de96a`). Phone chart: scale stays fitted, no gap at the bottom, a plain icon row like Kite's (owner: "this all look cheap").
- **3 Nov:** 11 more Learn guides (22 in all), for AdSense's content review. AdSense and AdMob both "not approved"; not resubmitted (plan: AdSense in 2–3 weeks, AdMob after the Play listing is public).
- **3 Nov:** Play: 1.3 (build 5) uploaded by the owner and sent for review as the closed testing release, with release notes.
- **3 Nov:** Pushed to main at `83c223d` (3 commits); live, with the health check answering. Full tests passed first (137 passed, 24 skipped).
- **3 Nov:** Market map: the zoom buttons sit below the map instead of over its bottom-right companies (owner: "covering last stocks").
- **3 Nov:** News: a "usually good / bad news" box on each announcement and a tag on its row (owner: "just show whether it is good or bad news for the stock"). A general reading of the words, never guessed: an "Orders passed" with no detail says "Not clear from the notice".
- **3 Nov:** The home's picture fades out above "See every screener", so the button doesn't cover a company row. Google: requested ETERNAL, HAL, BEL, DMART; ASIANPAINT and BAJFINANCE are already on. Lemon Tree's industry label is live.

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
- **1 Nov 2026 (Claude Opus):** Home's opening has a light-theme version (pale sky, blue stars, light product shot): black looked wrong between white chrome.
- **1 Nov 2026 (Claude Opus):** Home: stars and moving things removed from the light theme at the owner's word; dark keeps its sky.
- **1 Nov 2026 (Claude Opus):** Stars back on the light theme, at the owner's word: the pale sky with blue stars.
- **1 Nov 2026 (Claude Opus):** Light theme's pale sky dropped at the owner's word: the opening is the black sky with white stars in both themes.
- **1 Nov 2026 (Claude Opus):** Light theme: header and left bar turn black while the home's sky is on screen, white again once the sheet covers it.
- **1 Nov 2026 (Claude Opus):** Home's cards are glass over soft colour with a hover glow and lift; the Nifty chart refits when its box changes size.
- **1 Nov 2026 (Claude Opus):** Home's list of pages is now three labelled groups, the owner's pick.
- **1 Nov 2026 (Claude Opus):** Home's sky refined: a third fewer specks, wider clear space behind the words, more violet and blue; product picture now the company list.
- **1 Nov 2026 (Claude Opus):** Stock page: the glass and glow came off the whole-width sections (`ss-section`); only the cards in them keep it.
- **1 Nov 2026 (Claude Opus):** New computer home pushed. 137 tests passed before one late CSS fix (glass off `.ss-section`, the owner's screenshot); 15 chart, home and general tests rerun after it, passing. Not checked: the moving sky on real slower laptops (46 fps in the test browser); after Screen builder, `/` stays on the builder.
- **1 Nov 2026 (Claude Opus):** Home's Nifty chart was empty in the owner's Safari: its fill used color-mix(), now plain rgba. Not tested in Safari here.
- **1 Nov 2026 (Claude Opus):** Market summary rearranged: market, your companies, screeners, then the page menu; the chart is the one main card.
- **1 Nov 2026 (Claude Opus):** Home's cards stand out at rest: lighter glass, clearer edge, soft halo.
- **1 Nov 2026 (Claude Opus):** Home's card colour halved at the owner's word: they looked dull.
- **1 Nov 2026 (Claude Opus):** Colour behind the home's Market summary cards halved at the owner's word.
- **1 Nov 2026 (Claude Opus):** Home's cards given light and depth: gradient surface and edge, softer inner lines, no chart gridlines.
- **1 Nov 2026 (Claude Opus):** Home's cards: a soft glow follows the mouse across each card.
- **2 Nov 2026 (Claude Opus):** Pushed Market summary's rearrangement, card lighting, mouse glow and Safari chart fix. 137 tests passed, none failed. Owner to check the chart in Safari.
- **2 Nov 2026 (Claude Opus):** Search Console: 5 sectors requested on 1 Nov are on Google; requested IRCTC, TITAN, ITC, then quota. Industry labels unchanged until the 16:30 IST job.

## 5 Nov: watchlist rows show the added price and date
Each row: "Added ₹2,530 · 5 Nov 26 +1.2%" under the name (the price stored when starred, server added_price); the note moves to its own line. Test C-3 in e2e/compare.spec.js.

## 5 Nov: Watchlist and Screen builder navigation
- The left bar's Watchlist goes straight to its page (it opened a peek). Portfolio and Alerts still peek.
- Screen builder picked from another page opens the builder at /builder (it jumped back to the screeners: DiscoverView started on the screeners step since the address was "/").
- The Watchlist page waits for a star still saving, so one just added shows.
Tests R-H1 (rewritten), R-H2 (new).

## 5 Nov: the screen chart takes any two scores, and a box
QualityValueMap.jsx: Up and Across pickers (quality, research, the five factor groups, valuation, price trend, risk, P/E), a swap button, the corners named and coloured for the pair (green both at their good end; risk and P/E are better low); dragging on the chart draws a box and the side lists "In your box · N" with its ranges; X clears it. The pair is remembered on the device. Tests: qualityValueMap.test.js, e2e/scorechart.spec.js QV-1.

## 5 Nov: the home news cards in Safari
Safari stretched each "What's new today" card to the panel's height (`.td-news .ap-news-item { height: 100% }`), so they spilled over Read the news and All screeners. Now height auto; the grid evens each row. The same filing sent twice (Sai Life Sciences, results at 12:12 AM and the day before) shows once. N-H1 checks both.

## 5 Nov: the home sky hidden once covered
Owner: scrolling the screeners page sometimes shows "the back page in between, cutting". The home's night sky (.td-hero) is sticky behind the sheet; Safari drew the sheet late in bands while scrolling fast and the dark sky showed through. Now `.td-hero.td-still { visibility: hidden }` (and the sky's will-change and drift off) once the sheet covers it; it returns at the top. Not checked in Safari itself (no WebKit here). Test N-H9.

Follow-up (owner's screen recording, 10.38 PM): mid-scroll through the screeners Safari dropped the whole sheet for ~1.5 s and the pinned hero ("India's markets, read from the source.") filled the screen. Covered, the hero is now also `position: relative` (unpinned; same place in the flow), so Safari has no pinned layer under the page. N-H9 checks it unpins, the page scrolls on, and it pins again at the top.

## 6 Nov: the top bar replaces the left bar on computers
TopBar.jsx (rendered by Header.jsx when not a phone): flat and edge to edge after TradingView (owner's screenshot, "this looks clean, I need like this for the top bar"), after a glass/capsule version the same night. Mark and name, a rounded search (/), the pages as words (Screeners, Screen builder, Desk, Markets, Explore, Map, Watchlist, Portfolio; the current one white with a teal line), then the alerts bell, light/dark and the account as an initial (AccountMenu avatar + pages: Performance, Momentum, Visitors). A backing and hairline once scrolled. Narrow windows: the name goes, then the search becomes a button that opens the field. SideRail only on a company page (its chapters); its light/dark button is gone. Picking the page you're on again closes an open news item/index/section on Explore (App.goTab). Markets got its side margin (.mk). Tests: topbar.spec TB-1 new; fixtures openPage, sweep, flows R-H1/F02-H8/F08-H1, builder-address, news N-H5 updated. 149 passed.

## 6 Nov: stock lists for search (/lists)
After the visitor review (Google starting to send people to screens pages; X 2 visits a month), owner said "make more". server/seo-collections.js: 25 pages under /lists — the 6 NSE indices (Nifty 50, Next 50, Bank, Midcap 150, Smallcap 250, Nifty 500) and 11 NSE themes (defence, railway PSU, EV, PSU banks, energy, digital, capital markets, housing, manufacturing, tourism, healthcare) from the snapshot's screenIndices/themes; stocks under ₹50/100/500, debt-free, high dividend yield, low P/E, 52-week high/low as plain rules said on the page. Index members we have no figures for are named (HDFCLIFE, SBILIFE). sitemap-lists.xml; /api/public/lists[/slug]; the app's ListsIndexPage/ListPage (PublicLists.jsx); links from the footer, the home's site pages, /screens, /sectors. Test S-H6.

## 6 Nov: 8 more lists and a Share button
Large/mid/small caps by SEBI's size bands (top 100, next 150, the rest), high ROE (20%+), high ROCE (25%+, not lenders), high promoter holding (70%+), Piotroski 8-9, penny stocks under ₹10 (with a plain warning). No promoter-stake-change list: no such figure in the metrics. A Share button on every list, sector and screen page (PublicLists.jsx ShareButton): the phone's share sheet, else WhatsApp with the message ready; the person sends it. 33 lists. S-H6 extended.

## 6 Nov: top bar colour over the night sky (light theme)
Owner's Safari screenshot: on the home in light mode the bar was clear, showing the light page behind the dark theme's pale words (td-night gives the header dark variables). Now black there, joining the sky; past the sky the normal light bar. Test TB-2.

## 6 Nov: share pictures and 7 more lists
scripts/og-cards.mjs makes a 1200x630 card per list, sector and screen (86) into public/og/{lists,sector,screens}/<slug>.jpg from a running server's public API, in the style of og/default.png; no figures on the cards (the panel's bars are a drawing). seo.js ogCard() + pageHtml image: those pages' og:image/twitter:image point at their card when it exists, else the default. Re-run the script after adding a list. New lists: PSU (NSE flag/govt 50%+), F&O (NSE list), high FII (30%+), high DII/mutual funds (25%+), profit growth (25%+/yr 3y), sales growth (20%+/yr 3y), cash-rich (net cash 15%+ of value). 40 lists. S-H6 checks the picture.

## 6 Nov: latest results page, figures in results titles
Search Console (28 days): 5.57K impressions, 14 clicks, average position 66; "bharat electronics q2 fy27 results" showed /stock/BEL/results/q2-fy27 735 times at about position 10 with no click. So: a quarter's results page now titles itself with its figures ("Bharat Electronics Q2 FY27 results: profit up 19.7% to ₹1,540 cr, sales up 26.5% | BEL"; a loss or a loss-to-profit swing gets no percentage; seo-pages.js resultsTitle). New /results (seo-pages.js latestResults/latestResultsPage): every company whose latest quarter was filed in the two weeks of filings to the newest one we hold, by filing day, largest first, sales and profit with YoY ("—" where either quarter was a loss), the biggest profit growth among ₹5,000 crore+ companies as from-to amounts; in the details sitemap, linked from each results page, /explore, both calendars, the footer, the home's market pages and Visitors' page names. Compact five-column table on phones (index.css .lr-table). Tests: seo-test (titles, /results), e2e S-H7. handoff/COSTS.md (the owner's spending record) is kept out of git (.git/info/exclude): the repository is public.
- 6 Nov: Search Console: /lists requested (Google had never seen it: "URL is unknown to Google"); /lists/defence-stocks refused twice ("Something went wrong", likely the daily limit) — try again tomorrow with the other lists, and /results once it is live.
- 6 Nov: Saudi Arabia visits and Google clicks are the owner (confirmed); real Google visitors in 28 days ≈ 5 (India 4, US 1).
- 6 Nov: charts leave one empty candle after the last instead of three (PriceChartPanel rightOffset and the period buttons); on a weekly chart three read as three empty weeks (owner, CUPID).
- 6 Nov: phone charts: the price column is as wide as its longest label, so labels drop ".00" (and decimals from ₹100 up, as before) and volume reads "200M"; the column is ~14px narrower at 375px. Hiding the volume pane's scale (priceScale visible:false on pane 1) blanked the whole chart — don't.
- 6 Nov: /results said "The 400 companies" live — 400 is the page cap; now "N companies filed … the latest 400 are below". Committed, not pushed.
- 6 Nov: data-refresh.yml "Weekly copy": a dated release data-YYYY-MM-DD (pack + manifest, prerelease, never "latest") when the newest weekly copy is 6+ days older than the prices; the newest 8 kept. Logic simulated locally; committed, not pushed (a push of the workflow runs it once).
- 6 Nov: Home (.td) and Markets (.mk) were capped at 1480px, leaving ~100px bands either side on a 1680px window; now 2400px (only very wide monitors are capped), so both line up with the top bar like every other page. Checked at 1680px: Home, Markets, Explore, a company page; Builder, Desk, Map, Watchlist, Portfolio were already full width.

## 6 Nov: news in plain words (no AI)
Owner: "the news is not understandable". Looked at 10 apps (Inshorts' one-line cards, Perplexity's why-it-moved, Kotak's good/bad tags, Trendlyne and Moneycontrol's your-stocks-first, Koyfin's importance filter, Zerodha Pulse's uncurated feed as the warning). src/newsPlain.js: rules, no AI, turn each NSE filing into one plain sentence from its own words and figures ("Won orders worth ₹428.55 crore", "Declared an interim dividend of ₹14.4 a share", "New CFO: Mr Satish Kumar Kaushik", "Splitting each share into 5", results with figures as "Q2 FY27 results: profit up 20% to ₹1,540 cr, sales up 27%") and a weight: big, normal, minor (paperwork, routine director changes, investor meets). The filing's own text decides; filings bundled with it only fill a gap (a new CFO beside the one who left reads as the new one). Checked on 330 real filings. NewsView: rows lead with the plain line (the kind a small label under it); All shows Your companies (watchlist) first, the latest day's company news (big first), Market headlines (5, "All headlines"), then earlier days; each day's minor filings fold into "N routine filings"; filters cut from 10 to 6 (All, My watchlist, Results, Orders & deals, Dividends, Headlines; the Talked-about row only under Headlines); an item's page leads with the plain line, NSE's title under it; the home News tile uses the plain line. Tests: src/newsPlain.test.js (in npm test); news.spec passes.
- 6 Nov: Explore on a computer is the news alone, called "News" in the top bar (Markets has the indices, sectors, biggest moves and the week's results). A phone (no Markets tab) keeps the Market row, the map card and a Markets card above the news. Index pages still open from the price strip (their back button now says Back). Tests: fixtures map Explore→News on the top bar; X-H1/X-H9 phone only; X-H2 checks the computer's News page has no board and opens IT from the strip; X-H6 now checks Markets' Biggest moves; X-H8 the phone's news preview.
- 6 Nov: Markets' index arrows (.mk-end) are Apple-style glass: translucent with backdrop blur and saturate, a bright inner top edge, soft shadow, grow on hover, press in on tap; dark-theme variant; solid with prefers-reduced-transparency.
- 6 Nov: owner: "not frosted, like water" — the Markets arrows are clear liquid glass now: 1.5px blur only, brightened and saturated backdrop, rim light (strong top, faint bottom and sides), a small glint, soft shadow; springy hover.
- 6 Nov: Markets' Results this week: each day (its heading, and "+N more · See the figures") opens a page of its own (MarketsView ResultsDay, a history step): every company meeting that day, largest first, market cap, its latest quarter (tagged New once filed on or after the meeting, else Last) with sales and profit and their year-on-year change, and a link to that quarter's results page; a row of days to switch, a search over 12; a green dot by a name that has filed. server/explore.js resultsWeek adds cmp and the latest quarter. Test MK-3.
