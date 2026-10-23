// When the app offers its notifications (pushAsk.js)
import assert from "node:assert/strict";
import { shouldAskPush } from "./pushAsk.js";

assert.equal(shouldAskPush({ canPush: true, on: false, asked: false }), true, "the app, off, never asked: ask");
assert.equal(shouldAskPush({ canPush: false, on: false, asked: false }), false, "the website, or an app without the plugin: never");
assert.equal(shouldAskPush({ canPush: true, on: true, asked: false }), false, "already on: no");
assert.equal(shouldAskPush({ canPush: true, on: false, asked: true }), false, "answered once: never again");
console.log("pushAsk tests passed");
