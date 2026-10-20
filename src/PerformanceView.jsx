import { useState, useEffect } from "react";
import { Camera, ChevronDown } from "lucide-react";
import { api } from "./api.js";

// Ported from stock-screener's src/components/PerformancePanel.jsx: each
// strategy's recorded picks against today's prices. Snapshots are taken
// automatically every few days (and on demand here) and shared by everyone,
// since the strategies are the same for everyone.

const MONO = { fontVariantNumeric: "tabular-nums" };

function fmtDate(d) {
  const [y, m, day] = (d || "").split("-").map(Number);
  if (!y) return d;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, day, 12)));
}

// Whole days from an IST snapshot date to the current IST day
function daysSince(dateStr) {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  if (!y) return null;
  const todayIst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [ny, nm, nd] = todayIst.split("-").map(Number);
  return Math.round((Date.UTC(ny, nm - 1, nd) - Date.UTC(y, m - 1, d)) / 86400000);
}

function RetBadge({ pct }) {
  if (pct == null) return <span style={{ fontSize: 11, color: "var(--t3)", ...MONO }}>—</span>;
  const color = pct > 0 ? "var(--green)" : pct < 0 ? "var(--red)" : "var(--t2)";
  return <span style={{ fontSize: 12, fontWeight: 700, color, ...MONO }}>{pct > 0 ? "+" : ""}{pct.toFixed(1)}%</span>;
}

