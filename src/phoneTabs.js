// The company page's tabs on a phone (StockDetail.jsx): one tab's parts at a
// time, each part marked with its tab (data-tab). A jump to a part that's on
// another tab — a scorecard row, "See Financial health", "All dates" — asks
// the page to show that tab, then goes there.
import { useEffect, useState } from "react";

export const SHOW_TAB = "sd-show-tab";
const PHONE = "(max-width: 640px)";

export function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(PHONE);
    if (!mq) return;
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

// Shows the tab the element is on, if it's hidden; true when it had to (the
// caller then waits a frame or two before scrolling)
export function revealPart(el) {
  const host = el?.closest?.("[data-tab]");
  // (a wrapper of several parts has no box of its own — display: contents —
  // so it's read by its style, not its size)
  if (!host || getComputedStyle(host).display !== "none") return false;
  window.dispatchEvent(new CustomEvent(SHOW_TAB, { detail: host.dataset.tab }));
  return true;
}
