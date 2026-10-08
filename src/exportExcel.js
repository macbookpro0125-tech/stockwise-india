// Excel export for the Discover results. Four sheets:
//  - Categorized: the screen's companies grouped into buckets by data rules
//    (core compounder, high-growth, value play, steady, speculative, not
//    rated), each row with its scores, risk tier, distance from Phase 1,
//    price levels and flags — the layout of the categorized workbook Salman
//    brought (9 Oct 2026), in the app's own wording: "Price position", never
//    "buy status";
//  - How to read: the bucket rules and what each column means;
//  - Dashboard: summary formulas over the Stocks sheet, the ten closest to
//    their Phase 1 level, the quality spread (ported from stock-screener);
//  - Stocks: every row, with filter dropdowns.
// The library is about 1 MB, so it loads on the first click, not with the page.
import { pricePosition } from "../server/levels.js";

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

export function buildDiscoverWorkbook(XLSX, stocks, { pricesDate, extraColumns = [], screen = "", sortLabel = "" } = {}) {
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
  XLSX.utils.book_append_sheet(wb, buildCategorizedSheet(XLSX, stocks, { pricesDate, asOf, screen, sortLabel }), "Categorized");
  XLSX.utils.book_append_sheet(wb, buildGuideSheet(XLSX, { n, asOf, screen, sortLabel }), "How to read");
  XLSX.utils.book_append_sheet(wb, wsD, "Dashboard");
  XLSX.utils.book_append_sheet(wb, wsS, "Stocks");
  return wb;
}

// ── Categorized ──

const NAVY = "1F3864", HEAD_BLUE = "2E5496", ZEBRA = "F3F6FB", GRID = "D9D9D9";
const thin = { style: "thin", color: { rgb: GRID } };
const box = { top: thin, bottom: thin, left: thin, right: thin };
const body = { font: { sz: 8.5 }, border: box, alignment: { vertical: "center" } };

// Buckets, in the order the sheet lists them; the first rule a company meets
// decides (speculative is checked before growth and value). Rules are on the
// How to read sheet.
export const BUCKETS = [
  { id: "core", title: "CORE COMPOUNDER", rgb: "1F6E3C" },
  { id: "growth", title: "HIGH-GROWTH", rgb: "1F4E79" },
  { id: "value", title: "VALUE PLAY", rgb: "7A5C00" },
  { id: "steady", title: "STEADY / MID-QUALITY", rgb: "595959" },
  { id: "weak", title: "LOW QUALITY — UNDER 50", rgb: "8A6D3B" },
  { id: "speculative", title: "SPECULATIVE / HIGH-RISK", rgb: "8B2E2E" },
  { id: "unrated", title: "NOT RATED — TOO FEW FILINGS", rgb: "7F7F7F" },
];
const vsP1 = s => (s.cmp > 0 && s.safeBuyPrice > 0 ? ((s.cmp - s.safeBuyPrice) / s.safeBuyPrice) * 100 : null);
export function bucketOf(s) {
  const q = quality(s), r = s.research ?? {}, growth = s.salesGrowth3y, gap = vsP1(s);
  if (q == null) return "unrated";
  // Elevated or High risk on the app's own bands (research.js riskLabel).
  // The workbook this copies drew the line at 33, fine for a hand-picked top
  // 30; across the market the median risk score is 37, so 33 called most
  // companies speculative
  if ((r.risk ?? 0) >= 50 || (growth ?? 0) > 100) return "speculative";
  // A weak business isn't a growth or value pick, however it screens
  if (q < 50) return "weak";
  if ((growth ?? 0) >= 20) return "growth";
  if ((s.pe > 0 && s.pe <= 13) || ((r.valuation ?? 0) >= 80 && gap != null && gap <= -15)) return "value";
  return q >= 70 ? "core" : "steady";
}
// The research score's own risk bands, as the company page shows them
export const riskTier = risk => (risk == null ? null : risk >= 75 ? "High" : risk >= 50 ? "Elevated" : risk >= 25 ? "Moderate" : "Low");
const TIER_FILL = { Low: "C8E6C9", Moderate: "FFF2CC", Elevated: "F8CBAD", High: "F4B6B6" };
const TONE_FONT = { green: { bold: true, color: { rgb: "1F6E3C" } }, yellow: { bold: true, color: { rgb: "7A5C00" } }, red: { bold: true, color: { rgb: "9C2A2A" } } };
function flagsOf(s) {
  const f = [];
  if (s.marketCapCr != null && s.marketCapCr < 1500) f.push("Microcap");
  if (s.research?.flags?.includes("auditQualified")) f.push("Audit qualified");
  if (s.research?.flags?.includes("auditorResigned")) f.push("Auditor resigned");
  if (s.epsJump) f.push("One-off profit");
  return f.join(" · ") || null;
}

