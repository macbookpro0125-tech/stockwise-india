import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { api } from "./api.js";

// A company's "Orders won" (19 Nov 2026, the owner: if a company gets a
// contract "it should be shown"): the order notices it gave NSE over the last
// year, newest first, each with the size from its own notice and that size
// against the company's market value (server/company-orders.js). Loaded when
// it comes into view, as reading the notices takes a few seconds the first time.

const crore = v => `₹${v >= 100 ? Math.round(v).toLocaleString("en-IN") : v.toLocaleString("en-IN", { maximumFractionDigits: 2 })} cr`;
const foreign = f => `${f.currency === "EUR" ? "€" : "US$"}${f.mn.toLocaleString("en-IN", { maximumFractionDigits: 2 })} mn`;
const dateOf = t => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default function CompanyOrders({ symbol }) {
  const box = useRef(null);
  const [seen, setSeen] = useState(false);
  const [data, setData] = useState(null);
  useEffect(() => {
    setSeen(false); setData(null);
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [symbol]);
  useEffect(() => {
    if (!seen) return;
    let off = false;
    api.panel(symbol, "orders").then(d => { if (!off) setData(d); }).catch(() => { if (!off) setData({ orders: [], failed: true }); });
    return () => { off = true; };
  }, [seen, symbol]);

  const orders = data?.orders ?? [];
  return (
    <div ref={box} className="co">
      {!data && <p className="co-note">Reading the company's notices to NSE…</p>}
      {data?.failed && <p className="co-note">NSE's notices couldn't be read just now.</p>}
      {data && !data.failed && orders.length === 0 && <p className="co-note">No orders announced to NSE in the last year.</p>}
      {orders.length > 0 && (
        <ul className="co-list">
          {orders.map(o => (
            <li key={o.id} className="co-row">
              <div className="co-main">
                <span className="co-date">{dateOf(o.time)}</span>
                <span className="co-amt">
                  {o.status === "stated" ? (o.amountCr != null ? crore(o.amountCr) : foreign(o.foreign)) : <em>{o.status === "unread" ? "Notice couldn't be read" : "Amount not stated"}</em>}
                </span>
              </div>
              {(o.what || o.from) ? (
                <p className="co-sum">{o.from && <b>From {o.from}{o.what ? ": " : ""}</b>}{o.what}</p>
              ) : o.summary && <p className="co-sum">{o.summary.length > 180 ? `${o.summary.slice(0, 179).trimEnd()}…` : o.summary}</p>}
              <div className="co-meta">
                {o.pctOfValue != null && <span>{o.pctOfValue >= 1 ? Math.round(o.pctOfValue) : o.pctOfValue.toFixed(1)}% of today's market value</span>}
                {o.lowestBidder && <span className="co-l1">Named the lowest bidder; not yet awarded</span>}
                {o.wholeContract === true && <span className="co-l1">The whole contract after it was enlarged</span>}
                {typeof o.wholeContract === "number" && <span>Added to a contract now worth {crore(o.wholeContract)}</span>}
                {o.url && <a href={o.url} target="_blank" rel="noopener noreferrer"><FileText size={13} aria-hidden="true" />Notice</a>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data?.total > orders.length && <p className="co-note">The latest {orders.length} of {data.total} order notices in the last year.</p>}
      {orders.length > 0 && <p className="co-note">Amounts as the company stated them in each notice, some with taxes and some without. A company often files once when named the lowest bidder and again when awarded, so the same order can appear twice.</p>}
    </div>
  );
}
