---
name: instagram-evening
description: Each evening ~9 pm IST: post the day's second Short to Instagram as a Reel, from the queue the morning run fills
---

Evening Instagram Reel for Jocular Insights (the owner asked on 13 Nov 2026 for two videos a day; Instagram's website can't schedule, so this run posts the second one). Repo ~/Projects/stockwise-india; read handoff/YOUTUBE.md ("Instagram") if anything is unclear.

1. Open ~/Projects/files/shorts-v2/instagram-queue.json. Take entries whose "date" is today (Gulf time, GMT+3) and "slot" is "evening" and "posted" is null. If there are none, stop quietly (no log line needed).

2. For each (normally one), with Claude in Chrome (the owner's Chrome, Jocular profile, signed in to Instagram as @jocular_insights; if Chrome isn't connected or Instagram shows a login page, stop and say so; never type a password): copy the entry's mp4 and cover jpg into ~/Projects/files/shorts-upload/; https://www.instagram.com/ → left bar "+ Create" → upload the mp4 through the hidden file input → OK on "Video posts are now shared as reels" → crop icon (bottom-left) → "Original" (otherwise it's cut square) → Next → Cover photo: "Select From Computer" (hidden file input) with the cover → Next → caption: the INSTAGRAM CAPTION section of the entry's caption file, exactly → "Add AI label" ON (the voice is AI-made) → Share; wait ~30 s for "Your reel has been shared". The link is the newest /reel/ on https://www.instagram.com/jocular_insights/reels/. Set the entry's "posted" to that link. Delete the copies in shorts-upload.

3. Add one line to handoff/LOG.md (date, "Evening Reel:", company, link) and commit only handoff/LOG.md (git fetch first; other tools edit this repo; never push; end the commit message with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>").

4. Finish with one plain line for the owner. Post nothing but the queued Reel; never change account settings; never edit the caption's figures.
