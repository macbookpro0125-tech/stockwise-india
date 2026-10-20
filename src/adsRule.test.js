// The ads rule (src/ads.jsx): only cards among lists, and the rewarded ad a
// person starts from Settings — no banners, full-screen or app-open ads.
// node src/adsRule.test.js
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = dirname(fileURLToPath(import.meta.url));
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(f) && !f.endsWith(".test.js")) files.push(p);
  }
})(SRC);
const code = files.map(f => [f.slice(SRC.length + 1), readFileSync(f, "utf-8")]);

const banned = /\b(showBanner|prepareInterstitial|showInterstitial|AppOpen|appOpenAd|BannerAdPosition)\b/;
const offenders = code.filter(([, c]) => banned.test(c)).map(([f]) => f);
assert.deepEqual(offenders, [], "no banner, full-screen or app-open ads");
console.log("ok: no banner, full-screen or app-open ad formats anywhere in src/");

const rewarded = code.filter(([, c]) => /showRewardVideoAd\(/.test(c)).map(([f]) => f);
assert.deepEqual(rewarded, ["ads.jsx"], "the rewarded ad is shown from one place");
const callers = code.filter(([f, c]) => f !== "ads.jsx" && /watchSupportAd\(/.test(c)).map(([f]) => f);
assert.deepEqual(callers, ["SettingsView.jsx"], "only Settings' Watch an ad starts it");
console.log("ok: the rewarded ad runs only when someone taps Watch an ad in Settings");
