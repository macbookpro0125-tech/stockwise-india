import { useEffect, useState } from "react";
import { api } from "./api.js";

// Insider and promoter trades, under the shareholding table: a year of the
// disclosures companies file with NSE under SEBI's insider-trading rules
// (server/insiders.js). Buying and selling are market purchases and sales of
// shares; option exercises, gifts and transfers are counted apart.

const cr = v => {
  if (!(v > 0)) return "₹0";
  if (v >= 1e7) return `₹${(v / 1e7).toLocaleString("en-IN", { maximumFractionDigits: v >= 1e9 ? 0 : 1 })} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 1 })} lakh`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};
const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

export default function InsidersPanel({ symbol }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let stop = false;
    setState({ loading: true });
    api.panel(symbol, "insiders").then(d => { if (!stop) setState({ data: d }); }).catch(e => { if (!stop) setState({ error: e.message }); });
    return () => { stop = true; };
  }, [symbol]);

  const d = state.data;
  const groups = (d?.groups ?? []).filter(g => g.id !== "others" || g.bought.trades + g.sold.trades > 0);
  const traded = groups.some(g => g.bought.trades + g.sold.trades > 0);
  const others = Object.entries(d?.otherMoves ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <section className="sd-card sd-insiders" aria-labelledby="insiders-title">
      <h3 id="insiders-title" className="sd-card-title">Insider and promoter trades</h3>
      {state.loading && <p className="sd-muted">Reading the last year's disclosures from NSE…</p>}
      {state.error && <p className="sd-muted">NSE's insider-trading disclosures couldn't be read just now. Try again later.</p>}
      {d && (
        <>
          <p className="sd-muted sd-insiders-sub">Market purchases and sales of shares disclosed to NSE in the last 12 months, from {day(d.from)}.</p>
          {traded ? (
            <div className="sd-insiders-groups">
              {groups.map(g => (
                <div key={g.id}>
                  <span className="sd-insiders-label">{g.label}</span>
                  <div className="sd-insiders-split">
                    <span className="buy"><b>{cr(g.bought.value)}</b> bought{g.bought.trades ? ` · ${g.bought.trades} ${g.bought.trades === 1 ? "trade" : "trades"}` : ""}</span>
                    <span className="sell"><b>{cr(g.sold.value)}</b> sold{g.sold.trades ? ` · ${g.sold.trades} ${g.sold.trades === 1 ? "trade" : "trades"}` : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="sd-div-line">No market purchases or sales by promoters, directors or officers were disclosed in the last 12 months.</p>}
          {d.recent.length > 0 && (
            <div className="sd-insiders-table" role="table" aria-label="Latest market trades">
              <div role="row" className="head"><span role="columnheader">Date</span><span role="columnheader">Who</span><span role="columnheader">Trade</span><span role="columnheader">Value</span></div>
              {d.recent.map((r, i) => (
                <div role="row" key={`${r.date}-${i}`}>
                  <span role="cell">{day(r.date)}</span>
                  <span role="cell"><b>{r.name}</b><em>{r.category}</em></span>
                  <span role="cell" className={r.side}>{r.side === "buy" ? "Bought" : "Sold"} {r.shares.toLocaleString("en-IN")}{r.holdingAfter > 0 ? <em>holds {r.holdingAfter}% after</em> : null}</span>
                  <span role="cell">{cr(r.value)}</span>
                </div>
              ))}
            </div>
          )}
          {others.length > 0 && <p className="sd-div-line">Also disclosed, not counted as buying or selling: {others.map(([mode, n]) => `${n} ${/^[A-Z]{2,}$/.test(mode) ? mode : mode.toLowerCase()}`).join(", ")}.</p>}
          <p className="sd-foot">From the disclosures companies file with NSE under SEBI's insider-trading rules: promoters, directors, key staff and their relatives. Shares only. A record of trades, not a signal.</p>
        </>
      )}
    </section>
  );
}
