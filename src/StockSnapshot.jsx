import { useState, useEffect } from "react";
import { Factory, Ruler, Gauge } from "lucide-react";
import { api } from "./api.js";

// The stock page's overview under the chart (replica/recon.md): three cards —
// its sector, its size, its risk — and a row of key ratios. The size class is
// SEBI's: by market-cap rank, the largest 100 are large caps, the next 150
// mid caps, the rest small caps. The rank is counted live among the companies
// this app screens (the server counts those at least this large).

const cr = v => `₹${Math.round(v).toLocaleString("en-IN")} Cr`;
const pct = v => (v == null ? "—" : `${v.toFixed(1)}%`);
const x = (v, dp = 1) => (v == null ? "—" : `${v.toFixed(dp)}×`);

function sizeClass(rank) {
  if (rank <= 100) return "Large cap";
  if (rank <= 250) return "Mid cap";
  return "Small cap";
}

function useSizeRank(mcap) {
  const [rank, setRank] = useState(null);
  useEffect(() => {
    if (!(mcap > 0)) return;
    let stop = false;
    api.screen({ filters: [{ id: "marketCapCr", min: mcap }], countOnly: true })
      .then(res => { if (!stop) setRank({ rank: res.matched, of: res.total }); })
      .catch(() => {});
    return () => { stop = true; };
  }, [mcap]);
  return rank;
}

export default function StockSnapshot({ m, price }) {
  const size = useSizeRank(m?.marketCapCr);
  if (!m) return null;
  const risk = m.research?.risk;
  const tags = [m.industry, m.lender && "Lender", m.governmentOwned && "Government-owned", m.utility && "Regulated utility", m.cyclical && "Cyclical"].filter(Boolean);
  const metrics = [
    ["P/E (last 4 quarters)", m.peTtm != null ? m.peTtm.toFixed(1) : m.pe != null ? m.pe.toFixed(1) : "—"],
    ["5-year median P/E", m.medianPe != null ? m.medianPe.toFixed(1) : "—"],
    ["Price to book", x(m.priceToBook, 2)],
    ["Dividend yield", pct(m.divYield)],
    ["Return on equity", pct(m.roe)],
    ["Return on capital", pct(m.roce)],
    ["Debt to equity", x(m.debtToEquity, 2)],
    ["EPS (last 4 quarters)", m.ttmEps != null ? `₹${m.ttmEps.toFixed(2)}` : "—"],
  ];
  const lo = m.low52w, hi = m.high52w;
  const at = price > 0 && hi > lo ? Math.min(100, Math.max(0, ((price - lo) / (hi - lo)) * 100)) : null;

  return (
    <>
      <div className="sd-snap">
        <div className="sd-snap-card">
          <span className="sd-snap-icon" aria-hidden="true"><Factory size={18} /></span>
          <h3>{m.sector ?? "Sector not on file"}</h3>
          {tags.length > 0 && <div className="sd-tags">{tags.map(t => <span key={t}>{t}</span>)}</div>}
        </div>
        <div className="sd-snap-card">
          <span className="sd-snap-icon" aria-hidden="true"><Ruler size={18} /></span>
          <h3>{size ? sizeClass(size.rank) : <span className="sd-skel" aria-label="Working out its size" />}</h3>
          <p>Market cap of {cr(m.marketCapCr)}{size ? <>, #{size.rank.toLocaleString("en-IN")} by size of the {size.of.toLocaleString("en-IN")} companies screened here</> : ""}</p>
        </div>
        <div className="sd-snap-card">
          <span className="sd-snap-icon" aria-hidden="true"><Gauge size={18} /></span>
          <h3>{risk ? `${risk.label} risk` : "Risk"}</h3>
          <p>{m.beta1y != null
            ? `Over the past year it moved about ${m.beta1y.toFixed(1)}× as much as the NIFTY 50`
            : m.volatility1y != null ? `Its price swung ${m.volatility1y.toFixed(0)}% a year (volatility)` : "Not enough price history to measure"}</p>
        </div>
      </div>

      <div className="sd-metrics" role="list" aria-label="Key ratios">
        {metrics.map(([label, value]) => (
          <div key={label} role="listitem"><span>{label}</span><strong>{value}</strong></div>
        ))}
        {at != null && (
          <div role="listitem" className="sd-range">
            <span>52-week range</span>
            <div className="sd-range-bar" aria-hidden="true"><i style={{ left: `${at}%` }} /></div>
            <div className="sd-range-ends"><b>₹{Math.round(lo).toLocaleString("en-IN")}</b><b>₹{Math.round(hi).toLocaleString("en-IN")}</b></div>
          </div>
        )}
      </div>
    </>
  );
}
