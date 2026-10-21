import { useState, useEffect } from "react";
import CompanyLogo from "./CompanyLogo.jsx";
import { Star, X, NotebookPen, CalendarDays } from "lucide-react";
import { BellIcon } from "./icons.jsx";
import { api } from "./api.js";
import { useWatchlist, toggleWatch } from "./watchlist.js";
import CreateAlertModal from "./CreateAlertModal.jsx";
import { QualityBadge } from "./ResearchBadges.jsx";
import { pricePosition } from "../server/levels.js";
import { nextEvent, todayIst } from "./watchEvents.js";

// Ported from stock-screener's src/components/WatchlistPanel.jsx — one card
// per starred stock: price when starred and the move since, quality score,
// where the price sits against its levels, fair value, a note, and alert /
// analyze / remove. Saved to the account instead of the browser.

const MONO = { fontVariantNumeric: "tabular-nums" };

function fmtRs(n) {
  if (n == null || isNaN(n)) return "—";
  // paise under ₹100, where a whole rupee is a big step (₹8.23, not ₹8)
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 });
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

// Whether the latest quarter's results are in: the quarter that ended most
// recently, against the company's latest filed quarter — "results in", or
// the board meeting NSE lists, or awaited. (Asked for on Screener.in's forum:
// a tick on watchlist stocks that have declared results, Oct 2026.)
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function lastQuarterEnd(now = new Date()) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const ends = [[y, 2, 31], [y, 5, 30], [y, 8, 30], [y, 11, 31], [y - 1, 11, 31]].map(([yy, mm, dd]) => Date.UTC(yy, mm, dd));
  const end = ends.filter(t => t <= Date.UTC(y, m, now.getUTCDate())).sort((a, b) => b - a)[0];
  return new Date(end).toISOString().slice(0, 10);
}
const shortDay = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
function resultsStatus(r) {
  if (!r?.latestQuarter && !r?.nextResults) return null;
  const due = lastQuarterEnd();
  const qName = `${MONTH[Number(due.slice(5, 7)) - 1]} quarter`;
  if (r.latestQuarter && r.latestQuarter >= due) return { text: `${qName} results in${r.latestQuarterFiled ? ` · ${shortDay(r.latestQuarterFiled)}` : ""}`, color: "var(--green)", done: true };
  if (r.nextResults) return { text: `${qName} results due ${shortDay(r.nextResults)}`, color: "var(--t2)" };
  return { text: `${qName} results awaited`, color: "var(--t3)" };
}

const priceBasis = source => source === "live" ? "Yahoo daily close" : source === "cached" ? "Cached Yahoo daily close" : source === "close" ? "NSE daily close" : "Price";

// Where the price sits against the stock's levels, in a few words — the
// zone from pricePosition (server/levels.js), which never says buy or sell
const TONE = { red: "var(--red)", yellow: "var(--yellow)", green: "var(--green)" };
function levelStatus(cmp, r) {
  if (!cmp || !r?.safeBuyPrice) return null;
  const pos = pricePosition(cmp, { fv25: r.fv25, p1: r.safeBuyPrice, p2: r.p2, p3: r.p3, stopLoss: r.stopLoss, target: r.target });
  if (!pos) return null;
  if (pos.zone === "above-phase1") {
    const prem = ((cmp - r.safeBuyPrice) / r.safeBuyPrice) * 100;
    return { label: `${prem.toFixed(0)}% above P1`, color: prem <= 10 ? "var(--yellow)" : "var(--t3)" };
  }
  const short = { "below-stop": "Below stop-loss level", phase3: "At/below reference level 3", phase2: "At/below reference level 2", phase1: "At/below reference level 1", "above-upper": "Above upper level", "far-above": "Far above upper level" };
  return { label: short[pos.zone] ?? pos.label, color: TONE[pos.tone] ?? "var(--t3)" };
}

const label = { fontSize: 11.5, color: "var(--t3)", fontWeight: 400 };
const iconBtn = { width: 30, height: 30, borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--t3)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms" };

