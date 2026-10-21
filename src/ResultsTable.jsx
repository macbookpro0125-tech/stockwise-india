import { Fragment, Suspense, useState, useEffect, useRef } from "react";
import { lazyPage } from "./lazyPage.js";
import CompanyLogo from "./CompanyLogo.jsx";
import { cardName, splitUnit } from "./stockName.js";
import { ArrowDown, ArrowUp, Check, Info, Columns3, Search, ArrowUpRight, SearchX, Star, ChevronDown, Funnel, Download } from "lucide-react";
import { StarIcon, BellIcon, actionButtonStyle } from "./icons.jsx";
import { useWatchlist, toggleWatch } from "./watchlist.js";
import CreateAlertModal from "./CreateAlertModal.jsx";
import { AdCard, useAdFeed } from "./ads.jsx";
import { formatValue, valueColor, unitLabel } from "./screener/meta.js";
import { QualityBadge, OverallScore, qualityTone, overallTone, researchTitle, researchMissingText } from "./ResearchBadges.jsx";
import ResearchProfile from "./ResearchProfile.jsx";
import { MetricInfo, ColumnGuide } from "./screener/MetricInfo.jsx";
import ColumnMenu from "./screener/ColumnMenu.jsx";

// Ported from stock-screener's src/components/ResultsTable.jsx — same columns,
// price levels with 52-week range, NCAV badge, watchlist star, compare (up to
// 5), Excel and CSV export, sorting, filter box and paging. The original's
// score out of 10 is now the research score (server/research.js): quality out
// of 100 and the overall research score, with a minimum-quality filter.
// Every row arrives already scored, so there's no lazy enrichment.

const PAGE_SIZE = 50;
const PHONE_PAGE_SIZE = 20;
const PHONE_AD_EVERY = 10; // the store app: an ad card after every tenth row (ads.jsx)
const MAX_COMPARE = 5;
const CompareView = lazyPage(() => import("./CompareView.jsx"));
// Wide enough for the compare box and a four-digit rank; the name column is
// pinned right after it.
const RANK_W = 50;

// Column headers: sentence case at reading size; the sorted one darker, with
// its arrow (the others keep the arrow's room so headers don't shift)
const thStyle = {
  padding: "10px 6px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "var(--t2)",
  whiteSpace: "nowrap", userSelect: "none", borderBottom: "1px solid var(--bdr2)", background: "var(--s1)",
  position: "sticky", top: 0, zIndex: 3,
};
// Only the sorted column shows its arrow; the others don't keep room for one
// (twelve reserved arrows were most of a column's width)
const SortArrow = ({ active, dir }) => {
  if (!active) return null;
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
  return <Arrow size={12} strokeWidth={2.4} style={{ color: "var(--accent)", flexShrink: 0 }} />;
};
// A real button so a header can be reached and sorted from the keyboard; its
// click bubbles to the <th>'s onClick, so the mouse works as before
const sortBtnStyle = { display: "inline-flex", alignItems: "center", gap: 4, padding: 0, border: 0, background: "none", color: "inherit", font: "inherit", cursor: "pointer" };
const ariaSort = (active, dir) => (active ? (dir === "asc" ? "ascending" : "descending") : "none");

function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCr(n) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

const MONO = { fontVariantNumeric: "tabular-nums" };
// "Osia Hyper Retail Limited" -> "Osia Hyper Retail" in the table (the full
// name is the link's tooltip and on the company page)
const shortName = name => String(name ?? "").replace(/\s+(Limited|Ltd\.?)$/i, "");

const quality = s => s.research?.quality ?? null;

const MIN_QUALITY = [40, 50, 60, 70, 80];
const MIN_RESEARCH = [50, 60, 65, 70, 80];
const MIN_PIOTROSKI = [5, 6, 7, 8, 9];

const nseUrl = symbol => `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`;

// Export: one quiet button with its two formats in a small menu, rather than
// the page's brightest button
function ExportMenu({ onExcel, onCsv, busy }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const key = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [open]);
  const pick = fn => () => { setOpen(false); fn(); };
  return (
    <span ref={ref} className="export-menu hide-phone">
      <button type="button" className="btn-ghost tb-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)} disabled={busy}>
        <Download size={14} aria-hidden="true" /> {busy ? "Exporting…" : "Export"} <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <span role="menu" className="export-menu-list">
          <button type="button" role="menuitem" onClick={pick(onExcel)}>Excel workbook <em>.xlsx</em></button>
          <button type="button" role="menuitem" onClick={pick(onCsv)}>Spreadsheet text <em>.csv</em></button>
        </span>
      )}
    </span>
  );
}

// The ▾ beside a column's name: Excel's filter button. Opens ColumnMenu (sort
// either way; for a number column, at least / at most). A funnel replaces the
// arrow while the column is filtered, as in Excel.
function MenuButton({ label, menu }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const filtered = menu.filter && (menu.filter.min != null || menu.filter.max != null);
  const Icon = filtered ? Funnel : ChevronDown;
  return (
    <>
      <button ref={ref} type="button" aria-label={`${label}: sort${menu.def ? " and filter" : ""}${filtered ? " (filtered)" : ""}`} aria-haspopup="dialog" aria-expanded={open}
        title={filtered ? "Filtered — change or clear" : "Sort and filter"}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="column-menu-btn" data-on={filtered || open || undefined}>
        <Icon size={filtered ? 12 : 14} strokeWidth={2.2} aria-hidden="true" fill={filtered ? "currentColor" : "none"} />
      </button>
      {open && <ColumnMenu anchor={ref.current} label={label} text={menu.text} def={menu.def} about={menu.about} meta={menu.meta} filter={menu.filter} onSort={menu.onSort} onApply={menu.onApply} onClose={() => setOpen(false)} />}
    </>
  );
}

