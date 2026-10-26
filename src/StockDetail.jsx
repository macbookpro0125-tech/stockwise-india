import { useState, useEffect, useMemo, useRef } from "react";
import { cardName } from "./stockName.js";
import { SHOW_TAB, usePhone } from "./phoneTabs.js";
import { NotebookPen, Check, X, TriangleAlert, LoaderCircle, ArrowLeft, ArrowUpRight, CalendarDays, CircleCheck, ArrowRight } from "lucide-react";
import { api } from "./api.js";
import { fairValues, userLevels, pricePosition, fmtRs } from "../server/levels.js";
import { useMyLevels } from "./myLevels.js";
import MyLevelsCard from "./MyLevelsCard.jsx";
import { PositionIcon } from "./icons.jsx";
import ResearchPanel from "./ResearchPanel.jsx";
import { useWatchlist, toggleWatch } from "./watchlist.js";
import { notesStore } from "./accountData.js";
import CreateAlertModal from "./CreateAlertModal.jsx";
import PriceChartPanel from "./PriceChartPanel.jsx";
import FinancialsPanel from "./FinancialsPanel.jsx";
import TechnicalPanel from "./TechnicalPanel.jsx";
import PeersPanel from "./PeersPanel.jsx";
import NewsPanel from "./NewsPanel.jsx";
import AroundTheWeb from "./AroundTheWeb.jsx";
import ValuationExplorer from "./ValuationExplorer.jsx";
import { ValuedAs, BankValuation, CyclicalValuation, NoFairValue, pbAt, CYCLE_TONE } from "./ValuationModel.jsx";
import PhasePositionPlanner from "./PhasePositionPlanner.jsx";
import ThesisMonitor from "./ThesisMonitor.jsx";
import StockSide from "./StockSide.jsx";
import StockGlance from "./StockGlance.jsx";
import WhyMoving from "./WhyMoving.jsx";
import StockPerformance from "./StockPerformance.jsx";
import StockDataDates from "./StockDataDates.jsx";
import StockDividends from "./StockDividends.jsx";
import StockHealth from "./StockHealth.jsx";
import StockSectorCompare from "./StockSectorCompare.jsx";
import StockBusiness from "./StockBusiness.jsx";
import StockRecent from "./StockRecent.jsx";
import InsidersPanel from "./InsidersPanel.jsx";
import StockEarningsCall from "./StockEarningsCall.jsx";
import StockSnapshot from "./StockSnapshot.jsx";
import { CHAPTERS, VerdictLines, ChapterTop, ChapterEnd } from "./StockChapters.jsx";
import { docTop } from "./motion.js";

// The original Stockwise stock page (stock-screener src/StockScreener.jsx),
// on this app's NSE data: the research dashboard (in place of the original's
// 10-point checklist and BUY/HOLD/AVOID verdict — ResearchPanel.jsx), verify &
// override, current price, 52-week range, shareholding, price chart,
// financials, technicals, pros & cons, where the price sits, the price levels,
// fair value, Piotroski, key numbers, peers, news & filings, and your notes.
// Where it differs from the original: historical annual P/E is shown as
// context; the multiple behind the price levels is capped at twice the
// sector's median P/E when enough peers have one (screen.js). One-off profit
// jumps and an annual EPS filed as one quarter's are corrected before
// valuation; the price levels are described, never turned
// into buy or sell instructions.

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
  <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 400, margin: "0 0 14px", color, letterSpacing: "-0.01em", ...style }}>
    {Icon && <Icon size={17} strokeWidth={2} style={{ color: "var(--t3)", flexShrink: 0 }} />}{children}
  </h3>
);

const round = (v, dp = 1) => (v == null || !isFinite(v) ? null : Math.round(v * 10 ** dp) / 10 ** dp);
const pctText = v => (v == null ? "—" : `${round(v, 1)}%`);

// Fiscal-year labels from the latest filed year: FY26 = the year to Mar 2026
const fyLabel = (fyEnd, plus = 0) => `FY${String(Number(fyEnd.slice(0, 4)) + plus).slice(2)}`;

// ---- Panels -------------------------------------------------------------------

function PeHistoryTable({ m }) {
  const cell = { padding: "7px 10px", fontSize: 12, borderBottom: "1px solid var(--bdr)", textAlign: "right" };
  const head = { ...cell, fontSize: 11.5, fontWeight: 500, color: "var(--t3)" };
  const fy = iso => new Date(`${iso}T00:00:00Z`).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--bdr)", paddingTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 400, color: "var(--accent)", marginBottom: 6 }}>Historical annual P/E — the company's own record, last {m.peHistory.length} fiscal years</div>
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
                <td style={{ ...cell, ...MONO, fontWeight: 400 }}>{y.pe != null ? y.pe.toFixed(1) : "—"}</td>
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
          ? <>The fair value uses the median of these {m.peYears} years (in the Overview's key figures), capped at twice the sector's median P/E if it runs higher.</>
          : <>Only {m.peYears} usable annual observations — there is not enough history for a median.</>}
        {m.epsJump && <> Median EPS of the same years: <strong style={{ color: "var(--t1)" }}>₹{m.epsJump.usualEps.toFixed(2)}</strong> — the usual level, used instead of {fyLabel(m.fyEnd)}'s ₹{m.epsJump.eps.toFixed(2)}.</>}
      </div>
    </div>
  );
}

