import assert from "node:assert/strict";
import { linkPath } from "./appLinks.js";

assert.equal(linkPath("https://jocularinsights.in/stock/TCS?tab=news"), "/stock/TCS?tab=news");
assert.equal(linkPath("https://www.jocularinsights.in/screens"), "/screens");
assert.equal(linkPath("https://jocularinsights.in"), "/");
assert.equal(linkPath("https://example.com/stock/TCS"), null, "another site's link isn't ours");
assert.equal(linkPath("com.jocularinsights.app://x"), null);
assert.equal(linkPath("not a url"), null);
console.log("ok: a link to the site opens that page inside the app");
