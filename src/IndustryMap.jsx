import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { niceName } from "./stockName.js";
import { breadth, groupMove, squarify } from "./heatLayout.js";
import { fitLabel, heatColor, pct } from "./MarketMapView.jsx";

// A company page's map of its industry (31 Oct 2026): did it move alone, or
// with its neighbours? The industry's companies as boxes by market value,
// coloured by their move, this one outlined. An industry of fewer than three
// companies is shown as its sector instead.
const PERIODS = [["1d", "1D", 3, "the day"], ["1w", "1W", 6, "the week"], ["1m", "1M", 10, "the month"], ["1y", "1Y", 30, "the year"]];

export default function IndustryMap({ symbol, industry, sector, onOpenStock, onOpenMap }) {
  const [period, setPeriod] = useState("1d");
  const [data, setData] = useState(null);
  const [by, setBy] = useState(industry ? "industry" : "sector");
  const [width, setWidth] = useState(0);
  const box = useRef(null);
  const group = by === "industry" ? industry : sector;
  useEffect(() => { setBy(industry ? "industry" : "sector"); }, [industry]);
  useEffect(() => {
    if (!group) { setData({ items: [] }); return; }
    setData(null);
    api.heatmap("group", period, null, { [by]: group })
      .then(d => {
        // too few neighbours to say anything: the sector instead
        if (by === "industry" && d.items.length < 3 && sector) setBy("sector");
        else setData(d);
      })
      .catch(() => setData({ items: [] }));
  }, [group, by, period, sector]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const [, , limit, words] = PERIODS.find(([p]) => p === period);
  const height = width < 640 ? Math.round(width * 0.9) : 280;
  const items = useMemo(() => (data?.items ?? []).map(i => ({ ...i, cap: i.weight })), [data]);
  const tiles = useMemo(() => squarify(items, width, height), [items, width, height]);
  const me = items.find(i => i.symbol === symbol);
  const counts = breadth(items), move = groupMove(items);
  if (!group || (data && !items.length)) return null;
  return (
    <section className="im" aria-labelledby={`im-${symbol}`}>
      <div className="im-top">
        <h3 className="im-h" id={`im-${symbol}`}>{by === "industry" ? "Its industry" : "Its sector"}: {group}</h3>
        <div className="ex-ranges" role="group" aria-label="Over">
          {PERIODS.map(([p, l]) => <button key={p} type="button" className="ex-range" aria-pressed={period === p} onClick={() => setPeriod(p)}>{l}</button>)}
        </div>
      </div>
      {data && items.length > 1 && (
        <p className="im-line">
          Over {words}, <b className="up">{counts.up} rose</b> and <b className="down">{counts.down} fell</b> of {items.length}; together {pct(move)} by market value
          {me && <>, and {niceName(me.name ?? symbol)} <b className={me.change >= 0 ? "up" : "down"}>{pct(me.change)}</b>{Math.sign(me.change) !== Math.sign(move) && Math.abs(me.change) > 0.05 && Math.abs(move) > 0.05 ? ", against the run of its industry" : ""}</>}.
        </p>
      )}
      <div ref={box} className="ex-heat im-map" style={{ height }}>
        {data == null && <div className="ex-heat-wait" role="status">Drawing the map…</div>}
        {tiles.map(t => {
          const move1 = `${t.change > 0 ? "+" : ""}${t.change.toFixed(2)}%`;
          const { lines, up, size, named, moved } = fitLabel(t, t.symbol, move1);
          return (
            <button key={t.symbol} type="button" className={`ex-tile${Math.abs(t.change) / limit < 0.5 ? " pale" : ""}${t.symbol === symbol ? " im-me" : ""}`}
              aria-label={`${niceName(t.name ?? t.symbol)}, ${t.change >= 0 ? "up" : "down"} ${Math.abs(t.change).toFixed(2)}% over ${words}`}
              title={`${niceName(t.name ?? t.symbol)}: ${pct(t.change)}`}
              onClick={() => (t.symbol === symbol ? null : onOpenStock(t.symbol))}
              style={{ left: t.x, top: t.y, width: t.w, height: t.h, background: heatColor(t.change, limit) }}>
              {named && (
                <span className={`ex-tile-in${up ? " up" : ""}`}>
                  <span className="ex-tile-name" style={{ fontSize: size }}>{lines.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{l}</Fragment>)}</span>
                  {moved && <span className="ex-tile-chg" style={{ fontSize: Math.min(15, Math.max(size * 0.8, size >= 10 ? 8 : 0)) }}>{move1}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {onOpenMap && sector && (
        <button type="button" className="ex-heat-back im-more" onClick={() => onOpenMap({ sector, find: symbol })}>See it on the market map ›</button>
      )}
    </section>
  );
}
