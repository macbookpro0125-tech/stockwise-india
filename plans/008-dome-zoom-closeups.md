# 008 — Keep the dome film sharp as the camera zooms in (two close-up layers)

- **Status**: DONE (16 Oct 2026, see Result at the end)
- **Commit**: dca95bf, plus the uncommitted Apple-design edits to `src/DomeFilm.jsx` and `src/dome-film.css` (16 Oct 2026). Commit those first; the excerpts below are from that working tree.
- **Severity**: HIGH
- **Category**: Performance (what's in the frames: magnified pixels)
- **Estimated scope**: 2 new image files, 1 new script, `src/DomeFilm.jsx` (~30 lines). Needs one image from the user first (Step 1).

## Problem

The front page's scroll film (`src/DomeFilm.jsx`) draws one picture, `src/assets/dome.webp` (1672 × 941 px), and zooms into it up to 4.4×:

```js
// src/DomeFilm.jsx:21 — current
const IW = 1672, IH = 941, DX = 647, DY = 112, ZEND = 4.4, VOID = "#05060a";
```

```js
// src/DomeFilm.jsx:100-108 — current
      const z = reduce ? 1 : 1 + (ZEND - 1) * ease(p), tx = Px * (1 - z), ty = Py * (1 - z);
      const ix = tx + z * bx, iy = ty + z * by, iw = IW * s0 * z, ih = IH * s0 * z;
      const dx = Px + z * (D0x - Px), dy = Py + z * (D0y - Py);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      ctx.fillStyle = VOID; ctx.fillRect(0, 0, cw, ch);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, ix, iy, iw, ih);
      feather(ix, iy, iw, ih);
```

There is no sharper master anywhere: `~/Projects/stockwise-scroll/assets/dome-source.png` is the same 1672 × 941, and the video there is 1080p. So the zoom runs out of pixels. Measured on a MacBook Air (1440 × 900, devicePixelRatio 2), with the film's own camera maths:

| Scroll | Zoom | Screen px per picture px | Sharpness (mean edge strength) |
|---|---|---|---|
| 0 | 1.00× | 1.7 | 7.13 |
| 0.30 | 1.37× | 2.4 | 6.03 |
| 0.45 | 2.24× | 3.9 | 2.67 |
| 0.60 | 3.53× | 6.1 | 1.49 |
| 1.00 | 4.40× | 7.6 | (under the light) |

Lines go soft, stars smear and the picture's compression blocks show from about scroll 0.4 until the light covers the frame (around 0.65). Rejected cause: the glow layer (`makeBloom`, built at a third of the size). Rebuilding it at full size only moved sharpness at 0.45 from 2.67 to 2.87, and switching it off gave 3.07. Phones are barely affected: a 390 × 844 phone peaks at 2.05 screen px per picture px.

## Target

Two pre-cut, sharper close-ups of the part of the dome the camera moves into, drawn over the picture in exactly the same place and faded in as the zoom grows. The film's maths, timing, captions and first frame stay as they are. They are loaded after the first frame, and only on screens that need them.

| File | Covers (picture px, from 0,0 at top-left of the 1672 × 941 picture) | Density | File size (px) | Fades in over zoom | Loaded when zoom 4.4 would magnify past |
|---|---|---|---|---|---|
| `src/assets/dome-mid.webp` | x 127, y 0, w 1305, h 941 | 2× | 2610 × 1882 | 1.3 → 1.6 (scroll ≈ 0.30 → 0.35) | 2.5 screen px per picture px |
| `src/assets/dome-star.webp` | x 346, y 0, w 686, h 433 | 4× | 2744 × 1732 | 2.5 → 2.8 (scroll ≈ 0.47 → 0.51) | 4.5 screen px per picture px |

The rectangles are the union of everything the camera shows from the start of each fade to full zoom. They were computed for these screens, with an 8 px margin: iPad 820×1180@2 and 1180×820@2, laptops 1280×800@2, 1440×900@2, 1512×982@2 and 1728×1117@2, desktops 1366×768@1, 1920×1080@1, 2560×1440@1 and 2560×1440@2. Phones never load either file.

The result at full zoom, in screen px per close-up px (it's 1.72 at the very first frame on a MacBook Air today):

- MacBook Air: 7.58 → 1.89
- MBP 16": 9.09 → 2.27
- 1920×1080 desktop: 5.05 → 1.26
- 5K: 13.47 → 3.37
- iPad portrait and 1366×768 desktops load only `dome-mid`: 2.16 and 1.80 at the end.

Extra download: about 9.7 megapixels, roughly 2–3 MB of WebP, fetched after the first frame on large screens only.

## Repo conventions to follow

- Images ship from `src/assets/` and are imported, so Vite hashes and caches them. Exemplar: `src/DomeFilm.jsx:4` — `import domeUrl from "./assets/dome.webp";`. Don't inline as base64.
- All film setup lives in the one `useEffect` in `src/DomeFilm.jsx`, with full cleanup; it must survive React StrictMode's double run. Use the existing `c01` helper (`src/DomeFilm.jsx:24`).
- Scripts in `scripts/` are ES modules that drive system Chrome via `playwright-core`. Exemplar: `scripts/demo-app.mjs:9` — `import { chromium } from "playwright-core";`, launched with `{ channel: "chrome" }`.
- Comments in this repo are full sentences in plain English that explain why. Match that density.

## Steps

Line numbers below refer to `src/DomeFilm.jsx` as it is before you start. Earlier steps add lines, so always match on the quoted code, not the number.

### 1. Get a 4× master of the dome picture (a person does this, not the executor)

You need a PNG of exactly **6688 × 3764 px**: the same picture as `~/Projects/stockwise-scroll/assets/dome-source.png`, upscaled 4× with identical framing (no crop, no reframe, no colour grade). Save it **outside the repo** as `~/Projects/stockwise-scroll/assets/dome-master@4x.png`. It will be 20 MB or more, and only the two crops ship.

There are two routes; the user picks one:

- **a. The tool that made the picture.** Use its upscaler (for example Topaz Gigapixel, Magnific, Photoshop Super Resolution applied twice at 2×, or the generator's own upscale) at exactly 4×.
- **b. Real-ESRGAN, run locally.** This means downloading `realesrgan-ncnn-vulkan` for macOS from the official GitHub releases of `xinntao/Real-ESRGAN`. **Ask the user before downloading anything.** Then run:
  ```bash
  ./realesrgan-ncnn-vulkan -i ~/Projects/stockwise-scroll/assets/dome-source.png -o ~/Projects/stockwise-scroll/assets/dome-master@4x.png -n realesrgan-x4plus -s 4
  ```

An upscaler adds plausible detail; it doesn't recover real detail. That's acceptable here because the dome is an illustration, not data. If no master is available, STOP: the remaining steps need it.

### 2. Add `scripts/make-dome-layers.mjs` and cut the two close-ups

Create the file with exactly this content:

```js
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
```

Run it from the repo root:

```bash
node scripts/make-dome-layers.mjs ~/Projects/stockwise-scroll/assets/dome-master@4x.png
```

Expect `dome-mid.webp` at 2610 × 1882 and `dome-star.webp` at 2744 × 1732. If either file is over 1600 KB, change `0.8` to `0.72` in the `toBlob` call, run again, and keep the lower value in the script.

### 3. `src/DomeFilm.jsx`: import the close-ups and describe them

After line 4 (`import domeUrl from "./assets/dome.webp";`) add:

```js
import domeMidUrl from "./assets/dome-mid.webp";
import domeStarUrl from "./assets/dome-star.webp";
```

After line 21 (the `const IW = 1672, …` line) add:

```js
// Sharper close-ups of the part of the dome the camera moves into, cut from a
// 4× upscale (scripts/make-dome-layers.mjs). Each rectangle is in the picture's
// own pixels; it is drawn over the picture in exactly the same place and faded
// in as the zoom passes z0 → z1, so the first frame is the picture alone. A
// screen loads one only if full zoom would stretch the picture past `need`
// screen px per picture px, so phones never fetch them.
const LAYERS = [
  { url: domeMidUrl, sx: 127, sy: 0, sw: 1305, sh: 941, z0: 1.3, z1: 1.6, need: 2.5 },
  { url: domeStarUrl, sx: 346, sy: 0, sw: 686, sh: 433, z0: 2.5, z1: 2.8, need: 4.5 },
];
```

### 4. `src/DomeFilm.jsx`: load them inside the effect

Replace line 48:

```js
    let bloom = null, ready = false;
```

with:

```js
    let bloom = null, ready = false, disposed = false;
    const layers = LAYERS.map(l => ({ ...l, img: null, asked: false }));
    // Fetch the close-ups this screen needs, once the picture itself is up.
    // The camera never moves for less motion, so nothing to sharpen there.
    function loadLayers() {
      if (!ready || reduce) return;
      const most = ZEND * s0 * dpr;
      for (const l of layers) {
        if (l.asked || most <= l.need) continue;
        l.asked = true;
        const im = new Image();
        im.decoding = "async";
        im.src = l.url;
        im.decode().then(() => { if (disposed) return; l.img = im; if (onScreen) draw(p); }).catch(() => {}); // the picture alone still works
      }
    }
```

At the end of `resize()` (after line 81, `Px = Math.min(R, …); Py = Math.min(B, …);`), still inside the function, add:

```js
      loadLayers(); // a window made larger may now need them
```

`img.onload` (line 183) sets `ready = true` and then calls `resize()`, so the close-ups are requested right after the first frame. Don't add another call there.

### 5. `src/DomeFilm.jsx`: draw them

In `draw()`, replace these two lines (107-108):

```js
      ctx.drawImage(img, ix, iy, iw, ih);
      feather(ix, iy, iw, ih);
```

with:

```js
      ctx.drawImage(img, ix, iy, iw, ih);
      for (const l of layers) { // the sharper close-ups, in the picture's own place
        const a = l.img ? c01((z - l.z0) / (l.z1 - l.z0)) : 0;
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(l.img, ix + l.sx * s0 * z, iy + l.sy * s0 * z, l.sw * s0 * z, l.sh * s0 * z);
      }
      ctx.globalAlpha = 1;
      feather(ix, iy, iw, ih);
```

### 6. `src/DomeFilm.jsx`: clean up

In the effect's cleanup (the `return () => { … }` starting at line 194), add `disposed = true;` as its first line.

### 7. Header comment

In the comment at the top of `src/DomeFilm.jsx` (lines 8-18), after the sentence ending "…camera for anyone who asked their system for less motion.", add:

```js
// On large screens two sharper close-ups (LAYERS) fade in as the camera zooms,
// so the picture stays crisp instead of showing its pixels.
```

## Boundaries

- Do NOT change `IW`, `IH`, `DX`, `DY`, `ZEND`, `ease`, `seg`, the zoom pivot, `feather`, `makeBloom`, the glow or light code, the captions or any CSS.
- Do NOT replace `src/assets/dome.webp`. It stays the first frame everywhere.
- Do NOT commit the 4× master to the repo, and do NOT inline any image as base64.
- Do NOT add dependencies; `playwright-core` is already installed.
- Do NOT download any tool without the user's explicit OK (Step 1b).
- If any line number or excerpt above doesn't match the file (it drifted since this plan was written), STOP and report rather than improvising.

## Verification

- **Mechanical**
  - `npm run build` passes. `dist/assets/` contains hashed `dome-mid-*.webp` and `dome-star-*.webp`.
  - `npx playwright test -g "F01" --project=desktop --workers=1` passes: 4 tests. Use one worker; two workers hang on this machine.
- **First frame untouched**: with `npm run api` and `npm run dev` running, open http://localhost:5175 signed out (a private window). At scroll 0 the canvas must equal the plain picture. Run this in the console; it must print `0`:
  ```js
  (async () => { const cv = document.querySelector(".df-film"), dpr = cv.width / cv.clientWidth, cw = cv.clientWidth, ch = cv.clientHeight, s0 = Math.min(cw / 1672, ch / 941); let bx = (cw - 1672 * s0) / 2, by = (ch - 941 * s0) / 2; if (ch > cw) by = Math.min(by, ch * 0.16); const im = new Image(); im.src = performance.getEntriesByType("resource").map(e => e.name).find(n => /dome[^/?]*\.webp$/.test(n) && !/mid|star/.test(n)); await im.decode(); const r = document.createElement("canvas"); r.width = cv.width; r.height = cv.height; const x = r.getContext("2d", { alpha: false }); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = "#05060a"; x.fillRect(0, 0, cw, ch); x.imageSmoothingQuality = "high"; x.drawImage(im, bx, by, 1672 * s0, 941 * s0); const X = Math.round((bx + 1672 * s0 * 0.3) * dpr), Y = Math.round((by + 941 * s0 * 0.35) * dpr), W = Math.round(1672 * s0 * 0.4 * dpr), H = Math.round(941 * s0 * 0.3 * dpr); const a = cv.getContext("2d").getImageData(X, Y, W, H).data, b = x.getImageData(X, Y, W, H).data; let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); console.log(m); })();
  ```
- **Who downloads what** (DevTools → Network, filter `dome`, reload at scroll 0):
  - 1440 × 900 window on a retina Mac: `dome.webp`, then `dome-mid` and `dome-star` right after the first frame.
  - 390 × 844 device emulation: `dome.webp` only.
  - With `prefers-reduced-motion: reduce` (Rendering panel): `dome.webp` only.
- **Sharper**: on 1440 × 900 at devicePixelRatio 2, the film's frames at scroll 0.45 and 0.60 must measure at least 1.5× today's 2.67 and 1.49. Measure with the mean absolute Laplacian of luminance, over the region x 6–36%, y 25–75% of `.df-film`. Scroll with `const t = document.querySelector(".df-track"), s = document.querySelector(".df-stage"); scrollTo(0, t.offsetTop + (t.offsetHeight - s.clientHeight) * 0.45)` and wait 1.5 s before reading.
- **Feel check**:
  - Scroll slowly from 0.25 to 0.65. The picture should sharpen in place: no jump, no visible rectangle edge, no colour shift where a close-up fades in. The fades sit around scroll 0.30–0.35 and 0.47–0.51.
  - Throttle the network to "Fast 3G" and reload. The film must play normally on the picture alone, and sharpen without moving when the close-ups arrive.
  - Resize the window from narrow to wide while scrolled to 0.5. The close-ups must still line up exactly with the picture.
  - Flick-scroll hard through the film. There should be no dropped-frame stutter compared with before (Performance panel: frames under 16 ms on a recent Mac).
- **Done when**:
  - Both files exist in `src/assets/` at the stated sizes, and the script reports a line-up difference under 6.
  - The first-frame check prints 0, and the sharpness targets are met.
  - Phones and reduced-motion don't download the close-ups.
  - F01 passes.

## Result (16 Oct 2026)

- **Master:** made with Real-ESRGAN (`realesrgan-ncnn-vulkan` 20220424 macOS build, from the official v0.2.5.0 release; model `realesrgan-x4plus`), downloaded with the user's OK. It took 82 s on the Radeon Pro 560X. The output, `~/Projects/stockwise-scroll/assets/dome-master@4x.png`, is 6688 × 3764 and is not in the repo.
- **Line-up:**
  - The script reported a mean difference of 4.44. Most of that is compression in `dome.webp` itself: it's 2.32 against `dome-source.png`.
  - A half-pixel shift test confirmed the position is exact; any shift makes the match worse.
  - Mean colour matches to within 0.3/255.
- **Files:** `dome-mid.webp` is 2610 × 1882 (507 KB) and `dome-star.webp` is 2744 × 1732 (432 KB), 939 KB together.
- **Downloads** (image requests only; in dev, Vite's `?import` module requests also contain the names):

  | Screen | Close-ups downloaded |
  |---|---|
  | MacBook Air 1440×900@2 | both |
  | 1366×768@1 | dome-mid only |
  | 390×844 phone | none |
  | Reduced motion | none |

- **First frame:** the max difference from the plain picture is 0 on all four.
- **Sharpness:** the plan's mean-|Laplacian| measure turned out to be a poor fit, because Real-ESRGAN removes fine speckle noise that measure counts as detail. On the 95th-percentile gradient magnitude (strong edges), same app with and without the close-ups:

  | Scroll | Without | With | Change |
  |---|---|---|---|
  | 0.32 | 66 | 73.5 | ×1.11 (first fade only half in) |
  | 0.45 | 34.7 | 46.4 | ×1.34 |
  | 0.55 | 15.8 | 23.3 | ×1.47 |
  | 0.60 | 12 | 17.8 | ×1.48 |

  This is just short of the 1.5× target. What softness remains is the deliberate glow over the frame and the upscaler's own limit. By eye, lines and stars are crisp where they were blurred.
- **Seams:** none visible mid-fade (scroll 0.32 and 0.49) at 1440×900@2 and 1920×1080@1.
- **Tests:** F01 passed (4).
