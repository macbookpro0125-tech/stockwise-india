import { useEffect, useState } from "react";
import { api } from "./api.js";

// India's economy on Markets (20 Nov 2026, the owner: "show how the economy
// of India is working in the market page"): RBI's interest rates and what the
// government pays to borrow from 3 months to 30 years (the yield curve), what
// foreign and Indian institutions bought or sold on NSE, and ten years of the
// economy from the World Bank. Every figure with its source and date
// (server/economy.js).

const pc = (v, d = 2) => (v == null ? "—" : `${v.toFixed(d)}%`);
const cr = v => `${v >= 0 ? "+" : "−"}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")} cr`;
const dayOf = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
// "3 months", "1 year", "30 years"
const long = p => (p.years < 0.9 ? `${Math.round(p.years * 12)} months` : `${Math.round(p.years)} year${Math.round(p.years) === 1 ? "" : "s"}`);
const fmt = (ind, v) => {
  if (v == null) return "—";
  if (ind.unit === "US$ trn") return `$${v.toFixed(2)} trn`;
  if (ind.unit === "US$ bn") return `$${Math.round(v).toLocaleString("en-IN")} bn`;
  if (ind.unit === "US$") return `$${Math.round(v).toLocaleString("en-IN")}`;
  return `${v.toFixed(1)}%`;
};

// the yield curve: bills and bonds by years to maturity, a line through them
function Curve({ curve }) {
  const W = 320, H = 120, P = { l: 30, r: 10, t: 12, b: 24 };
  const pts = curve.points;
  const ys = pts.map(p => p.yield);
  const lo = Math.floor(Math.min(...ys) * 2) / 2 - 0.25, hi = Math.ceil(Math.max(...ys) * 2) / 2 + 0.25;
  // years on a square-root scale, so 3 months and 30 years both have room
  const sx = y => P.l + (Math.sqrt(y) / Math.sqrt(pts.at(-1).years)) * (W - P.l - P.r);
  const sy = v => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.years).toFixed(1)},${sy(p.yield).toFixed(1)}`).join(" ");
  // whole percentages between the ends, or halves when the curve is flat
  const step = hi - lo > 2 ? 1 : 0.5;
  const ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const short = p => (p.years < 1 ? `${Math.round(p.years * 12)}m` : `${Math.round(p.years)}y`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ec-curve" role="img" aria-label={`Government borrowing costs from ${pts[0].label} (${pts[0].yield.toFixed(2)}%) to ${pts.at(-1).label} (${pts.at(-1).yield.toFixed(2)}%)`}>
      {ticks.map(v => <g key={v}><line x1={P.l} x2={W - P.r} y1={sy(v)} y2={sy(v)} className="ec-grid" /><text x={P.l - 4} y={sy(v) + 3} textAnchor="end" className="ec-axis">{v.toFixed(1)}%</text></g>)}
      <path d={path} className="ec-line" fill="none" />
      {pts.map((p, i) => <g key={p.label}><circle cx={sx(p.years)} cy={sy(p.yield)} r={3} className="ec-dot"><title>{`${long(p)}: ${p.yield.toFixed(2)}%`}</title></circle>{(i === 0 || p.years >= 0.9) && <text x={sx(p.years)} y={H - 8} textAnchor="middle" className="ec-axis">{short(p)}</text>}</g>)}
    </svg>
  );
}

// a figure's years as a proper chart, opened by tapping its tile: a bar a
// year with its value over it, below zero in red under the line
const compact = (ind, v) => (ind.unit === "US$" ? `${(v / 1000).toFixed(1)}k` : ind.unit === "US$ trn" ? v.toFixed(2) : ind.unit === "US$ bn" ? Math.round(v).toString() : v.toFixed(1));
function YearChart({ ind }) {
  const W = 340, H = 176, P = { l: 6, r: 6, t: 18, b: 34 }; // room under the lowest bar for its value and the years
  const ys = ind.years, n = ys.length;
  const top = Math.max(0, ...ys.map(y => y.value)), bottom = Math.min(0, ...ys.map(y => y.value));
  const span = top - bottom || 1;
  const sy = v => P.t + ((top - v) / span) * (H - P.t - P.b);
  const slot = (W - P.l - P.r) / n, bw = Math.min(22, slot * 0.62);
  const unit = ind.unit === "US$" ? "US$ thousand" : ind.unit;
  return (
    <figure className="ec-yc">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ind.label}, ${ys[0].year} to ${ys.at(-1).year}`}>
        <line x1={P.l} x2={W - P.r} y1={sy(0)} y2={sy(0)} className="ec-zero" />
        {ys.map((y, i) => {
          const x = P.l + slot * i + (slot - bw) / 2, y0 = sy(0), y1 = sy(y.value), last = i === n - 1;
          return (
            <g key={y.year}>
              <rect x={x} y={Math.min(y0, y1)} width={bw} height={Math.max(1, Math.abs(y1 - y0))} rx={2} className={y.value < 0 ? "neg" : last ? "now" : "bar"} />
              <text x={x + bw / 2} y={y.value < 0 ? y1 + 10 : y1 - 4} textAnchor="middle" className={`ec-val${last ? " now" : ""}`}>{compact(ind, y.value)}</text>
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="ec-axis">{`'${String(y.year).slice(2)}`}</text>
            </g>
          );
        })}
      </svg>
      <figcaption><b>{ind.label}</b> ({unit}): {ind.about}.</figcaption>
    </figure>
  );
}

