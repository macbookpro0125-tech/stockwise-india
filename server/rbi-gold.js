// The price of a gram of gold, from RBI (20 Nov 2026, the owner: show which
// carat, for how many grams). When a Sovereign Gold Bond series can be
// redeemed, RBI announces the price per gram (one unit) it pays: the average
// of the closing price of 999-purity (24 carat) gold on the three business
// days before, as published by IBJA. RBI's notices are read from its press
// releases (its RSS feed, and the pages it links), credited to RBI with
// their dates. Several a month; kept in data/cache/rbi-gold.json.
import { fetchText } from "./upstream.js";
import { cached } from "./company-extras.js";
import { readCache, writeCache } from "./cache-dir.js";

const UA = "Mozilla/5.0 (compatible; JocularInsights/1.0)";
const FEED = "https://www.rbi.org.in/pressreleases_rss.xml";
const PAGE = prid => `https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=${prid}`;
const FILE = "rbi-gold.json";
const MON = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const dateOf = s => { const m = /([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(\d{4})/.exec(s ?? ""); const mo = m && MON[m[1].toLowerCase()]; return mo ? iso(m[3], mo, m[2]) : null; };
const plain = html => String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<!\[CDATA\[|\]\]>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#8377;/g, "₹").replace(/&amp;/g, "&").replace(/\s+/g, " ");

// A premature-redemption (or final redemption) notice → { price, redeemOn,
// series, issued }, or null when it isn't one or the figure isn't there
export function parseSgbNotice(text, { prid = null } = {}) {
  const t = plain(text);
  if (!/Sovereign Gold Bond/i.test(t) || !/redemption price/i.test(t)) return null;
  const m = /redemption price[^₹]{0,160}?(?:shall be|will be|is)\s*(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)/i.exec(t);
  const price = m ? Number(m[1].replace(/,/g, "")) : null;
  if (!(price > 1000 && price < 100000)) return null;
  const due = /due on ([A-Za-z]+ \d{1,2}, \d{4})/i.exec(t)?.[1] ?? /redemption due on ([A-Za-z]+ \d{1,2}, \d{4})/i.exec(t)?.[1];
  const issued = /Date\s*:\s*([A-Za-z]{3}\.? \d{1,2}, \d{4})/.exec(t)?.[1];
  const series = /(SGB \d{4}-\d{2} Series [IVXL]+)/i.exec(t)?.[1] ?? null;
  return { price, redeemOn: dateOf(due), issued: dateOf(issued), series, prid };
}

// The feed's items: { title, prid, text }
export function feedItems(xml) {
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => ({
    title: plain(/<title>([\s\S]*?)<\/title>/.exec(it)?.[1] ?? "").trim(),
    prid: Number(/prid=(\d+)/.exec(it)?.[1]) || null,
    text: /<description>([\s\S]*?)<\/description>/.exec(it)?.[1] ?? "",
  }));
}

const get = url => fetchText(url, { headers: { "User-Agent": UA }, service: "RBI", maxBytes: 3e6, timeoutMs: 20_000 });

// RBI's gold prices, newest first: [{ price, redeemOn, issued, series, prid }]
export function rbiGoldPrices() {
  return cached("rbi-gold", 6 * 3600_000, async () => {
    const kept = readCache(FILE, []);
    const seen = new Set(kept.map(k => k.prid));
    const found = [];
    const items = feedItems(await get(FEED));
    for (const it of items) {
      if (!it.prid || seen.has(it.prid) || !/gold bond|SGB/i.test(it.title)) continue;
      const n = parseSgbNotice(`${it.title} ${it.text}`, { prid: it.prid }) ?? parseSgbNotice(await get(PAGE(it.prid)).catch(() => ""), { prid: it.prid });
      if (n) { found.push(n); seen.add(it.prid); }
    }
    // the first time, the notices of the last few weeks: the press releases
    // before the newest one in the feed, one at a time
    if (!kept.length) {
      const top = Math.max(0, ...items.map(i => i.prid ?? 0));
      for (let prid = top - 1; prid > top - 60 && found.length < 6; prid--) {
        if (seen.has(prid)) continue;
        const n = parseSgbNotice(await get(PAGE(prid)).catch(() => ""), { prid });
        if (n) { found.push(n); seen.add(prid); }
        await new Promise(r => setTimeout(r, 250));
      }
    }
    const all = [...kept, ...found].filter(n => n.redeemOn).sort((a, b) => b.redeemOn.localeCompare(a.redeemOn) || b.prid - a.prid).slice(0, 60);
    if (found.length) writeCache(FILE, all);
    return all;
  });
}

// Purity of each carat (BIS hallmark grades), and the amounts shown
export const CARATS = [["24K", "999", 0.999], ["22K", "916", 0.916], ["18K", "750", 0.75]];
export const GRAMS = [1, 8, 10, 100];

// RBI's 999 price per gram → each carat's price for each amount, scaled from
// 999 by purity: { "24K": { 1: …, 8: …, 10: …, 100: … }, … }
export function caratTable(price999) {
  return Object.fromEntries(CARATS.map(([k, , purity]) => [k, Object.fromEntries(GRAMS.map(g => [g, (price999 / 0.999) * purity * g]))]));
}
