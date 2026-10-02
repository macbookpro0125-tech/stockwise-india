import { useState, useEffect, useMemo } from "react";
import { NotebookPen, Check, X, TriangleAlert, LoaderCircle, ArrowLeft, ArrowUpRight, CalendarDays, CircleCheck, Layers, ArrowRight } from "lucide-react";
import { api } from "./api.js";
import { calculateLevels, pricePosition, fmtRs } from "../server/levels.js";
import { StarIcon, BellIcon, PositionIcon } from "./icons.jsx";
import ResearchPanel from "./ResearchPanel.jsx";
import { useWatchlist, toggleWatch } from "./watchlist.js";
import CreateAlertModal from "./CreateAlertModal.jsx";
import PriceChartPanel from "./PriceChartPanel.jsx";
import FinancialsPanel from "./FinancialsPanel.jsx";
import TechnicalPanel from "./TechnicalPanel.jsx";
import PeersPanel from "./PeersPanel.jsx";
import NewsPanel from "./NewsPanel.jsx";
import ValuationExplorer from "./ValuationExplorer.jsx";
import ThesisMonitor from "./ThesisMonitor.jsx";

// The original Stockwise stock page (stock-screener src/StockScreener.jsx),
// on this app's NSE data: the research dashboard (in place of the original's
// 10-point checklist and BUY/HOLD/AVOID verdict — ResearchPanel.jsx), verify &
// override, current price, 52-week range, shareholding, price chart,
// financials, technicals, pros & cons, where the price sits, the price levels,
// fair value, Piotroski, key numbers, peers, news & filings, and your notes.
// Where it differs from the original: the P/E defaults to the stock's own
// 5-year median (the original's current P/E made fair value = price), a
// one-off profit jump is valued at the usual EPS and years of near-zero profit
// can leave that median (server/metrics.js), the P/E history behind it sits
// under the inputs, and the price levels are described, never turned into
// buy or sell instructions.

const VERDICT_META = {
  ACCUMULATE: { label: "Accumulate", color: "var(--green)", bg: "var(--green-dim)", border: "var(--green-bdr)" },
  WATCHLIST: { label: "Watchlist", color: "var(--yellow)", bg: "var(--yellow-dim)", border: "var(--yellow-bdr)" },
  SKIP: { label: "Skip", color: "var(--red)", bg: "var(--red-dim)", border: "var(--red-bdr)" },
};
// A verdict's colour as a dot before its name (the original used coloured emoji)
const Dot = ({ color }) => <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, marginRight: 6, verticalAlign: "1px" }} />;

const MONO = { fontVariantNumeric: "tabular-nums" };
const card = { border: "1px solid var(--bdr2)", borderRadius: 12, padding: 18, marginBottom: 12, background: "var(--s2)", boxShadow: "var(--sh-xs)" };
const inputStyle = { width: "100%", height: 40, padding: "0 14px", border: "1px solid var(--bdr2)", borderRadius: 8, fontSize: 13.5, outline: "none", background: "var(--s1)", color: "var(--t1)", boxSizing: "border-box", fontFamily: "inherit", fontVariantNumeric: "tabular-nums" };
const labelStyle = { fontSize: 12, color: "var(--t2)", marginBottom: 6, display: "block", fontWeight: 500 };
// A section's heading inside a card, with its icon
const SectionTitle = ({ icon: Icon, children, color = "var(--t1)", style }) => (
  <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, margin: "0 0 14px", color, letterSpacing: "-0.01em", ...style }}>
    {Icon && <Icon size={17} strokeWidth={2} style={{ color: "var(--t3)", flexShrink: 0 }} />}{children}
  </h3>
);

const round = (v, dp = 1) => (v == null || !isFinite(v) ? null : Math.round(v * 10 ** dp) / 10 ** dp);
const pctText = v => (v == null ? "—" : `${round(v, 1)}%`);

// Fiscal-year labels from the latest filed year: FY26 = the year to Mar 2026
const fyLabel = (fyEnd, plus = 0) => `FY${String(Number(fyEnd.slice(0, 4)) + plus).slice(2)}`;

function labelledActionStyle({ active, activeColor }) {
  return {
    height: 32, padding: "0 12px", borderRadius: 8,
    border: `1px solid ${active ? activeColor : "var(--bdr3)"}`,
    background: active ? `color-mix(in srgb, ${activeColor} 14%, transparent)` : "var(--s3)",
    color: active ? activeColor : "var(--t2)",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 6,
    transition: "all 120ms", flexShrink: 0,
  };
}

// ---- Panels -------------------------------------------------------------------

