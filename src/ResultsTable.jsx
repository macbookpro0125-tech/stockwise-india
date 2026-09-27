import { useState, useEffect } from "react";
import { StarIcon, BellIcon, actionButtonStyle } from "./icons.jsx";
import { useWatchlist, toggleWatch } from "./watchlist.js";
import CreateAlertModal from "./CreateAlertModal.jsx";

// Ported from stock-screener's src/components/ResultsTable.jsx — same columns,
// score badge, buy phases with 52-week range, NCAV badge, watchlist star,
// sorting, filter box, score filter and paging. Differences: every row arrives
// already scored (no lazy enrichment), and compare and Excel export aren't in
// this app yet.

const PAGE_SIZE = 50;

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

function SortTh({ label, col, sortBy, sortDir, onSort, accent }) {
  const active = sortBy === col;
  return (
    <th
      onClick={() => onSort(col)}
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

export function RangeBar({ low, high, cmp }) {
  if (!low || !high || !cmp || high <= low) return null;
  const pct = Math.min(98, Math.max(2, ((cmp - low) / (high - low)) * 100));
  const fromLow = Math.round(((cmp - low) / low) * 100);
  const belowHigh = Math.round(((high - cmp) / high) * 100);
  const aboveHigh = cmp > high;
  return (
    <div style={{ marginTop: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--t3)", marginBottom: 3, ...MONO }}>
        <span>L {low.toLocaleString("en-IN")}</span>
        <span>{high.toLocaleString("en-IN")} H</span>
      </div>
      <div style={{ position: "relative", height: 3, borderRadius: 99, background: "linear-gradient(to right, #FF453A 0%, #FFD60A 50%, #30D158 100%)", marginBottom: 4 }}>
        <div style={{
          position: "absolute", top: "50%",
          left: `calc(${pct}% - 4px)`,
          transform: "translateY(-50%)",
          width: 8, height: 8, borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.6)",
        }} />
      </div>
      <div style={{ fontSize: 9, color: "var(--t3)", ...MONO }}>
        {cmp < low
          ? <span style={{ color: "var(--red)" }}>↓ below 52W L</span>
          : <>+{fromLow}% from L</>}
        {aboveHigh
          ? <span style={{ color: "var(--red)", marginLeft: 6 }}>↑ above 52W H</span>
          : <span style={{ marginLeft: 6 }}>{belowHigh}% below H</span>}
      </div>
    </div>
  );
}

function FvCell({ stock }) {
  const { cmp, safeBuyPrice: p1, p2, p3, fairValue } = stock;
  if (!p1) return (
    <div style={{ fontSize: 11, minWidth: 120, minHeight: 60 }}>
      <span style={{ color: "var(--t3)" }}>—</span>
      <RangeBar low={stock.low52w} high={stock.high52w} cmp={cmp} />
    </div>
  );
  return (
    <div style={{ lineHeight: 1.6, fontSize: 11, minWidth: 120, minHeight: 60 }}>
      {[["P1 30%", p1], ["P2 30%", p2], ["P3 40%", p3]].map(([label, price]) => {
        const hit = cmp != null && price != null && cmp <= price;
        return (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: hit ? "var(--accent)" : "var(--t3)", fontWeight: hit ? 600 : 400 }}>{label}</span>
            <span style={{ color: hit ? "var(--accent)" : "var(--t3)", fontWeight: hit ? 700 : 500, ...MONO }}>
              {price ? price.toLocaleString("en-IN") : "—"}
              {hit && <span style={{ marginLeft: 3, color: "var(--green)" }}>✓</span>}
            </span>
          </div>
        );
      })}
      {fairValue && (
        <div style={{ color: "var(--t3)", fontSize: 10, marginTop: 1, ...MONO }}>
          {/* The projection, not the anchor: P1–P3 are a discount to today's fair value */}
          FV27 {fairValue.toLocaleString("en-IN")}
        </div>
      )}
      {/* Under 3 years of P/E history the valuation falls back to today's P/E,
          which makes fair value ≈ the current price by construction. */}
      {stock.valuationPeBasis === "current" && (
        <div title="Fewer than 3 years of P/E history, so this uses today's P/E — fair value then tracks the current price. Open the stock to set your own P/E." style={{ color: "var(--yellow)", fontSize: 9, marginTop: 2 }}>
          at today's P/E
        </div>
      )}
      <RangeBar low={stock.low52w} high={stock.high52w} cmp={cmp} />
    </div>
  );
}

function StarButton({ symbol, watched, size = 30 }) {
  return (
    <button
      onClick={() => toggleWatch(symbol)}
      title={watched ? "Remove from watchlist" : "Add to watchlist"}
      style={actionButtonStyle({ active: watched, activeColor: "#FFD60A", size })}
    >
      <StarIcon filled={watched} />
    </button>
  );
}

