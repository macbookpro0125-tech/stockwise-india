import { healthFigures } from "./healthMath.js";
import { openCheck } from "./StockSide.jsx";

// The company page's financial health as pictures (healthMath.js): what it
// owns against what it owes, its debt against its cash, debt to equity over
// the years, how well cash flow and profit cover the debt, and a loss-maker's
// cash runway. Sentences describe the figures; the verdict is the Scorecard's.

const cr = n => `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")} Cr`;
const times = n => `${n >= 10 ? Math.round(n) : n.toFixed(1)} times`;
const fy = iso => `FY${iso.slice(2, 4)}`;

function HBars({ label, rows }) {
  const max = Math.max(...rows.map(r => r.parts.reduce((a, p) => a + Math.max(0, p.value), 0)), 1);
  return (
    <div className="sd-hbars" role="img" aria-label={`${label}: ${rows.map(r => `${r.name} ${cr(r.parts.reduce((a, p) => a + p.value, 0))}${r.parts.length > 1 ? ` (${r.parts.filter(p => p.value > 0).map(p => `${p.name} ${cr(p.value)}`).join(", ")})` : ""}`).join("; ")}.`}>
      {rows.map(r => {
        const total = r.parts.reduce((a, p) => a + Math.max(0, p.value), 0);
        return (
          <div key={r.name} className="sd-hbar">
            <span className="sd-hbar-name">{r.name}</span>
            <div className="sd-hbar-track">
              {r.parts.filter(p => p.value > 0).map(p => <i key={p.name} className={`tone-${p.tone}`} style={{ width: `${(p.value / max) * 100}%` }} />)}
            </div>
            <span className="sd-hbar-val">{cr(total)}</span>
          </div>
        );
      })}
    </div>
  );
}

function DeBars({ points }) {
  const max = Math.max(...points.map(p => p.de), 0.01);
  return (
    <div className="sd-divbars sd-debars" role="img" aria-label={`Borrowings to equity by year: ${points.map(p => `${fy(p.fy)} ${p.de.toFixed(2)}`).join(", ")}.`}>
      {points.map(p => (
        <div key={p.fy} className="sd-divbar">
          <span className="sd-divbar-val">{p.de.toFixed(2)}</span>
          <div className="sd-divbar-col"><i style={{ height: `${Math.max(2, (p.de / max) * 100)}%` }} /></div>
          <span className="sd-divbar-fy">{fy(p.fy)}</span>
        </div>
      ))}
    </div>
  );
}

