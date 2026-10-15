# 003 — Let the stock page's expandable sections open smoothly

- **Status**: DONE
- **Commit**: 833c0f1
- **Severity**: LOW
- **Category**: Missed opportunities (state indication)
- **Estimated scope**: 1 file (`src/index.css`), ~10 lines
- **Depends on**: 001 (uses `--ease-out-strong`)

## Problem

The stock page's `<details>` sections snap open in one frame — the research
"why" sections (also opened by the left scorecard's rows) and the EPS / fair
value breakdown. The content below jumps.

```jsx
// src/ResearchPanel.jsx:157-168 — current
function Expand({ id, title, right, children, open = false }) {
  return (
    <details id={id} open={open} className="research-expand" style={{ borderTop: "1px solid var(--bdr)", padding: "2px 0" }}>
      <summary …>…</summary>
      <div style={{ padding: "0 0 10px 23px" }}>{children}</div>
    </details>
  );
}
```

```jsx
// src/StockDetail.jsx:948 — current
<details style={{ ...card, padding: 0 }}>
```

Both live inside the stock page wrapper, which has the classes `sd ap` (`src/StockDetail.jsx`, `<div className="sd ap">`).

## Target

Native `<details>` content animates its height with `::details-content` and
`interpolate-size` (progressive enhancement: browsers without support keep
snapping, exactly as today). Height on one small element, only on open/close,
occasionally — an accepted exception to "transform and opacity only".

```css
/* target */
.sd details { interpolate-size: allow-keywords; }
.sd details::details-content {
  height: 0; overflow: clip;
  transition: height 220ms var(--ease-out-strong), content-visibility 220ms allow-discrete;
}
.sd details[open]::details-content { height: auto; }
@media (prefers-reduced-motion: reduce) {
  .sd details::details-content { transition: none; }
}
```

`--ease-out-strong` is `cubic-bezier(0.23, 1, 0.32, 1)` (added by plan 001).

## Repo conventions to follow

- The research `<details>` styles are in `src/index.css` around lines 580-593 (`.research-expand > summary …`, `.research-expand[open] > summary .research-chevron { transform: rotate(180deg); }`). Add the new block right after line 593 (`.research-expand { scroll-margin-top: … }`).
- Scope with `.sd` (the stock page) so no other `<details>` in the app changes.

## Steps

1. `src/index.css`: after the line `.research-expand { scroll-margin-top: calc(var(--header-h, 0px) + 72px); }`, add the target block above, preceded by the comment
   `/* Stock page: <details> open with a short height transition (browsers without ::details-content keep snapping) */`.

## Boundaries

- Do NOT change any JSX.
- Do NOT put `interpolate-size` on `:root` (it would start animating other auto-size transitions app-wide).
- Do NOT animate closing slower than opening; both use the same 220ms.
- If a step doesn't match the code you find, STOP and report.

## Verification

- **Mechanical**: `npm run build` succeeds.
- **Feel check** (Chrome 131+ for the animation; Safari/Firefox should still snap open correctly):
  - Open `/stock/TCS` → Scorecard → click "Why this score" style rows: content grows open over ~220ms, the chevron still turns.
  - Click a row in the left scorecard (e.g. "Growth"): its section opens smoothly and the page still lands with the section under the pinned bar.
  - Valuation → "EPS and fair-value breakdown": opens and closes smoothly.
  - Click a summary rapidly several times: it reverses from where it is, never restarts from zero.
  - Reduced motion emulated: sections snap open, no height animation.
- **Done when**: the sections animate on supporting browsers, and nothing changes on unsupported ones.
