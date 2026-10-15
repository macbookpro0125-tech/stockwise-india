# 007 — Bring the "Added N holdings" message in and out along the bottom edge

- **Status**: DONE
- **Commit**: 833c0f1
- **Severity**: LOW
- **Category**: Missed opportunities (spatial consistency)
- **Estimated scope**: 2 files (`src/PortfolioView.jsx`, `src/index.css`), ~20 lines
- **Depends on**: 001 (uses `--ease-out-strong`)

## Problem

After importing a broker file, the confirmation appears in one frame and
disappears in one frame (after 6s or on OK).

```jsx
// src/PortfolioView.jsx:256-261 — current
{showImport && <ImportHoldingsModal onClose={() => setShowImport(false)} onImported={n => { setShowImport(false); setImported(n); portfolioStore.refresh(); setTimeout(() => setImported(null), 6000); }} />}
{imported != null && (
  <div role="status" style={{ position: "fixed", left: "50%", bottom: 90, transform: "translateX(-50%)", zIndex: 250, padding: "10px 16px", borderRadius: 10, background: "var(--s3)", border: "1px solid var(--bdr2)", color: "var(--t1)", fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
>
    Added {imported} holding{imported === 1 ? "" : "s"} from the file. <button type="button" onClick={() => setImported(null)} className="btn-ghost" style={{ height: 24, marginLeft: 8, fontSize: 11 }}>OK</button>
  </div>
)}
```

## Target

- Enter from below: `transform: translateY(100%); opacity: 0` → settled, **300ms `var(--ease-out-strong)`** (`cubic-bezier(0.23, 1, 0.32, 1)`), via `@starting-style`.
- Leave by the same edge: to `translateY(100%); opacity: 0`, **200ms** same curve, then unmount.
- Centring moves from `transform` to the separate `translate` property so `transform` is free to animate.
- Reduced motion: opacity only.

```css
/* target */
.status-toast { left: 50%; translate: -50% 0; transform: none; opacity: 1;
  transition: transform 300ms var(--ease-out-strong), opacity 300ms var(--ease-out-strong); }
@starting-style { .status-toast { transform: translateY(100%); opacity: 0; } }
.status-toast.leaving { transform: translateY(100%); opacity: 0; transition-duration: 200ms; }
@media (prefers-reduced-motion: reduce) {
  .status-toast, .status-toast.leaving { transform: none; }
  @starting-style { .status-toast { transform: none; opacity: 0; } }
}
```

## Repo conventions to follow

- Local state with `useState` (the component imports `useState` at line 1).
- New class rules appended to `src/index.css` with a short comment.

## Steps

1. `src/PortfolioView.jsx`: add state next to `imported`: `const [toastLeaving, setToastLeaving] = useState(false);`
2. Add a dismiss function:
   ```js
   // Drops the message back down before it goes (index.css .status-toast.leaving)
   const dismissToast = () => { setToastLeaving(true); setTimeout(() => { setImported(null); setToastLeaving(false); }, 200); };
   ```
3. In `onImported`, replace `setTimeout(() => setImported(null), 6000);` with `setTimeout(dismissToast, 6000);`.
4. The toast `<div role="status" …>`: add `className={`status-toast${toastLeaving ? " leaving" : ""}`}` and remove `left: "50%"` and `transform: "translateX(-50%)"` from its style object (the class now centres it). Keep every other style value.
5. The OK button: `onClick={() => setImported(null)}` → `onClick={dismissToast}`.
6. `src/index.css`: append the target CSS with the comment `/* Portfolio import message enters and leaves along the bottom edge */`.

## Boundaries

- Do NOT change the import flow, the modal, or the message text.
- Do NOT introduce a toast library.
- If a step doesn't match the code you find, STOP and report.

## Verification

- **Mechanical**: `npm run build` succeeds; `npx playwright test -g "F05-H2" --workers=1` passes (broker file import).
- **Feel check**:
  - Portfolio → Import → import the sample file: the message rises into place; after 6s (or OK) it drops back down.
  - The message stays horizontally centred during and after the motion.
  - Reduced motion emulated: it fades in and out.
- **Done when**: the message enters and exits along the bottom edge and remains centred.
