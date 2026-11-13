# YouTube: everything a new session needs

_Last updated: 13 Nov 2026._

## The channel
- **Jocular Insights**, handle **@JocularInsights**, channel ID `UCVHkaaLuIO_qr2fu2zLPMfw`, owned by **jocularinsights@gmail.com**.
- Studio: https://studio.youtube.com/channel/UCVHkaaLuIO_qr2fu2zLPMfw · public: https://www.youtube.com/@JocularInsights
- **If Claude in Chrome says "not connected"** after switching Claude accounts: the owner opens the Claude side panel in the Jocular window and signs in to the same Claude account as the app (13 Nov).
- **How Claude reaches it:** Claude in Chrome, in the owner's Chrome profile **"Jocular"** (Chrome `Profile 7`, signed in as jocularinsights@gmail.com). The Claude extension there must be signed in to the **same Claude account as the desktop app**, and claude.ai in that profile too (on 13 Nov it was signed in as macbookpro0125 and had to be switched). Open that profile with: `open -na "Google Chrome" --args --profile-directory="Profile 7"`. If the extension isn't connected, ask the owner to open the Claude side panel in that window.
- Never type a password; the owner signs in.

## Branding (set 13 Nov, published)
- Picture: `brand/social-final/youtube-profile-1024.png` (the final silver JI on white, padded for the round crop).
- Banner: `brand/social-final/youtube-banner-2560x1440.png`, made by `node scripts/youtube-banner.mjs`; everything inside the 1546×423 strip all devices show.
- Watermark: `brand/social-final/youtube-watermark-300.png`, shown for the **entire** video.
- Description: what each Short shows, what's free on the site, "Figures as filed with NSE. Not investment advice."
- Links: jocularinsights.in · Latest results (/results) · Results calendar (/results-calendar). Contact email left empty (owner's call).

## Videos so far
| Short | ID | Status | Music (YouTube Audio Library) |
|---|---|---|---|
| HDFC Bank vs ICICI Bank Q2 FY27 | `JHS1c0BlAWQ` | live 13 Nov | Corporation Motivation (Audionautix, CC BY 4.0 — **credit line added to its description**) |
| BEL Q2 FY27: sales up 26.5%, so why did the margin shrink? (voiced, new style) | `fJoCz-z0X20` | scheduled 14 Nov, 3:30 pm GMT+3 = 6 pm IST | its own soft beat under the voice |
| Sterlite Technologies: up 500%+ in a year. One great quarter, or a track record? (voiced) | `u8tVRoLcy_M` | scheduled 15 Nov, same time | its own soft beat |
| HDFC Bank vs ICICI Bank: same quality, one grew profit almost 4x faster (voiced; an extra beside the older silent one) | `bRxf7SVmszU` | scheduled 14 Nov, 10:00 GMT+3 = 12:30 pm IST | its own soft beat |
| TCS: Great Company, Falling Stock? (v2 style, Michael voice, new site cards) | `7MsCPGB1pJU` | live 13 Nov (public) | its own soft beat under the voice; no library track |

13 Nov: the old silent BEL (`E8XZebgjgbc`) and Sterlite (`CdmEs6rpAYs`) Shorts were deleted at the owner's request and replaced by voiced versions made with `scripts/shorts-voice/` (specs in `~/Projects/files/shorts-v2/`). The voiced HDFC vs ICICI was posted as an extra on 14 Nov (owner's word), the old silent one left up.

## Making a Short
- From a company's **live results page** (figures read from the page's own table, never typed): `node scripts/short-from-results.mjs SYMBOL [q2-fy27]` → `replica/launch/shorts/auto-<symbol>.mp4` + `.txt` (title, description). Check a frame against the live page before uploading.
- Hand-written ones: `scripts/shorts.mjs` (the `SHORTS` list; `--spec file.json` for others). 1080×1920, ~18 s silent (~31 s with voice).
- **Safe area** (fixed 13 Nov from an iPhone screenshot): YouTube covers the top ~320 px (Shorts header, Subscriptions/Live/Lens), the bottom ~420 px (channel, title, nav) and the right ~150 px (like/comment buttons). The layout keeps everything inside.
- Optional voice-over: macOS voice **Rishi** (Indian English), built into shorts.mjs when a spec has `voice`. The owner chose **YouTube library music** instead (13 Nov), so daily Shorts are silent files with music added on YouTube.

