import { useEffect, useRef, useState } from "react";
import { Sun, Moon, X, Menu, CalendarDays, TrendingUp, TrendingDown, Tag, CircleDollarSign, PieChart } from "lucide-react";
import { tabsFor, useTabBadges, GridIcon } from "./Header.jsx";
import { BrandMark } from "./site.jsx";
import CompanyLogo from "./CompanyLogo.jsx";
import { api } from "./api.js";
import { useWatchlist, watchSaved } from "./watchlist.js";
import { portfolioStore, alertsStore } from "./stores.js";
import { cardName } from "./stockName.js";
import { todayIst } from "./watchEvents.js";
import { fmtRs } from "../server/levels.js";
import { summaryLine, needsALook as watchLook, rowNote, signedPct } from "./watchlistText.js";
import { priced, portfolioTotals, needsALook as holdingsLook, rupees } from "./portfolioText.js";
import { usePhone } from "./phoneTabs.js";

// A computer's pages in a slim bar down the left (26 Oct 2026, after a
// dashboard the user liked: "the buttons were in the middle and useful"):
// the mark at the top, the pages grouped in the middle, light and dark at
// the bottom. Watchlist, Portfolio and Alerts open a peek beside the bar —
// what needs a look, then the list — so a company page can be checked
// against them without leaving it; the peek's "Open" (or a second click)
// goes to the page. A phone keeps its bottom bar (Header.jsx BottomTabBar).

const PEEKS = new Set(["watchlist", "portfolio", "alerts"]);
const LOOK_ICON = { results: CalendarDays, up: TrendingUp, down: TrendingDown, value: Tag, dividend: CircleDollarSign, weight: PieChart };

function Pct({ v }) {
  if (v == null) return <span className="rp-num">—</span>;
  return <span className={`rp-num ${v >= 0 ? "up" : "down"}`}>{v >= 0 ? "+" : "−"}{Math.abs(v).toFixed(2)}%</span>;
}

function LookBox({ items, onOpenStock }) {
  if (!items.length) return null;
  return (
    <div className="rp-look">
      <h4>Needs a look</h4>
      <ul>
        {items.map(x => {
          const I = LOOK_ICON[x.kind] ?? Tag;
          return <li key={`${x.kind}-${x.symbol}`}><button type="button" onClick={() => onOpenStock(x.symbol)}><I size={15} aria-hidden="true" /><span><b>{x.name}</b> {x.text}</span></button></li>;
        })}
      </ul>
    </div>
  );
}

function Row({ symbol, name, note, right, sub, onOpen }) {
  return (
    <li>
      <button type="button" className="rp-row" onClick={onOpen}>
        <CompanyLogo symbol={symbol} size={30} />
        <span className="rp-name"><b>{name}</b>{note && (note.tag ? <em>{note.tag}</em> : <small>{note.text}</small>)}</span>
        <span className="rp-right"><b>{right}</b>{sub}</span>
      </button>
    </li>
  );
}

function WatchPeek({ onOpenStock }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const watched = useWatchlist();
  // (after any star still on its way, so one just added is in the list)
  useEffect(() => { watchSaved().then(() => api.watchlist()).then(setData).catch(() => setError(true)); }, []);
  if (error) return <p className="rp-empty">Couldn't load your watchlist.</p>;
  if (!data) return <p className="rp-empty">Loading…</p>;
  const today = todayIst();
  const rows = new Map((data.results ?? []).map(r => [r.symbol, r]));
  const items = (data.items ?? []).filter(i => watched.has(i.ticker));
  if (!items.length) return <p className="rp-empty">No companies yet. Star one on its page to keep it here.</p>;
  const rowOf = t => rows.get(t), priceOf = t => rows.get(t)?.cmp ?? null;
  const sum = summaryLine(items, rowOf, priceOf);
  const look = watchLook(items, rowOf, priceOf, { today, pricesDate: data.snapshot?.pricesDate ?? null });
  const sorted = [...items].sort((a, b) => (rowOf(b.ticker)?.ret1d ?? -Infinity) - (rowOf(a.ticker)?.ret1d ?? -Infinity));
  return (
    <>
      <p className="rp-sum">{sum.count}{sum.today != null && <> · today <em className={sum.today >= 0 ? "up" : "down"}>{signedPct(sum.today)}</em> on average</>}</p>
      <LookBox items={look} onOpenStock={onOpenStock} />
      <ul className="rp-list">
        {sorted.slice(0, 12).map(i => {
          const r = rowOf(i.ticker);
          return <Row key={i.ticker} symbol={i.ticker} name={cardName(r?.name ?? i.ticker)} note={rowNote(i, r, priceOf(i.ticker), { today })}
            right={priceOf(i.ticker) != null ? fmtRs(priceOf(i.ticker)) : "—"} sub={<Pct v={r?.ret1d ?? null} />} onOpen={() => onOpenStock(i.ticker)} />;
        })}
      </ul>
      {sorted.length > 12 && <p className="rp-more">and {sorted.length - 12} more</p>}
    </>
  );
}

