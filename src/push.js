// Phone notifications in the Android app (23 Oct 2026): news from the
// watchlist's companies and alerts reaching their price, while the app is
// closed (server/push.js sends them). Turned on from Settings: Android asks
// once, the phone's Firebase token goes to the server, and tapping a
// notification opens what it's about. The website, and an app from before
// the plugin (version 2), have no plugin: no switch, nothing asked.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { api } from "./api.js";

const Push = registerPlugin("PushNotifications");
const KEY = "push-token";
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = v => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch { /* the server keeps it either way */ } };

export const canPush = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PushNotifications");

// Whether this phone sends its notifications to the account
export const pushOn = () => canPush() && !!read();

let registering = null;
function register() {
  registering ??= new Promise((resolve, reject) => {
    const done = [];
    const finish = fn => v => { done.forEach(h => h.remove?.()); registering = null; fn(v); };
    Promise.all([
      Push.addListener("registration", finish(t => resolve(t.value))),
      Push.addListener("registrationError", finish(e => reject(new Error(e.error || "The phone didn't give a notification token")))),
    ]).then(hs => { done.push(...hs); return Push.register(); }).catch(finish(reject));
  });
  return registering;
}

// Asks Android (the first time), then hands the token to the server.
// Resolves false if the person said no.
export async function turnPushOn() {
  let { receive } = await Push.checkPermissions();
  if (receive === "prompt" || receive === "prompt-with-rationale") ({ receive } = await Push.requestPermissions());
  if (receive !== "granted") return false;
  await Push.createChannel({ id: "updates", name: "Watchlist news and alerts", importance: 4, visibility: 1 }).catch(() => {});
  const token = await register();
  await api.pushToken(token, Capacitor.getPlatform());
  write(token);
  return true;
}

export async function turnPushOff() {
  const token = read();
  write(null);
  if (token) await api.pushTokenRemove(token).catch(() => {});
  await Push.unregister().catch(() => {});
}

// Signing out: this phone stops getting the account's notifications
export async function forgetPush() {
  if (canPush() && read()) await turnPushOff();
}

// On each start, signed in: a token can change (an app update, restored
// data), so a phone that has them on gives its current one again
export async function refreshPush() {
  if (!pushOn()) return;
  try {
    const { receive } = await Push.checkPermissions();
    if (receive !== "granted") { write(null); return; }
    const token = await register();
    if (token !== read()) await api.pushTokenRemove(read()).catch(() => {});
    await api.pushToken(token, Capacitor.getPlatform());
    write(token);
  } catch { /* tried again next start */ }
}

// A tapped notification's data: { stock }, { news } or { tab }
export function onPushTap(handle) {
  if (!canPush()) return () => {};
  const h = Push.addListener("pushNotificationActionPerformed", e => handle(e.notification?.data ?? {}));
  return () => { h.then(x => x.remove()).catch(() => {}); };
}
