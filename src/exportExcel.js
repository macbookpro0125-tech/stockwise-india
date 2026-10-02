// Excel export for the Discover results, ported from stock-screener's
// ResultsTable exportExcel. Two sheets: a Dashboard (summary formulas over the
// Stocks sheet, the ten stocks closest to their Phase 1 level, the quality
// score's spread and price-level counts) and Stocks (every row, with filter
// dropdowns). The
// library is about 1 MB, so it loads on the first click, not with the page.

const ACCENT = "00B89C", DARK = "1A1A2E", LIGHT = "F2F7F6", GREEN = "C6EFCE", YELLOW = "FFEB9C", RED = "FFC7CE";
const sTitle = { font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: DARK } }, alignment: { vertical: "center" } };
const sSub = { font: { sz: 10, color: { rgb: "666666" } } };
const sSection = { font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: ACCENT } } };
const sLabel = { font: { sz: 11 }, fill: { fgColor: { rgb: LIGHT } } };
const sValue = { font: { bold: true, sz: 11 }, alignment: { horizontal: "right" } };
const sHeader = { font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: DARK } }, alignment: { horizontal: "center" } };
const sLink = { font: { color: { rgb: "0563C1" }, underline: true } };
const fill = rgb => ({ fgColor: { rgb } });
// Quality out of 100, coloured as on screen: 70+ green, 50–69 amber, under 50 red
const qualityFill = q => (q == null ? LIGHT : q >= 70 ? GREEN : q >= 50 ? YELLOW : RED);
const quality = s => s.research?.quality ?? null;
const round2 = v => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const nseUrl = symbol => `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`;

const COLUMNS = [
  { h: "Rank", w: 5, get: (s, i) => i + 1 },
  { h: "Name", w: 30, get: s => s.name },
  { h: "Symbol", w: 12, get: s => s.symbol },
  { h: "Sector", w: 24, get: s => s.sector },
  { h: "Quality", w: 8, get: quality, z: "0" },
  { h: "Research", w: 9, get: s => s.research?.overall ?? null, z: "0" },
  { h: "Research stance", w: 16, get: s => s.research?.stance ?? null },
  { h: "Valuation", w: 9, get: s => s.research?.valuation ?? null, z: "0" },
  { h: "Risk", w: 6, get: s => s.research?.risk ?? null, z: "0" },
  { h: "CMP", w: 10, get: s => s.cmp, z: "#,##0.00" },
  { h: "P/E", w: 7, get: s => s.pe, z: "0.0" },
  { h: "ROCE %", w: 8, get: s => s.roce, z: "0.0" },
  { h: "ROE %", w: 8, get: s => s.roe, z: "0.0" },
  { h: "OPM %", w: 8, get: s => s.opm, z: "0.0" },
  { h: "Promoter %", w: 10, get: s => s.promoterPct, z: "0.0" },
  { h: "FII %", w: 7, get: s => s.fiiPct, z: "0.0" },
  { h: "DII %", w: 7, get: s => s.diiPct, z: "0.0" },
  { h: "Mkt Cap (Cr)", w: 12, get: s => s.marketCapCr, z: "#,##0" },
  { h: "Div Yield %", w: 10, get: s => s.divYield, z: "0.00" },
  { h: "EPS", w: 9, get: s => s.eps, z: "0.00" },
  { h: "Fair Value (2Y)", w: 13, get: s => s.fairValue, z: "#,##0" },
  { h: "P1", w: 9, get: s => s.safeBuyPrice, z: "#,##0" },
  { h: "P2", w: 9, get: s => s.p2, z: "#,##0" },
  { h: "P3", w: 9, get: s => s.p3, z: "#,##0" },
  { h: "52W Low", w: 9, get: s => s.low52w, z: "#,##0.00" },
  { h: "52W High", w: 9, get: s => s.high52w, z: "#,##0.00" },
  { h: "NSE", w: 46, get: s => nseUrl(s.symbol), link: true },
];

// Excel number formats for the screener's extra columns, from each metric's unit
const zFor = def => (def.unit === "₹ Cr" ? "#,##0" : def.unit === "₹" ? "#,##0.00" : def.decimals === 0 ? "0" : def.decimals >= 2 ? "0.00" : "0.0");

