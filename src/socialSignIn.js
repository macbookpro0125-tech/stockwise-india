// Google, Apple and phone sign-in in the browser, through Firebase's SDK —
// loaded only once the sign-in card offers those buttons. Firebase proves who
// the person is and hands back an ID token; the server checks it
// (server/firebase-auth.js) and opens our own session. Firebase is told to
// keep nothing between visits and is signed out of straight after.
import { api } from "./api.js";

let loading = null;
// Started when the buttons appear, so a click doesn't wait on a download —
// a sign-in window opened after a long wait is one pop-up blockers stop
export function preloadFirebase(config) {
  loading ??= (async () => {
    const [{ initializeApp }, auth] = await Promise.all([import("@firebase/app"), import("@firebase/auth")]);
    const app = initializeApp({ apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, appId: config.appId });
    const a = auth.getAuth(app);
    a.useDeviceLanguage();
    await auth.setPersistence(a, auth.inMemoryPersistence);
    return { a, auth };
  })();
  return loading;
}

// Firebase's error codes in plain words; null for "they closed the window"
function plain(e) {
  const code = e?.code ?? "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled") return null;
  if (code === "auth/popup-blocked") return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
  if (code === "auth/invalid-phone-number" || code === "auth/missing-phone-number") return "That doesn't look like a mobile number. Check it and try again.";
  if (code === "auth/invalid-verification-code") return "That code isn't right. Check the SMS and try again.";
  if (code === "auth/code-expired") return "That code has expired. Send a new one.";
  if (code === "auth/too-many-requests" || code === "auth/quota-exceeded") return "Too many attempts. Please wait a while and try again.";
  if (code === "auth/network-request-failed") return "Couldn't reach the sign-in service. Check your connection and try again.";
  if (code === "auth/account-exists-with-different-credential") return "This email already signs in another way — try Google or your email and password.";
  if (code === "auth/operation-not-allowed" || code === "auth/unauthorized-domain") return "This way of signing in isn't switched on yet.";
  return e?.message || "Sign-in failed. Please try again.";
}
const failure = e => { const text = plain(e); return Object.assign(new Error(text ?? "Cancelled"), { cancelled: text === null }); };

async function finish({ a, auth }, credential) {
  try {
    return await api.firebaseSignIn(await credential.user.getIdToken());
  } finally {
    auth.signOut(a).catch(() => {});
  }
}

// "google" or "apple", in a pop-up window
export async function signInWithProvider(config, which) {
  const fb = await preloadFirebase(config);
  try {
    const provider = which === "apple" ? new fb.auth.OAuthProvider("apple.com") : new fb.auth.GoogleAuthProvider();
    if (which === "apple") { provider.addScope("email"); provider.addScope("name"); }
    else provider.setCustomParameters({ prompt: "select_account" });
    return await finish(fb, await fb.auth.signInWithPopup(fb.a, provider));
  } catch (e) {
    throw e?.code ? failure(e) : e;
  }
}

// An Indian 10-digit number gets +91; anything starting with + is taken as is
export function toE164(input) {
  const digits = String(input ?? "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const local = digits.replace(/^0+/, "");
  return local.length === 10 ? `+91${local}` : `+${local}`;
}

// Sends the SMS (after Google's invisible bot check, tied to the button with
// id buttonId); returns confirm(code) for the second step. A second send —
// a new number, or "send again" — replaces the first check, which can't be
// set up twice on one button.
let activeVerifier = null;
export async function sendPhoneCode(config, phone, buttonId) {
  const fb = await preloadFirebase(config);
  activeVerifier?.clear();
  const verifier = activeVerifier = new fb.auth.RecaptchaVerifier(fb.a, buttonId, { size: "invisible" });
  try {
    const confirmation = await fb.auth.signInWithPhoneNumber(fb.a, toE164(phone), verifier);
    return {
      confirm: async code => {
        try { return await finish(fb, await confirmation.confirm(String(code).trim())); }
        catch (e) { throw e?.code ? failure(e) : e; }
      },
    };
  } catch (e) {
    verifier.clear();
    if (activeVerifier === verifier) activeVerifier = null;
    throw e?.code ? failure(e) : e;
  }
}
