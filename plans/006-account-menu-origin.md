# 006 — Grow the Account menu from its button

- **Status**: DONE
- **Commit**: 833c0f1
- **Severity**: LOW
- **Category**: Physicality & origin
- **Estimated scope**: 2 files (`src/AccountMenu.jsx`, `src/index.css`), ~8 lines
- **Depends on**: 001 (uses `--ease-out-strong`)

## Problem

The Account dropdown appears in one frame, with nothing tying it to the
button it came from.

```jsx
// src/AccountMenu.jsx:35-36 — current
{open && (
  <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 240, zIndex: 200, background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 6, boxShadow: "var(--sh-lg)" …
```

The button sits at the top right; the menu is anchored `right: 0` under it.

## Target

- Scale in from the button's corner: from `scale(0.97); opacity: 0` to settled, **150ms `var(--ease-out-strong)`** (`cubic-bezier(0.23, 1, 0.32, 1)`), `transform-origin: top right`, via `@starting-style`. Never from `scale(0)`.
- Close stays instant (exits may be faster than entries; no exit animation needed).
- Reduced motion: opacity only.

```css
/* target */
.account-menu { transform-origin: top right;
  transition: opacity 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong); }
@starting-style { .account-menu { opacity: 0; transform: scale(0.97); } }
@media (prefers-reduced-motion: reduce) {
  @starting-style { .account-menu { opacity: 0; transform: none; } }
}
```

## Repo conventions to follow

- Trigger-anchored popovers elsewhere (e.g. `src/screener/ColumnMenu.jsx`) are inline-styled; add a `className` for the state rules, keep the inline style object as is.

## Steps

1. `src/AccountMenu.jsx:36`: add `className="account-menu"` to the `<div role="menu" …>` (keep its `style`).
2. `src/index.css`: append the target CSS with the comment `/* Account menu grows from its button (AccountMenu.jsx) */`.

## Boundaries

- Do NOT change the menu's items, size or position.
- Do NOT animate the delete-account modal opened from this menu (it's a portal; out of scope).
- If a step doesn't match the code you find, STOP and report.

## Verification

- **Mechanical**: `npm run build` succeeds.
- **Feel check**:
  - Click "Account": the menu grows out of the button's corner over ~150ms — barely noticeable, but it no longer pops.
  - DevTools Animations at 10%: scaling originates at the top-right corner, starting at 97%.
  - Open and close rapidly: never stuck half-visible.
  - Reduced motion emulated: fade only.
- **Done when**: the menu animates from the top-right corner and nothing else in the header changes.
