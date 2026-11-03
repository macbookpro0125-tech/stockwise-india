# Status

_Last updated: 3 Nov 2026, by Claude (Opus) on branch `screeners-home`._

## Live on jocularinsights.in

Pushed 3 Nov 2026 (`83c223d`, live in about 80 s): The home's "See every screener" button no longer sits on a company row: the picture fades out above it (site only; full tests passed 3 Nov). News now says whether an announcement is usually good or bad news: a box on each item (good, bad, good and bad, routine, not clear, figures not in yet) with one line why, and a small Good/Bad/Mixed tag on list rows (`newsTone` in `src/filingTerms.js`; results judged from profit and sales against a year earlier). Unit and news tests passed; checked at phone width on local data, where only "not clear" and "Mixed" items existed. The market map's zoom buttons sit below the map. Earlier: Everything up to the home's rearranged Market summary, lit cards with a glow that follows the mouse, and the Safari chart fix (`d71e976`; Safari not tested here), the new signed-in computer home (`TodayHome.jsx`: a night-sky opening that a Market summary sheet slides over, glass cards; `ScreensHome.jsx` no longer serves a computer page), new icons for Screen builder and Desk, the chart upgrade and phone full-screen chart (`5c5a347`), the Performance name link, the sign-in card fix, Google hidden on an iPhone's Home Screen version (none checked on a real phone), the iPhone opening fixes and the phone stock bar (`6683c51`; not checked on an iPhone, and the owner must re-add the Home Screen icon for the dark launch image), the glass look across the app (`6337941`; not checked on a real phone), the BSE lookup for missing industry labels, the opening's ending and dark first paint (`8348850`; the iPhone white screen is not yet checked on an iPhone), and the Android opening's fixes (`4c19b85`), pushed 1 Nov 2026 (the launch-logo hold needs app 1.3, build 5): Desk and My desk, stock pages with "below our fair value" and same-industry peers, the Screen builder name, the overnight fixes, and the opening rebuilt so it doesn't lag on Android.

## Committed but NOT pushed yet

Nothing.

## Open / next

1. **Owner is checking on his phone (1 Nov):** the opening on Android, and My desk ("can't add a card, can't move it", fixed in `b0f9fd4`). Wait for his feedback.
2. **Android 1.3 (build 5) was sent for Google's review on 3 Nov 2026** as the closed testing (Alpha) release, full rollout, replacing 1.1 (build 3) from 24 Oct. Play's quick checks were still running when sent; its two warnings were only the missing crash-debugging files. Check Publishing overview for approval. Built for the Play launch (~7 Nov 2026): `~/Desktop/jocular-play/jocular-insights-1.3-build5.aab`, also `android/app/build/outputs/bundle/release/app-release.aab`, signed, pointing at the live site. The owner uploads it. Checked on the emulator 1 Nov: screens, haptic, push token. Not checked: the chime (emulator has no sound), a push actually arriving, the release build run on a phone. AdMob answered "Publisher misconfiguration" for the real app ID on 1 Nov: expected while the account is unverified and no store is linked; recheck after the Play listing is public.
3. **Visitor review ~6 Nov 2026.** Read `/api/owner/stats` while signed in as the owner. Count only from 30 Oct; earlier days include bots. On 31 Oct there were about 5 real visitors a day and 0 sign-ups since the 13 testers on 24 Oct.
4. **Search:**
   - Google has indexed 31 of 6,849 sitemap pages (the sitemap was first read on 30 Oct).
   - Stock pages rank around position 71, for "*company* share price" searches.
   - Check again in 2–3 weeks.
5. **Price strength locally:** a data file without 9-month returns (the local one, from 23 Oct) now gets them from the daily prices kept in `data/history/` (`server/price-strength.js`). It takes a few seconds the first time; nothing is downloaded.
6. **Industry labels: 2,136 of 2,551 companies had one on 1 Nov 2026 (the old "895" was out of date).** The 410 without were companies with a sector from NSE's index lists, largely big ones (Lemon Tree, Chalet, ITC Hotels), which the BSE lookup skipped. Fixed in `server/market-data.js` and live; the first scheduled data job after the push is 2 Nov, 16:30 IST (the release was last built 1 Nov 07:51 UTC, before it; 410 still unlabelled). BSE refuses this computer (403), so check the job's `[sectors] BSE` log line and a Lemon Tree page after that run. Labels come from two schemes (NSE announcements' and BSE's), so the same industry can carry two names.

7. **Screen builder and `/`:** on a computer, reloading or re-entering `/` while on Screen builder stays there, because the builder is marked only in the browser's history entry. The logo, Back and other routes tried do reach the home (checked 3 Nov). A reload can't be told from re-entering the address, so fixing it means a reload on the builder also goes home, or giving the builder its own address: owner's call, unchanged for now.
8. **Industry labels:** Lemon Tree's live page shows "Hotels & Resorts" (3 Nov). The total unlabelled wasn't recounted.

## Set aside (don't redo without asking)

- **3D glass logo for the opening:** `git stash` "3D opening logo (glow)". The owner chose the plain version.
- **Chapter sidebar on the company page:** `git stash`, "not wanted".