function PeHistoryTable({ m }) {
  const cell = { padding: "7px 10px", fontSize: 12, borderBottom: "1px solid var(--bdr)", textAlign: "right" };
  const head = { ...cell, fontSize: 11.5, fontWeight: 500, color: "var(--t3)" };
  const fy = iso => new Date(`${iso}T00:00:00Z`).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--bdr)", paddingTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>Where the P/E comes from — this stock's P/E, last {m.peHistory.length} fiscal years</div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: "left" }}>Year ended</th>
              <th style={head}>EPS</th>
              <th style={head}>Price at year end</th>
              <th style={head}>P/E</th>
              <th style={{ ...head, textAlign: "left" }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {m.peHistory.map(y => (
              <tr key={y.fyEnd} style={{ color: y.pe == null || y.excluded ? "var(--t3)" : "var(--t1)" }}>
                <td style={{ ...cell, textAlign: "left" }}>{fy(y.fyEnd)}</td>
                <td style={{ ...cell, ...MONO }}>{y.eps != null ? `₹${y.eps.toFixed(2)}` : "—"}</td>
                <td style={{ ...cell, ...MONO }}>{y.price != null ? fmtRs(y.price) : "—"}</td>
                <td style={{ ...cell, ...MONO, fontWeight: 600 }}>{y.pe != null ? y.pe.toFixed(1) : "—"}</td>
                <td style={{ ...cell, textAlign: "left", color: "var(--t3)" }}>
                  {y.excluded ?? (y.splitFactor > 1 ? `Reported ₹${y.reportedEps}; ÷${y.splitFactor} for a later split/bonus` : "")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 8, lineHeight: 1.5 }}>
        {m.medianPe != null
          ? <>Median of {m.peYears} years: <strong style={{ color: "var(--t1)" }}>{m.medianPe.toFixed(1)}</strong> — the default P/E above. A median, so one unusual year can't drag it.</>
          : <>Only {m.peYears} usable year{m.peYears === 1 ? "" : "s"} — at least 3 are needed for a median, so the default is today's P/E, which makes fair value track the price.</>}
        {m.epsJump && <> Median EPS of the same years: <strong style={{ color: "var(--t1)" }}>₹{m.epsJump.usualEps.toFixed(2)}</strong> — the usual level, used instead of {fyLabel(m.fyEnd)}'s ₹{m.epsJump.eps.toFixed(2)}.</>}
      </div>
    </div>
  );
}

function RangeWidget({ lo, hi, price }) {
  if (!lo && !hi) return null;
  const hasCmp = price > 0 && lo && hi && hi > lo;
  const pct = hasCmp ? Math.min(98, Math.max(2, ((price - lo) / (hi - lo)) * 100)) : null;
  const fromLow = hasCmp ? Math.round(((price - lo) / lo) * 100) : null;
  const belowHigh = hasCmp ? Math.round(((hi - price) / hi) * 100) : null;
  const zoneLabel = pct == null ? null : pct <= 25 ? "Near 52W Low — value zone" : pct <= 65 ? "Mid-range" : "Near 52W High";
  const zoneBg = pct == null ? "var(--card2)" : pct <= 25 ? "var(--green-dim)" : pct <= 65 ? "var(--yellow-dim)" : "var(--red-dim)";
  const zoneClr = pct == null ? "var(--t3)" : pct <= 25 ? "var(--green)" : pct <= 65 ? "var(--yellow)" : "var(--red)";
  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 10, padding: "16px 20px", marginBottom: 12, background: "var(--s2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 500, marginBottom: 1 }}>Low</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{lo ? lo.toLocaleString("en-IN") : "—"}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)", marginBottom: 1 }}>52W Range</div>
          {zoneLabel && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: zoneBg, color: zoneClr }}>{zoneLabel}</span>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 500, marginBottom: 1 }}>High</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{hi ? hi.toLocaleString("en-IN") : "—"}</div>
        </div>
      </div>
      <div style={{ position: "relative", paddingBottom: pct != null ? 18 : 4 }}>
        <div style={{ height: 10, borderRadius: 5, background: "linear-gradient(to right, #d32f2f, #f4511e, #fb8c00, #fdd835, #aed136, #43a047, #1b5e20)" }} />
        {pct != null && (
          <div style={{ position: "absolute", bottom: 0, left: `calc(${pct}% - 7px)`, width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderBottom: "12px solid var(--t1)" }} />
        )}
      </div>
      {hasCmp && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 6 }}>
          <span style={{ color: "var(--red)", fontWeight: 600 }}>{fromLow >= 0 ? `+${fromLow}% above low` : "Below 52W Low"}</span>
          <span style={{ fontWeight: 700, color: "var(--t1)" }}>{fmtRs(price)}</span>
          <span style={{ color: "var(--green)", fontWeight: 600 }}>{belowHigh > 0 ? `${belowHigh}% below high` : "At/above 52W High"}</span>
        </div>
      )}
    </div>
  );
}

