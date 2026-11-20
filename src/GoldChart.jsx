import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, AreaSeries, LineSeries, CandlestickSeries, ColorType, CrosshairMode } from "lightweight-charts";
import { api } from "./api.js";

// The gold page's chart (20 Nov 2026, the owner: "can I show the gold
// chart?"): gold or silver on its own, through the ETF that tracks it
// (GOLDBEES, SILVERBEES: NSE's daily prices), gold shown as ₹ for 10 grams of
// 24 carat; or gold, silver and the Nifty 50 together as ₹100 put in at the
// start of the range.
// 20 Nov 2026, the owner: "why is the gold chart that simple, not like a
// regular chart, and no 5 years back": now a regular chart — line or candles,
// drag and pinch to move and zoom, the price and date where you point, the
// range's high and low — and gold back ten years (server/etf-history-old.json).

const RANGES = [["1M", 1], ["6M", 6], ["1Y", 12], ["3Y", 36], ["5Y", 60], ["10Y", 120], ["All", null]];
const MODES = [["gold", "Gold"], ["silver", "Silver"], ["compare", "Gold vs silver vs Nifty"]];
const COLOURS = { Gold: "#D4A017", Silver: "#94A3B8", "Nifty 50": null };
const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const signed = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
const monthsBack = (to, m) => { const f = new Date(`${to}T00:00:00Z`); f.setUTCMonth(f.getUTCMonth() - m); return f.toISOString().slice(0, 10); };
const firstFrom = (days, iso) => { const i = days.findIndex(d => d >= iso); return i < 0 ? days.length - 1 : i; };

