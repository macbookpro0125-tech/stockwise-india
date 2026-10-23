// The owner's JI artwork (scripts/brand/ji-original.png, silver rings and
// charcoal letters) in the app's own colours (23 Oct 2026, "make that shade
// of JI same as our app"): the outer ring in the app's teal, the two inner
// ones in its blue, the letters in its navy — as the dark logo has them
// (brand-assets.mjs). Each pixel keeps its lightness, so the artwork's
// shading and highlights stay; only the hue changes.
//
//   node scripts/brand-app-colours.mjs
//
// Writes scripts/brand/ji-app-colours.png, which the app icons are drawn from
// (android-assets.mjs, play-assets.mjs).
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = `data:image/png;base64,${readFileSync(join(ROOT, "scripts/brand/ji-original.png")).toString("base64")}`;

// dark and light end of each piece's colour, for its darkest and lightest pixel
const RAMPS = {
  outer: ["#007F6B", "#7DFFEA"],   // --accent #00E0BE in between
  inner: ["#2347B5", "#B7CCFF"],   // --brand-wise #6FA0FF in between
  letters: ["#060A1C", "#3B4A8C"], // the dark logo's navy, #0B1028
};

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const png = await page.evaluate(async ({ src, RAMPS }) => {
  const img = new Image(); img.src = src; await img.decode();
  const W = img.width, H = img.height;
  const c = new OffscreenCanvas(W, H), g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const im = g.getImageData(0, 0, W, H), d = im.data;

  // The pieces: what joins up when the see-through background is left out.
  // The letters are the pieces in the middle; the biggest other one is the
  // outer ring.
  const lab = new Int32Array(W * H).fill(-1), solid = i => d[i * 4 + 3] > 60, sizes = [], middle = [];
  for (let i = 0; i < W * H; i++) {
    if (lab[i] !== -1 || !solid(i)) continue;
    const id = sizes.length, stack = [i]; let n = 0, inMiddle = 0;
    lab[i] = id;
    while (stack.length) {
      const j = stack.pop(), x = j % W, y = (j / W) | 0;
      n++;
      if (Math.hypot(x - W / 2, y - H / 2) < W * 0.25) inMiddle++;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W]) if (k >= 0 && k < W * H && lab[k] === -1 && solid(k)) { lab[k] = id; stack.push(k); }
    }
    sizes.push(n); middle.push(inMiddle / n > 0.9);
  }
  const rings = sizes.map((n, id) => ({ n, id })).filter(p => !middle[p.id]).sort((a, b) => b.n - a.n);
  const part = id => (middle[id] ? "letters" : id === rings[0].id ? "outer" : "inner");

  // the soft edges (mostly see-through) take the nearest piece's colour
  const near = i => {
    const x = i % W, y = (i / W) | 0;
    for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && lab[yy * W + xx] >= 0) return lab[yy * W + xx];
    }
    return -1;
  };

  // lightness range of each piece, so its shading spans the whole ramp
  const lum = i => 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
  const range = { outer: [255, 0], inner: [255, 0], letters: [255, 0] };
  for (let i = 0; i < W * H; i++) if (lab[i] >= 0) { const r = range[part(lab[i])], l = lum(i); r[0] = Math.min(r[0], l); r[1] = Math.max(r[1], l); }

  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const ramp = Object.fromEntries(Object.entries(RAMPS).map(([k, [a, b]]) => [k, [hex(a), hex(b)]]));
  for (let i = 0; i < W * H; i++) {
    if (d[i * 4 + 3] === 0) continue;
    const id = lab[i] >= 0 ? lab[i] : near(i);
    if (id < 0) continue;
    const p = part(id), [lo, hi] = range[p], [a, b] = ramp[p];
    const t = Math.min(1, Math.max(0, (lum(i) - lo) / Math.max(1, hi - lo)));
    for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.round(a[k] + (b[k] - a[k]) * t);
  }
  g.putImageData(im, 0, 0);
  const blob = await c.convertToBlob({ type: "image/png" });
  return [...new Uint8Array(await blob.arrayBuffer())];
}, { src, RAMPS });
await browser.close();
writeFileSync(join(ROOT, "scripts/brand/ji-app-colours.png"), Buffer.from(png));
console.log("scripts/brand/ji-app-colours.png written — next: node scripts/android-assets.mjs");
