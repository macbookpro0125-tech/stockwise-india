import { useEffect, useState } from "react";

// A phone's top bar (PhoneChrome.jsx, 26 Oct 2026, after Reddit's app): the
// menu button opens Settings from the left, + opens what can be made. Which
// is open is kept here, so the header, the floating buttons and the edge
// swipe all open the same one.

export const NEW_SCREEN_EVENT = "jocular-new-screen";

let open = null; // "settings" | "create" | null
const listeners = new Set();
const set = v => { open = v; listeners.forEach(fn => fn(v)); };

export const chrome = {
  open(which) {
    if (open === which) return;
    // a history entry of its own, so Back (the browser's or Android's) closes it
    if (!open) window.history.pushState({ ...(window.history.state ?? {}), phonePanel: which }, "");
    set(which);
  },
  close() {
    if (!open) return;
    if (window.history.state?.phonePanel) window.history.back();
    else set(null);
  },
  // the page moved on (a tab, a company) while a panel was open
  dismiss() { set(null); },
  current: () => open,
};

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => { if (open && !window.history.state?.phonePanel) set(null); });
}

export function usePanel() {
  const [v, setV] = useState(open);
  useEffect(() => { listeners.add(setV); setV(open); return () => listeners.delete(setV); }, []);
  return v;
}

// Whether the page has scrolled past the top bar, when its buttons float
export function useScrolledPast(px = 72) {
  const [past, setPast] = useState(() => typeof window !== "undefined" && window.scrollY > px);
  useEffect(() => {
    let frame = 0;
    const on = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setPast(window.scrollY > px)); };
    window.addEventListener("scroll", on, { passive: true });
    on();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", on); };
  }, [px]);
  return past;
}