// "About the company": what it does and the basics. The description, business
// lines, incorporation, headcount and contacts come from its Business
// Responsibility & Sustainability Report (filed by the top ~1,000 listed
// companies), the listing date, ISIN and face value from NSE's equity list,
// and the rest from this page's own filings data.
// "2003-07-09" or NSE's "09-JUL-2003" → "9 Jul 2003", read as a calendar
// date (parsing "09-JUL-2003" as local time put it a day early)
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const longDate = v => {
  if (!v) return null;
  const dmy = String(v).trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  const t = dmy && MON[dmy[2].toUpperCase()] != null ? Date.UTC(Number(dmy[3]), MON[dmy[2].toUpperCase()], Number(dmy[1]))
    : /^\d{4}-\d{2}-\d{2}/.test(v) ? Date.parse(`${String(v).slice(0, 10)}T00:00:00Z`) : NaN;
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : v;
};
const count = v => Number(v).toLocaleString("en-IN");
function CompanyProfile({ symbol, m }) {
  const [d, setD] = useState(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.panel(symbol, "profile").then(x => { if (!cancelled) setD(x); }).catch(() => { if (!cancelled) setD({}); });
    return () => { cancelled = true; };
  }, [symbol]);
  const p = d?.profile, l = d?.listing, latest = m?.history?.[0];
  const description = p?.about || p?.mainActivity || null;
  // The sector, industry and market cap are on the cards just above
  // (StockSnapshot.jsx), so they aren't repeated here
  const facts = [
    // NSE's list dates the main board: for a company that moved up from its
    // SME platform (Emerge), that's the move, not its first listing — Kotyark
    // reads 12 Mar 2026, listed on Emerge in Nov 2021. No public list keeps
    // migrated companies' SME dates, so the label says which listing it is.
    ["On NSE main board since", longDate(l?.listedOn)],
    ["Incorporated", longDate(p?.incorporated)],
    ["Employees", p?.employees != null ? `${count(p.employees)}${p.workers ? ` · ${count(p.workers)} workers` : ""}` : null],
    ["Shares", m?.shares > 0 ? `${(m.shares / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr` : null],
    ["Face value", l?.faceValue != null ? `₹${l.faceValue}` : null],
    ["Year ends", latest?.fyEnd ? new Date(`${latest.fyEnd}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", timeZone: "UTC" }) : null],
    ["Accounts", latest?.scope ?? null],
    ["Auditor", latest?.auditor ?? null],
    ["ISIN", l?.isin],
  ].filter(([, v]) => v);
  // The three most people want stay out; the registry's (shares, face value,
  // auditor, ISIN…) go under the button with the contact details
  const KEY = ["Employees", "Incorporated", "On NSE main board since"];
  const shown = facts.filter(([label]) => KEY.includes(label));
  const registry = facts.filter(([label]) => !KEY.includes(label));
  const extra = [
    ...registry,
    ["Website", p?.website && <a href={p.website} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{p.website.replace(/^https?:\/\//, "")} ↗</a>],
    ["Registered office", p?.registeredOffice],
    ["Corporate office", p?.corporateOffice !== p?.registeredOffice ? p?.corporateOffice : null],
    ["Investor email", p?.email],
    ["Phone", p?.phone],
    ["CIN", p?.cin],
  ].filter(([, v]) => v);
  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 12, padding: "16px 18px", marginBottom: 14, background: "var(--s2)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 450, margin: 0, color: "var(--t1)" }}>About the company</h3>
        {p?.report?.fy && <span style={{ fontSize: 11.5, color: "var(--t3)" }}>From its {p.report.fy} business responsibility report{p.report.filed ? `, filed ${longDate(p.report.filed)}` : ""}</span>}
      </div>
      {d == null ? (
        <div style={{ fontSize: 13, color: "var(--t3)" }}>Loading company details…</div>
      ) : (
        <>
          {description && <p style={{ fontSize: 13.5, color: "var(--t2)", lineHeight: 1.6, margin: "0 0 8px" }}>{description}.</p>}
          {p?.businessLines?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {p.businessLines.filter(b => b.length <= 70).map(b => <span key={b} style={{ fontSize: 12, padding: "3px 9px", borderRadius: 999, background: "var(--s3)", color: "var(--t2)" }}>{b}</span>)}
            </div>
          )}
          {p?.businessLines?.some(b => b.length > 70) && (
            <ul style={{ margin: "0 0 12px", padding: "0 0 0 18px", fontSize: 13, color: "var(--t2)", lineHeight: 1.55 }}>
              {p.businessLines.filter(b => b.length > 70).map(b => <li key={b}>{b}</li>)}
            </ul>
          )}
          {!p && <p style={{ fontSize: 12.5, color: "var(--t3)", lineHeight: 1.55, margin: "0 0 10px" }}>No business description on NSE: the company doesn't file a business responsibility report (only the top ~1,000 listed companies must). The basics below are from its listing and results.</p>}
          <div className="company-facts">
            {shown.map(([label, value]) => (
              <div key={label} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, color: "var(--t1)", fontWeight: 400, overflowWrap: "anywhere" }}>{value}</div>
              </div>
            ))}
          </div>
          {extra.length > 0 && (
            <>
              <button type="button" className="btn-ghost tap" onClick={() => setMore(v => !v)} aria-expanded={more} style={{ height: 30, fontSize: 12, marginTop: 12 }}>{more ? "Fewer details" : "Contact and registration details"}</button>
              {more && (
                <div className="company-facts" style={{ marginTop: 10 }}>
                  {extra.map(([label, value]) => (
                    <div key={label} style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, color: "var(--t1)", overflowWrap: "anywhere", lineHeight: 1.5 }}>{value}</div>
                    </div>
                  ))}
                  {p?.report?.pdf && (
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 2 }}>Source</div>
                      <a href={p.report.pdf} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--accent)" }}>Business responsibility report (PDF) ↗</a>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ShareholdingPanel({ symbol }) {
  const phone = usePhone();
  const [quarters, setQuarters] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.panel(symbol, "shareholding").then(d => { if (!cancelled) setQuarters(d.quarters); }).catch(() => { if (!cancelled) setQuarters([]); });
    return () => { cancelled = true; };
  }, [symbol]);
  // The latest quarter and the change are the table's last columns: on a
  // phone the table opens scrolled to them, not to the oldest quarter
  const tableRef = useRef(null);
  useEffect(() => {
    const el = tableRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [quarters]);
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
  // A phone shows the two quarters the change is between, so the table fits
  // its screen (26 Oct 2026: the earlier columns peeked in, cut off)
  const cols = phone && quarters.length > 2 ? [quarters[0], quarters.at(-1)] : quarters;
  const change = key => {
    const vals = quarters.map(q => q[key]).filter(v => v != null);
    return vals.length >= 2 ? Math.round((vals.at(-1) - vals[0]) * 100) / 100 : null;
  };

  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 10, padding: "16px 20px", marginBottom: 12, background: "var(--s2)" }}>
      <div style={{ fontSize: 13, fontWeight: 400, color: "var(--t1)", marginBottom: 10 }}>Shareholding as of {period(latest)}</div>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 10, gap: 1 }}>
        {segments.map(({ key, color }) => <div key={key} style={{ flex: latest[key], background: color, minWidth: latest[key] > 1 ? 2 : 0 }} />)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginBottom: quarters.length > 1 ? 14 : 0 }}>
        {/* The bar's key; with a table below, the figures are in it, not here too */}
        {segments.map(({ label, key, color }) => (
          <span key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--t2)" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
            {label}{quarters.length === 1 && <> <strong style={{ color: "var(--t1)" }}>{latest[key]}%</strong></>}
          </span>
        ))}
      </div>
      {quarters.length > 1 && (
        <div ref={tableRef} style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--t3)", fontWeight: 400, borderBottom: "1px solid var(--bdr2)", position: "sticky", left: 0, background: "var(--s2)", boxShadow: "10px 0 10px -10px rgba(0, 0, 0, 0.55)", zIndex: 1 }}></th>
                {cols.map(q => <th key={q.period} style={{ textAlign: "right", padding: "6px 8px", color: "var(--t3)", fontWeight: 500, borderBottom: "1px solid var(--bdr2)", whiteSpace: "nowrap" }}>{period(q)}</th>)}
                <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--t3)", fontWeight: 400, borderBottom: "1px solid var(--bdr2)" }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {defs.map(({ label, key, color }) => {
                if (!quarters.some(q => q[key] != null)) return null;
                const chg = change(key);
                return (
                  <tr key={key}>
                    <td style={{ padding: "6px 8px", color: "var(--t1)", fontWeight: 500, borderBottom: "1px solid var(--bdr2)", whiteSpace: "nowrap", position: "sticky", left: 0, background: "var(--s2)", boxShadow: "10px 0 10px -10px rgba(0, 0, 0, 0.55)", zIndex: 1 }}>
                      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, marginRight: 6, verticalAlign: "middle" }} />{label}
                    </td>
                    {cols.map(q => (
                      <td key={q.period} style={{ textAlign: "right", padding: "6px 8px", color: q[key] != null ? "var(--t2)" : "var(--t3)", borderBottom: "1px solid var(--bdr2)" }}>
                        {q[key] != null ? `${q[key]}%` : "—"}
                      </td>
                    ))}
                    <td style={{ textAlign: "right", padding: "6px 8px", fontWeight: 400, borderBottom: "1px solid var(--bdr2)", color: chg == null || chg === 0 ? "var(--t3)" : chg > 0 ? "var(--green)" : "var(--red)" }}>
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

// My Notes — saved to the account (the original kept them in the browser)
function MyNotes({ symbol }) {
  const [saved, setSaved] = useState(() => notesStore.get(symbol));
  const [editing, setEditing] = useState(!saved);
  const [verdict, setVerdict] = useState(saved?.verdict ?? null);
  const [text, setText] = useState(saved?.text ?? "");
  // The account's notes may arrive after the page draws
  useEffect(() => {
    const update = () => {
      const n = notesStore.get(symbol);
      setSaved(n);
      if (n) { setVerdict(n.verdict); setText(n.text ?? ""); setEditing(false); }
    };
    window.addEventListener("notesUpdated", update);
    return () => window.removeEventListener("notesUpdated", update);
  }, [symbol]);

  const save = () => {
    if (!verdict) return;
    const note = { verdict, text: text.trim(), savedAt: new Date().toLocaleDateString("en-IN") };
    notesStore.save(symbol, note).catch(() => {});
    setSaved(note);
    setEditing(false);
  };
  const remove = () => {
    notesStore.remove(symbol).catch(() => {});
    setSaved(null); setVerdict(null); setText(""); setEditing(true);
  };

  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 10, padding: 16, marginBottom: 16, background: "var(--s2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 400, color: "var(--t1)" }}><NotebookPen size={17} style={{ color: "var(--t3)" }} /> My Notes</span>
        {saved && !editing && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="tap" onClick={() => setEditing(true)} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--accent)", cursor: "pointer" }}>Edit</button>
            <button className="tap" onClick={remove} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--bdr2)", background: "var(--s1)", color: "var(--t3)", cursor: "pointer" }}>Delete</button>
          </div>
        )}
      </div>
      {saved && !editing ? (
        <div>
          <div style={{ display: "inline-block", fontSize: 12, fontWeight: 450, padding: "4px 12px", borderRadius: 20, background: VERDICT_META[saved.verdict]?.bg, color: VERDICT_META[saved.verdict]?.color, border: `1px solid ${VERDICT_META[saved.verdict]?.border}` }}>
            <Dot color={VERDICT_META[saved.verdict]?.color} />{VERDICT_META[saved.verdict]?.label}
          </div>
          {saved.text && <p style={{ fontSize: 13, color: "var(--t2)", margin: "8px 0 4px", lineHeight: 1.5 }}>{saved.text}</p>}
          <p style={{ fontSize: 11, color: "var(--t3)", margin: 0 }}>Saved {saved.savedAt} · kept with your account</p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: "var(--t2)", margin: "0 0 10px" }}>Set your verdict and add a note for this stock.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {Object.entries(VERDICT_META).map(([key, meta]) => (
              <button key={key} className="tap" onClick={() => setVerdict(key)} style={{ fontSize: 12, fontWeight: 400, padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${verdict === key ? meta.border : "var(--bdr2)"}`, background: verdict === key ? meta.bg : "var(--surf)", color: verdict === key ? meta.color : "var(--t2)", cursor: "pointer", transition: "all 0.15s" }}>
                <Dot color={meta.color} />{meta.label}
              </button>
            ))}
          </div>
          <textarea aria-label="Your note on this company" maxLength={2000} value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Add a note... e.g. Wait for P2 entry. Watch working-capital days."
            style={{ width: "100%", fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--bdr2)", resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "var(--s1)", color: "var(--t1)" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="tap" onClick={save} disabled={!verdict} style={{ fontSize: 13, fontWeight: 400, padding: "7px 18px", borderRadius: 8, border: "none", background: verdict ? "var(--accent)" : "var(--card2)", color: verdict ? "var(--on-accent)" : "var(--t3)", cursor: verdict ? "pointer" : "not-allowed" }}>Save Note</button>
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
        <h3 style={{ fontSize: 15, fontWeight: 400, margin: 0, color: "var(--t1)" }}>Piotroski Score</h3>
        <span style={{ fontSize: 13, fontWeight: 500, color, ...MONO }}>{m.piotroski}/9</span>
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

// Figures the page shows nowhere else. The rest have one home each: P/E,
// P/B, yield, ROE, ROCE, debt to equity and market cap in the Overview;
// interest cover and free cash flow in Financial health; payout in
// Dividends; FII/DII in Holdings (this box once showed an older quarter's
// beside the newer one there); shares in About.
function KeyNumbers({ data, m }) {
  const cr = n => (n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")} Cr`);
  const crRaw = n => (n == null ? "—" : cr(n / 1e7));
  const stats = [
    [`ROE (${m.roeAvgYears}Y avg)`, pctText(m.roeAvg)], ["OPM", pctText(m.opm)],
    ["Sales growth 3Y / 5Y", `${pctText(m.salesGrowth3y)} / ${pctText(m.salesGrowth5y)}`], ["Profit growth 3Y / 5Y", `${pctText(m.profitGrowth3y)} / ${pctText(m.profitGrowth5y)}`],
    ["Revenue (latest qtr)", crRaw(data.pnl?.revenueQuarter)], ["Profit (latest qtr)", crRaw(data.pnl?.profitQuarter)],
    ["Net current assets (NCAV)", cr(m.ncavCr)],
  ];
  return (
    <div style={card}>
      <h3 style={{ fontSize: 15, fontWeight: 400, margin: "0 0 12px", color: "var(--t1)" }}>More figures</h3>
      <div className="ss-grid-4">
        {stats.map(([label, value]) => (
          <div key={label} style={{ background: "var(--s1)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--bdr)" }}>
            <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 400, color: "var(--t1)", ...MONO }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 10 }}>The other key figures are in the Overview; debt and cash in Financial health; payout in Dividends; who owns it in Holdings.</div>
    </div>
  );
}

// ---- Page ---------------------------------------------------------------------

// backTo: the tab Back returns to
// "2026-10-07" -> "7 Oct"
const dayLabel = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
// A quote passed with the page (Yahoo's daily close until 24 Oct 2026; none
// now, as the price is NSE's close) counts only when it's newer than NSE's
const quoteIsNewer = d => !!d.quote && (!d.close || d.quote.asOf >= d.close.date);
const quoteLabel = q => `${q.stale ? "Cached close" : "Latest close"} (${dayLabel(q.asOf)})`;
const closeLabel = c => `NSE close (${dayLabel(c.date)})`;

// The page's tabs, pinned over it (replica/recon.md): each jumps to its
// first part on the page and lights up while any of its parts is in view.
// Then the question each answers, in plain words, and its icon: how people
// know which tab they need (asked for 21 Oct 2026: "how will people know
// they need the scorecard or valuation or the others?") — the Overview's
// Go deeper list and the Next card at a tab's end ask them; a computer
// shows them on a tab's hover
// The tabs are the chapters (StockChapters.jsx): [id, label, parts, question]
const TABS = CHAPTERS.map(c => [c.id, c.label, c.parts, c.question]);

// A tab not built yet (a phone builds one when it's first shown): its mark
// alone, so the Go deeper list and the Next card still know it's there
// A folded card on a phone that builds what's inside only once opened: a
// closed <details> still builds it all, and the scores dashboard folded in
// the Summary made each company open slower (measured 26 Oct 2026)
function Fold({ id, title, children }) {
  const [opened, setOpened] = useState(false);
  return (
    <details id={id} className="sd-card sd-fold" onToggle={e => { if (e.currentTarget.open) setOpened(true); }}>
      <summary>{title}</summary>
      {opened && children}
    </details>
  );
}

const TabStub = ({ tab, part }) => <div className="sd-tabpart" data-tab={tab}><div id={`sec-${part}`} /></div>;

// The tabs this company has a part for (no valuation without filings, …)
function usePresentTabs(ready) {
  const [present, setPresent] = useState([]);
  useEffect(() => {
    setPresent(TABS.filter(([, , parts]) => parts.some(p => document.getElementById(`sec-${p}`))));
  }, [ready]);
  return present;
}

// A phone's tab ends by pointing on to the next one (asked for 21 Oct 2026,
// in place of "Back to Discover": "go forward and check all other things",
// so people see there's more); the last tab ends plainly
function NextTab({ ready, current, onGo }) {
  const present = usePresentTabs(ready);
  const at = present.findIndex(([id]) => id === current);
  const next = at >= 0 ? present[at + 1] : null;
  if (!next) return null;
  const [id, label, , holds] = next;
  return (
    <button type="button" className="sd-next" onClick={() => onGo(id)} aria-label={`Next: ${label}. ${holds}`}>
      <span className="sd-next-text"><small>Next</small><b>{label}</b><span>{holds}</span></span>
      <ArrowRight size={20} aria-hidden="true" />
    </button>
  );
}

function SectionNav({ ready, phone = false, phoneTab = "overview", onPhoneTab }) {
  const [present, setPresent] = useState(TABS);
  const [spied, setSpied] = useState("overview");
  const active = phone ? phoneTab : spied;
  const setActive = setSpied;
  const rowRef = useRef(null);
  // Only the tabs this company has a part for (no valuation without filings, …)
  useEffect(() => {
    setPresent(TABS.map(([id, label, parts, question]) => [id, label, parts.filter(p => document.getElementById(`sec-${p}`)), question]).filter(t => t[2].length));
  }, [ready]);
  // Where the pinned bar ends once pinned — not where it is now: on a phone
  // the header above it scrolls away on the way down
  const barBottom = () => {
    const pinnedAt = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
    return pinnedAt + (document.querySelector("[data-sticky-top]")?.offsetHeight ?? 0);
  };
  useEffect(() => {
    if (phone) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const line = barBottom() + 32;
        let current = present[0]?.[0];
        for (const [id, , parts] of present) {
          if (parts.some(p => (document.getElementById(`sec-${p}`)?.getBoundingClientRect().top ?? Infinity) <= line)) current = id;
        }
        setActive(current);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); };
  }, [present, phone]);
  // Keep the lit tab in view as the page scrolls past the parts
  useEffect(() => {
    const row = rowRef.current, tab = row?.querySelector(`[data-sec="${active}"]`);
    if (!row || !tab) return;
    const left = tab.offsetLeft - row.offsetLeft, right = left + tab.offsetWidth;
    if (left < row.scrollLeft + 8 || right > row.scrollLeft + row.clientWidth - 8) row.scrollTo({ left: left - 12, behavior: "smooth" });
  }, [active]);
  const go = (parts, id) => {
    if (phone) return onPhoneTab?.(id);
    const el = document.getElementById(`sec-${parts[0]}`);
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: docTop(el) - barBottom() - 10, behavior: reduced ? "auto" : "smooth" });
  };
  if (present.length < 2) return null;
  return (
    <nav ref={rowRef} aria-label="Parts of this page" className="sd-tabs">
      {present.map(([id, label, parts, question]) => (
        <button key={id} type="button" data-sec={id} title={phone ? undefined : question} aria-current={active === id ? "true" : undefined} onClick={() => go(parts, id)} className={`sd-tab${active === id ? " on" : ""}`}>{label}</button>
      ))}
    </nav>
  );
}

