// The app's logo in every form it's used (21 Oct 2026): the owner's JI
// monogram in its rings, traced into outlines (scripts/brand/ji-paths.json),
// drawn as glossy glass on navy — teal outer ring, blue inner rings, white
// letters, each piece lit from the top left and floating on a soft shadow.
//
//   node scripts/brand-assets.mjs
//
// Writes into public/:
//   jocular-insights-icon.svg      rounded tile: the header, the manifest, the Play feature graphic
//   jocular-insights-mark.svg      the same, under the name the header and front page load
//   jocular-insights-square.svg    edge to edge, for home screens that round it themselves
//   jocular-insights-maskable.svg  the mark inside Android's safe circle (scripts/android-assets.mjs)
//   jocular-insights-favicon.svg   a browser tab: one thicker ring, heavier letters, flat — glass
//                                  and a double ring are lost at 16 px
//   icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png, apple-touch-icon.png
//   jocular-insights-dark.png, jocular-insights-light.png  the app's own logo (site.jsx BrandMark)
// Then: node scripts/android-assets.mjs (the Android icons) and
// node scripts/play-assets.mjs (the Play icon, feature graphic and pictures).
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "public");
const { centre: [cx, cy], rings, letters } = JSON.parse(readFileSync(join(ROOT, "scripts/brand/ji-paths.json"), "utf8"));

// The traced mark is about 923 px across; scale 0.8 fills a tile, 0.62 keeps
// it inside the circle Android's launcher shapes never cut (61% of the tile)
const place = s => `translate(512 512) scale(${s}) translate(${-cx} ${-cy})`;

// Glass: a soft shadow under each piece, a bright bevel where light from the
// top left catches its edge (a lighting filter over its blurred outline), a
// darker lower edge
const glassFilter = ({ shadow = 0.55, edge = 0.55 } = {}) => `<filter id="glass" x="-20%" y="-20%" width="140%" height="150%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="sblur"/><feOffset in="sblur" dy="18" result="soff"/>
  <feFlood flood-color="#000" flood-opacity="${shadow}"/><feComposite in2="soff" operator="in" result="shadow"/>
  <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="bump"/>
  <feSpecularLighting in="bump" surfaceScale="7" specularConstant="1.25" specularExponent="26" lighting-color="#ffffff" result="spec"><feDistantLight azimuth="235" elevation="52"/></feSpecularLighting>
  <feComposite in="spec" in2="SourceAlpha" operator="in" result="hi"/>
  <feOffset in="SourceAlpha" dx="-3" dy="-5" result="up"/><feComposite in="SourceAlpha" in2="up" operator="out" result="lowEdge"/>
  <feFlood flood-color="#02040c" flood-opacity="${edge}"/><feComposite in2="lowEdge" operator="in" result="dark"/>
  <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/><feMergeNode in="dark"/></feMerge>
  <feComposite in2="hi" operator="arithmetic" k2="1" k3="0.85"/>
</filter>`;
// Two palettes: the dark one (the app icon, the dark theme) and a light one
// for the light theme's header — a white glass tile, navy letters, the same
// rings a shade deeper so they hold on white (21 Oct 2026)
const PALETTE = {
  dark: { bg: ["#17204A", "#0B1028", "#060814"], glow: 0.22, glowEdge: 0.08, gloss: 0.08, teal: ["#7DFFEA", "#00E0BE", "#00A88F"], tealOp: [0.96, 0.82, 0.78], blue: ["#C3D5FF", "#7FA6FF", "#4F7BE8"], blueOp: [0.95, 0.8, 0.76], letters: ["#FFFFFF", "#DCE4FF"], lettersOp: [0.98, 0.86], shadow: 0.55, edge: 0.55 },
  light: { bg: ["#FFFFFF", "#F2F5FB", "#E4E9F4"], glow: 0.14, glowEdge: 0.05, gloss: 0, teal: ["#3BF0D3", "#00C7A8", "#00977F"], tealOp: [0.96, 0.9, 0.88], blue: ["#93B2FF", "#4F7FF0", "#2F5FD8"], blueOp: [0.96, 0.9, 0.88], letters: ["#1C2756", "#0B1028"], lettersOp: [1, 1], shadow: 0.2, edge: 0.18 },
};
const defs = (k = "dark") => {
  const c = PALETTE[k];
  const ramp = (id, [a, b, d], [oa, ob, od]) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}" stop-opacity="${oa}"/><stop offset="0.5" stop-color="${b}" stop-opacity="${ob}"/><stop offset="1" stop-color="${d}" stop-opacity="${od}"/></linearGradient>`;
  return `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.bg[0]}"/><stop offset="0.55" stop-color="${c.bg[1]}"/><stop offset="1" stop-color="${c.bg[2]}"/></linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.46" r="0.42"><stop offset="0" stop-color="#00E0BE" stop-opacity="${c.glow}"/><stop offset="0.6" stop-color="#3E79FF" stop-opacity="${c.glowEdge}"/><stop offset="1" stop-color="#3E79FF" stop-opacity="0"/></radialGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${c.gloss}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  ${ramp("teal", c.teal, c.tealOp)}
  ${ramp("blue", c.blue, c.blueOp)}
  <linearGradient id="white" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.letters[0]}" stop-opacity="${c.lettersOp[0]}"/><stop offset="1" stop-color="${c.letters[1]}" stop-opacity="${c.lettersOp[1]}"/></linearGradient>
  ${glassFilter(c)}
</defs>`;
};

