// Renders the front page's star film (src/starScene.js, StarFilm.jsx) to a 4K
// video: 3840 × 2160, 30 fps, H.264 MP4. It steps the live film frame by frame
// in Chrome, captions included (the site's bar, buttons and scroll cue are
// hidden), and encodes in Chrome too (WebCodecs + Mediabunny), so nothing else
// needs installing.
//
// Run the app first (npm run api, npm run dev), then:
//   node scripts/render-star-film.mjs ~/Projects/stockwise-scroll/assets/stockwise-star-film-4k.mp4
// Options: --seconds 22 (the whole film, with a 1 s hold at the start and 2 s
// at the end), --fps 30, --mbps 40, --url http://localhost:5175
import { chromium } from "playwright-core";
import { readFileSync, openSync, writeSync, closeSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const out = args.find(a => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
if (!out) { console.error("usage: node scripts/render-star-film.mjs <out.mp4> [--seconds 22] [--fps 30] [--mbps 40] [--url http://localhost:5175]"); process.exit(1); }
const SECONDS = +opt("seconds", 22), FPS = +opt("fps", 30), MBPS = +opt("mbps", 40), URL_ = opt("url", "http://localhost:5175");
const W = 3840, H = 2160, HOLD_IN = 1, HOLD_OUT = 2;
const frames = Math.round(SECONDS * FPS);
// Progress through the film at time s: a hold, the run through, a hold. The
// run lingers (twice the time per step) from the star to the light — the
// score ring, the light spreading, the price level — so the light grows over
// a second and a half rather than flashing.
const linger = p => (p > 0.5 && p < 0.76 ? 2 : 1);
const grid = [0]; for (let i = 1; i <= 1000; i++) grid.push(grid[i - 1] + linger((i - 0.5) / 1000));
const progress = s => {
  const k = Math.min(1, Math.max(0, (s - HOLD_IN) / (SECONDS - HOLD_IN - HOLD_OUT))) * grid[1000];
  let i = 0; while (i < 1000 && grid[i + 1] < k) i++;
  return (i + (k - grid[i]) / (grid[i + 1] - grid[i] || 1)) / 1000;
};

const require = createRequire(import.meta.url);
const bunny = join(dirname(require.resolve("mediabunny")), "mediabunny.mjs"); // its browser build

const browser = await chromium.launch({ channel: "chrome" });

// The film, at 1920 × 1080 css px × 2 = 3840 × 2160
const film = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 })).newPage();
await film.goto(`${URL_}/?film-export`);
await film.waitForFunction(() => typeof window.__starFilm === "function", null, { timeout: 30000 });
await film.addStyleTag({ content: ".sf-bar, .sf-cue, .sf-btn, .sf-link, .sf-actions { visibility: hidden !important; }" });
await film.waitForTimeout(1500); // fonts

// The encoder: a blank page with Mediabunny, fed one JPEG frame at a time
const enc = await (await browser.newContext()).newPage();
// localhost counts as a secure page, which WebCodecs needs; nothing listens there, the route answers
await enc.route("http://localhost:59999/**", route => {
  const path = new URL(route.request().url()).pathname;
  if (path === "/mediabunny.mjs") return route.fulfill({ body: readFileSync(bunny), contentType: "text/javascript" });
  return route.fulfill({ contentType: "text/html", body: `<!doctype html><canvas id="c" width="${W}" height="${H}"></canvas><script type="module">
    import { Output, Mp4OutputFormat, BufferTarget, CanvasSource } from "/mediabunny.mjs";
    const cv = document.getElementById("c"), ctx = cv.getContext("2d");
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const source = new CanvasSource(cv, { codec: "avc", bitrate: ${MBPS * 1e6}, keyFrameInterval: 1, hardwareAcceleration: "prefer-hardware" });
    output.addVideoTrack(source, { frameRate: ${FPS} });
    window.ready = output.start();
    window.add = async (b64, i) => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
      ctx.drawImage(bmp, 0, 0, ${W}, ${H}); bmp.close();
      await source.add(i / ${FPS}, 1 / ${FPS});
    };
    window.finish = async () => { await output.finalize(); window.buf = new Uint8Array(output.target.buffer); return window.buf.length; };
    window.chunk = (from, to) => { let s = ""; const b = window.buf.subarray(from, to); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
  </script>` });
});
await enc.goto("http://localhost:59999/");
await enc.waitForFunction(() => window.ready);
await enc.evaluate(() => window.ready);

const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const s = i / FPS;
  await film.evaluate(([p, t]) => window.__starFilm(p, t), [progress(s), s]);
  const jpg = await film.screenshot({ type: "jpeg", quality: 95 });
  await enc.evaluate(([b64, k]) => window.add(b64, k), [jpg.toString("base64"), i]);
  if (i % 30 === 0 || i === frames - 1) {
    const done = i + 1, left = (Date.now() - t0) / done * (frames - done) / 1000;
    console.log(`frame ${done}/${frames} · about ${Math.ceil(left / 60)} min left`);
  }
}
const size = await enc.evaluate(() => window.finish());
const fd = openSync(out, "w");
for (let at = 0; at < size; at += 8 << 20) {
  const b64 = await enc.evaluate(([a, b]) => window.chunk(a, b), [at, Math.min(size, at + (8 << 20))]);
  writeSync(fd, Buffer.from(b64, "base64"));
}
closeSync(fd);
await browser.close();
console.log(`${out}: ${W} × ${H}, ${FPS} fps, ${SECONDS} s, ${(size / 1048576).toFixed(1)} MB, in ${Math.round((Date.now() - t0) / 1000)} s`);
