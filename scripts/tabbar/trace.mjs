// Where a bubble trip's time goes on the page's main thread — script, style,
// layout, paint, layering — from a Chrome trace of three taps:
//
//   node scripts/tabbar/trace.mjs [rate] [mode] [without]
//
// rate and mode as timing.mjs. without: draw the drop without a part, to see
// its cost — noshine (its edge), nofaces (no tabs cut away under it) or
// noblur (no backdrop blur on the bar, capsule and drop).
// 9 Nov 2026, 4x slower, the bubble alone, before the fix, per frame: script
// ~7ms, style ~3ms, paint ~2.4ms, layering and commit ~4.5ms — over the 16.7ms
// a frame has.
import { startApp, launch, phonePage } from "./app.mjs";

const rate = Number(process.argv[2] || 4), mode = process.argv[3] || "bubble", without = process.argv[4] || "";
const swallowClicks = swallow => {
  if (swallow) addEventListener("click", e => { if (e.target.closest?.(".btb-tab")) { e.stopPropagation(); e.preventDefault(); } }, true);
};

const { base } = await startApp();
const browser = await launch();
const { ctx, page } = await phonePage(browser, base, { init: [[swallowClicks, mode === "bubble"]] });
await page.waitForTimeout(1000);
const css = {
  noshine: ".btb-lens-shine { display: none !important; }",
  nofaces: ".bottom-tab-bar .btb-face { clip-path: none !important; }",
  noblur: ".btb-lens-rest, .btb-lens-glass, .btb-bg { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }",
}[without];
if (css) await page.addStyleTag({ content: css });
const cdp = await ctx.newCDPSession(page);
if (rate > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate });
const tabs = await page.$$eval(".bottom-tab-bar .btb-tab", ts => ts.map(t => { const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame"] });
for (const i of [1, 2, 0]) {
  await page.waitForTimeout(1200);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [tabs[i]] });
  await page.waitForTimeout(80);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(900);
}
const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
// the page's main thread: of the renderers' main threads, the busiest one
const mains = events.filter(e => e.name === "thread_name" && e.args?.name === "CrRendererMain");
const busy = m => events.filter(e => e.pid === m.pid && e.tid === m.tid && e.name === "FireAnimationFrame").length;
const main = mains.sort((a, b) => busy(b) - busy(a))[0];
const kinds = {}, gpu = {};
const counted = ["FunctionCall", "FireAnimationFrame", "EventDispatch", "UpdateLayoutTree", "Layout", "PrePaint", "Paint", "Layerize", "Commit", "TimerFire", "RunMicrotasks", "MajorGC", "MinorGC", "HitTest", "UpdateLayer", "PaintImage"];
for (const e of events) {
  if (e.ph !== "X" || !e.dur) continue;
  if (e.name === "RasterTask" || e.name === "GPUTask") gpu[e.name] = (gpu[e.name] || 0) + e.dur / 1000;
  else if (e.tid === main?.tid && e.pid === main?.pid && counted.includes(e.name)) kinds[e.name] = (kinds[e.name] || 0) + e.dur / 1000;
}
console.log(`rate ${rate}x, ${mode}${without ? ", without " + without : ""} — main thread over three taps (ms): ${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", ")}`);
console.log(`raster and GPU (ms): ${Object.entries(gpu).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", ")}`);
console.log("(UpdateLayoutTree is style; FireAnimationFrame holds the bubble's own script; a trip is ~30 frames)");
await browser.close();
process.exit(0);
