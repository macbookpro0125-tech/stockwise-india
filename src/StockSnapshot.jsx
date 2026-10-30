import { useState, useEffect } from "react";
import { Factory, Ruler, Gauge } from "lucide-react";
import { api } from "./api.js";
import { DataNote } from "./StockDataDates.jsx";

// The stock page's overview under the chart (replica/recon.md): three cards —
// its sector, its size, its risk — and a row of key ratios. The size class is
// SEBI's: by market-cap rank, the largest 100 are large caps, the next 150
// mid caps, the rest small caps. The rank is counted live among the companies
// this app screens (the server counts those at least this large).

const cr = v => `₹${Math.round(v).toLocaleString("en-IN")} Cr`;
const pct = v => (v == null ? "—" : `${v.toFixed(1)}%`);
const x = (v, dp = 1) => (v == null ? "—" : `${v.toFixed(dp)}×`);

// Where the sector came from (metrics.js sectorSource): [line, a phone's line]
const SECTOR_SOURCE = {
  "NSE sector": ["Sector from NSE's index lists", "Sector as NSE lists it"],
  "NSE industry mapped to sector": ["Sector from its NSE industry", "Sector from its NSE industry"],
  "BSE industry mapped to sector": ["Sector from its BSE industry", "Sector from its BSE industry"],
  "company name": ["Sector read from the company's name", "Sector read from its name"],
};

function sizeClass(rank) {
  if (rank <= 100) return "Large cap";
  if (rank <= 250) return "Mid cap";
  return "Small cap";
}

// A long wording, and a short one a phone shows instead (index.css hides
// whichever doesn't apply, so a screen reader reads only the one on screen)
function Fit({ wide, narrow }) {
  return <><span className="sd-wide">{wide}</span><span className="sd-narrow">{narrow}</span></>;
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

export default function StockSnapshot({ m, price, dates }) {
  const size = useSizeRank(m?.marketCapCr);
  if (!m) return null;
  const risk = m.research?.risk;
  const tags = [m.lender && "Lender", m.governmentOwned && "Government-owned", m.utility && "Regulated utility", m.cyclical && "Cyclical"].filter(Boolean);
  // The sector's line: its NSE industry where NSE gives one (1,368 companies
  // have none, e.g. Indiamart), else where the sector came from
  const source = SECTOR_SOURCE[m.sectorSource];
  // [label, short label for a phone's three-to-a-row grid, value]
  const metrics = [
    ["P/E (last 4 quarters)", "P/E · 4 qtrs", m.peTtm?.toFixed(1) ?? "—"],
    ["P/E (latest audited year)", "P/E · last year", m.peFy?.toFixed(1) ?? "—"],
    ["5-year median annual P/E", "5Y median P/E", m.medianPe != null ? m.medianPe.toFixed(1) : "—"],
    ["Price to book", "Price/book", x(m.priceToBook, 2)],
    ["Dividend yield", "Div. yield", pct(m.divYield)],
    ["Return on equity", "ROE", pct(m.roe)],
    ["Return on capital", "ROCE", pct(m.roce)],
    ["Debt to equity", "Debt/equity", m.template === "BANKING" ? <Fit wide="Not applicable for a bank" narrow="n/a (bank)" /> : x(m.debtToEquity, 2)],
    ["EPS (last 4 quarters)", "EPS · 4 qtrs", m.ttmEps != null ? `₹${m.ttmEps.toFixed(2)}` : "—"],
  ];
  const lo = m.low52w, hi = m.high52w;
  const at = price > 0 && hi > lo ? Math.min(100, Math.max(0, ((price - lo) / (hi - lo)) * 100)) : null;

  return (
    <>
      <div className="sd-snap">
        <div className="sd-snap-card">
          <span className="sd-snap-icon" aria-hidden="true"><Factory size={18} /></span>
          <h3>{m.sector ?? "Sector not on file"}</h3>
          {(m.industry || source) && <p><Fit
            wide={m.industry ? <>Industry: {m.industry}{source ? ` · ${source[0]}` : ""}</> : source[0]}
            narrow={m.industry ?? source[1]} /></p>}
          {tags.length > 0 && <div className="sd-tags">{tags.map(t => <span key={t}>{t}</span>)}</div>}
        </div>
        <div className="sd-snap-card">
          <span className="sd-snap-icon" aria-hidden="true"><Ruler size={18} /></span>
          <h3>{size ? sizeClass(size.rank) : <span className="sd-skel" aria-label="Working out its size" />}</h3>
          <p><Fit
            wide={<>Market cap of {cr(m.marketCapCr)}{size ? <>, #{size.rank.toLocaleString("en-IN")} by size of the {size.of.toLocaleString("en-IN")} companies screened here</> : ""}</>}
            narrow={<>{cr(m.marketCapCr)}{size ? <> · #{size.rank.toLocaleString("en-IN")} of {size.of.toLocaleString("en-IN")}</> : ""}</>} /></p>
        </div>
        <div className="sd-snap-card">
          <span className="sd-snap-icon" aria-hidden="true"><Gauge size={18} /></span>
          <h3>{risk ? `${risk.label} risk` : "Risk"}</h3>
          <p>{m.beta1y != null
            ? <Fit wide={`Over the past year it moved about ${m.beta1y.toFixed(1)}× as much as the NIFTY 50`} narrow={`Moves ${m.beta1y.toFixed(1)}× the NIFTY 50`} />
            : m.volatility1y != null ? <Fit wide={`Its price swung ${m.volatility1y.toFixed(0)}% a year (volatility)`} narrow={`Swings ${m.volatility1y.toFixed(0)}% a year`} /> : "Not enough price history to measure"}</p>
        </div>
      </div>

      <div className="sd-metrics" role="list" aria-label="Key ratios">
        {metrics.map(([label, short, value]) => (
          <div key={label} role="listitem"><span><Fit wide={label} narrow={short} /></span><strong>{value}</strong></div>
        ))}
        {at != null && (
          <div role="listitem" className="sd-range">
            <span>52-week range</span>
            <div className="sd-range-bar" aria-hidden="true"><i style={{ left: `${at}%` }} /></div>
            <div className="sd-range-ends"><b>₹{Math.round(lo).toLocaleString("en-IN")}</b><b>₹{Math.round(hi).toLocaleString("en-IN")}</b></div>
          </div>
        )}
      </div>
      <DataNote dates={dates} />
    </>
  );
}
