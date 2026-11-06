// Link-preview pictures for the pages people share (6 Nov 2026: the Share
// button sends lists to WhatsApp, where a picture of the list gets the tap).
// One 1200×630 card per list, sector and screen, in the style of
// public/og/default.png: the mark, what kind of list it is, its name large,
// what's in it, and its address. No figures on the card (the panel's bars
// are a drawing, not scores) — they change with
// every close, the card doesn't — so a card never goes stale.
//
//   node scripts/og-cards.mjs [http://127.0.0.1:8790]
//
// Reads the lists' names from a running server's public API and writes
// public/og/{lists,sector,screens}/<slug>.jpg with the Chrome the tests use.
import { mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] ?? "http://127.0.0.1:8790";
const get = async path => { const r = await fetch(`${BASE}${path}`); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); };

const mark = `data:image/svg+xml;base64,${readFileSync(join(ROOT, "public/jocular-insights-mark.svg")).toString("base64")}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const card = ({ kicker, title, sub, path }) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:-apple-system,"SF Pro Display","Helvetica Neue",Inter,sans-serif;-webkit-font-smoothing:antialiased;color:#f4f5fb;
background:radial-gradient(700px 420px at 92% 0%,rgba(0,224,190,.20),transparent 62%),radial-gradient(600px 380px at 0% 105%,rgba(62,121,255,.16),transparent 60%),#07080f}
.wrap{position:absolute;inset:0;padding:72px 80px 64px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:20px;font-size:38px;font-weight:600;letter-spacing:-.02em}
.brand img{width:84px;height:84px;border-radius:20px}
.brand span{color:#00e0be}
.kicker{margin-top:56px;font-size:22px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#00e0be}
h1{margin-top:14px;font-size:${title.length > 26 ? 72 : 86}px;line-height:1.02;font-weight:700;letter-spacing:-.045em;max-width:720px}
.sub{margin-top:22px;font-size:30px;line-height:1.35;color:#a9afc4;max-width:700px}
.foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between}
.pill{padding:12px 24px;border-radius:999px;background:#00e0be;color:#062a24;font-size:24px;font-weight:600}
.url{font-size:26px;color:#a9afc4}
.panel{position:absolute;right:80px;top:170px;width:330px;padding:26px 26px 22px;border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.03));box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.09)}
.row{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.row:last-child{border-bottom:0}
.logo{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.12)}
.lines{flex:1}
.l1{height:12px;border-radius:6px;background:rgba(255,255,255,.28);width:80%}
.l2{margin-top:8px;height:9px;border-radius:5px;background:rgba(255,255,255,.12);width:55%}
.meter{width:70px;height:8px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden}
.meter i{display:block;height:100%;border-radius:4px;background:#00e0be}
</style></head><body><div class="wrap">
<div class="brand"><img src="${mark}" alt="">Jocular <span>Insights</span></div>
<div class="kicker">${esc(kicker)}</div>
<h1>${esc(title)}</h1>
<p class="sub">${esc(sub)}</p>
<div class="foot"><span class="pill">Free · every NSE close</span><span class="url">${esc(`jocularinsights.in${path}`)}</span></div>
</div>
<div class="panel">${[0.86, 0.74, 0.62, 0.5].map(w => `<div class="row"><span class="logo"></span><span class="lines"><span class="l1" style="display:block"></span><span class="l2" style="display:block"></span></span><span class="meter"><i style="width:${w * 100}%"></i></span></div>`).join("")}</div>
</body></html>`;

const KICKER = { index: "NSE index", theme: "NSE theme", rule: "Stock list" };
const jobs = [];
const lists = await get("/api/public/lists");
for (const g of lists.groups) for (const l of g.lists) jobs.push({ dir: "lists", slug: l.slug, kicker: KICKER[g.kind] ?? "Stock list", title: l.name, sub: "Every company with its price, P/E, ROE and quality score from its own filings" });
const sectors = await get("/api/public/sectors");
for (const s of sectors.sectors.filter(x => x.count >= 3)) jobs.push({ dir: "sector", slug: s.slug, kicker: "NSE sector", title: `${s.name} stocks`, sub: "Every listed company with its P/E, ROE, debt and quality score" });
const screens = await get("/api/public/screens");
for (const s of screens.screens) jobs.push({ dir: "screens", slug: s.slug, kicker: "Stock screen", title: s.name, sub: s.description ? String(s.description).replace(/\.$/, "") : "The NSE companies that pass it today, with their quality scores" });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const j of jobs) {
  const path = `/${j.dir}/${j.slug}`;
  await page.setContent(card({ ...j, path }), { waitUntil: "load" });
  const out = join(ROOT, "public/og", j.dir);
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: join(out, `${j.slug}.jpg`), type: "jpeg", quality: 82 });
}
await browser.close();
console.log(`${jobs.length} cards in public/og/{lists,sector,screens}`);
