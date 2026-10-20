// "How the price has done" on the stock page's overview: its price change
// against its sector's NSE index and the NIFTY 50 over the same closes, then
// how much the price swings against the market's and its sector's. Every
// figure is worked out on the server from NSE's daily files (market-data.js
// periodReturns, screen.js volatilitySpread); nothing is estimated here.

const PERIODS = [["1W", "w1", "ret1w"], ["1M", "m1", "ret1m"], ["3M", "m3", "ret3m"], ["1Y", "y1", "ret1y"], ["3Y", "y3", "ret3y"], ["5Y", "y5", "ret5y"]];
const PERIOD_WORDS = { y1: "year", m3: "three months", m1: "month" };
const indexName = n => n.replace(/^nifty/i, "NIFTY").replace(/ Index$/, "");
const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const signed = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1)}`;
const tone = v => (v == null ? "" : v >= 0 ? "up" : "down");

function lead(m, rows) {
  const key = ["y1", "m3", "m1"].find(k => rows[0].values[k] != null);
  if (!key) return null;
  const s = rows[0].values[key];
  const ahead = [], behind = [];
  for (const row of rows.slice(1)) {
    const v = row.values[key];
    if (v == null) continue;
    (s >= v ? ahead : behind).push(`${row.label === "NIFTY 50" ? "the NIFTY 50" : row.label} (${signed(v)}%)`);
  }
  const tail = ahead.length && behind.length ? `, ahead of ${ahead[0]} but behind ${behind[0]}`
    : ahead.length ? `, ahead of ${ahead.join(" and ")}`
    : behind.length ? `, behind ${behind.join(" and ")}` : "";
  return `Over the past ${PERIOD_WORDS[key]} its price ${s >= 0 ? "rose" : "fell"} ${Math.abs(s).toFixed(1)}%${tail}.`;
}

function Swings({ m }) {
  const v = m.volatility1y, mk = m.volatilityPeers?.market, sec = m.volatilityPeers?.sector;
  if (v == null) return <p className="sd-muted">Not enough daily closes yet to measure how much the price swings.</p>;
  const weekly = v / Math.sqrt(52);
  const where = !mk ? null
    : v <= mk.p10 ? "among the calmest tenth of"
    : v >= mk.p90 ? "among the jumpiest tenth of"
    : v < mk.median ? "calmer than most of" : "jumpier than most of";
  const marks = [mk && { k: "market", v: mk.median, label: "Middle of the market" }, sec && { k: "sector", v: sec.median, label: `Middle of ${m.sector}` }, { k: "stock", v, label: m.symbol }].filter(Boolean);
  const lo = Math.min(...marks.map(x => x.v), mk?.p10 ?? v) * 0.8;
  const hi = Math.max(...marks.map(x => x.v), mk?.p90 ?? v) * 1.08;
  const pos = x => `${((x - lo) / (hi - lo)) * 100}%`;
  return (
    <>
      <p className="sd-perf-lead">
        In a typical week its price moves about ±{weekly.toFixed(1)}% — a volatility of {v.toFixed(0)}% a year{where ? <>, {where} the {mk.n.toLocaleString("en-IN")} companies screened here</> : ""}.
      </p>
      {mk && (
        <div className="sd-swing" aria-hidden="true">
          <div className="sd-swing-track">
            <span className="sd-swing-band" style={{ left: pos(mk.p10), width: `calc(${pos(mk.p90)} - ${pos(mk.p10)})` }} />
            {marks.map(x => <i key={x.k} className={`sd-swing-mark sd-swing-${x.k}`} style={{ left: pos(x.v) }} />)}
          </div>
        </div>
      )}
      {mk && (
        <ul className="sd-swing-key">
          {marks.slice().reverse().map(x => <li key={x.k}><i className={`sd-swing-mark sd-swing-${x.k}`} aria-hidden="true" />{x.label} <b>{x.v.toFixed(0)}%</b></li>)}
          <li><i className="sd-swing-band" aria-hidden="true" />Middle 80% of companies <b>{mk.p10.toFixed(0)}–{mk.p90.toFixed(0)}%</b></li>
        </ul>
      )}
    </>
  );
}

export default function StockPerformance({ m }) {
  if (!m) return null;
  const sector = m.benchmarks?.sector, market = m.benchmarks?.market;
  const rows = [
    { key: "stock", label: m.symbol, values: Object.fromEntries(PERIODS.map(([, k, id]) => [k, m[id] ?? null])) },
    sector && { key: "sector", label: indexName(sector.name), values: sector.returns },
    market && { key: "market", label: "NIFTY 50", values: market.returns },
  // An index with no figures at all (a snapshot built before index returns
  // were kept) is left out rather than shown as a row of dashes
  ].filter((r, i) => r && (i === 0 || PERIODS.some(([, k]) => r.values?.[k] != null)));
  const any = PERIODS.some(([, k]) => rows[0].values[k] != null);
  const gaps = rows.some(r => PERIODS.some(([, k]) => r.values?.[k] == null));
  const asOf = m.closeDate ?? m.cmpDate;
  return (
    <section className="sd-card sd-perf" aria-labelledby="perf-title">
      <h3 id="perf-title" className="sd-card-title">How the price has done</h3>
      {any ? <>
        {lead(m, rows) && <p className="sd-perf-lead">{lead(m, rows)}</p>}
        <table className="sd-perf-table">
          <caption className="sd-sr">Price change in percent{asOf ? ` to the ${day(asOf)} close` : ""}</caption>
          <thead><tr><th scope="col"><span className="sd-sr">Compared</span><span aria-hidden="true">%</span></th>{PERIODS.map(([p]) => <th key={p} scope="col">{p}</th>)}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className={`sd-perf-${r.key}`}>
                <th scope="row">{r.label}</th>
                {PERIODS.map(([p, k]) => { const v = r.values?.[k]; return <td key={p} className={tone(v)}>{v == null ? <span title="No close on file that far back">—</span> : signed(v)}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sd-foot">
          Price change{asOf ? ` to the ${day(asOf)} NSE close` : ""}, adjusted for splits and bonuses; dividends aren't added.{" "}
          {rows.some(r => r.key === "sector") ? `${indexName(sector.name)} is NSE's index for ${m.sector}.` : m.sector && !sector ? `NSE has no index for ${m.sector}, so it is set against the market alone.` : ""}
          {gaps ? " A dash means no close on file that far back: a newer listing, or an index NSE started later." : ""}
        </p>
      </> : <p className="sd-muted">Not enough NSE closes on file yet to show how the price has done.</p>}
      <h4 className="sd-glance-h sd-perf-h">How much the price swings</h4>
      <Swings m={m} />
    </section>
  );
}
