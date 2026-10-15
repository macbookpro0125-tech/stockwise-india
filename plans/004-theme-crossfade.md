# 004 — Cross-fade the switch between light and dark

- **Status**: DONE
- **Commit**: 833c0f1
- **Severity**: LOW
- **Category**: Missed opportunities (preventing a jarring change) / Accessibility
- **Estimated scope**: 2 files (`src/App.jsx`, `src/index.css`), ~15 lines

## Problem

The theme button flips the whole screen between black and near-white in a
single frame — the abrupt brightness jump accessibility guidance warns about.

```jsx
// src/App.jsx:26-37 — current
// Dark by default, as the original; the choice is remembered in this browser
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("stockwise-india-theme") || "dark"; } catch { return "dark"; }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("stockwise-india-theme", theme); } catch {}
  }, [theme]);
  const toggle = useCallback(() => setTheme(t => (t === "dark" ? "light" : "dark")), []);
  return [theme, toggle];
}
```

## Target

- Use the View Transitions API: the old and new pages cross-fade over **250ms, `ease`** (colour change → `ease`).
- The `data-theme` attribute is set synchronously inside the transition callback, so the "new" snapshot is already in the new theme.
- No View Transitions support, or `prefers-reduced-motion: reduce` → switch instantly, as today.

```js
// target — src/App.jsx
const toggle = useCallback(() => {
  const next = (document.documentElement.getAttribute("data-theme") === "light") ? "dark" : "light";
  const apply = () => {
    document.documentElement.setAttribute("data-theme", next);
    flushSync(() => setTheme(next));
  };
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) { apply(); return; }
  document.startViewTransition(apply);
}, []);
```

```css
/* target — src/index.css */
::view-transition-old(root), ::view-transition-new(root) {
  animation-duration: 250ms;
  animation-timing-function: ease;
}
```

## Repo conventions to follow

- `useTheme` is the only place that owns the theme; keep the `useEffect` (it still persists the choice and covers the first render).
- `react-dom` is already a dependency (`src/AccountMenu.jsx:2` imports `createPortal` from it) — import `flushSync` the same way.
- Global CSS additions go at the end of `src/index.css` with a short comment.

## Steps

1. `src/App.jsx`: add `import { flushSync } from "react-dom";` after the existing `import { Suspense, useState, useEffect, useRef, useCallback } from "react";` line.
2. `src/App.jsx`: replace the line
   `const toggle = useCallback(() => setTheme(t => (t === "dark" ? "light" : "dark")), []);`
   with the target `toggle` above, plus one comment line above it:
   `// Cross-fades the two themes (View Transitions); instant without support or with reduced motion`.
3. `src/index.css`: append the target CSS with the comment `/* Theme switch: a 250ms cross-fade (App.jsx useTheme) */`.

## Boundaries

- Do NOT change how the theme is stored or its default.
- Do NOT add custom view-transition names elsewhere (root cross-fade only).
- Do NOT touch `PriceChartPanel.jsx` — it already rebuilds its colours when `data-theme` changes.
- If a step doesn't match the code you find, STOP and report.

## Verification

- **Mechanical**: `npm run build` succeeds.
- **Feel check**:
  - Click the sun/moon button in the header (Chrome, Safari 18+): the page cross-fades over ~250ms instead of flashing.
  - The price chart on `/stock/TCS` ends in the new theme's colours.
  - Click the button twice quickly: no stuck half-state; the second click wins.
  - Reduced motion emulated: the switch is instant.
  - Firefox (no View Transitions): instant switch, no errors in the console.
- **Done when**: the switch fades on supporting browsers and stays instant elsewhere; the theme still persists after reload.
