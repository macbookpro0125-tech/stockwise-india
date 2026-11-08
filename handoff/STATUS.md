# Status

_Last updated: 6 Nov 2026, by Claude (Opus) on branch `screeners-home`._

## Committed, not pushed (6 Nov)
- Live 7 Nov (158 passed): results pages (by day, a month back, your watchlist's past and coming, the day at a glance, sort and filters); Biggest moves as a page (every company, the last 23 trading days, day/week/month); date strips (sticky labels, arrows, wheel and drag, week breaks, holidays); Markets index card (the story, results dots, breadth, who moved it; Simple/Full chart with index candles — candles live after the next evening build); typography (one scale, three weights, nothing under 11px, BigNum headline numbers, readable legend and badges); News tab on a computer; plain-English news; weekly data copy; watchlist-news check once a load.
- Live 6 Nov (152 passed): news in plain words (src/newsPlain.js, no AI: one sentence per filing, what matters first, routine filings folded, six filters); Explore is "News" on a computer (the market is on Markets), a phone keeps one market row and a Markets card; Home and Markets use the full width; /results counts every company that filed; a dated weekly copy of the market data on GitHub (last 8 kept).
- Live 6 Nov (154 passed): /results (latest results, newest first) and results titles that lead with the figures; charts end one candle after the last; phone charts' shorter labels; X posts and pictures for 7–13 Nov in replica/launch.
- Live 6 Nov at `78ba3c4` (152 passed): share pictures for every list, sector and screen (scripts/og-cards.mjs; re-run after adding a list) and 7 more lists (PSU, F&O, high FII, high DII, profit growth, sales growth, cash-rich): 40 lists.
- Live 6 Nov at `87b47ea` (152 passed): 8 more lists (large/mid/small caps, high ROE, high ROCE, high promoter holding, Piotroski 8-9, penny stocks) and a Share button on list, sector and screen pages; the top bar black over the night sky in light mode (TB-2). Earlier: /lists with 25 pages (each NSE index, NSE's themes like defence and railway PSU, stocks under ₹50/100/500, debt-free, high dividend, low P/E, 52-week highs and lows), their own sitemap, in the app and linked from the footer. Test S-H6.

## Live on jocularinsights.in

Pushed 8 Nov 2026 at `375f206` (158 passed): Markets' line for an index with closes only, and the Go deeper card and page buttons. Pushed 6 Nov 2026 at `f7550b6` (148 passed, X-H6 passed on rerun): the clean top bar (first tab Home), the score chart, the news cards fix, the sky hidden under the page; Play listing changes sent for review the same day.

Pushed 5 Nov 2026 at `c8443a1` (all 146 tests passed): the Markets index row restyle and See all; the watchlist's added price and date; the left bar's Watchlist opens its page; Screen builder from another page opens the builder.

Pushed 5 Nov 2026 at `4c78350` (all 142 tests passed):
- **Markets:** a new page (`MarketsView.jsx`, tab `markets`; phone: Settings → Markets) with the index picker and its chart, sectors, the market's trend, the biggest moves and the week's results.
- **What to watch:** Lately and Coming up.
- **The home:** news across the full width.
- **Market map:** logos.
- **Results bars:** green or red against a year earlier.

Pushed 5 Nov 2026 at `11d1e3b`: the chart line/area is red when the price fell over the range shown and green when it rose, and full screen fills the screen.

Pushed 5 Nov 2026 at `e2d1eab`: the home's Market summary is wider (1,480 px), every card opens something (an index its Explore page, the Nifty 500 card its page, a results day the calendar), and Results coming names the three biggest companies each day, the watchlist's first. 140 tests passed; F03-E1 (back/forward) failed once and passed 4 of 4 on rerun: an occasional timing failure, not from this batch.

Pushed 5 Nov 2026 at `37c74e9` (all 140 tests passed): solid top bar and cards on a computer, and the faster opening on a computer. `/` and `/builder` returned 502 for a few seconds during Render's switch-over, then 200 for a minute running.

Pushed 4 Nov 2026 at `a0c4571`: the desktop speed fixes (no per-card blur; the strip and sky pause while scrolling; the covered sky stops drawing; the sheet's glows aren't fixed). Full tests passed: 139 plus the sweep, rerun alone after a timeout on a slow run. Owner to check on their own computer.

Pushed 4 Nov 2026 at `e741f7a` (live in about 90 s; `/`, `/builder` and stock pages answered):
- the phone batch: Market summary on the home, the overall score in In short, "What it does", quarters at a glance, uncrowded bar labels, and the touch-drag price scale
- Screen builder at `/builder`
- the Play answers update

Not yet checked on a real phone, especially the price-scale drag.

Pushed 4 Nov 2026 at `3885578`: The phone chart's type picker is a one-column list (owner: "one column, like a list"), scrolling past 45% of the screen; computers keep the tiles. Pushed 3 Nov 2026 at `157e5bb` (full tests passed first): The phone's full-screen chart, made more like Kite's: an up or down swipe no longer moves the price scale (it had left candles off the top and bottom), picking a range fits the prices again, the empty strip at the bottom (the home-bar space counted twice) is gone, and the tool row is plain larger icons with one "1D" button that opens Daily, Weekly, Monthly. Unit and chart tests passed; checked at phone width. Not checked on a real iPhone. 11 new Learn guides (22 in all), pushed 3 Nov 2026 at `77de96a`. Pushed 3 Nov 2026 (`83c223d`, live in about 80 s): The home's "See every screener" button no longer sits on a company row: the picture fades out above it (site only; full tests passed 3 Nov). News now says whether an announcement is usually good or bad news: a box on each item (good, bad, good and bad, routine, not clear, figures not in yet) with one line why, and a small Good/Bad/Mixed tag on list rows (`newsTone` in `src/filingTerms.js`; results judged from profit and sales against a year earlier). Unit and news tests passed; checked at phone width on local data, where only "not clear" and "Mixed" items existed. The market map's zoom buttons sit below the map. Earlier: Everything up to the home's rearranged Market summary, lit cards with a glow that follows the mouse, and the Safari chart fix (`d71e976`; Safari not tested here), the new signed-in computer home (`TodayHome.jsx`: a night-sky opening that a Market summary sheet slides over, glass cards; `ScreensHome.jsx` no longer serves a computer page), new icons for Screen builder and Desk, the chart upgrade and phone full-screen chart (`5c5a347`), the Performance name link, the sign-in card fix, Google hidden on an iPhone's Home Screen version (none checked on a real phone), the iPhone opening fixes and the phone stock bar (`6683c51`; not checked on an iPhone, and the owner must re-add the Home Screen icon for the dark launch image), the glass look across the app (`6337941`; not checked on a real phone), the BSE lookup for missing industry labels, the opening's ending and dark first paint (`8348850`; the iPhone white screen is not yet checked on an iPhone), and the Android opening's fixes (`4c19b85`), pushed 1 Nov 2026 (the launch-logo hold needs app 1.3, build 5): Desk and My desk, stock pages with "below our fair value" and same-industry peers, the Screen builder name, the overnight fixes, and the opening rebuilt so it doesn't lag on Android.

## Committed but NOT pushed yet

- **News "In the news"** (8 Nov): the News page and Explore's news open on the watchlist's companies in the news: each company with its price and its latest 3 headlines from news sites (Google News, last 14 days, tips and quote pages out, only headlines that name the company), opening on the publisher's site. `/api/news/companies`, `companiesInNews` in server/market-news.js. Filings are under All and the other filters.
- **Home Market summary is the Nifty 50**, not the Nifty 500 (computer and phone), from `/api/explore/index`.

## Open / next

0. **Play store listing draft (5 Nov 2026), saved, NOT sent:** name "Jocular: Indian Stock Screener", new short and full descriptions (text in `replica/launch/play-listing.md`). Left for the owner: the AI asset declaration (label or not; their call), Save on the review step, then Publishing overview → Send for review. Best before the ~7 Nov production application.
1. **Owner is checking on his phone (1 Nov):** the opening on Android, and My desk ("can't add a card, can't move it", fixed in `b0f9fd4`). Wait for his feedback.
2. **Android 1.3 (build 5): approved and published to closed testing on 3 Nov 2026** (checked 4 Nov in Play Console, jocularinsights@gmail.com, `/u/1/` in the browser pane that day). Production access: 12 testers opted in for 11 days of the 14 needed, so **apply for production around 7 Nov 2026** (Dashboard → Apply for production; Google asks questions about the closed test, and the earlier draft answers are in `replica/launch/play-listing.md`). If a tester leaves before then, the 14 days restart. The owner still has to answer Play's "Declare your trader status" banner. Not checked yet: the chime, a push actually arriving, the release build on a real phone. AdMob said "Publisher misconfiguration" on 1 Nov, expected until the Play listing is public.
3. **Visitor review ~6 Nov 2026.** Read `/api/owner/stats` while signed in as the owner. Count only from 30 Oct; earlier days include bots. On 31 Oct there were about 5 real visitors a day and 0 sign-ups since the 13 testers on 24 Oct.
4. **Search:**
   - Google has indexed 31 of 6,849 sitemap pages (the sitemap was first read on 30 Oct).
   - Stock pages rank around position 71, for "*company* share price" searches.
   - Check again in 2–3 weeks.
5. **Price strength locally:** a data file without 9-month returns (the local one, from 23 Oct) now gets them from the daily prices kept in `data/history/` (`server/price-strength.js`). It takes a few seconds the first time; nothing is downloaded.
6. **Industry labels: 2,136 of 2,551 companies had one on 1 Nov 2026 (the old "895" was out of date).** The 410 without were companies with a sector from NSE's index lists, largely big ones (Lemon Tree, Chalet, ITC Hotels), which the BSE lookup skipped. Fixed in `server/market-data.js` and live; the first scheduled data job after the push is 2 Nov, 16:30 IST (the release was last built 1 Nov 07:51 UTC, before it; 410 still unlabelled). BSE refuses this computer (403), so check the job's `[sectors] BSE` log line and a Lemon Tree page after that run. Labels come from two schemes (NSE announcements' and BSE's), so the same industry can carry two names.

7. **Screen builder has its own address, `/builder`, on a computer** (owner chose it on 4 Nov). A reload or a link opens it; leaving it puts the address back to `/`. A phone keeps both steps on `/`. Committed, not pushed.
8. **Industry labels:** Lemon Tree's live page shows "Hotels & Resorts" (3 Nov). The total unlabelled wasn't recounted.

## Set aside (don't redo without asking)

- **3D glass logo for the opening:** `git stash` "3D opening logo (glow)". The owner chose the plain version.
- **Chapter sidebar on the company page:** `git stash`, "not wanted".