export default function StockDetail({ symbol, account, onBack, backTo = "Discover", onOpenStock }) {
  const watched = useWatchlist().has(symbol);
  // A phone shows one tab's parts at a time (asked for 20 Oct 2026: the
  // page was 25 screens in one scroll, "congested and not understandable");
  // a computer keeps the one page, its tabs jumping down it. A jump to a
  // part on another tab (a scorecard row, "See Financial health") switches
  // to that tab first (phoneTabs.js).
  const isPhone = usePhone();
  const [phoneTab, setPhoneTab] = useState("overview");
  useEffect(() => { setPhoneTab("overview"); }, [symbol]);
  // A phone builds a tab the first time it's shown and keeps it: built all
  // at once, the hidden tabs froze an Android phone for a few tenths of a
  // second as each company opened (measured 26 Oct 2026). A computer shows
  // them all, one page
  const [opened, setOpened] = useState(() => new Set(["overview"]));
  useEffect(() => { setOpened(new Set(["overview"])); }, [symbol]);
  useEffect(() => { setOpened(o => (o.has(phoneTab) ? o : new Set(o).add(phoneTab))); }, [phoneTab]);
  const built = tab => !isPhone || tab === phoneTab || opened.has(tab);
  useEffect(() => {
    const show = e => setPhoneTab(e.detail);
    window.addEventListener(SHOW_TAB, show);
    return () => window.removeEventListener(SHOW_TAB, show);
  }, []);
  const showPhoneTab = id => {
    setPhoneTab(id);
    // the tab's start just under the pinned bar, unless the page is above it
    requestAnimationFrame(() => {
      const main = document.querySelector(".sd-main"), bar = document.querySelector("[data-sticky-top]");
      if (!main) return;
      const top = docTop(main) - (bar?.offsetHeight ?? 0) - 8;
      if (window.scrollY > top) window.scrollTo(0, top);
    });
  };
  const [showAlertModal, setShowAlertModal] = useState(false);
  // Esc goes back on a computer, as the Back button says — not while typing,
  // nor while a dialog or the expanded chart is open (they close on Esc first)
  useEffect(() => {
    const onKey = e => {
      if (e.key !== "Escape" || e.defaultPrevented || showAlertModal) return;
      if (e.target.closest?.("input, textarea, select, [contenteditable=true]")) return;
      if (document.querySelector("[role=dialog], .cm-scrim") || window.history.state?.chartOverlay) return;
      onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, showAlertModal]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // Verify & Override (the original's inputs), plus the price box
  const [eps, setEps] = useState("");
  const [pe, setPe] = useState("");
  const [growthPct, setGrowthPct] = useState("");
  // A bank's cost of equity (bank-valuation.js), which sets its P/B input
  const [costOfEquity, setCostOfEquity] = useState(12);
  const [actionPrice, setActionPrice] = useState("");
  const [priceLabel, setPriceLabel] = useState("");
  const [baseline, setBaseline] = useState(null);

  const applyBaseline = b => {
    setEps(b.eps); setPe(b.pe); setGrowthPct(b.growthPct);
    if (b.costOfEquity != null) setCostOfEquity(b.costOfEquity);
  };

  useEffect(() => {
    let cancelled = false;
    api.stock(symbol).then(d => {
      if (cancelled) return;
      setData(d);
      // Market data is useful even when NSE has no usable annual filings.
      // Keep the displayed reference price independent of the research score.
      if (quoteIsNewer(d)) { setActionPrice(String(d.quote.cmp)); setPriceLabel(quoteLabel(d.quote)); }
      else if (d.close) { setActionPrice(String(d.close.price)); setPriceLabel(closeLabel(d.close)); }
      const m = d.metrics;
      if (!m) return;
      // A bank's inputs are its book, P/B and book growth — the same levels
      // arithmetic, on book instead of earnings
      const v = m.valuation;
      const b = v?.model === "book" ? {
        eps: String(round(v.adjustedBvps, 2)),
        pe: String(round(v.justifiedPb, 2)),
        growthPct: String(round(v.growth, 1)),
        costOfEquity: v.costOfEquity,
      } : v?.model === "cyclical" ? {
        // A cyclical's are mid-cycle EPS, its usual multiple of that, and
        // revenue growth (mid-cycle EPS moves with revenue)
        eps: String(round(v.normalizedEps, 2)),
        pe: String(round(v.multiple, 1)),
        growthPct: String(round(v.growth, 1)),
      } : {
        eps: m.valuationEps != null ? String(round(m.valuationEps, 2)) : "",
        pe: m.valuationPe ? String(round(m.valuationPe, 1)) : "",
        growthPct: String(round(m.growthForValuation, 1)),
      };
      setBaseline(b);
      applyBaseline(b);
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [symbol]);

  const m = data?.metrics;
  const model = m?.valuation?.model;
  const onBook = model === "book";
  const onCycle = model === "cyclical";
  // No inputs to move without a model that values the company
  const valued = model === "earnings" || onBook || onCycle;
  const usingCustomInputs = !!baseline && (eps !== baseline.eps || pe !== baseline.pe || growthPct !== baseline.growthPct);
  // A one-off profit jump: the EPS box holds the usual level until you change it
  const usualEpsShown = !!m?.epsJump && m.valuation?.model === "earnings" && !!baseline && eps === baseline.eps;
  // The fair values: the table's own until an input changes — the inputs hold
  // rounded values, which could move a fair value by a rupee against the
  // Discover table
  const fv = useMemo(() => {
    if (!m) return null;
    return usingCustomInputs && valued ? fairValues(eps, pe, growthPct) : m.levels;
  }, [m, usingCustomInputs, valued, eps, pe, growthPct]);
  // The price levels are the user's own — from their settings, or typed for
  // this stock — and none while they're off (MyLevelsCard.jsx)
  const mine = useMyLevels();
  const levels = useMemo(() => userLevels(valued ? fv : null, mine, symbol), [fv, valued, mine, symbol]);
  const price = Number(actionPrice) || null;

  if (error) {
    return (
      <div style={{ padding: "28px var(--page-x)" }}>
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
  const positionTone = { red: "var(--red)", yellow: "var(--yellow)", green: "var(--green)", neutral: "var(--accent)" }[position?.tone] ?? "var(--accent)";

  const hint = (ok, good, neutral, color = "var(--green)") => (
    <div style={{ fontSize: 10, color: ok ? color : "var(--t2)", marginTop: 3, fontWeight: ok ? 500 : 400 }}>{ok ? good : neutral}</div>
  );

  // Value's inputs: first on a computer; on a phone, folded under the answer
  // (26 Oct 2026: the answer before the tools)
  const overrideCard = m && (
    <div className="ss-section" data-tour="override" style={{ border: "1px solid var(--bdr2)", borderRadius: 14, padding: 20, marginBottom: 16, background: "var(--s2)" }}>
      {valued ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 400, color: "var(--t1)", marginBottom: 2, letterSpacing: "-0.01em" }}>Verify & Override</div>
              <div style={{ fontSize: 11, color: "var(--t3)" }}>
                Auto-filled from NSE filings — edit any value to move the fair value (and your price levels, if on); the research score always uses the filings
                {usingCustomInputs ? <span style={{ marginLeft: 6, color: "var(--accent)", fontWeight: 400 }}>· custom</span> : <span style={{ marginLeft: 6 }}>· filings baseline</span>}
              </div>
            </div>
            {baseline && usingCustomInputs && (
              <button type="button" onClick={() => applyBaseline(baseline)} className="btn-ghost" style={{ height: 30, fontSize: 12 }}>Reset</button>
            )}
          </div>
          <ValuedAs valuation={m.valuation} />

          <div className="ss-grid-3">
            <div>
              <label style={labelStyle}>{onBook ? "Book/share less net NPA (₹)" : onCycle ? "Mid-cycle EPS (₹)" : usualEpsShown ? "Usual EPS (₹)" : `EPS ${fyLabel(m.fyEnd)} (₹)`}</label>
              <input type="number" aria-label={onBook ? "Book per share less net NPA" : onCycle ? "Mid-cycle EPS" : "EPS"} value={eps} onChange={e => setEps(e.target.value)} style={inputStyle} />
              {onBook ? hint(parseFloat(eps) > 0, "✓ From the filings", "Owners' equity − net NPA, per share")
                : onCycle ? hint(parseFloat(eps) > 0, "✓ Revenue a share × through-cycle margin", "")
                : usualEpsShown
                  ? <div style={{ fontSize: 10, color: "var(--yellow)", marginTop: 3, fontWeight: 400 }}>{fyLabel(m.fyEnd)} was ₹{m.epsJump.eps.toFixed(2)} — see note above</div>
                  : hint(parseFloat(eps) > 0, "✓ EPS loaded", "From the annual results")}
            </div>
            <div>
              <label style={labelStyle}>{onBook ? "Justified P/B" : onCycle ? "Usual multiple (mid-cycle)" : "Historical P/E"}</label>
              <input type="number" aria-label={onBook ? "Justified P/B" : onCycle ? "Usual multiple" : "Historical P/E"} value={pe} onChange={e => setPe(e.target.value)} style={inputStyle} />
              {onBook ? hint(parseFloat(pe) > 0, "✓ From its return on equity", "(ROE − g) ÷ (cost of equity − g)")
                : onCycle ? hint(parseFloat(pe) > 0, "✓ Median on mid-cycle EPS", "")
                : hint(parseFloat(pe) > 0 && parseFloat(pe) <= 30, "✓ Reasonable P/E", "Review high P/E assumption")}
            </div>
            <div>
              <label style={labelStyle}>{onBook ? "Book growth % p.a." : onCycle ? "Revenue growth % p.a." : "EPS Growth % p.a."}</label>
              <input type="number" aria-label="Growth % a year" value={growthPct} onChange={e => {
                setGrowthPct(e.target.value);
                // A bank's P/B moves with its growth rate
                if (onBook) { const pb = pbAt(m.valuation.roe, Number(e.target.value), costOfEquity); if (pb != null) setPe(String(round(pb, 2))); }
              }} style={inputStyle} />
              {(() => {
                if (onBook) return hint(false, "", "Retained earnings, capped at 8%");
                if (onCycle) return hint(false, "", "Mid-cycle EPS grows with revenue");
                // Where the default came from, until it's overridden
                const basis = baseline && growthPct === baseline.growthPct ? m.growthBasis : null;
                return hint(parseFloat(growthPct) >= 15, basis ? `✓ Strong growth · ${basis}` : "✓ Strong growth", basis ?? "Expected annual growth");
              })()}
            </div>
          </div>

          {onBook
            ? <BankValuation m={m} growthInput={growthPct} costOfEquity={costOfEquity} onCostOfEquity={ke => {
                setCostOfEquity(ke);
                const pb = pbAt(m.valuation.roe, Number(growthPct), ke);
                if (pb != null) setPe(String(round(pb, 2)));
              }} />
            : onCycle ? <CyclicalValuation m={m} epsInput={eps} multipleInput={pe} />
            : <PeHistoryTable m={m} />}
        </>
      ) : (
        <>
          <ValuedAs valuation={m.valuation} />
          <NoFairValue m={m} />
        </>
      )}
    </div>
  );
  const priceCard = m && (
    <>
    {/* Current price */}
    <div style={card}>
      <SectionTitle icon={CalendarDays} style={{ marginBottom: 4 }}>Current Price</SectionTitle>
      <p style={{ fontSize: 12, color: "var(--t2)", margin: "0 0 12px" }}>
        Price for <strong>{data.name}</strong>. Override if you want to test a different price.
      </p>
      {priceLabel && <p style={{ fontSize: 12, color: "var(--accent)", margin: "0 0 8px", fontWeight: 500 }}>{priceLabel}</p>}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, color: "var(--t2)", fontWeight: 500 }}>₹</span>
        <input type="number" aria-label="Price to test" value={actionPrice} onChange={e => { setActionPrice(e.target.value); setPriceLabel("Your price"); }} placeholder="Current price"
          style={{ flex: "1 1 140px", minWidth: 120, maxWidth: 320, height: 42, padding: "0 14px", border: "1px solid var(--accent)", borderRadius: 8, fontSize: 15, fontWeight: 500, outline: "none", background: "var(--s1)", color: "var(--t1)" }} />
        {data.quote && String(data.quote.cmp) !== actionPrice && (
          <button type="button" onClick={() => { setActionPrice(String(data.quote.cmp)); setPriceLabel(quoteLabel(data.quote)); }}
            style={{ height: 42, padding: "0 12px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--s1)", fontSize: 12, cursor: "pointer", color: "var(--accent)" }}>
            Use latest close
          </button>
        )}
        {data.close && String(data.close.price) !== actionPrice && (
          <button type="button" onClick={() => { setActionPrice(String(data.close.price)); setPriceLabel(closeLabel(data.close)); }}
            style={{ height: 42, padding: "0 12px", borderRadius: 8, border: "1px solid var(--bdr2)", background: "var(--s2)", fontSize: 12, cursor: "pointer", color: "var(--t2)" }}>
            Use NSE close
          </button>
        )}
      </div>
    </div>
    </>
  );

  return (
    <div style={{ padding: "8px var(--page-x) 16px", color: "var(--t1)" }}>
      {showAlertModal && (
        <CreateAlertModal stock={{ symbol: data.symbol, name: data.name, cmp: price, p1: levels?.p1, p2: levels?.p2, p3: levels?.p3 }} onClose={() => setShowAlertModal(false)} />
      )}

      <div className="sd ap">
      {/* A phone shows the company's card on Overview only: the other tabs
          start with their own content, the pinned bar giving name and price */}
      {(!isPhone || phoneTab === "overview") && (
        <StockSide data={data} m={m} price={price} priceLabel={priceLabel} watched={watched}
          onWatch={() => toggleWatch(data.symbol, price)} onAlert={() => setShowAlertModal(true)} />
      )}

      <div className="sd-right">
      {/* Pinned bar: Back and the tabs (on a phone also the name and price,
          once the summary above has scrolled away) */}
      <div data-sticky-top className="sd-bar">
        <div className="sd-bar-row">
          <button type="button" onClick={onBack} title={`Back to ${backTo}`} className="sd-back"><ArrowLeft size={17} aria-hidden="true" /> Back<span className="sd-back-to"> to {backTo}</span><kbd className="sd-back-key" aria-hidden="true">Esc</kbd></button>
          <span className="sd-bar-name"><span className="sd-bar-title">{cardName(data.name)}</span>{price > 0 && <b>{fmtRs(price)}</b>}</span>
          <SectionNav ready={!!m} phone={isPhone} phoneTab={phoneTab} onPhoneTab={showPhoneTab} />
        </div>
      </div>

      <div className="sd-main" data-phone-tab={phoneTab}>

      {/* A phone's chapters open with their answer and end with their checks */}
      {isPhone && m && CHAPTERS.filter(c => c.id !== "overview" && c.id !== "news").map(c => (
        <div key={c.id} className="sd-tabpart" data-tab={c.id}>{built(c.id) && <ChapterTop id={c.id} m={m} fairValue={valued ? fv?.fv25 : null} price={price} />}</div>
      ))}

      {data.quoteError && (
        <div style={{ fontSize: 12, color: "var(--yellow)", background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
          Couldn't refresh the latest close ({data.quoteError}){data.close ? " — using NSE's last close." : "."}
        </div>
      )}
      {data.quote?.stale && (
        <div style={{ fontSize: 12, color: "var(--yellow)", background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
          <strong>Showing a cached quote</strong> — it couldn't be refreshed. Quote date: {data.quote.asOf}.
        </div>
      )}

      {!m && (
        <div style={{ ...card, color: "var(--t3)", fontSize: 13 }}>No usable annual results in NSE's filings for this company, so there's nothing to value or score.</div>
      )}

      <section id="sec-overview" className="ss-section sd-section" data-tab="overview">
        {/* a phone: the gist and a bar per chapter first, then a shorter chart */}
        {isPhone && m && <VerdictLines m={m} fairValue={valued ? fv?.fv25 : null} price={price} onGo={showPhoneTab} />}
        <PriceChartPanel symbol={data.symbol} name={data.name} compact={isPhone} levels={valued || levels ? { ...(valued ? fv : {}), ...(levels ?? {}) } : null} />
        <WhyMoving symbol={data.symbol} />
        {m && !isPhone && <StockGlance r={m.research} />}
        <StockSnapshot m={m} price={price} dates={data.dataDates} />
      </section>
      <div id="sec-performance" className="ss-section" data-tab="price">{built("price") && <StockPerformance m={m} />}</div>

      <div id="sec-about" className="ss-section" data-tab="business"><CompanyProfile symbol={data.symbol} m={m} /></div>
      {m && built("business") && <StockBusiness m={m} symbol={data.symbol} name={data.name} />}

      {m && <div id="sec-events" className="ss-section" data-tab="overview"><StockRecent m={m} holding={data.holding} /></div>}

      {m && (
        <div className="sd-tabpart" data-tab="overview">
          {isPhone ? (
            <Fold id="sec-scores" title="How the scores are worked out"><ResearchPanel research={m.research} /></Fold>
          ) : (
            <div id="sec-scores" className="ss-section" data-tour="research"><h2 className="sd-h2">Scorecard. <span>How the business scores on its own filings.</span></h2><ResearchPanel research={m.research} /></div>
          )}
          <div id="sec-thesis" className="ss-section" data-tour="thesis"><ThesisMonitor metrics={m} account={account} review={!isPhone} /></div>
        </div>
      )}

      {m && !built("value") && <TabStub tab="value" part="valuation" />}
      {m && built("value") && (
        <div className="sd-tabpart" data-tab="value">
          {/* Verify & Override — or, without a model that values the
              company, why there's no fair value */}
          <div id="sec-valuation" className="ss-section">
          <h2 className="sd-h2">Valuation. <span>What its own numbers say it is worth.</span></h2>
          {(m.cyclical || onCycle || m.valuation?.partialCycle || m.lender || m.utility || m.governmentOwned) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {m.lender && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--s3)", color: "var(--t2)", fontWeight: 500 }}>Lender</span>}
          {m.governmentOwned && <span title={`${m.governmentPct > 0 ? `The government holds ${m.governmentPct}% as promoter. ` : "A government company (NSE's PSU lists). "}Government-owned companies usually trade on lower multiples; its own P/E history already reflects that${m.valuation?.psu ? ", and a bank's cost of equity is a point higher here" : ""}.`} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--s3)", color: "var(--t2)", fontWeight: 500 }}>Government-owned</span>}
          {m.utility && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--s3)", color: "var(--t2)", fontWeight: 500 }}>Regulated utility</span>}
          {(m.cyclical || onCycle || m.valuation?.partialCycle) && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--yellow-dim)", color: "var(--yellow)", fontWeight: 400 }}>Cyclical{m.valuation?.partialCycle ? " · partial cycle" : ""}</span>}
          {/* The cycle-position gauge's reading, beside the price */}
          {onCycle && m.valuation.positionLabel && <span title={`This year's net margin ${m.valuation.latestMargin}% against a through-cycle ${m.valuation.medianMargin}%`} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "var(--s3)", color: CYCLE_TONE[m.valuation.positionLabel], fontWeight: 400 }}>Profits {m.valuation.positionLabel}</span>}
        </div>
          )}

          {(
        <div className="sd-note">
          <CircleCheck size={14} strokeWidth={2.2} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--green)" }} /><strong>Financials from NSE filings</strong> — EPS and valuation inputs use {data.annual?.scope?.toLowerCase() ?? "reported"} results for the year ended {longDate(m.fyEnd)}{m.provenance?.financials?.filedAt ? `, filed ${longDate(m.provenance.financials.filedAt)}` : ""}. The price's source and date are shown under it.{" "}
          <a href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(data.symbol)}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 500, whiteSpace: "nowrap" }}>Open on NSE <ArrowUpRight size={13} style={{ verticalAlign: "-2px" }} /></a>
          {onBook && (
            <div className="hide-phone" style={{ marginTop: 4, color: "var(--t2)" }}>
              P/B is what its <em>{m.valuation.roeBasis === "recent" ? "recent return on equity" : "through-cycle return on equity"}</em> supports ({m.valuation.justifiedPb.toFixed(2)}×; today's is in the key figures) — override with your own view if needed.
            </div>
          )}
          {m.epsRebased && (
            <div style={{ marginTop: 4, color: "var(--t2)" }}>
              EPS here is FY{m.fyEnd.slice(2, 4)} profit over today's {m.epsRebased.sharesCr.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr shares (₹{m.eps.toFixed(2)}). The filing's ₹{m.epsRebased.reportedEps.toFixed(2)} is on about {m.epsRebased.epsSharesCr.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr, before the company issued more shares — today's count is what the share price is for.
            </div>
          )}
          {m.epsCorrection && (
            <div style={{ marginTop: 4, color: "var(--yellow)" }}>
              The filing's annual EPS was ₹{m.epsCorrection.reportedEps.toFixed(2)}, inconsistent with profit and paid-up shares. EPS-based ratios and the fair value use ₹{m.epsCorrection.correctedEps.toFixed(2)} instead.
            </div>
          )}
          {m.unitFixes?.length > 0 && (
            <div style={{ marginTop: 4, color: "var(--t2)" }}>
              {m.unitFixes.map(f => `FY${f.fyEnd.slice(2, 4)}`).join(" and ")} {m.unitFixes.length > 1 ? "filings were" : "filing was"} in the wrong unit on NSE (figures {m.unitFixes[0].factor > 1 ? `${m.unitFixes[0].factor.toLocaleString("en-IN")}× too small` : `${(1 / m.unitFixes[0].factor).toLocaleString("en-IN")}× too large`}, share capital included) — corrected here so growth rates aren't distorted.
            </div>
          )}
        </div>
      )}

      {m?.epsJump && model === "earnings" && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 14 }}>
          <strong style={{ color: "var(--yellow)" }}>Profit jumped this year — the fair value uses the usual level.</strong>{" "}
          {fyLabel(m.fyEnd)} EPS is ₹{m.epsJump.eps.toFixed(2)}, more than 3× the usual ₹{m.epsJump.usualEps.toFixed(2)}, but the share price hasn't followed (P/E {m.epsJump.pe.toFixed(1)} on the last close, against a usual {m.medianPe.toFixed(1)}). That is how a one-off gain looks. If you expect this profit to last, type {round(m.epsJump.eps, 2)} into EPS below.
        </div>
      )}

          </div>
          {!isPhone && overrideCard}

          {model === "earnings" && <div data-tour="valuation"><ValuationExplorer key={`valuation-${symbol}`} metrics={m} price={price} levels={fv} epsInput={eps} peInput={pe} /></div>}
          {onBook && (
            <div data-tour="valuation" style={{ ...card, fontSize: 12, color: "var(--t2)", lineHeight: 1.55 }}>
              <strong style={{ color: "var(--t1)" }}>Cash-flow (DCF) value and free-cash-flow yield: not meaningful for lenders.</strong> A bank's operating cash flow is deposits and loans moving, not cash the business generates.
            </div>
          )}

          {levels && <div id="sec-sizing" className="ss-section"><PhasePositionPlanner levels={levels} /></div>}

          {!isPhone && priceCard}
          {isPhone && (
            <Fold title="Check or change the inputs">{overrideCard}{priceCard}</Fold>
          )}
        </div>
      )}

      {m && built("value") && (
        <div className="sd-tabpart" data-tab="value">
          <div id="sec-levels" className="ss-section">

          {/* Where the price sits — described against the levels, never an instruction */}
          {position && (
            <div data-tour="position" style={{ borderRadius: 12, padding: 18, marginBottom: 16, background: "var(--s2)", border: `1px solid color-mix(in srgb, ${positionTone} 45%, var(--bdr2))` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: positionTone, background: `color-mix(in srgb, ${positionTone} 12%, transparent)` }}>
                  <PositionIcon zone={position.zone} size={20} strokeWidth={2} />
                </span>
                <div>
                  <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 500 }}>Where the price sits</div>
                  <div style={{ fontSize: 19, fontWeight: 500, color: positionTone, letterSpacing: "-0.02em" }}>{position.label}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--t1)", margin: 0, lineHeight: 1.6 }}>{position.gist || position.detail}</p>
              {/* Valuing at a historical P/E makes this common for de-rated stocks */}
              {model === "earnings" && (position.zone === "below-stop" || position.zone === "phase3") && m.peFy && Number(pe) > m.peFy * 1.3 && (
                <p style={{ fontSize: 12, color: "var(--t2)", margin: "8px 0 0", lineHeight: 1.6 }}>
                  Today's P/E (in the key figures) is well under the multiple the levels use. Check whether the historical multiple still applies.
                </p>
              )}
              <p style={{ fontSize: 11, color: "var(--t3)", margin: "8px 0 0" }}>{levels?.own ? "Against the levels you typed for this stock." : `Against your levels: your settings applied to the fair value from the ${onBook ? "book, P/B" : onCycle ? "mid-cycle EPS, multiple" : "EPS, P/E"} and growth above.`} A description of where the price is, not advice.</p>
            </div>
          )}

          {/* The price ladder: the user's own levels, or how to set them */}
          {(valued || levels) && <MyLevelsCard symbol={symbol} fv={valued ? fv : null} levels={levels} price={price} priceLabel={priceLabel} fv2Label={fyLabel(m.fyEnd, 2)} />}

          {/* The valuation explorer above is the main valuation summary;
              leave this detailed EPS bridge collapsed to reduce repetition. */}
          {valued && fv && (
            <details style={{ ...card, padding: 0 }}>
              <summary style={{ cursor: "pointer", padding: "16px 18px", color: "var(--t1)", fontSize: 13, fontWeight: 400, listStyle: "none" }}>
                {onBook ? "Book" : onCycle ? "Mid-cycle EPS" : "EPS"} and fair value, year by year
                {usingCustomInputs && <span style={{ fontSize: 11, marginLeft: 8, color: "var(--accent)", fontWeight: 500 }}>(custom inputs)</span>}
              </summary>
              <div className="ss-grid-fv" style={{ padding: "0 18px 18px" }}>
                {[
                  { label: onBook ? "Book/share less net NPA" : onCycle ? "Mid-cycle EPS" : usualEpsShown ? "Usual EPS" : `${fyLabel(m.fyEnd)} EPS`, val: eps ? `₹${Math.round(Number(eps))}` : "—", sub: `FV: ${fmtRs(fv.fv25)}` },
                  { label: `${fyLabel(m.fyEnd, 1)} ${onBook ? "book" : onCycle ? "mid-cycle EPS" : "EPS"} (est.)`, val: fv.e26 ? `₹${fv.e26}` : "—", sub: `FV: ${fmtRs(fv.fv26)}` },
                  { label: `${fyLabel(m.fyEnd, 2)} ${onBook ? "book" : onCycle ? "mid-cycle EPS" : "EPS"} (est.)`, val: fv.e27 ? `₹${fv.e27}` : "—", sub: `FV: ${fmtRs(fv.fv27)}` },
                ].map(fc => (
                  <div key={fc.label} style={{ background: "var(--s1)", borderRadius: 8, padding: 12, border: fc.hi ? "1px solid var(--green)" : "1px solid var(--bdr)" }}>
                    <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>{fc.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 400, color: fc.hi ? "var(--accent)" : "var(--t1)" }}>{fc.val}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{fc.sub}</div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {!isPhone && <PiotroskiCard m={m} />}
          <KeyNumbers data={data} m={m} />
          </div>
        </div>
      )}

      {m && <div id="sec-financials" className="ss-section" data-tab="growth">{built("growth") && <><h2 className="sd-h2">Financials. <span>Its results, year by year.</span></h2><FinancialsPanel history={m.history} quarters={m.quarters} template={m.template} /></>}</div>}
      {m && <div id="sec-health" className="ss-section" data-tab="safety">{built("safety") && <><h2 className="sd-h2">Financial health. <span>What it owns, what it owes, and how its debt is covered.</span></h2><StockHealth m={m} scoreLink={!isPhone} /></>}</div>}
      <div id="sec-holding" className="ss-section" data-tab="owners">{built("owners") && <><h2 className="sd-h2">Holdings. <span>Who owns it, and how that is changing.</span></h2><ShareholdingPanel symbol={data.symbol} /><InsidersPanel symbol={data.symbol} /></>}</div>
      {m?.dividendRecord && <div id="sec-dividends" className="ss-section" data-tab="owners">{built("owners") && <><h2 className="sd-h2">Dividends. <span>What it pays, and what that takes.</span></h2><StockDividends m={m} /></>}</div>}
      <div id="sec-technicals" className="ss-section" data-tab="price">{built("price") && <><h2 className="sd-h2">Technicals. <span>The trend in the price.</span></h2><TechnicalPanel ticker={data.symbol} /></>}</div>

      <div id="sec-peers" className="ss-section" data-tab="business">{built("business") && <><h2 className="sd-h2">Peers. <span>How it compares with similar companies.</span></h2>{m && <StockSectorCompare m={m} />}<PeersPanel symbol={data.symbol} onAnalyze={onOpenStock} /></>}</div>
      <div id="sec-filings" className="ss-section" data-tour="filings" data-tab="news">{built("news") && <><h2 className="sd-h2">News & filings. <span>Straight from NSE.</span></h2><StockEarningsCall symbol={data.symbol} m={m} /><NewsPanel symbol={data.symbol} /></>}</div>
      <div id="sec-web" className="ss-section" data-tab="news">{built("news") && <><h2 className="sd-h2">Around the web. <span>Videos, posts and news about it elsewhere.</span></h2><AroundTheWeb symbol={data.symbol} name={data.name} /></>}</div>
      <div className="sd-tabpart" data-tab="overview">
        <MyNotes key={data.symbol} symbol={data.symbol} />
        {isPhone ? (
          <Fold title="Where these figures come from"><StockDataDates dates={data.dataDates} quote={data.quote} research={m?.research} /></Fold>
        ) : <StockDataDates dates={data.dataDates} quote={data.quote} research={m?.research} />}
      </div>

      {isPhone && m && CHAPTERS.filter(c => c.id !== "overview" && c.id !== "news").map(c => (
        <div key={c.id} className="sd-tabpart" data-tab={c.id}>
          {built(c.id) && <>
            {c.id === "safety" && <PiotroskiCard m={m} />}
            <ChapterEnd id={c.id} m={m} />
          </>}
        </div>
      ))}

      <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", lineHeight: 1.6 }}>
        <TriangleAlert size={12} style={{ verticalAlign: "-1px", marginRight: 4 }} />Always cross-check figures on NSE or BSE before investing.
      </p>

      {/* A phone's tab ends by pointing on: the Overview with the list of
          every tab and the question it answers (at the bottom, after the
          company's own overview — 22 Oct 2026), the others with the next tab */}
      {isPhone ? <NextTab ready={!!m} current={phoneTab} onGo={showPhoneTab} /> : <div className="ss-back-bottom">
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--accent)", background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 12, cursor: "pointer", padding: "12px 24px", fontWeight: 400, margin: "8px auto 0" }}>
          <ArrowLeft size={16} /> Back to {backTo}
        </button>
      </div>}
      </div>
      </div>
      </div>
    </div>
  );
}
