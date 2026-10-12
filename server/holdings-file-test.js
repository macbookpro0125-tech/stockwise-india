// Broker files read the way the browser reads them (src/holdingsFile.js):
// Kite's CSV, Groww's Excel with title rows above the table and name + ISIN
// instead of symbols, Zerodha Console's Excel with an equity and a fund
// sheet. The files are made here, with made-up holdings.
import assert from "node:assert/strict";
import XLSXmod from "xlsx-js-style";
import { readHoldingsFile } from "../src/holdingsFile.js";

const XLSX = XLSXmod.default ?? XLSXmod;
const xlsx = (sheets, name) => {
  const book = XLSX.utils.book_new();
  for (const [sheet, rows] of sheets) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), sheet);
  return new File([XLSX.write(book, { type: "array", bookType: "xlsx" })], name);
};

const kite = await readHoldingsFile(new File([`"Instrument","Qty.","Avg. cost","LTP","Cur. val","P&L","Net chg.","Day chg."
"TCS",10,2950.40,2156.00,21560.00,-7944.00,-26.92,3.85
"INFY",5,1500.00,1023.40,5117.00,-2383.00,-31.77,2.65
`], "holdings.csv"));
assert.deepEqual(kite.rows.map(r => [r.symbol, Number(r.qty), Number(r.avgPrice)]), [["TCS", 10, 2950.4], ["INFY", 5, 1500]]);
assert.deepEqual(kite.used, { symbol: "Instrument", qty: "Qty.", avgPrice: "Avg. cost" });
console.log("ok: Kite's CSV — Instrument, Qty., Avg. cost");

const groww = await readHoldingsFile(xlsx([["Holdings", [["Holdings statement"], ["Client: XXXX"], [],
  ["Stock Name", "ISIN", "Quantity", "Average buy price", "Buy value", "Closing price", "Closing value", "Unrealised P&L"],
  ["HDFC BANK LTD", "INE040A01034", 20, 1600, 32000, 707.25, 14145, -17855],
  ["MAHINDRA & MAHINDRA LTD", "INE101A01026", 3, 2800, 8400, 3200, 9600, 1200],
  ["Total", "", "", "", 40400, "", 23745, -16655]]]], "groww.xlsx"));
assert.deepEqual(groww.rows.map(r => [r.name, r.isin, r.qty]), [["HDFC BANK LTD", "INE040A01034", 20], ["MAHINDRA & MAHINDRA LTD", "INE101A01026", 3]]);
console.log("ok: Groww's Excel — the table found under its title rows, the Total row dropped, name and ISIN kept");

const zerodha = await readHoldingsFile(xlsx([
  ["Equity", [["Holdings Statement as on 2026-10-09"], [],
    ["Symbol", "ISIN", "Sector", "Quantity Available", "Quantity Discrepant", "Quantity Long Term", "Average Price", "Previous Closing Price"],
    ["NESTLEIND", "INE239A01024", "FMCG", 2, 0, 2, 2400, 1333], ["SBIN", "INE062A01020", "Banks", 15, 0, 15, "820.55", "959.10"]]],
  ["Mutual Funds", [["Symbol", "ISIN", "Quantity Available", "Average Price"], ["PARAG PARIKH FLEXI CAP", "INF879O01027", 100, 50]]],
], "console.xlsx"));
assert.equal(zerodha.sheetName, "Equity");
assert.deepEqual(zerodha.rows.map(r => [r.symbol, r.qty, String(r.avgPrice)]), [["NESTLEIND", 2, "2400"], ["SBIN", 15, "820.55"]]);
assert.equal(zerodha.used.qty, "Quantity Available");
console.log("ok: Zerodha Console's Excel — the equity sheet, Quantity Available and Average Price");

assert.equal(await readHoldingsFile(new File(["Date,Narration,Amount\n2026-10-01,Salary,50000\n"], "bank.csv")), null);
console.log("ok: a file with no holdings table is turned away, not guessed at");
console.log("All holdings-file checks passed.");