const CAT_COLUMNS = [
  { h: "Rank", w: 6, get: (s, i) => i + 1, center: true },
  { h: "Company", w: 34, get: s => s.name, bold: true },
  { h: "Ticker", w: 12, get: s => s.symbol },
  { h: "Sector", w: 18, get: s => s.sector },
  { h: "Research", w: 8, get: s => s.research?.overall ?? null, z: "0.0", center: true },
  { h: "Quality", w: 8, get: quality, z: "0.0", center: true },
  { h: "Val", w: 7, get: s => s.research?.valuation ?? null, z: "0.0", center: true },
  { h: "Risk", w: 7, get: s => s.research?.risk ?? null, z: "0.0", center: true },
  { h: "Risk tier", w: 9, get: s => riskTier(s.research?.risk), center: true, fill: v => TIER_FILL[v] },
  { h: "3Y Sales Gr%", w: 10, get: s => s.salesGrowth3y, z: "0.0", center: true },
  { h: "ROCE%", w: 8, get: s => s.roce, z: "0.0", center: true },
  { h: "ROE%", w: 8, get: s => s.roe, z: "0.0", center: true },
  { h: "D/E", w: 7, get: s => s.debtToEquity, z: "0.00", center: true },
  { h: "P/E", w: 7, get: s => s.pe, z: "0.0", center: true },
  { h: "% vs P1", w: 9, get: vsP1, z: "0.0", center: true, fill: v => (v == null ? null : v <= 0 ? "C8E6C9" : "FCE4E4") },
  { h: "Price position", w: 24, get: s => pricePosition(s.cmp, { p1: s.safeBuyPrice, p2: s.p2, p3: s.p3, stopLoss: s.stopLoss, target: s.target, fv25: s.fv25 }), position: true },
  { h: "CMP", w: 9, get: s => s.cmp, z: "#,##0.00", center: true },
  { h: "P1", w: 9, get: s => s.safeBuyPrice, z: "#,##0", center: true },
  { h: "P2", w: 9, get: s => s.p2, z: "#,##0", center: true },
  { h: "P3", w: 9, get: s => s.p3, z: "#,##0", center: true },
  { h: "FairVal 2Y", w: 10, get: s => s.fairValue, z: "#,##0", center: true },
  { h: "MktCap Cr", w: 11, get: s => s.marketCapCr, z: "#,##0", center: true },
  { h: "Piotr.", w: 7, get: s => s.values?.piotroski ?? s.piotroski ?? null, z: "0", center: true },
  { h: "Prom%", w: 8, get: s => s.promoterPct, z: "0.0", center: true },
  { h: "Flags", w: 18, get: flagsOf },
  { h: "NSE link", w: 9, get: s => nseUrl(s.symbol), link: true, center: true },
];

