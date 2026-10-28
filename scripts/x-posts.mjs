#!/usr/bin/env node
// The day's posts for X (@JocularInsights), from the live site's public data
// (27 Oct 2026: "post the important things of the day daily"). Each post is
// a picture (1200×675, the site's dark style) and its text, written into
// --out (default /tmp/jocular-x/<day>): <kind>.png and posts.json.
//
//   node scripts/x-posts.mjs [--out <dir>] [--only market,results,company] [--symbol TCS]
//
// Kinds: market (the indices at the close, the biggest moves), results (who
// reports today and tomorrow), company (one large company's figures —
// --symbol, else today's largest reporter). Words describe; nothing here is
// a tip, a target or a call (SEBI: educational only).
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://jocularinsights.in";
const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : f; };
const only = opt("only", "market,results,company").split(",");

const get = async path => { const r = await fetch(SITE + path); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); };
const pct = (v, d = 2) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`;
// a post's length as X counts it: every link is 23
const xlen = t => [...t.replace(/https?:\/\/\S+/g, "x".repeat(23)).replace(/\uFE0F/g, "")].reduce((n, c) => n + (c.codePointAt(0) > 0x2000 && !/[₹×−–—’]/.test(c) ? 2 : 1), 0);
const num = (v, d = 2) => Number(v).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const crore = v => v >= 1e5 ? `₹${(v / 1e5).toFixed(2)} lakh cr` : `₹${Math.round(v).toLocaleString("en-IN")} cr`;
const day = d => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const weekday = d => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tone = v => (v > 0 ? "up" : v < 0 ? "down" : "");

// The card around every picture: brand, title, body, the date and the site
const card = ({ eyebrow, title, body, foot }) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 675px; background: radial-gradient(70% 90% at 0% 0%, rgba(0,224,190,.14), transparent 60%), radial-gradient(60% 80% at 100% 100%, rgba(91,124,255,.12), transparent 60%), #080810; color: #F2F2F8; font-family: -apple-system, "SF Pro Display", "Segoe UI", Inter, system-ui, sans-serif; padding: 52px 64px; display: flex; flex-direction: column; }
  .eyebrow { font-size: 22px; letter-spacing: .06em; text-transform: uppercase; color: #00E0BE; font-weight: 600; }
  h1 { font-size: 52px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; margin-top: 10px; }
  .body { flex: 1; margin-top: 28px; min-height: 0; }
  .foot { display: flex; justify-content: space-between; align-items: center; font-size: 20px; color: #8A8AA8; }
  .brand { display: flex; align-items: center; gap: 12px; color: #F2F2F8; font-size: 24px; font-weight: 600; }
  .brand i { width: 40px; height: 40px; border-radius: 50%; border: 3px solid #C8C8D0; display: grid; place-items: center; font-style: normal; font-family: Georgia, serif; font-size: 18px; color: #F2F2F8; }
  .brand b { color: #7C9BFF; font-weight: 600; }
  .up { color: #2BD47D; } .down { color: #FF5C6C; }
  .grid { display: grid; gap: 14px; }
  .tile { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.09); border-radius: 18px; padding: 18px 22px; }
  .tile small { display: block; font-size: 19px; color: #A8A8C0; }
  .tile b { display: block; font-size: 32px; margin-top: 6px; font-variant-numeric: tabular-nums; }
  .tile em { font-style: normal; font-size: 22px; font-weight: 600; }
  ol { list-style: none; padding: 0; display: grid; gap: 8px; }
  ol li { display: flex; justify-content: space-between; gap: 16px; font-size: 24px; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,.07); }
  ol li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  ol li b { font-variant-numeric: tabular-nums; flex-shrink: 0; }
  h2 { font-size: 22px; color: #A8A8C0; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .05em; }
</style></head><body>
  <div class="eyebrow">${esc(eyebrow)}</div>
  <h1>${esc(title)}</h1>
  <div class="body">${body}</div>
  <div class="foot"><span class="brand"><i>JI</i>Jocular <b>Insights</b></span><span>${esc(foot)} · jocularinsights.in · Educational, not advice</span></div>
</body></html>`;

