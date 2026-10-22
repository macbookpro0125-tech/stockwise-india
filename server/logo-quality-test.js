// Which cached logos are good enough to show, and how a poor one is replaced
// (22 Oct 2026: 630 favicons under 64 px were blurry on a phone, about 30 wide
// banners shrank to a strip, 12 white logos vanished on the white tile, and
// one came from TradingView). node server/logo-quality-test.js
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "logo-quality-"));
process.env.DATA_DIR = dir;
const { imageSize, logoFlaw, logoFor, logoJobsSettled } = await import("./logos.js");

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log(`ok: ${msg}`);
  else { failures++; console.error(`FAIL: ${msg}`); }
}

// Minimal image headers of a given size
const png = (w, h) => {
  const b = Buffer.alloc(96);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write("IHDR", 12, "ascii"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
};
const ico = (...sizes) => {
  const b = Buffer.alloc(6 + 16 * sizes.length + 64);
  b.writeUInt16LE(1, 2); b.writeUInt16LE(sizes.length, 4);
  sizes.forEach((s, i) => { b[6 + i * 16] = s >= 256 ? 0 : s; b[7 + i * 16] = s >= 256 ? 0 : s; });
  return b;
};
const gif = (w, h) => { const b = Buffer.alloc(64); b.write("GIF89a", 0, "ascii"); b.writeUInt16LE(w, 6); b.writeUInt16LE(h, 8); return b; };
const jpeg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, ...Array(60).fill(0)]);
const webp = (w, h) => { const b = Buffer.alloc(64); b.write("RIFF", 0, "ascii"); b.write("WEBP", 8, "ascii"); b.write("VP8X", 12, "ascii"); b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return b; };

const same = (a, b) => a && a.w === b.w && a.h === b.h;
assert(same(imageSize(png(128, 64)), { w: 128, h: 64 }), "a PNG's size from its header");
assert(same(imageSize(ico(16, 48, 32)), { w: 48, h: 48 }), "an ICO's largest picture");
assert(same(imageSize(ico(256)), { w: 256, h: 256 }), "an ICO entry of 0 means 256");
assert(same(imageSize(gif(40, 20)), { w: 40, h: 20 }) && same(imageSize(jpeg(300, 90)), { w: 300, h: 90 }) && same(imageSize(webp(120, 120)), { w: 120, h: 120 }),
  "GIF, JPEG and WebP sizes");

assert(logoFlaw(png(180, 180), {}, "TCS") === null, "a sharp, square logo is fine");
assert(logoFlaw(png(48, 48), {}, "TCS") === "small", "under 64 px is small: still shown, but replaced if a sharper one exists");
assert(logoFlaw(ico(16), {}, "TCS") === "tiny", "under 32 px is too blurry to show");
assert(logoFlaw(png(400, 96), {}, "TCS") === "banner" && logoFlaw(png(60, 200), {}, "TCS") === "banner", "a wide or tall banner shrinks to a strip");
assert(logoFlaw(png(256, 256), {}, "NECLIFE") === "invisible", "a white-on-clear logo (found by a full scan) vanishes on the white tile");
assert(logoFlaw(png(600, 600), { sourceProvider: "TradingView company logo" }, "IIRM") === "source", "a file taken from TradingView isn't used");

// ── The cache, with the logo directory stubbed ──────────────────────────────
const logos = join(dir, "logos");
mkdirSync(logos, { recursive: true });
const seed = (sym, body, meta) => { writeFileSync(join(logos, `${sym}.img`), body); writeFileSync(join(logos, `${sym}.json`), JSON.stringify({ at: new Date().toISOString(), type: "image/png", ...meta })); };
const meta = sym => JSON.parse(readFileSync(join(logos, `${sym}.json`), "utf8"));

const directory = { INE000000011: true, INE000000029: false }; // ISIN → has a logo
let offline = false, asked = 0;
globalThis.fetch = async url => {
  asked++;
  if (offline) throw new Error("network down");
  const u = new URL(url);
  const respond = (body, headers) => { const r = new Response(body, { status: 200, headers }); Object.defineProperty(r, "url", { value: u.href }); return r; };
  const company = u.pathname.match(/\/v1\/companies\/(\w+)/)?.[1];
  if (company) return respond(JSON.stringify({ data: { isin: company, hasLogo: directory[company] ?? false } }), { "content-type": "application/json" });
  if (u.pathname.startsWith("/v1/logos/")) return respond(png(128, 128), { "content-type": "image/png" });
  return new Response("", { status: 404 });
};
const isinOf = { SMALLCO: "INE000000011", BANNERCO: "INE000000029", FLAKYCO: "INE000000011", WHITECO: "INE000000011" };
const get = sym => logoFor(sym, async () => null, async s => isinOf[s] ?? null);

// A small favicon: shown at once, not cached by the browser, and replaced
seed("SMALLCO", png(48, 48), {});
let first = await get("SMALLCO");
assert(first && same(imageSize(first.body), { w: 48, h: 48 }) && first.noStore === true, "a small logo is still shown while a sharper one is looked for, and not kept by the browser");
await logoJobsSettled();
let second = await get("SMALLCO");
assert(second && same(imageSize(second.body), { w: 128, h: 128 }) && !second.noStore, "the next view gets the sharp 128 px logo, cacheable again");
assert(meta("SMALLCO").upgradedFrom === "small" && meta("SMALLCO").sourceProvider === "Indian listed company logos API", "and the cache says what it replaced");

// A banner the directory has nothing for: letters, and not asked again
seed("BANNERCO", png(400, 96), {});
assert(await get("BANNERCO") === null, "a banner isn't shown (the app shows the company's letters)");
await logoJobsSettled();
const before = asked;
assert(await get("BANNERCO") === null && meta("BANNERCO").betterChecked === true, "with no better logo, it stays as letters");
await logoJobsSettled();
assert(asked === before, "and the directory isn't asked again on every view");

// The directory can't be reached: keep showing the small one, try later
seed("FLAKYCO", png(40, 40), {});
offline = true;
assert((await get("FLAKYCO"))?.noStore === true, "a small logo still shows when the directory is down");
await logoJobsSettled();
assert(meta("FLAKYCO").betterChecked !== true, "and a failed look isn't recorded as 'nothing better', so it's tried again");
offline = false;

// A white-on-clear logo is hidden
assert(await logoFor("NECLIFE", async () => null, async () => null) === null, "a known invisible logo without a cache entry isn't invented");
seed("NECLIFE", png(256, 256), {});
assert(await logoFor("NECLIFE", async () => null, async () => null) === null, "a known invisible logo is hidden");

rmSync(dir, { recursive: true, force: true });
if (failures) { console.error(`${failures} logo quality check(s) failed`); process.exit(1); }
console.log("\nAll logo quality checks passed.");
