# Switching Claude accounts (owner's routine since 14 Nov 2026)

The owner moves to another Claude account every **Sunday** and comes back to this one every **Thursday**. Both accounts run on this same Mac and the same project folder.

## The three daily and weekly jobs

| Job | When (Gulf time) | Backup copy |
|---|---|---|
| daily-results-push | every day 09:00 | handoff/daily-results-push-task.md |
| instagram-evening | every day 18:35 | handoff/instagram-evening-task.md |
| weekly-score-review | Sundays 10:00 | handoff/weekly-score-review-task.md |

Each job starts by checking a marker file in ~/Projects/files/shorts-v2/runs/ (daily-, evening-, score-review-<date>). If today's file is there, the job stops. So when both accounts hold the jobs, the day's work still happens only once, and no video is posted twice.

## On each switch (Sunday and Thursday)

1. In the account you switch **to**, open this project and say **"set up the jobs"**. Claude checks the Scheduled list. Any missing job is created from its backup copy, with the same time. Existing jobs are left as they are, never duplicated.
2. Click **"Run now"** once on each new job, so it gets its permissions (browser and Chrome). The marker file stops it doing anything twice that day.
3. In Chrome (Jocular profile), open the Claude side panel and **sign in with the same Claude account** as the app. YouTube and Instagram uploads go through Chrome. If Chrome is connected to the other account, uploads are skipped and the job says so.
4. Nothing else changes: the YouTube channels (English and Hindi), Instagram, Search Console and the project files are the same for both accounts.

## Task names in the second account

Both accounts keep their task folders in the same ~/.claude/scheduled-tasks/, so the second account can't reuse a name. Its copies are `instagram-evening-2` and `weekly-score-review-2` (set up 15 Nov 2026), and `daily-results-push-2` once it's created. Each one's prompt just says to follow the backup file here, so a change to the backup file reaches it straight away.

## When Claude changes a job

Claude copies the job's new text to its backup file here in the same step, so both accounts always rebuild the latest version.
