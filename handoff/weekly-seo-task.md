---
name: weekly-seo
description: Weekly SEO agent: read Search Console, find pages close to Google's first page, improve the page templates behind them, check the site's health, report
---

Weekly SEO review of Jocular Insights. The app is the NSE stock research site jocularinsights.in; its code is in ~/Projects/stockwise-india (branch screeners-home; live from main on Render). Read the last 30 lines of handoff/LOG.md, the newest file in handoff/seo/, and handoff/seo/changes.md first.

Run once a week, whichever Claude account runs it (the owner switches Claude accounts: Sundays to another, back on Thursdays; both may hold this task, on this same Mac). If the file ~/Projects/files/shorts-v2/runs/weekly-seo-<today as YYYY-MM-DD> exists, stop at once and say "already done today". If not, create it now (`mkdir -p ~/Projects/files/shorts-v2/runs && date > ~/Projects/files/shorts-v2/runs/weekly-seo-YYYY-MM-DD`) before anything else.

Background (21 Nov 2026 baseline, handoff/seo/2026-11-21.md): 28 clicks and 12K impressions in 28 days, average position 67.8. Results searches ("bharat electronics q2 fy27 results", "ioc q2 results date") already sit at positions 5–11. "<company> share price" searches are about 80% of impressions but sit at 80–93, behind the big finance sites. So spend the effort where we are close: results pages, then pages at positions 4–20. Don't chase "share price" searches with title tricks.

Steps:
1. Read Search Console. Use Claude in Chrome (the jocularinsights@gmail.com Google account; Search Console is not signed in in the built-in browser). Open https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fjocularinsights.in%2F&num_of_days=28&metrics=CLICKS%2CIMPRESSIONS%2CCTR%2CPOSITION, set "Rows per page" to 500, and read the Queries table (query, clicks, impressions, CTR, position) from the page. Then the Pages tab, the same way. Save both as handoff/seo/data-<date>.json, along with the totals (clicks, impressions, CTR, average position). Then open Indexing → Pages and note how many pages are indexed and not indexed, and the top reasons with their counts.
2. Compare with last week's data file: totals, how many queries are in the top 10, 11–20 and 21–40, and how the pages changed last week (handoff/seo/changes.md) have moved. Only judge a change after 2 or more weeks.
3. Pick at most 5 openings: queries at positions 4–20 with the most impressions, and the page each one lands on (the Pages table, or filter by query). For each, open the live page and read its title, meta description, h1 and first paragraph (curl or the built-in browser; read the HTML the server writes).
4. Improve the templates, not single pages. Titles and descriptions come from rules (src/pageTitle.js, server/seo.js, server/seo-pages.js, server/seo-lists.js, server/seo-story.js), so a fix must make every similar page better. For example, results pages could say the quarter the way people search for it ("Q2 FY27 results", "Q2 results 2027"), or lead with the date. Allowed:
   - the words people search, placed early in the title or description
   - a clearer first paragraph that answers the search
   - a missing heading or internal link
   - structured data that's correct

   Not allowed:
   - keyword stuffing
   - text that isn't true or isn't in the data
   - buy/sell/target wording (SEBI)
   - hiding text
   - changing a template that was changed in the last 4 weeks (look in handoff/seo/changes.md); Google needs time to react

   Keep titles to about 60 characters (src/pageTitle.js SHOWN) and keep server and app titles the same.
5. Site health: fetch https://jocularinsights.in/sitemap.xml and check about 100 addresses from it at random, slowly (one at a time). Each should answer 200 with its own canonical, an h1, a description, and no noindex. Check robots.txt. Note any 404s or 5xx errors from Search Console's Pages report. Fix only clear faults.
6. Run `npm test` and `npm run build` (never build while tests run).
7. Before committing, run `git fetch` and `git status`. Other tools (ChatGPT, other Claude sessions) also edit this repo, so commit only your own changes, each change in its own commit. End each message with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Never push, never deploy, never touch environment variables, secrets or handoff/COSTS.md. Don't press "Request indexing": the daily results job uses that quota.
8. Write handoff/seo/<date>.md, covering:
   - the totals against last week
   - the openings you picked, with query, impressions, position and page
   - what you changed and why
   - what last month's changes did
   - site health
   - anything for the owner

   Add each change to handoff/seo/changes.md (date, template/file, what changed, which queries it is meant for), add one line to handoff/LOG.md, and commit.
9. Finish with a short plain-English summary for the owner (simple words; they read on their phone): clicks and impressions against last week, what was changed, what's waiting for a push. Don't ask them to push.

Rules: never invent figures; quote only what Search Console and the pages show. Keep the app's look. Don't release community or new AI features. Never type passwords; if Search Console isn't signed in, stop and say so.