function SortTh({ label, unit = "", title, col, sortBy, sortDir, onSort, accent, info, menu }) {
  const active = sortBy === col;
  return (
    <th
      onClick={() => onSort(col)}
      aria-sort={ariaSort(active, sortDir)}
      title={title}
      style={{
        ...thStyle,
        whiteSpace: "nowrap", verticalAlign: "bottom",
        color: active ? "var(--t1)" : "var(--t2)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        background: accent ? "color-mix(in srgb, var(--accent) 3%, var(--s1))" : "var(--s1)",
        transition: "color 120ms",
      }}
    >
      {/* Every header the same shape: the name on one line with its ▾, the
          unit small beneath it (blank when there's none), so names and
          units line up across the row; the definition is in the ▾ menu */}
      <span className="th-head">
        <button type="button" style={{ ...sortBtnStyle, whiteSpace: "nowrap" }}>
          <span>{label}</span>
          <SortArrow active={active} dir={sortDir} />
        </button>
        {menu ? <MenuButton label={unit ? `${label} ${unit}` : label} menu={menu} /> : info}
      </span>
      <span className="th-unit" aria-hidden={!unit}>{unit || "\u00a0"}</span>
    </th>
  );
}

function NcavBadge({ stock }) {
  const ncav = stock.ncavCr, mcap = stock.marketCapCr;
  if (ncav == null || mcap == null || ncav <= 0 || mcap <= 0) return null;
  if (mcap >= ncav) return null; // not a net-net — don't clutter
  // Clamp to 99 so a razor-thin net-net (e.g. 99.9%) never rounds to 100%
  const pct = Math.min(99, Math.round((mcap / ncav) * 100));
  const graham = mcap <= ncav * (2 / 3); // Market Cap ≤ ⅔ NCAV = 33%+ margin
  return (
    <span
      title={`NCAV ₹${fmtCr(ncav)} Cr vs Mkt Cap ₹${fmtCr(mcap)} Cr — buying at ${pct}% of net current asset value${graham ? " · ≥33% Graham margin of safety" : ""}`}
      style={{
        fontSize: 10, padding: "1px 7px", borderRadius: 5, fontWeight: 500, ...MONO,
        border: `1px solid ${graham ? "var(--green-bdr)" : "var(--yellow-bdr)"}`,
        background: graham ? "var(--green-dim)" : "var(--yellow-dim)",
        color: graham ? "var(--green)" : "var(--yellow)",
      }}
    >
      {pct}% of NCAV
    </span>
  );
}

// 52-week range as a slim bar; the numbers are in the tooltip
function MiniRange({ low, high, cmp }) {
  if (!low || !high || !cmp || high <= low) return null;
  const pct = Math.min(96, Math.max(4, ((cmp - low) / (high - low)) * 100));
  const fromLow = Math.round(((cmp - low) / low) * 100);
  const belowHigh = Math.round(((high - cmp) / high) * 100);
  const title = `52-week low ₹${low.toLocaleString("en-IN")} · high ₹${high.toLocaleString("en-IN")} — ` +
    (cmp < low ? "below the 52-week low" : `${fromLow}% above the low`) + " · " +
    (cmp > high ? "above the 52-week high" : `${belowHigh}% below the high`);
  return (
    <span title={title} style={{ position: "relative", display: "inline-block", width: 56, height: 3, borderRadius: 99, background: "linear-gradient(to right, #FF453A 0%, #FFD60A 50%, #30D158 100%)", verticalAlign: "middle", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: "50%", left: `calc(${pct}% - 3.5px)`, transform: "translateY(-50%)", width: 7, height: 7, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.6)" }} />
    </span>
  );
}

// Price levels in two lines: the three phase levels (✓ once today's price
// reaches one), then the 52-week bar and the fair value. Notes about how the fair
// value was made sit behind a flag's tooltip.
function FvCell({ stock }) {
  const { cmp, safeBuyPrice: p1, p2, p3, fairValue } = stock;
  // How the levels were made (or why there are none) — the company page's
  // "Valued as", behind the flag's tooltip
  const v = stock.valuation;
  const notes = [
    v?.model === "book" && "A bank, valued on book: justified P/B × book less net bad loans.",
    v?.model === "cyclical" && `A cyclical, valued on mid-cycle earnings${v.positionLabel ? ` — this year's profits are ${v.positionLabel}` : ""}.`,
    v?.partialCycle && "A cyclical with under seven years of results, so still valued on this year's EPS.",
    v?.as === "re-rated compounder" && "A re-rated compounder: its P/E kept rising, so its usual P/E sits below the price. The company page leads with the growth its price implies.",
    v?.model === "earnings" && stock.epsJump && `This year's EPS (₹${stock.epsJump.eps.toFixed(2)}) is more than 3× its usual ₹${stock.epsJump.usualEps.toFixed(2)} and the share price hasn't followed — how a one-off gain looks. Price levels use the usual EPS.`,
    stock.valuationMultipleBasis && `Fair-value multiple: ${stock.valuationMultipleBasis}.`,
    stock.epsCorrection && `Annual EPS corrected from ₹${stock.epsCorrection.reportedEps.toFixed(2)} (one quarter's, as filed) to ₹${stock.epsCorrection.correctedEps.toFixed(2)} from profit and paid-up shares.`,
    !stock.epsCorrection && stock.epsMismatch && `The filed EPS (₹${stock.epsMismatch.reportedEps.toFixed(2)}) doesn't agree with profit ÷ shares (₹${stock.epsMismatch.correctedEps.toFixed(2)}); the filed figure is used — check the filing.`,
  ].filter(Boolean);
  const fvLabel = stock.fyEnd ? `FV${String(Number(stock.fyEnd.slice(0, 4)) + 2).slice(2)}` : "FV";
  return (
    <div style={{ fontSize: 11, lineHeight: 1.5, minWidth: 158, ...MONO }}>
      {p1 ? (
        <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
          {[["P1", p1], ["P2", p2], ["P3", p3]].map(([label, price]) => {
            const hit = cmp != null && price != null && cmp <= price;
            return (
              <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 2, color: hit ? "var(--accent)" : "var(--t3)", fontWeight: hit ? 600 : 500 }}>
                <span style={{ fontWeight: 500 }}>{label}</span>&nbsp;{price ? price.toLocaleString("en-IN") : "—"}{hit && <Check size={11} strokeWidth={3} style={{ color: "var(--green)" }} />}
              </span>
            );
          })}
        </div>
      ) : (
        <div style={{ color: "var(--t3)" }} title={[v?.as && `No fair value: ${v.as}.`, v?.reason].filter(Boolean).join(" ") || undefined}>{v?.model === "needs-data" ? "Needs more data" : v?.as ? "No fair value" : "No price levels"}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, color: "var(--t3)", fontSize: 10, whiteSpace: "nowrap" }}>
        <MiniRange low={stock.low52w} high={stock.high52w} cmp={cmp} />
        {fairValue ? <span>{fvLabel} {fairValue.toLocaleString("en-IN")}</span> : null}
        {notes.length > 0 && (
          <span title={`${notes.join(" ")} Open the stock to set your own figures.`} style={{ color: "var(--yellow)", cursor: "help", display: "inline-flex" }}><Info size={12} strokeWidth={2.2} /></span>
        )}
      </div>
    </div>
  );
}

