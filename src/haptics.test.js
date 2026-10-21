// Which way a tick is given on this device (haptics.js): node src/haptics.test.js
import assert from "node:assert/strict";
import { hapticRoute } from "./haptics.js";

assert.equal(hapticRoute({ nativeHaptics: true, vibrate: true, touch: true, appleTouch: false }), "native", "the Android app: its own haptics");
assert.equal(hapticRoute({ nativeHaptics: false, vibrate: true, touch: true, appleTouch: false }), "vibrate", "Chrome on Android");
assert.equal(hapticRoute({ nativeHaptics: false, vibrate: false, touch: true, appleTouch: true }), "switch", "Safari on an iPhone: a switch's own tick");
assert.equal(hapticRoute({ nativeHaptics: false, vibrate: false, touch: false, appleTouch: false }), null, "a computer: nothing");
assert.equal(hapticRoute({ nativeHaptics: false, vibrate: true, touch: false, appleTouch: false }), null, "a computer that has vibrate (Chrome): nothing — no motor");
assert.equal(hapticRoute({ nativeHaptics: false, vibrate: false, touch: true, appleTouch: false }), null, "another touch screen without either: nothing");
console.log("ok: a tick goes the way this device can give it");
