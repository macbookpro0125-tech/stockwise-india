import { useState, useEffect } from "react";
import { ArrowDown, ArrowUp, Check, Info, Columns3, Search, ArrowUpRight, SearchX } from "lucide-react";
import { StarIcon, BellIcon, actionButtonStyle } from "./icons.jsx";
import { useWatchlist, toggleWatch } from "./watchlist.js";
import CreateAlertModal from "./CreateAlertModal.jsx";
import CompareView from "./CompareView.jsx";
import { exportDiscoverExcel } from "./exportExcel.js";
import { formatValue, valueColor } from "./screener/meta.js";
import { QualityBadge, OverallScore, qualityTone, overallTone, researchTitle } from "./ResearchBadges.jsx";

// A metric column's header, with its unit as the table always showed it
// ("ROCE %", "CMP ₹")
const columnLabel = def => (def.unit === "%" ? `${def.short} %` : def.unit === "₹" ? `${def.short} ₹` : def.short);

// Ported from stock-screener's src/components/ResultsTable.jsx — same columns,
// price levels with 52-week range, NCAV badge, watchlist star, compare (up to
// 4), Excel and CSV export, sorting, filter box and paging. The original's
// score out of 10 is now the research score (server/research.js): quality out
// of 100 and the overall research score, with a minimum-quality filter.
// Every row arrives already scored, so there's no lazy enrichment.

const PAGE_SIZE = 50;
const MAX_COMPARE = 4;
// Wide enough for the compare box and a four-digit rank; the name column is
// pinned right after it.
const RANK_W = 60;

// Column headers: sentence case at reading size; the sorted one darker, with
// its arrow (the others keep the arrow's room so headers don't shift)
const thStyle = {
  padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "var(--t2)",
  whiteSpace: "nowrap", userSelect: "none", borderBottom: "1px solid var(--bdr2)", background: "var(--s1)",
  position: "sticky", top: 0, zIndex: 3,
};
const SortArrow = ({ active, dir }) => {
  const Arrow = active && dir === "asc" ? ArrowUp : ArrowDown;
  return <Arrow size={12} strokeWidth={2.4} style={{ opacity: active ? 1 : 0, color: "var(--accent)", flexShrink: 0, transition: "opacity 120ms" }} />;
};

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

const quality = s => s.research?.quality ?? null;
const MIN_QUALITY = [40, 50, 60, 70, 80];

const nseUrl = symbol => `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`;