export function buildCategorizedSheet(XLSX, stocks, { asOf, screen, sortLabel } = {}) {
  const width = CAT_COLUMNS.length, lastCol = width - 1;
  const ranked = stocks.map((s, i) => ({ s, rank: i + 1, bucket: bucketOf(s) }));
  const aoa = [], styles = [], merges = [], heights = [];
  const fullRow = (text, style, hpt) => {
    const r = aoa.length;
    aoa.push([text, ...Array(lastCol).fill("")]);
    styles.push(Array(width).fill(style));
    merges.push({ s: { r, c: 0 }, e: { r, c: lastCol } });
    if (hpt) heights[r] = { hpt };
  };

  fullRow(`STOCKWISE INDIA — ${stocks.length.toLocaleString("en-IN")} ${stocks.length === 1 ? "COMPANY" : "COMPANIES"}, CATEGORIZED`,
    { font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: NAVY } }, alignment: { vertical: "center", indent: 1 } }, 26);
  fullRow(`Your Discover screen${screen ? ` (${screen})` : " (the whole market)"} · ${asOf} · grouped by bucket, then in the order you sorted${sortLabel ? ` (${sortLabel})` : ""}. "% vs P1" under 0 = below the Phase 1 level. Educational use only — not investment advice.`,
    { font: { sz: 9, color: { rgb: "555555" } }, alignment: { vertical: "center", wrapText: true } }, 28);
  aoa.push([]); styles.push([]);
  const headerRow = aoa.length;
  aoa.push(CAT_COLUMNS.map(c => c.h));
  styles.push(CAT_COLUMNS.map(() => ({ font: { bold: true, sz: 8.5, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: HEAD_BLUE } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: box })));
  heights[headerRow] = { hpt: 28 };
  const links = [];

  for (const b of BUCKETS) {
    const members = ranked.filter(x => x.bucket === b.id);
    if (!members.length) continue;
    fullRow(`  ${b.title}   (${members.length} ${members.length === 1 ? "stock" : "stocks"})`,
      { font: { bold: true, sz: 10.5, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: b.rgb } }, alignment: { vertical: "center" } }, 20);
    members.forEach(({ s, rank }, k) => {
      const r = aoa.length, zebra = k % 2 === 1;
      const row = [], rowStyles = [];
      CAT_COLUMNS.forEach((col, c) => {
        let v = col.get(s, rank - 1);
        let style = { ...body, ...(zebra && { fill: { fgColor: { rgb: ZEBRA } } }), ...(col.center && { alignment: { horizontal: "center", vertical: "center" } }) };
        if (col.bold) style.font = { ...body.font, bold: true };
        if (col.position) {
          style.font = { ...body.font, ...(TONE_FONT[v?.tone] ?? {}) };
          v = v?.label ?? null;
        }
        if (col.fill && v != null && col.fill(v)) style.fill = { fgColor: { rgb: col.fill(v) } };
        if (col.link) {
          links.push({ r, c, url: v });
          v = "NSE";
          style.font = { ...body.font, color: { rgb: "0563C1" }, underline: true };
        }
        if (typeof v === "number") v = round2(v);
        row.push(v ?? null);
        rowStyles.push({ style, z: typeof v === "number" ? col.z : null });
      });
      aoa.push(row);
      styles.push(rowStyles);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  styles.forEach((rowStyles, r) => rowStyles.forEach((st, c) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (!ws[addr]) ws[addr] = { t: "s", v: "" };
    const style = st?.style ?? st;
    // Calibri named outright, as Excel's own default is — unnamed, some
    // viewers fall back to a serif
    if (style) ws[addr].s = { ...style, font: { name: "Calibri", ...style.font } };
    if (st?.z) ws[addr].z = st.z;
  }));
  for (const { r, c, url } of links) ws[XLSX.utils.encode_cell({ r, c })].l = { Target: url, Tooltip: "Open on NSE" };
  ws["!merges"] = merges;
  ws["!cols"] = CAT_COLUMNS.map(c => ({ wch: c.w }));
  ws["!rows"] = Array.from({ length: aoa.length }, (_, r) => heights[r] ?? {});
  return ws;
}

// ── How to read ──

