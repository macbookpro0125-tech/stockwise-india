// Cuts the front-page film's two close-ups (src/assets/dome-mid.webp and
// dome-star.webp) out of a 4× master of the dome picture, after checking the
// master lines up with src/assets/dome.webp. The rectangles are in the
// 1672 × 941 picture's own pixels and must match LAYERS in src/DomeFilm.jsx.
// Usage: node scripts/make-dome-layers.mjs ~/Projects/stockwise-scroll/assets/dome-master@4x.png
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, statSync } from "node:fs";

const master = process.argv[2];
if (!master) { console.error("usage: node scripts/make-dome-layers.mjs <dome-master@4x.png>"); process.exit(1); }
const IW = 1672, IH = 941, K = 4;
const LAYERS = [
  { out: "src/assets/dome-mid.webp", sx: 127, sy: 0, sw: 1305, sh: 941, dens: 2 },
  { out: "src/assets/dome-star.webp", sx: 346, sy: 0, sw: 686, sh: 433, dens: 4 },
];

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
// Serve both pictures from one made-up origin so the canvas isn't tainted
await page.route("http://dome.local/**", route => {
  const path = new URL(route.request().url()).pathname;
  if (path === "/master") return route.fulfill({ body: readFileSync(master), contentType: master.endsWith(".png") ? "image/png" : "image/webp" });
  if (path === "/base") return route.fulfill({ body: readFileSync("src/assets/dome.webp"), contentType: "image/webp" });
  return route.fulfill({ body: "<!doctype html><title>dome layers</title>", contentType: "text/html" });
});
await page.goto("http://dome.local/");
const res = await page.evaluate(async ({ IW, IH, K, LAYERS }) => {
  const load = async src => { const im = new Image(); im.src = src; await im.decode(); return im; };
  const m = await load("/master"), base = await load("/base");
  if (m.naturalWidth !== IW * K || m.naturalHeight !== IH * K) return { error: `the master is ${m.naturalWidth} × ${m.naturalHeight}; it must be ${IW * K} × ${IH * K}` };
  // Line-up check: the master scaled back down must match the shipped picture
  const c = document.createElement("canvas"); c.width = IW; c.height = IH;
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
  x.drawImage(m, 0, 0, IW, IH); const a = x.getImageData(0, 0, IW, IH).data;
  x.clearRect(0, 0, IW, IH); x.drawImage(base, 0, 0); const b = x.getImageData(0, 0, IW, IH).data;
  let sum = 0; for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  const meanDiff = sum / (IW * IH * 3);
  const outs = [];
  for (const L of LAYERS) {
    const o = document.createElement("canvas"); o.width = L.sw * L.dens; o.height = L.sh * L.dens;
    const ox = o.getContext("2d"); ox.imageSmoothingQuality = "high";
    ox.drawImage(m, L.sx * K, L.sy * K, L.sw * K, L.sh * K, 0, 0, o.width, o.height);
    const blob = await new Promise(r => o.toBlob(r, "image/webp", 0.8));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    outs.push({ out: L.out, w: o.width, h: o.height, b64: btoa(s) });
  }
  return { meanDiff, outs };
}, { IW, IH, K, LAYERS });
await browser.close();

if (res.error) { console.error(res.error); process.exit(1); }
console.log(`line-up: mean difference ${res.meanDiff.toFixed(2)} per colour channel (must be under 6)`);
if (res.meanDiff >= 6) { console.error("The master doesn't line up with src/assets/dome.webp (different framing or colours). Nothing written."); process.exit(1); }
for (const o of res.outs) {
  writeFileSync(o.out, Buffer.from(o.b64, "base64"));
  console.log(`${o.out}: ${o.w} × ${o.h}, ${(statSync(o.out).size / 1024).toFixed(0)} KB`);
}
