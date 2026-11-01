# Status

_Last updated: 1 Nov 2026, by Claude (Opus) on branch `screeners-home`._

## Live on jocularinsights.in

Everything up to `a3fffd0` ("The opening without words…"), pushed 31 Oct 2026:
- the market map page
- compare
- portfolio against the market
- screen alerts
- faster first load
- the opening animation, without words

## Committed but NOT pushed yet

Waiting for the owner to say "push", after the full test run.

| Commit | What |
|---|---|
| `eecff14` | Stock pages: "28% below our fair value" in the title, Google snippet and a row (the rupee value stays behind sign-in); peers from the same industry |
| `c11b4e9` | The Workspace tab is renamed **Screen builder** |
| `a8ca410`, `f3a6fc5` | **Desk**, a page of its own: pick a list (every NSE company, watchlist, your screens, ready-made screens), walk it with ↑/↓, the chart in the middle, Business / Price / Peers on the right |
| `aa6fe86` | Desk: market mood bar (advancing / topping / declining / basing) and six price patterns (breakout, near highs, pullback, tight weeks, tightening range, quiet volume) |
| `965f4e6` | **My desk**: cards you choose, saved to the account |
| `25cb072` | Desk restyled the Apple way (same layout) |
| `3f48e23`, `ddc6055`, `b0f9fd4` | My desk: drag any card anywhere and resize it from its corner, a 12-column grid; drag fixes |
| this folder | `handoff/` |
| (1 Nov) | Android version 1.2, build 4 |
| `0b86dda` | Price strength from local daily prices when the data file has no 9-month returns |
| (1 Nov) | Overnight debug: Desk fixes, narrow windows, accessibility fixes across the app (see LOG) |

Tests (1 Nov, overnight): the unit tests pass, all 136 end-to-end tests pass,
and the accessibility scan is clean. Ready to push whenever the owner says
"push"; run the checks again first if anything has changed since.

## Open / next

1. **Owner is trying My desk now.** He reported "can't add a card, can't move it". Fixed in `b0f9fd4`: a drag released over the chart never ended. Wait for his feedback.
2. **Android 1.2 (build 4) is built for the Play launch (~7 Nov 2026):** `android/app/build/outputs/bundle/release/app-release.aab`, signed, pointing at the live site. The owner uploads it. Checked on the emulator 1 Nov: screens, haptic, push token. Not checked: the chime (emulator has no sound), a push actually arriving, the release build run on a phone. AdMob answered "Publisher misconfiguration" for the real app ID on 1 Nov: expected while the account is unverified and no store is linked; recheck after the Play listing is public.
3. **Visitor review ~6 Nov 2026.** Read `/api/owner/stats` while signed in as the owner. Count only from 30 Oct; earlier days include bots. On 31 Oct there were about 5 real visitors a day and 0 sign-ups since the 13 testers on 24 Oct.
4. **Search:**
   - Google has indexed 31 of 6,849 sitemap pages (the sitemap was first read on 30 Oct).
   - Stock pages rank around position 71, for "*company* share price" searches.
   - Check again in 2–3 weeks.
5. **Price strength locally:** a data file without 9-month returns (the local one, from 23 Oct) now gets them from the daily prices kept in `data/history/` (`server/price-strength.js`). It takes a few seconds the first time; nothing is downloaded.
6. **Only 895 of 2,263 companies have an industry label.** Lemon Tree, Chalet and ITC Hotels have none, so their peers fall back to the broad sector.

## Set aside (don't redo without asking)

- **3D glass logo for the opening:** `git stash` "3D opening logo (glow)". The owner chose the plain version.
- **Chapter sidebar on the company page:** `git stash`, "not wanted".
