// Phone notifications (23 Oct 2026): news from a watchlist's companies and
// alerts reaching their price arrive on the Android app even when it's
// closed. The app gives the server its Firebase Cloud Messaging token
// (src/push.js, POST /api/push/token); the server sends through FCM's HTTP v1
// API with the Firebase project's service account.
//
// FIREBASE_SERVICE_ACCOUNT: the service account's JSON key, as downloaded
// from the Firebase console (Project settings, Service accounts), pasted
// whole into the environment. Without it nothing is sent and nothing fails.
// No library: the access token comes from Google's OAuth endpoint with a
// JWT signed here (RS256), and lasts an hour.
import { createSign } from "node:crypto";
import { db } from "./db.js";

// read once per value of the variable
let account = { raw: undefined, parsed: null };
function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw === account.raw) return account.parsed;
  let parsed = null;
  try {
    const a = JSON.parse(raw ?? "");
    parsed = a.client_email && a.private_key && a.project_id ? a : null;
  } catch { /* reported below */ }
  if (raw && !parsed) console.error("[push] FIREBASE_SERVICE_ACCOUNT isn't a service account's JSON key");
  account = { raw, parsed };
  access = null;
  return parsed;
}
export const pushReady = () => !!serviceAccount();

const b64url = s => Buffer.from(s).toString("base64url");
let access = null;
async function accessToken(fetchImpl) {
  if (access && access.until > Date.now() + 60_000) return access.token;
  const a = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: a.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }))}`;
  const jwt = `${body}.${createSign("RSA-SHA256").update(body).sign(a.private_key, "base64url")}`;
  const r = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!r.ok) throw new Error(`Google sign-in for FCM failed (${r.status})`);
  const j = await r.json();
  access = { token: j.access_token, until: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return access.token;
}

// One message to one phone. data: strings only (FCM's rule), read by the
// app when the notification is tapped. Resolves "sent", or "gone" when the
// token no longer exists (the app was uninstalled) — the caller drops it.
export async function sendPush(token, { title, body, data = {} }, { fetchImpl = fetch } = {}) {
  const a = serviceAccount();
  if (!a) throw new Error("Phone notifications aren't set up");
  const r = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${await accessToken(fetchImpl)}`, "content-type": "application/json" },
    body: JSON.stringify({ message: {
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: "high", notification: { channel_id: "updates", color: "#14B892" } },
    } }),
  });
  if (r.ok) return "sent";
  const j = await r.json().catch(() => ({}));
  const code = j.error?.details?.find(d => d.errorCode)?.errorCode;
  if (r.status === 404 || code === "UNREGISTERED" || (code === "INVALID_ARGUMENT" && /token/i.test(j.error?.message ?? ""))) return "gone";
  throw new Error(`FCM ${r.status}${code ? ` ${code}` : ""}`);
}

// The phones an account is signed in on
export const pushTokens = userId => db.prepare("SELECT token FROM push_tokens WHERE user_id = ?").all(userId).map(r => r.token);

export function savePushToken(userId, token, platform = "android") {
  // a phone signed in to another account hands its token over
  db.prepare(`INSERT INTO push_tokens (token, user_id, platform, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform`)
    .run(token, userId, platform, new Date().toISOString());
  // watchlist news counts from the first phone on, not from the last four days
  db.prepare("UPDATE users SET push_news_at = COALESCE(push_news_at, ?) WHERE id = ?").run(new Date().toISOString(), userId);
}
export const removePushToken = (userId, token) => db.prepare("DELETE FROM push_tokens WHERE user_id = ? AND token = ?").run(userId, token);

// To every phone of an account; true if any got it. send is injectable for
// the tests.
export async function pushToUser(userId, message, { send = sendPush, log = console.error } = {}) {
  let any = false;
  for (const token of pushTokens(userId)) {
    try {
      if (await send(token, message) === "gone") db.prepare("DELETE FROM push_tokens WHERE token = ?").run(token);
      else any = true;
    } catch (e) {
      log(`[push] account ${userId}: ${e.message}`);
    }
  }
  return any;
}
