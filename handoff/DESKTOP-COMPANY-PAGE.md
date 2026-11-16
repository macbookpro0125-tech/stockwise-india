# Computer company page: mock-ups under review (16 Nov 2026)

**Nothing is built.** These are pictures drawn on the real computer page with TCS's data. The owner said on 16 Nov: "I need more change but I'm busy right now, save this and we review after some time." Do not build until they have reviewed and said so. The phone page (built and live 15–16 Nov, commit 52ef9cd) is the model.

## Where it is saved
`~/Projects/files/company-page-mockups/2026-11-16/` (outside the repo; the session scratchpad gets cleared)
- `pictures/card-C-panel-nofv.png` (+ `-first`): the Summary as last agreed.
- `pictures/tidy-<tab>.png` (+ `-first`): Business, Growth, Safety, Owners, Value, Price, News.
- `pictures/cards-compare.png`: the three company-card layouts (A, B, C); `idea1`–`idea4`: the first four ideas; `now-*.png`: the page as it was.
- `scripts/`: `dmock.js` + `dmock.css` (the mock, injected into the real page), `dshoot.mjs` (renders; `node dshoot.mjs tidy-` or `node dshoot.mjs card-C nolevels`), `lab.mjs` (starts a private copy of the app), `chapters.json` (TCS's checks). The paths inside point at the old scratchpad: change `S` in `dshoot.mjs` to this folder before running. `mock.js`/`chapter.js` are the phone mock-ups.

## What the owner has decided so far
**Summary**
- The chart on top, full width, left to right; the key-figures strip along its foot. Then "The scores, explained".
- The scores as six cards (one per chapter): score, answer in words, at most four checks, weakest first, "N of M strong · K more".
- Under the cards three even columns: Coming up · From its figures · Why is it moving? (the old uneven boxes were "so messy").
- Your view / How the scores are worked out / Where these figures come from: one row of three that open.
- Company card = **layout C**: top row as today; under the rule "In short" on the left and the overall score in a tinted panel on the right, with six chapter marks, the rank, and "has it moved" (the 21 nights of `data/score-audit` hold every company's scores; the wording in the picture is a sample).
- Keep the **full name** on a computer ("why do we need short name on desktop").
- **No fair value** in the card or on the Summary chart (the chart's line off by default; Levels turns it on). It stays in the Value card and the Value tab.
- **No "What it does" paragraph** in the card (they didn't like it); a small "About" link beside the sector line instead.
- Returns 1W 1M 1Y 3Y 5Y; "Add to watchlist" as an outline button; chart toolbar cut to Candles, Line, More, D/W/M, Indicators, Levels.

**The other seven tabs**
- "In short" and the score panel show **on Summary only**; the other tabs keep the card's top row.
- Each tab: its answer card, then The checks (weakest first, plain questions) beside What to watch and Key figures (the chapter's two figures), then the evidence under plain headings in boxes, small ones side by side, rarely used ones as a row that opens.

## Not decided / still open
- The owner wants **more changes** (not said which yet). Ask what, show the pictures again.
- Chapter layout was never chosen between "checks first" (shown in the tidy pictures) and "questions left, evidence right" (idea 4).
- Not drawn: the scrolling bar with name/price/score, result dots on the left rail, the technical panel inside "The trend in the price" (still busy, on the phone too).
- Growth, Owners and News pictures were made by the same layout but not looked at closely.
- Memory says "keep the live computer page, small steps" (27 Oct); the owner asked for these ideas themselves on 16 Nov, so follow what they approve.
