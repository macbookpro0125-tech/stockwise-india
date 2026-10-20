// "Against its sector" on the company page, above the peers table: growth,
// returns, margins, debt and P/E beside the sector's middle company, and how
// many of the sector's others it beats (server/sector-compare.js). Plain
// comparisons — a lower P/E is described as cheaper, not as better.

const PCT = new Set(["salesGrowth5y", "epsGrowth5y", "roe", "roce5y", "opm5y"]);
const fmt = (id, v) => (PCT.has(id) ? `${v.toFixed(1)}%` : id === "debtToEquity" ? `${v.toFixed(2)}×` : v.toFixed(1));

function words(r) {
  const others = r.n - 1;
  const share = Math.round(r.beats * 100);
  const verb = r.id === "debtToEquity" ? ["Less debt than", "More debt than"] : r.id === "peTtm" ? ["Cheaper than", "Dearer than"] : ["Higher than", "Lower than"];
  if (share === 100) return `${verb[0]} all ${others} others`;
  if (share === 0) return `${verb[1]} all ${others} others`;
  return share >= 50 ? `${verb[0]} ${share}% of the ${others} others` : `${verb[1]} ${100 - share}% of the ${others} others`;
}

export default function StockSectorCompare({ m }) {
  const rows = (m?.sectorCompare ?? []).filter(r => r.beats != null);
  if (!rows.length) return null;
  return (
    <section className="sd-card sd-sector" aria-labelledby="sector-title">
      <h3 id="sector-title" className="sd-card-title">Against its sector</h3>
      <p className="sd-muted sd-sector-sub">Beside the {m.lender ? `lenders in ${m.sector}` : `other ${m.sector} companies`} screened here: the sector's middle company, and how many of the others it beats.</p>
      <ul className="sd-sector-rows">
        {rows.map(r => (
          <li key={r.id}>
            <div className="sd-sector-head">
              <span className="sd-sector-name">{r.label}</span>
              <b>{fmt(r.id, r.value)}</b>
              <span className="sd-sector-mid">middle {fmt(r.id, r.median)}</span>
            </div>
            <div className="sd-sector-track" aria-hidden="true"><i style={{ left: `${r.beats * 100}%` }} /></div>
            <span className="sd-sector-words">{words(r)}</span>
          </li>
        ))}
      </ul>
      <p className="sd-foot">From the companies' own filings and NSE closes. The track runs from the lowest in the sector to the highest{rows.some(r => r.better === "lower") ? " (for debt and P/E, from the most to the least)" : ""}; the dot is this company. A comparison, not a verdict.</p>
    </section>
  );
}
