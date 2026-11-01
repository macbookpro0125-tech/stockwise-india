# Status

_Last updated: 1 Nov 2026, by Claude (Opus) on branch `screeners-home`._

## Live on jocularinsights.in

Everything up to the opening's spinner fix (`c700e40`), pushed 1 Nov 2026: Desk and My desk, stock pages with "below our fair value" and same-industry peers, the Screen builder name, the overnight fixes, and the opening rebuilt so it doesn't lag on Android.

## Committed but NOT pushed yet

The Android opening's fixes, 1 Nov 2026: the launch logo holds until the film is drawn (needs the new app build), the film's clock waits for it, and the logo waits for the header and flies before the front page's 3D sky starts. All tests pass. In browsers and on iPhone only the last part changes.

## Open / next

1. **Owner is checking on his phone (1 Nov):** the opening on Android, and My desk ("can't add a card, can't move it", fixed in `b0f9fd4`). Wait for his feedback.
2. **Android 1.3 (build 5) is built for the Play launch (~7 Nov 2026), and replaces 1.2 (build 4):** `~/Desktop/jocular-play/jocular-insights-1.3-build5.aab`, also `android/app/build/outputs/bundle/release/app-release.aab`, signed, pointing at the live site. The owner uploads it. Checked on the emulator 1 Nov: screens, haptic, push token. Not checked: the chime (emulator has no sound), a push actually arriving, the release build run on a phone. AdMob answered "Publisher misconfiguration" for the real app ID on 1 Nov: expected while the account is unverified and no store is linked; recheck after the Play listing is public.
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
