import { useEffect, useState } from "react";
import { api } from "./api.js";
import { profitBridge, headline, profitWords, fmt } from "./profitJump.js";

// "Why profit jumped" (20 Nov 2026): when a quarter's (or a year's) profit
// turned from a loss, or rose or fell sharply, the change split into the
// company's own filed lines (profitJump.js). For a jump from the business, the
// orders it announced to NSE in the year before, as context — not as the cause.

const DAY = 86_400_000;
const label = (iso, yearly) => new Date(`${iso}T00:00:00Z`).toLocaleString("en-IN", { ...(yearly ? {} : { month: "short" }), year: "numeric", timeZone: "UTC" });

// the two periods: a quarter against the same quarter a year earlier; a year
// against the year before
export function jumpPeriods(list, yearly) {
  const now = list?.[0];
  if (!now) return null;
  const want = Date.parse(now.fyEnd) - 365 * DAY;
  // the year (or quarter) just before, never one further back
  const then = list.find(x => Math.abs(Date.parse(x.fyEnd) - want) <= 20 * DAY);
  return then ? { now, then } : null;
}

export default function ProfitWhy({ periods, yearly = false, symbol = null }) {
  const pair = jumpPeriods(periods, yearly);
  const lender = pair && pair.now.operatingProfitCr == null && pair.then.operatingProfitCr == null;
  const b = pair ? profitBridge(pair.now, pair.then, { lender }) : null;
  const [orders, setOrders] = useState(null);
  const wantOrders = !!(b && symbol && !yearly && b.main?.key === "business" && b.change > 0);
  useEffect(() => {
    if (!wantOrders) return;
    let off = false;
    api.panel(symbol, "orders").then(d => { if (!off) setOrders(d?.orders ?? []); }).catch(() => {});
    return () => { off = true; };
  }, [wantOrders, symbol]);
  if (!b) return null;

  const { now, then } = pair;
  const up = b.change > 0;
  const max = Math.max(...b.parts.map(p => Math.abs(p.cr)), 1);
  const when = yearly ? `FY${label(then.fyEnd, true)} → FY${label(now.fyEnd, true)}` : `${label(then.fyEnd)} quarter → ${label(now.fyEnd)} quarter`;
  // orders in the year up to the results
  const to = Date.parse(now.filed ?? now.fyEnd) + DAY;
  const near = (orders ?? []).filter(o => { const t = Date.parse(o.time); return t <= to && t >= to - 365 * DAY; });
  const stated = near.filter(o => o.amountCr != null).reduce((s, o) => s + o.amountCr, 0);

  return (
    <div className="pw">
      <div className="pw-h">Why profit {up ? "jumped" : "fell"}</div>
      <p className="pw-sum">
        Net profit went from <b>{profitWords(then.profitCr)}</b> to <b>{profitWords(now.profitCr)}</b> <span className="pw-when">({when})</span>, a change of {up ? "+" : "−"}₹{fmt(b.change)} cr.
        {" "}<b className="pw-lead">{headline(b)}</b>
      </p>
      <ul className="pw-list">
        {b.parts.map(p => (
          <li key={p.key}>
            <div className="pw-row">
              <span className="pw-label">{p.label}</span>
              <span className={`pw-amt ${p.cr >= 0 ? "up" : "down"}`}>{p.cr >= 0 ? "+" : "−"}₹{fmt(p.cr)} cr</span>
            </div>
            <div className="pw-bar"><i className={p.cr >= 0 ? "up" : "down"} style={{ width: `${Math.max(2, (Math.abs(p.cr) / max) * 100)}%` }} /></div>
            {p.note && <small className="pw-note">{p.note}</small>}
          </li>
        ))}
      </ul>
      {wantOrders && near.length > 0 && (
        <p className="pw-orders">
          In the year before these results, the company announced {near.length} order{near.length > 1 ? "s" : ""} to NSE{stated > 0 ? `, ₹${fmt(stated)} cr where the size was stated` : ""}. See <b>Orders won</b> on the Business tab.
        </p>
      )}
      <p className="pw-foot">From the company's filed results. Its own explanation, when it gives one, is in the results filing and its investor presentation.</p>
    </div>
  );
}