// ── the kinds ──────────────────────────────────────────────────────────────
async function market() {
  const strip = await get("/api/market-strip");
  const page = await get(`/api/public/page?path=${encodeURIComponent("/explore")}`);
  const list = h => [...(page.body.split(h)[1] ?? "").split("</ol>")[0].matchAll(/<a href="\/stock\/([^"]+)">([^<]+)<\/a> ([^<]+?) <small>([^<]+)<\/small>/g)].slice(0, 5).map(m => ({ symbol: m[1], name: m[2], move: m[3].trim(), price: m[4] }));
  const gainers = list("Top gainers today"), losers = list("Top losers today");
  const idx = strip.indices;
  const nifty = idx.find(i => i.name === "NIFTY 50");
  const tiles = idx.slice(0, 6).map(i => `<div class="tile"><small>${esc(i.name.replace(/^NIFTY /, "Nifty "))}</small><b>${num(i.close)}</b><em class="${tone(i.changePct)}">${pct(i.changePct)}</em></div>`).join("");
  const rows = (l, cls) => `<ol>${l.map(g => `<li><span>${esc(g.name)}</span><b class="${cls}">${esc(g.move)}</b></li>`).join("")}</ol>`;
  const body = `<div style="display:grid;grid-template-columns:1.15fr 1fr;gap:36px;height:100%">
    <div class="grid" style="grid-template-columns:1fr 1fr;align-content:start">${tiles}</div>
    <div style="display:grid;gap:18px;align-content:start"><div><h2>Top gainers</h2>${rows(gainers.slice(0, 3), "up")}</div><div><h2>Top losers</h2>${rows(losers.slice(0, 3), "down")}</div></div></div>`;
  const best = [...idx].sort((a, b) => b.changePct - a.changePct)[0], worst = [...idx].sort((a, b) => a.changePct - b.changePct)[0];
  const short = n => n.replace(/^NIFTY /, "Nifty ");
  const text = [
    `NSE close, ${day(strip.asOf)}: Nifty 50 ${num(nifty.close)} (${pct(nifty.changePct)}). ${short(best.name)} ${pct(best.changePct)}, ${short(worst.name)} ${pct(worst.changePct)}.`,
    `Biggest moves: ${gainers[0].name} ${gainers[0].move}, ${losers[0].name} ${losers[0].move}.`,
    // a company's page, where the full analysis is a free account away
    `${gainers[0].name}'s full analysis: ${SITE}/stock/${encodeURIComponent(gainers[0].symbol)}`,
    "#Nifty #IndianStockMarket",
  ].join("\n\n");
  return { kind: "market", text, html: card({ eyebrow: "Market close", title: `The NSE at the close, ${day(strip.asOf)}`, body, foot: `NSE closing prices` }) };
}

const shortName = n => n.replace(/ and Special Economic Zone$/, "").replace(/ Company$/, "").replace(/ Limited$/, "");

async function results() {
  const cal = await get("/api/public/results-calendar");
  const [first, second] = cal.days;
  if (!first) return null;
  const names = d => d.companies.slice(0, 6).map(c => c.name);
  const col = (d, label) => `<div><h2>${esc(label)} · ${d.count} companies</h2><ol>${d.companies.slice(0, 6).map(c => `<li><span>${esc(shortName(c.name))}</span><b style="color:#A8A8C0">${crore(c.marketCapCr)}</b></li>`).join("")}</ol></div>`;
  const label = d => d.date === cal.today ? "Today" : weekday(d.date);
  const body = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px">${col(first, label(first))}${second ? col(second, label(second)) : ""}</div>`;
  const short = shortName;
  const text = [
    `Results ${first.date === cal.today ? "today" : `on ${weekday(first.date)}`}: ${first.count} NSE companies, including ${names(first).slice(0, 3).map(short).join(", ")}.`,
    second ? `${weekday(second.date).split(",")[0]}: ${names(second).slice(0, 3).map(short).join(", ")} and ${second.count - 3} more.` : "",
    `${shortName(first.companies[0].name)}'s figures: ${SITE}/stock/${encodeURIComponent(first.companies[0].symbol)}`,
    "#Results #IndianStockMarket",
  ].filter(Boolean);
  // over X's 280: without the next day's line
  const joined = xlen(text.join("\n\n")) <= 280 ? text.join("\n\n") : text.filter((_, i) => i !== 1).join("\n\n");
  return { kind: "results", text: joined, html: card({ eyebrow: "Results calendar", title: "Who reports results next", body, foot: "NSE board meeting notices" }) };
}

