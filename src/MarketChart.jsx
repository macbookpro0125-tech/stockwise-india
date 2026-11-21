import { useEffect, useRef } from "react";
import { createChart, AreaSeries, ColorType } from "lightweight-charts";

// The market's last year, large, as the first thing in the summary. Our own
// index history: the Nifty 50's closes, from the Markets index data.
export default function MarketChart({ closes }) {
  const host = useRef(null);
  useEffect(() => {
    if (!host.current || !(closes?.length > 1)) return undefined;
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const up = closes.at(-1)[1] >= closes[0][1], line = v(up ? "--green" : "--red");
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "rgba(0, 0, 0, 0)" }, textColor: v("--t3"), fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false }, localization: { locale: "en-IN", priceFormatter: p => Math.round(p).toLocaleString("en-IN") },
      handleScroll: false, handleScale: false,
    });
    // plain rgba: chart drawing can't rely on color-mix() (the line vanished in Safari)
    const m = /^#([0-9a-f]{6})$/i.exec(line), n = m ? parseInt(m[1], 16) : 0x808080;
    const fill = `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0.22)`, none = `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
    const series = chart.addSeries(AreaSeries, { lineColor: line, lineWidth: 2, topColor: fill, bottomColor: none, priceLineVisible: false });
    series.setData(closes.map(([time, value]) => ({ time, value })));
    chart.timeScale().fitContent();
    // the whole year across the box, whatever its width becomes (it was left
    // squeezed to one side when the window changed size)
    const ro = new ResizeObserver(() => chart.timeScale().fitContent());
    ro.observe(host.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [closes]);
  return <div ref={host} className="td-chart" role="img" aria-label="The Nifty 50 over the last year" />;
}
