// Ratings on Google Play (22 Oct 2026: "ask them to give the rating after
// using for some time, and add the button in the settings also to rate us").
//
// Only in the Android app: the website and the iPhone have no store page to
// rate. Two ways in, both Google's own:
//   after a while  Play's in-app review card, at a pause — just after leaving
//                  a company page — once the app has been used on 3 different
//                  days over at least a week, with 5 company pages looked at;
//                  then not again for 4 months
//   Settings       "Rate the app" opens the app's page in the Play Store
//
// Google's rules (developer.android.com/guide/playcore/in-app-review): no
// question before the card ("Do you like the app?" — that's review gating),
// no button of ours that brings the card up (Play limits how often a person
// sees it, so the button could do nothing), nothing offered for a rating.
// Play decides whether the card appears, and never says if it did or what
// was given.

export const RATING_RULE = { days: 3, sinceFirst: 7, visits: 5, again: 120 };
const DAY = 864e5;
const today = now => new Date(now).toLocaleDateString("en-CA"); // YYYY-MM-DD, the phone's own date

// This visit's day added to what's kept: the first day, the last 10 days of use
export function noteDay(s, now) {
  const day = today(now);
  const days = s.days?.includes(day) ? s.days : [...(s.days ?? []), day].slice(-10);
  return { ...s, first: s.first ?? new Date(now).toISOString(), days };
}

export function readyToAsk(s, now) {
  if (!s?.first) return false;
  if (s.asked && now - Date.parse(s.asked) < RATING_RULE.again * DAY) return false;
  return (s.days?.length ?? 0) >= RATING_RULE.days
    && now - Date.parse(s.first) >= RATING_RULE.sinceFirst * DAY
    && (s.visits ?? 0) >= RATING_RULE.visits;
}

const KEY = "jocular-rating";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
const reviewAvailable = () => !!window.Capacitor?.isPluginAvailable?.("AppReview");
// Calls the plugin without ever handing the plugin itself to a promise: it
// answers to every name, "then" too, so resolving with it calls a "then" the
// phone doesn't have ("AppReview.then() is not implemented", 22 Oct 2026)
const review = async (method, options) => (await import("@capawesome/capacitor-app-review")).AppReview[method](options);

export const canRate = () => typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform?.() === "android";

export function noteAppOpened() {
  if (canRate()) save(noteDay(load(), Date.now()));
}

// After a company page closes: count it, and ask when it's time
export async function companyPageClosed() {
  if (!canRate()) return;
  const now = Date.now();
  const s = noteDay(load(), now);
  s.visits = (s.visits ?? 0) + 1;
  const ask = readyToAsk(s, now) && reviewAvailable();
  if (ask) s.asked = new Date(now).toISOString();
  save(s);
  if (ask) try { await review("requestReview"); } catch { /* Play said no: nothing to show */ }
}

const PLAY_PAGE = "https://play.google.com/store/apps/details?id=com.jocularinsights.app";

export async function openStorePage() {
  try {
    if (reviewAvailable()) return await review("openAppStore", { androidStorePackageName: "com.android.vending" });
  } catch { /* the Play Store isn't there: the page's link instead */ }
  window.open(PLAY_PAGE, "_blank");
}
