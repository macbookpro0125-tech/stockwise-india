import { useState, useEffect } from "react";
import { StarIcon, BellIcon, actionButtonStyle } from "./icons.jsx";
import { useWatchlist, toggleWatch } from "./watchlist.js";
import CreateAlertModal from "./CreateAlertModal.jsx";
import CompareView from "./CompareView.jsx";
import { exportDiscoverExcel } from "./exportExcel.js";
import { formatValue, valueColor } from "./screener/meta.js";

// A metric column's header, with its unit as the table always showed it
// ("ROCE %", "CMP ₹")
const columnLabel = def => (def.unit === "%" ? `${def.short} %` : def.unit === "₹" ? `${def.short} ₹` : def.short);

// Ported from stock-screener's src/components/ResultsTable.jsx — same columns,
// score badge, buy phases with 52-week range, NCAV badge, watchlist star,
// compare (up to 4), Excel and CSV export, sorting, filter box, score filter
// and paging. Every row arrives already scored, so there's no lazy enrichment.

const PAGE_SIZE = 50;
const MAX_COMPARE = 4;
// Wide enough for the compare box and a four-digit rank; the name column is
// pinned right after it.
const RANK_W = 60;

function scoreStyle(score, max) {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.7) return { border: "var(--green-bdr)", bg: "var(--green-dim)", color: "var(--green)", dot: "#30D158" };
  if (pct >= 0.4) return { border: "var(--yellow-bdr)", bg: "var(--yellow-dim)", color: "var(--yellow)", dot: "#FFD60A" };
  return { border: "var(--red-bdr)", bg: "var(--red-dim)", color: "var(--red)", dot: "#FF453A" };
}

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

const MONO = { fontFamily: '"SF Mono","SFMono-Regular",Menlo,monospace', fontVariantNumeric: "tabular-nums" };

// Green count scaled to /10 — a bank is scored out of 8, so raw counts aren't
// comparable across rows (same normalisation as the original's scoreOf).
const score10 = s => (s.score?.applicable ? Math.round((s.score.green / s.score.applicable) * 10) : null);

const nseUrl = symbol => `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`;

function SortTh({ label, title, col, sortBy, sortDir, onSort, accent }) {
  const active = sortBy === col;
  return (
    <th
      onClick={() => onSort(col)}
      title={title}
      style={{
        padding: "8px 10px",
        textAlign: "left",
        fontSize: 10,
        fontWeight: 600,
        color: active ? "var(--accent)" : "var(--t3)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
        borderBottom: "1px solid var(--bdr2)",
        background: accent ? "rgba(0,224,190,0.03)" : "var(--s1)",
        transition: "color 120ms",
        position: "sticky",
        top: 0,
        zIndex: 3,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
        {label}
        <span style={{ opacity: active ? 1 : 0, fontSize: 8, transition: "opacity 120ms" }}>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "▼"}
        </span>
      </span>
    </th>
  );
}

export function ScoreBadge({ score, max = 10 }) {
  const ss = scoreStyle(score, max);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 999,
      border: `1px solid ${ss.border}`,
      background: ss.bg, color: ss.color,
      fontSize: 11, fontWeight: 700,
      ...MONO,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: ss.dot, flexShrink: 0 }} />
      {score}/{max}
    </span>
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