## The style the owner liked (13 Nov): "TCS falling stock" v2
- **Now general:** `node scripts/shorts-voice/build.mjs <spec.json> [--stills]` makes this style for any company from a short script (see `scripts/shorts-voice/README.md`). Use it for new Shorts; the owner asked for "all other in this format".
- Folder `~/Projects/files/Jocular_Insights_TCS_Short/v2/` (outside the repo): `script.json` (each line: what Michael says, what's shown with *highlights*, which visual), `voice.py` (narration), `shoot.mjs` (real phone-size screenshots of the live company page), `scene.html` + `build.mjs` (`STILLS=1` for test stills; full render ~12 min), output `TCS_falling_stock_v2.mp4` + `.srt`. Uploaded 13 Nov (`7MsCPGB1pJU`), with screenshots of the redesigned company-page cards (`shoot-cards.mjs` → `shots/card-*.png`).
- Style: a question hook; the words in the middle appearing as they're spoken (teal good, red bad); real screenshots of jocularinsights.in in a big phone frame with the figures circled; big tiles/bars/cards; "Save this" before the end; soft beat and pad ducked under the voice; −14 LUFS. Owner: "I liked it, we improve later."
- **Voice: Kokoro (free, local), voice `am_michael`** (owner's pick of 9). Installed in `~/Projects/files/tts/` (Python 3.12 venv `.venv`, `kokoro-v1.0.onnx`, `voices-v1.0.bin`; `say.py`). Needs Python 3.12 (Homebrew `python@3.12`): onnxruntime has no wheels for Intel Macs on 3.14/3.15. Word timings are estimated from syllables (Kokoro gives none).
- The first premium version (Rishi voice, documentary style) is in the parent folder `Jocular_Insights_TCS_Short/` with `data-verification.md`.
- The +15.0% / +14.9% profit mismatch on TCS's page was fixed on 13 Nov (both 14.9%).

## Uploading (Claude in Chrome)
1. Files must be inside the session folder to upload: copy the mp4 to `~/Projects/files/shorts-upload/`, delete afterwards.
2. Studio → Upload videos → use the hidden **file input** (find it, then `file_upload`; never click "Select files"). Don't put a #hashtag at the end of the title (its pop-up swallows the next click), and never press Escape in the upload window: it closes it (the video is kept as a draft; Shorts tab → Edit draft).
3. Title, description (from the .txt), "No, it's not made for kids", Next ×3, Visibility: Public now, or **Schedule 3:30 PM default time zone (GMT+3) = 6 pm IST**. One a day.
4. Music: Content → Shorts → the video → **Editor** → Get started → **Audio** → filter **Attribution not required** + mood Bright/Uplifting → pick a track not used before → **Add** (use the row's "Add" button ref, not the heart) → Save → tick "I acknowledge…" → Confirm changes. Processing takes minutes to hours. If a credit dialog appears, add the credit to the description (select all and retype; Cmd+End doesn't reach the end of the box).
5. Leaving Studio after Publish can show a stale "Leave site?" dialog; if Publish/Cancel are greyed, it's saved: navigate with force.

## Automation
- **Daily results push** (scheduled task `daily-results-push`, 09:00 GMT+3; prompt copy `handoff/daily-results-push-task.md`): picks the day's company with `scripts/results-day.mjs`; since 13 Nov writes the voiced script with `scripts/shorts-voice/from-results.mjs SYMBOL` (story chosen from the figures: margin squeeze, margin jump, profit outrunning sales, profit fall, or steady), checks it, builds with `scripts/shorts-voice/build.mjs`, uploads and schedules for 6 pm IST (no library music), and records it in `handoff/indexing-state.json` (`shorts`).

## Still to do (owner)
- ~~Verify the channel~~ Done 13 Nov (phone verified). Note: links in **Shorts** descriptions are never clickable (YouTube removed them in 2023 for every channel); the clickable path to the site is the channel page's link, and on Instagram the bio link.
- Decide on the contact email.
- Add the Play Store link once the app is approved (release sent for review 13 Nov).

## Rules
- Figures exactly as filed / as on the live results page; no buy, sell, target or "multibagger" (SEBI). "Not investment advice." in every description.
- Publish only the agreed Short; never change account settings.
- Views come from: a clear hook in the first second, company names people search, posting on the day of results, one a day.

## Instagram (from 13 Nov 2026)
- Account **@jocular_insights**, signed in on Chrome **Profile 7 "Jocular"** (the owner signs in; Claude never types the password).
- Profile (13 Nov): silver JI picture; bio "NSE company results and quality scores, explained in 40 seconds. Figures as filed with NSE. Free research: jocularinsights.in · Not investment advice". The website link can only be added in the Instagram phone app (the web form has it disabled) — owner to add https://jocularinsights.in there.
- **Two a day** (owner, 13 Nov): `daily-results-push` (09:00 GMT+3) makes two voiced Shorts, schedules them on YouTube for 6 pm and 9 pm IST, posts the 6 pm one to Instagram in the morning and queues the other in `~/Projects/files/shorts-v2/instagram-queue.json`; `instagram-evening` (18:35 GMT+3 ≈ 9 pm IST, prompt copy `handoff/instagram-evening-task.md`) posts it. BEL (14 Nov) and Sterlite (15 Nov) are queued as those days' morning Reels.
- HDFC vs ICICI Reel posted 14 Nov: https://www.instagram.com/jocular_insights/reel/Dfso4zTybLg/
- Reels so far: TCS "great company, falling stock?" — https://www.instagram.com/jocular_insights/reel/DfsPboguAlN/ (13 Nov), the same video as the YouTube Short.
- How to post (Claude in Chrome): left bar **+ Create** → hidden file input → `file_upload` the mp4 (from `~/Projects/files/shorts-upload/`) → OK on "Video posts are now shared as reels" → crop icon bottom-left → **Original** (otherwise it's cut square) → Next → cover: **Select From Computer** with a still from the video (the first frame is blank) → Next → caption (links aren't clickable; write "jocularinsights.in"; "Educational content, not investment advice.") → **Add AI label ON** (the voice is Kokoro, AI-made) → Share; wait ~30 s for "Your reel has been shared".
