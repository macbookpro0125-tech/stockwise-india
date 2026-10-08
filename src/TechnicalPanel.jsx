import { useState, useEffect } from "react";
import { api } from "./api.js";

// Ported from stock-screener's src/components/TechnicalPanel.jsx — only the
// data call differs (this app's /api/stock/:symbol/technicals).

function Sparkline({ prices }) {
  if (!prices?.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 120, H = 36;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - ((p - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = prices[prices.length - 1];
  const first = prices[0];
  const up = last >= first;
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={up ? "var(--green)" : "var(--red)"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color || "var(--t1)" }}>{value ?? "—"}</div>
    </div>
  );
}

function SummaryGauge({ summary }) {
  if (!summary) return null;
  const { bearish, neutral, bullish, total } = summary;
  const bPct = total > 0 ? (bearish / total) * 100 : 33;
  const nPct = total > 0 ? (neutral / total) * 100 : 34;
  const uPct = total > 0 ? (bullish / total) * 100 : 33;

  return (
    <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surf)", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>Summary</span>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
          background: summary.overall === "bullish" ? "var(--green-dim)" : summary.overall === "bearish" ? "var(--red-dim)" : "var(--yellow-dim)",
          color: summary.overall === "bullish" ? "var(--green)" : summary.overall === "bearish" ? "var(--red)" : "var(--yellow)",
        }}>
          {summary.overall === "bullish" ? "Bullish" : summary.overall === "bearish" ? "Bearish" : "Neutral"}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
        <span style={{ color: "var(--red)", fontWeight: 600 }}>{bearish} Bearish</span>
        <span style={{ color: "var(--t3)", fontWeight: 600 }}>{neutral} Neutral</span>
        <span style={{ color: "var(--green)", fontWeight: 600 }}>{bullish} Bullish</span>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 2 }}>
        <div style={{ width: `${bPct}%`, background: "var(--red)", borderRadius: "3px 0 0 3px", minWidth: bearish > 0 ? 4 : 0 }} />
        <div style={{ width: `${nPct}%`, background: "var(--t3)", minWidth: neutral > 0 ? 4 : 0 }} />
        <div style={{ width: `${uPct}%`, background: "var(--green)", borderRadius: "0 3px 3px 0", minWidth: bullish > 0 ? 4 : 0 }} />
      </div>
    </div>
  );
}

