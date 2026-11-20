import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { api } from "./api.js";
import { cardName, possessive } from "./stockName.js";
import CompanyLogo from "./CompanyLogo.jsx";

// Markets → "Big orders" (19 Nov 2026, the owner: show "the major contract
// winners"): the orders companies told NSE they won over the last few days,
// biggest first, each with its size from the company's own notice and that
// size against the company's market value (server/market-news.js bigOrders).
// An amount that isn't in the notice is said to be not stated, never guessed.

const SHOWN = 6;
const crore = v => `₹${v >= 100 ? Math.round(v).toLocaleString("en-IN") : v.toLocaleString("en-IN", { maximumFractionDigits: 2 })} cr`;
const foreign = f => `${f.currency === "EUR" ? "€" : "US$"}${f.mn.toLocaleString("en-IN", { maximumFractionDigits: 2 })} mn`;
const IST = { timeZone: "Asia/Kolkata" };
const dayOf = t => new Date(t).toLocaleDateString("en-CA", IST);
function when(time) {
  const d = dayOf(time);
  const today = dayOf(Date.now());
  const yesterday = dayOf(Date.now() - 86_400_000);
  if (d === today) return "Today";
  if (d === yesterday) return "Yesterday";
  return new Date(time).toLocaleDateString("en-IN", { ...IST, weekday: "short", day: "numeric", month: "short" });
}

// home: the short form on Home — the five biggest, and a link to the rest on Markets
export default function BigOrders({ onOpenStock, home = false, onSeeAll, bare = false, onCount, onDays }) {
  const [data, setData] = useState(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let off = false, timer = null, tries = 0;
    const load = () => api.bigOrders().then(d => {
      if (off) return;
      setData(d);
      onCount?.(d.items?.length ?? 0);
      // notices still being read: look again shortly, a few times
      if (d.reading > 0 && tries++ < 6) timer = setTimeout(load, 15_000);
    }).catch(() => { if (!off) setData(d => d ?? { items: [], failed: true }); });
    load();
    return () => { off = true; clearTimeout(timer); };
  }, []);

  if (data && !data.failed && data.items.length === 0 && !data.reading) return bare ? <p className="mk-note">No big orders announced in the last few days.</p> : null;
  const items = data?.items ?? [];
  // three in a phone's Home card (TodayHome.jsx), five on a computer's Home
  const list = bare ? items.slice(0, 3) : home ? items.slice(0, 5) : all ? items : items.slice(0, SHOWN);

  return (
    <section className={bare ? "bo-home bo-bare" : home ? "td-box bo-home" : "mk-card"} aria-labelledby={bare ? undefined : home ? "home-orders" : "mk-orders"} aria-label={bare ? "Big orders" : undefined}>
      {bare ? null : home ? (
        <div className="td-head"><h3 id="home-orders">Big orders</h3>{items.length > 0 && <button type="button" onClick={onSeeAll}>All {items.length}</button>}</div>
      ) : (
        <div className="mk-card-h">
          <h2 id="mk-orders">Big orders</h2>
          {onDays ? <button type="button" className="mk-link" onClick={onDays}>Day by day</button>
            : items.length > SHOWN && <button type="button" className="mk-link" onClick={() => setAll(a => !a)}>{all ? "Fewer" : `All ${items.length}`}</button>}
        </div>
      )}
      {bare && items.length > 0 && <div className="hm-more-top"><span>Orders companies told NSE they won, biggest first</span><button type="button" onClick={onSeeAll}>All {items.length}</button></div>}
      {!bare && <p className="mk-note bo-intro">{home ? "Orders and contracts companies told NSE they won in the last few days, biggest first." : "Orders companies told NSE they won in the last few days, biggest first: the size from the company's own notice, beside its market value."}</p>}
      {data?.failed && <p className="mk-note">NSE's notices couldn't be read just now.</p>}
      <ul className="bo-list">
        {!data && [0, 1, 2, 3].map(i => <li key={i}><span className="mk-skel mk-row-skel" /></li>)}
        {list.map(o => <OrderRow key={o.id} o={o} home={home} onOpenStock={onOpenStock} />)}
      </ul>
      {data?.reading > 0 && <p className="mk-note">Reading {data.reading} more notice{data.reading === 1 ? "" : "s"} from NSE…</p>}
      {onDays && items.length > SHOWN && !all && <button type="button" className="mk-res-more" onClick={() => setAll(true)}>Show all {items.length}</button>}
      {onDays && <button type="button" className="mk-res-more" onClick={onDays}>Earlier days</button>}
      {!home && <p className="mk-note">Amounts as each company stated them, some with taxes and some without; a dollar order is shown in dollars. Market value at the last NSE close. A record of filings, not advice.</p>}
    </section>
  );
}

// One order, as Big orders and its day-by-day page show it (MarketsView.jsx OrdersDay)
export function OrderRow({ o, home = false, onOpenStock }) {
  return (
  <li className="bo-row">
    <button type="button" className="bo-main" onClick={() => onOpenStock?.(o.symbol)} aria-label={`${cardName(o.company)}: open its page`}>
      <CompanyLogo symbol={o.symbol} size={30} fallback={o.company} />
      <b className="bo-name">{cardName(o.company)}</b>
      <span className="bo-amt">
        {o.status === "stated" && (o.amountCr != null ? crore(o.amountCr) : foreign(o.foreign))}
        {o.status === "none" && <em>Amount not stated</em>}
        {o.status === "reading" && <em>Reading the notice…</em>}
        {o.status === "unread" && <em>Notice couldn't be read</em>}
      </span>
      <small className="bo-meta">{o.symbol} · {when(o.time)}</small>
      {o.pctOfValue != null && <small className={`bo-pct${o.pctOfValue >= 10 ? " bo-big" : ""}`}>The order is {o.pctOfValue >= 1 ? Math.round(o.pctOfValue) : o.pctOfValue.toFixed(1)}% of the company's market value</small>}
      {o.lowestBidder && <small className="bo-l1">Named the lowest bidder; not yet awarded</small>}
      {o.wholeContract === true && <small className="bo-l1">The whole contract after it was enlarged</small>}
      {typeof o.wholeContract === "number" && <small className="bo-what">Added to a contract now worth {crore(o.wholeContract)}</small>}
      {!home && (o.what || o.from) && <small className="bo-what">{o.from ? `From ${o.from}` : ""}{o.from && o.what ? ": " : ""}{o.what ?? ""}</small>}
    </button>
    {o.url && <a className="bo-pdf" href={o.url} target="_blank" rel="noopener noreferrer" aria-label={`${possessive(cardName(o.company))} notice to NSE`}><FileText size={16} aria-hidden="true" /></a>}
  </li>
  );
}