function PortfolioPeek({ onOpenStock }) {
  const data = portfolioStore.use();
  if (!data) return <p className="rp-empty">Loading…</p>;
  const holdings = data.holdings ?? [];
  if (!holdings.length) return <p className="rp-empty">No holdings yet. Add what you own on the Portfolio page.</p>;
  const prices = data.prices ?? {}, status = data.status ?? {};
  const rowOf = t => status[t];
  const rows = holdings.map(h => priced(h, prices[h.ticker]?.price, status[h.ticker]));
  const t = portfolioTotals(rows, rowOf);
  const pricesDate = Object.values(prices).map(p => p?.asOf).filter(Boolean).sort().at(-1) ?? null;
  const look = holdingsLook(rows, rowOf, { today: todayIst(), pricesDate, total: t.value });
  const sorted = [...rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <>
      <p className="rp-sum">
        {t.value != null ? <>Worth <b>{rupees(t.value)}</b></> : <>Invested <b>{rupees(t.invested)}</b></>}
        {t.day != null && <> · today <em className={t.day >= 0 ? "up" : "down"}>{t.day >= 0 ? "+" : ""}{rupees(t.day)}</em></>}
        {t.gainPct != null && <> · <em className={t.gainPct >= 0 ? "up" : "down"}>{signedPct(t.gainPct)}</em> on cost</>}
      </p>
      <LookBox items={look} onOpenStock={onOpenStock} />
      <ul className="rp-list">
        {sorted.slice(0, 10).map(h => (
          <Row key={h.id} symbol={h.ticker} name={cardName(h.name ?? status[h.ticker]?.name ?? h.ticker)}
            note={{ text: `${h.qty.toLocaleString("en-IN")} shares` }} right={h.value != null ? rupees(h.value) : "—"}
            sub={<Pct v={status[h.ticker]?.ret1d ?? null} />} onOpen={() => onOpenStock(h.ticker)} />
        ))}
      </ul>
      {sorted.length > 10 && <p className="rp-more">and {sorted.length - 10} more</p>}
    </>
  );
}

function AlertsPeek({ onOpenStock }) {
  const alerts = alertsStore.use();
  if (!alerts) return <p className="rp-empty">Loading…</p>;
  const on = alerts.filter(a => a.enabled);
  if (!on.length) return <p className="rp-empty">No price alerts. Set one from a company's page.</p>;
  const reached = on.filter(a => a.triggered), watching = on.filter(a => !a.triggered);
  const row = a => {
    const away = a.cmp > 0 && a.threshold > 0 ? ((a.threshold - a.cmp) / a.cmp) * 100 : null;
    return <Row key={a.id} symbol={a.ticker} name={cardName(a.name || a.ticker)} note={{ text: `${a.condition === "above" ? "Rises to" : "Drops to"} ${fmtRs(a.threshold)}` }}
      right={a.cmp != null ? fmtRs(a.cmp) : "—"} sub={a.triggered ? <span className="rp-num reached">Reached</span> : away != null ? <span className="rp-num">{Math.abs(away).toFixed(1)}% away</span> : null}
      onOpen={() => onOpenStock(a.ticker)} />;
  };
  return (
    <>
      <p className="rp-sum">{on.length} {on.length === 1 ? "alert" : "alerts"}{reached.length > 0 && <> · <em className="warn">{reached.length} reached</em></>}</p>
      {reached.length > 0 && <><h4 className="rp-h">Price reached</h4><ul className="rp-list">{reached.slice(0, 6).map(row)}</ul></>}
      {watching.length > 0 && <><h4 className="rp-h">Watching</h4><ul className="rp-list">{watching.slice(0, 8).map(row)}</ul></>}
    </>
  );
}

const PEEK_BODY = { watchlist: WatchPeek, portfolio: PortfolioPeek, alerts: AlertsPeek };