export default function ResultsTable({ matches, loading, onAnalyze, totalMatches, queryUsed, unsupported = [], notes = [], executionTime, snapshot, netNet = false, noun = "stocks", emptyTitle = "No stocks matched your criteria", emptyHint = "Try relaxing some filters" }) {
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

  const handleSort = col => {
    if (sortBy === col) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const q = search.trim().toLowerCase();
  const textFiltered = q
    ? (matches || []).filter(s => s.name?.toLowerCase().includes(q) || s.symbol?.toLowerCase().includes(q))
    : (matches || []);
  const filtered = minScore > 0 ? textFiltered.filter(s => (score10(s) ?? 0) >= minScore) : textFiltered;

  const sortVal = s => {
    if (sortBy === "score") return score10(s);
    if (sortBy === "ncavPct") return s.ncavCr > 0 && s.marketCapCr != null ? s.marketCapCr / s.ncavCr : Infinity;
    if (sortBy === "name") return s.name?.toLowerCase();
    return s[sortBy];
  };

  const sorted = [...filtered].sort((a, b) => {
    const av = sortVal(a) ?? -Infinity;
    const bv = sortVal(b) ?? -Infinity;
    if (av === bv) return sortBy === "score" ? (b.roce ?? -Infinity) - (a.roce ?? -Infinity) : 0;
    return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const visible = sorted.slice(0, visibleCount);

  const exportCsv = () => {
    const cols = ["Rank", "Name", "Symbol", "Score", "CMP", "PE", "ROCE", "ROE", "OPM", "Promoter%", "FII%", "DII%", "MarketCap(Cr)", "DivYield", "P1", "P2", "P3", "FairValue2027", "52WLow", "52WHigh"];
    const r1 = v => (v == null ? "" : Math.round(v * 10) / 10);
    const rows = sorted.map((s, i) => [
      i + 1, `"${String(s.name).replace(/"/g, '""')}"`, s.symbol, `${s.score.green}/${s.score.applicable}`,
      r1(s.cmp), r1(s.pe), r1(s.roce), r1(s.roe), r1(s.opm), r1(s.promoterPct), r1(s.fiiPct), r1(s.diiPct),
      r1(s.marketCapCr), r1(s.divYield), s.safeBuyPrice ?? "", s.p2 ?? "", s.p3 ?? "", s.fairValue ?? "",
      s.low52w ?? "", s.high52w ?? "",
    ]);
    const csv = [cols.join(","), ...rows.map(r => r.join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "stockwise-india-discover.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const noData = !loading && (!matches || matches.length === 0);
  const cell = { padding: "8px 10px", borderBottom: "1px solid var(--bdr)" };
  const numCell = (val, threshold) => ({ color: val ? (Number(val) >= threshold ? "var(--green)" : "var(--t2)") : "var(--t3)" });

  return (
    <div style={{ animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) both" }}>
      {alertFor && <CreateAlertModal stock={alertFor} onClose={() => setAlertFor(null)} />}

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
          {!loading && (matches?.length ?? 0) > 0 && (
            <button onClick={exportCsv} className="btn-ghost" style={{ height: 32, fontSize: 12 }}>
              CSV
            </button>
          )}
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
                {[["CMP", stock.cmp ? `₹${fmt(stock.cmp)}` : "—"], ["P/E", stock.pe ? fmt(stock.pe, 1) : "—"], ["ROCE", stock.roce != null ? `${fmt(stock.roce)}%` : "—"], ["Mkt Cap", fmtCr(stock.marketCapCr)], ["ROE", stock.roe != null ? `${fmt(stock.roe)}%` : "—"], ["Promo", stock.promoterPct != null ? `${fmt(stock.promoterPct)}%` : "—"]].map(([label, val]) => (
                  <div key={label} style={{ background: "var(--s1)", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", ...MONO }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onAnalyze(stock.symbol)} className="btn-primary" style={{ flex: 1, height: 36, fontSize: 12 }}>Analyze →</button>
                <StarButton symbol={stock.symbol} watched={watchlist.has(stock.symbol)} size={36} />
                {bell(stock, 36)}
                <a href={nseUrl(stock.symbol)} target="_blank" rel="noreferrer" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--s1)", color: "var(--t2)", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>↗</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Desktop table ── */}
      {!isMobile && !noData && (
        <div style={{ borderRadius: 14, border: "1px solid var(--bdr2)", overflow: "hidden", boxShadow: "var(--sh-sm)" }}>
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "min(70vh, 780px)" }}>
            <table className="data-table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 8px", fontSize: 10, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--bdr2)", background: "var(--s1)", width: 44, position: "sticky", left: 0, top: 0, zIndex: 4 }}>#</th>
                  <th onClick={() => handleSort("name")} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 600, color: sortBy === "name" ? "var(--accent)" : "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--bdr2)", background: "var(--s1)", position: "sticky", left: 44, top: 0, zIndex: 4, cursor: "pointer", whiteSpace: "nowrap", minWidth: 200, boxShadow: "2px 0 8px rgba(0,0,0,0.3)" }}>
                    Stock {sortBy === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <SortTh label="Score"   col="score"       sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="CMP ₹"   col="cmp"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="P/E"     col="pe"          sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="ROCE %"  col="roce"        sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="ROE %"   col="roe"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Promo %" col="promoterPct" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Mkt Cap" col="marketCapCr" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Div %"   col="divYield"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--bdr2)", background: "rgba(0,224,190,0.03)", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 3 }}>
                    Buy Phases
                  </th>
                  <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--bdr2)", background: "var(--s1)", position: "sticky", top: 0, zIndex: 3 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 12 }).map((_, j) => (
                      <td key={j} style={cell}>
                        <div className="skeleton-pulse" style={{ height: 13, borderRadius: 4, width: j === 1 ? 140 : j === 10 ? 100 : 55 }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && visible.map((stock, i) => (
                  <tr
                    key={stock.symbol}
                    style={{ background: "var(--s2)", transition: "background 100ms" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--s3)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--s2)"; }}
                  >
                    <td style={{ ...cell, padding: "8px 8px", position: "sticky", left: 0, background: "var(--s2)", zIndex: 1, width: 44 }}>
                      <span style={{ fontSize: 11, color: "var(--t3)", ...MONO }}>{i + 1}</span>
                    </td>

                    <td style={{ ...cell, minWidth: 200, position: "sticky", left: 44, background: "var(--s2)", zIndex: 1, boxShadow: "2px 0 8px rgba(0,0,0,0.25)" }}>
                      <div title={stock.name} onClick={() => onAnalyze(stock.symbol)} style={{ fontWeight: 700, fontSize: 13, color: "var(--accent)", letterSpacing: "-0.01em", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240, cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(0,224,190,0.35)", textUnderlineOffset: 3 }}>{stock.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, background: "var(--s3)", color: "var(--t2)", padding: "1px 7px", borderRadius: 5, ...MONO }}>{stock.symbol}</span>
                        <NcavBadge stock={stock} />
                      </div>
                    </td>

                    <td style={cell}><ScoreBadge score={stock.score.green} max={stock.score.applicable} /></td>

                    <td style={{ ...cell, fontWeight: 500, color: "var(--t1)", ...MONO, whiteSpace: "nowrap" }}>
                      {stock.cmp ? `₹${fmt(stock.cmp)}` : "—"}
                    </td>

                    <td style={{ ...cell, color: "var(--t2)", ...MONO }}>{stock.pe ? fmt(stock.pe, 1) : "—"}</td>

                    <td style={{ ...cell, ...MONO, ...numCell(stock.roce, 18) }}>{stock.roce != null ? `${fmt(stock.roce, 1)}%` : "—"}</td>

                    <td style={{ ...cell, ...MONO, ...numCell(stock.roe, 15) }}>{stock.roe != null ? `${fmt(stock.roe, 1)}%` : "—"}</td>

                    <td style={{ ...cell, ...MONO }}>
                      {stock.promoterPct != null ? (
                        <span style={{ color: stock.promoterPct >= 50 ? "var(--green)" : stock.promoterPct < 30 ? "var(--red)" : "var(--t2)" }}>
                          {fmt(stock.promoterPct, 1)}%
                        </span>
                      ) : "—"}
                    </td>

                    <td style={{ ...cell, color: "var(--t2)", ...MONO }}>{fmtCr(stock.marketCapCr)}</td>

                    <td style={{ ...cell, color: "var(--t2)", ...MONO }}>{stock.divYield ? `${fmt(stock.divYield, 1)}%` : "—"}</td>

                    <td style={{ ...cell, background: "rgba(0,224,190,0.02)" }}><FvCell stock={stock} /></td>

                    <td style={cell}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <button onClick={() => onAnalyze(stock.symbol)} className="btn-primary" style={{ height: 30, padding: "0 12px", fontSize: 12, borderRadius: 8, boxShadow: "none" }}>
                          Analyze
                        </button>
                        <StarButton symbol={stock.symbol} watched={watchlist.has(stock.symbol)} />
                        {bell(stock)}
                        <a
                          href={nseUrl(stock.symbol)} target="_blank" rel="noreferrer" title="Open on NSE"
                          style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--t3)", fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms" }}
                        >↗</a>
                      </div>
                    </td>
                  </tr>
                ))}
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
