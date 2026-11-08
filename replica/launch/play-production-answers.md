# Play production access — draft answers (30 Oct 2026, updated 4 Nov 2026)

**Where things stand (4 Nov 2026):**
- **Release:** 1.3 (build 5) approved and live on Closed testing - Alpha since 3 Nov.
- **Testers:** Play's dashboard shows 12 opted in for 12 days running on 6 Nov, so the 14 days finish on 8 Nov.
- **Then:** Dashboard → **Apply for production**.

All the owner's answers are in (6 Nov 2026): see "Owner's answers" at the end.

For Play Console → Dashboard → **Apply for production**, once the closed test
has run 14 days with 12+ testers opted in (from 24 Oct 2026: about 7 Nov).
Google asks these questions in its own words; the answers below are drafts
from what really happened. Lines marked **[confirm]** need the owner's word
before they're pasted: nothing here may claim feedback nobody gave.

## Part 1: About your closed test

**How easy was it to recruit testers?**
Choose: **Easy** (owner, 6 Nov 2026). We asked friends and family directly;
15 addresses are on the "Jocular testers" list.

**Describe the engagement you received from testers.**

> Twelve testers have stayed opted in to the closed test since 24 October
> 2026, joining by the opt-in link on their own Android phones. They installed the app from Play, signed
> in with Google and used the watchlist, company pages, news and the
> screeners. About five had installed it within the first day; one tester first saw "App not
> available", which was fixed by opting in with the same Google account the
> phone uses for Play. Several testers opened it most days.
>
> They received three updates during the test (1.1, 1.2 and 1.3), each
> installed through Play.

**Summarise the feedback and how you collected it.**

> Feedback came to us directly from testers (in person and by message) and to
> the feedback email on the testing track. The most important report: on one
> tester's Xiaomi phone the app opened to a black screen. We traced it to an
> out-of-date Android System WebView, which the app relies on. A tester also
> told us the opening animation stuttered on their phone.

## Part 2: About your app

**Who is the intended audience?**

> Adults in India who research shares listed on the NSE: retail investors who
> want to understand a company from its own filings before they buy, without
> paying for a research subscription. The app is for 18 and over.

**How does your app provide value to users?**

> Jocular Insights explains every NSE-listed company in plain words from its
> public filings: its results, balance sheet, cash flow, shareholding and news,
> a quality score out of 100 with each check explained, and a fair-value range
> from the company's own history. Users can screen the whole market with
> ready-made strategies, keep watchlists, and get a phone notification when a
> company they follow files results or news. It is research, not advice: it
> shows the figures and never tells anyone what to buy or sell.

**How many installs do you expect in the first year?**
Choose: **1,000 – 10,000** (owner, 6 Nov 2026).

## Part 3: Production readiness

**What changes did you make based on what you learned in the closed test?**

> - A phone whose Android System WebView is too old no longer shows a black
>   screen: the app now explains what's wrong and links straight to the WebView
>   update on Google Play, with a "Try again" button.
> - The app no longer flashes a plain text page while it starts.
> - Scrolling on Android phones is smoother: heavy blur and shadow effects
>   that slowed mid-range phones were replaced with lighter ones, and a company
>   page builds its sections only when they're opened.
> - Results tables, the market heatmap and Explore's lists were reworked to
>   fit a phone's screen.
> - Phone notifications: results reminders the evening before a followed
>   company reports, and news for followed companies, each opt-in.
> - A saved screen can notify the user when a new company starts to match it
>   (opt-in, per screen).
> - The opening animation was rebuilt so it no longer stutters on mid-range
>   Android phones. It now runs from the launch logo to the app without a gap
>   or a blank screen (a tester reported the stutter).
> - The full-screen price chart on a phone keeps the prices in view when
>   scrolled. It has a simpler row of controls, and its chart types are a
>   plain list.
> - News items now say in plain words whether that kind of announcement is
>   usually good or bad news for a share, and why.

**How did you decide the app is ready for production?**

> Testers used it on their own phones for over two weeks, through three
> updates, on Samsung, Xiaomi, and Vivo, Oppo, Realme or OnePlus phones. The one crash-like problem they found (the black
> screen on an old WebView) is fixed. Every release passes our automated tests:
> unit tests for the data and calculations, and browser tests that click
> through every main flow at phone and computer sizes. The app's privacy
> policy, data safety form and content rating are complete.
> The latest build (1.3) passed Google's review on 3 November 2026.

## Owner's answers (6 Nov 2026)

All seven confirmed in chat: recruiting easy; several testers opened it most
days; brands Samsung, Xiaomi, and Vivo/Oppo/Realme/OnePlus; no other feedback
beyond the Xiaomi black screen; a tester reported the opening stutter; 1,000 –
10,000 installs expected; every change kept. Ready to paste on 8 Nov.

Play's **"Declare your trader status"** banner is due by 1 February 2027 (Play's
notice of 5 Nov 2026), so it doesn't hold up the application; answer it when
you're ready. Only you can say whether you're a trader.

## As entered in Play, 8 Nov 2026 (each answer under Play's 300-character limit)

1. Recruit: We asked friends and family directly and sent each the closed test's opt-in link. 15 addresses are on our testers list; 12 have stayed opted in since 24 October 2026, each on their own Android phone.
2. Ease: Easy.
3. Engagement: Testers installed from Play, signed in with Google and used company pages, the watchlist, news and the screeners, as a real investor would. Several opened it most days. They got three updates (1.1, 1.2, 1.3) through Play. One first saw "App not available" until opted in with their Play account.
4. Feedback: Feedback came in person, by message and to the track's feedback email. Main report: on a Xiaomi phone the app opened to a black screen; we traced it to an out-of-date Android System WebView and fixed it. A tester also said the opening animation stuttered; we rebuilt it.
5. Audience: Adults (18+) in India who research shares listed on the NSE: retail investors who want to understand a company from its own filings before they invest, without paying for a research subscription.
6. Value: It explains every NSE company in plain words from its public filings: results, balance sheet, cash flow, owners and news, a quality score with each check explained, and a fair-value range. Users screen the market, keep watchlists and get alerts. It's research, never advice to buy or sell.
7. Installs: 0 - 10K.
8. Changes: Fixed the black screen on phones with an old Android System WebView (it now explains and links to the update). Rebuilt the stuttering opening. Smoother scrolling on mid-range phones. Results, charts and news reworked for phone screens. Added opt-in results and news alerts.
9. Ready: Testers used it on their own Samsung, Xiaomi and other Android phones for over two weeks, through three updates; several opened it most days. The one serious bug they found is fixed. Every release passes our automated tests at phone and computer sizes. Build 1.3 passed Google's review on 3 Nov.