export default function WatchlistView({ onOpenStock }) {
  const today = todayIst();
  const watched = useWatchlist();
  const [data, setData] = useState(null);
  const [live, setLive] = useState({});
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("addedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [alertTarget, setAlertTarget] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [leaving, setLeaving] = useState(() => new Set());
  // Folds the card away, then removes it (index.css .wl-row.leaving)
  const removeCard = ticker => {
    setLeaving(s => new Set(s).add(ticker));
    const ms = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 150 : 200;
    setTimeout(() => { toggleWatch(ticker); setLeaving(s => { const n = new Set(s); n.delete(ticker); return n; }); }, ms);
  };

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
  const quality = t => rows.get(t)?.research?.quality ?? -1;
  const sorted = [...items].sort((a, b) => {
    let c = 0;
    if (sortBy === "addedAt") c = String(a.addedAt).localeCompare(String(b.addedAt));
    else if (sortBy === "name") c = (rows.get(a.ticker)?.name || a.ticker).localeCompare(rows.get(b.ticker)?.name || b.ticker);
    else if (sortBy === "quality") c = quality(a.ticker) - quality(b.ticker);
    return sortDir === "desc" ? -c : c;
  });

  const SortPill = ({ id, label: text }) => {
    const active = sortBy === id;
    return (
      <button onClick={() => { if (active) setSortDir(d => (d === "desc" ? "asc" : "desc")); else { setSortBy(id); setSortDir("desc"); } }}
        style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 400, cursor: "pointer", border: `1px solid ${active ? "var(--accent)" : "var(--bdr2)"}`, background: active ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent", color: active ? "var(--accent)" : "var(--t3)", transition: "all 120ms" }}>
        {text} {active && (sortDir === "desc" ? "↓" : "↑")}
      </button>
    );
  };

  const wrap = children => <div style={{ padding: "8px var(--page-x) 16px", animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>{children}</div>;

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
        <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 400 }}>{items.length} saved</div>
        <div style={{ display: "flex", gap: 6 }}>
          <SortPill id="addedAt" label="Date" />
          <SortPill id="name" label="Name" />
          <SortPill id="quality" label="Quality" />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map(item => {
          const r = rows.get(item.ticker);
          const name = r?.name ?? item.ticker;
          const quote = live[item.ticker] ?? (r?.cmp != null ? { source: "close", asOf: data.snapshot?.pricesDate } : null);
          const cmp = quote?.price ?? r?.cmp ?? null;
          const level = levelStatus(cmp, r);
          return (
            <div key={item.ticker} className={`wl-row${leaving.has(item.ticker) ? " leaving" : ""}`}>
              <div className="glow" style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--s2)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 140px", minWidth: 120 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 400, fontSize: 14, color: "var(--t1)", letterSpacing: "-0.01em" }}><CompanyLogo symbol={item.ticker} size={18} />{name}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                    {item.ticker}
                    {item.addedAt && <span style={{ marginLeft: 8 }}>Added {fmtDate(item.addedAt)}</span>}
                    {item.addedPrice > 0 && <span style={{ marginLeft: 6 }}>@ {fmtRs(item.addedPrice)}</span>}
                  </div>
                  {(() => {
                    const st = resultsStatus(r);
                    return st && <div style={{ fontSize: 10.5, color: st.color, marginTop: 3, fontWeight: st.done ? 600 : 500 }}>{st.done ? "✓ " : ""}{st.text}</div>;
                  })()}
                  {(() => {
                    const ev = nextEvent(r, today);
                    return ev && <div className="wl-event" data-kind={ev.kind}><CalendarDays size={11} aria-hidden="true" />{ev.text}</div>;
                  })()}
                </div>

                <div style={{ flex: "0 0 100%", order: 10 }}>
                  {editingNote === item.ticker ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <input autoFocus aria-label="Note" maxLength={500} value={noteText} onChange={e => setNoteText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveNote(item.ticker); if (e.key === "Escape") setEditingNote(null); }}
                        placeholder="e.g. Wait for Q3 results…" className="input-base" style={{ flex: 1, height: 32, fontSize: 12, borderRadius: 8 }} />
                      <button onClick={() => saveNote(item.ticker)} style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--on-accent)", fontSize: 11, fontWeight: 400, cursor: "pointer" }}>Save</button>
                      <button onClick={() => setEditingNote(null)} style={{ height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--t3)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center" }} aria-label="Cancel"><X size={14} /></button>
                    </div>
                  ) : item.note ? (
                    <button type="button" aria-label={`Edit note for ${name}`} onClick={() => { setEditingNote(item.ticker); setNoteText(item.note); }}
                      style={{ display: "block", width: "100%", marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "var(--s1)", border: "1px solid var(--bdr)", fontSize: 12, color: "var(--t2)", cursor: "pointer", lineHeight: 1.5, textAlign: "left", fontFamily: "inherit" }}>
                      <NotebookPen size={12} style={{ marginRight: 5, verticalAlign: "-1px", color: "var(--t3)" }} />{item.note}
                    </button>
                  ) : (
                    <button onClick={() => { setEditingNote(item.ticker); setNoteText(""); }} style={{ marginTop: 6, background: "none", border: "none", color: "var(--t3)", fontSize: 11, cursor: "pointer", padding: 0, opacity: 0.7 }}>
                      + Add note
                    </button>
                  )}
                </div>

                <div style={{ textAlign: "center", minWidth: 70 }}>
                  <div style={label}>CMP</div>
                  <div style={{ fontSize: 14, fontWeight: 400, color: "var(--t1)", ...MONO }}>{cmp ? fmtRs(cmp) : <span style={{ opacity: 0.3 }}>…</span>}</div>
                  {cmp && <div style={{ fontSize: 10, color: quote?.stale ? "var(--yellow)" : "var(--t3)", marginTop: 3, whiteSpace: "nowrap" }}>{priceBasis(quote?.source)}{quote?.asOf ? ` · ${fmtDate(quote.asOf)}` : ""}</div>}
                  {cmp && item.addedPrice > 0 && (() => {
                    const chg = ((cmp - item.addedPrice) / item.addedPrice) * 100;
                    return <div style={{ fontSize: 10, fontWeight: 400, color: chg >= 0 ? "var(--green)" : "var(--red)", marginTop: 2, ...MONO }}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</div>;
                  })()}
                </div>

                <div style={{ textAlign: "center", minWidth: 70 }}>
                  <div style={label}>Quality</div>
                  <QualityBadge research={r?.research} size={12} />
                </div>

                <div style={{ textAlign: "center", minWidth: 80 }}>
                  <div style={label}>Price level</div>
                  {level ? <span style={{ fontSize: 11, fontWeight: 400, color: level.color }}>{level.label}</span> : <span style={{ fontSize: 11, color: "var(--t3)" }} title={r?.valuation?.reason ?? (r?.valuation?.as ? `No price levels (${r.valuation.as})` : undefined)}>—</span>}
                </div>

                <div style={{ textAlign: "center", minWidth: 72 }}>
                  <div style={label} title="Today's fair value, as on the company page">Fair value</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t2)", ...MONO }}>{r?.fv25 ? fmtRs(r.fv25) : "—"}</div>
                </div>

                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  <button onClick={() => setAlertTarget({ symbol: item.ticker, name, cmp, p1: r?.safeBuyPrice, p2: r?.p2, p3: r?.p3 })} title="Set alert" aria-label="Set alert" style={iconBtn}><BellIcon /></button>
                  <button onClick={() => onOpenStock(item.ticker)} className="btn-primary" style={{ height: 30, padding: "0 14px", fontSize: 11, borderRadius: 8, boxShadow: "none" }}>Analyze →</button>
                  <button onClick={() => removeCard(item.ticker)} title="Remove from watchlist" aria-label="Remove from watchlist" style={iconBtn}><X size={15} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {alertTarget && <CreateAlertModal stock={alertTarget} onClose={() => setAlertTarget(null)} />}
    </>
  );
}
