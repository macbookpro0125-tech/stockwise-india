// Installing the site as an app (17 Oct 2026). Chrome and Edge on Android and
// desktop offer it through beforeinstallprompt, kept here so a menu item can
// ask later; iPhones and iPads have no prompt — Safari's Share menu has "Add
// to Home Screen" — so there the item explains that instead. Imported early
// (main.jsx), as the browser fires the event soon after load.
let deferred = null;
const listeners = new Set();
const changed = () => listeners.forEach(f => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; changed(); });
  window.addEventListener("appinstalled", () => { deferred = null; changed(); });
}

// "installed" (running as the app), "prompt" (the browser can install it),
// "ios" (Add to Home Screen by hand), or null (nothing to offer)
export function installState() {
  if (typeof window === "undefined") return null;
  if (window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true) return "installed";
  if (deferred) return "prompt";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios" : null;
}

export function onInstallChange(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}

export async function promptInstall() {
  if (!deferred) return false;
  const prompt = deferred;
  deferred = null;
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  changed();
  return outcome === "accepted";
}
