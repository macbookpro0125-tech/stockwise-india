import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, LineSeries, ColorType, LineStyle } from "lightweight-charts";
import { X, Plus, Check } from "lucide-react";
import { api } from "./api.js";
import { cardName } from "./stockName.js";

// The results tracker (21 Nov 2026, the owner: "from the results day, add
// stocks to the Desk and track them like a chart"; server/results-tracks.js):
// a Track button on each results row, and a Desk card that follows every
// tracked company from its results day's close for 60 days — the move, the
// Nifty 500's over the same days, the quarter's figures — and draws them all
// from 100 on one chart.

// One copy of the tracker for the page, shared by every button and the card
let state = null; // { tracks, benchmark, index, trackDays } once read
let loading = null;
const listeners = new Set();
const publish = d => { state = d; listeners.forEach(f => f(d)); };
export function useTracker() {
  const [d, setD] = useState(state);
  useEffect(() => {
    listeners.add(setD);
    if (!state && !loading) loading = api.tracks().then(publish).catch(() => publish({ tracks: [], index: [] })).finally(() => { loading = null; });
    return () => listeners.delete(setD);
  }, []);
  return d;
}
const add = async symbol => publish(await api.addTrack(symbol));
const drop = async id => publish(await api.removeTrack(id));

// On a results row: Track, then Tracking ✓ (a second tap opens nothing; the Desk shows it)
export function TrackButton({ symbol, name }) {
  const d = useTracker();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const on = d?.tracks?.some(t => t.symbol === symbol);
  if (!d) return null;
  return (
    <button type="button" className={`trk-track${on ? " on" : ""}`} disabled={busy || on}
      title={on ? "On your results tracker (Desk)" : err || "Follow its price from these results, on your Desk"}
      aria-label={on ? `${cardName(name || symbol)} is on your results tracker` : `Track ${cardName(name || symbol)} from its results`}
      onClick={async e => { e.stopPropagation(); setBusy(true); setErr(""); try { await add(symbol); } catch (x) { setErr(x.message); } finally { setBusy(false); } }}>
      {on ? <Check size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}{on ? "Tracking" : busy ? "…" : "Track"}
    </button>
  );
}

