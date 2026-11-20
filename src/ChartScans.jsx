import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { cardName } from "./stockName.js";
import CompanyLogo from "./CompanyLogo.jsx";

// Chart scans on Markets (20 Nov 2026, the owner, from a rival's list: "trend
// templates, VCP setups, Darvas boxes and breakout scans"): pick a price
// pattern, see every company showing it today (explore.js chartScan), the
// strongest price first. Each pattern's rule is written out under the chips.
// A reading of past prices, never a recommendation.

const ORDER = ["trendTemplate", "vcp", "darvasBreakout", "darvasBox", "breakout", "nearHigh", "pullback", "tight", "tightening", "volumeDryUp"];
const num = v => (v == null ? "—" : Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = v => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`);
const keep = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };
const read = k => { try { return localStorage.getItem(k); } catch { return null; } };

export default function ChartScans({ onOpenStock }) {
  const [id, setId] = useState(() => read("mk-scan") || "trendTemplate");
  const [data, setData] = useState(null);
  const [all, setAll] = useState(false);
  const chips = useRef(null);
  // the picked pattern's chip in view, as the row scrolls sideways on a phone
  useEffect(() => { const row = chips.current, on = row?.querySelector("button.on"); if (row && on) row.scrollTo({ left: on.offsetLeft - row.offsetLeft - 16, behavior: "smooth" }); }, [id, data?.scans]);
  useEffect(() => {
    let off = false;
    setData(d => (d ? { ...d, rows: null } : null));
    setAll(false);
    api.chartScan(id).then(d => { if (!off) setData(d); }).catch(() => { if (!off) setData({ failed: true }); });
    keep("mk-scan", id);
    return () => { off = true; };
  }, [id]);

  const scans = (data?.scans ?? []).slice().sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const pick = scans.find(s => s.id === id);
  const rows = data?.rows;
  const shown = rows ? (all ? rows : rows.slice(0, 12)) : null;
  return (
    <section className="mk-card" aria-labelledby="mk-scan">
      <div className="mk-card-h"><h2 id="mk-scan">Chart scans</h2>{data?.date && <span className="cs-date">Prices of {new Date(`${data.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}</span>}</div>
      {data?.failed && <p className="mk-note">The scans couldn't be loaded just now.</p>}
      {scans.length > 0 && (
        <div ref={chips} className="cs-chips" role="tablist" aria-label="Pattern">
          {scans.map(s => (
            <button key={s.id} type="button" role="tab" aria-selected={s.id === id} className={s.id === id ? "on" : ""} onClick={() => setId(s.id)}>
              {s.label}<span>{data.counts?.[s.id] ?? 0}</span>
            </button>
          ))}
        </div>
      )}
      {pick && <p className="cs-about"><b>{pick.label}:</b> {pick.about}.</p>}
      {!data && <p className="mk-note">Reading every company's chart…</p>}
      {shown && shown.length === 0 && <p className="mk-note">No company shows this pattern today.</p>}
      {shown?.length > 0 && (
        <ul className="cs-list">
          {shown.map(r => (
            <li key={r.symbol}>
              <button type="button" onClick={() => onOpenStock?.(r.symbol)}>
                <CompanyLogo symbol={r.symbol} size={26} fallback={r.name} />
                <span className="mk-who"><b>{cardName(r.name)}</b><small>{r.symbol}{r.sector ? ` · ${r.sector}` : ""}</small></span>
                <span className="cs-str" title="Price strength, 1–99: how its price has done against every other company's">{r.strength ?? "—"}</span>
                <span className="cs-px">
                  <span className="mk-num">₹{num(r.close)}</span>
                  <span className={`mk-chg ${r.change == null ? "" : r.change >= 0 ? "up" : "down"}`}>{pct(r.change)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows?.length > 12 && !all && <button type="button" className="mk-link cs-more" onClick={() => setAll(true)}>Show all {rows.length}</button>}
      <p className="mk-note">Companies trading ₹1 crore a day or more. The number by each name is its price strength (1–99). A pattern describes past prices; it isn't a signal to buy or sell.</p>
    </section>
  );
}
