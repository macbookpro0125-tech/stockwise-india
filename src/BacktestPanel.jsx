import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, LineSeries, ColorType } from "lightweight-charts";
import { api } from "./api.js";
import { RULES, STOPS, backtest } from "./backtest.js";

// "How would a rule have done?" on a company's Price tab (20 Nov 2026, the
// owner, from a rival's list: backtesting). Pick a rule, a stop-loss and a
// period; every trade the rule would have made on this company's own daily
// prices, against simply holding the shares (src/backtest.js). Loaded when
// it's opened; the past, not a forecast or advice.

const PERIODS = [["1Y", 1], ["3Y", 3], ["5Y", 5], ["All", 99]];
const signed = (v, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}%`);
const tone = v => (v == null ? "" : v >= 0 ? "up" : "down");
const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });
const rs = v => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: v >= 1000 ? 0 : 2 })}`;

function Curves({ result }) {
  const host = useRef(null);
  useEffect(() => {
    if (!host.current) return undefined;
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const hex = (raw, fb) => (/^#[0-9a-f]{6}$/i.test(raw) ? raw : fb);
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "rgba(0,0,0,0)" }, textColor: v("--t3"), fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: v("--bdr") } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false },
      crosshair: { horzLine: { visible: false, labelVisible: false }, vertLine: { labelVisible: false, style: 3, color: v("--bdr2") } },
      localization: { locale: "en-IN", priceFormatter: p => `₹${Math.round(p)}` },
      handleScroll: false, handleScale: false,
    });
    chart.addSeries(LineSeries, { color: hex(v("--t3"), "#94a3b8"), lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(result.hold.map(p => ({ time: p.date, value: p.value })));
    chart.addSeries(LineSeries, { color: hex(v("--accent"), "#2563eb"), lineWidth: 2, priceLineVisible: false, lastValueVisible: false }).setData(result.curve.map(p => ({ time: p.date, value: p.value })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [result]);
  return <div ref={host} className="bt-chart" role="img" aria-label="₹100 following the rule, against ₹100 held" />;
}

export default function BacktestPanel({ symbol }) {
  const [bars, setBars] = useState(null);
  const [failed, setFailed] = useState(false);
  const [rule, setRule] = useState("ma");
  const [n, setN] = useState(50);
  const [stop, setStop] = useState(0);
  const [period, setPeriod] = useState("5Y");
  const [all, setAll] = useState(false);
  useEffect(() => {
    let off = false;
    setBars(null); setFailed(false);
    api.prices(symbol, "max").then(d => { if (!off) setBars(d?.bars ?? []); }).catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [symbol]);
  const def = RULES.find(r => r.id === rule);
  useEffect(() => { const p = def.params[0]; if (p && !p[2].includes(n)) setN(p[3]); }, [rule]); // eslint-disable-line react-hooks/exhaustive-deps

  const years = bars?.length ? (Date.parse(bars.at(-1).date) - Date.parse(bars[0].date)) / (365.25 * 864e5) : 0;
  const from = useMemo(() => {
    if (!bars?.length) return null;
    const y = PERIODS.find(p => p[0] === period)[1];
    if (y >= 99) return null;
    const d = new Date(`${bars.at(-1).date}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - y);
    return d.toISOString().slice(0, 10);
  }, [bars, period]);
  const result = useMemo(() => (bars ? backtest(bars, { rule, n, stop, from }) : null), [bars, rule, n, stop, from]);

  if (failed) return <p className="bt-note">Its prices couldn't be loaded just now.</p>;
  if (!bars) return <p className="bt-note">Loading its daily prices…</p>;
  if (!result) return <p className="bt-note">Not enough price history here to test a rule.</p>;
  const trades = [...result.trades].reverse();
  const beat = result.total - result.holdTotal;
  return (
    <div className="bt">
      <div className="bt-controls">
        <label>Rule<select value={rule} onChange={e => setRule(e.target.value)}>{RULES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
        {def.params.map(([, label, options]) => <label key={label}>{label}<select value={n} onChange={e => setN(Number(e.target.value))}>{options.map(o => <option key={o} value={o}>{rule === "rsi" ? o : `${o} days`}</option>)}</select></label>)}
        <label>Stop-loss<select value={stop} onChange={e => setStop(Number(e.target.value))}>{STOPS.map(s => <option key={s} value={s}>{s ? `${s}% under the entry` : "None"}</option>)}</select></label>
      </div>
      <div className="bt-periods" role="group" aria-label="Period">
        {PERIODS.map(([id, y]) => <button key={id} type="button" aria-pressed={period === id} disabled={y < 99 && years < y - 0.05} onClick={() => setPeriod(id)}>{id}</button>)}
      </div>
      <p className="bt-rule">{def.about(n)}{stop ? ` Out during the day if it falls ${stop}% under the entry price.` : ""}</p>

      <div className="bt-tiles">
        <div><small>Following the rule</small><b className={tone(result.total)}>{signed(result.total)}</b>{result.perYear != null && <span>{signed(result.perYear)} a year</span>}</div>
        <div><small>Just holding</small><b className={tone(result.holdTotal)}>{signed(result.holdTotal)}</b>{result.holdPerYear != null && <span>{signed(result.holdPerYear)} a year</span>}</div>
        <div><small>Trades · won</small><b>{result.trades.length}{result.winRate != null ? ` · ${Math.round(result.winRate)}%` : ""}</b><span>{result.avgWin != null ? `avg win ${signed(result.avgWin)}` : ""}{result.avgLoss != null ? `, loss ${signed(result.avgLoss)}` : ""}</span></div>
        <div><small>Worst fall</small><b className="down">{signed(result.maxDrop)}</b><span>holding: {signed(result.holdMaxDrop)}</span></div>
      </div>
      <p className="bt-verdict">
        {day(result.from)} – {day(result.to)}: the rule {beat >= 0 ? "did better than" : "did worse than"} holding by {Math.abs(beat).toFixed(1)} points, invested {Math.round(result.inMarketPct)}% of the time.
        {result.openTrade && ` Still in, since ${day(result.openTrade.entryDate)} at ${rs(result.openTrade.entryPrice)} (${signed(result.openTrade.pct)}).`}
      </p>
      <Curves result={result} />
      <p className="bt-legend"><i className="rule" /> ₹100 following the rule <i className="hold" /> ₹100 held</p>

      {trades.length > 0 && (
        <details className="bt-trades" open={all} onToggle={e => setAll(e.currentTarget.open)}>
          <summary>Every trade ({trades.length})</summary>
          <table>
            <thead><tr><th>In</th><th>Out</th><th>Days</th><th>Result</th></tr></thead>
            <tbody>
              {trades.map(t => (
                <tr key={t.entryDate + t.exitDate}>
                  <td>{day(t.entryDate)}<small>{rs(t.entryPrice)}</small></td>
                  <td>{day(t.exitDate)}<small>{rs(t.exitPrice)}{t.why === "stop" ? " · stop" : ""}</small></td>
                  <td>{t.days}</td>
                  <td className={tone(t.pct)}>{signed(t.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <p className="bt-note">The rule is read on each day's close and traded at the next day's open, on NSE's daily prices adjusted for splits and bonuses. 0.1% comes off each entry and exit for costs; tax and dividends are left out. The past, not a forecast — and not advice to buy or sell.</p>
    </div>
  );
}