// scoreLink: the line pointing to the scorecard's checks — a phone's
// Safety chapter lists them right under this card (StockChapters.jsx)
export default function StockHealth({ m, scoreLink = true }) {
  if (!m) return null;
  const balance = m.research?.groups?.find(g => g.id === "balance");
  const verdict = scoreLink && balance?.applicable && balance.score != null && (
    <button type="button" className="sd-health-verdict" onClick={() => openCheck("why-balance")}>
      The Scorecard rates its balance sheet <b>{balance.score >= 70 ? "strong" : balance.score >= 50 ? "fair" : "weak"}</b> — see the checks
    </button>
  );

  if (m.lender) {
    return (
      <section className="sd-card sd-health" aria-label="Financial health">
        <p className="sd-div-lead">A lender's balance sheet is mostly loans and deposits, so these measures of what it owns and owes don't fit. Its capital, bad loans and provisions are checked on the Scorecard.</p>
        {verdict}
      </section>
    );
  }

  const f = healthFigures(m.history);
  if (!f) return null;
  const { shortTerm: st, longTerm: lt, debt } = f;
  const year = fy(f.fyEnd);

  return (
    <section className="sd-card sd-health" aria-label="Financial health">
      {/* The amounts are in the bars below; the lead says what they add up to */}
      <p className="sd-div-lead">
        {st.cover != null && <>Its short-term assets cover its short-term liabilities <b>{times(st.cover)}</b>{lt.cover != null ? <> and its long-term liabilities <b>{times(lt.cover)}</b></> : ""}. </>}
        {debt.total === 0
          ? <>It has no debt.</>
          : debt.net <= 0
            ? <>It holds more cash and liquid investments than debt.</>
            : <>Its debt is <b>{cr(debt.net)}</b> more than its cash and liquid investments.</>}
      </p>

      <div className="sd-health-grid">
        <div>
          <h4 className="sd-glance-h">What it owns and owes in the short and long term</h4>
          <HBars label={`${year} balance sheet`} rows={[
            { name: "Short-term assets", parts: [{ name: "short-term assets", value: st.assets ?? 0, tone: "good" }] },
            { name: "Short-term liabilities", parts: [{ name: "short-term liabilities", value: st.liabilities ?? 0, tone: "owe" }] },
            { name: "Long-term liabilities", parts: [{ name: "long-term liabilities", value: Math.max(0, lt.liabilities), tone: "owe2" }] },
          ]} />
        </div>
        <div>
          <h4 className="sd-glance-h">Debt and cash</h4>
          <HBars label={`${year} debt and cash`} rows={[
            { name: "Debt", parts: [{ name: "borrowings", value: debt.borrowings, tone: "owe" }, { name: "lease liabilities", value: debt.leases, tone: "owe2" }] },
            { name: "Cash and liquid investments", parts: [{ name: "cash", value: debt.cash, tone: "good" }] },
          ]} />
          {debt.leases > 0 && <p className="sd-foot sd-health-note">{debt.borrowings === 0 ? "All of its debt is lease liabilities — it has no borrowings." : <>Debt includes {cr(debt.leases)} of lease liabilities (the lighter part).</>}</p>}
        </div>
      </div>

      {/* a row of zeros says less than a sentence (26 Oct 2026, TCS) */}
      {f.deHistory.length > 1 && !f.deHistory.some(p => p.de >= 0.005) && (
        <p className="sd-foot sd-health-note">No borrowings in any of the last {f.deHistory.length} years.</p>
      )}
      {f.deHistory.length > 1 && f.deHistory.some(p => p.de >= 0.005) && (
        <>
          <h4 className="sd-glance-h sd-div-h">Borrowings to equity, by year</h4>
          <DeBars points={f.deHistory} />
          {debt.leases > 0 && f.deWithLeases != null && (
            <p className="sd-foot sd-health-note">Lease liabilities are left out of this chart: the older years' filings don't carry them. The debt to equity in the key figures counts them.</p>
          )}
        </>
      )}

      <ul className="sd-health-lines">
        {f.ocfToDebt != null && <li>One year's operating cash flow would repay <b>{f.ocfToDebt >= 100 ? "all" : `${Math.round(f.ocfToDebt)}%`}</b> of its debt{f.ocfToDebt >= 100 ? ` (${Math.round(f.ocfToDebt / 100 * 10) / 10} times over)` : ""}.</li>}
        {f.interestCover != null && <li>Operating profit covers its interest <b>{times(f.interestCover)}</b>.</li>}
        {debt.total > 0 && f.interestCover == null && m.history?.[0]?.pbtCr != null && m.history[0].pbtCr + (m.history[0].financeCostsCr ?? 0) <= 0 && <li>It made a loss before interest, so profit didn't cover its interest.</li>}
        {f.runway && (
          <li className={f.runway.years < 1 ? "warn" : undefined}>
            Free cash flow was <b>−{cr(f.runway.burn)}</b> in {year}. At that rate its {cr(f.runway.cash)} of cash and liquid investments would last about <b>{f.runway.years >= 10 ? "10 years or more" : f.runway.years < 1 ? `${Math.max(1, Math.round(f.runway.years * 12))} months` : `${f.runway.years.toFixed(1)} years`}</b>.
          </li>
        )}
      </ul>
      {verdict}
      <p className="sd-foot">From the {year} balance sheet and cash flow statement filed with NSE. Short-term means due or turning into cash within a year; long-term liabilities are everything else it owes. Debt includes lease liabilities, as the Scorecard counts it.</p>
    </section>
  );
}
