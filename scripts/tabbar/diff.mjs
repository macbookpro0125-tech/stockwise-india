// Compares two filmed runs (film.mjs) frame by frame:
//
//   node scripts/tabbar/diff.mjs <dirA> <dirB> [out.png]
//
// Prints, per frame, the largest channel difference, the mean, and how many
// pixels differ by more than 12 levels. With out.png, writes the worst frame
// — or the one named in FRAME=f_18.png — as A over B over their difference
// (amplified 4x).
import { chromium } from "playwright";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const [A, B, OUT] = process.argv.slice(2);
const files = readdirSync(A).filter(f => f.endsWith(".png")).sort();
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const url = f => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
let keep = null;
for (const f of files) {
  const r = await page.evaluate(async ({ a, b, picture }) => {
    const load = async src => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0); return { c, d: x.getImageData(0, 0, c.width, c.height) }; };
    const ia = await load(a), ib = await load(b);
    const da = ia.d.data, db = ib.d.data;
    let max = 0, sum = 0, n = 0, big = 0;
    const diff = new ImageData(ia.c.width, ia.c.height);
    for (let i = 0; i < da.length; i += 4) {
      let m = 0;
      for (let k = 0; k < 3; k++) { const d = Math.abs(da[i + k] - db[i + k]); sum += d; n++; if (d > m) m = d; }
      if (m > max) max = m;
      if (m > 12) big++;
      diff.data[i] = diff.data[i + 1] = diff.data[i + 2] = Math.min(255, m * 4); diff.data[i + 3] = 255;
    }
    let png = null;
    if (picture) {
      const W = ia.c.width, H = ia.c.height, c = document.createElement("canvas"); c.width = W; c.height = H * 3;
      const x = c.getContext("2d"); x.drawImage(ia.c, 0, 0); x.drawImage(ib.c, 0, H); x.putImageData(diff, 0, 2 * H);
      png = c.toDataURL("image/png");
    }
    return { max, mean: sum / n, big, png };
  }, { a: url(`${A}/${f}`), b: url(`${B}/${f}`), picture: !!OUT });
  console.log(`${f.padEnd(10)} max ${String(r.max).padStart(3)}  mean ${r.mean.toFixed(3)}  pixels >12: ${r.big}`);
  if (OUT && (process.env.FRAME ? f === process.env.FRAME : (!keep || r.big > keep.big))) keep = { f, ...r };
}
if (OUT && keep) { writeFileSync(OUT, Buffer.from(keep.png.split(",")[1], "base64")); console.log("frame", keep.f, "→", OUT); }
await browser.close();
