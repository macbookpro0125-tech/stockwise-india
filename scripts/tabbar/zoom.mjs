// The same small area of several frames, enlarged and stacked (no smoothing,
// so single pixels show):
//
//   node scripts/tabbar/zoom.mjs <out.png> <x> <y> <w> <h> <scale> <frame.png>…
//
// x, y, w, h in the frames' own pixels (3x). E.g. the label under the drop:
// zoom.mjs label.png 340 150 200 60 4 a/f_18.png b/f_18.png
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const [out, x, y, w, h, k, ...files] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const png = await page.evaluate(async ({ srcs, x, y, w, h, k }) => {
  const c = document.createElement("canvas"); c.width = w * k; c.height = (h * k + 6) * srcs.length;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.fillStyle = "#f0f"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < srcs.length; i++) { const im = new Image(); im.src = srcs[i]; await im.decode(); g.drawImage(im, x, y, w, h, 0, i * (h * k + 6), w * k, h * k); }
  return c.toDataURL("image/png");
}, { srcs: files.map(f => `data:image/png;base64,${readFileSync(f).toString("base64")}`), x: +x, y: +y, w: +w, h: +h, k: +k });
writeFileSync(out, Buffer.from(png.split(",")[1], "base64"));
await browser.close();
console.log("→", out);