export function buildDiscoverWorkbook(XLSX, stocks, { pricesDate, extraColumns = [] } = {}) {
  const n = stocks.length;
  const last = n + 1; // data rows on the Stocks sheet: 2..last
  // Any columns added on the screen go in before the NSE link
  const COLS = [
    ...COLUMNS.slice(0, -1),
    ...extraColumns.map(def => ({ h: def.label, w: Math.min(Math.max(def.label.length + 2, 10), 26), get: s => s.values?.[def.id] ?? s[def.id] ?? null, z: zFor(def) })),
    COLUMNS.at(-1),
  ];
  const colIndex = h => COLS.findIndex(c => c.h === h);
  const range = h => { const L = XLSX.utils.encode_col(colIndex(h)); return `Stocks!${L}2:${L}${last}`; };
  const C = (v, s, z) => ({ v, t: typeof v === "number" ? "n" : "s", ...(s && { s }), ...(z && { z }) });
  const F = (f, s, z) => ({ t: "n", f, ...(s && { s }), ...(z && { z }) });

  // ── Stocks (built first so the dashboard can reference it) ──
  const rows = stocks.map((s, i) => COLS.map(c => {
    const v = c.get(s, i);
    return typeof v === "number" ? round2(v) : (v ?? null);
  }));
  const wsS = XLSX.utils.aoa_to_sheet([COLS.map(c => c.h), ...rows]);
  const cellAt = (r, c) => wsS[XLSX.utils.encode_cell({ r, c })];
  COLS.forEach((col, c) => {
    cellAt(0, c).s = sHeader;
    for (let r = 1; r <= n; r++) {
      const cell = cellAt(r, c);
      if (!cell) continue;
      if (col.z) cell.z = col.z;
      if (col.link) { cell.l = { Target: cell.v }; cell.s = sLink; }
    }
  });
  const QUALITY = colIndex("Quality"), CMP = colIndex("CMP"), P1 = colIndex("P1");
  rows.forEach((row, i) => {
    const q = cellAt(i + 1, QUALITY);
    if (q) q.s = { fill: fill(qualityFill(row[QUALITY])), alignment: { horizontal: "center" } };
    // At or under the Phase 1 level
    if (row[CMP] != null && row[P1] != null && row[CMP] <= row[P1]) {
      const cmp = cellAt(i + 1, CMP);
      if (cmp) cmp.s = { fill: fill(GREEN), font: { bold: true } };
    }
  });
  wsS["!cols"] = COLS.map(c => ({ wch: c.w }));
  wsS["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(COLS.length - 1)}${last}` };

  // ── Dashboard ──
  const withP1 = stocks
    .filter(s => s.cmp != null && s.safeBuyPrice)
    .map(s => ({ name: s.name, cmp: s.cmp, p1: s.safeBuyPrice, prem: ((s.cmp - s.safeBuyPrice) / s.safeBuyPrice) * 100, quality: quality(s) }));
  const inZone = withP1.filter(x => x.prem <= 0).length;
  const near = withP1.filter(x => x.prem > 0 && x.prem <= 10).length;
  const top10 = [...withP1].sort((a, b) => a.prem - b.prem).slice(0, 10);

  const grid = Array.from({ length: 26 }, () => Array(8).fill(null));
  const put = (r, c, cell) => { grid[r][c] = cell; };

  const asOf = pricesDate
    ? `prices as of ${new Date(`${pricesDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`
    : "NSE prices";
  put(0, 0, C("STOCK DISCOVERY — DASHBOARD", sTitle));
  put(1, 0, C(`Generated ${new Date().toLocaleString("en-IN")} · ${n} stocks · NSE filings, ${asOf} · sort & filter on the Stocks sheet`, sSub));

  // Left: market snapshot, quality spread, price levels
  put(3, 0, C("MARKET SNAPSHOT", sSection)); put(3, 1, C("", sSection));
  const summary = [
    ["Total stocks", F(`COUNTA(${range("Name")})`, sValue, "0")],
    ["Avg quality score (of 100)", F(`ROUND(AVERAGE(${range("Quality")}),1)`, sValue, "0.0")],
    ["Avg ROE %", F(`ROUND(AVERAGE(${range("ROE %")}),1)`, sValue, "0.0")],
    ["Avg ROCE %", F(`ROUND(AVERAGE(${range("ROCE %")}),1)`, sValue, "0.0")],
    ["Median P/E", F(`ROUND(MEDIAN(${range("P/E")}),1)`, sValue, "0.0")],
    ["Avg dividend yield %", F(`ROUND(AVERAGE(${range("Div Yield %")}),2)`, sValue, "0.00")],
  ];
  summary.forEach(([label, cell], i) => { put(4 + i, 0, C(label, sLabel)); put(4 + i, 1, cell); });

  put(11, 0, C("QUALITY DISTRIBUTION", sSection)); put(11, 1, C("", sSection));
  const qr = range("Quality");
  const spread = [
    ["Quality 80–100", GREEN, `COUNTIF(${qr},">=80")`],
    ["Quality 70–79", GREEN, `COUNTIFS(${qr},">=70",${qr},"<80")`],
    ["Quality 50–69", YELLOW, `COUNTIFS(${qr},">=50",${qr},"<70")`],
    ["Quality under 50", RED, `COUNTIF(${qr},"<50")`],
    ["Not rated (too little data)", LIGHT, `COUNTBLANK(${qr})`],
  ];
  spread.forEach(([label, rgb, f], i) => { put(12 + i, 0, C(label, { ...sLabel, fill: fill(rgb) })); put(12 + i, 1, F(f, sValue, "0")); });

  put(18, 0, C("PRICE LEVELS", sSection)); put(18, 1, C("", sSection));
  put(19, 0, C("At or under Phase 1 (CMP ≤ P1)", sLabel)); put(19, 1, C(inZone, { ...sValue, fill: fill(inZone > 0 ? GREEN : LIGHT) }));
  put(20, 0, C("Within 10% above P1", sLabel)); put(20, 1, C(near, sValue));
  put(21, 0, C("Stocks with price levels", sLabel)); put(21, 1, C(withP1.length, sValue));

  put(23, 0, C("P1 = EPS × median P/E, less a 10% margin of safety · P2 = P1 × 0.9 · P3 = P1 × 0.8 · Fair value (2Y) = EPS × (1 + growth)² × median P/E, growth = 5-yr profit CAGR held to 0–25%", sSub));
  put(24, 0, C("When a stock trades at under a third of its median P/E: EPS over 3× its usual level is a one-off, valued at the usual EPS; otherwise years with under a third of this year's EPS leave the median", sSub));
  put(25, 0, C("Quality = research score out of 100 over six groups, checks the filings can't show left out · Research = quality and valuation blended, trimmed for price swings and data gaps · Educational use only — not financial advice or a buy/sell recommendation", sSub));

  // Right: the ten closest to (or furthest under) their Phase 1 level
  put(3, 3, C("TOP 10 — CLOSEST TO PHASE 1", sSection));
  for (let c = 4; c <= 7; c++) put(3, c, C("", sSection));
  ["Name", "CMP", "P1", "% vs P1", "Quality"].forEach((h, i) => put(4, 3 + i, C(h, sHeader)));
  top10.forEach((t, i) => {
    const r = 5 + i;
    put(r, 3, C(t.name));
    put(r, 4, C(round2(t.cmp), null, "#,##0.00"));
    put(r, 5, C(t.p1, null, "#,##0"));
    put(r, 6, C(round2(t.prem), t.prem <= 0 ? { fill: fill(GREEN), font: { bold: true } } : null, "0.0"));
    if (t.quality != null) put(r, 7, C(Math.round(t.quality), { fill: fill(qualityFill(t.quality)), alignment: { horizontal: "center" } }));
  });

  const wsD = XLSX.utils.aoa_to_sheet(grid);
  wsD["!cols"] = [{ wch: 24 }, { wch: 10 }, { wch: 2 }, { wch: 30 }, { wch: 11 }, { wch: 10 }, { wch: 9 }, { wch: 7 }];
  wsD["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } }, { s: { r: 3, c: 3 }, e: { r: 3, c: 7 } },
    { s: { r: 11, c: 0 }, e: { r: 11, c: 1 } },
    { s: { r: 18, c: 0 }, e: { r: 18, c: 1 } },
  ];
  wsD["!rows"] = [{ hpt: 26 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsD, "Dashboard");
  XLSX.utils.book_append_sheet(wb, wsS, "Stocks");
  return wb;
}

export async function exportDiscoverExcel(stocks, meta) {
  const XLSX = (await import("xlsx-js-style")).default;
  XLSX.writeFile(buildDiscoverWorkbook(XLSX, stocks, meta), "stockwise-india-discover.xlsx");
}
