# Start here

Read this folder before touching the code, whichever AI or account you are.
It says what the app is, how the owner works, what's live, and what's half
done, so you don't have to rediscover it.

1. **README.md** (this file): the app, how to run it, the rules.
2. **[STATUS.md](STATUS.md)**: what's live, what's waiting to go live, and what's next.
3. **[LOG.md](LOG.md)**: what happened, newest first.

**When you finish a piece of work, update STATUS.md and add a line to LOG.md
in the same commit.** That's what keeps this folder useful.

## The app

**Jocular Insights**, an NSE stock research app for Indian investors. It
gives each company a quality score from its own filings, a fair value,
screens, a watchlist, a portfolio, a market map and a Desk.

- **Live:** https://jocularinsights.in, on Render (service `stockwise-india`); it deploys from GitHub `main`.
- **Repo:** github.com/macbookpro0125-tech/stockwise-india.
- **Stack:** React 19 + Vite on the front, and a Node server with `node:sqlite` (`server/http-server.js`, no framework). Charts use TradingView Lightweight Charts. The Android app is Capacitor (`android/`).
- **Data:** NSE and BSE public files, pulled by the GitHub Action `data-refresh.yml`. They're kept in `data/`: `market-snapshot.json`, per-company history in `data/history/*.json`, and the database `data/app.db`.

## Run it

```bash
npm ci
npm run build                 # the server serves dist/
npm start                     # http://localhost:8787, or PORT=…
npm test                      # unit tests, about 1 minute
npx playwright test --workers=1   # end-to-end, about 13 minutes
```

`.claude/launch.json` has a ready local config (`stockwise-local`, port 8790,
data jobs off, a throwaway database).

## The owner's rules (non-negotiable)

- **Never push unless the owner says "push".** Don't ask or hint either ("say push" annoys him). Commit locally and say what's done.
- **Before a push:** `npm test`, `npm run build`, `npx playwright test --workers=1`, then `git fetch` and `git log HEAD..origin/main`. If that shows commits you didn't make, stop and tell him. Push with `git push origin screeners-home:main`.
- **Run the full test suites once, at the end of a batch or before a push.** Not after every change; build and look while working.
- **Never release the community or new AI features** until he names them. They live on the `community` branch.
- **Never replace local `data/` from the internet** (the data-pull rule), and never fabricate data. If a figure isn't there, show "—".
- **Never type passwords or touch secrets.** He signs in himself. Keep `.env` and Render's environment as they are.
- **Keep the look.** Navy and teal, Inter, rounded cards. A flat grey restyle was rejected as "dull". Improve the existing app; don't redesign it from scratch.
- **The app icon is final:** the flat white JI with silver rings. The browser-tab icon is "version C".
- **Another AI (ChatGPT) has edited this repo before** and pushed half-done work. Always check `git status` and `git log` for changes you didn't make, and commit only your own.
- **Write plainly.** He reads on a phone, in short replies, often in a hurry. Show screenshots of UI work.

## Where things are

| What | Where |
|---|---|
| Pages | `src/App.jsx` (tabs, lazy pages), `src/Header.jsx` (`TABS`) |
| Screens and Screen builder | `src/DiscoverView.jsx`, `src/ResultsTable.jsx`, `src/screener/` |
| Desk / My desk | `src/DeskView.jsx`, `src/ScreenDesk.jsx`, `src/MyDesk.jsx`, `src/deskGrid.js` |
| Trend stages and patterns | `server/price-setups.js` (`/api/desk/market`) |
| Saved desk layouts | `server/desk-layout.js` (`desk_layouts` table) |
| Company page | `src/StockDetail.jsx`, `src/StockDesk.jsx` (computer layout) |
| Scores and fair value | `server/metrics.js`, `server/levels.js`, `server/research*.js` |
| Public SEO pages | `server/seo.js`, `server/seo-story.js` |
| Opening animation | `src/Intro.jsx` (a 3D version is in `git stash`, "3D opening logo (glow)") |
| Database tables | `server/db.js` |
| End-to-end tests | `e2e/*.spec.js`; each test signs up its own throwaway account |
| Play Store launch notes | `replica/launch/play-listing.md` |

## Accounts (who owns what; no passwords here)

- **GitHub and Render:** the owner's workspace ("salman's workspace").
- **Firebase** (Google sign-in, project `stockwise-india-4c217`): macbookpro0125@gmail.com.
- **Google Play Console:** jocularinsights@gmail.com. App `com.jocularinsights.app`.
- **Search Console:** the URL-prefix property `https://jocularinsights.in/`.
