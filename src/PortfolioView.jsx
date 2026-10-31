import { useState, useEffect, useRef } from "react";
import CompanyLogo from "./CompanyLogo.jsx";
import { ChartPie, Pencil, X, Ellipsis, ChevronRight, CalendarDays, TrendingDown, TrendingUp, Coins, Upload, Plus } from "lucide-react";
import { BellIcon } from "./icons.jsx";
import { api } from "./api.js";
import { portfolioStore } from "./stores.js";
import AddHoldingModal from "./AddHoldingModal.jsx";
import PortfolioVsMarket from "./PortfolioVsMarket.jsx";
import ImportHoldingsModal from "./ImportHoldingsModal.jsx";
import CreateAlertModal from "./CreateAlertModal.jsx";
import { todayIst } from "./watchEvents.js";
import { cardName } from "./stockName.js";
import { priced, portfolioTotals, needsALook, holdingNote, rupees } from "./portfolioText.js";

// The Portfolio (26 Oct 2026, redone in the Watchlist's way): the whole
// portfolio in a card — its value, the day's change, the change against what
// was paid, the dividends it yields and how it's split — what needs a look,
// then a compact row per holding: its shares and weight, its value and gain,
// and one note (portfolioText.js). A tap opens the company; holding a row, or
// its ⋯, gives the rest: edit, an alert, removing it. Holdings are saved to
// the account; prices are NSE's latest close, before dividends, fees and taxes.

