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
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, day, 12)));
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

// Name · entry · current · return, shared by the header and every pick row
const ROW_GRID = { display: "grid", gridTemplateColumns: "minmax(0,1fr) 78px 78px 62px", gap: 8, alignItems: "center" };

export default function PerformanceView({ onOpenStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snapping, setSnapping] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

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

  const empty = !loading && (!data || !data.presets.length);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "8px 20px 80px", animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Strategy performance</div>
          {data?.snapshotCount > 0 && (
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 3 }}>
              {data.snapshotCount} snapshot{data.snapshotCount === 1 ? "" : "s"} · prices for {data.pricedTickers}/{data.totalTickers} stocks
            </div>
          )}
        </div>
        <button onClick={takeSnapshot} disabled={snapping} className="btn-ghost" style={{ height: 32, padding: "0 14px", fontSize: 12.5, fontWeight: 500, opacity: snapping ? 0.6 : 1, cursor: snapping ? "wait" : "pointer" }}>
          {snapping ? "Snapshotting…" : <><Camera size={14} /> Take snapshot now</>}
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

      {!loading && data?.presets.map(p => {
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
                <RetBadge pct={p.overallAvgReturnPct} />
                <ChevronDown size={16} style={{ color: "var(--t3)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms", flexShrink: 0 }} />
              </div>
            </button>
            {isOpen && p.snapshots.map(snap => {
              const held = daysSince(snap.date);
              // A snapshot taken today has no elapsed time: its "0%" isn't a
              // reading, so it's labelled a baseline instead
              const isBaseline = held != null && held < 1;
              return (
                <div key={snap.date} style={{ borderTop: "1px solid var(--bdr)", padding: "10px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 11.5, color: "var(--t3)", marginBottom: 8 }}>
                    <span>
                      Picked {fmtDate(snap.date)}
                      {isBaseline ? " · baseline, no return yet" : <> · held {held} day{held === 1 ? "" : "s"} · avg <RetBadge pct={snap.avgReturnPct} /></>}
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
                      <span onClick={() => onOpenStock(pick.ticker)} style={{ color: "var(--accent)", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pick.name}</span>
                      <span style={{ color: "var(--t2)", fontSize: 11, textAlign: "right", ...MONO }}>₹{pick.cmp?.toLocaleString("en-IN")}</span>
                      <span style={{ color: "var(--t2)", fontSize: 11, textAlign: "right", ...MONO }}>{pick.currentPrice != null ? `₹${pick.currentPrice.toLocaleString("en-IN")}` : "—"}</span>
                      <span style={{ textAlign: "right" }}>{isBaseline ? <span style={{ fontSize: 11, color: "var(--t3)", ...MONO }}>—</span> : <RetBadge pct={pick.returnPct} />}</span>
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
          A new snapshot is taken automatically every 3 days. Past picks, not advice.
        </p>
      )}
    </div>
  );
}