// Buy phases in two lines: the three prices (✓ once today's price reaches
// one), then the 52-week bar and the fair value. Notes about how the fair
// value was made sit behind a flag's tooltip.
function FvCell({ stock }) {
  const { cmp, safeBuyPrice: p1, p2, p3, fairValue } = stock;
  const notes = [
    stock.valuationPeBasis === "current" && "Fewer than 3 usable years of P/E history, so this uses today's P/E — fair value then tracks the current price.",
    stock.epsJump && `This year's EPS (Rs ${stock.epsJump.eps.toFixed(2)}) is more than 3× its usual Rs ${stock.epsJump.usualEps.toFixed(2)} and the share price hasn't followed — how a one-off gain looks. Buy prices use the usual EPS.`,
  ].filter(Boolean);
  const fvLabel = stock.fyEnd ? `FV${String(Number(stock.fyEnd.slice(0, 4)) + 2).slice(2)}` : "FV";
  return (
    <div style={{ fontSize: 11, lineHeight: 1.5, minWidth: 190, ...MONO }}>
      {p1 ? (
        <div style={{ display: "flex", gap: 8, whiteSpace: "nowrap" }}>
          {[["P1", p1], ["P2", p2], ["P3", p3]].map(([label, price]) => {
            const hit = cmp != null && price != null && cmp <= price;
            return (
              <span key={label} style={{ color: hit ? "var(--accent)" : "var(--t3)", fontWeight: hit ? 700 : 500 }}>
                <span style={{ fontWeight: 500, opacity: 0.8 }}>{label}</span> {price ? price.toLocaleString("en-IN") : "—"}{hit && <span style={{ color: "var(--green)" }}>✓</span>}
              </span>
            );
          })}
        </div>
      ) : (
        <div style={{ color: "var(--t3)" }}>No buy prices</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, color: "var(--t3)", fontSize: 10, whiteSpace: "nowrap" }}>
        <MiniRange low={stock.low52w} high={stock.high52w} cmp={cmp} />
        {fairValue ? <span>{fvLabel} {fairValue.toLocaleString("en-IN")}</span> : null}
        {notes.length > 0 && (
          <span title={`${notes.join(" ")} Open the stock to set your own figures.`} style={{ color: "var(--yellow)", cursor: "help" }}>⚑</span>
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
      style={actionButtonStyle({ active: watched, activeColor: "#FFD60A", size })}
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
  const [sortBy, setSortBy] = useState("score");
  const [sortDir, setSortDir] = useState("desc");

  // Net-net results are most useful ordered by discount to NCAV (cheapest first),
  // so the deepest Graham bargains surface above shallower net-nets.
  useEffect(() => {
    if (netNet) { setSortBy("ncavPct"); setSortDir("asc"); }
    else if (sortBy === "ncavPct") { setSortBy("score"); setSortDir("desc"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netNet, matches]);

  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState(0);
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
  const filtered = minScore > 0 ? textFiltered.filter(s => (score10(s) ?? 0) >= minScore) : textFiltered;

  // A column's value: from the metrics the screen was asked for, else the
  // row's own field (cmp and the table's fixed fields)
  const colValue = (s, id) => s.values?.[id] ?? s[id] ?? null;
  const sortVal = s => {
    if (sortBy === "score") return score10(s);
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
    if (av === bv) return sortBy === "score" ? (b.roce ?? -Infinity) - (a.roce ?? -Infinity) : 0;
    return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const visible = sorted.slice(0, visibleCount);

  // Columns chosen or filtered on that the file doesn't already have
  const CSV_FIXED = new Set(["pe", "roce", "roe", "opm", "promoterPct", "fiiPct", "diiPct", "marketCapCr", "divYield"]);
  const extraColumns = columns.filter(def => !CSV_FIXED.has(def.id));

  const exportCsv = () => {
    const quote = v => `"${String(v).replace(/"/g, '""')}"`;
    const cols = ["Rank", "Name", "Symbol", "Sector", "Score", "CMP", "PE", "ROCE", "ROE", "OPM", "Promoter%", "FII%", "DII%", "MarketCap(Cr)", "DivYield", "P1", "P2", "P3", "FairValue2Y", "52WLow", "52WHigh", ...extraColumns.map(def => quote(def.label))];
    const r1 = v => (v == null ? "" : Math.round(v * 10) / 10);
    const rows = sorted.map((s, i) => [
      i + 1, quote(s.name), s.symbol, s.sector ? quote(s.sector) : "", `${s.score.green}/${s.score.applicable}`,
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
  const cell = { padding: "8px 10px", borderBottom: "1px solid var(--bdr)" };

  return (
    <div style={{ animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>
      {alertFor && <CreateAlertModal stock={alertFor} onClose={() => setAlertFor(null)} />}
      {showCompare && selected.size >= 2 && (
        <CompareView stocks={[...selected.values()]} onClose={() => setShowCompare(false)} />
      )}

      {/* ── Top bar ── */}
      {(totalMatches != null || loading) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "14px 0", marginBottom: 12, borderBottom: "1px solid var(--bdr)" }}>
          <div style={{ fontSize: 13, color: "var(--t1)" }}>
            {loading ? (
              <span style={{ color: "var(--t3)" }}>Scanning market…</span>
            ) : (
              <span>
                <span style={{ color: "var(--t2)" }}>Found </span>
                <strong style={{ color: "var(--t1)" }}>{q ? filtered.length.toLocaleString() : totalMatches?.toLocaleString()}</strong>
                <span style={{ color: "var(--t2)" }}> {noun}</span>
                {(q || minScore > 0) && filtered.length !== (matches?.length ?? 0) && <span style={{ color: "var(--t3)" }}> (filtered from {matches?.length})</span>}
                {!q && visible.length < sorted.length && <span style={{ color: "var(--t2)" }}> · showing <strong style={{ color: "var(--t1)" }}>{visible.length}</strong></span>}
                {executionTime != null && <span style={{ color: "var(--t3)", marginLeft: 8, fontSize: 11, ...MONO }}>{(executionTime / 1000).toFixed(1)}s</span>}
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
              <button onClick={onEditColumns} className="btn-ghost" style={{ height: 32, fontSize: 12 }} title="Choose which columns the table shows">
                ⊕ Columns
              </button>
            )}
            {!loading && (matches?.length ?? 0) > 0 && (
              <>
                <button onClick={exportExcel} disabled={exporting || sorted.length === 0} className="btn-primary" style={{ height: 32, padding: "0 14px", fontSize: 12, boxShadow: "none", opacity: exporting || sorted.length === 0 ? 0.6 : 1 }}>
                  {exporting ? "Exporting…" : "Export Excel"}
                </button>
                <button onClick={exportCsv} className="btn-ghost" style={{ height: 32, fontSize: 12 }}>
                  CSV
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Search bar + score filter ── */}
      {!loading && (matches?.length ?? 0) > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--t3)", pointerEvents: "none" }}>⌕</span>
            <input
              type="text"
              placeholder="Filter by name or ticker…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-base"
              style={{ paddingLeft: 34 }}
            />
          </div>
          <select
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
            style={{
              height: 42, padding: "0 12px", borderRadius: 10,
              border: "1px solid var(--bdr2)", fontSize: 12,
              background: minScore > 0 ? "var(--green-dim)" : "var(--s2)",
              color: minScore > 0 ? "var(--green)" : "var(--t2)",
              cursor: "pointer", outline: "none", fontFamily: "inherit",
              fontWeight: minScore > 0 ? 700 : 400,
            }}
          >
            <option value="0">All Scores</option>
            {[4, 5, 6, 7, 8, 9].map(n => <option key={n} value={n}>{n}+ / 10</option>)}
            <option value="10">10 / 10</option>
          </select>
        </div>
      )}

      {/* ── Query chip ── */}
      {queryUsed && !loading && (
        <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 14, padding: "9px 14px", background: "var(--s1)", borderRadius: 9, border: "1px solid var(--bdr)", wordBreak: "break-word", lineHeight: 1.7 }}>
          <span style={{ fontWeight: 600, color: "var(--t2)", marginRight: 4 }}>Query</span>
          {queryUsed}
        </div>
      )}
      {notes.length > 0 && !loading && (
        <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 14, padding: "9px 14px", background: "var(--s1)", borderRadius: 9, border: "1px dashed var(--bdr2)", lineHeight: 1.7 }}>
          {notes.map(n => <div key={n}>{n}</div>)}
        </div>
      )}
      {unsupported.length > 0 && !loading && (
        <div style={{ fontSize: 11, color: "var(--yellow)", marginBottom: 14, padding: "9px 14px", background: "var(--yellow-dim)", borderRadius: 9, border: "1px solid var(--yellow-bdr)", lineHeight: 1.7 }}>
          Not applied (no data yet): {unsupported.join(", ")}
        </div>
      )}

      {/* The name box or score filter can empty the list on their own */}
      {!loading && (matches?.length ?? 0) > 0 && sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--t2)", fontSize: 13, border: "1px dashed var(--bdr2)", borderRadius: 14 }}>
          None of these {matches.length.toLocaleString("en-IN")} companies {q ? <>match "{search.trim()}"{minScore > 0 ? ` with a score of ${minScore === 10 ? "10/10" : `${minScore}+`}` : ""}</> : `have a score of ${minScore === 10 ? "10/10" : `${minScore}+`}`}.
          <button className="btn-ghost" onClick={() => { setSearch(""); setMinScore(0); }} style={{ marginLeft: 10, height: 28, fontSize: 12 }}>Show all</button>
        </div>
      )}

      {/* ── Mobile cards ── */}
      {!loading && sorted.length > 0 && isMobile && (
        <div>
          {visible.map(stock => (
            <div key={stock.symbol} style={{ borderRadius: 14, border: "1px solid var(--bdr2)", padding: 16, marginBottom: 10, background: "var(--s2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 3 }}>{stock.name}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, background: "var(--s3)", color: "var(--t2)", padding: "1px 7px", borderRadius: 5 }}>{stock.symbol}</span>
                    <NcavBadge stock={stock} />
                  </div>
                </div>
                <ScoreBadge score={stock.score.green} max={stock.score.applicable} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[["CMP", stock.cmp ? `₹${fmt(stock.cmp)}` : "—", "var(--t1)"], ...columns.slice(0, 5).map(def => { const v = colValue(stock, def.id); return [def.short, formatValue(def, v), v == null ? "var(--t3)" : def.signed ? valueColor(def, v) : "var(--t1)"]; })].map(([label, val, color]) => (
                  <div key={label} style={{ background: "var(--s1)", borderRadius: 8, padding: "8px 10px", minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color, ...MONO }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onAnalyze(stock.symbol)} className="btn-primary" style={{ flex: 1, height: 36, fontSize: 12 }}>Analyze →</button>
                <StarButton symbol={stock.symbol} price={stock.cmp} watched={watchlist.has(stock.symbol)} size={36} />
                {bell(stock, 36)}
                <a href={nseUrl(stock.symbol)} target="_blank" rel="noreferrer" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--s1)", color: "var(--t2)", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>↗</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Desktop table ── */}
      {!isMobile && !noData && (loading || sorted.length > 0) && (
        <div style={{ borderRadius: 14, border: "1px solid var(--bdr2)", overflow: "hidden", boxShadow: "var(--sh-sm)" }}>
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "min(70vh, 780px)" }}>
            <table className="data-table" style={{ minWidth: 560 + columns.length * 80 }}>
              <thead>
                <tr>
                  <th title={`Tick up to ${MAX_COMPARE} to compare`} style={{ padding: "8px 8px", fontSize: 10, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--bdr2)", background: "var(--s1)", width: RANK_W, minWidth: RANK_W, boxSizing: "border-box", position: "sticky", left: 0, top: 0, zIndex: 4 }}>#</th>
                  <th onClick={() => handleSort("name")} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 600, color: sortBy === "name" ? "var(--accent)" : "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--bdr2)", background: "var(--s1)", position: "sticky", left: RANK_W, top: 0, zIndex: 4, cursor: "pointer", whiteSpace: "nowrap", minWidth: 200, boxShadow: "2px 0 8px rgba(0,0,0,0.3)" }}>
                    Stock {sortBy === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <SortTh label="Score"   col="score"       sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="CMP ₹"   col="cmp"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  {columns.map(def => (
                    <SortTh key={def.id} label={columnLabel(def)} title={def.label} col={def.id} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  ))}
                  <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--bdr2)", background: "rgba(0,224,190,0.03)", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 3 }}>
                    Buy Phases
                  </th>
                  <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--bdr2)", background: "var(--s1)", position: "sticky", top: 0, zIndex: 3 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 + columns.length }).map((_, j) => (
                      <td key={j} style={cell}>
                        <div className="skeleton-pulse" style={{ height: 13, borderRadius: 4, width: j === 1 ? 140 : j === 4 + columns.length ? 100 : 55 }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && visible.map((stock, i) => {
                  const isSelected = selected.has(stock.symbol);
                  // Opaque, so the pinned cells still hide what scrolls under them
                  const rowBg = isSelected ? "linear-gradient(rgba(0,224,190,0.06), rgba(0,224,190,0.06)), var(--s2)" : "var(--s2)";
                  return (
                  <tr
                    key={stock.symbol}
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

                    <td style={{ ...cell, minWidth: 200, position: "sticky", left: RANK_W, background: rowBg, zIndex: 1, boxShadow: "2px 0 8px rgba(0,0,0,0.25)" }}>
                      <div title={stock.name} onClick={() => onAnalyze(stock.symbol)} style={{ fontWeight: 700, fontSize: 13, color: "var(--accent)", letterSpacing: "-0.01em", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240, cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(0,224,190,0.35)", textUnderlineOffset: 3 }}>{stock.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: 260, minWidth: 0 }}>
                        <span style={{ fontSize: 10, background: "var(--s3)", color: "var(--t2)", padding: "1px 7px", borderRadius: 5, flexShrink: 0, ...MONO }}>{stock.symbol}</span>
                        <NcavBadge stock={stock} />
                        {stock.sector && <span title={stock.sector} style={{ fontSize: 10.5, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{stock.sector}</span>}
                      </div>
                    </td>

                    <td style={cell}><ScoreBadge score={stock.score.green} max={stock.score.applicable} /></td>

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

                    <td style={{ ...cell, background: "rgba(0,224,190,0.02)" }}><FvCell stock={stock} /></td>

                    <td style={cell}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <button onClick={() => onAnalyze(stock.symbol)} className="btn-primary" style={{ height: 30, padding: "0 12px", fontSize: 12, borderRadius: 8, boxShadow: "none" }}>
                          Analyze
                        </button>
                        <StarButton symbol={stock.symbol} price={stock.cmp} watched={watchlist.has(stock.symbol)} />
                        {bell(stock)}
                        <a
                          href={nseUrl(stock.symbol)} target="_blank" rel="noreferrer" title="Open on NSE"
                          style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--t3)", fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms" }}
                        >↗</a>
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
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>◎</div>
          <p style={{ fontSize: 15, color: "var(--t2)", marginBottom: 6, fontWeight: 500 }}>{emptyTitle}</p>
          <p style={{ fontSize: 13, color: "var(--t3)" }}>{emptyHint}</p>
        </div>
      )}
    </div>
  );
}