const COLOURS = ["#3E8BFF", "#00C2A8", "#F59E0B", "#A86BFF", "#EF4444", "#22C55E", "#EC4899", "#14B8A6", "#F97316", "#6366F1"];
const pct = v => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`);
const tone = v => (v == null ? "" : v >= 0 ? "up" : "down");
const day = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "—");
const SORTS = [["results", "Results day"], ["move", "Since results"], ["vs", "vs Nifty 500"]];

// The Desk card. onPick: turn the Desk's chart card to a company
export function TrackerCard({ onPick, picked }) {
  const d = useTracker();
  const [sort, setSort] = useState("results");
  const [show, setShow] = useState("live"); // live | finished
  const tracks = d?.tracks ?? [];
  const live = tracks.filter(t => !t.finished), done = tracks.filter(t => t.finished);
  const list = useMemo(() => {
    const l = [...(show === "live" ? live : done)];
    const k = sort === "move" ? "pct" : sort === "vs" ? "vsNifty" : null;
    return k ? l.sort((a, b) => (b[k] ?? -1e9) - (a[k] ?? -1e9)) : l;
  }, [tracks, sort, show]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <p className="md-quiet">Loading your tracker…</p>;
  if (!tracks.length) {
    return <p className="md-quiet">Nothing tracked yet. On a results day (Markets → Results), press <b>Track</b> beside a company to follow its price from that day here, for {d.trackDays ?? 60} days.</p>;
  }
  const withMove = live.filter(t => t.pct != null);
  const up = withMove.filter(t => t.pct > 0).length;
  const avg = withMove.length ? withMove.reduce((a, t) => a + t.pct, 0) / withMove.length : null;
  const avgN = withMove.filter(t => t.niftyPct != null);
  const nifty = avgN.length ? avgN.reduce((a, t) => a + t.niftyPct, 0) / avgN.length : null;
  return (
    <div className="trk">
      {withMove.length > 0 && (
        <p className="trk-sum">
          Tracking <b>{live.length}</b>{done.length ? ` (${done.length} finished)` : ""}: <b>{up}</b> up since their results, on average <b className={tone(avg)}>{pct(avg)}</b>
          {nifty != null && <> against the {d.benchmark}'s <span className={tone(nifty)}>{pct(nifty)}</span> over the same days</>}.
        </p>
      )}
      <TrackChart tracks={list.slice(0, COLOURS.length)} index={d.index} benchmark={d.benchmark} picked={picked} />
      <div className="trk-bar">
        {done.length > 0 && (
          <span className="trk-seg" role="tablist" aria-label="Which">
            <button type="button" role="tab" aria-selected={show === "live"} onClick={() => setShow("live")}>Tracking {live.length}</button>
            <button type="button" role="tab" aria-selected={show === "finished"} onClick={() => setShow("finished")}>Finished {done.length}</button>
          </span>
        )}
        <label className="trk-sort">Sort <select value={sort} onChange={e => setSort(e.target.value)}>{SORTS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></label>
      </div>
      <div className="trk-table" role="table" aria-label="Tracked companies">
        <div className="trk-row trk-head" role="row"><span role="columnheader">Company</span><span role="columnheader">Results</span><span role="columnheader">Profit · sales</span><span role="columnheader">Since results</span><span role="columnheader">vs {d.benchmark}</span><span role="columnheader">Day</span><span /></div>
        {list.map((t, i) => (
          <div key={t.id} role="row" className={`trk-row${picked === t.symbol ? " on" : ""}`} onClick={() => onPick?.(t.symbol)}>
            <span role="cell" className="trk-co">{i < COLOURS.length && <i style={{ background: COLOURS[i] }} aria-hidden="true" />}<b>{cardName(t.name)}</b>{t.note && <small>{t.note}</small>}</span>
            <span role="cell">{t.quarter}<small>{day(t.resultsDate)}</small></span>
            <span role="cell">{t.profitCr != null && t.profitCr < 0 ? "Loss" : <span className={tone(t.profitYoY)}>{pct(t.profitYoY)}</span>}<small className={tone(t.salesYoY)}>{pct(t.salesYoY)}</small></span>
            <span role="cell" className={`trk-big ${tone(t.pct)}`}>{pct(t.pct)}<small>₹{t.base?.close?.toLocaleString("en-IN") ?? "—"} → ₹{t.last?.close?.toLocaleString("en-IN") ?? "—"}</small></span>
            <span role="cell" className={tone(t.vsNifty)}>{t.vsNifty == null ? "—" : `${t.vsNifty >= 0 ? "+" : "−"}${Math.abs(t.vsNifty).toFixed(1)} pts`}</span>
            <span role="cell">{t.finished ? "Done" : `${t.days} of ${d.trackDays}`}</span>
            <span role="cell"><button type="button" className="trk-x" aria-label={`Stop tracking ${cardName(t.name)}`} onClick={e => { e.stopPropagation(); drop(t.id).catch(() => {}); }}><X size={14} /></button></span>
          </div>
        ))}
      </div>
      <p className="md-quiet trk-foot">Each from its results day's close (₹100 there), for {d.trackDays} days; the {d.benchmark} over the same days, dotted. NSE daily closes. A record of what happened, not advice.</p>
    </div>
  );
}

// Every tracked company from 100 on its own results day, by trading days
// since then, the benchmark dotted (its average path over the same days)
function TrackChart({ tracks, index, benchmark, picked }) {
  const host = useRef(null);
  useEffect(() => {
    if (!host.current || !tracks.some(t => t.series.length > 1)) return undefined;
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "rgba(0,0,0,0)" }, textColor: v("--t3"), fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: v("--bdr") } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, tickMarkFormatter: t => `Day ${t}` },
      localization: { priceFormatter: p => Math.round(p).toString(), timeFormatter: t => `Day ${t} after results` },
      handleScroll: false, handleScale: false, crosshair: { horzLine: { labelVisible: false } },
    });
    // the x axis: trading days since the results (lightweight-charts wants a time: day numbers as seconds)
    const byDay = s => s.map(([, val], i) => ({ time: i, value: val }));
    tracks.forEach((t, i) => {
      if (t.series.length < 2) return;
      const s = chart.addSeries(LineSeries, { color: COLOURS[i], lineWidth: picked === t.symbol ? 3 : 2, priceLineVisible: false, lastValueVisible: false, title: "" });
      s.setData(byDay(t.series));
    });
    // the benchmark: its average path from each tracked company's results day
    const idx = new Map(index), dates = index.map(([dd]) => dd);
    const paths = tracks.filter(t => t.base).map(t => { const from = dates.indexOf(t.base.date); return from < 0 ? [] : dates.slice(from, from + t.series.length).map(dd => idx.get(dd)); }).filter(p => p.length > 1);
    if (paths.length) {
      const n = Math.max(...paths.map(p => p.length)), avg = [];
      for (let k = 0; k < n; k++) { const xs = paths.filter(p => p[k] != null).map(p => (p[k] / p[0]) * 100); if (xs.length) avg.push({ time: k, value: xs.reduce((a, x) => a + x, 0) / xs.length }); }
      const b = chart.addSeries(LineSeries, { color: v("--t3"), lineWidth: 2, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
      b.setData(avg);
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [tracks, index, picked]);
  return <div ref={host} className="trk-chart" role="img" aria-label={`Each tracked company from 100 on its results day, and the ${benchmark}`} />;
}
