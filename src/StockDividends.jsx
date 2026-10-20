// The company page's dividends: what it paid over the last 12 months and the
// yield against other payers, how much of its earnings and free cash flow
// that takes, the next one announced, and six years' record — from the
// server's dividendRecord (http-server.js dividendSummary, dividends.js).
// Words describe the figures; none of it says whether to buy for income.

const fy = n => `FY${String(n).slice(-2)}`;
const rupees = n => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: n < 10 ? 2 : 1 })}`;
const pct = (n, dp = 1) => `${Number(n).toFixed(dp)}%`;
const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// Where a yield sits among the companies that paid one
function standing(y, market) {
  if (!(y > 0) || !market) return null;
  if (y >= market.p75) return "In the top quarter of payers";
  if (y >= market.median) return "Above the middle payer";
  if (y > market.p25) return "Below the middle payer";
  return "In the bottom quarter of payers";
}

// How much of a source the dividend takes, in words
function share(p, source) {
  if (p == null) return null;
  if (p > 100) return `more than its ${source}`;
  if (p >= 75) return `most of its ${source}`;
  if (p >= 40) return `a moderate share of its ${source}`;
  return `a small share of its ${source}`;
}

function Bars({ years }) {
  const max = Math.max(...years.map(y => y.regular + y.special), 0);
  if (!(max > 0)) return null;
  return (
    <div className="sd-divbars" role="img" aria-label={`Dividends a share by financial year: ${years.map(y => `${fy(y.fy)}${y.partial ? " so far" : ""} ${y.regular + y.special > 0 ? rupees(y.regular + y.special) : "none"}${y.special > 0 ? `, ${rupees(y.special)} of it special` : ""}`).join("; ")}.`}>
      {years.map(y => {
        const total = y.regular + y.special;
        return (
          <div key={y.fy} className={`sd-divbar${y.partial ? " partial" : ""}`}>
            <span className="sd-divbar-val">{total > 0 ? rupees(total) : "—"}</span>
            <div className="sd-divbar-col">
              {y.special > 0 && <i className="special" style={{ height: `${(y.special / max) * 100}%` }} />}
              <i style={{ height: `${(y.regular / max) * 100}%` }} />
            </div>
            <span className="sd-divbar-fy">{fy(y.fy)}{y.partial ? "*" : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function StockDividends({ m, price }) {
  const d = m?.dividendRecord;
  if (!d) return null;
  const years = d.byYear ?? [];
  const lastPaid = [...years].reverse().find(y => y.regular + y.special > 0);
  const pays = d.ttm > 0;
  const where = standing(d.yield, d.market);

  if (!pays && !lastPaid) {
    return (
      <section className="sd-card sd-div" aria-label="Dividends">
        <p className="sd-div-lead">{years.length
          ? `No dividend from ${m.name ?? m.symbol} in NSE's corporate actions since April ${years[0].fy - 1}.`
          : `No dividend from ${m.name ?? m.symbol} in the last 12 months.`}</p>
        <p className="sd-foot">From NSE's corporate actions.</p>
      </section>
    );
  }

  const track = d.track;
  const trackLine = track && track.years > 0 && (
    <>Paid in {track.paid} of the last {track.years} financial years
      {track.years > 1 && <>; raised {track.raised} {track.raised === 1 ? "time" : "times"}, held {track.held}, cut {track.cut}{track.cuts.length ? ` (${track.cuts.map(fy).join(", ")})` : ""}</>}.</>
  );
  const specials = years.filter(y => y.special > 0);

  return (
    <section className="sd-card sd-div" aria-label="Dividends">
      <p className="sd-div-lead">
        {pays
          ? <>It paid <b>{rupees(d.ttm)}</b> a share over the last 12 months{d.yield != null && price > 0 ? <> — a yield of <b>{pct(d.yield, 2)}</b> at {rupees(price)}</> : ""}.</>
          : <>No dividend in the last 12 months{lastPaid ? <>; it last paid in {fy(lastPaid.fy)}</> : ""}.</>}
      </p>

      <div className="sd-div-stats">
        <div>
          <span>Yield</span>
          <strong>{d.yield != null ? pct(d.yield, 2) : "—"}</strong>
          <em>{where ?? (d.market ? "Not paying now" : "")}</em>
        </div>
        <div>
          <span>Other payers</span>
          <strong>{d.market ? pct(d.market.median, 2) : "—"}</strong>
          <em>{d.market ? `the middle of ${d.market.payers.toLocaleString("en-IN")}; top quarter from ${pct(d.market.p75, 2)}` : ""}{d.sector ? ` · ${m.sector}: ${pct(d.sector.median, 2)}` : ""}</em>
        </div>
        <div>
          <span>Payout</span>
          <strong>{d.payoutEarnings != null ? pct(d.payoutEarnings, 0) : "—"}</strong>
          <em>{d.payoutEarnings != null ? "of earnings a share" : "no earnings to compare"}{d.payoutCash != null ? ` · ${pct(d.payoutCash, 0)} of free cash flow` : ""}</em>
        </div>
      </div>

      {(d.payoutEarnings != null || d.payoutCash != null || d.fcfNegative) && pays && (
        <p className="sd-div-line">
          The last 12 months' dividends took {share(d.payoutEarnings, "earnings") ?? "an unknown share of its earnings"}
          {d.payoutCash != null ? <> and {share(d.payoutCash, "free cash flow")} in the latest year</> : d.fcfNegative ? <>; its free cash flow was negative in the latest year, so they weren't paid out of it</> : ""}.
        </p>
      )}

      <p className="sd-div-line">
        {d.next
          ? <><b>Next:</b> ex-dividend {day(d.next.date)}{d.next.amount ? `, ${rupees(d.next.amount)} a share` : ""} — to receive it, the shares must be held before that day.</>
          : <>No dividend announced for the coming weeks.</>}
      </p>

      {years.length > 0 && (
        <>
          <h4 className="sd-glance-h sd-div-h">Dividends a share, by financial year</h4>
          <Bars years={years} />
          {trackLine && <p className="sd-div-line">{trackLine}{specials.length ? ` Special dividends (${specials.map(y => fy(y.fy)).join(", ")}) are the fainter part of a bar, and left out of raised or cut.` : ""}</p>}
        </>
      )}
      <p className="sd-foot">
        From NSE's corporate actions over six years and the company's filings. On today's share count, after splits and bonuses; financial years run April to March{years.some(y => y.partial) ? ", and * is this year so far" : ""}. Free cash flow is operating cash flow less capital spending. Not advice.
      </p>
    </section>
  );
}
