# Stockwise India — bugs

From the test pass of 12 Oct 2026 (`replica/test-plan.md`). Only bugs reproduced
are listed. Severity: S1 data loss / security / core flow blocked · S2 feature
broken, no workaround · S3 broken with a workaround, or visibly wrong · S4 cosmetic.

No S1 or S2 found.

## BUG-001 · S3 · Dark theme: muted text below readable contrast
- **Steps:** open any screen in the dark theme (the default); run an axe scan.
- **Expected:** body text at least 4.5:1 against its background (WCAG AA).
- **Actual:** the muted text colour (`--t3` #686885) was 3.2–3.7:1 on every dark
  surface — 138 to 201 failures per screen (labels, hints, column headers).
- **Evidence:** `test-results/axe.txt` from `e2e/sweep.spec.js`.
- **Fixed:** `--t3` → #8282A0 (4.6–5.4:1, still dimmer than `--t2`). Remaining after
  the fix: 0 on Discover, ≤9 per company page (BUG-004).
- **Commit:** 464d470.

## BUG-002 · S3 · Number and form boxes without labels for screen readers
- **Steps:** company page → Valuation; Portfolio → + Add Holding; axe scan.
- **Expected:** every box has an accessible name.
- **Actual:** EPS, P/E, growth, margin-of-safety and the Sizing price box had no
  name (axe "label", critical); the Add Holding labels weren't tied to their boxes;
  the watchlist note and company note boxes had none.
- **Fixed:** aria-labels on the valuation and note boxes; `htmlFor`/`id` on Add Holding.
  The Sizing box's "Rs" prefix is now "₹" like the rest of the app.
- **Commit:** 464d470.

## BUG-003 · S3 · Notes longer than the limit were cut off silently
- **Steps:** Watchlist → + Add note → type 700 characters → Save → reload.
- **Expected:** the box stops at the limit, or all 700 are kept.
- **Actual:** the box took all 700, the server kept 500, nothing said so.
  Same gap for the holding name (200), holding notes (500), company-page note (2,000)
  and thesis boxes (4,000).
- **Evidence:** `e2e/edges.spec.js` F04-E1 — expected 700, received 500.
- **Fixed:** each box now has `maxLength` equal to what the server keeps; the test passes.
- **Commit:** 464d470.

## BUG-004 · S4 · A few low-contrast details left
- Red "Upper level" text on the highlighted (yellow-tinted) price row: 4.1:1.
- The faded "/100" after score badges on green: 4.0:1.
- Not fixed — small text, near the line; listed so they aren't forgotten.

## To check (not reproduced as bugs)
- Momentum's score runs past 100 (West Coast Paper 113.9). It isn't labelled "/100",
  so it may be by design — confirm the scale is meant to be open-ended.
- The Watchlist empty-state message scanned at 3.3:1 once; it was caught mid fade-in
  animation, so probably not real.
- Google and phone sign-in, password-reset email and Telegram delivery can't run on a
  127.0.0.1 test copy — they need the live site or localhost:5175 and real accounts.