function StarButton({ symbol, price, watched, size = 30 }) {
  return (
    <button
      onClick={() => toggleWatch(symbol, price)}
      title={watched ? "Remove from watchlist" : "Add to watchlist"}
      style={actionButtonStyle({ active: watched, activeColor: "var(--yellow)", size })}
    >
      <StarIcon filled={watched} />
    </button>
  );
}

export default function ResultsTable({ matches, loading, onAnalyze, totalMatches, hideCountOnPhone = false, universe = null, filters = null, onFiltersChange = null, phoneFilters = null, filtersButton = null, updating = false, queryUsed, unsupported = [], notes = [], executionTime, snapshot, netNet = false, noun = "stocks", emptyTitle = "No stocks matched your criteria", emptyHint = "Try relaxing some filters", columns = [], onEditColumns = null, filteredIds = [], meta = null, theme = "dark" }) {
  const watchlist = useWatchlist();
  const [alertFor, setAlertFor] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  const bell = (stock, size = 30) => (
    <button
      onClick={() => setAlertFor({ symbol: stock.symbol, name: stock.name, cmp: stock.cmp, p1: stock.safeBuyPrice, p2: stock.p2, p3: stock.p3 })}
      title="Set price alert"
      style={actionButtonStyle({ active: false, activeColor: "var(--accent)", size })}
    >
      <BellIcon />
    </button>
  );
  const [sortBy, setSortBy] = useState("quality");
  const [sortDir, setSortDir] = useState("desc");
  // A column's ▾ menu: sort to a set direction, or set the column's filter —
  // the same { id, min, max } the sidebar edits (none when both are empty)
  const menuFor = (col, filterId, label) => {
    const about = filterId ? meta?.byId.get(filterId) ?? null : null;
    const def = onFiltersChange ? about : null;
    return {
      def, about, meta,
      filter: def ? (filters ?? []).find(f => f.id === filterId) : null,
      onSort: dir => { setSortBy(col); setSortDir(dir); },
      onApply: (min, max) => {
        const list = filters ?? [];
        const next = { id: filterId, min, max };
        onFiltersChange(min == null && max == null ? list.filter(f => f.id !== filterId)
          : list.some(f => f.id === filterId) ? list.map(f => (f.id === filterId ? next : f)) : [...list, next]);
      },
      label,
    };
  };

  // Net-net results are most useful ordered by discount to NCAV (cheapest first),
  // so the deepest Graham bargains surface above shallower net-nets.
  useEffect(() => {
    if (netNet) { setSortBy("ncavPct"); setSortDir("asc"); }
    else if (sortBy === "ncavPct") { setSortBy("quality"); setSortDir("desc"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netNet, matches]);

  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  // In the store app, an ad card after every tenth row on a phone (ads.jsx)
  useAdFeed(isMobile ? "stocks" : null, theme, "medium");

  const [search, setSearch] = useState("");
  // Screen your watchlist only: the strategy's filters, run on the companies
  // you follow (asked for on Screener.in's forum, Oct 2026)
  const [minQuality, setMinQuality] = useState(0);
  const [minResearch, setMinResearch] = useState(0);
  const [minPiotroski, setMinPiotroski] = useState(0);
  const [watchOnly, setWatchOnly] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [openResearchProfile, setOpenResearchProfile] = useState(null);
  // Phones: the name box and score boxes open from the one toolbar
  const [searchOpen, setSearchOpen] = useState(false);
  const pageSize = isMobile ? PHONE_PAGE_SIZE : PAGE_SIZE;
  const [visibleCount, setVisibleCount] = useState(() => typeof window !== "undefined" && window.innerWidth < 640 ? PHONE_PAGE_SIZE : PAGE_SIZE);
  useEffect(() => { setVisibleCount(pageSize); }, [matches, pageSize]);

  // Kept as the rows themselves, so picks survive switching to another
  // strategy — compare a stock from one screen with one from another.
  const [selected, setSelected] = useState(() => new Map());
  const [showCompare, setShowCompare] = useState(false);
  const toggleSelect = stock => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(stock.symbol)) next.delete(stock.symbol);
      else if (next.size < MAX_COMPARE) next.set(stock.symbol, stock);
      return next;
    });
  };

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // "Sort by" beside the count — the only way to sort on a phone, where
  // there are no column headers; on a computer it follows header clicks
  const sortOptions = [
    ["quality", "Quality score"], ["overall", "Research score"],
    ...(netNet ? [["ncavPct", "Discount to NCAV"]] : []),
    ...columns.map(def => [def.id, def.short ?? def.label]),
    ["cmp", "Price"], ["ret1d", "1-day change"], ["name", "Name"],
  ].filter(([id], i, all) => all.findIndex(([other]) => other === id) === i);
  const pickSort = col => { setSortBy(col); setSortDir(col === "name" ? "asc" : "desc"); };
  // Sorted by a column that has since been taken off: back to Quality
  const sortKnown = sortOptions.some(([id]) => id === sortBy);
  useEffect(() => { if (!sortKnown) { setSortBy("quality"); setSortDir("desc"); } }, [sortKnown]);
  const dirLabel = sortBy === "name" ? (sortDir === "asc" ? "A to Z" : "Z to A") : (sortDir === "desc" ? "Highest first" : "Lowest first");

  const handleSort = col => {
    if (sortBy === col) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  // A column's value: from the metrics the screen was asked for, else the
  // row's own field (cmp and the table's fixed fields)
  const colValue = (s, id) => s.values?.[id] ?? s[id] ?? null;
  const q = search.trim().toLowerCase();
  const watchedMatches = (matches || []).filter(s => watchlist.has(s.symbol)).length;
  const textFiltered = (matches || []).filter(s => (!watchOnly || watchlist.has(s.symbol)) &&
    (!q || s.name?.toLowerCase().includes(q) || s.symbol?.toLowerCase().includes(q)));
  // The score boxes beside the name box narrow the list together; every
  // other filter (sidebar or a column's ▾ menu) is screened by the server
  const scoreFiltered = minQuality > 0 || minResearch > 0 || minPiotroski > 0;
  const narrowed = !!q || watchOnly || scoreFiltered;
  const filtered = !scoreFiltered ? textFiltered : textFiltered.filter(s =>
    (quality(s) ?? -1) >= minQuality && (s.research?.overall ?? -1) >= minResearch && (colValue(s, "piotroski") ?? -1) >= minPiotroski);

  const valueFor = (s, key) => {
    if (key === "quality") return quality(s);
    if (key === "overall") return s.research?.overall ?? null;
    if (key === "ncavPct") return s.ncavCr > 0 && s.marketCapCr != null ? s.marketCapCr / s.ncavCr : Infinity;
    if (key === "name") return s.name?.toLowerCase();
    return colValue(s, key);
  };
  // Compared as shown: two companies that both read Quality 93 are level,
  // and the next score decides between them (below)
  const shownDecimals = key => (key === "quality" || key === "overall" ? 0 : columns.find(d => d.id === key)?.decimals ?? null);
  const sortVal = s => {
    const v = valueFor(s, sortBy), d = shownDecimals(sortBy);
    return typeof v === "number" && Number.isFinite(v) && d != null ? Number(v.toFixed(d)) : v;
  };
  // Level on the sort: Quality first, then Research, then Piotroski — so
  // "Quality, highest first" lists the 93s by their research score, and a
  // Piotroski sort lists each 9/9, 8/9 … group by quality
  const tieKeys = sortBy === "quality" ? ["overall", "piotroski"] : sortBy === "overall" ? ["quality", "piotroski"] : ["quality", "overall"];
  const breakTie = (a, b) => {
    for (const key of [...tieKeys, "roce"]) {
      const av = valueFor(a, key), bv = valueFor(b, key);
      if (av == null && bv == null) continue;
      if (av == null || bv == null) return av == null ? 1 : -1;
      if (av !== bv) return bv - av;
    }
    return 0;
  };

  // Blanks go last whichever way a column sorts: as -Infinity they led every
  // ascending sort — ~300 loss-makers with no P/E above the cheapest stock
  const sorted = [...filtered].sort((a, b) => {
    const av = sortVal(a), bv = sortVal(b);
    const aBlank = av == null || (typeof av === "number" && !Number.isFinite(av) && sortBy !== "ncavPct");
    const bBlank = bv == null || (typeof bv === "number" && !Number.isFinite(bv) && sortBy !== "ncavPct");
    if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1;
    if (av === bv) return breakTie(a, b);
    return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const visible = sorted.slice(0, visibleCount);

  // Columns chosen or filtered on that the file doesn't already have
  const CSV_FIXED = new Set(["pe", "peTtm", "peFy", "eps", "ttmEps", "roce", "roe", "opm", "promoterPct", "fiiPct", "diiPct", "marketCapCr", "divYield"]);
  const extraColumns = columns.filter(def => !CSV_FIXED.has(def.id));

  const exportCsv = () => {
    const quote = v => `"${String(v).replace(/"/g, '""')}"`;
    const cols = ["Rank", "Name", "Symbol", "Sector / industry", "Quality/100", "Research/100", "Research stance", "Valuation/100", "Risk/100", "CMP", "PE TTM", "PE FY", "ROCE", "ROE", "OPM", "Promoter%", "FII%", "DII%", "MarketCap(Cr)", "DivYield", "EPS FY", "EPS TTM", "P1", "P2", "P3", "FairValue2Y", "52WLow", "52WHigh", ...extraColumns.map(def => quote(def.label))];
    const r1 = v => (v == null ? "" : Math.round(v * 10) / 10);
    const rows = sorted.map((s, i) => [
      i + 1, quote(s.name), s.symbol, s.sector ? quote(s.sector) : "", r1(s.research?.quality), r1(s.research?.overall), quote(s.research?.stance ?? ""), r1(s.research?.valuation), r1(s.research?.risk),
      r1(s.cmp), r1(s.peTtm), r1(s.peFy), r1(s.roce), r1(s.roe), r1(s.opm), r1(s.promoterPct), r1(s.fiiPct), r1(s.diiPct),
      r1(s.marketCapCr), r1(s.divYield), r1(s.eps), r1(s.ttmEps), s.safeBuyPrice ?? "", s.p2 ?? "", s.p3 ?? "", s.fairValue ?? "",
      s.low52w ?? "", s.high52w ?? "",
      ...extraColumns.map(def => { const v = colValue(s, def.id); return v == null ? "" : Math.round(v * 100) / 100; }),
    ]);
    const csv = [cols.join(","), ...rows.map(r => r.join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "stockwise-india-discover.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportExcel = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const sortLabel = `${sortOptions.find(([id]) => id === sortBy)?.[1] ?? "Quality score"}, ${dirLabel.toLowerCase()}`;
      const { exportDiscoverExcel } = await import("./exportExcel.js");
      await exportDiscoverExcel(sorted, { pricesDate: snapshot?.pricesDate, extraColumns, screen: queryUsed || "", sortLabel });
    } catch {
      setExportError("Excel export failed — try again");
    } finally {
      setExporting(false);
    }
  };

  const noData = !loading && (!matches || matches.length === 0);
  const cell = { padding: "9px 6px", borderBottom: "1px solid var(--bdr)" };

  return (
    <div style={{ animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>
      {alertFor && <CreateAlertModal stock={alertFor} onClose={() => setAlertFor(null)} />}
      {showCompare && selected.size >= 2 && (
        <Suspense fallback={<div role="status" className="compare-loading">Loading comparison…</div>}>
          <CompareView stocks={[...selected.values()]} pricesDate={snapshot?.pricesDate} onClose={() => setShowCompare(false)} />
        </Suspense>
      )}

      {/* ── Top bar: the count, large, on the left; sort, columns, the guide
             and export on the right — quiet buttons; Compare lights up only
             when rows are ticked ── */}
      {/* A phone on Discover: the count and dates are on the strategy's ⓘ page */}
      {(totalMatches != null || loading) && !(isMobile && hideCountOnPhone) && (
        <div className="results-topbar">
          <div className="rt-count">
            {loading ? (
              <span style={{ color: "var(--t3)" }}>Scanning market…</span>
            ) : (
              <>
                {/* Only what's on screen (20 Oct 2026: no total, no "of the
                    market") — "Showing 50", and Load more at the end */}
                <span className="rt-showing">
                  {updating ? "Updating…" : <>Showing <b>{visible.length.toLocaleString("en-IN")}</b></>}
                </span>
                {/* Why some companies are missing: an ⓘ beside it */}
                {notes.length > 0 && (
                  <button type="button" onClick={() => setShowNotes(v => !v)} aria-expanded={showNotes} aria-label="Why some companies are left out" title={notes.join(" ")}
                    className="rt-why" data-on={showNotes || undefined}>
                    <Info size={14} aria-hidden="true" />
                  </button>
                )}
                {snapshot?.pricesDate && (
                  <span className="rt-meta">Prices as of {new Date(`${snapshot.pricesDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>
                )}
              </>
            )}
          </div>
          <div className="rt-actions">
            {exportError && <span style={{ fontSize: 11, color: "var(--red)" }}>{exportError}</span>}
            {selected.size >= 2 && (
              <button onClick={() => setShowCompare(true)} className="btn-primary tb-btn">
                Compare {selected.size}
              </button>
            )}
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Map())} className="btn-ghost tb-btn">
                Clear
              </button>
            )}
            {!loading && (matches?.length ?? 0) > 1 && (
              <div className={`sort-control${phoneFilters ? " hide-phone" : ""}`}>
                <select value={sortBy} onChange={e => pickSort(e.target.value)} aria-label="Sort by" className="tb-select">
                  {sortOptions.map(([id, label]) => <option key={id} value={id}>Sort: {label}</option>)}
                </select>
                <button type="button" onClick={() => setSortDir(d => (d === "asc" ? "desc" : "asc"))} title={dirLabel} aria-label={`${dirLabel} — tap to reverse`} className="btn-ghost tb-btn tb-icon">
                  {sortDir === "desc" ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
                </button>
              </div>
            )}
            {onEditColumns && (
              <button onClick={onEditColumns} className="btn-ghost tb-btn hide-phone" title="Choose which columns the table shows">
                <Columns3 size={14} /> Columns
              </button>
            )}
            {!loading && (matches?.length ?? 0) > 0 && (
              <button type="button" onClick={() => setShowGuide(true)} className="btn-ghost tb-btn tb-icon hide-phone" title="What these columns mean" aria-label="Column guide: what these columns mean">
                <Info size={15} />
              </button>
            )}
            {!loading && (matches?.length ?? 0) > 0 && (
              <ExportMenu onExcel={exportExcel} onCsv={exportCsv} busy={exporting || sorted.length === 0} />
            )}
          </div>
        </div>
      )}

      {/* ── Phones: one toolbar — Filters, the sort (column and direction), and
             a search button that opens the name box with the score boxes.
             There even when the filters leave nothing, so they can be
             changed ── */}
      {isMobile && !loading && phoneFilters && (
        <>
          <div className="ph-toolbar">
            {phoneFilters}
            {(matches?.length ?? 0) > 0 && (
              <button type="button" className="btn-ghost ph-toolbar-search" aria-label="Search and score filters" aria-expanded={searchOpen || !!q || scoreFiltered} data-on={searchOpen || q || scoreFiltered || undefined} onClick={() => setSearchOpen(o => !o)}>
                <Search size={17} aria-hidden="true" />
              </button>
            )}
          </div>
          {/* The sort as chips (17 Oct 2026, after the Stock Screeners: India
              app): tap one to sort by it, tap it again to reverse */}
          {(matches?.length ?? 0) > 1 && (
            <div className="ph-sort" role="group" aria-label="Sort by">
              <span className="ph-sort-label" aria-hidden="true">Sort</span>
              {sortOptions.map(([id, label]) => {
                const on = sortBy === id;
                const name = label.replace(/ score$/, "");
                return (
                  <button key={id} type="button" className="ph-chip" aria-pressed={on}
                    aria-label={on ? `Sorted by ${name}, ${dirLabel.toLowerCase()} — tap to reverse` : `Sort by ${name}`}
                    onClick={() => (on ? setSortDir(d => (d === "asc" ? "desc" : "asc")) : pickSort(id))}>
                    {name}{on && (sortDir === "desc" ? <ArrowDown size={13} aria-hidden="true" /> : <ArrowUp size={13} aria-hidden="true" />)}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Name box, and Watchlist only. Score minimums are set from each
             Name box + the three scores: pick Quality 70+, then Research or
             Piotroski with it ── */}
      {/* The Filters button stays even when the filters leave nothing (the
          way back out); the name box and scores need rows to work on */}
      {!loading && ((matches?.length ?? 0) > 0 || filtersButton) && (!isMobile || searchOpen || !!q || scoreFiltered) && (
        <div className="score-line">
        {filtersButton}
        {(matches?.length ?? 0) > 0 && <div className="score-row">
          <div style={{ position: "relative", minWidth: 0 }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Filter by name or ticker…"
              autoFocus={isMobile && searchOpen}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-base"
              style={{ paddingLeft: 36, background: "var(--s2)" }}
            />
          </div>
          {[
            ["Minimum quality score", minQuality, setMinQuality, "Any quality", MIN_QUALITY.map(n => [n, `Quality ${n}+`]), "Quality"],
            ["Minimum research score", minResearch, setMinResearch, "Any research", MIN_RESEARCH.map(n => [n, `Research ${n}+`]), "Research"],
            ["Minimum Piotroski score", minPiotroski, setMinPiotroski, "Any Piotroski", MIN_PIOTROSKI.map(n => [n, n === 9 ? "Piotroski 9" : `Piotroski ${n}+`]), "Piotroski"],
          ].map(([label, value, set, any, options, short]) => (
            // On a phone the box is a small label ("Quality ▾", or the chosen
            // "Quality 70+") with the real select laid over it, invisible at
            // 16px so iOS opens its picker without zooming the page. On a
            // computer the wrapper is display: contents and the select shows.
            <span key={label} className="score-pick" data-on={value > 0}>
            <span className="score-pick-label" aria-hidden="true">
              {value > 0 ? options.find(([n]) => n === value)?.[1] : short}<ChevronDown size={13} />
            </span>
            <select value={value} onChange={e => set(Number(e.target.value))} aria-label={label}
              style={{
                height: 40, padding: "0 10px", borderRadius: 8, minWidth: 0,
                border: `1px solid ${value > 0 ? "var(--green-bdr)" : "var(--bdr2)"}`, fontSize: 12.5,
                background: value > 0 ? "var(--green-dim)" : "var(--s2)",
                color: value > 0 ? "var(--green)" : "var(--t1)",
                cursor: "pointer", outline: "none", fontFamily: "inherit",
                fontWeight: value > 0 ? 600 : 500,
              }}>
              <option value="0">{any}</option>
              {options.map(([n, text]) => <option key={n} value={n}>{text}</option>)}
            </select>
            </span>
          ))}
          {watchlist.size > 0 && (
            <button type="button" aria-pressed={watchOnly} onClick={() => setWatchOnly(v => !v)} className="score-watch"
              title="Run these filters on your watchlist only"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer",
                border: `1px solid ${watchOnly ? "var(--accent)" : "var(--bdr2)"}`, background: watchOnly ? "var(--accent-glow)" : "var(--s2)", color: watchOnly ? "var(--accent)" : "var(--t2)", fontWeight: watchOnly ? 600 : 500 }}>
              <Star size={13} fill={watchOnly ? "currentColor" : "none"} /> Watchlist only <span style={{ ...MONO, opacity: 0.8 }}>({watchedMatches})</span>
            </button>
          )}
        </div>}
        </div>
      )}

      {showGuide && (
        <ColumnGuide meta={meta} onClose={() => setShowGuide(false)}
          extra={[meta?.byId.get("quality"), meta?.byId.get("researchScore"), meta?.byId.get("cmp")].filter(Boolean)}
          defs={[...columns, {
            id: "priceLevels", label: "Price levels (P1 · P2 · P3 · FV)", basis: "levels",
            about: "Reference levels from each company's valuation model: P1 is 10% under today's fair value, P2 and P3 are 10% and 20% under P1, and FV is the fair value two years on, grown at the company's own rate. Banks are valued on book and cyclicals on mid-cycle earnings; NBFC lenders, holding companies, loss-makers and companies with under five years of filings have none.",
          }]} />
      )}

      {/* ── The screen's filters, one chip each (describeFilters joins them with " · ").
          Only on a phone (index.css .filter-chips), where the filter sidebar is
          behind a button; on a computer the sidebar beside the table lists them ── */}
      {notes.length > 0 && !loading && showNotes && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "var(--t3)", marginBottom: 14, lineHeight: 1.5 }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{notes.map(n => <div key={n}>{n}</div>)}</div>
        </div>
      )}
      {unsupported.length > 0 && !loading && (
        <div style={{ fontSize: 11, color: "var(--yellow)", marginBottom: 14, padding: "9px 14px", background: "var(--yellow-dim)", borderRadius: 9, border: "1px solid var(--yellow-bdr)", lineHeight: 1.7 }}>
          Not applied (no data yet): {unsupported.join(", ")}
        </div>
      )}

      {/* The name box or quality filter can empty the list on their own */}
      {!loading && (matches?.length ?? 0) > 0 && sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--t2)", fontSize: 13, border: "1px dashed var(--bdr2)", borderRadius: 14 }}>
          None of these {matches.length.toLocaleString("en-IN")} companies {[
            watchOnly && "are on your watchlist",
            q && `match "${search.trim()}"`,
            minQuality > 0 && `have quality ${minQuality}+`,
            minResearch > 0 && `have research ${minResearch}+`,
            minPiotroski > 0 && `have Piotroski ${minPiotroski}${minPiotroski < 9 ? "+" : ""}`,
          ].filter(Boolean).join(" and ")}.
          <button className="btn-ghost" onClick={() => { setSearch(""); setMinQuality(0); setMinResearch(0); setMinPiotroski(0); setWatchOnly(false); }} style={{ marginLeft: 10, height: 28, fontSize: 12 }}>Show all</button>
        </div>
      )}

      {/* ── Phone rows (17 Oct 2026, cleaner, after the Stock Screeners:
             India app): the name and price, the symbol and sector with the
             day's move, then the scores and the screen's own measures in
             one quiet line; the star saves it. The whole row opens the
             company. Compare is on a computer. ── */}
      {!loading && sorted.length > 0 && isMobile && (
        <div className="ph-rows">
          {visible.map((stock, i) => {
            const day = stock.ret1d;
            const quality = stock.research?.quality, overall = stock.research?.overall;
            const missingResearch = overall == null ? researchMissingText(stock.research) : null;
            // Coloured as the pills and stance words on a computer
            const cells = [
              ["Quality", <span key="q" title={researchTitle(stock.research)} style={{ color: qualityTone(quality).color }}>{quality == null ? "—" : Math.round(quality)}</span>, quality == null ? null : "/100"],
              ["Research", <span key="r" title={researchTitle(stock.research)} aria-label={missingResearch ?? `Research score ${Math.round(overall)} — ${stock.research?.stance ?? "rated"}`} style={{ color: overallTone(overall).color }}>{overall == null ? "—" : Math.round(overall)}</span>, overall == null ? null : "/100"],
              // (an unrated one is a dash: the note under the card says why —
              // a word there was cut off on a small phone, "qual…")
              // What's being filtered on first: one of the screen's measures,
              // so the line fits a phone (the company page has the rest)
              ...[...columns.filter(def => filteredIds.includes(def.id)), ...columns.filter(def => !filteredIds.includes(def.id))].slice(0, 1).map(def => {
                const v = colValue(stock, def.id);
                // One decimal, and the unit set small as "/100" is, so it fits
                // a third of a small phone ("71.23%" showed as "71.…")
                const [figure, unit] = splitUnit(formatValue({ ...def, decimals: Math.min(def.decimals ?? 1, 1) }, v));
                // Coloured as the table's cells are (strong ROCE, Piotroski 7+ green)
                // a short name for a phone's column ("P/E TTM/FY" → "P/E")
                return [def.short.replace(/\s+TTM\/FY$/, ""), <span key={def.id} style={{ color: valueColor(def, v) }}>{figure}</span>, unit];
              }),
            ];
            const adAfter = (i + 1) % PHONE_AD_EVERY === 0 && i + 1 < visible.length;
            return (
              <div key={stock.symbol} className="ph-row-group">
                {/* A phone's card, laid out as the Stocks app's rows (20 Oct
                    2026): name and price, then ticker · sector and the day's
                    change; then the scores in even columns with the star at
                    the end. The research profile isn't repeated here — the
                    company page, a tap away, has the whole scorecard. */}
                {/* One card per company, apart from the next, so every figure
                    plainly belongs to the company it's under (20 Oct 2026:
                    rows in one box read as "what is what"): its logo (or
                    letters), name and price; ticker · sector and the day's
                    change; then its scores in a tray, each with its scale,
                    and the star. */}
                <div data-tour={i === 0 ? "row" : undefined} onClick={() => onAnalyze(stock.symbol)} className="ph-row phone-row">
                  <div className="ph-row-top">
                    <CompanyLogo symbol={stock.symbol} size={42} fallback={stock.name} />
                    <div className="ph-row-id">
                      <button type="button" className="ph-row-name stock-link" aria-label={stock.name} onClick={e => { e.stopPropagation(); onAnalyze(stock.symbol); }}>{cardName(stock.name)}</button>
                      <div className="ph-row-sub">
                        <span className="ph-row-ticker">{stock.symbol}</span>
                        <NcavBadge stock={stock} />
                        {stock.sector && <><span className="ph-row-dot" aria-hidden="true">·</span><span className="ph-row-sector">{stock.sector}</span></>}
                      </div>
                    </div>
                    <div className="ph-row-quote">
                      <span className="ph-row-price">{stock.cmp ? `₹${fmt(stock.cmp, stock.cmp < 100 ? 2 : 0)}` : "—"}</span>
                      {day != null && <span className={`ph-row-day ${day >= 0 ? "up" : "down"}`}>{`${day >= 0 ? "+" : "−"}${Math.abs(day).toFixed(2)}%`}</span>}
                    </div>
                  </div>
                  <div className="ph-row-foot">
                    <div className="ph-row-stats" style={{ "--n": cells.length }}>
                      {cells.map(([label, value, unit]) => (
                        <div key={label} className="ph-stat"><span className="ph-stat-k">{label}</span><span className="ph-stat-v">{value}{unit && <small>{unit}</small>}</span></div>
                      ))}
                    </div>
                    <span className="ph-row-star" data-tour={i === 0 ? "row-actions" : undefined} onClick={e => e.stopPropagation()}>
                      <StarButton symbol={stock.symbol} price={stock.cmp} watched={watchlist.has(stock.symbol)} size={40} />
                    </span>
                  </div>
                  {missingResearch && <div role="note" className="ph-row-note">{missingResearch}</div>}
                </div>
                {adAfter && <AdCard feed="stocks" slot={`stocks-after-${i + 1}`} size="medium" className="ph-row-ad" />}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Desktop table ── */}
      {!isMobile && !noData && (loading || sorted.length > 0) && (
        <div style={{ borderRadius: 12, border: "1px solid var(--bdr2)", overflow: "hidden", boxShadow: "var(--sh-xs)", background: "var(--s2)" }}>
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "min(70vh, 780px)" }}>
            <table className="data-table" style={{ minWidth: 640 + columns.length * 80 }}>
              <thead>
                <tr>
                  <th title={`Tick up to ${MAX_COMPARE} to compare`} style={{ ...thStyle, padding: "10px 8px", width: RANK_W, minWidth: RANK_W, boxSizing: "border-box", left: 0, zIndex: 4, verticalAlign: "bottom" }}>#<span className="th-unit" aria-hidden="true">{"\u00a0"}</span></th>
                  <th onClick={() => handleSort("name")} aria-sort={ariaSort(sortBy === "name", sortDir)} style={{ ...thStyle, color: sortBy === "name" ? "var(--t1)" : "var(--t2)", fontWeight: sortBy === "name" ? 600 : 500, left: RANK_W, zIndex: 4, cursor: "pointer", minWidth: 200, boxShadow: "inset -1px 0 0 var(--bdr)", verticalAlign: "bottom" }}>
                    <span className="th-head">
                      <button type="button" style={sortBtnStyle}>Stock <SortArrow active={sortBy === "name"} dir={sortDir} /></button>
                      <MenuButton label="Stock" menu={{ ...menuFor("name", null), text: true }} />
                    </span>
                    <span className="th-unit" aria-hidden="true">{"\u00a0"}</span>
                  </th>
                  <SortTh label="Quality" unit="of 100" title="Quality score out of 100 — business, earnings, balance sheet, governance, growth and valuation" col="quality" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} menu={menuFor("quality", "quality")} info={<MetricInfo def={meta?.byId.get("quality")} meta={meta} />} />
                  <SortTh label="Research" unit="of 100" title="Overall research score: quality and valuation blended, trimmed for price swings and data gaps. Not a buy or sell signal." col="overall" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} menu={menuFor("overall", "researchScore")} info={<MetricInfo def={meta?.byId.get("researchScore")} meta={meta} />} />
                  <SortTh label="CMP" unit="₹" col="cmp"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} menu={menuFor("cmp", "cmp")} info={<MetricInfo def={meta?.byId.get("cmp")} meta={meta} />} />
                  {columns.map(def => (
                    <SortTh key={def.id} label={def.short} unit={unitLabel(def)} title={def.label} col={def.id} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} menu={menuFor(def.id, def.id)} info={<MetricInfo def={def} meta={meta} />} />
                  ))}
                  <th style={{ ...thStyle, color: "var(--accent)", fontWeight: 400, background: "color-mix(in srgb, var(--accent) 4%, var(--s1))", verticalAlign: "bottom" }}>
                    Price levels
                    <span className="th-unit">₹ · P1 P2 P3 · FV</span>
                  </th>
                  <th style={{ ...thStyle, right: 0, zIndex: 4, boxShadow: "inset 1px 0 0 var(--bdr)", verticalAlign: "bottom" }}>Actions<span className="th-unit" aria-hidden="true">{"\u00a0"}</span></th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 + columns.length }).map((_, j) => (
                      <td key={j} style={cell}>
                        <div className="skeleton-pulse" style={{ height: 13, borderRadius: 4, width: j === 1 ? 140 : j === 5 + columns.length ? 100 : 55 }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && visible.map((stock, i) => {
                  const isSelected = selected.has(stock.symbol);
                  const profileOpen = openResearchProfile === stock.symbol;
                  // Opaque, so the pinned cells still hide what scrolls under them
                  const rowBg = isSelected ? "linear-gradient(color-mix(in srgb, var(--accent) 6%, transparent), color-mix(in srgb, var(--accent) 6%, transparent)), var(--s2)" : "var(--s2)";
                  return (
                  <Fragment key={stock.symbol}>
                  <tr
                    data-tour={i === 0 ? "row" : undefined}
                    style={{ background: rowBg, transition: "background 100ms" }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--s3)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
                  >
                    <td style={{ ...cell, padding: "8px 8px", position: "sticky", left: 0, background: rowBg, zIndex: 1, width: RANK_W, minWidth: RANK_W, boxSizing: "border-box" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="checkbox" checked={isSelected} onChange={() => toggleSelect(stock)}
                          disabled={!isSelected && selected.size >= MAX_COMPARE}
                          title={!isSelected && selected.size >= MAX_COMPARE ? `Up to ${MAX_COMPARE} at a time` : "Compare"}
                          aria-label={`Compare ${stock.name}`}
                          style={{ cursor: "pointer", margin: 0 }}
                        />
                        <span style={{ fontSize: 11, color: "var(--t3)", ...MONO }}>{i + 1}</span>
                      </div>
                    </td>

                    <td style={{ ...cell, minWidth: 200, position: "sticky", left: RANK_W, background: rowBg, zIndex: 1, boxShadow: "inset -1px 0 0 var(--bdr)" }}>
                      <button type="button" title={stock.name} aria-label={stock.name} onClick={() => onAnalyze(stock.symbol)} className="stock-link" style={{ display: "block", maxWidth: 184, padding: 0, border: 0, background: "none", fontFamily: "inherit", textAlign: "left", fontWeight: 400, fontSize: 13.5, letterSpacing: "-0.01em", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortName(stock.name)}</button>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: 184, minWidth: 0 }}>
                        <span className="ticker-chip">{stock.symbol}</span>
                        <NcavBadge stock={stock} />
                        {stock.sector && <span title={stock.sector} style={{ fontSize: 10.5, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{stock.sector}</span>}
                      </div>
                      <ResearchProfile
                        research={stock.research}
                        expanded={profileOpen}
                        triggerOnly
                        onToggle={() => setOpenResearchProfile(current => current === stock.symbol ? null : stock.symbol)}
                      />
                    </td>

                    <td style={cell}><QualityBadge research={stock.research} /></td>
                    <td style={{ ...cell, paddingTop: 6, paddingBottom: 6 }}><OverallScore research={stock.research} /></td>

                    <td style={{ ...cell, fontWeight: 500, color: "var(--t1)", ...MONO, whiteSpace: "nowrap" }}>
                      {stock.cmp ? `₹${fmt(stock.cmp)}` : "—"}
                    </td>

                    {columns.map(def => {
                      const v = colValue(stock, def.id);
                      return (
                        <td key={def.id} style={{ ...cell, ...MONO, color: valueColor(def, v), whiteSpace: "nowrap" }}>
                          {formatValue(def, v, { cell: true })}
                        </td>
                      );
                    })}

                    <td style={{ ...cell, background: "color-mix(in srgb, var(--accent) 2%, transparent)" }}><FvCell stock={stock} /></td>

                    {/* Pinned to the right edge, as the name is to the left: watch, alert
                        and NSE stay in reach while wide screens scroll sideways */}
                    <td style={{ ...cell, position: "sticky", right: 0, background: rowBg, zIndex: 1, boxShadow: "inset 1px 0 0 var(--bdr)" }}>
                      <div data-tour={i === 0 ? "row-actions" : undefined} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        {/* The company's name opens it; the row keeps only watch, alert and NSE */}
                        <StarButton symbol={stock.symbol} price={stock.cmp} watched={watchlist.has(stock.symbol)} />
                        {bell(stock)}
                        <a
                          href={nseUrl(stock.symbol)} target="_blank" rel="noreferrer" title="Open on NSE" aria-label="Open on NSE"
                          style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--t3)", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms", flexShrink: 0 }}
                        ><ArrowUpRight size={15} /></a>
                      </div>
                    </td>
                  </tr>
                  {profileOpen && (
                    <tr className="research-profile-table-row">
                      <td colSpan={7 + columns.length}>
                        <ResearchProfile research={stock.research} symbol={stock.symbol} expanded panelOnly />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* The model's caveat, under the results rather than above them */}
      {!loading && sorted.length > 0 && (
        <p role="note" style={{ fontSize: 11, color: "var(--t3)", margin: "10px 0 0", lineHeight: 1.5 }}>
          Experimental model: research scores are rule-based summaries, not forecasts of future returns.
        </p>
      )}

      {/* ── Show more ── */}
      {!loading && sorted.length > visibleCount && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => setVisibleCount(c => c + pageSize)} className="btn-ghost" style={{ fontSize: 13, padding: "10px 24px" }}>
            Load more
          </button>
        </div>
      )}

      {/* ── Empty ── */}
      {noData && (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--t3)" }}>
          <SearchX size={40} strokeWidth={1.5} style={{ marginBottom: 14, opacity: 0.4 }} />
          <p style={{ fontSize: 15, color: "var(--t2)", marginBottom: 6, fontWeight: 500 }}>{emptyTitle}</p>
          <p style={{ fontSize: 13, color: "var(--t3)" }}>{emptyHint}</p>
        </div>
      )}
    </div>
  );
}