function fmtRs(n) {
  if (n == null || isNaN(n)) return "—";
  // paise under ₹100, where a whole rupee is a big step (₹8.23, not ₹8)
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 });
}
const signedPct = n => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`;
const signedRs = n => `${n > 0 ? "+" : ""}${rupees(n)}`;
const fmtDate = iso => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);
const tone = n => (n == null ? "" : n >= 0 ? "up" : "down");
const POSITION_TONE = { red: "var(--red)", yellow: "var(--yellow)", green: "var(--green)" };
const LOOK_ICON = { results: CalendarDays, down: TrendingDown, up: TrendingUp, dividend: Coins, weight: ChartPie };

// The whole portfolio: value, the day, the gain, dividends, the split
function PortfolioCard({ t, rows, count, pricesDate }) {
  const split = t.value ? rows.filter(h => h.value).sort((a, b) => b.value - a.value) : [];
  return (
    <section className="pf-card" aria-label="Your portfolio">
      <span className="pf-label">Current value{pricesDate ? ` · NSE close ${fmtDate(pricesDate)}` : ""}</span>
      <b className="pf-value">{t.value != null ? fmtRs(t.value) : "—"}</b>
      {t.day != null && <span className={`pf-day ${tone(t.day)}`}>{signedRs(t.day)} ({signedPct(t.dayPct ?? 0)}) at the last close</span>}
      <div className="pf-figs">
        <span><small>Overall</small><b className={tone(t.gain)}>{t.gain != null ? `${signedRs(t.gain)} (${signedPct(t.gainPct ?? 0)})` : "—"}</b></span>
        <span><small>Invested</small><b>{fmtRs(t.invested)}</b></span>
        {t.income != null && <span><small>Dividends</small><b>~{rupees(t.income)} a yr</b></span>}
      </div>
      {split.length > 1 && (
        <div className="pf-split" role="img" aria-label={`Split: ${split.map(h => `${cardName(h.name)} ${Math.round((h.value / t.value) * 100)}%`).join(", ")}`}>
          {split.map((h, i) => <i key={h.id} style={{ flexGrow: h.value, opacity: Math.max(0.28, 1 - i * 0.16) }} />)}
        </div>
      )}
      {t.unpriced.length > 0 && <p className="pf-warn">No price found for {t.unpriced.join(", ")}, so the totals leave them out.</p>}
      <span className="pf-count">{count} {count === 1 ? "holding" : "holdings"} · prices before dividends, fees and taxes</span>
    </section>
  );
}

function NeedsALook({ items, onOpen }) {
  if (!items.length) return null;
  return (
    <section className="wl-look" aria-labelledby="pf-look-h">
      <h3 id="pf-look-h" className="wl-look-h">Needs a look</h3>
      <ul>
        {items.map(x => {
          const Icon = LOOK_ICON[x.kind];
          return (
            <li key={`${x.kind}-${x.symbol}`}>
              <button type="button" className={`wl-look-row k-${x.kind === "dividend" ? "value" : x.kind === "weight" ? "results" : x.kind}`} onClick={() => onOpen(x.symbol)}>
                <Icon size={17} aria-hidden="true" /><span><b>{x.name}</b> {x.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// A holding's row: tap to open the company; hold it (or its ⋯) for the rest
function HoldingRow({ h, weight, note, onOpen, onMore }) {
  const name = cardName(h.name ?? h.ticker);
  const hold = useRef(null);
  const held = useRef(false);
  const start = e => {
    held.current = false;
    hold.current = { x: e.clientX, y: e.clientY, t: setTimeout(() => { held.current = true; navigator.vibrate?.(8); onMore(); }, 480) };
  };
  const move = e => { const k = hold.current; if (k && Math.hypot(e.clientX - k.x, e.clientY - k.y) > 10) { clearTimeout(k.t); hold.current = null; } };
  const end = () => { if (hold.current) clearTimeout(hold.current.t); hold.current = null; };
  return (
    <li className="wl-row">
      <div className="wl-item">
        <button type="button" className="wl-main" aria-label={`Open ${name}`}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end}
          onContextMenu={e => { e.preventDefault(); end(); onMore(); }}
          onClick={e => { if (held.current) { e.preventDefault(); held.current = false; return; } onOpen(h.ticker); }}>
          <CompanyLogo symbol={h.ticker} size={36} fallback={name} />
          <span className="wl-who">
            <span className="wl-name">{name}</span>
            <span className="wl-sub">
              {Number(h.qty.toFixed(4)).toLocaleString("en-IN")} at {fmtRs(h.buyPrice)}
              {weight != null && <> · {Math.round(weight)}% of it</>}
            </span>
            {note && (note.tag ? <span className="wl-sub"><span className="wl-tag" style={{ marginLeft: 0 }}>{note.tag}</span></span>
              : <span className="wl-sub wl-note" style={note.tone ? { color: POSITION_TONE[note.tone] ?? note.tone } : undefined}>{note.text}</span>)}
          </span>
          <span className="wl-price">
            {h.value != null ? fmtRs(h.value) : "—"}
            {h.gain != null && <em className={tone(h.gain)}>{signedPct(h.gainPct ?? 0)}</em>}
          </span>
        </button>
        <button type="button" className="wl-more" aria-label={`More for ${name}`} onClick={onMore}><Ellipsis size={18} /></button>
      </div>
    </li>
  );
}

// What a held row offers
function HoldingSheet({ h, day, onClose, onOpen, onEdit, onAlert, onRemove }) {
  const name = cardName(h.name ?? h.ticker);
  useEffect(() => {
    const esc = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="wl-sheet-wrap" role="presentation">
      <div className="wl-sheet-scrim" onClick={onClose} />
      <div className="wl-sheet" role="dialog" aria-modal="true" aria-label={name}>
        <div className="wl-sheet-head">
          <CompanyLogo symbol={h.ticker} size={30} fallback={name} />
          <span>
            <b>{name}</b>
            <small>
              {Number(h.qty.toFixed(4)).toLocaleString("en-IN")} shares at {fmtRs(h.buyPrice)}{h.buyDate ? ` · bought ${fmtDate(h.buyDate)}` : ""}
              {h.splitAdjusted ? ` · adjusted for a split (×${h.splitAdjusted.ratio})` : ""}
            </small>
          </span>
          <button type="button" className="wl-sheet-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="pf-sheet-figs">
          <span><small>Value</small><b>{h.value != null ? fmtRs(h.value) : "—"}</b></span>
          <span><small>Gain</small><b className={tone(h.gain)}>{h.gain != null ? `${signedRs(h.gain)} (${signedPct(h.gainPct ?? 0)})` : "—"}</b></span>
          {day != null && <span><small>At the last close</small><b className={tone(day)}>{signedPct(day)}</b></span>}
        </div>
        {h.notes && <p className="pf-sheet-note">{h.notes}</p>}
        <button type="button" className="wl-sheet-row" onClick={() => { onClose(); onOpen(); }}>Open {name}<ChevronRight size={16} aria-hidden="true" /></button>
        <button type="button" className="wl-sheet-row" onClick={() => { onClose(); onEdit(); }}><Pencil size={16} aria-hidden="true" /> Edit holding</button>
        <button type="button" className="wl-sheet-row" onClick={() => { onClose(); onAlert(); }}><BellIcon /> Set a price alert</button>
        <button type="button" className="wl-sheet-row danger" onClick={() => { onClose(); onRemove(); }}><X size={16} aria-hidden="true" /> Remove holding</button>
      </div>
    </div>
  );
}

const SORTS = [["value", "Value"], ["today", "Today"], ["gain", "Gain"], ["name", "Name"], ["quality", "Quality"], ["yield", "Dividend yield"]];

export default function PortfolioView({ onOpenStock }) {
  const today = todayIst();
  const data = portfolioStore.use();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [imported, setImported] = useState(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [alertTarget, setAlertTarget] = useState(null);
  // Drops the message back down before it goes (index.css .status-toast.leaving)
  const dismissToast = () => { setToastLeaving(true); setTimeout(() => { setImported(null); setToastLeaving(false); }, 200); };
  const [sortBy, setSortBy] = useState("value");
  const [sortDir, setSortDir] = useState("desc");

  const holdings = data?.holdings ?? [];
  const prices = data?.prices ?? {};
  const status = data?.status ?? {};
  const rowOf = t => status[t];

  const save = async h => {
    if (editItem) await api.updateHolding(editItem.id, h);
    else await api.addHolding(h);
    setShowModal(false);
    setEditItem(null);
    portfolioStore.refresh();
  };
  const remove = async id => {
    await api.removeHolding(id);
    portfolioStore.refresh();
  };

  const rows = holdings.map(h => priced(h, prices[h.ticker]?.price, status[h.ticker]));
  const t = portfolioTotals(rows, rowOf);
  const pricesDate = Object.values(prices).map(p => p?.asOf).filter(Boolean).sort().at(-1) ?? null;
  const look = needsALook(rows, rowOf, { today, pricesDate, total: t.value });

  const key = {
    value: h => h.value ?? h.invested,
    today: h => status[h.ticker]?.ret1d,
    gain: h => h.gainPct,
    quality: h => status[h.ticker]?.research?.quality,
    yield: h => status[h.ticker]?.divYield,
  };
  const sorted = [...rows].sort((a, b) => {
    const c = sortBy === "name" ? (a.name || "").localeCompare(b.name || "") : (key[sortBy](a) ?? -Infinity) - (key[sortBy](b) ?? -Infinity);
    return sortDir === "desc" ? -c : c;
  });
  const open = sheet != null ? rows.find(h => h.id === sheet) : null;

  return (
    <div className="wl-page" style={{ padding: "8px var(--page-x) 16px", animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>
      {holdings.length > 0 && <PortfolioCard t={t} rows={rows} count={holdings.length} pricesDate={pricesDate} />}
      {holdings.length > 0 && <PortfolioVsMarket version={holdings.map(h => `${h.id}:${h.qty}:${h.buyPrice}:${h.buyDate ?? ""}`).join(",")} />}
      <div className="pf-actions">
        <button type="button" onClick={() => { setEditItem(null); setShowModal(true); }} className="btn-primary pf-add"><Plus size={15} aria-hidden="true" /> Add holding</button>
        <button type="button" onClick={() => setShowImport(true)} className="btn-ghost pf-import"><Upload size={15} aria-hidden="true" /> Import from broker file</button>
      </div>
      <NeedsALook items={look} onOpen={onOpenStock} />

      {data && holdings.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 0", color: "var(--t3)", border: "1px dashed var(--bdr2)", borderRadius: 14, background: "var(--s1)" }}>
          <ChartPie size={36} strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 14, color: "var(--t2)", fontWeight: 500, marginBottom: 4 }}>Portfolio is empty</p>
          <p style={{ fontSize: 12 }}>Add your holdings one by one, or import your broker's holdings file to track your gains and how it's split</p>
        </div>
      )}
      {!data && <div style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: "var(--t3)" }}>Loading portfolio…</div>}

      {sorted.length > 0 && (
        <>
          <div className="wl-sorts" role="group" aria-label="Sort">
            {SORTS.map(([id, text]) => {
              const active = sortBy === id;
              return (
                <button key={id} type="button" className={`wl-sort${active ? " on" : ""}`} aria-pressed={active}
                  onClick={() => { if (active) setSortDir(d => (d === "desc" ? "asc" : "desc")); else { setSortBy(id); setSortDir(id === "name" ? "asc" : "desc"); } }}>
                  {text}{active && (sortDir === "desc" ? " ↓" : " ↑")}
                </button>
              );
            })}
          </div>
          <ul className="wl-list">
            {sorted.map(h => (
              <HoldingRow key={h.id} h={h} weight={t.value && h.value != null ? (h.value / t.value) * 100 : null}
                note={holdingNote(h, status[h.ticker], { today, position: status[h.ticker]?.position })}
                onOpen={onOpenStock} onMore={() => setSheet(h.id)} />
            ))}
          </ul>
          <p className="wl-hint">Tap a holding to open the company · hold it, or ⋯, to edit, set an alert or remove it</p>
        </>
      )}

      {open && (
        <HoldingSheet h={open} day={status[open.ticker]?.ret1d ?? null} onClose={() => setSheet(null)} onOpen={() => onOpenStock(open.ticker)}
          onEdit={() => { setEditItem(open); setShowModal(true); }}
          onAlert={() => setAlertTarget({ symbol: open.ticker, name: open.name ?? open.ticker, cmp: open.cmp, p1: status[open.ticker]?.levels?.p1, p2: status[open.ticker]?.levels?.p2, p3: status[open.ticker]?.levels?.p3 })}
          onRemove={() => remove(open.id)} />
      )}
      {alertTarget && <CreateAlertModal stock={alertTarget} onClose={() => setAlertTarget(null)} />}
      {showImport && <ImportHoldingsModal onClose={() => setShowImport(false)} onImported={n => { setShowImport(false); setImported(n); portfolioStore.refresh(); setTimeout(dismissToast, 6000); }} />}
      {imported != null && (
        <div role="status" className={`status-toast${toastLeaving ? " leaving" : ""}`} style={{ position: "fixed", bottom: 90, zIndex: 250, padding: "10px 16px", borderRadius: 10, background: "var(--s3)", border: "1px solid var(--bdr2)", color: "var(--t1)", fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
          Added {imported} holding{imported === 1 ? "" : "s"} from the file. <button type="button" onClick={dismissToast} className="btn-ghost" style={{ height: 24, marginLeft: 8, fontSize: 11 }}>OK</button>
        </div>
      )}
      {showModal && <AddHoldingModal initial={editItem} onSave={save} onClose={() => { setShowModal(false); setEditItem(null); }} />}
    </div>
  );
}
