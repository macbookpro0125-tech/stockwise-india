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
const GLASS = `<filter id="glass" x="-20%" y="-20%" width="140%" height="150%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="sblur"/><feOffset in="sblur" dy="18" result="soff"/>
  <feFlood flood-color="#000" flood-opacity="0.55"/><feComposite in2="soff" operator="in" result="shadow"/>
  <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="bump"/>
  <feSpecularLighting in="bump" surfaceScale="7" specularConstant="1.25" specularExponent="26" lighting-color="#ffffff" result="spec"><feDistantLight azimuth="235" elevation="52"/></feSpecularLighting>
  <feComposite in="spec" in2="SourceAlpha" operator="in" result="hi"/>
  <feOffset in="SourceAlpha" dx="-3" dy="-5" result="up"/><feComposite in="SourceAlpha" in2="up" operator="out" result="lowEdge"/>
  <feFlood flood-color="#02040c" flood-opacity="0.55"/><feComposite in2="lowEdge" operator="in" result="dark"/>
  <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/><feMergeNode in="dark"/></feMerge>
  <feComposite in2="hi" operator="arithmetic" k2="1" k3="0.85"/>
</filter>`;
const DEFS = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17204A"/><stop offset="0.55" stop-color="#0B1028"/><stop offset="1" stop-color="#060814"/></linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.46" r="0.42"><stop offset="0" stop-color="#00E0BE" stop-opacity="0.22"/><stop offset="0.6" stop-color="#3E79FF" stop-opacity="0.08"/><stop offset="1" stop-color="#3E79FF" stop-opacity="0"/></radialGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="teal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7DFFEA" stop-opacity="0.96"/><stop offset="0.5" stop-color="#00E0BE" stop-opacity="0.82"/><stop offset="1" stop-color="#00A88F" stop-opacity="0.78"/></linearGradient>
  <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C3D5FF" stop-opacity="0.95"/><stop offset="0.5" stop-color="#7FA6FF" stop-opacity="0.8"/><stop offset="1" stop-color="#4F7BE8" stop-opacity="0.76"/></linearGradient>
  <linearGradient id="white" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.98"/><stop offset="1" stop-color="#DCE4FF" stop-opacity="0.86"/></linearGradient>
  ${GLASS}
</defs>`;

function glassTile({ scale, radius = 0, note }) {
  const tile = `width="1024" height="1024"${radius ? ` rx="${radius}"` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<!-- Jocular Insights: ${note} (scripts/brand-assets.mjs) -->
${DEFS}
<rect ${tile} fill="url(#bg)"/><rect ${tile} fill="url(#glow)"/><rect width="1024" height="520" fill="url(#gloss)"${radius ? ` rx="${radius}"` : ""}/>
<g transform="${place(scale)}" fill-rule="evenodd">
<path d="${rings[0]}" fill="url(#teal)" filter="url(#glass)"/>
${rings.slice(1).map(d => `<path d="${d}" fill="url(#blue)" filter="url(#glass)"/>`).join("\n")}
<path d="${letters}" fill="url(#white)" filter="url(#glass)"/>
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
await browser.close();
console.log("Logo files written to public/ — next: node scripts/android-assets.mjs, node scripts/play-assets.mjs");