function PivotLevels({ pivots, price }) {
  if (!pivots) return null;
  const levels = [
    { label: "S3", value: pivots.s3, type: "support" },
    { label: "S2", value: pivots.s2, type: "support" },
    { label: "S1", value: pivots.s1, type: "support" },
    { label: "R1", value: pivots.r1, type: "resistance" },
    { label: "R2", value: pivots.r2, type: "resistance" },
    { label: "R3", value: pivots.r3, type: "resistance" },
  ];
  const allValues = levels.map(l => l.value);
  const min = Math.min(...allValues, price);
  const max = Math.max(...allValues, price);
  const range = max - min || 1;
  const pricePct = ((price - min) / range) * 100;

  return (
    <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surf)", marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 10 }}>Support & Resistance</div>

      {/* Visual bar */}
      <div style={{ position: "relative", height: 28, marginBottom: 10 }}>
        <div style={{ position: "absolute", top: 12, left: 0, right: 0, height: 4, borderRadius: 2, background: "linear-gradient(90deg, var(--red) 0%, var(--yellow) 50%, var(--green) 100%)", opacity: 0.3 }} />
        {levels.map((l) => {
          const pct = ((l.value - min) / range) * 100;
          return (
            <div key={l.label} style={{ position: "absolute", left: `${pct}%`, top: 0, transform: "translateX(-50%)", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: l.type === "support" ? "var(--red)" : "var(--green)", lineHeight: 1 }}>{l.label}</div>
              <div style={{ width: 2, height: 8, background: l.type === "support" ? "var(--red)" : "var(--green)", margin: "1px auto 0", borderRadius: 1, opacity: 0.6 }} />
            </div>
          );
        })}
        {/* CMP marker */}
        <div style={{ position: "absolute", left: `${pricePct}%`, top: 6, transform: "translateX(-50%)" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--card)", boxShadow: "0 0 4px var(--accent)" }} />
        </div>
      </div>

      {/* Level values */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {levels.filter(l => l.type === "support").map(l => (
          <div key={l.label} style={{ textAlign: "center", padding: "6px 4px", borderRadius: 6, background: "var(--red-dim)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--red)", marginBottom: 2 }}>{l.label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{l.value.toLocaleString("en-IN")}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6 }}>
        {levels.filter(l => l.type === "resistance").map(l => (
          <div key={l.label} style={{ textAlign: "center", padding: "6px 4px", borderRadius: 6, background: "var(--green-dim)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", marginBottom: 2 }}>{l.label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{l.value.toLocaleString("en-IN")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakoutLevel({ label, price, cmp, type }) {
  if (price == null) return null;
  const dist = ((price - cmp) / cmp) * 100;
  const above = cmp > price;
  const atLevel = Math.abs(dist) < 0.5;
  const statusColor = atLevel ? "var(--yellow)" : above ? "var(--green)" : "var(--t3)";
  const statusText = atLevel ? "At level" : above ? "Above" : `${dist > 0 ? "+" : ""}${dist.toFixed(1)}% away`;
  const icon = atLevel ? "~" : above ? "✓" : "↑";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--bdr)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: type === "short" ? "var(--accent)" : "var(--blue, #0A84FF)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--t2)" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>₹{price.toLocaleString("en-IN")}</span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: above ? "var(--green-dim)" : atLevel ? "var(--yellow-dim)" : "var(--surf)", color: statusColor }}>
          {icon} {statusText}
        </span>
      </div>
    </div>
  );
}

function BreakoutLevels({ data }) {
  if (!data) return null;
  const { price, sma20, sma50, sma200, pivots, rsi14 } = data;

  const longReady = sma50 != null && sma200 != null && sma50 > sma200;
  const rsiConfirm = rsi14 != null && rsi14 > 50 && rsi14 < 70;

  const checks = [
    { label: "Price > SMA 20", met: sma20 != null && price > sma20 },
    { label: "Price > R1", met: pivots && price > pivots.r1 },
    { label: "RSI 50–70", met: rsiConfirm },
    { label: "SMA 50 > 200", met: longReady },
  ];
  const metCount = checks.filter(c => c.met).length;

  let verdict, verdictColor, verdictBg;
  if (metCount >= 3) { verdict = "Breakout zone — strength confirmed"; verdictColor = "var(--green)"; verdictBg = "var(--green-dim)"; }
  else if (metCount >= 2) { verdict = "Building — watch for more confirmations"; verdictColor = "var(--yellow)"; verdictBg = "var(--yellow-dim)"; }
  else { verdict = "Not ready — wait for levels to clear"; verdictColor = "var(--red)"; verdictBg = "var(--red-dim)"; }

  return (
    <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surf)", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>Breakout Levels</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: verdictBg, color: verdictColor }}>
          {metCount}/4 confirmed
        </span>
      </div>

      {/* Verdict */}
      <div style={{ fontSize: 11, color: verdictColor, marginBottom: 10, fontWeight: 600 }}>{verdict}</div>

      {/* Key levels */}
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t3)", marginBottom: 4 }}>Short-Term Watch</div>
      <BreakoutLevel label="SMA 20 (trend)" price={sma20} cmp={price} type="short" />
      {pivots && <BreakoutLevel label="R1 (first resistance)" price={pivots.r1} cmp={price} type="short" />}
      {pivots && <BreakoutLevel label="R2 (strong resistance)" price={pivots.r2} cmp={price} type="short" />}

      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t3)", marginTop: 10, marginBottom: 4 }}>Long-Term Watch</div>
      <BreakoutLevel label="SMA 50 (medium trend)" price={sma50} cmp={price} type="long" />
      <BreakoutLevel label="SMA 200 (major trend)" price={sma200} cmp={price} type="long" />

      {/* Checklist */}
      <div style={{ marginTop: 12, padding: "8px 10px", borderRadius: 6, background: "var(--card)" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t3)", marginBottom: 6 }}>Trend checklist</div>
        {checks.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: c.met ? "var(--green)" : "var(--t3)", marginBottom: 3 }}>
            <span style={{ fontSize: 13 }}>{c.met ? "✓" : "✗"}</span>
            <span style={{ textDecoration: c.met ? "none" : "none" }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalRow({ label, signal, crossText }) {
  const color = signal === "bullish" ? "var(--green)" : signal === "bearish" ? "var(--red)" : "var(--yellow)";
  const bg = signal === "bullish" ? "var(--green-dim)" : signal === "bearish" ? "var(--red-dim)" : "var(--yellow-dim)";
  const text = signal === "bullish" ? "Bullish" : signal === "bearish" ? "Bearish" : "Neutral";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: "var(--surf)", marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--t2)" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {crossText && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: bg, color }}>{crossText}</span>
        )}
        <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 50, textAlign: "right" }}>{text}</span>
      </div>
    </div>
  );
}

