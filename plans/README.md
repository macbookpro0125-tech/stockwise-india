# Animation plans

Written by `improve-animations` on 15 Oct 2026 at commit `833c0f1`, from the
opportunity sweep of the same day. Each plan is self-contained: exact files,
current code, target values, steps, boundaries and a feel check.

| # | Plan | Severity | Status |
|---|---|---|---|
| 001 | [Modal entrances + shared motion tokens](001-modal-entrances.md) | MEDIUM | DONE |
| 002 | [Phone filter sheet slides up and back](002-phone-filter-sheet.md) | MEDIUM | DONE |
| 003 | [Stock page details open smoothly](003-research-details-expand.md) | LOW | DONE |
| 004 | [Light/dark cross-fade](004-theme-crossfade.md) | LOW | DONE |
| 005 | [Watchlist card folds away on remove](005-watchlist-row-exit.md) | LOW | DONE |
| 006 | [Account menu grows from its button](006-account-menu-origin.md) | LOW | DONE |
| 007 | [Import message enters/leaves at the bottom](007-import-toast.md) | LOW | DONE |
| 008 | [Keep the dome film sharp as the camera zooms in](008-dome-zoom-closeups.md) | HIGH | DONE (16 Oct 2026; Real-ESRGAN master, see the plan's Result) |

008 was added on 16 Oct 2026 at `dca95bf`, for the front-page scroll film. It
depends on none of the others. Commit the Apple-design edits to `src/DomeFilm.jsx`
and `src/dome-film.css` before running it, because its excerpts come from that
working tree.

## Order and dependencies

1. **001 first** — it adds `--ease-out-strong` and `--ease-drawer` to `src/index.css`, which 002, 003, 005, 006 and 007 use.
2. Then 002–007 in any order; they touch separate components. 002, 003, 004, 005, 006 and 007 each append to `src/index.css`, so run them one after another, not in parallel.

## Deliberately not planned

Header tabs, the stock page tab bar, the "/" search, the column ▾ sort menu
(all used constantly), re-sorting rows and the price chart (data being read),
and counting up prices (misleading for financial figures).

For the scroll film (16 Oct, measured before deciding):
- Rebuilding its glow layer at full size: sharpness at mid-zoom rose only from 2.67 to 2.87, so the glow isn't the cause.
- Retiming the zoom so the blur hides under the light: it changes the film's pacing, and close-ups were chosen instead.

## Done (15 Oct 2026)

All seven carried out on branch `price-close-rule-original` (commits `cc149f0`…`9e228a4`).
One deviation, in 007: the base `.status-toast` rule doesn't set `transform: none`
— the production CSS minifier (lightningcss) folded it into `translate`, which put
the message off-centre. `transform`'s default is already `none`.
Feel-checked in Chrome 155: theme cross-fade runs; the Account menu starts at
`scale(0.97)` and settles to `none`; the import message is centred; a research
section grows 45 → 345px over ~220ms; the phone sheet starts at translateY(100%),
rests at `none`, and slides back down before it's removed.
