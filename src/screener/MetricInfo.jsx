import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";

// "How is this calculated?" for Discover's columns: each metric's formula
// (metric-catalog.js about) and the period it covers (basis), in words with
// the actual dates — numbers that wouldn't reconcile were the top complaint
// in Screener.in's user forum (Oct 2026). A popover on a column header, and
// a guide listing every shown column, which works on a phone too.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
// "2026-03-31" or "30-JUN-2026" -> "March 2026"
function monthYear(d) {
  if (!d) return null;
  const iso = String(d).match(/^(\d{4})-(\d{2})/);
  if (iso) return `${MONTHS[Number(iso[2]) - 1]} ${iso[1]}`;
  const nse = String(d).match(/^\d{1,2}-([A-Za-z]{3})-(\d{4})/);
  return nse && MON[nse[1].toUpperCase()] != null ? `${MONTHS[MON[nse[1].toUpperCase()]]} ${nse[2]}` : null;
}
function dayMonth(iso) {
  return iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "the last";
}

export function basisText(basis, periods = {}) {
  const fy = monthYear(periods.fyEnd), q = monthYear(periods.quarterEnd), h = monthYear(periods.holdingAsOf);
  const close = dayMonth(periods.pricesDate);
  const most = (text, when) => (when ? `${text} — for most companies, ${when}` : text);
  switch (basis) {
    case "fy": return most("Each company's latest full year", fy && `the year to ${fy}`);
    case "fy-end": return most("At each company's latest year-end", fy);
    case "fy-avg": return "An average over the last five full years (three at least)";
    case "fy-vs-prior": return most("The latest full year against the one before", fy && `the year to ${fy}`);
    case "growth": return most("A yearly rate, compounded from that many years back to the latest full year", fy && `ending ${fy}`);
    case "3y": return "The last three full years taken together";
    case "quarter": return most("The latest quarter", q && `the quarter to ${q}`);
    case "q-yoy": return most("The latest quarter against the same quarter a year earlier", q && `the quarter to ${q}`);
    case "q-qoq": return most("The latest quarter against the quarter before", q && `the quarter to ${q}`);
    case "ttm": return most("The last four quarters added up (trailing twelve months)", q && `to ${q}`);
    case "close": return `NSE's close on ${close}`;
    case "close-fy": return most(`Price at the ${close} close, against the latest full year's figures`, fy && `the year to ${fy}`);
    case "close-ttm": return `Price at the ${close} close, against the last four quarters`;
    case "close-ttm-or-fy": return `Price at the ${close} close, against the last four quarters when available, else the latest audited year`;
    case "close-ttm-div": return `Dividends with ex-dates in the last 12 months, against the ${close} close`;
    case "ttm-div": return "Dividends with ex-dates in the last 12 months";
    case "pe-history": return "Each of the last five year-ends' price ÷ that year's EPS";
    case "levels": return `Price at the ${close} close, against today's fair value`;
    case "daily": return `A year of daily NSE prices, to ${close}`;
    case "holding": return most("The latest quarterly shareholding filing", h && `the quarter to ${h}`);
    case "scores": return `From each company's latest filings, priced at the ${close} close`;
    case "bank": return "The latest quarter's standalone results for ratios; the latest full year for amounts";
    default: return null;
  }
}

export function Definition({ def, meta }) {
  const basis = basisText(def.basis, meta?.periods);
  const known = def.range?.known ?? def.known;
  return (
    <>
      <div style={{ fontSize: 12.5, fontWeight: 450, color: "var(--t1)", marginBottom: 4 }}>{def.label}</div>
      {def.about && <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>{def.about}</div>}
      {basis && <div style={{ fontSize: 11.5, color: "var(--t2)", lineHeight: 1.5, marginTop: 6 }}><span style={{ color: "var(--t3)" }}>Period: </span>{basis}.</div>}
      {known != null && meta?.companies > 0 && known < meta.companies && (
        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>Known for {known.toLocaleString("en-IN")} of {meta.companies.toLocaleString("en-IN")} companies.</div>
      )}
    </>
  );
}

// The ⓘ beside a column header: a click opens the definition, without
// sorting the column. Placed against the viewport, as the table scrolls
// sideways inside its own box and would clip it.
export function MetricInfo({ def, meta }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(null);
  const btn = useRef(null), pop = useRef(null);
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect(), width = 280;
    setAt({ left: Math.max(8, Math.min(r.left - 12, window.innerWidth - width - 8)), top: r.bottom + 6, width });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (e.type === "keydown" ? e.key === "Escape" : !pop.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    const away = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [open]);
  if (!def?.about && !def?.basis) return null;
  return (
    <>
      <button ref={btn} type="button" aria-label={`How ${def.label} is calculated`} aria-expanded={open}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ display: "inline-flex", padding: 2, margin: "-2px 0", border: 0, background: "none", color: open ? "var(--accent)" : "var(--t3)", cursor: "pointer", borderRadius: 4, lineHeight: 0 }}>
        <Info size={12} />
      </button>
      {open && at && (
        <div ref={pop} role="dialog" aria-label={def.label} onClick={e => e.stopPropagation()}
          style={{ position: "fixed", left: at.left, top: at.top, width: at.width, zIndex: 300, padding: "12px 14px", borderRadius: 10, background: "var(--s3)", border: "1px solid var(--bdr2)", boxShadow: "0 10px 30px rgba(0,0,0,0.35)", textAlign: "left", whiteSpace: "normal", fontWeight: 400, cursor: "default" }}>
          <Definition def={def} meta={meta} />
        </div>
      )}
    </>
  );
}

// Every shown column's definition in one list — the phone's way in, where a
// row shows its figures without headers
export function ColumnGuide({ defs, meta, extra = [], onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="What these columns mean" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 350, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--t1)" }}>What these columns mean</div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost" style={{ height: 30, width: 30, padding: 0, justifyContent: "center" }}><X size={15} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 6, lineHeight: 1.5 }}>Every figure comes from the companies' own NSE filings and NSE's daily prices. Where one is unknown it's left blank, never guessed.</div>
        {[...extra, ...defs].map(def => (
          <div key={def.id} style={{ padding: "11px 0", borderTop: "1px solid var(--bdr)" }}>
            <Definition def={def} meta={meta} />
          </div>
        ))}
      </div>
    </div>
  );
}
