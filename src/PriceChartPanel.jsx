import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "./api.js";

// Ported from stock-screener's src/components/PriceChartPanel.jsx — same
// ranges, drawing, crosshair and phone sizing. Only the data call differs.

const MONO = { fontFamily: '"SF Mono","SFMono-Regular",Menlo,monospace', fontVariantNumeric: "tabular-nums" };

const RANGES = [
  { id: "1mo", label: "1M" },
  { id: "6mo", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "5y", label: "5Y" },
  { id: "max", label: "Max" },
];

const FALLBACK_W = 720, PAD_L = 8, PAD_R = 8, PAD_T = 14;

function fmtRs(n) {
  if (n == null) return "—";
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: n < 100 ? 2 : 0 });
}

function fmtDate(d) {
  const [y, m, day] = (d || "").split("-").map(Number);
  if (!y) return d;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, day, 12)));
}

export default function PriceChartPanel({ symbol, name }) {
  const [range, setRange] = useState("1y");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);
  const wrapRef = useRef(null);

  // Drawn in real pixels, not one fixed canvas scaled down: on a 375px phone
  // that scaling made the 9px axis labels about 4px. One SVG unit = one CSS px.
  const [boxW, setBoxW] = useState(FALLBACK_W);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setBoxW(prev => (prev === w ? prev : w));
    };
    measure();
    // Both: the observer catches the container changing on its own, the window
    // listener covers resizes where the observer has stayed silent.
    let ro;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(measure); ro.observe(el); }
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  const W = boxW;
  const narrow = W < 480;
  const H = narrow ? 240 : 220;
  const PAD_B = narrow ? 26 : 22;
  const fsAxis = narrow ? 11 : 9;
  const fsTipDate = narrow ? 11 : 10;
  const fsTipVal = narrow ? 14 : 12;
  const tipW = narrow ? 136 : 128;
  const tipH = narrow ? 42 : 34;
  const dotR = narrow ? 6 : 5;

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setHoverIdx(null);
    api.prices(symbol, range)
      .then(j => { if (!cancelled) setData(j); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, range]);

  const view = useMemo(() => {
    const bars = data?.bars ?? [];
    if (bars.length < 2) return null;
    const closes = bars.map(b => b.close);
    const min = Math.min(...closes), max = Math.max(...closes);
    const span = (max - min) || 1;
    const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
    const x = i => PAD_L + (i / (bars.length - 1)) * plotW;
    const y = v => PAD_T + (1 - (v - min) / span) * plotH;
    const line = bars.map((b, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(b.close).toFixed(1)}`).join(" ");
    const area = `${line} L${x(bars.length - 1).toFixed(1)},${(H - PAD_B).toFixed(1)} L${PAD_L},${(H - PAD_B).toFixed(1)} Z`;
    const first = closes[0], last = closes[closes.length - 1];
    return { bars, x, y, line, area, min, max, changePct: ((last - first) / first) * 100 };
  }, [data, W, H, PAD_B]);

  // Touch reports position under e.touches, not on the event itself
  const onMove = e => {
    if (!view || !svgRef.current) return;
    const clientX = e.touches?.length ? e.touches[0].clientX : e.clientX;
    if (clientX == null) return;
    const r = svgRef.current.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    const frac = Math.min(1, Math.max(0, (px - PAD_L) / (W - PAD_L - PAD_R)));
    setHoverIdx(Math.round(frac * (view.bars.length - 1)));
  };

  const hovered = view && hoverIdx != null ? view.bars[hoverIdx] : null;
  const up = view ? view.changePct >= 0 : true;
  const rangeLabel = RANGES.find(r => r.id === range)?.label;

  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--s2)", padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
          Share price
          {data?.symbol && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 8 }}>{data.symbol}</span>}
        </div>
        {view && (
          // The sign carries the direction too, so it's never colour alone
          <div style={{ fontSize: 13, fontWeight: 700, color: up ? "var(--green)" : "var(--red)", ...MONO }}>
            {up ? "+" : "−"}{Math.abs(view.changePct).toFixed(1)}%
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 6 }}>over {rangeLabel}</span>
          </div>
        )}
      </div>

      <div ref={wrapRef}>
        {loading && <div style={{ height: H, display: "flex", alignItems: "center", color: "var(--t3)", fontSize: 12 }}>Loading price history…</div>}

        {error && !loading && (
          <div style={{ height: H, display: "flex", alignItems: "center", color: "var(--t3)", fontSize: 12, lineHeight: 1.6 }}>
            No price history available for this symbol. {error}
          </div>
        )}

        {!loading && !error && !view && (
          <div style={{ height: H, display: "flex", alignItems: "center", color: "var(--t3)", fontSize: 12 }}>
            Not enough trading days in this range to draw a chart.
          </div>
        )}

        {!loading && view && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair", touchAction: "pan-y" }}
            onMouseMove={onMove}
            onMouseLeave={() => setHoverIdx(null)}
            onTouchStart={onMove}
            onTouchMove={onMove}
            onTouchEnd={() => setHoverIdx(null)}
            onTouchCancel={() => setHoverIdx(null)}
            role="img"
            aria-label={`${name || symbol} price over ${rangeLabel}, ${up ? "up" : "down"} ${Math.abs(view.changePct).toFixed(1)} percent`}
          >
            <defs>
              <linearGradient id="pcFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.20" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Recessive gridlines — for reading values, never competing with the data */}
            {[0, 0.5, 1].map(t => {
              const yy = PAD_T + t * (H - PAD_T - PAD_B);
              const val = view.max - t * (view.max - view.min);
              return (
                <g key={t}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={yy} y2={yy} stroke="var(--bdr)" strokeWidth="1" />
                  {/* Surface-coloured halo keeps the label off the line */}
                  <text x={PAD_L + 2} y={yy - 3} fontSize={fsAxis} fill="var(--t3)" stroke="var(--s2)" strokeWidth="3" paintOrder="stroke" style={MONO}>{fmtRs(val)}</text>
                </g>
              );
            })}

            <path d={view.area} fill="url(#pcFill)" />
            <path d={view.line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

            <text x={PAD_L} y={H - 6} fontSize={fsAxis} fill="var(--t3)" style={MONO}>{fmtDate(view.bars[0].date)}</text>
            <text x={W - PAD_R} y={H - 6} fontSize={fsAxis} fill="var(--t3)" textAnchor="end" style={MONO}>{fmtDate(view.bars.at(-1).date)}</text>

            {hovered && (
              <g pointerEvents="none">
                <line x1={view.x(hoverIdx)} x2={view.x(hoverIdx)} y1={PAD_T} y2={H - PAD_B} stroke="var(--t3)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={view.x(hoverIdx)} cy={view.y(hovered.close)} r={dotR} fill="var(--accent)" stroke="var(--s2)" strokeWidth="2" />
                <g transform={`translate(${Math.min(W - tipW - 4, Math.max(4, view.x(hoverIdx) - tipW / 2))}, ${PAD_T + 2})`}>
                  <rect width={tipW} height={tipH} rx="7" fill="var(--s3)" stroke="var(--bdr2)" />
                  <text x="8" y={narrow ? 17 : 14} fontSize={fsTipDate} fill="var(--t3)" style={MONO}>{fmtDate(hovered.date)}</text>
                  <text x="8" y={narrow ? 34 : 27} fontSize={fsTipVal} fontWeight="700" fill="var(--t1)" style={MONO}>{fmtRs(hovered.close)}</text>
                </g>
              </g>
            )}
          </svg>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {RANGES.map(r => (
          <button key={r.id} onClick={() => setRange(r.id)} style={{
            // 36px on a phone: below about 32 these are hard to hit with a thumb
            height: narrow ? 36 : 28, padding: narrow ? "0 16px" : "0 12px",
            borderRadius: 8, fontSize: narrow ? 13 : 11, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${range === r.id ? "var(--accent)" : "var(--bdr2)"}`,
            background: range === r.id ? "rgba(0,224,190,0.08)" : "var(--s3)",
            color: range === r.id ? "var(--accent)" : "var(--t2)",
            transition: "all 120ms",
          }}>{r.label}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--t3)", alignSelf: "center" }}>Daily closes · Yahoo Finance</span>
      </div>
    </div>
  );
}