async function company(symbol) {
  if (!symbol) symbol = (await get("/api/public/results-calendar")).days[0]?.companies[0]?.symbol;
  if (!symbol) return null;
  const s = await get(`/api/public/stock/${encodeURIComponent(symbol)}`);
  const name = s.name.replace(/ Limited$/, "");
  const facts = [["Quality score", s.quality != null ? `${Math.round(s.quality)}/100` : null], ["P/E", s.pe > 0 ? num(s.pe, 1) : null], ["ROE", s.roe != null ? `${num(s.roe, 1)}%` : null], ["ROCE", s.roce != null ? `${num(s.roce, 1)}%` : null], ["Debt to equity", s.debtToEquity != null ? num(s.debtToEquity, 2) : null], ["Dividend yield", s.divYield != null ? `${num(s.divYield, 2)}%` : null]].filter(([, v]) => v != null);
  const q = s.quarter;
  const body = `<div style="display:grid;grid-template-columns:1fr 1.1fr;gap:32px">
    <div class="grid" style="grid-template-columns:1fr 1fr;align-content:start">${facts.map(([k, v]) => `<div class="tile"><small>${k}</small><b>${v}</b></div>`).join("")}</div>
    <div class="grid" style="align-content:start">
      <div class="tile"><small>Close, ${day(s.closeDate)}</small><b>₹${num(s.close)} <em class="${tone(s.change1d)}">${pct(s.change1d)}</em></b></div>
      ${q ? `<div class="tile"><small>${esc(q.label)} results</small><b style="font-size:26px">Sales ${crore(q.salesCr)} <em class="${tone(q.salesYoY)}">${pct(q.salesYoY)}</em></b><b style="font-size:26px">Profit ${crore(q.profitCr)} <em class="${tone(q.profitYoY)}">${pct(q.profitYoY)}</em></b></div>` : ""}
      <div class="tile"><small>Market value</small><b>${crore(s.marketCapCr)}</b></div>
    </div></div>`;
  // in plain words, one figure a line, each saying what it means (28 Oct 2026:
  // "so everyone can understand")
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 330 * 60_000 + 86_400_000).toISOString().slice(0, 10);
  const when = !s.nextResults ? null : s.nextResults === today ? "reports results today" : s.nextResults === tomorrow ? "reports results tomorrow" : `reports results ${day(s.nextResults).replace(/ \d{4}$/, "")}`;
  const de = s.debtToEquity;
  const debt = de == null ? null : de < 0.2 ? "Very little debt" : de < 0.5 ? "Low debt" : de < 1 ? "Some debt" : "High debt";
  const round = v => (Math.round(Math.abs(v)) === 0 ? "flat" : `${v > 0 ? "+" : "−"}${Math.round(Math.abs(v))}%`);
  const lines = [
    s.quality != null && `✅ Quality: ${Math.round(s.quality)}/100`,
    s.roe != null && `💰 Earns ₹${Math.round(s.roe)} per ₹100 of owners' money`,
    debt && `🏦 ${debt}`,
    s.pe > 0 && `🏷️ Price = ${Math.round(s.pe)} years of profit (P/E)`,
  ].filter(Boolean);
  const text = [
    `${name} ${when ?? "in numbers"}. From its filings:`,
    lines.join("\n"),
    q ? `Last quarter: sales ${round(q.salesYoY)}, profit ${round(q.profitYoY)} vs last year` : "",
    `${SITE}/stock/${encodeURIComponent(s.symbol)}`,
    `#${s.symbol.replace(/[^A-Za-z0-9]/g, "")} #IndianStockMarket`,
  ].filter(Boolean).join("\n\n");
  return { kind: "company", text, html: card({ eyebrow: `${s.sector ?? "Company"} · NSE: ${s.symbol}`, title: name, body, foot: "From its NSE filings" }) };
}

// ── draw and write ─────────────────────────────────────────────────────────
const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const out = opt("out", `/tmp/jocular-x/${today}`);
mkdirSync(out, { recursive: true });
const posts = [];
for (const kind of only) {
  const p = await ({ market, results, company: () => company(opt("symbol", null)) })[kind]?.().catch(e => { console.error(`${kind}: ${e.message}`); return null; });
  if (p) posts.push(p);
}
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 675 } });
for (const p of posts) {
  await page.setContent(p.html, { waitUntil: "load" });
  p.image = join(out, `${p.kind}.png`);
  await page.screenshot({ path: p.image });
  delete p.html;
  p.chars = xlen(p.text);
  if (p.chars > 280) console.error(`${p.kind}: ${p.chars} characters as X counts them (X allows 280)`);
}
await browser.close();
writeFileSync(join(out, "posts.json"), JSON.stringify(posts, null, 2));
console.log(JSON.stringify(posts.map(p => ({ kind: p.kind, image: p.image, chars: p.chars })), null, 2));
