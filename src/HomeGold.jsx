import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { api } from "./api.js";

// Gold on Home (20 Nov 2026, the owner: "gold price to the menus and Home
// screen"): a gram of gold by carat — the estimate for now when there is one,
// else RBI's latest price (server/rbi-gold.js) — for 10 grams, with the gold
// and silver ETFs' moves today, and the way to the Gold tab.

const rupee = v => `₹${Math.round(v).toLocaleString("en-IN")}`;
const signed = v => (v == null ? "" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`);
const tone = v => (v == null ? "var(--t3)" : v >= 0 ? "var(--green)" : "var(--red)");
const shortDay = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export default function HomeGold({ onOpen }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.publicGoldSilver().then(setD).catch(() => {}); }, []);
  const g = d?.gram;
  const gold = d?.groups?.gold?.find(e => e.symbol === "GOLDBEES"), silver = d?.groups?.silver?.find(e => e.symbol === "SILVERBEES");
  if (!g && !gold) return null;
  const table = g?.estimate?.table ?? g?.table;
  return (
    <section className="td-box hg" aria-label="Gold today">
      <div className="td-head"><h3>Gold today</h3><button type="button" onClick={onOpen}>Gold &amp; silver</button></div>
      {table && (
        <button type="button" className="hg-grid" onClick={onOpen}>
          {[["24K", "24 carat"], ["22K", "22 carat"], ["18K", "18 carat"]].map(([k, label]) => (
            <span key={k}><small>{label}, 10 g</small><b>{rupee(table[k][10])}</b></span>
          ))}
        </button>
      )}
      {g && <p className="hg-note">{g.estimate ? `Estimate now, from RBI's ${rupee(g.price)} a gram for ${shortDay(g.redeemOn)} and the gold ETF's move since` : `RBI's price for ${shortDay(g.redeemOn)}: ${rupee(g.price)} a gram of 24 carat`}. Before GST: with 3% GST, ₹{Math.round(table["24K"][10] * 1.03).toLocaleString("en-IN")} for 10 g of 24 carat; making charges extra.</p>}
      <div className="hg-etfs">
        {gold && <span>Gold ETF <b>₹{gold.price.toFixed(2)}</b> <i style={{ color: tone(gold.changePct) }}>{signed(gold.changePct)}</i></span>}
        {silver && <span>Silver ETF <b>₹{silver.price.toFixed(2)}</b> <i style={{ color: tone(silver.changePct) }}>{signed(silver.changePct)}</i></span>}
        <button type="button" className="hg-go" onClick={onOpen}>All prices<ChevronRight size={14} aria-hidden="true" /></button>
      </div>
    </section>
  );
}
