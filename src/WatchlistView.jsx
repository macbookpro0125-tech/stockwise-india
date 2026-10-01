import { useState, useEffect } from "react";
import { Star, X, NotebookPen } from "lucide-react";
import { BellIcon } from "./icons.jsx";
import { api } from "./api.js";
import { useWatchlist, toggleWatch } from "./watchlist.js";
import CreateAlertModal from "./CreateAlertModal.jsx";

// Ported from stock-screener's src/components/WatchlistPanel.jsx — one card
// per starred stock: price when starred and the move since, score, where the
// price sits against Phase 1, fair value, a note, and alert / analyze /
// remove. Saved to the account instead of the browser.

const MONO = { fontVariantNumeric: "tabular-nums" };

function fmtRs(n) {
  if (n == null || isNaN(n)) return "—";
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function scoreStyle(score, max = 10) {
  if (score == null || !max) return { color: "var(--t3)", bg: "var(--s2)", border: "var(--bdr2)" };
  const pct = score / max;
  if (pct >= 0.7) return { color: "var(--green)", bg: "var(--green-dim)", border: "var(--green-bdr)" };
  if (pct >= 0.4) return { color: "var(--yellow)", bg: "var(--yellow-dim)", border: "var(--yellow-bdr)" };
  return { color: "var(--red)", bg: "var(--red-dim)", border: "var(--red-bdr)" };
}

function buyStatus(cmp, safeBuyPrice, stopLoss) {
  if (!cmp || !safeBuyPrice) return null;
  if (stopLoss > 0 && cmp <= stopLoss) return { label: "Below stop loss", color: "var(--red)" };
  if (cmp <= safeBuyPrice) return { label: "In buy zone", color: "var(--green)" };
  const prem = ((cmp - safeBuyPrice) / safeBuyPrice) * 100;
  return { label: `${prem.toFixed(0)}% above P1`, color: prem <= 10 ? "var(--yellow)" : "var(--t3)" };
}

const label = { fontSize: 11.5, color: "var(--t3)", fontWeight: 600 };
const iconBtn = { width: 30, height: 30, borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--t3)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms" };

export default function WatchlistView({ onOpenStock }) {
  const watched = useWatchlist();
  const [data, setData] = useState(null);
  const [live, setLive] = useState({});
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("addedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [alertTarget, setAlertTarget] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    api.watchlist().then(d => {
      setData(d);
      if (d.items.length) api.currentPrices(d.items.map(i => i.ticker)).then(setLive).catch(() => {});
    }).catch(e => setError(e.message));
  }, []);

  const saveNote = async ticker => {
    await api.setWatchNote(ticker, noteText.trim());
    setData(d => ({ ...d, items: d.items.map(i => (i.ticker === ticker ? { ...i, note: noteText.trim() || null } : i)) }));
    setEditingNote(null);
  };

  // Unstarring anywhere removes the card straight away
  const rows = new Map((data?.results ?? []).map(r => [r.symbol, r]));
  const items = (data?.items ?? []).filter(i => watched.has(i.ticker));
  const score10 = t => { const s = rows.get(t)?.score; return s?.applicable ? (s.green / s.applicable) * 10 : -1; };
  const sorted = [...items].sort((a, b) => {
    let c = 0;
    if (sortBy === "addedAt") c = String(a.addedAt).localeCompare(String(b.addedAt));
    else if (sortBy === "name") c = (rows.get(a.ticker)?.name || a.ticker).localeCompare(rows.get(b.ticker)?.name || b.ticker);
    else if (sortBy === "score") c = score10(a.ticker) - score10(b.ticker);
    return sortDir === "desc" ? -c : c;
  });

  const SortPill = ({ id, label: text }) => {
    const active = sortBy === id;
    return (
      <button onClick={() => { if (active) setSortDir(d => (d === "desc" ? "asc" : "desc")); else { setSortBy(id); setSortDir("desc"); } }}
        style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? "var(--accent)" : "var(--bdr2)"}`, background: active ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent", color: active ? "var(--accent)" : "var(--t3)", transition: "all 120ms" }}>
        {text} {active && (sortDir === "desc" ? "↓" : "↑")}
      </button>
    );
  };

  const wrap = children => <div style={{ maxWidth: 1240, margin: "0 auto", padding: "8px 20px 80px", animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>{children}</div>;

  if (error) return wrap(<div style={{ padding: "14px 18px", borderRadius: 12, background: "var(--red-dim)", border: "1px solid var(--red-bdr)", color: "var(--red)", fontSize: 13 }}>Couldn't load your watchlist: {error}</div>);
  if (!data) return wrap(<div style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: "var(--t3)" }}>Loading watchlist…</div>);
  if (items.length === 0) {
    return wrap(
      <div style={{ textAlign: "center", padding: "56px 0", color: "var(--t3)", border: "1px dashed var(--bdr2)", borderRadius: 14, background: "var(--s1)" }}>
        <Star size={36} strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14, color: "var(--t2)", fontWeight: 500, marginBottom: 4 }}>Watchlist is empty</p>
        <p style={{ fontSize: 12 }}>Star any stock in results or on its page to save it here</p>
      </div>
    );
  }

  return wrap(
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 600 }}>{items.length} saved</div>
        <div style={{ display: "flex", gap: 6 }}>
          <SortPill id="addedAt" label="Date" />
          <SortPill id="name" label="Name" />
          <SortPill id="score" label="Score" />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map(item => {
          const r = rows.get(item.ticker);
          const name = r?.name ?? item.ticker;
          const cmp = live[item.ticker]?.price ?? r?.cmp ?? null;
          const score = r?.score?.green ?? null;
          const scoreMax = r?.score?.applicable ?? 10;
          const ss = scoreStyle(score, scoreMax);
          const buy = buyStatus(cmp, r?.safeBuyPrice, r?.stopLoss);
          return (
            <div key={item.ticker} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--s2)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 140px", minWidth: 120 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--t1)", letterSpacing: "-0.01em" }}>{name}</div>
                <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                  {item.ticker}
                  {item.addedAt && <span style={{ marginLeft: 8 }}>Added {fmtDate(item.addedAt)}</span>}
                  {item.addedPrice > 0 && <span style={{ marginLeft: 6 }}>@ {fmtRs(item.addedPrice)}</span>}
                </div>
              </div>

              <div style={{ flex: "0 0 100%", order: 10 }}>
                {editingNote === item.ticker ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input autoFocus value={noteText} onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveNote(item.ticker); if (e.key === "Escape") setEditingNote(null); }}
                      placeholder="e.g. Wait for Q3 results…" className="input-base" style={{ flex: 1, height: 32, fontSize: 12, borderRadius: 8 }} />
                    <button onClick={() => saveNote(item.ticker)} style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--on-accent)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingNote(null)} style={{ height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--t3)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center" }} aria-label="Cancel"><X size={14} /></button>
                  </div>
                ) : item.note ? (
                  <div onClick={() => { setEditingNote(item.ticker); setNoteText(item.note); }}
                    style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "var(--s1)", border: "1px solid var(--bdr)", fontSize: 12, color: "var(--t2)", cursor: "pointer", lineHeight: 1.5 }}>
                    <NotebookPen size={12} style={{ marginRight: 5, verticalAlign: "-1px", color: "var(--t3)" }} />{item.note}
                  </div>
                ) : (
                  <button onClick={() => { setEditingNote(item.ticker); setNoteText(""); }} style={{ marginTop: 6, background: "none", border: "none", color: "var(--t3)", fontSize: 11, cursor: "pointer", padding: 0, opacity: 0.7 }}>
                    + Add note
                  </button>
                )}
              </div>

              <div style={{ textAlign: "center", minWidth: 70 }}>
                <div style={label}>CMP</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", ...MONO }}>{cmp ? fmtRs(cmp) : <span style={{ opacity: 0.3 }}>…</span>}</div>
                {cmp && item.addedPrice > 0 && (() => {
                  const chg = ((cmp - item.addedPrice) / item.addedPrice) * 100;
                  return <div style={{ fontSize: 10, fontWeight: 600, color: chg >= 0 ? "var(--green)" : "var(--red)", marginTop: 2, ...MONO }}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</div>;
                })()}
              </div>

              <div style={{ textAlign: "center", minWidth: 55 }}>
                <div style={label}>Score</div>
                {score != null
                  ? <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 12, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, ...MONO }}>{score}/{scoreMax}</span>
                  : <span style={{ fontSize: 12, color: "var(--t3)" }}>—</span>}
              </div>

              <div style={{ textAlign: "center", minWidth: 80 }}>
                <div style={label}>Buy Phase</div>
                {buy ? <span style={{ fontSize: 11, fontWeight: 600, color: buy.color }}>{buy.label}</span> : <span style={{ fontSize: 11, color: "var(--t3)" }}>—</span>}
              </div>

              <div style={{ textAlign: "center", minWidth: 60 }}>
                <div style={label}>FV</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t2)", ...MONO }}>{r?.fairValue ? fmtRs(r.fairValue) : "—"}</div>
              </div>

              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                <button onClick={() => setAlertTarget({ symbol: item.ticker, name, cmp, p1: r?.safeBuyPrice, p2: r?.p2, p3: r?.p3 })} title="Set alert" aria-label="Set alert" style={iconBtn}><BellIcon /></button>
                <button onClick={() => onOpenStock(item.ticker)} className="btn-primary" style={{ height: 30, padding: "0 14px", fontSize: 11, borderRadius: 8, boxShadow: "none" }}>Analyze →</button>
                <button onClick={() => toggleWatch(item.ticker)} title="Remove from watchlist" aria-label="Remove from watchlist" style={iconBtn}><X size={15} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {alertTarget && <CreateAlertModal stock={alertTarget} onClose={() => setAlertTarget(null)} />}
    </>
  );
}