// ten years as small bars, the latest darkest; a year below zero in red
function Bars({ years }) {
  const max = Math.max(...years.map(y => Math.abs(y.value)), 0.0001);
  return (
    <span className="ec-bars" aria-hidden="true">
      {years.map(y => <i key={y.year} className={y.value < 0 ? "neg" : ""} style={{ height: `${Math.max(6, (Math.abs(y.value) / max) * 100)}%` }} />)}
    </span>
  );
}

export default function EconomyCard() {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { api.economy().then(setD).catch(() => setD({ failed: true })); }, []);
  if (!d) return <section className="mk-card"><div className="mk-card-h"><h2>India's economy</h2></div><p className="mk-note">Reading RBI's rates and the World Bank's figures…</p></section>;
  if (d.failed || (!d.rates && !d.flows?.length && !d.worldBank)) return null;
  const r = d.rates, c = r?.curve, flows = d.flows ?? [], last = flows.at(-1), wb = d.worldBank;
  const tenYear = c?.points.find(p => Math.round(p.years) === 10);
  const kept = Math.min(30, flows.length);
  const sum = flows.slice(-kept).reduce((a, f) => ({ fii: a.fii + (f.fii ?? 0), dii: a.dii + (f.dii ?? 0) }), { fii: 0, dii: 0 });
  return (
    <section className="mk-card ec" aria-labelledby="mk-eco">
      <div className="mk-card-h"><h2 id="mk-eco">India's economy</h2></div>

      {r && (
        <div className="ec-block">
          <h3>Interest rates</h3>
          <div className="ec-rates">
            <div className="ec-big"><small>RBI's repo rate</small><b>{pc(r.repo)}</b><span>What banks pay to borrow from RBI; it sets the cost of loans.</span></div>
            <div className="ec-chips">
              {tenYear && <span>10-year government bond <b>{pc(tenYear.yield)}</b></span>}
              {r.crr != null && <span>CRR <b>{pc(r.crr)}</b></span>}
              {r.slr != null && <span>SLR <b>{pc(r.slr)}</b></span>}
              {r.callLow != null && <span>Call money <b>{r.callLow.toFixed(2)}–{pc(r.callHigh)}</b></span>}
            </div>
          </div>
          {c && <>
            <h3 className="ec-sub">What the government pays to borrow, 3 months to 30 years</h3>
            <Curve curve={c} />
            <p className={`ec-verdict${c.inverted ? " warn" : ""}`}>
              {c.inverted
                ? "Inverted: somewhere along the curve a longer loan pays less than a shorter one — often read as markets expecting rates to fall or growth to slow."
                : `Normal: longer loans pay more — ${pc(c.points.at(-1).yield)} for ${long(c.points.at(-1))} against ${pc(c.points[0].yield)} for ${long(c.points[0])}.`}
            </p>
          </>}
          <p className="ec-src">Source: RBI{r.asOn ? `; bond yields as on ${r.asOn}` : ""}; Treasury Bills at the last auction's cut-off.{r.stale ? " RBI's page couldn't be read since; the last figures read." : ""}</p>
        </div>
      )}

      {last && (
        <div className="ec-block">
          <h3>Who bought and sold shares, {dayOf(last.iso)}</h3>
          <div className="ec-flows">
            <div><small>Foreign investors (FII/FPI)</small><b className={last.fii >= 0 ? "up" : "down"}>{cr(last.fii)}</b><span>bought ₹{Math.round(last.fiiBuy).toLocaleString("en-IN")} cr, sold ₹{Math.round(last.fiiSell).toLocaleString("en-IN")} cr</span></div>
            <div><small>Indian institutions (DII)</small><b className={last.dii >= 0 ? "up" : "down"}>{cr(last.dii)}</b><span>bought ₹{Math.round(last.diiBuy).toLocaleString("en-IN")} cr, sold ₹{Math.round(last.diiSell).toLocaleString("en-IN")} cr</span></div>
          </div>
          {kept >= 5 && <p className="ec-src">Over the last {kept} trading days: foreign {cr(sum.fii)}, Indian institutions {cr(sum.dii)}.</p>}
          <p className="ec-src">Source: NSE, the cash market; net is bought less sold.</p>
        </div>
      )}

      {wb?.indicators?.length > 0 && (
        <div className="ec-block">
          <h3>The economy, year by year</h3>
          <ul className="ec-tiles">
            {wb.indicators.flatMap(ind => {
              const now = ind.years.at(-1), before = ind.years.at(-2), isOpen = open === ind.key;
              return [
                <li key={ind.key}>
                  <button type="button" className={`ec-tile${isOpen ? " on" : ""}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : ind.key)}>
                    <small>{ind.label} · {now.year}</small>
                    <b>{fmt(ind, now.value)}</b>
                    {before && <span className="ec-was">{fmt(ind, before.value)} in {before.year}</span>}
                    <Bars years={ind.years} />
                  </button>
                </li>,
                // its years, across the row under it (the grid fills the gap beside it)
                isOpen && <li key={`${ind.key}-about`} className="ec-about"><YearChart ind={ind} /></li>,
              ];
            })}
          </ul>
          <p className="ec-src">Source: World Bank, World Development Indicators (CC BY 4.0), calendar years{wb.updated ? `, updated ${wb.updated}` : ""}. Tap a figure for its chart.</p>
        </div>
      )}
    </section>
  );
}