function fmtPct(pct) {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

// A forward return under three months old is noise that reads as a claim
// (two weeks' +5.2% looked like a result), so it's held back until then
const MIN_TRACK_DAYS = 91;
const tooEarly = days => days != null && days < MIN_TRACK_DAYS;
const readyOn = date => {
  const [y, m, d] = (date || "").split("-").map(Number);
  return y ? fmtDate(new Date(Date.UTC(y, m - 1, d) + MIN_TRACK_DAYS * 86400000).toISOString().slice(0, 10)) : null;
};
function TooEarly({ days }) {
  return <span style={{ fontSize: 11, color: "var(--t3)", whiteSpace: "nowrap" }}>Too early — {days} day{days === 1 ? "" : "s"} tracked</span>;
}

// Name · entry · current · return, shared by the header and every pick row
const ROW_GRID = { display: "grid", gridTemplateColumns: "minmax(0,1fr) 78px 78px 62px", gap: 8, alignItems: "center" };

export default function PerformanceView({ onOpenStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snapping, setSnapping] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [studyOpen, setStudyOpen] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.performance());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const takeSnapshot = async () => {
    setSnapping(true);
    setError(null);
    try {
      await api.takePerformanceSnapshot();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSnapping(false);
    }
  };

  const study = data?.researchStudy;
  const empty = !loading && (!data || (!data.presets.length && !study?.cohortCount));

  return (
    <div style={{ padding: "8px var(--page-x) 16px", animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="hide-phone" style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Strategy performance</div>
          <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 3, maxWidth: 560, lineHeight: 1.5 }}>
            How each strategy's top 10 has moved since it was recorded — a record of past screen results, not a forecast or advice.
          </div>
          {data?.snapshotCount > 0 && (
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 3 }}>
              {data.snapshotCount} snapshot{data.snapshotCount === 1 ? "" : "s"} · prices for {data.pricedTickers}/{data.totalTickers} stocks
            </div>
          )}
        </div>
        <button onClick={takeSnapshot} disabled={snapping} className="btn-ghost" style={{ height: 32, padding: "0 14px", fontSize: 12.5, fontWeight: 500, opacity: snapping ? 0.6 : 1, cursor: snapping ? "wait" : "pointer" }}>
          {snapping ? "Recording…" : <><Camera size={14} /> {study?.cohortCount || study?.recording === false ? "Take snapshot now" : "Record baseline"}</>}
        </button>
      </div>

      {error && (
        <div style={{ border: "1px solid var(--red-bdr)", background: "var(--red-dim)", borderRadius: 10, padding: "10px 14px", fontSize: 12, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--red)" }}>{error}</span>
          <button onClick={load} className="btn-ghost" style={{ height: 26, padding: "0 12px", fontSize: 10, borderRadius: 7, flexShrink: 0 }}>Retry</button>
        </div>
      )}

      {loading && <div style={{ color: "var(--t3)", fontSize: 12, padding: 20 }}>Loading performance…</div>}

      {empty && !error && (
        <div style={{ border: "1px dashed var(--bdr2)", borderRadius: 14, padding: "28px 20px", textAlign: "center", color: "var(--t3)", fontSize: 12, lineHeight: 1.7 }}>
          No snapshots yet. Take one now to record each strategy's current top picks —<br />
          come back in a few weeks to see which strategies actually made money.
        </div>
      )}

      {!loading && study?.recording === false && (
        <p style={{ fontSize: 11, color: "var(--t3)", margin: "0 0 14px", lineHeight: 1.5 }}>Background updates are off on this copy, so the monthly research-score check isn't recorded here. It builds up where the app updates itself daily.</p>
      )}

      {!loading && study?.cohortCount > 0 && (
        <section style={{ border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--s2)", padding: 15, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>Prospective research-score study</div>
              <div style={{ fontSize: 11.5, color: "var(--t2)", marginTop: 4, lineHeight: 1.5 }}>
                Frozen monthly score cohorts compared with the NIFTY 500. {study.cohortCount} cohort{study.cohortCount === 1 ? "" : "s"} recorded · latest prices {fmtDate(study.asOf)}.
              </div>
            </div>
            <span style={{ fontSize: 10.5, color: "var(--t3)", border: "1px solid var(--bdr2)", borderRadius: 99, padding: "4px 8px" }}>Forward tracking · not a backtest</span>
          </div>
          {study.cohorts.slice().reverse().map(cohort => {
            const expanded = studyOpen === cohort.date;
            const daysHeld = daysSince(cohort.date);
            const early = tooEarly(daysHeld);
            return (
              <div key={cohort.date} style={{ borderTop: "1px solid var(--bdr)", paddingTop: 8, marginTop: 8 }}>
                <button onClick={() => setStudyOpen(expanded ? null : cohort.date)} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 0", color: "var(--t1)", background: "none", border: 0, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{fmtDate(cohort.date)} · {cohort.companies.toLocaleString("en-IN")} scored · v{cohort.scoreVersion}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--t2)", fontSize: 11, ...MONO }}>
                    {early ? <TooEarly days={daysHeld} /> : cohort.benchmarkReturnPct == null ? "Benchmark unavailable" : `NIFTY 500 ${fmtPct(cohort.benchmarkReturnPct)}`}
                    <ChevronDown size={14} style={{ color: "var(--t3)", transform: expanded ? "rotate(180deg)" : "none" }} />
                  </span>
                </button>
                {expanded && (
                  <div style={{ overflowX: "auto", paddingBottom: 4 }}>
                    <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 11.5 }}>
                      <thead><tr style={{ color: "var(--t3)", textAlign: "right" }}>
                        {["Score band", "Score range", "Priced / cohort", ...(early ? [] : ["Mean return", "Excess vs NIFTY 500"])].map((label, i) => <th key={label} style={{ textAlign: i === 0 ? "left" : "right", fontWeight: 500, padding: "7px 5px", borderBottom: "1px solid var(--bdr2)" }}>{label}</th>)}
                      </tr></thead>
                      <tbody>{cohort.buckets.map(bucket => {
                        const color = bucket.excessVsBenchmarkPct == null ? "var(--t2)" : bucket.excessVsBenchmarkPct > 0 ? "var(--green)" : bucket.excessVsBenchmarkPct < 0 ? "var(--red)" : "var(--t2)";
                        return <tr key={bucket.label}>
                          <td style={{ padding: "8px 5px", color: "var(--t1)", borderBottom: "1px solid var(--bdr)" }}>{bucket.label}</td>
                          <td style={{ padding: "8px 5px", color: "var(--t2)", textAlign: "right", ...MONO }}>{bucket.scoreMin == null ? "—" : `${bucket.scoreMin}–${bucket.scoreMax}`}</td>
                          <td style={{ padding: "8px 5px", color: "var(--t2)", textAlign: "right", ...MONO }}>{bucket.priced}/{bucket.companies}</td>
                          {!early && <td style={{ padding: "8px 5px", color, textAlign: "right", fontWeight: 700, ...MONO }}>{fmtPct(bucket.meanPriceReturnPct)}</td>}
                          {!early && <td style={{ padding: "8px 5px", color, textAlign: "right", fontWeight: 700, ...MONO }}>{fmtPct(bucket.excessVsBenchmarkPct)}</td>}
                        </tr>;
                      })}</tbody>
                    </table>
                    <div style={{ fontSize: 10.5, color: "var(--t3)", lineHeight: 1.5, marginTop: 8 }}>
                      Recorded {fmtDate(cohort.date)}; currently held {daysHeld ?? 0} days.{early ? ` Returns are shown from ${readyOn(cohort.date)}, once the cohort is three months old.` : ""} Company figures are equal-weighted, split-adjusted price returns; dividends are excluded. Unpriced names remain visible in the cohort denominator and are not counted as zero-return. Benchmark is the NIFTY 500 price index. This is a prospective study of current eligible listings; it needs longer follow-up and does not establish predictive ability.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ fontSize: 10.5, color: "var(--t3)", lineHeight: 1.5, marginTop: 8 }}>
            A new frozen score cohort is recorded monthly. Existing cohorts keep their original score version and membership; missing prices are reported as coverage gaps.
          </div>
        </section>
      )}

      {!loading && data && !data.presets.length && study?.cohortCount > 0 && (
        <p style={{ fontSize: 11, color: "var(--t3)", margin: "0 0 14px" }}>No strategy snapshots yet. The score study above is tracked separately.</p>
      )}

      {/* Ranked by return only once returns are shown; the rest by name, so
          the order doesn't hint at figures held back as too early */}
      {!loading && [...(data?.presets ?? [])].sort((a, b) => {
        const ea = tooEarly(daysSince(a.sinceDate)), eb = tooEarly(daysSince(b.sinceDate));
        if (ea !== eb) return ea ? 1 : -1;
        return ea ? a.presetName.localeCompare(b.presetName) : (b.overallAvgReturnPct ?? -Infinity) - (a.overallAvgReturnPct ?? -Infinity);
      }).map(p => {
        const isOpen = open === p.presetId;
        return (
          <div key={p.presetId} style={{ border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--s2)", marginBottom: 10, overflow: "hidden" }}>
            <button onClick={() => setOpen(isOpen ? null : p.presetId)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", background: "none", border: "none", cursor: "pointer" }}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>{p.presetName}</div>
                <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                  {/* The headline % is the oldest cohort's return, not a blend of all snapshots */}
                  {p.snapshots.length} snapshot{p.snapshots.length === 1 ? "" : "s"} · figure tracks the {fmtDate(p.sinceDate)} picks
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {tooEarly(daysSince(p.sinceDate)) ? <TooEarly days={daysSince(p.sinceDate)} /> : <RetBadge pct={p.overallAvgReturnPct} />}
                <ChevronDown size={16} style={{ color: "var(--t3)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms", flexShrink: 0 }} />
              </div>
            </button>
            {isOpen && p.snapshots.map(snap => {
              const held = daysSince(snap.date);
              // A snapshot taken today has no elapsed time: its "0%" isn't a
              // reading, so it's labelled a baseline instead
              const isBaseline = held != null && held < 1;
              const early = !isBaseline && tooEarly(held);
              return (
                <div key={snap.date} style={{ borderTop: "1px solid var(--bdr)", padding: "10px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 11.5, color: "var(--t3)", marginBottom: 8 }}>
                    <span>
                      Picked {fmtDate(snap.date)}
                      {isBaseline ? " · baseline, no return yet" : early ? ` · held ${held} day${held === 1 ? "" : "s"} · returns from ${readyOn(snap.date)}` : <> · held {held} day{held === 1 ? "" : "s"} · avg <RetBadge pct={snap.avgReturnPct} /></>}
                    </span>
                    <span style={{ flexShrink: 0 }}>{snap.priced}/{snap.picks.length} priced</span>
                  </div>
                  <div style={{ ...ROW_GRID, fontSize: 11, color: "var(--t3)", margin: "0 -16px 2px", padding: "0 16px 6px", borderBottom: "1px solid var(--bdr2)" }}>
                    <span>Stock</span>
                    <span style={{ textAlign: "right" }}>Picked at</span>
                    <span style={{ textAlign: "right" }}>{isBaseline ? "Today" : "Now"}</span>
                    <span style={{ textAlign: "right" }}>Return</span>
                  </div>
                  {snap.picks.map(pick => (
                    <div key={pick.ticker} style={{ ...ROW_GRID, fontSize: 12, padding: "6px 0", borderBottom: "1px solid var(--bdr)" }}>
                      <button type="button" className="stock-link" onClick={() => onOpenStock(pick.ticker)} style={{ color: "var(--accent)", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: 0, border: 0, background: "none", fontFamily: "inherit", textAlign: "left", minWidth: 0 }}>{pick.name}</button>
                      <span style={{ color: "var(--t2)", fontSize: 11, textAlign: "right", ...MONO }}>₹{pick.cmp?.toLocaleString("en-IN")}</span>
                      <span style={{ color: "var(--t2)", fontSize: 11, textAlign: "right", ...MONO }}>{pick.currentPrice != null ? `₹${pick.currentPrice.toLocaleString("en-IN")}` : "—"}</span>
                      <span style={{ textAlign: "right" }}>{isBaseline || early ? <span style={{ fontSize: 11, color: "var(--t3)", ...MONO }}>—</span> : <RetBadge pct={pick.returnPct} />}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}

      {!empty && !loading && (
        <p style={{ fontSize: 10, color: "var(--t3)", lineHeight: 1.6, marginTop: 14 }}>
          Returns compare each pick's close on the snapshot day with NSE's latest close{data?.pricesDate ? ` (${fmtDate(data.pricesDate)})` : ""}, adjusted for splits and bonuses since.
          A new snapshot is taken automatically every 3 days. Returns appear once picks are three months old — shorter moves are mostly noise. Past picks, not advice.
        </p>
      )}
    </div>
  );
}
