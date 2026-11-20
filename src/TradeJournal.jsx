import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { api } from "./api.js";
import { cardName } from "./stockName.js";
import { tradeResult, journalStats } from "./journalMath.js";

// The trading journal (20 Nov 2026): the trades someone records, with the
// pattern they took each on and why, and once closed what they learned — and
// how the closed ones went together: how many won, the average gain and loss,
// R (the move against the risk to the stop), and by pattern. Their own record;
// nothing here suggests a trade.

export const PATTERNS = [
  ["", "No pattern"], ["trendTemplate", "Trend template"], ["vcp", "Contracting pullbacks (VCP)"], ["darvasBreakout", "Darvas box breakout"],
  ["darvasBox", "Darvas box"], ["breakout", "Breakout"], ["nearHigh", "Near highs"], ["pullback", "Pullback"], ["tight", "Tight weeks"],
  ["results", "Results"], ["news", "News or an order"], ["value", "Value / long-term"], ["other", "Other"],
];
const patternName = id => PATTERNS.find(([k]) => k === id)?.[1] ?? id;
const rs = v => (v == null ? "—" : `${v < 0 ? "−" : ""}₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 })}`);
const pc = v => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`);
const rr = v => (v == null ? null : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}R`);
const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const todayIso = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function TradeForm({ initial, closing, onSave, onClose }) {
  const [f, setF] = useState(() => ({
    ticker: initial?.ticker ?? "", side: initial?.side ?? "long", qty: initial?.qty ?? "", entryDate: initial?.entryDate ?? todayIso(),
    entryPrice: initial?.entryPrice ?? "", stop: initial?.stop ?? "", setup: initial?.setup ?? "", reason: initial?.reason ?? "",
    exitDate: initial?.exitDate ?? (closing ? todayIso() : ""), exitPrice: initial?.exitPrice ?? "", lesson: initial?.lesson ?? "",
  }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  const showExit = closing || initial?.exitPrice != null;
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await onSave({
        ...f, ticker: f.ticker.trim().toUpperCase(), qty: Number(f.qty), entryPrice: Number(f.entryPrice),
        stop: f.stop === "" ? null : Number(f.stop),
        exitDate: showExit && f.exitDate ? f.exitDate : null, exitPrice: showExit && f.exitPrice !== "" ? Number(f.exitPrice) : null,
      });
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  // on the page's top layer, above the tab bar and any card's stacking (as Compare's sheet)
  return createPortal(
    <div className="tj-back" onClick={onClose}>
      <form className="tj-form" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h3>{closing ? `Close ${initial.ticker}` : initial ? `Edit ${initial.ticker}` : "Add a trade"}</h3>
        {!closing && <>
          <div className="tj-grid">
            <label>Symbol<input value={f.ticker} onChange={set("ticker")} placeholder="e.g. TCS" disabled={!!initial} autoFocus={!initial} required /></label>
            <label>Side<select value={f.side} onChange={set("side")}><option value="long">Bought</option><option value="short">Sold short</option></select></label>
            <label>Entry date<input type="date" value={f.entryDate} onChange={set("entryDate")} required /></label>
            <label>Entry price (₹)<input type="number" step="0.01" min="0.01" value={f.entryPrice} onChange={set("entryPrice")} required /></label>
            <label>Quantity<input type="number" step="1" min="1" value={f.qty} onChange={set("qty")} required /></label>
            <label>Stop (₹, optional)<input type="number" step="0.01" min="0.01" value={f.stop ?? ""} onChange={set("stop")} placeholder="for R" /></label>
          </div>
          <label>Pattern<select value={f.setup} onChange={set("setup")}>{PATTERNS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>Why I took it<textarea rows={2} maxLength={1000} value={f.reason} onChange={set("reason")} placeholder="What I saw, what would prove me wrong" /></label>
        </>}
        {showExit && <>
          <div className="tj-grid">
            <label>Exit date<input type="date" value={f.exitDate} onChange={set("exitDate")} required={closing} autoFocus={closing} /></label>
            <label>Exit price (₹)<input type="number" step="0.01" min="0.01" value={f.exitPrice ?? ""} onChange={set("exitPrice")} required={closing} /></label>
          </div>
          <label>What I learned<textarea rows={2} maxLength={1000} value={f.lesson} onChange={set("lesson")} placeholder="Did it go to plan? What would I do again, or differently?" /></label>
        </>}
        {err && <p className="tj-err">{err}</p>}
        <div className="tj-btns">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : closing ? "Close the trade" : "Save"}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Summary({ s }) {
  if (!s.closed) return <p className="tj-empty-line">Close a trade to see your win rate, average gain and loss, and how each pattern has done.</p>;
  const tile = (label, value, tone) => <div className="tj-tile"><small>{label}</small><b className={tone}>{value}</b></div>;
  return (
    <>
      <div className="tj-tiles">
        {tile("Net result", rs(s.pnl), s.pnl >= 0 ? "up" : "down")}
        {tile("Won", `${Math.round(s.winRate)}% · ${s.wins} of ${s.closed}`)}
        {tile("Average gain", pc(s.avgWinPct), "up")}
        {tile("Average loss", pc(s.avgLossPct), "down")}
        {tile("Gains ÷ losses", s.profitFactor == null ? "—" : s.profitFactor.toFixed(2))}
        {tile("Average R", s.avgR == null ? "—" : rr(s.avgR), s.avgR >= 0 ? "up" : "down")}
      </div>
      {s.bySetup.length > 1 && (
        <table className="tj-setups">
          <thead><tr><th>Pattern</th><th>Trades</th><th>Won</th><th>Result</th></tr></thead>
          <tbody>{s.bySetup.map(g => <tr key={g.setup}><td>{patternName(g.setup)}</td><td>{g.trades}</td><td>{Math.round((g.wins / g.trades) * 100)}%</td><td className={g.pnl >= 0 ? "up" : "down"}>{rs(g.pnl)}</td></tr>)}</tbody>
        </table>
      )}
      <p className="tj-note">Closed trades only{s.withR < s.closed ? `; R from the ${s.withR} with a stop` : ""}. {s.avgDays != null && `Held ${Math.round(s.avgDays)} days on average.`}</p>
    </>
  );
}

export default function TradeJournal({ onOpenStock }) {
  const [trades, setTrades] = useState(null);
  const [prices, setPrices] = useState({});
  const [form, setForm] = useState(null); // { initial, closing }
  const [failed, setFailed] = useState(false);
  const load = () => api.journal().then(d => { setTrades(d.trades ?? []); setFailed(false); }).catch(() => setFailed(true));
  useEffect(() => { load(); }, []);
  const openSyms = [...new Set((trades ?? []).filter(t => t.exitPrice == null).map(t => t.ticker))].slice(0, 50);
  useEffect(() => {
    if (!openSyms.length) return;
    api.currentPrices(openSyms).then(p => setPrices(p ?? {})).catch(() => {});
  }, [openSyms.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async t => {
    if (form?.initial) await api.updateTrade(form.initial.id, t);
    else await api.addTrade(t);
    setForm(null);
    load();
  };
  const remove = async t => {
    if (!window.confirm(`Remove the ${t.ticker} trade from ${day(t.entryDate)} from your journal?`)) return;
    await api.removeTrade(t.id);
    load();
  };
  const s = journalStats(trades ?? []);
  const open = (trades ?? []).filter(t => t.exitPrice == null);
  const closed = (trades ?? []).filter(t => t.exitPrice != null).sort((a, b) => b.exitDate.localeCompare(a.exitDate));

  const Row = ({ t }) => {
    const res = tradeResult(t, prices[t.ticker]?.price ?? null);
    return (
      <li className="tj-row">
        <div className="tj-top">
          <button type="button" className="tj-who" onClick={() => onOpenStock?.(t.ticker)}>
            <b>{cardName(t.name)}</b>
            <small>{t.ticker} · {t.side === "short" ? "short" : "long"} {t.qty.toLocaleString("en-IN", { maximumFractionDigits: 2 })} at ₹{t.entryPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })} · {day(t.entryDate)}</small>
          </button>
          <span className="tj-res">
            <b className={res.pnl == null ? "" : res.pnl >= 0 ? "up" : "down"}>{rs(res.pnl)}</b>
            <small>{pc(res.pct)}{res.r != null ? ` · ${rr(res.r)}` : ""}{res.open ? " · open" : res.days != null ? ` · ${res.days} days` : ""}</small>
          </span>
        </div>
        {(t.setup || t.stop != null || t.exitPrice != null || t.splitAdjusted) && (
          <div className="tj-tags">
            {t.setup && <span>{patternName(t.setup)}</span>}
            {t.stop != null && <span>Stop ₹{t.stop.toLocaleString("en-IN")}</span>}
            {t.exitPrice != null && <span>Out at ₹{t.exitPrice.toLocaleString("en-IN")} · {day(t.exitDate)}</span>}
            {t.splitAdjusted && <span title="Prices and quantity shown after a split or bonus since the trade was entered">Adjusted for a split or bonus</span>}
          </div>
        )}
        {t.reason && <p className="tj-text"><b>Why:</b> {t.reason}</p>}
        {t.lesson && <p className="tj-text"><b>Learned:</b> {t.lesson}</p>}
        <div className="tj-acts">
          {res.open && <button type="button" onClick={() => setForm({ initial: t, closing: true })}><CheckCircle2 size={14} aria-hidden="true" />Close</button>}
          <button type="button" onClick={() => setForm({ initial: t, closing: false })}><Pencil size={14} aria-hidden="true" />Edit</button>
          <button type="button" onClick={() => remove(t)}><Trash2 size={14} aria-hidden="true" />Remove</button>
        </div>
      </li>
    );
  };

  return (
    <div className="tj">
      <div className="pf-actions">
        <button type="button" className="btn-primary pf-add" onClick={() => setForm({ initial: null, closing: false })}><Plus size={15} aria-hidden="true" /> Add a trade</button>
      </div>
      {failed && <p className="tj-empty-line">The journal couldn't be loaded just now.</p>}
      {!trades && !failed && <p className="tj-empty-line">Loading your journal…</p>}
      {trades?.length === 0 && (
        <div className="tj-empty">
          <p><b>Your trading journal is empty</b></p>
          <p>Record each trade: the price, the stop, the pattern you took it on and why. Close it with the exit and what you learned, and see which patterns work for you.</p>
        </div>
      )}
      {trades?.length > 0 && <section className="tj-card"><h2>How your trades went</h2><Summary s={s} /></section>}
      {open.length > 0 && <section className="tj-sec"><h2>Open · {open.length}</h2><ul>{open.map(t => <Row key={t.id} t={t} />)}</ul></section>}
      {closed.length > 0 && <section className="tj-sec"><h2>Closed · {closed.length}</h2><ul>{closed.map(t => <Row key={t.id} t={t} />)}</ul></section>}
      {form && <TradeForm initial={form.initial} closing={form.closing} onSave={save} onClose={() => setForm(null)} />}
    </div>
  );
}