function ShareholdingPanel({ symbol }) {
  const [quarters, setQuarters] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.panel(symbol, "shareholding").then(d => { if (!cancelled) setQuarters(d.quarters); }).catch(() => { if (!cancelled) setQuarters([]); });
    return () => { cancelled = true; };
  }, [symbol]);
  if (!quarters?.length) return null;

  const defs = [
    { label: "Promoter", key: "promoter", color: "#E8A020" },
    { label: "FII", key: "fii", color: "#4285F4" },
    { label: "DII", key: "dii", color: "#34A853" },
    { label: "Retail/Others", key: "retail", color: "#9AA0A6" },
  ];
  const latest = quarters.at(-1);
  const segments = defs.filter(s => latest[s.key] != null && latest[s.key] > 0);
  const period = q => { const [, m, y] = q.period.split("-"); return `${m.charAt(0)}${m.slice(1).toLowerCase()} ${y}`; };
  const change = key => {
    const vals = quarters.map(q => q[key]).filter(v => v != null);
    return vals.length >= 2 ? Math.round((vals.at(-1) - vals[0]) * 100) / 100 : null;
  };

  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 10, padding: "16px 20px", marginBottom: 12, background: "var(--s2)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 10 }}>Shareholding as of {period(latest)}</div>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 10, gap: 1 }}>
        {segments.map(({ key, color }) => <div key={key} style={{ flex: latest[key], background: color, minWidth: latest[key] > 1 ? 2 : 0 }} />)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginBottom: quarters.length > 1 ? 14 : 0 }}>
        {segments.map(({ label, key, color }) => {
          const chg = change(key);
          return (
            <span key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--t2)" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
              {label} <strong style={{ color: "var(--t1)" }}>{latest[key]}%</strong>
              {chg != null && chg !== 0 && <span style={{ fontSize: 10, fontWeight: 600, color: chg > 0 ? "var(--green)" : "var(--red)" }}>{chg > 0 ? "+" : ""}{chg}%</span>}
            </span>
          );
        })}
      </div>
      {quarters.length > 1 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--t3)", fontWeight: 600, borderBottom: "1px solid var(--bdr2)" }}></th>
                {quarters.map(q => <th key={q.period} style={{ textAlign: "right", padding: "6px 8px", color: "var(--t3)", fontWeight: 500, borderBottom: "1px solid var(--bdr2)", whiteSpace: "nowrap" }}>{period(q)}</th>)}
                <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--t3)", fontWeight: 600, borderBottom: "1px solid var(--bdr2)" }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {defs.map(({ label, key, color }) => {
                if (!quarters.some(q => q[key] != null)) return null;
                const chg = change(key);
                return (
                  <tr key={key}>
                    <td style={{ padding: "6px 8px", color: "var(--t1)", fontWeight: 500, borderBottom: "1px solid var(--bdr2)", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, marginRight: 6, verticalAlign: "middle" }} />{label}
                    </td>
                    {quarters.map(q => (
                      <td key={q.period} style={{ textAlign: "right", padding: "6px 8px", color: q[key] != null ? "var(--t2)" : "var(--t3)", borderBottom: "1px solid var(--bdr2)" }}>
                        {q[key] != null ? `${q[key]}%` : "—"}
                      </td>
                    ))}
                    <td style={{ textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "1px solid var(--bdr2)", color: chg == null || chg === 0 ? "var(--t3)" : chg > 0 ? "var(--green)" : "var(--red)" }}>
                      {chg != null && chg !== 0 ? `${chg > 0 ? "+" : ""}${chg}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 8 }}>From the company's quarterly shareholding filings to NSE.</div>
    </div>
  );
}

// My Notes — kept in this browser, as in the original
const NOTES_KEY = "stockwise-india-notes";
const loadAllNotes = () => { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); } catch { return {}; } };
const saveAllNotes = all => { try { localStorage.setItem(NOTES_KEY, JSON.stringify(all)); } catch {} };

function MyNotes({ symbol }) {
  const [saved, setSaved] = useState(() => loadAllNotes()[symbol] ?? null);
  const [editing, setEditing] = useState(!saved);
  const [verdict, setVerdict] = useState(saved?.verdict ?? null);
  const [text, setText] = useState(saved?.text ?? "");

  const save = () => {
    if (!verdict) return;
    const note = { verdict, text: text.trim(), savedAt: new Date().toLocaleDateString("en-IN") };
    saveAllNotes({ ...loadAllNotes(), [symbol]: note });
    setSaved(note);
    setEditing(false);
  };
  const remove = () => {
    const all = loadAllNotes();
    delete all[symbol];
    saveAllNotes(all);
    setSaved(null); setVerdict(null); setText(""); setEditing(true);
  };

  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 10, padding: 16, marginBottom: 16, background: "var(--s2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "var(--t1)" }}><NotebookPen size={17} style={{ color: "var(--t3)" }} /> My Notes</span>
        {saved && !editing && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEditing(true)} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--accent)", cursor: "pointer" }}>Edit</button>
            <button onClick={remove} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--bdr2)", background: "var(--s1)", color: "var(--t3)", cursor: "pointer" }}>Delete</button>
          </div>
        )}
      </div>
      {saved && !editing ? (
        <div>
          <div style={{ display: "inline-block", fontSize: 12, fontWeight: 650, padding: "4px 12px", borderRadius: 20, background: VERDICT_META[saved.verdict]?.bg, color: VERDICT_META[saved.verdict]?.color, border: `1px solid ${VERDICT_META[saved.verdict]?.border}` }}>
            <Dot color={VERDICT_META[saved.verdict]?.color} />{VERDICT_META[saved.verdict]?.label}
          </div>
          {saved.text && <p style={{ fontSize: 13, color: "var(--t2)", margin: "8px 0 4px", lineHeight: 1.5 }}>{saved.text}</p>}
          <p style={{ fontSize: 11, color: "var(--t3)", margin: 0 }}>Saved {saved.savedAt} · kept in this browser</p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: "var(--t2)", margin: "0 0 10px" }}>Set your verdict and add a note for this stock.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {Object.entries(VERDICT_META).map(([key, meta]) => (
              <button key={key} onClick={() => setVerdict(key)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${verdict === key ? meta.border : "var(--bdr2)"}`, background: verdict === key ? meta.bg : "var(--surf)", color: verdict === key ? meta.color : "var(--t2)", cursor: "pointer", transition: "all 0.15s" }}>
                <Dot color={meta.color} />{meta.label}
              </button>
            ))}
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Add a note... e.g. Wait for P2 entry. Watch working-capital days."
            style={{ width: "100%", fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--bdr2)", resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "var(--s1)", color: "var(--t1)" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={save} disabled={!verdict} style={{ fontSize: 13, fontWeight: 600, padding: "7px 18px", borderRadius: 8, border: "none", background: verdict ? "var(--accent)" : "var(--card2)", color: verdict ? "var(--on-accent)" : "var(--t3)", cursor: verdict ? "pointer" : "not-allowed" }}>Save Note</button>
            {saved && <button onClick={() => { setVerdict(saved.verdict); setText(saved.text); setEditing(false); }} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--bdr2)", background: "var(--s1)", color: "var(--t2)", cursor: "pointer" }}>Cancel</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function PiotroskiCard({ m }) {
  if (!m.piotroskiChecks) return null;
  const color = m.piotroski >= 7 ? "var(--green)" : m.piotroski >= 4 ? "var(--yellow)" : "var(--red)";
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--t1)" }}>Piotroski Score</h3>
        <span style={{ fontSize: 13, fontWeight: 700, color, ...MONO }}>{m.piotroski}/9</span>
        <span style={{ fontSize: 11, color: "var(--t3)" }}>this year against last · 7+ = strong and improving</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "6px 20px" }}>
        {m.piotroskiChecks.map(c => (
          <div key={c.id} style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.5, color: c.ok ? "var(--t1)" : "var(--t3)" }}>
            <span style={{ color: c.ok ? "var(--green)" : "var(--red)", width: 14, flexShrink: 0, paddingTop: 2 }}>{c.ok ? <Check size={14} strokeWidth={2.6} /> : <X size={14} strokeWidth={2.6} />}</span>{c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyNumbers({ data, m }) {
  const cr = n => (n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")} Cr`);
  const crRaw = n => (n == null ? "—" : cr(n / 1e7));
  const stats = [
    ["Market cap", cr(m.marketCapCr)], ["P/E (today)", m.pe ? m.pe.toFixed(1) : "—"], ["Price / book", m.priceToBook?.toFixed(2) ?? "—"], ["Dividend yield", pctText(m.divYield)],
    ["ROCE", pctText(m.roce)], ["ROE", pctText(m.roe)], [`ROE (${m.roeAvgYears}Y avg)`, pctText(m.roeAvg)], ["OPM", pctText(m.opm)],
    ["Sales growth 3Y / 5Y", `${pctText(m.salesGrowth3y)} / ${pctText(m.salesGrowth5y)}`], ["Profit growth 3Y / 5Y", `${pctText(m.profitGrowth3y)} / ${pctText(m.profitGrowth5y)}`],
    ["Debt / equity", m.debtToEquity != null ? `${m.debtToEquity.toFixed(2)}×` : "—"], ["Interest cover", m.interestCoverage != null ? `${m.interestCoverage.toFixed(1)}×` : "—"],
    ["Free cash flow (last year)", cr(m.fcfCr)], ["Payout", pctText(m.payoutPct)],
    ["FII / DII", `${pctText(m.fiiPct)} / ${pctText(m.diiPct)}`], ["Promoter shares pledged", pctText(m.pledgedPct)],
    ["Revenue (latest qtr)", crRaw(data.pnl?.revenueQuarter)], ["Profit (latest qtr)", crRaw(data.pnl?.profitQuarter)],
    ["Net current assets (NCAV)", cr(m.ncavCr)], ["Shares outstanding", m.shares ? `${(m.shares / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr` : "—"],
  ];
  return (
    <div style={card}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", color: "var(--t1)" }}>Key Numbers</h3>
      <div className="ss-grid-4">
        {stats.map(([label, value]) => (
          <div key={label} style={{ background: "var(--s1)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--bdr)" }}>
            <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", ...MONO }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 10 }}>Share count from the {m.sharesSource ?? "filings"}; shareholding as of {m.holdingAsOf ?? "—"}.</div>
    </div>
  );
}

// ---- Page ---------------------------------------------------------------------

// backTo: the tab Back returns to
export default function StockDetail({ symbol, onBack, backTo = "Discover", onOpenStock }) {
  const watched = useWatchlist().has(symbol);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // Verify & Override (the original's inputs), plus the price box
  const [eps, setEps] = useState("");
  const [pe, setPe] = useState("");
  const [growthPct, setGrowthPct] = useState("");
  const [mosPct, setMosPct] = useState("10");
  const [actionPrice, setActionPrice] = useState("");
  const [priceLabel, setPriceLabel] = useState("");
  const [baseline, setBaseline] = useState(null);

  const applyBaseline = b => {
    setEps(b.eps); setPe(b.pe); setGrowthPct(b.growthPct); setMosPct(b.mosPct);
  };

  useEffect(() => {
    let cancelled = false;
    api.stock(symbol).then(d => {
      if (cancelled) return;
      setData(d);
      const m = d.metrics;
      if (!m) return;
      const b = {
        eps: m.valuationEps != null ? String(round(m.valuationEps, 2)) : "",
        pe: m.valuationPe ? String(round(m.valuationPe, 1)) : "",
        growthPct: String(round(m.growthForValuation, 1)),
        mosPct: "10",
      };
      setBaseline(b);
      applyBaseline(b);
      if (d.quote) { setActionPrice(String(d.quote.cmp)); setPriceLabel(`${d.quote.stale ? "Cached price" : "Live price"} (${d.quote.asOf})`); }
      else if (d.close) { setActionPrice(String(d.close.price)); setPriceLabel(`NSE close (${d.close.date})`); }
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [symbol]);

  const m = data?.metrics;
  const usingCustomInputs = !!baseline && (eps !== baseline.eps || pe !== baseline.pe || growthPct !== baseline.growthPct || mosPct !== baseline.mosPct);
  // A one-off profit jump: the EPS box holds the usual level until you change it
  const usualEpsShown = !!m?.epsJump && !!baseline && eps === baseline.eps;
  // The table's own levels until an input changes — the inputs hold rounded
  // values, which could move a price level by a rupee against the Discover table
  const levels = useMemo(() => {
    if (!m) return null;
    return usingCustomInputs ? calculateLevels(eps, pe, growthPct, mosPct) : m.levels;
  }, [m, usingCustomInputs, eps, pe, growthPct, mosPct]);
  const price = Number(actionPrice) || null;

  if (error) {
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px" }}>
        <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}><ArrowLeft size={15} /> Back</button>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 8, background: "var(--red-dim)", border: "1px solid var(--red-bdr)", color: "var(--red)", fontSize: 13 }}><TriangleAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <LoaderCircle size={28} strokeWidth={2} style={{ color: "var(--t3)", marginBottom: 10, animation: "spin 0.9s linear infinite" }} />
        <p style={{ color: "var(--t2)", fontSize: 14 }}>Loading {symbol} from NSE filings…</p>
      </div>
    );
  }

  const position = pricePosition(price, levels);
  const positionTone = { red: "var(--red)", yellow: "var(--yellow)", green: "var(--green)" }[position?.tone] ?? "var(--accent)";
  // How far a level sits under today's fair value, for the ladder's labels
  const belowFv = v => (levels?.fv25 > 0 && v > 0 ? `${Math.round((1 - v / levels.fv25) * 100)}% below today's FV` : "");

  const hint = (ok, good, neutral, color = "var(--green)") => (
    <div style={{ fontSize: 10, color: ok ? color : "var(--t2)", marginTop: 3, fontWeight: ok ? 600 : 400 }}>{ok ? good : neutral}</div>
  );
  const actions = (
    <>
      <button onClick={() => toggleWatch(data.symbol, price)} title={watched ? "Remove from watchlist" : "Add to watchlist"} style={labelledActionStyle({ active: watched, activeColor: "var(--yellow)" })}>
        <StarIcon filled={watched} />{watched ? "Watchlist" : "Watch"}
      </button>
      <button onClick={() => setShowAlertModal(true)} title="Set price alert" style={labelledActionStyle({ active: false, activeColor: "var(--accent)" })}>
        <BellIcon />Alert
      </button>
    </>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "8px 20px 80px", color: "var(--t1)" }}>
      {showAlertModal && (
        <CreateAlertModal stock={{ symbol: data.symbol, name: data.name, cmp: price, p1: levels?.p1, p2: levels?.p2, p3: levels?.p3 }} onClose={() => setShowAlertModal(false)} />
      )}

      {/* Sticky action bar */}
      <div style={{ position: "sticky", top: "var(--header-h, 0px)", zIndex: 40, display: "flex", alignItems: "center", gap: 8, padding: "10px 0", marginBottom: 14, background: "var(--bg)", borderBottom: "1px solid var(--bdr)" }}>
        <button onClick={onBack} title={`Back to ${backTo}`} style={{ display: "flex", alignItems: "center", gap: 5, height: 34, borderRadius: 8, background: "var(--s2)", border: "1px solid var(--bdr)", cursor: "pointer", color: "var(--t2)", flexShrink: 0, padding: "0 10px", fontSize: 12, fontWeight: 500, fontFamily: "inherit" }}>
          <ArrowLeft size={15} /> Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 650, color: "var(--t1)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
          {data.name}
          {price > 0 && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: "var(--t3)" }}>{fmtRs(price)}</span>}
        </span>
        {actions}
      </div>

      {m && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--green-dim)", border: "1px solid var(--green-bdr)", fontSize: 12.5, color: "var(--green)", marginBottom: 14, lineHeight: 1.55 }}>
          <CircleCheck size={14} strokeWidth={2.2} style={{ verticalAlign: "-2px", marginRight: 6 }} /><strong>From NSE filings</strong> — EPS, P/E and price loaded ({data.annual?.scope?.toLowerCase() ?? "reported"} results, year to {new Date(`${m.fyEnd}T00:00:00Z`).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })}).{" "}
          <a href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(data.symbol)}`} target="_blank" rel="noreferrer" style={{ color: "var(--green)", fontWeight: 600, whiteSpace: "nowrap" }}>Open on NSE <ArrowUpRight size={13} style={{ verticalAlign: "-2px" }} /></a>
          <div style={{ marginTop: 4, color: "var(--t2)" }}>
            {m.medianPe != null
              ? <>P/E is this stock's <em>5-year median</em> ({m.medianPe.toFixed(1)}; today {m.pe?.toFixed(1) ?? "—"}) — override with your own view if needed.</>
              : <>P/E is <em>today's</em> — fewer than 3 usable years of history for a median. Override with a long-run average for a real valuation.</>}
          </div>
        </div>
      )}

      {m?.epsJump && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 14 }}>
          <strong style={{ color: "var(--yellow)" }}>Profit jumped this year — the price levels use the usual level.</strong>{" "}
          {fyLabel(m.fyEnd)} EPS is ₹{m.epsJump.eps.toFixed(2)}, more than 3× the usual ₹{m.epsJump.usualEps.toFixed(2)}, but the share price hasn't followed (P/E {m.epsJump.pe.toFixed(1)} on the last close, against a usual {m.medianPe.toFixed(1)}). That is how a one-off gain looks. If you expect this profit to last, type {round(m.epsJump.eps, 2)} into EPS below.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--t1)", letterSpacing: "-0.03em" }}>{data.name}</h2>
        <span style={{ fontSize: 11, background: "var(--s3)", color: "var(--t2)", padding: "2px 9px", borderRadius: 6, ...MONO }}>{data.symbol}</span>
        {price > 0 && <span style={{ fontSize: 12, color: "var(--t3)", marginLeft: "auto", ...MONO }}>CMP {fmtRs(price)}</span>}
      </div>
      {m && (m.sector || m.cyclical || m.lender || m.utility) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {m.sector && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--accent-glow)", color: "var(--accent)", fontWeight: 600 }}>{m.sector}</span>}
          {m.lender && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--s3)", color: "var(--t2)", fontWeight: 500 }}>Lender</span>}
          {m.utility && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--s3)", color: "var(--t2)", fontWeight: 500 }}>Regulated utility</span>}
          {m.cyclical && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--yellow-dim)", color: "var(--yellow)", fontWeight: 600 }}>Cyclical</span>}
        </div>
      )}

      {data.quoteError && (
        <div style={{ fontSize: 12, color: "var(--yellow)", background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
          Couldn't fetch a live price ({data.quoteError}){data.close ? " — using NSE's last close." : "."}
        </div>
      )}
      {data.quote?.stale && (
        <div style={{ fontSize: 12, color: "var(--yellow)", background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
          <strong>Showing a cached quote</strong> — Yahoo Finance could not refresh it. Quote date: {data.quote.asOf}.
        </div>
      )}

      {!m && (
        <div style={{ ...card, color: "var(--t3)", fontSize: 13 }}>No usable annual results in NSE's filings for this company, so there's nothing to value or score.</div>
      )}

      {m && <ResearchPanel research={m.research} />}

      {m && (
        <>
          {/* Verify & Override */}
          <div style={{ border: "1px solid var(--bdr2)", borderRadius: 14, padding: 20, marginBottom: 16, background: "var(--s2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 2, letterSpacing: "-0.01em" }}>Verify & Override</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>
                  Auto-filled from NSE filings — edit any value to move the price levels; the research score always uses the filings
                  {usingCustomInputs ? <span style={{ marginLeft: 6, color: "var(--accent)", fontWeight: 600 }}>· custom</span> : <span style={{ marginLeft: 6 }}>· filings baseline</span>}
                </div>
              </div>
              {baseline && usingCustomInputs && (
                <button type="button" onClick={() => applyBaseline(baseline)} className="btn-ghost" style={{ height: 30, fontSize: 12 }}>Reset</button>
              )}
            </div>

            <div className="ss-grid-4">
              <div>
                <label style={labelStyle}>{usualEpsShown ? "Usual EPS (₹)" : `EPS ${fyLabel(m.fyEnd)} (₹)`}</label>
                <input type="number" value={eps} onChange={e => setEps(e.target.value)} style={inputStyle} />
                {usualEpsShown
                  ? <div style={{ fontSize: 10, color: "var(--yellow)", marginTop: 3, fontWeight: 600 }}>{fyLabel(m.fyEnd)} was ₹{m.epsJump.eps.toFixed(2)} — see note above</div>
                  : hint(parseFloat(eps) > 0, "✓ EPS loaded", "From the annual results")}
              </div>
              <div>
                <label style={labelStyle}>Historical P/E</label>
                <input type="number" value={pe} onChange={e => setPe(e.target.value)} style={inputStyle} />
                {hint(parseFloat(pe) > 0 && parseFloat(pe) <= 30, "✓ Reasonable P/E", "5-yr median P/E")}
              </div>
              <div>
                <label style={labelStyle}>EPS Growth % p.a.</label>
                <input type="number" value={growthPct} onChange={e => setGrowthPct(e.target.value)} style={inputStyle} />
                {(() => {
                  // Where the default came from, until it's overridden
                  const basis = baseline && growthPct === baseline.growthPct ? m.growthBasis : null;
                  return hint(parseFloat(growthPct) >= 15, basis ? `✓ Strong growth · ${basis}` : "✓ Strong growth", basis ?? "Expected annual growth");
                })()}
              </div>
              <div>
                <label style={labelStyle}>Margin of Safety %</label>
                <input type="number" value={mosPct} onChange={e => setMosPct(e.target.value)} style={inputStyle} />
                {hint(parseFloat(mosPct) >= 10, "✓ Good margin", "Discount to fair value")}
              </div>
            </div>

            <PeHistoryTable m={m} />
          </div>

          <ValuationExplorer key={`valuation-${symbol}`} metrics={m} price={price} levels={levels} mosPct={mosPct} epsInput={eps} peInput={pe} />

          {/* Current price */}
          <div style={card}>
            <SectionTitle icon={CalendarDays} style={{ marginBottom: 4 }}>Current Price</SectionTitle>
            <p style={{ fontSize: 12, color: "var(--t2)", margin: "0 0 12px" }}>
              Price for <strong>{data.name}</strong>. Override if you want to test a different price.
            </p>
            {priceLabel && <p style={{ fontSize: 12, color: "var(--accent)", margin: "0 0 8px", fontWeight: 500 }}>{priceLabel}</p>}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: "var(--t2)", fontWeight: 500 }}>Rs</span>
              <input type="number" value={actionPrice} onChange={e => { setActionPrice(e.target.value); setPriceLabel("Your price"); }} placeholder="Current price"
                style={{ flex: "1 1 140px", minWidth: 120, height: 42, padding: "0 14px", border: "1px solid var(--accent)", borderRadius: 8, fontSize: 15, fontWeight: 500, outline: "none", background: "var(--s1)", color: "var(--t1)" }} />
              {data.quote && String(data.quote.cmp) !== actionPrice && (
                <button type="button" onClick={() => { setActionPrice(String(data.quote.cmp)); setPriceLabel(`Live price (${data.quote.asOf})`); }}
                  style={{ height: 42, padding: "0 12px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--s1)", fontSize: 12, cursor: "pointer", color: "var(--accent)" }}>
                  Use live price
                </button>
              )}
              {data.close && String(data.close.price) !== actionPrice && (
                <button type="button" onClick={() => { setActionPrice(String(data.close.price)); setPriceLabel(`NSE close (${data.close.date})`); }}
                  style={{ height: 42, padding: "0 12px", borderRadius: 8, border: "1px solid var(--bdr2)", background: "var(--s2)", fontSize: 12, cursor: "pointer", color: "var(--t2)" }}>
                  Use NSE close
                </button>
              )}
            </div>
          </div>

          <RangeWidget lo={m.low52w} hi={m.high52w} price={price} />
        </>
      )}

      <ShareholdingPanel symbol={data.symbol} />
      <PriceChartPanel symbol={data.symbol} name={data.name} />
      {m && <FinancialsPanel history={m.history} />}
      <TechnicalPanel ticker={data.symbol} />

      {m && (
        <>
          <ThesisMonitor metrics={m} />

          {/* Where the price sits — described against the levels, never an instruction */}
          {position && (
            <div style={{ borderRadius: 12, padding: 18, marginBottom: 16, background: "var(--s2)", border: `1px solid color-mix(in srgb, ${positionTone} 45%, var(--bdr2))` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: positionTone, background: `color-mix(in srgb, ${positionTone} 12%, transparent)` }}>
                  <PositionIcon zone={position.zone} size={20} strokeWidth={2} />
                </span>
                <div>
                  <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 500 }}>Where the price sits</div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: positionTone, letterSpacing: "-0.02em" }}>{position.label}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--t1)", margin: 0, lineHeight: 1.6 }}>{position.detail}</p>
              {/* Valuing at a historical P/E makes this common for de-rated stocks */}
              {(position.zone === "below-stop" || position.zone === "phase3") && m.pe && Number(pe) > m.pe * 1.3 && (
                <p style={{ fontSize: 12, color: "var(--t2)", margin: "8px 0 0", lineHeight: 1.6 }}>
                  The market prices it at a P/E of {m.pe.toFixed(1)} against the {Number(pe).toFixed(1)} the levels use. That's either deep value or a sign the old multiple no longer applies — worth finding out why it de-rated.
                </p>
              )}
              <p style={{ fontSize: 11, color: "var(--t3)", margin: "8px 0 0" }}>A description of the price against the levels below, not advice to buy or sell.</p>
            </div>
          )}

          {/* Price ladder */}
          {price > 0 && levels && (
            <div style={card}>
              <SectionTitle icon={Layers}>Price levels</SectionTitle>
              {[
                { label: `Upper level · ${fyLabel(m.fyEnd, 2)} FV +10%`, price: levels.target, color: "var(--red)" },
                { label: `Phase 1 · ${belowFv(levels.p1)}`, price: levels.p1, color: "var(--accent)" },
                { label: `Phase 2 · ${belowFv(levels.p2)}`, price: levels.p2, color: "var(--green)" },
                { label: `Phase 3 · ${belowFv(levels.p3)}`, price: levels.p3, color: "var(--green)" },
                { label: `Stop-loss level · ${belowFv(levels.stopLoss)}`, price: levels.stopLoss, color: "var(--red)" },
              ].filter(r => r.price > 0).sort((a, b) => b.price - a.price).map(rung => {
                const isHere = Math.abs(price - rung.price) / rung.price < 0.03;
                return (
                  <div key={rung.label} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderRadius: 6, marginBottom: 4, fontSize: 13, background: isHere ? "var(--yellow-dim)" : "transparent", border: isHere ? "1px dashed var(--yellow)" : "1px solid var(--bdr)" }}>
                    <span style={{ color: rung.color, fontWeight: 500 }}>{rung.label}</span>
                    <span style={{ fontWeight: 600, color: "var(--t1)" }}>{fmtRs(rung.price)}</span>
                  </div>
                );
              })}
              <div style={{ borderTop: "2px solid var(--accent)", margin: "10px 0", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600 }}>
                <span style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}><ArrowRight size={16} strokeWidth={2.2} /> {priceLabel || "Your price"}</span>
                <span style={{ color: "var(--accent)" }}>{fmtRs(price)}</span>
              </div>
            </div>
          )}

          {/* Fair value */}
          {levels && (
            <div style={card}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px", color: "var(--t1)" }}>
                Fair Value — EPS × {pe || "—"}x P/E
                {usingCustomInputs && <span style={{ fontSize: 11, marginLeft: 8, color: "var(--accent)", fontWeight: 500 }}>(recalculated)</span>}
              </h3>
              <div className="ss-grid-fv">
                {[
                  { label: usualEpsShown ? "Usual EPS" : `${fyLabel(m.fyEnd)} EPS`, val: eps ? `₹${Math.round(Number(eps))}` : "—", sub: `FV: ${fmtRs(levels.fv25)}` },
                  { label: `${fyLabel(m.fyEnd, 1)} EPS (est.)`, val: levels.e26 ? `₹${levels.e26}` : "—", sub: `FV: ${fmtRs(levels.fv26)}` },
                  { label: `${fyLabel(m.fyEnd, 2)} EPS (est.)`, val: levels.e27 ? `₹${levels.e27}` : "—", sub: `FV: ${fmtRs(levels.fv27)}` },
                  { label: "Phase 1 level", val: fmtRs(levels.safeBuy), sub: `Today's FV × ${100 - Number(mosPct || 10)}%`, hi: true },
                ].map(fc => (
                  <div key={fc.label} style={{ background: "var(--s1)", borderRadius: 8, padding: 12, border: fc.hi ? "1px solid var(--green)" : "1px solid var(--bdr)" }}>
                    <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>{fc.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: fc.hi ? "var(--green)" : "var(--t1)" }}>{fc.val}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{fc.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <PiotroskiCard m={m} />
          <KeyNumbers data={data} m={m} />
        </>
      )}

      <PeersPanel symbol={data.symbol} onAnalyze={onOpenStock} />
      <NewsPanel symbol={data.symbol} />
      <MyNotes key={data.symbol} symbol={data.symbol} />

      <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", lineHeight: 1.6 }}>
        <TriangleAlert size={12} style={{ verticalAlign: "-1px", marginRight: 4 }} />Educational purposes only. Not financial advice. Always cross-verify data on NSE / BSE before investing. Consult a SEBI registered advisor.
      </p>

      <div className="ss-back-bottom">
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--accent)", background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 12, cursor: "pointer", padding: "12px 24px", fontWeight: 600, margin: "8px auto 0" }}>
          <ArrowLeft size={16} /> Back to {backTo}
        </button>
      </div>
      <div className="ss-back-sticky">
        <button onClick={onBack} style={{ width: "100%", height: 48, borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--s2)", color: "var(--accent)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <ArrowLeft size={16} /> Back to {backTo}
        </button>
      </div>
    </div>
  );
}
