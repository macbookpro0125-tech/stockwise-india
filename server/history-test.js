// The price history further back (history-backfill.js), and from the bhavcopies on disk
// (market-data.js seedHistoryFromCache): node --no-warnings server/history-test.js
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "history-test-"));
const { daysToRead, backfillHistory } = await import("./history-backfill.js");
const { readHistory } = await import("./price-history.js");
const { seedHistoryFromCache } = await import("./market-data.js");

// the weekdays before the year the evening build reads, newest first, the done ones left out
const now = new Date("2026-10-24T12:00:00Z");
const all = daysToRead(3, new Set(), now);
assert.equal(all[0].toISOString().slice(0, 10), "2025-10-23", "a year and a day back, a Thursday");
assert.ok(all.every(d => d.getUTCDay() !== 0 && d.getUTCDay() !== 6), "weekdays only");
assert.ok(all.length > 500 && all.length < 530, `about two years of weekdays: ${all.length}`);
assert.equal(daysToRead(3, new Set(["2025-10-23"]), now)[0].toISOString().slice(0, 10), "2025-10-22");
assert.deepEqual(daysToRead(1, new Set(), now), [], "one year: the evening build has it");
console.log("ok: the days to read go back from a year ago, weekdays only, the done ones skipped");

// a bhavcopy as NSE writes it
const bhav = (date, rows) => `SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER\n`
  + rows.map(([s, o, h, l, c]) => `${s}, EQ, ${date}, ${c}, ${o}, ${h}, ${l}, ${c}, ${c}, ${c}, 1000, 1, 10, 500, 50.00`).join("\n");
// from the bhavcopies already on disk, once, when nothing is kept yet
mkdirSync(join(process.env.DATA_DIR, "prices"), { recursive: true });
writeFileSync(join(process.env.DATA_DIR, "prices", "bhav-2026-10-22.csv"), bhav("22-Oct-2026", [["TCS", 2500, 2550, 2490, 2530], ["WIPRO", 240, 245, 238, 244]]));
writeFileSync(join(process.env.DATA_DIR, "prices", "bhav-2026-10-23.csv"), bhav("23-Oct-2026", [["TCS", 2530, 2560, 2520, 2550]]));
assert.equal(await seedHistoryFromCache({ log: () => {} }), 2, "two companies from two files");
assert.deepEqual(readHistory("TCS").map(b => [b[0], b[4]]), [["2026-10-22", 2530], ["2026-10-23", 2550]]);
assert.equal(await seedHistoryFromCache({ log: () => {} }), 0, "only when nothing is kept yet");
console.log("ok: the history starts from the bhavcopies already on disk, once");

let asked = 0;
const fetchCsv = async d => {
  asked++;
  const day = d.toISOString().slice(0, 10);
  if (day === "2025-10-22") return null; // a holiday
  if (day === "2025-10-20") throw new Error("NSE refused");
  const nse = new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).replace(/ /g, "-");
  return bhav(nse, [["TCS", 3000, 3100, 2950, 3050], ["INFY", 1500, 1520, 1490, 1510]]);
};
// as run on 24 Oct 2026 (the days read count back from a year before "now")
const NOW = new Date("2026-10-24T12:00:00Z");
const r = await backfillHistory({ years: 3, maxDays: 4, pauseMs: 0, saveEvery: 2, log: () => {}, fetchCsv, now: NOW });
assert.equal(asked, 4);
assert.equal(r.read, 2, "two trading days read");
assert.equal(r.holidays, 1);
const tcs = readHistory("TCS");
assert.deepEqual(tcs.map(b => b[0]), ["2025-10-21", "2025-10-23", "2026-10-22", "2026-10-23"], "older days added before the kept ones");
assert.deepEqual(tcs[0].slice(1), [3000, 3100, 2950, 3050, 1000], "open, high, low, close, volume as published");
const done = JSON.parse(readFileSync(join(process.env.DATA_DIR, "history", ".backfilled.json"), "utf8"));
assert.ok(done.includes("2025-10-22") && !done.includes("2025-10-20"), "a holiday is done; a failed day is tried again");
// the next run carries on, the failed day first
asked = 0;
await backfillHistory({ years: 3, maxDays: 1, pauseMs: 0, log: () => {}, now: NOW, fetchCsv: async d => { asked++; assert.equal(d.toISOString().slice(0, 10), "2025-10-20"); return null; } });
assert.equal(asked, 1);
console.log("ok: older days added a batch at a time, kept as published; holidays noted, a refused day tried again next run");


// Before late 2019: NSE's older zipped file, a renamed company filed under its
// symbol today by its ISIN (legacy-bhavcopy.js, 20 Nov 2026)
{
  const { parseLegacyBhavcopy, unzipFirst, legacyUrl } = await import("./legacy-bhavcopy.js");
  const { deflateRawSync } = await import("node:zlib");
  const csvOld = "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,TOTTRDVAL,TIMESTAMP,TOTALTRADES,ISIN,\n"
    + "OLDNAME,EQ,100,110,95,105,105,99,5000,500000,14-MAY-2019,10,INE000X01011,\n"
    + "OLDNAME,BE,90,91,89,90,90,90,10,900,14-MAY-2019,1,INE000X01011,\n"
    + "OTHER,N1,50,50,50,50,50,50,1,50,14-MAY-2019,1,INE000Y01011,";
  const p = parseLegacyBhavcopy(csvOld, new Map([["INE000X01011", "NEWNAME"]]));
  assert.equal(p.date, "2019-05-14");
  assert.deepEqual(p.days.get("NEWNAME"), { rank: 0, open: 100, high: 110, low: 95, close: 105, volume: 5000 }, "EQ before BE, under today's symbol");
  assert.equal(p.days.has("OTHER"), false, "series other than equity left out");
  assert.equal(legacyUrl(new Date("2016-11-15T00:00:00Z")), "https://nsearchives.nseindia.com/content/historical/EQUITIES/2016/NOV/cm15NOV2016bhav.csv.zip");
  // a zip as NSE serves it: one deflated file, its sizes in the central directory
  const name = Buffer.from("cm14MAY2019bhav.csv"), raw = Buffer.from(csvOld), data = deflateRawSync(raw);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt16LE(name.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(raw.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(0, 42);
  const cdAt = 30 + name.length + data.length;
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(46 + name.length, 12); eocd.writeUInt32LE(cdAt, 16);
  assert.equal(unzipFirst(Buffer.concat([local, name, data, cd, name, eocd])), csvOld, "unzipped as written");

  // the backfill asks for the older file before late 2019, the current one after
  const asked = { old: [], current: 0 };
  const r = await backfillHistory({
    years: 2, maxDays: 3, pauseMs: 0, log: () => {}, now: new Date("2020-05-16T12:00:00Z"),
    isinToSymbol: new Map([["INE000X01011", "NEWNAME"]]),
    fetchCsv: async () => { asked.current++; return null; },
    fetchOld: async d => { asked.old.push(d.toISOString().slice(0, 10)); return d.toISOString().slice(0, 10) === "2019-05-14" ? csvOld : null; },
  });
  assert.equal(asked.current, 0, "no current-format file asked for before late 2019");
  assert.deepEqual(asked.old, ["2019-05-16", "2019-05-15", "2019-05-14"]);
  assert.equal(r.read, 1);
  assert.deepEqual(readHistory("NEWNAME").map(b => [b[0], b[4]]), [["2019-05-14", 105]]);
  console.log("ok: before late 2019 the older zipped file, a renamed company under today's symbol");
}
