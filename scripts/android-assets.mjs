// Draws the Android app's launcher icons and launch screens from the app's
// own artwork (public/jocular-insights-maskable.svg), in Chrome, at every
// size Android asks for — replacing Capacitor's placeholders (17 Oct 2026).
//
//   node scripts/android-assets.mjs
//
// Rerun after the logo changes. Writes into android/app/src/main/res.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RES = join(ROOT, "android/app/src/main/res");
const svg = readFileSync(join(ROOT, "public/jocular-insights-maskable.svg"), "utf8");
const PAGE_BG = "#080810"; // the dark theme's page colour (index.css --bg)
// The launcher icon is the white logo (23 Oct 2026, "when we install it, it
// should show the white logo, not the dark one"): the owner's own artwork,
// as the light theme's header shows it (scripts/brand/ji-original.png), on
// white. The launch screen keeps the dark glass mark on the dark page.
const ICON = readFileSync(join(ROOT, "scripts/brand/ji-original.png"));
const ICON_BG = "#FFFFFF";

// dp → px at each density
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SPLASH = {
  "drawable": [480, 320],
  "drawable-land-mdpi": [480, 320], "drawable-land-hdpi": [800, 480], "drawable-land-xhdpi": [1280, 720], "drawable-land-xxhdpi": [1600, 960], "drawable-land-xxxhdpi": [1920, 1280],
  "drawable-port-mdpi": [320, 480], "drawable-port-hdpi": [480, 800], "drawable-port-xhdpi": [720, 1280], "drawable-port-xxhdpi": [960, 1600], "drawable-port-xxxhdpi": [1280, 1920],
};

// file:// page: Chrome won't draw a data: SVG into setContent reliably
const dir = mkdtempSync(join(tmpdir(), "android-assets-"));
writeFileSync(join(dir, "icon.svg"), svg);
writeFileSync(join(dir, "white.png"), ICON);
const html = (w, h, body, bg = "transparent") => {
  const f = join(dir, `p-${w}x${h}-${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(f, `<!doctype html><html><body style="margin:0;width:${w}px;height:${h}px;background:${bg};display:grid;place-items:center;overflow:hidden">${body}</body></html>`);
  return `file://${f}`;
};

const browser = await chromium.launch({ channel: "chrome" });
// One large window, each picture clipped from its top-left corner (Chrome
// stalls on a window as small as a 48 px icon)
const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1920, height: 1920 } });
// (bg defaults to see-through here too: it was undefined for the icons, so
// their corners came out white — 21 Oct 2026)
async function draw(file, w, h, body, bg = "transparent") {
  await page.goto(html(w, h, body, bg));
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: file, omitBackground: bg === "transparent", clip: { x: 0, y: 0, width: w, height: h } });
}

for (const [d, k] of Object.entries(DENSITY)) {
  const legacy = Math.round(48 * k), fg = Math.round(108 * k);
  // Android 8+: the whole artwork as the adaptive icon's front layer (its
  // own background fills the shape the phone cuts); older phones: a rounded
  // square and a circle
  // the logo at 60% of the adaptive layer (inside the circle no icon shape
  // cuts; the phone shows the middle two-thirds), 84% of an older phone's
  // whole icon. Its silver greys darkened and with more contrast: at icon
  // size the originals looked "dull" (23 Oct 2026)
  const white = (size, share, radius, fill) => `<div style="width:${size}px;height:${size}px;border-radius:${radius};background:${fill};display:grid;place-items:center"><img src="white.png" style="width:${Math.round(size * share)}px;height:${Math.round(size * share)}px;filter:contrast(1.5) brightness(0.8)"></div>`;
  await draw(join(RES, `mipmap-${d}/ic_launcher_foreground.png`), fg, fg, white(fg, 0.6, "0", "transparent"));
  await draw(join(RES, `mipmap-${d}/ic_launcher.png`), legacy, legacy, white(legacy, 0.84, "22%", ICON_BG));
  await draw(join(RES, `mipmap-${d}/ic_launcher_round.png`), legacy, legacy, white(legacy, 0.84, "50%", ICON_BG));
}
// Launch screens before Android 12: the icon on the dark page colour
for (const [folder, [w, h]] of Object.entries(SPLASH)) {
  const size = Math.round(Math.min(w, h) * 0.28);
  await draw(join(RES, `${folder}/splash.png`), w, h, `<img src="icon.svg" style="width:${size}px;height:${size}px;border-radius:22%">`, PAGE_BG);
}
await browser.close();
console.log("Android icons and launch screens written to android/app/src/main/res");
