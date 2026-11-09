// Reads the colour at named points of two images (the recording's frame and
// ours), side by side:
//
//   node scripts/tabbar/pixels.mjs <ref.png> <ours.png> '[["glass", 300, 120], ["capsule", 440, 130]]'
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const [a, b, pointsJson] = process.argv.slice(2);
const points = JSON.parse(pointsJson);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const read = file => page.evaluate(async ({ src, points }) => {
  const im = new Image(); im.src = src; await im.decode();
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
  const x = c.getContext("2d"); x.drawImage(im, 0, 0);
  return points.map(([name, X, Y]) => [name, [...x.getImageData(X, Y, 1, 1).data].slice(0, 3)]);
}, { src: `data:image/png;base64,${readFileSync(file).toString("base64")}`, points });
const ra = await read(a), rb = await read(b);
ra.forEach(([name, v], i) => console.log(name.padEnd(28), "ref", JSON.stringify(v).padEnd(16), "ours", JSON.stringify(rb[i][1])));
await browser.close();
