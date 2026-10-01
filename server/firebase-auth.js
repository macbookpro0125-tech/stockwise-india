// Sign-in with Google, Apple or a phone number, through Firebase
// Authentication. The browser does the proving with Firebase's SDK (Google's
// or Apple's sign-in window, or an SMS code) and sends us the ID token
// Firebase gives it. We check that token ourselves — signed by Google's keys,
// issued for this Firebase project, not expired — and only then find or
// create the account (auth.js) and open our own session. Firebase keeps no
// session for us: the browser signs out of it straight after.
//
// Settings — public values from the Firebase console's web-app config, not
// secrets (they're sent to every browser):
//   FIREBASE_PROJECT_ID, FIREBASE_API_KEY, FIREBASE_APP_ID
//   FIREBASE_AUTH_DOMAIN   defaults to <project>.firebaseapp.com
//   FIREBASE_PROVIDERS     the buttons to show, default "google,phone"; add
//                          "apple" once Sign in with Apple is set up there
import { createVerify } from "node:crypto";

const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const SKEW_S = 300; // clocks a few minutes apart

export function firebaseConfig() {
  const e = process.env;
  if (!e.FIREBASE_PROJECT_ID || !e.FIREBASE_API_KEY) return null;
  return {
    apiKey: e.FIREBASE_API_KEY,
    authDomain: e.FIREBASE_AUTH_DOMAIN || `${e.FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: e.FIREBASE_PROJECT_ID,
    appId: e.FIREBASE_APP_ID || undefined,
    providers: String(e.FIREBASE_PROVIDERS || "google,phone").split(",").map(s => s.trim()).filter(p => ["google", "apple", "phone"].includes(p)),
  };
}

// Google's current signing certificates, cached as long as Google says
let certs = null, certsUntil = 0, testKeys = null;
export const setFirebaseKeysForTests = keys => { testKeys = keys; };
async function signingKeys() {
  if (testKeys) return testKeys;
  if (certs && Date.now() < certsUntil) return certs;
  const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Google's signing keys: HTTP ${res.status}`);
  certs = await res.json();
  const maxAge = Number(res.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] ?? 3600);
  certsUntil = Date.now() + maxAge * 1000;
  return certs;
}

const part = s => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

// The token's claims when it's genuine and current. Every failure throws the
// same message for the visitor; the reason goes to the server's log.
export async function verifyFirebaseIdToken(idToken) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const fail = reason => Object.assign(new Error("That sign-in couldn't be confirmed. Please try again."), { reason });
  const pieces = String(idToken ?? "").split(".");
  if (!projectId) throw fail("no FIREBASE_PROJECT_ID");
  if (pieces.length !== 3) throw fail("not a token");
  let header, claims;
  try { header = part(pieces[0]); claims = part(pieces[1]); } catch { throw fail("unreadable token"); }
  if (header.alg !== "RS256" || !header.kid) throw fail(`alg ${header.alg}`);
  const key = (await signingKeys())[header.kid];
  if (!key) throw fail("unknown signing key");
  const genuine = createVerify("RSA-SHA256").update(`${pieces[0]}.${pieces[1]}`).verify(key, Buffer.from(pieces[2], "base64url"));
  if (!genuine) throw fail("bad signature");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) throw fail("another project's token");
  if (!(claims.exp > now) || !(claims.iat <= now + SKEW_S) || !(claims.auth_time <= now + SKEW_S)) throw fail("expired or future token");
  if (typeof claims.sub !== "string" || !claims.sub) throw fail("no subject");
  return claims;
}
