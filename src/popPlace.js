import { useLayoutEffect } from "react";

// A menu pinned to its button's right edge (a watchlist card's globe and list
// buttons), kept inside the screen: once drawn, before it shows, it slides
// right if its left edge would leave the screen (26 Oct 2026, the globe's
// menu ran off a phone's left side). `open` is its style: { right, top | bottom }
export function useOnScreen(pop, open, setOpen) {
  useLayoutEffect(() => {
    const el = pop.current;
    if (!el || !open || open.right == null) return;
    // its laid-out width, not its drawn box: it opens with a small grow-in
    const left = window.innerWidth - open.right - el.offsetWidth;
    if (left < 8) setOpen(o => (o ? { ...o, right: Math.max(8, o.right - (8 - left)) } : o));
  }, [open, pop, setOpen]);
}
