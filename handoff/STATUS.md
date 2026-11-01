# Status

_Last updated: 1 Nov 2026, by Claude (Opus) on branch `screeners-home`._

## Live on jocularinsights.in

Everything up to the chart upgrade and phone full-screen chart (`5c5a347`), the Performance name link, the sign-in card fix, Google hidden on an iPhone's Home Screen version (none checked on a real phone), the iPhone opening fixes and the phone stock bar (`6683c51`; not checked on an iPhone, and the owner must re-add the Home Screen icon for the dark launch image), the glass look across the app (`6337941`; not checked on a real phone), the BSE lookup for missing industry labels, the opening's ending and dark first paint (`8348850`; the iPhone white screen is not yet checked on an iPhone), and the Android opening's fixes (`4c19b85`), pushed 1 Nov 2026 (the launch-logo hold needs app 1.3, build 5): Desk and My desk, stock pages with "below our fair value" and same-industry peers, the Screen builder name, the overnight fixes, and the opening rebuilt so it doesn't lag on Android.

## Committed but NOT pushed yet

Desktop: different icons for Screen builder and Desk (sliders, monitor). The header's logo stays: the owner didn't want it removed. A new signed-in computer home (`TodayHome.jsx`): a black opening with a painted night sky (Milky Way, constellations, a great star) on two drifting layers, with two endless star streams, shifting colour, six shooting stars and a slow twinkle, paused off screen (the visitors' page keeps its 3D stars), a product shot, then a Market summary sheet that slides up over the still opening, with a list of every page in the app, in the structure of TradingView's front page with our own words and art. Waiting on the owner's yes; don't push before it.

## Open / next

1. **Owner is checking on his phone (1 Nov):** the opening on Android, and My desk ("can't add a card, can't move it", fixed in `b0f9fd4`). Wait for his feedback.
2. **Android 1.3 (build 5) is built for the Play launch (~7 Nov 2026), and replaces 1.2 (build 4):** `~/Desktop/jocular-play/jocular-insights-1.3-build5.aab`, also `android/app/build/outputs/bundle/release/app-release.aab`, signed, pointing at the live site. The owner uploads it. Checked on the emulator 1 Nov: screens, haptic, push token. Not checked: the chime (emulator has no sound), a push actually arriving, the release build run on a phone. AdMob answered "Publisher misconfiguration" for the real app ID on 1 Nov: expected while the account is unverified and no store is linked; recheck after the Play listing is public.
3. **Visitor review ~6 Nov 2026.** Read `/api/owner/stats` while signed in as the owner. Count only from 30 Oct; earlier days include bots. On 31 Oct there were about 5 real visitors a day and 0 sign-ups since the 13 testers on 24 Oct.
4. **Search:**
   - Google has indexed 31 of 6,849 sitemap pages (the sitemap was first read on 30 Oct).
   - Stock pages rank around position 71, for "*company* share price" searches.
   - Check again in 2–3 weeks.
5. **Price strength locally:** a data file without 9-month returns (the local one, from 23 Oct) now gets them from the daily prices kept in `data/history/` (`server/price-strength.js`). It takes a few seconds the first time; nothing is downloaded.
6. **Industry labels: 2,136 of 2,551 companies had one on 1 Nov 2026 (the old "895" was out of date).** The 410 without were companies with a sector from NSE's index lists, largely big ones (Lemon Tree, Chalet, ITC Hotels), which the BSE lookup skipped. Fixed in `server/market-data.js` and live; the labels arrive with the first evening data job after a push. BSE refuses this computer (403), so check the job's `[sectors] BSE` log line and a Lemon Tree page after that run. Labels come from two schemes (NSE announcements' and BSE's), so the same industry can carry two names.

## Set aside (don't redo without asking)

- **3D glass logo for the opening:** `git stash` "3D opening logo (glow)". The owner chose the plain version.
- **Chapter sidebar on the company page:** `git stash`, "not wanted".
