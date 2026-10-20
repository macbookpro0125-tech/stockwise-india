// Which sign-in buttons show where (signInChoices.js): node src/signInChoices.test.js
import assert from "node:assert/strict";
import { providersFor, cancelledNative } from "./signInChoices.js";

{
  assert.deepEqual(providersFor(["google", "phone"], { inApp: false }), ["google", "phone"], "the website shows what the server offers");
  // Google refuses its sign-in page inside an app's web view; the app's own
  // (native) Google sign-in takes its place where the app has it
  assert.deepEqual(providersFor(["google", "phone"], { inApp: true, nativeGoogle: false }), ["phone"], "an app without native Google sign-in (1.0) keeps email and phone");
  assert.deepEqual(providersFor(["google", "phone"], { inApp: true, nativeGoogle: true }), ["google", "phone"], "an app with it shows Continue with Google");
  assert.deepEqual(providersFor(["google", "apple"], { inApp: true, nativeGoogle: true }), ["google"], "Apple stays web-only until it's native too");
  assert.deepEqual(providersFor(undefined, { inApp: true, nativeGoogle: true }), []);
  console.log("ok: the website offers every way in; the app offers Google only where it can sign in natively");
}
{
  assert.equal(cancelledNative({ message: "The user canceled the sign-in flow." }), true);
  assert.equal(cancelledNative({ message: "Sign in cancelled" }), true);
  assert.equal(cancelledNative({ code: "12501" }), true, "Google's 'sign-in cancelled' status code");
  assert.equal(cancelledNative({ message: "No credentials available" }), false, "no Google account on the phone is an error to show");
  assert.equal(cancelledNative({ message: "Network error" }), false);
  console.log("ok: closing Google's account picker is a cancel, not an error");
}
