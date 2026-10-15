# 005 — Let a removed watchlist row fold away instead of vanishing

- **Status**: DONE
- **Commit**: 833c0f1
- **Severity**: LOW
- **Category**: Missed opportunities (preventing a jarring change)
- **Estimated scope**: 2 files (`src/WatchlistView.jsx`, `src/index.css`), ~20 lines
- **Depends on**: 001 (uses `--ease-out-strong`)

## Problem

On the Watchlist, the ✕ button removes a card in one frame and every card
below jumps up to fill the gap.

```jsx
// src/WatchlistView.jsx:148-150 — current (the card)
return (
  <div key={item.ticker} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--s2)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
```

```jsx
// src/WatchlistView.jsx:213 — current (the remove button)
<button onClick={() => toggleWatch(item.ticker)} title="Remove from watchlist" aria-label="Remove from watchlist" style={iconBtn}><X size={15} /></button>
```

Cards are rendered from `sorted` inside `<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>` (line ~142). `toggleWatch` (`src/watchlist.js:34`) removes the symbol from the shared set at once, which removes the card.

## Target

- On ✕: the card fades and collapses — `opacity 1 → 0` and its height to 0 — over **200ms `var(--ease-out-strong)`** (`cubic-bezier(0.23, 1, 0.32, 1)`), then `toggleWatch` runs.
- The collapse uses the grid-rows technique on a wrapper (`grid-template-rows: 1fr → 0fr`), so no height is hard-coded.
- CSS **transitions** (not keyframes), so they retarget smoothly.
- Reduced motion: opacity only (150ms), no collapse animation.

```css
/* target */
.wl-row { display: grid; grid-template-rows: 1fr; opacity: 1;
  transition: grid-template-rows 200ms var(--ease-out-strong), opacity 200ms var(--ease-out-strong), margin 200ms var(--ease-out-strong); }
.wl-row > * { min-height: 0; overflow: hidden; }
.wl-row.leaving { grid-template-rows: 0fr; opacity: 0; margin-bottom: -10px; pointer-events: none; }
@media (prefers-reduced-motion: reduce) {
  .wl-row { transition: opacity 150ms ease; }
  .wl-row.leaving { grid-template-rows: 1fr; margin-bottom: 0; }
}
```

(`margin-bottom: -10px` cancels the list's `gap: 10` so the space closes fully.)

## Repo conventions to follow

- Local UI state with `useState` in `WatchlistView` (see lines 73-80).
- New class rules go in `src/index.css`; append near the end with a short comment.

## Steps

1. `src/WatchlistView.jsx`: add state after line 80: `const [leaving, setLeaving] = useState(() => new Set());`
2. Add a handler below it:
   ```js
   // Folds the card away, then removes it (index.css .wl-row.leaving)
   const removeCard = ticker => {
     setLeaving(s => new Set(s).add(ticker));
     const ms = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 150 : 200;
     setTimeout(() => { toggleWatch(ticker); setLeaving(s => { const n = new Set(s); n.delete(ticker); return n; }); }, ms);
   };
   ```
3. Wrap each card: the element returned in the `sorted.map(…)` becomes
   ```jsx
   <div key={item.ticker} className={`wl-row${leaving.has(item.ticker) ? " leaving" : ""}`}>
     <div style={{ /* the card's existing style object, unchanged */ }}> … existing children … </div>
   </div>
   ```
   (move `key` to the wrapper; the inner card keeps its exact existing style).
4. Line 213: `onClick={() => toggleWatch(item.ticker)}` → `onClick={() => removeCard(item.ticker)}`.
5. `src/index.css`: append the target CSS with the comment `/* Watchlist: a removed card folds away (WatchlistView.jsx removeCard) */`.

## Boundaries

- Do NOT change `toggleWatch` or `src/watchlist.js` (unstarring elsewhere still removes at once — that's fine, the card isn't on screen then).
- Do NOT change the card's own styling or content.
- If a step doesn't match the code you find, STOP and report.

## Verification

- **Mechanical**: `npm run build` succeeds; `npx playwright test -g "F04" --workers=1` passes (it removes a card and expects it gone; the 200ms delay is within its wait).
- **Feel check**:
  - Watchlist with 3+ stocks → ✕ on the middle one: it fades and folds; the cards below slide up smoothly instead of jumping.
  - Remove two cards quickly: both fold independently, no flicker.
  - DevTools Animations at 10%: no leftover gap after the fold.
  - Reduced motion emulated: the card fades, then the list closes up.
- **Done when**: removal folds smoothly and the card is gone from the server list (reload confirms).