function SortTh({ label, title, col, sortBy, sortDir, onSort, accent }) {
  const active = sortBy === col;
  return (
    <th
      onClick={() => onSort(col)}
      title={title}
      style={{
        ...thStyle,
        color: active ? "var(--t1)" : "var(--t2)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        background: accent ? "color-mix(in srgb, var(--accent) 3%, var(--s1))" : "var(--s1)",
        transition: "color 120ms",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        <SortArrow active={active} dir={sortDir} />
      </span>
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
        fontSize: 10, padding: "1px 7px", borderRadius: 5, fontWeight: 700, ...MONO,
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
  const notes = [
    stock.valuationPeBasis === "current" && "Fewer than 3 usable years of P/E history, so this uses today's P/E — fair value then tracks the current price.",
    stock.epsJump && `This year's EPS (₹${stock.epsJump.eps.toFixed(2)}) is more than 3× its usual ₹${stock.epsJump.usualEps.toFixed(2)} and the share price hasn't followed — how a one-off gain looks. Price levels use the usual EPS.`,
  ].filter(Boolean);
  const fvLabel = stock.fyEnd ? `FV${String(Number(stock.fyEnd.slice(0, 4)) + 2).slice(2)}` : "FV";
  return (
    <div style={{ fontSize: 11, lineHeight: 1.5, minWidth: 190, ...MONO }}>
      {p1 ? (
        <div style={{ display: "flex", gap: 8, whiteSpace: "nowrap" }}>
          {[["P1", p1], ["P2", p2], ["P3", p3]].map(([label, price]) => {
            const hit = cmp != null && price != null && cmp <= price;
            return (
              <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 2, color: hit ? "var(--accent)" : "var(--t3)", fontWeight: hit ? 650 : 500 }}>
                <span style={{ fontWeight: 500, opacity: 0.8 }}>{label}</span>&nbsp;{price ? price.toLocaleString("en-IN") : "—"}{hit && <Check size={11} strokeWidth={3} style={{ color: "var(--green)" }} />}
              </span>
            );
          })}
        </div>
      ) : (
        <div style={{ color: "var(--t3)" }}>No price levels</div>
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

export default function ResultsTable({ matches, loading, onAnalyze, totalMatches, queryUsed, unsupported = [], notes = [], executionTime, snapshot, netNet = false, noun = "stocks", emptyTitle = "No stocks matched your criteria", emptyHint = "Try relaxing some filters", columns = [], onEditColumns = null }) {
  const watchlist = useWatchlist();
  const [alertFor, setAlertFor] = useState(null);
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

  const [search, setSearch] = useState("");
  const [minQuality, setMinQuality] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [matches]);

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

  const handleSort = col => {
    if (sortBy === col) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const q = search.trim().toLowerCase();
  const textFiltered = q
    ? (matches || []).filter(s => s.name?.toLowerCase().includes(q) || s.symbol?.toLowerCase().includes(q))
    : (matches || []);
  const filtered = minQuality > 0 ? textFiltered.filter(s => (quality(s) ?? -1) >= minQuality) : textFiltered;

  // A column's value: from the metrics the screen was asked for, else the
  // row's own field (cmp and the table's fixed fields)
  const colValue = (s, id) => s.values?.[id] ?? s[id] ?? null;
  const sortVal = s => {
    if (sortBy === "quality") return quality(s);
    if (sortBy === "overall") return s.research?.overall ?? null;
    if (sortBy === "ncavPct") return s.ncavCr > 0 && s.marketCapCr != null ? s.marketCapCr / s.ncavCr : Infinity;
    if (sortBy === "name") return s.name?.toLowerCase();
    return colValue(s, sortBy);
  };

  // Blanks go last whichever way a column sorts: as -Infinity they led every
  // ascending sort — ~300 loss-makers with no P/E above the cheapest stock
  const sorted = [...filtered].sort((a, b) => {
    const av = sortVal(a), bv = sortVal(b);
    const aBlank = av == null || (typeof av === "number" && !Number.isFinite(av) && sortBy !== "ncavPct");
    const bBlank = bv == null || (typeof bv === "number" && !Number.isFinite(bv) && sortBy !== "ncavPct");
    if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1;
    if (av === bv) return sortBy === "quality" || sortBy === "overall" ? (b.roce ?? -Infinity) - (a.roce ?? -Infinity) : 0;
    return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const visible = sorted.slice(0, visibleCount);

  // Columns chosen or filtered on that the file doesn't already have
  const CSV_FIXED = new Set(["pe", "roce", "roe", "opm", "promoterPct", "fiiPct", "diiPct", "marketCapCr", "divYield"]);
  const extraColumns = columns.filter(def => !CSV_FIXED.has(def.id));

  const exportCsv = () => {
    const quote = v => `"${String(v).replace(/"/g, '""')}"`;
    const cols = ["Rank", "Name", "Symbol", "Sector", "Quality/100", "Research/100", "Research stance", "Valuation/100", "Risk/100", "CMP", "PE", "ROCE", "ROE", "OPM", "Promoter%", "FII%", "DII%", "MarketCap(Cr)", "DivYield", "P1", "P2", "P3", "FairValue2Y", "52WLow", "52WHigh", ...extraColumns.map(def => quote(def.label))];
    const r1 = v => (v == null ? "" : Math.round(v * 10) / 10);
    const rows = sorted.map((s, i) => [
      i + 1, quote(s.name), s.symbol, s.sector ? quote(s.sector) : "", r1(s.research?.quality), r1(s.research?.overall), quote(s.research?.stance ?? ""), r1(s.research?.valuation), r1(s.research?.risk),
      r1(s.cmp), r1(s.pe), r1(s.roce), r1(s.roe), r1(s.opm), r1(s.promoterPct), r1(s.fiiPct), r1(s.diiPct),
      r1(s.marketCapCr), r1(s.divYield), s.safeBuyPrice ?? "", s.p2 ?? "", s.p3 ?? "", s.fairValue ?? "",
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
      await exportDiscoverExcel(sorted, { pricesDate: snapshot?.pricesDate, extraColumns });
    } catch {
      setExportError("Excel export failed — try again");
    } finally {
      setExporting(false);
    }
  };

  const noData = !loading && (!matches || matches.length === 0);
  const cell = { padding: "9px 12px", borderBottom: "1px solid var(--bdr)" };

  return (
    <div style={{ animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>
      {alertFor && <CreateAlertModal stock={alertFor} onClose={() => setAlertFor(null)} />}
      {showCompare && selected.size >= 2 && (
        <CompareView stocks={[...selected.values()]} onClose={() => setShowCompare(false)} />
      )}

      {/* ── Top bar ── */}
      {(totalMatches != null || loading) && (
        <div className="results-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "14px 0", marginBottom: 12, borderBottom: "1px solid var(--bdr)" }}>
          <div style={{ fontSize: 13, color: "var(--t1)" }}>
            {loading ? (
              <span style={{ color: "var(--t3)" }}>Scanning market…</span>
            ) : (
              <span>
                <span style={{ color: "var(--t2)" }}>Found </span>
                <strong style={{ color: "var(--t1)" }}>{q ? filtered.length.toLocaleString() : totalMatches?.toLocaleString()}</strong>
                <span style={{ color: "var(--t2)" }}> {noun}</span>
                {(q || minQuality > 0) && filtered.length !== (matches?.length ?? 0) && <span style={{ color: "var(--t3)" }}> (filtered from {matches?.length})</span>}
                {!q && visible.length < sorted.length && <span style={{ color: "var(--t2)" }}> · showing <strong style={{ color: "var(--t1)" }}>{visible.length}</strong></span>}
                {executionTime != null && <span className="hide-phone" style={{ color: "var(--t3)", marginLeft: 8, fontSize: 11, ...MONO }}>{(executionTime / 1000).toFixed(1)}s</span>}
                {snapshot?.pricesDate && (
                  <span style={{ color: "var(--t3)", marginLeft: 8, fontSize: 11 }}>
                    · prices as of {new Date(`${snapshot.pricesDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                  </span>
                )}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {exportError && <span style={{ fontSize: 11, color: "var(--red)" }}>{exportError}</span>}
            {selected.size >= 2 && (
              <button onClick={() => setShowCompare(true)} className="btn-primary" style={{ height: 32, padding: "0 14px", fontSize: 12 }}>
                Compare {selected.size}
              </button>
            )}
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Map())} className="btn-ghost" style={{ height: 32, fontSize: 12 }}>
                Clear
              </button>
            )}
            {onEditColumns && (
              <button onClick={onEditColumns} className="btn-ghost hide-phone" style={{ height: 32, fontSize: 12.5 }} title="Choose which columns the table shows">
                <Columns3 size={14} /> Columns
              </button>
            )}
            {!loading && (matches?.length ?? 0) > 0 && (
              <>
                <button onClick={exportExcel} disabled={exporting || sorted.length === 0} className="btn-primary hide-phone" style={{ height: 32, padding: "0 14px", fontSize: 12.5, opacity: exporting || sorted.length === 0 ? 0.6 : 1 }}>
                  {exporting ? "Exporting…" : "Export Excel"}
                </button>
                <button onClick={exportCsv} className="btn-ghost hide-phone" style={{ height: 32, fontSize: 12.5 }}>
                  CSV
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Search bar + quality filter ── */}
      {!loading && (matches?.length ?? 0) > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Filter by name or ticker…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-base"
              style={{ paddingLeft: 36, background: "var(--s2)" }}
            />
          </div>
          <select
            value={minQuality}
            onChange={e => setMinQuality(Number(e.target.value))}
            aria-label="Minimum quality score"
            style={{
              height: 40, padding: "0 12px", borderRadius: 8,
              border: "1px solid var(--bdr2)", fontSize: 12.5,
              background: minQuality > 0 ? "var(--green-dim)" : "var(--s2)",
              color: minQuality > 0 ? "var(--green)" : "var(--t1)",
              cursor: "pointer", outline: "none", fontFamily: "inherit",
              fontWeight: minQuality > 0 ? 650 : 500,
            }}
          >
            <option value="0">Any quality</option>
            {MIN_QUALITY.map(n => <option key={n} value={n}>Quality {n}+</option>)}
          </select>
        </div>
      )}

      {/* ── The screen's filters, one chip each (describeFilters joins them with " · ") ── */}
      {queryUsed && !loading && (
        <div className="filter-chips" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: notes.length ? 8 : 14 }}>
          {queryUsed.split(" · ").map(part => (
            <span key={part} style={{ fontSize: 12, color: "var(--t2)", background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 6, padding: "3px 9px", lineHeight: 1.5, ...MONO }}>{part}</span>
          ))}
        </div>
      )}
      {notes.length > 0 && !loading && (
        <div className="hide-phone" style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "var(--t3)", marginBottom: 14, lineHeight: 1.5 }}>
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
          None of these {matches.length.toLocaleString("en-IN")} companies {q ? <>match "{search.trim()}"{minQuality > 0 ? ` with a quality score of ${minQuality}+` : ""}</> : `have a quality score of ${minQuality}+`}.
          <button className="btn-ghost" onClick={() => { setSearch(""); setMinQuality(0); }} style={{ marginLeft: 10, height: 28, fontSize: 12 }}>Show all</button>
        </div>
      )}

      {/* ── Phone rows: a compact list, ~6 companies a screen; the whole row
             opens the company, the star saves it ── */}
      {!loading && sorted.length > 0 && isMobile && (
        <div style={{ borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--s2)", overflow: "hidden" }}>
          {visible.map((stock, i) => {
            const day = stock.ret1d;
            const quality = stock.research?.quality, overall = stock.research?.overall;
            // Coloured as the pills and stance words on a computer
            const cells = [
              ["Quality", <span key="q" title={researchTitle(stock.research)} style={{ color: qualityTone(quality).color }}>{quality == null ? "—" : Math.round(quality)}</span>],
              ["Research", <span key="r" title={researchTitle(stock.research)} style={{ color: overallTone(overall).color }}>{overall == null ? "—" : Math.round(overall)}</span>],
              ...columns.slice(0, 3).map(def => {
                const v = colValue(stock, def.id);
                // Coloured as the table's cells are (strong ROCE, Piotroski 7+ green)
                return [def.short, <span key={def.id} style={{ color: valueColor(def, v) }}>{formatValue(def, v)}</span>];
              }),
            ];
            return (
              <div key={stock.symbol} data-tour={i === 0 ? "row" : undefined} role="link" tabIndex={0}
                onClick={() => onAnalyze(stock.symbol)}
                onKeyDown={e => { if (e.key === "Enter") onAnalyze(stock.symbol); }}
                className="phone-row"
                style={{ padding: "12px 12px 12px 14px", borderTop: i ? "1px solid var(--bdr)" : "none", cursor: "pointer" }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", columnGap: 10, alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 650, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{stock.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 650, color: "var(--t1)", textAlign: "right", ...MONO }}>{stock.cmp ? `₹${fmt(stock.cmp, stock.cmp < 100 ? 2 : 0)}` : "—"}</div>
                  <div data-tour={i === 0 ? "row-actions" : undefined} style={{ gridRow: "span 2" }} onClick={e => e.stopPropagation()}>
                    <StarButton symbol={stock.symbol} price={stock.cmp} watched={watchlist.has(stock.symbol)} size={36} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, marginTop: 3 }}>
                    <span style={{ fontSize: 10.5, background: "var(--s3)", color: "var(--t2)", padding: "1px 6px", borderRadius: 5, flexShrink: 0, ...MONO }}>{stock.symbol}</span>
                    <NcavBadge stock={stock} />
                    {stock.sector && <span style={{ fontSize: 11, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{stock.sector}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, textAlign: "right", marginTop: 3, color: day == null ? "var(--t3)" : day >= 0 ? "var(--green)" : "var(--red)", ...MONO }}>
                    {day == null ? "" : `${day >= 0 ? "+" : ""}${day.toFixed(2)}%`}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`, gap: 6, marginTop: 10 }}>
                  {cells.map(([label, value]) => (
                    <div key={label} style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10.5, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 650, whiteSpace: "nowrap", ...MONO }}>{value}</div>
                    </div>
                  ))}
                </div>
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
                  <th title={`Tick up to ${MAX_COMPARE} to compare`} style={{ ...thStyle, padding: "10px 8px", width: RANK_W, minWidth: RANK_W, boxSizing: "border-box", left: 0, zIndex: 4 }}>#</th>
                  <th onClick={() => handleSort("name")} style={{ ...thStyle, color: sortBy === "name" ? "var(--t1)" : "var(--t2)", fontWeight: sortBy === "name" ? 600 : 500, left: RANK_W, zIndex: 4, cursor: "pointer", minWidth: 200, boxShadow: "inset -1px 0 0 var(--bdr)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Stock <SortArrow active={sortBy === "name"} dir={sortDir} /></span>
                  </th>
                  <SortTh label="Quality" title="Quality score out of 100 — business, earnings, balance sheet, governance, growth and valuation" col="quality" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Research" title="Overall research score: quality and valuation blended, trimmed for price swings and data gaps. Not a buy or sell signal." col="overall" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="CMP ₹"   col="cmp"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  {columns.map(def => (
                    <SortTh key={def.id} label={columnLabel(def)} title={def.label} col={def.id} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  ))}
                  <th style={{ ...thStyle, color: "var(--accent)", fontWeight: 600, background: "color-mix(in srgb, var(--accent) 4%, var(--s1))" }}>
                    Price levels
                  </th>
                  <th style={thStyle}>Actions</th>
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
                  // Opaque, so the pinned cells still hide what scrolls under them
                  const rowBg = isSelected ? "linear-gradient(color-mix(in srgb, var(--accent) 6%, transparent), color-mix(in srgb, var(--accent) 6%, transparent)), var(--s2)" : "var(--s2)";
                  return (
                  <tr
                    key={stock.symbol}
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
                      <div title={stock.name} onClick={() => onAnalyze(stock.symbol)} className="stock-link" style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: "-0.01em", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{stock.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: 260, minWidth: 0 }}>
                        <span className="ticker-chip">{stock.symbol}</span>
                        <NcavBadge stock={stock} />
                        {stock.sector && <span title={stock.sector} style={{ fontSize: 10.5, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{stock.sector}</span>}
                      </div>
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

                    <td style={cell}>
                      <div data-tour={i === 0 ? "row-actions" : undefined} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        {/* One solid button per page reads as the action; fifty in a column read as noise */}
                        <button onClick={() => onAnalyze(stock.symbol)} className="btn-ghost" style={{ height: 30, padding: "0 12px", fontSize: 12.5, boxShadow: "none" }}>
                          Analyze
                        </button>
                        <StarButton symbol={stock.symbol} price={stock.cmp} watched={watchlist.has(stock.symbol)} />
                        {bell(stock)}
                        <a
                          href={nseUrl(stock.symbol)} target="_blank" rel="noreferrer" title="Open on NSE" aria-label="Open on NSE"
                          style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--t3)", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms", flexShrink: 0 }}
                        ><ArrowUpRight size={15} /></a>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Show more ── */}
      {!loading && sorted.length > visibleCount && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="btn-ghost" style={{ fontSize: 13, padding: "10px 24px" }}>
            Show {Math.min(PAGE_SIZE, sorted.length - visibleCount)} more · {sorted.length - visibleCount} remaining
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
