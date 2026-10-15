# 001 — Give the four bare modals the app's modal entrance (and add the shared motion tokens)

- **Status**: DONE
- **Commit**: 833c0f1
- **Severity**: MEDIUM
- **Category**: Missed opportunities / Cohesion & tokens
- **Estimated scope**: 5 files (`src/index.css`, `src/screener/MetricPicker.jsx`, `src/ImportHoldingsModal.jsx`, `src/HowItWorks.jsx`, `src/CompareView.jsx`), ~15 lines

## Problem

Two modals already ease in; four others pop in with no motion, so the app is
inconsistent and those four feel abrupt.

Exemplar that is already right — `src/CreateAlertModal.jsx:44-48`:

```jsx
<div
  onClick={e => { if (e.target === e.currentTarget) onClose(false); }}
  style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
>
  <div style={{ background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, padding: 28, width: 380, maxWidth: "90vw", boxShadow: "var(--sh-lg)", animation: "fadeUp 200ms cubic-bezier(0,0,0.2,1) backwards" }}>
```

The four without motion (current code, verbatim):

```jsx
// src/screener/MetricPicker.jsx:26-29 — current
<div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
  style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
  <div role="dialog" aria-label={mode === "filter" ? "Add filters" : "Choose columns"}
    style={{ width: "min(760px, 100%)", height: "min(620px, 100%)", display: "flex", flexDirection: "column", background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, boxShadow: "var(--sh-lg)", overflow: "hidden" }}>
```

```jsx
// src/ImportHoldingsModal.jsx:65-67 — current
<div role="dialog" aria-modal="true" aria-label="Import holdings from a broker file" onClick={onClose}
  style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
  <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "18px 20px" }}>
```

```jsx
// src/HowItWorks.jsx:29-33 — current
<div
  onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
  style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
>
  <div style={{ width: "min(1100px, 100%)" }}>
```

```jsx
// src/CompareView.jsx:91 — current (a full-screen surface, not a centred card)
<div style={{ position: "fixed", inset: 0, zIndex: 300, background: "color-mix(in srgb, var(--bg) 96%, transparent)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)", overflowY: "auto", padding: "20px var(--page-x)" }}>
```

## Target

- Backdrops fade in: `animation: "fadeIn 150ms cubic-bezier(0.23, 1, 0.32, 1) backwards"`.
- Centred panels use the exemplar's entrance exactly: `animation: "fadeUp 200ms cubic-bezier(0,0,0.2,1) backwards"` (8px rise + fade). Modals stay centred; no `transform-origin` change.
- `CompareView` is a full-screen surface that contains its own `position: fixed` child (`InvestmentBriefView`), so it gets **opacity only**: `animation: "fadeIn 200ms cubic-bezier(0.23, 1, 0.32, 1) backwards"`. No transform on it.
- Reduced motion: `fadeUp` becomes opacity-only app-wide (gentler, not zero).
- New shared tokens (used by plans 002–007): `--ease-out-strong` and `--ease-drawer`.

```css
/* target additions in src/index.css */
:root {
  --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);  /* entering/exiting UI */
  --ease-drawer:     cubic-bezier(0.32, 0.72, 0, 1);  /* sheets and drawers */
}
@keyframes fadeIn { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  @keyframes fadeUp { from { opacity: 0; } to { opacity: 1; } }
}
```

## Repo conventions to follow

- Motion tokens live in the first `:root` block of `src/index.css` under the comment `/* ── Motion ── */` (currently `--ease`, `--ease-out`, `--fast`, `--med`, `--slow`, around line 84). Add the two new tokens there. Do **not** change the existing `--ease-out` value — other animations depend on it.
- Keyframes live near `@keyframes fadeUp` (around line 289). Read the comment above it: run `fadeUp`/`fadeIn` with fill-mode **`backwards`, never `both`/`forwards`** — a leftover transform turns the element into the frame for `position: fixed` children.
- Inline `style={{ … animation: "…" }}` is how modals animate here (exemplar above).

## Steps

1. `src/index.css`: under `/* ── Motion ── */` in the first `:root` block, after `--slow: 280ms;`, add:
   ```css
   --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
   --ease-drawer:     cubic-bezier(0.32, 0.72, 0, 1);
   ```
2. `src/index.css`: directly after the `@keyframes fadeUp { … }` block, add:
   ```css
   @keyframes fadeIn { from { opacity: 0; } }
   @media (prefers-reduced-motion: reduce) {
     @keyframes fadeUp { from { opacity: 0; } to { opacity: 1; } }
   }
   ```
3. `src/screener/MetricPicker.jsx`: in the overlay's style object (line ~27) append `, animation: "fadeIn 150ms cubic-bezier(0.23, 1, 0.32, 1) backwards"`; in the `role="dialog"` div's style (line ~29) append `, animation: "fadeUp 200ms cubic-bezier(0,0,0.2,1) backwards"`.
4. `src/ImportHoldingsModal.jsx`: overlay style (line ~66) append `, animation: "fadeIn 150ms cubic-bezier(0.23, 1, 0.32, 1) backwards"`; inner panel style (line ~67) append `, animation: "fadeUp 200ms cubic-bezier(0,0,0.2,1) backwards"`.
5. `src/HowItWorks.jsx`: overlay style (line ~31) append `, animation: "fadeIn 150ms cubic-bezier(0.23, 1, 0.32, 1) backwards"`; the `width: "min(1100px, 100%)"` div (line ~33) gets `animation: "fadeUp 200ms cubic-bezier(0,0,0.2,1) backwards"` added to its style.
6. `src/CompareView.jsx`: the outer fixed div (line ~91) style append `, animation: "fadeIn 200ms cubic-bezier(0.23, 1, 0.32, 1) backwards"`. No transform.

## Boundaries

- Do NOT touch `CreateAlertModal.jsx`, `AddHoldingModal.jsx`, `AlertsView.jsx`, `DiscoverView.jsx` modals — they already animate.
- Do NOT add exit animations (out of scope; modals close instantly, which is fine).
- Do NOT use fill-mode `both` or `forwards`.
- Do NOT change markup, sizes or colours. Motion properties only.
- If a step doesn't match the code you find, STOP and report.

## Verification

- **Mechanical**: `npm run build` succeeds with no errors.
- **Feel check** (`npm start` or the preview, signed in):
  - Discover → open a screen → "Add filter": the picker rises 8px and fades in over ~200ms; the dim backdrop fades in slightly faster.
  - Portfolio → "Import" (broker file), Discover → "See how it works", Discover table → tick 2 rows → "Compare": each now eases in; Compare fades without moving.
  - In Compare, open the investment brief immediately: it covers the whole screen (not offset).
  - DevTools → Animations panel at 10%: the panel never starts from `scale(0)`; movement is 8px, not more.
  - Rendering panel → emulate `prefers-reduced-motion: reduce`: modals fade in without rising.
- **Done when**: all four surfaces animate in as above, build passes, no element keeps a transform after its entrance.