export default function GoldChart() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("gold");
  const [range, setRange] = useState("1Y");
  const [kind, setKind] = useState(() => { try { return localStorage.getItem("gc-kind") === "candles" ? "candles" : "line"; } catch { return "line"; } });
  const [tip, setTip] = useState(null);
  const [span, setSpan] = useState(null); // the days in view: [first index, last index]
  const host = useRef(null);
  useEffect(() => { api.publicGoldSilverChart().then(setData).catch(() => setData({ series: [] })); }, []);
  // RBI's gram price (server/rbi-gold.js), to turn the gold ETF's price into
  // gold's: ₹101 a GOLDBEES unit meant nothing to anyone
  const [gram, setGram] = useState(null);
  useEffect(() => { api.publicGoldSilver().then(d => setGram(d?.gram ?? null)).catch(() => {}); }, []);
  // ₹ for 10 g of 24 carat per rupee of GOLDBEES: RBI's price against the
  // ETF's average close on the three days RBI averaged
  const tenGram = useMemo(() => {
    const gb = data?.series?.find(x => x.symbol === "GOLDBEES");
    if (!gb || !gram?.price || !gram.days?.length) return null;
    const closes = gram.days.map(d => gb.closes[gb.days.indexOf(d)]).filter(c => c > 0);
    return closes.length === gram.days.length ? (gram.price * 10) / (closes.reduce((a, c) => a + c, 0) / closes.length) : null;
  }, [data, gram]);
  const asGold = mode === "gold" && tenGram != null;
  const compare = mode === "compare";
  const pickKind = k => { setKind(k); try { localStorage.setItem("gc-kind", k); } catch { /* private window */ } };

  const to = data?.to ?? data?.series?.[0]?.days.at(-1);
  const months = RANGES.find(r => r[0] === range)[1];
  // a range is offered when every series in the view reaches back that far
  const reaches = (s, m) => m == null || s.days[0] <= new Date(Date.parse(`${monthsBack(to, m)}T00:00:00Z`) + 10 * 864e5).toISOString().slice(0, 10);
  const inView = useMemo(() => (data?.series ?? []).filter(s => (compare ? true : s.label.toLowerCase() === mode)), [data, mode, compare]);
  const ok = r => inView.length > 0 && inView.every(s => reaches(s, r[1]));
  // today's price after the last close, while the market is open (or since it closed, before the evening's data)
  const withLive = s => {
    const l = data?.live?.[s.symbol];
    if (!(l && l.date > s.days.at(-1))) return s;
    const p = l.price;
    return { ...s, days: [...s.days, l.date], opens: [...(s.opens ?? []), p], highs: [...(s.highs ?? []), p], lows: [...(s.lows ?? []), p], closes: [...s.closes, p], liveAt: l.at };
  };
  // one view's series. Alone: every day kept (the range is what's in view, and
  // you can drag back further); compared: cut to the range, from ₹100
  const lines = useMemo(() => (to ? inView.map(s => {
    let x = withLive(s);
    if (compare && months != null) { const i = firstFrom(x.days, monthsBack(x.days.at(-1), months)); x = { ...x, days: x.days.slice(i), closes: x.closes.slice(i), opens: null, highs: null, lows: null }; }
    const k = asGold && s.symbol === "GOLDBEES" ? tenGram : 1;
    const m = arr => arr?.map(v => (v == null ? null : v * k)) ?? null;
    return { ...x, opens: m(x.opens), highs: m(x.highs), lows: m(x.lows), closes: m(x.closes) };
  }).filter(s => s.days.length > 1) : []), [inView, months, to, data, asGold, tenGram, compare]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (data && !ok(RANGES.find(r => r[0] === range))) { const best = [...RANGES].reverse().find(r => r[1] != null && ok(r)); if (best) setRange(best[0]); } }, [data, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const candles = kind === "candles" && !compare && !!lines[0]?.opens?.every(v => v > 0);

  useEffect(() => {
    if (!host.current || !lines.length) return undefined;
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const hex = (raw, fb) => (/^#[0-9a-f]{6}$/i.test(raw) ? raw : fb);
    const money = p => (compare ? `₹${Math.round(p)}` : p >= 1000 ? `₹${Math.round(p).toLocaleString("en-IN")}` : `₹${p.toFixed(2)}`);
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "rgba(0, 0, 0, 0)" }, textColor: v("--t3"), fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: v("--bdr") } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderVisible: false, rightOffset: 3, minBarSpacing: 0.3 },
      crosshair: { mode: CrosshairMode.Normal, horzLine: { style: 3, color: v("--bdr2"), labelBackgroundColor: "#475569" }, vertLine: { style: 3, color: v("--bdr2"), labelBackgroundColor: "#475569" } },
      localization: { locale: "en-IN", priceFormatter: money },
      // drag sideways and pinch to move and zoom, as any chart; a finger
      // moving up and down still scrolls the page, and a mouse wheel too
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: { time: true, price: false }, axisDoubleClickReset: true },
    });
    const made = lines.map(s => {
      const colour = hex(COLOURS[s.label] ?? v("--accent"), "#2563eb");
      const base = s.closes[0];
      const values = compare ? s.closes.map(c => (c / base) * 100) : s.closes;
      let series;
      if (compare) series = chart.addSeries(LineSeries, { color: colour, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
      else if (candles) {
        const up = hex(v("--green"), "#16a34a"), down = hex(v("--red"), "#dc2626");
        series = chart.addSeries(CandlestickSeries, { upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down, priceLineVisible: false });
        series.setData(s.days.map((time, i) => ({ time, open: s.opens[i], high: s.highs[i], low: s.lows[i], close: s.closes[i] })));
        return { s, values };
      } else {
        const n = parseInt(colour.slice(1), 16), rgba = a => `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
        series = chart.addSeries(AreaSeries, { lineColor: colour, lineWidth: 2, topColor: rgba(0.25), bottomColor: rgba(0), priceLineVisible: false, lastValueVisible: true });
      }
      series.setData(s.days.map((time, i) => ({ time, value: values[i] })));
      return { s, values };
    });
    chart.subscribeCrosshairMove(p => {
      if (!p?.time || !p.point || p.point.x < 0) { setTip(null); return; }
      setTip({ x: p.point.x, date: p.time, rows: made.map(({ s, values }) => { const i = s.days.indexOf(p.time); return { label: s.label, value: values[i], o: s.opens?.[i], h: s.highs?.[i], l: s.lows?.[i] }; }).filter(r => r.value != null) });
    });
    // what's in view, for the change, high and low over it
    const days = lines[0].days;
    const onRange = r => {
      if (!r) return;
      const a = Math.max(0, Math.ceil(r.from)), b = Math.min(days.length - 1, Math.floor(r.to));
      setSpan(b > a ? [a, b] : null);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    // the range picked: its days in view (when compared, the series is cut to it already)
    if (compare || months == null) chart.timeScale().fitContent();
    else {
      const from = firstFrom(days, monthsBack(days.at(-1), months));
      chart.timeScale().setVisibleLogicalRange({ from: from - 0.5, to: days.length - 1 + 3 });
    }
    return () => { chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange); chart.remove(); };
  }, [lines, mode, asGold, candles, months, compare]);

  if (!data) return <div className="gc-chart gc-wait" aria-label="Loading the chart" />;
  if (!data.series.length) return null;
  const w = host.current?.clientWidth ?? 0;
  const s0 = lines[0];
  const [a, b] = !compare && span && s0 && span[1] < s0.days.length ? span : [0, (s0?.days.length ?? 1) - 1];
  const fmt = p => (p >= 1000 ? `₹${Math.round(p).toLocaleString("en-IN")}` : `₹${p.toFixed(2)}`);
  // the high and low in view, alone
  let hi = null, lo = null;
  if (s0 && !compare) for (let i = a; i <= b; i++) {
    const h = s0.highs?.[i] ?? s0.closes[i], l = s0.lows?.[i] ?? s0.closes[i];
    if (h > 0 && (!hi || h > hi.v)) hi = { v: h, d: s0.days[i] };
    if (l > 0 && (!lo || l < lo.v)) lo = { v: l, d: s0.days[i] };
  }
  return (
    <section className="gs-card gc">
      <div className="gc-modes" role="tablist" aria-label="Chart">
        {MODES.map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={mode === id} className={mode === id ? "on" : ""} onClick={() => setMode(id)}>{l}</button>)}
      </div>
      <div className="gc-legend">
        {lines.map(s => {
          const first = s.closes[a], last = s.closes[b];
          const move = (last / first - 1) * 100;
          return (
            <span key={s.label}>
              <i style={{ background: COLOURS[s.label] ?? "var(--accent)" }} />
              {compare ? s.label : asGold
                ? <><b>₹{Math.round(last).toLocaleString("en-IN")}</b> <span className="gc-unit">10 g, 24 carat</span></>
                : <b>₹{last.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>}
              {" "}<em className={move >= 0 ? "up" : "down"}>{signed(move)}</em>
            </span>
          );
        })}
        <small>{s0 ? `${day(s0.days[a])} – ${day(s0.days[b])}${b === s0.days.length - 1 ? (s0.liveAt ? `, today's price at ${(([h, mi]) => `${Number(h) % 12 || 12}:${mi} ${Number(h) < 12 ? "am" : "pm"}`)(s0.liveAt.split(":"))}` : ", the last close") : ""}` : ""}</small>
        {hi && lo && <small className="gc-hilo">High {fmt(hi.v)} on {day(hi.d)} · Low {fmt(lo.v)} on {day(lo.d)}</small>}
      </div>
      <div className="gc-wrap">
        <div ref={host} className="gc-chart" role="img" aria-label={compare ? "Gold, silver and the Nifty 50, ₹100 put in at the start" : `${mode}'s price`} />
        {tip && (
          <div className="mk-chart-tip" style={{ left: Math.min(Math.max(tip.x - 90, 0), Math.max(0, w - 190)) }}>
            <span className="mk-chart-tip-d">{day(tip.date)}</span>
            {tip.rows.map(r => <span key={r.label} className="mk-chart-tip-b">{compare ? `${r.label}: ₹${Math.round(r.value)}` : candles && r.o ? `Open ${fmt(r.o)} · High ${fmt(r.h)} · Low ${fmt(r.l)} · Close ${fmt(r.value)}` : asGold ? `₹${Math.round(r.value).toLocaleString("en-IN")} for 10 g` : fmt(r.value)}</span>)}
          </div>
        )}
      </div>
      <div className="gc-bar">
        <div className="gc-ranges" role="group" aria-label="Range">
          {RANGES.map(r => <button key={r[0]} type="button" aria-pressed={range === r[0]} disabled={!ok(r)} onClick={() => setRange(r[0])}>{r[0]}</button>)}
        </div>
        {!compare && (
          <div className="gc-kind" role="group" aria-label="Chart type">
            {[["line", "Line"], ["candles", "Candles"]].map(([id, l]) => <button key={id} type="button" aria-pressed={(id === "candles") === candles} onClick={() => pickKind(id)}>{l}</button>)}
          </div>
        )}
      </div>
      <p className="gs-note">
        {compare
          ? "₹100 put in at the start of the range, through GOLDBEES, SILVERBEES and NIFTYBEES (after the funds' costs). The silver ETF began trading in 2022, so this goes back as far as that."
          : asGold
            ? `The price of 10 grams of 24-carat gold, estimated: the gold ETF GOLDBEES's daily price, matched to RBI's ₹${gram.price.toLocaleString("en-IN")} a gram for ${day(gram.redeemOn)}. Over years it may read up to about 1% a year high, the fund's costs. A jeweller adds making charges and 3% GST.`
            : mode === "silver"
              ? "The price of one unit of SILVERBEES, the largest silver ETF (a fund on NSE that holds silver), not of a gram: it moves as silver's price does. It began trading in 2022."
              : "The price of one unit of GOLDBEES, the largest gold ETF (a fund on NSE that holds gold), not of a gram: it moves as gold's price does."}
        {" "}Drag the chart sideways to go back, pinch to zoom. NSE's daily prices; before Oct 2021 from NSE's archived daily files, on today's unit.
      </p>
    </section>
  );
}
