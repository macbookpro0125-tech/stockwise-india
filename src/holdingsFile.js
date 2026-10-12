// Reading a broker's holdings file (CSV or Excel) into rows of symbol,
// ISIN, name, quantity and average price — in the browser, for the
// Portfolio tab's import (ImportHoldingsModal.jsx). Kept apart from the
// dialog so it can be tested on its own.

// Header names as brokers write them, compared without case, spaces or
// punctuation; the first that matches wins
const COLUMNS = {
  symbol: ["symbol", "tradingsymbol", "instrument", "stocksymbol", "nsesymbol", "ticker", "nsecode", "scrip"],
  isin: ["isin", "isincode", "isinno"],
  name: ["stockname", "companyname", "securityname", "scripname", "name", "stock", "company", "security"],
  qty: ["quantity", "qty", "totalquantity", "quantityavailable", "availablequantity", "netqty", "holdingqty", "holdingquantity", "totalqty", "balanceqty", "currentqty", "freeqty", "shares", "noofshares"],
  avgPrice: ["averageprice", "avgcost", "averagebuyprice", "avgprice", "avgbuyprice", "buyavg", "buyavgprice", "averagecost", "averagebuyingprice", "buyprice", "costprice", "avgtradeprice", "averagetradedprice", "avgrate"],
};
const norm = v => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Which cell of a row holds each field; null unless it has a quantity, an
// average price and something to identify the company by
function headerMap(row) {
  const cells = row.map(norm);
  const map = {};
  for (const [field, names] of Object.entries(COLUMNS)) {
    for (const n of names) {
      const i = cells.indexOf(n);
      if (i !== -1) { map[field] = i; break; }
    }
  }
  return map.qty != null && map.avgPrice != null && (map.symbol != null || map.isin != null || map.name != null) ? map : null;
}

// The first sheet with a holdings table: its rows and the columns used
export async function readHoldingsFile(file) {
  const XLSX = (await import("xlsx-js-style")).default;
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  for (const sheetName of book.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, raw: true, defval: "" });
    for (let h = 0; h < Math.min(grid.length, 40); h++) {
      const map = headerMap(grid[h]);
      if (!map) continue;
      const pick = (r, f) => (map[f] != null ? r[map[f]] : "");
      const rows = grid.slice(h + 1)
        .map(r => ({ symbol: String(pick(r, "symbol")).trim(), isin: String(pick(r, "isin")).trim(), name: String(pick(r, "name")).trim(), qty: pick(r, "qty"), avgPrice: pick(r, "avgPrice") }))
        // Blank lines and the "Total" row brokers end with
        .filter(r => (r.symbol || r.isin || r.name) && !/^(grand\s*)?total/i.test(r.symbol || r.name));
      // A sheet's name only means something when the file has several
      return { sheetName: book.SheetNames.length > 1 ? sheetName : null, rows, used: Object.fromEntries(Object.entries(map).map(([f, i]) => [f, String(grid[h][i]).trim()])) };
    }
  }
  return null;
}