export default function TechnicalPanel({ ticker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true); setError(null); setData(null);
    api.panel(ticker, "technicals")
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return null;

  if (error) return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 10, padding: "16px 20px", marginBottom: 12, background: "var(--card)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Technical Analysis</div>
      <div style={{ fontSize: 12, color: "var(--t3)" }}>{error}</div>
    </div>
  );

  if (!data) return null;

  const rsiColor = data.rsi14 > 70 ? "var(--red)" : data.rsi14 < 30 ? "var(--green)" : "var(--t1)";

  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 10, padding: "16px 20px", marginBottom: 12, background: "var(--card)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
          Technical Analysis <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 400 }}>· {data.yahooSymbol}</span>
        </div>
      </div>
      {data.stale && <div style={{ fontSize: 11, color: "var(--yellow)", background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", borderRadius: 7, padding: "7px 10px", marginBottom: 10 }}>{data.staleReason} Verify the date before relying on these signals.</div>}

      {/* Summary Gauge */}
      <SummaryGauge summary={data.summary} />

      {/* Support & Resistance */}
      <PivotLevels pivots={data.pivots} price={data.price} />

      {/* Signal Rows */}
      <div style={{ marginBottom: 14 }}>
        <SignalRow
          label="Short Term — 5 & 20 Day SMA CrossOver"
          signal={data.shortTermSignal}
          crossText={data.shortTermCross ? (data.shortTermCross === "bullish" ? "Golden Cross" : "Death Cross") : null}
        />
        <SignalRow
          label="Long Term — 50 & 200 Day SMA CrossOver"
          signal={data.longTermSignal}
          crossText={data.longTermCross ? (data.longTermCross === "bullish" ? "Golden Cross" : "Death Cross") : null}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: "var(--surf)", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: rsiColor, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--t2)" }}>RSI (14)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: rsiColor }}>{data.rsi14 ?? "—"}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t3)" }}>{data.rsiLabel}</span>
          </div>
        </div>
      </div>

      {/* Breakout Levels */}
      <BreakoutLevels data={data} />

      {/* Returns + Sparkline */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 20 }}>
          <Stat label="Return 20D" value={data.return20d != null ? `${data.return20d > 0 ? "+" : ""}${data.return20d}%` : "—"} color={data.return20d > 0 ? "var(--green)" : "var(--red)"} />
          <Stat label="Return 60D" value={data.return60d != null ? `${data.return60d > 0 ? "+" : ""}${data.return60d}%` : "—"} color={data.return60d > 0 ? "var(--green)" : "var(--red)"} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 3, textAlign: "right" }}>60-day price</div>
          <Sparkline prices={data.sparkline} />
        </div>
      </div>
    </div>
  );
}
