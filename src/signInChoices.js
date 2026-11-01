// The sign-in card's buttons (AuthForm.jsx). On the website: every way in the
// server offers. Inside the Android and iPhone apps Google refuses its
// sign-in page in the app's web view ("disallowed_useragent"), so Google is
// offered only where the app signs in with Google natively (the
// FirebaseAuthentication plugin, from app 1.1); phone works anywhere; Apple
// stays web-only for now.
export function providersFor(offered, { inApp, nativeGoogle = false }) {
  const list = offered ?? [];
  if (!inApp) return list;
  return list.filter(p => p === "phone" || (p === "google" && nativeGoogle));
}

// Opened from an iPhone's Home Screen, Google's window opens but can never hand
// the answer back, so the button waited for ever (1 Nov 2026, the owner: "Opening
// Google…"). There it counts as an app with no native Google; Safari still has it.
export const iphoneHomeScreen = () => /iPhone|iPad/.test(navigator.userAgent) && navigator.standalone === true;

// Closing Google's account picker on the phone: not an error to show
export const cancelledNative = e => /cancel+ed/i.test(e?.message ?? "") || String(e?.code ?? "") === "12501";