function Peek({ id, label, onClose, onOpenAll, onOpenStock }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = e => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const Body = PEEK_BODY[id];
  return (
    <>
      <div className="rp-scrim" onClick={onClose} aria-hidden="true" />
      <section ref={ref} tabIndex={-1} role="dialog" aria-label={label} className="rp-peek">
        <header className="rp-head"><h3>{label}</h3><button type="button" className="rp-x" onClick={onClose} aria-label={`Close ${label}`}><X size={16} aria-hidden="true" /></button></header>
        <div className="rp-body"><Body onOpenStock={sym => { onClose(); onOpenStock(sym); }} /></div>
        <footer className="rp-foot"><button type="button" className="rp-open" onClick={onOpenAll}>Open {label} →</button></footer>
      </section>
    </>
  );
}

export default function SideRail({ tab, onTab, account, theme, onToggleTheme, onOpenStock, openSymbol }) {
  const phone = usePhone();
  const badges = useTabBadges();
  const [peek, setPeek] = useState(null);
  // The Workspace gets the whole width (31 Oct 2026): there the bar hides,
  // and comes back over the page from ☰ at the top left, or the mouse at
  // the left edge, or the keyboard reaching it
  const tucked = tab === "workspace" && !openSymbol;
  const [shown, setShown] = useState(false);
  // the page's content moves over for the bar (index.css html.has-rail)
  useEffect(() => {
    document.documentElement.classList.toggle("has-rail", !phone && !tucked);
    document.documentElement.classList.toggle("rail-tucked", !phone && tucked);
    return () => document.documentElement.classList.remove("has-rail", "rail-tucked");
  }, [phone, tucked]);
  useEffect(() => { setPeek(null); setShown(false); }, [tab, openSymbol]);
  if (phone) return null;
  const tabs = tabsFor(account);
  const go = id => { setPeek(null); onTab(id); };
  const press = id => {
    if (!PEEKS.has(id) || tab === id) return go(id);
    if (peek === id) return go(id);
    setPeek(id);
  };
  const reached = badges.alerts.badgeColor === "var(--yellow)";
  const label = id => tabs.find(t => t.id === id)?.label ?? id;
  return (
    <>
      {tucked && !shown && (
        <>
          <button type="button" className="sr-reveal" aria-label="Show the pages" title="Pages" onClick={() => setShown(true)}><Menu size={18} aria-hidden="true" /></button>
          <div className="sr-edge" aria-hidden="true" onMouseEnter={() => setShown(true)} />
        </>
      )}
      <nav className={`side-rail${tucked ? " sr-tucked" : ""}${tucked && shown ? " sr-shown" : ""}`} aria-label="Pages" data-tour="tabs"
        onMouseLeave={tucked ? () => { if (!peek) setShown(false); } : undefined}
        onFocus={tucked ? () => setShown(true) : undefined}>
        <a href="/" className="sr-home" aria-label="Jocular Insights home" onClick={e => { e.preventDefault(); go("discover"); }}><BrandMark size={null} className="sr-mark" /></a>
        {/* a company's page puts its chapters here instead (StockDetail.jsx) */}
        {openSymbol ? <div className="sr-group-gap" /> : <div className="sr-group">
          {tabs.map(t => {
            const on = tab === t.id, open = peek === t.id;
            const b = badges[t.id] ?? {};
            const dot = (t.id === "alerts" && reached) || (t.id === "watchlist" && b.news);
            return (
              <button key={t.id} type="button" className={`sr-tab${on ? " on" : ""}${open ? " open" : ""}`} aria-current={on ? "page" : undefined}
                aria-haspopup={PEEKS.has(t.id) && !on ? "dialog" : undefined} aria-expanded={PEEKS.has(t.id) && !on ? open : undefined}
                onClick={() => press(t.id)}>
                {t.Icon === GridIcon ? <GridIcon size={21} strokeWidth={1.8} filled={on} aria-hidden="true" /> : <t.Icon size={21} strokeWidth={1.8} aria-hidden="true" />}
                {dot && <i className={`sr-dot${t.id === "alerts" ? " warn" : ""}`} aria-hidden="true" />}
                <span className="sr-tip" aria-hidden="true">{t.label}{b.count > 0 ? ` · ${b.count}` : ""}</span>
                <span className="sr-only">{t.label}{dot ? (t.id === "alerts" ? ", an alert's price was reached" : ", new from your companies") : ""}</span>
              </button>
            );
          })}
        </div>}
        <div className="sr-end">
          <button type="button" className="sr-tab" onClick={onToggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <Sun size={20} strokeWidth={1.8} aria-hidden="true" /> : <Moon size={20} strokeWidth={1.8} aria-hidden="true" />}
            <span className="sr-tip" aria-hidden="true">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </nav>
      {peek && <Peek id={peek} label={label(peek)} onClose={() => setPeek(null)} onOpenAll={() => go(peek)} onOpenStock={onOpenStock} />}
    </>
  );
}
