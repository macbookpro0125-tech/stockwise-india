// Films the phone tab bar one 60 Hz frame at a time — performance.now and
// requestAnimationFrame swapped for a manual clock — at the iOS recording's
// scale (375×812 at 3x), and measures the bubble from the page itself.
//
//   node scripts/tabbar/film.mjs <theme> <from> <to> [upAfter] [frames] [tag] [--white] [--text] [--cpu]
//
// theme: light or dark. from, to: tab numbers (0 Discover … 3 Portfolio).
// upAfter: frames between finger down and up (3 = 50ms, a tap). frames: how
// many to film (30). --white: a plain white page behind the bar; --text: a
// black headline running behind it, as in the recording; --cpu: no WebGL.
// Writes $OUT/film/<tag>/f_-1.png … f_NN.png (the bar's strip at 3x, the
// same strip refframes.sh cuts from the recording) and
// $OUT/film/metrics-<tag>.json (each frame's centre, width, height, glass,
// swell and frost).
import { writeFileSync, rmSync } from "node:fs";
import { startApp, launch, phonePage, outDir, BAR_CLIP } from "./app.mjs";

const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const flag = f => process.argv.includes(f);
const theme = args[0] || "light";
const from = Number(args[1] ?? 0), to = Number(args[2] ?? 1);
const upAfter = Number(args[3] ?? 3), frames = Number(args[4] ?? 30);
const tag = args[5] || `${theme}-${from}${to}`;

// the page's clock, stopped and stepped by hand
function manualClock() {
  const realNow = performance.now.bind(performance), realRaf = window.requestAnimationFrame.bind(window), realCancel = window.cancelAnimationFrame.bind(window);
  const C = (window.__clock = { manual: false, t: 0, q: new Map(), id: 1e7 });
  performance.now = () => (C.manual ? C.t : realNow());
  window.requestAnimationFrame = cb => { if (!C.manual) return realRaf(cb); const id = ++C.id; C.q.set(id, cb); return id; };
  window.cancelAnimationFrame = id => { if (C.q.has(id)) C.q.delete(id); else realCancel(id); };
  window.__manual = () => { C.t = realNow(); C.manual = true; };
  window.__advance = ms => { C.t += ms; const cbs = [...C.q.values()]; C.q.clear(); cbs.forEach(cb => cb(C.t)); };
}

const { base } = await startApp();
const browser = await launch({ cpu: flag("--cpu") });
const { page, errors } = await phonePage(browser, base, { width: 375, height: 812, theme, init: [[manualClock]] });
console.log("rim drawn by:", await page.evaluate(() => (document.querySelector(".btb-lens-canvas")?.getContext("webgl") ? "webgl" : "cpu")));
if (flag("--text")) await page.evaluate(() => {
  // the recording's backdrop: a black headline running behind the bar
  const d = document.createElement("div");
  d.textContent = "Tesla and SpaceX Shed $456 Billion, Elon Musk Loses Nearly $80 Billion in a Day";
  d.style.cssText = "position:fixed;left:16px;top:702.7px;width:356px;font:600 21px/27px -apple-system,system-ui;letter-spacing:-0.4px;color:#000;z-index:1;pointer-events:none";
  const nav = document.querySelector(".bottom-tab-bar");
  nav.parentElement.insertBefore(d, nav);
});
if (flag("--white")) await page.addStyleTag({ content: "html, body, .app-shell, .app-shell *:not(.bottom-tab-bar, .bottom-tab-bar *) { background-color: #fff !important; background-image: none !important; box-shadow: none !important; }" });

const tabs = page.locator(".bottom-tab-bar .btb-tab");
if (from !== 0) { await tabs.nth(from).click(); await page.waitForTimeout(1200); }
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
// where everything sits at rest, in pt from the screen's top left
const rest = await page.evaluate(() => {
  const nav = document.querySelector(".bottom-tab-bar"), r = nav.getBoundingClientRect();
  const tabs = [...nav.querySelectorAll(".btb-tab")].map(t => {
    const ic = t.querySelector(".btb-icon svg").getBoundingClientRect(), lb = t.querySelector(".btb-label");
    const probe = document.createElement("span"); probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline"; lb.appendChild(probe);
    const baseline = probe.getBoundingClientRect().bottom; probe.remove();
    const lr = lb.getBoundingClientRect();
    return { label: lb.textContent, icon: [+(ic.left + ic.width / 2).toFixed(2), +(ic.top + ic.height / 2).toFixed(2)], labelCentre: +(lr.left + lr.width / 2).toFixed(2), labelW: +lr.width.toFixed(2), baseline: +baseline.toFixed(2) };
  });
  const lens = nav.querySelector(".btb-lens").getBoundingClientRect();
  return { bar: [+r.left.toFixed(2), +r.top.toFixed(2), +r.right.toFixed(2), +r.bottom.toFixed(2), +r.height.toFixed(2)], lens: [+lens.left.toFixed(2), +lens.top.toFixed(2), +lens.width.toFixed(2), +lens.height.toFixed(2)], tabs };
});

// film: finger down on tab `to`, up after `upAfter` frames
rmSync(outDir("film", tag), { recursive: true, force: true });
const dir = outDir("film", tag);
const box = await tabs.nth(to).boundingBox();
await page.evaluate(() => window.__manual());
const measure = k => page.evaluate(k => {
  const nav = document.querySelector(".bottom-tab-bar"), lens = nav.querySelector(".btb-lens");
  const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(lens.style.transform) || [0, 0, 0];
  const w = parseFloat(lens.style.width), h = parseFloat(lens.style.height);
  const glass = nav.querySelector(".btb-lens-glass");
  return { k, left: +m[1], top: +m[2], w: +w.toFixed(2), h: +h.toFixed(2), cx: +(+m[1] + w / 2).toFixed(2), g: +(+glass.style.opacity || 0).toFixed(3), scale: nav.style.scale || "1", barW: +nav.getBoundingClientRect().width.toFixed(2), frost: glass.style.getPropertyValue("--frost"), bg: getComputedStyle(glass).backgroundColor };
}, k);
const metrics = [];
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
metrics.push(await measure(-1));
await page.screenshot({ path: `${dir}/f_-1.png`, clip: BAR_CLIP });
await page.mouse.down();
for (let k = 0; k < frames; k++) {
  if (k === upAfter) await page.mouse.up();
  await page.evaluate(() => window.__advance(1000 / 60));
  metrics.push(await measure(k));
  await page.screenshot({ path: `${dir}/f_${String(k).padStart(2, "0")}.png`, clip: BAR_CLIP });
}
writeFileSync(`${outDir("film")}/metrics-${tag}.json`, JSON.stringify({ rest, metrics }, null, 1));
console.log(JSON.stringify(rest));
console.log(metrics.map(m => `${m.k}: cx ${m.cx} w ${m.w} h ${m.h} glass ${m.g} swell ${m.scale} frost ${m.frost}`).join("\n"));
console.log("frames in", dir);
console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
process.exit(0);