export function buildGuideSheet(XLSX, { n, asOf, screen, sortLabel } = {}) {
  const rows = [
    ["HOW THIS LIST WAS BUILT"],
    ["1. Universe", `Your Discover screen${screen ? `: ${screen}` : ": the whole market"} — ${n.toLocaleString("en-IN")} companies, ${asOf}.`],
    ["2. Order", `Grouped by bucket; within each, the order you sorted by on screen${sortLabel ? ` (${sortLabel})` : ""}. Rank = the position in that order.`],
    ["3. Buckets", "Assigned by data rules, not by hand — the first rule a company meets, in this order:"],
    ["   • Not rated", "Too few years of filings for a quality score."],
    ["   • Speculative / high-risk", "Risk score 50 or more (Elevated or High), or 3-year sales growth over 100% (often a small base or a one-off). Size positions small."],
    ["   • Low quality", "Quality under 50 — a weak business on its filings, whatever its growth or price."],
    ["   • High-growth", "3-year sales growth of 20% a year or more."],
    ["   • Value play", "P/E of 13 or under, or a valuation score of 80+ with the price 15% or more under the Phase 1 level."],
    ["   • Core compounder", "Quality 70 or more and none of the above — steady, established businesses."],
    ["   • Steady / mid-quality", "Quality 50–69 and none of the above."],
    ["4. Flags", "Microcap = market cap under ₹1,500 Cr (thin trading, higher risk whatever the score). Audit qualified / Auditor resigned = from the company's NSE filings. One-off profit = a profit jump the price levels value at the usual level."],
    [],
    ["COLUMN NOTES"],
    ["Research", "Overall research score out of 100: quality and valuation blended, trimmed for price swings and data gaps."],
    ["Quality", "Out of 100 across business, earnings, balance sheet, governance, growth and valuation, from NSE filings."],
    ["Val", "Valuation score out of 100 — higher means cheaper against the company's own history, sector peers and cash flow."],
    ["Risk / Risk tier", "Risk score out of 100, higher = riskier — price swings, thin trading and gaps in the data. Tier, as on the company page: Low under 25, Moderate 25–49, Elevated 50–74, High 75+."],
    ["% vs P1", "Price against the Phase 1 level. Under 0 (green) = already below it."],
    ["Price position", "Where the price sits against the levels: the Phase 1, 2 or 3 zone, above Phase 1, the stop-loss or the upper level. It describes the price — it is not a buy or sell instruction."],
    ["P1 / P2 / P3", "P1 = EPS × the stock's median P/E, less a 10% margin of safety. P2 = P1 × 0.9. P3 = P1 × 0.8."],
    ["FairVal 2Y", "EPS grown for two years × the median P/E. An estimate from reported figures, not a price target."],
    ["Piotr.", "Piotroski score out of 9 — 7 or more is strong. Not scored for banks and other lenders."],
    [],
    ["CAVEAT", "A score is a screen, not a buy order. Check the latest results and filings on NSE, keep speculative and microcap names small, and spread across buckets rather than loading one."],
    ["", "Educational use only. Not investment advice. Consult a SEBI-registered adviser."],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  rows.forEach((row, r) => row.forEach((v, c) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (!ws[addr]) return;
    const heading = c === 0 && row.length === 1;
    const label = c === 0 && row.length > 1 && !!v && !String(v).startsWith("   ");
    ws[addr].s = { font: { name: "Calibri", sz: 10, bold: heading || label, ...(heading && { color: { rgb: NAVY } }) }, alignment: { vertical: "top", wrapText: c === 1 } };
  }));
  ws["!cols"] = [{ wch: 24 }, { wch: 100 }];
  return ws;
}

// Freezes the header rows: the library writes no panes, so they go into the
// finished file's sheet XML (rows above `topRow` stay put while scrolling)
function freezeRows(XLSX, bytes, frozen) {
  const zip = XLSX.CFB.read(new Uint8Array(bytes), { type: "array" });
  for (const [sheet, rows] of Object.entries(frozen)) {
    const i = zip.FullPaths.findIndex(p => p.endsWith(`xl/worksheets/sheet${sheet}.xml`));
    if (i < 0) continue;
    const file = zip.FileIndex[i];
    const xml = new TextDecoder().decode(file.content);
    const pane = `<sheetView workbookViewId="0"><pane ySplit="${rows}" topLeftCell="A${rows + 1}" activePane="bottomLeft" state="frozen"/></sheetView>`;
    file.content = new TextEncoder().encode(xml.replace(/<sheetView workbookViewId="0"\/>/, pane));
  }
  return XLSX.CFB.write(zip, { type: "array", fileType: "zip", compression: true });
}

export function writeDiscoverWorkbook(XLSX, stocks, meta) {
  const bytes = XLSX.write(buildDiscoverWorkbook(XLSX, stocks, meta), { type: "array", bookType: "xlsx" });
  // Categorized (sheet 1): title, note, gap and headers; Stocks (sheet 4): headers
  return freezeRows(XLSX, bytes, { 1: 4, 4: 1 });
}

export async function exportDiscoverExcel(stocks, meta) {
  const XLSX = (await import("xlsx-js-style")).default;
  const blob = new Blob([writeDiscoverWorkbook(XLSX, stocks, meta)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `stockwise-india-discover${meta?.pricesDate ? `-${meta.pricesDate}` : ""}.xlsx` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