// bold: an outline of each piece's own glass, so the letters and rings hold
// at header size (32–40 px)
function glassTile({ scale, radius = 0, note, palette = "dark", bold = 0 }) {
  const tile = `width="1024" height="1024"${radius ? ` rx="${radius}"` : ""}`;
  const heavy = (fill, w) => (bold ? ` stroke="${fill}" stroke-width="${w}" stroke-linejoin="round"` : "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<!-- Jocular Insights: ${note} (scripts/brand-assets.mjs) -->
${defs(palette)}
<rect ${tile} fill="url(#bg)"/><rect ${tile} fill="url(#glow)"/><rect width="1024" height="520" fill="url(#gloss)"${radius ? ` rx="${radius}"` : ""}/>
<g transform="${place(scale)}" fill-rule="evenodd">
<path d="${rings[0]}" fill="url(#teal)"${heavy("url(#teal)", bold * 0.6)} filter="url(#glass)"/>
${rings.slice(1).map(d => `<path d="${d}" fill="url(#blue)"${heavy("url(#blue)", bold * 0.6)} filter="url(#glass)"/>`).join("\n")}
<path d="${letters}" fill="url(#white)"${heavy("url(#white)", bold)} filter="url(#glass)"/>
</g>
</svg>
`;
}

// A browser tab: the outer ring alone and the letters made heavier with an
// outline of their own colour, flat
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 1024 1024">
<!-- Jocular Insights in a browser tab: one thicker ring, heavier letters, flat, so it reads at 16 px (scripts/brand-assets.mjs) -->
<rect width="1024" height="1024" rx="224" fill="#0B1028"/>
<g transform="${place(0.86)}" fill-rule="evenodd">
<path d="${rings[0]}" fill="#00E0BE" stroke="#00E0BE" stroke-width="22" stroke-linejoin="round"/>
<path d="${letters}" fill="#F4F4FF" stroke="#F4F4FF" stroke-width="26" stroke-linejoin="round"/>
</g>
</svg>
`;

const files = {
  "jocular-insights-icon.svg": glassTile({ scale: 0.8, radius: 230, note: "the glass JI on a rounded tile" }),
  "jocular-insights-mark.svg": glassTile({ scale: 0.8, radius: 230, note: "the glass JI on a rounded tile" }),
  "jocular-insights-square.svg": glassTile({ scale: 0.8, note: "edge to edge, for home screens that round the corners themselves" }),
  "jocular-insights-maskable.svg": glassTile({ scale: 0.62, note: "the mark inside the circle Android's icon shapes never cut" }),
  "jocular-insights-favicon.svg": favicon,
};
// Inside the app (the header, the sign-in box, the front page): pictures, not
// the SVG — Safari draws an SVG's lighting effects at low resolution and
// stretches them, so the header's logo was blurry on an iPhone (21 Oct 2026).
// Drawn at 192 px: sharp up to 64 px on a 3× screen. Heavier letters, the
// mark a little larger in its tile.
const UI = {
  "brand-dark.svg": glassTile({ scale: 0.86, radius: 230, bold: 18, note: "the header's logo, dark theme" }),
  "brand-light.svg": glassTile({ scale: 0.86, radius: 230, bold: 18, palette: "light", note: "the header's logo, light theme" }),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(join(PUB, name), svg);

// The PNGs, drawn in Chrome from those
const dir = mkdtempSync(join(tmpdir(), "brand-assets-"));
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1100, height: 1100 } });
async function png(svgName, size, out, { opaque = false } = {}) {
  const f = join(dir, `${size}-${svgName}.html`);
  writeFileSync(f, `<!doctype html><body style="margin:0;background:${opaque ? "#0B1028" : "transparent"}"><img src="file://${join(PUB, svgName)}" style="display:block;width:${size}px;height:${size}px">`);
  await page.goto(`file://${f}`);
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: join(PUB, out), omitBackground: !opaque, clip: { x: 0, y: 0, width: size, height: size } });
}
// Edge to edge: Android, Chrome and Play round or mask these themselves
await png("jocular-insights-square.svg", 192, "icons/icon-192.png", { opaque: true });
await png("jocular-insights-square.svg", 512, "icons/icon-512.png", { opaque: true });
await png("jocular-insights-maskable.svg", 512, "icons/icon-maskable-512.png", { opaque: true });
// iPhone: no transparency, it rounds the corners itself
await png("jocular-insights-square.svg", 180, "apple-touch-icon.png", { opaque: true });
// the app's own logo pictures, from SVGs kept out of public/
for (const [name, svg] of Object.entries(UI)) writeFileSync(join(dir, name), svg);
async function uiPng(svgPath, size, out) {
  const f = join(dir, `ui-${size}-${out.replace(/\W/g, "")}.html`);
  writeFileSync(f, `<!doctype html><body style="margin:0;background:transparent"><img src="file://${svgPath}" style="display:block;width:${size}px;height:${size}px">`);
  await page.goto(`file://${f}`);
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: join(PUB, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await uiPng(join(dir, "brand-dark.svg"), 192, "jocular-insights-dark.png");
await uiPng(join(dir, "brand-light.svg"), 192, "jocular-insights-light.png");
await browser.close();
console.log("Logo files written to public/ — next: node scripts/android-assets.mjs, node scripts/play-assets.mjs");
