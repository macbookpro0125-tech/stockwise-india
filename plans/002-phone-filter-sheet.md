# 002 — Slide the phone filter sheet up from the bottom, and back down on close

- **Status**: DONE
- **Commit**: 833c0f1
- **Severity**: MEDIUM
- **Category**: Missed opportunities / Physicality & origin
- **Estimated scope**: 2 files (`src/index.css`, `src/DiscoverView.jsx`), ~20 lines
- **Depends on**: 001 (uses `--ease-drawer`, `--ease-out-strong`)

## Problem

On phones, "Filters" opens a full-screen sheet that appears in one frame, and
"Show N results" removes it in one frame — the list teleports in and out.

```jsx
// src/DiscoverView.jsx:331-341 — current
{/* Phones: the filters open over the page, with the result count on the way back */}
{sheetOpen && createPortal(
  <div className="filter-sheet">
    <div className="filter-sheet-body">{panel}</div>
    <div className="filter-sheet-foot">
      <button className="btn-primary" onClick={() => { setSheetOpen(false); window.scrollTo(0, 0); }} style={{ width: "100%" }}>
        {updating ? "Updating…" : `Show ${matched != null ? matched.toLocaleString("en-IN") : ""} results`}
      </button>
    </div>
  </div>,
  document.body,
)}
```

```css
/* src/index.css:546 — current */
.filter-sheet { position: fixed; inset: 0; z-index: 900; background: var(--bg); display: flex; flex-direction: column; }
```

The sheet is opened by `setSheetOpen(true)` at `src/DiscoverView.jsx:433` and `:479`.

## Target

- Enter: from `transform: translateY(100%)` to `transform: none`, `300ms var(--ease-drawer)` (`cubic-bezier(0.32, 0.72, 0, 1)`), via `@starting-style` (no JS for entry).
- Exit along the same edge: to `translateY(100%)`, `250ms var(--ease-out-strong)` (`cubic-bezier(0.23, 1, 0.32, 1)`), then unmount.
- Resting state is `transform: none` (never a leftover `translateY(0)`: the sheet holds `position: fixed` popovers).
- Reduced motion: no movement; a 200ms opacity fade in and out.

```css
/* target */
.filter-sheet { position: fixed; inset: 0; z-index: 900; background: var(--bg); display: flex; flex-direction: column;
  transform: none; transition: transform 300ms var(--ease-drawer); }
@starting-style { .filter-sheet { transform: translateY(100%); } }
.filter-sheet.closing { transform: translateY(100%); transition: transform 250ms var(--ease-out-strong); }
@media (prefers-reduced-motion: reduce) {
  .filter-sheet { transform: none; transition: opacity 200ms ease; }
  @starting-style { .filter-sheet { transform: none; opacity: 0; } }
  .filter-sheet.closing { transform: none; opacity: 0; transition: opacity 200ms ease; }
}
```

## Repo conventions to follow

- Component styles that need states live as classes in `src/index.css` (this sheet already has `.filter-sheet`, `.filter-sheet-body`, `.filter-sheet-foot` at lines 546-548). Put the new rules directly after line 546.
- State lives in `DiscoverView` with `useState` (`sheetOpen` at line 129).

## Steps

1. `src/index.css`: replace the `.filter-sheet { … }` rule at line 546 with the target block above (keep the `.filter-sheet-body` and `.filter-sheet-foot` rules unchanged).
2. `src/DiscoverView.jsx`: next to `const [sheetOpen, setSheetOpen] = useState(false);` (line 129) add
   `const [sheetClosing, setSheetClosing] = useState(false);`
3. `src/DiscoverView.jsx`: add a close function next to it:
   ```js
   // Slides the sheet back down before it goes (index.css .filter-sheet.closing)
   const closeSheet = () => {
     setSheetClosing(true);
     const ms = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 200 : 250;
     setTimeout(() => { setSheetOpen(false); setSheetClosing(false); window.scrollTo(0, 0); }, ms);
   };
   ```
4. `src/DiscoverView.jsx:333`: `<div className="filter-sheet">` → `<div className={`filter-sheet${sheetClosing ? " closing" : ""}`}>`.
5. `src/DiscoverView.jsx:336`: the button's `onClick={() => { setSheetOpen(false); window.scrollTo(0, 0); }}` → `onClick={closeSheet}`. Also set `disabled={sheetClosing}` on it so a double tap can't queue two closes.

## Boundaries

- Do NOT change the sheet's content, the panel, or the open buttons at lines 433 and 479.
- Do NOT add drag-to-dismiss (separate, larger piece of work).
- Do NOT leave `transform: translateY(0)` as the resting value — use `none`.
- If a step doesn't match the code you find, STOP and report.

## Verification

- **Mechanical**: `npm run build` succeeds.
- **Feel check** (phone width 390px, e.g. DevTools device mode):
  - Discover → open any screen → "Filters": the sheet rises from the bottom over ~300ms and settles without a bounce.
  - "Show N results": the sheet drops back down the same way it came, then the list is at the top.
  - Tap "Show N results" twice quickly: it closes once, no flicker.
  - Inside the sheet, open a metric's ⓘ info popover: it appears next to its trigger, not offset.
  - DevTools Animations at 10%: the first frames are fast (drawer curve), the end eases in gently.
  - Reduced motion emulated: the sheet fades in/out, no sliding.
- **Done when**: open and close both animate along the bottom edge, and the sheet has `transform: none` at rest (check computed style).
