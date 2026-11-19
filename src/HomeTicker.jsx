import { useEffect, useState } from "react";
import { api } from "./api.js";

const num = n => (n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const tone = n => (n == null ? "var(--t3)" : n >= 0 ? "var(--green)" : "var(--red)");
const day = d => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// A moving strip of the indices, then the largest companies, at the top of
// Home (19 Nov 2026, the owner: "moving things like the Nifty 50 in the home
// page"): their last close and the day's move. It stops while touched or
// hovered, and stands still for anyone whose device asks for less motion.
export default function HomeTicker({ onOpenIndex, onOpenStock }) {
  const [strip, setStrip] = useState(null);
  useEffect(() => { api.marketStrip().then(setStrip).catch(() => {}); }, []);
  if (!strip) return null;
  const items = [
    ...(strip.indices ?? []).map(i => ({ key: `i-${i.name}`, label: i.name, value: i.close, chg: i.changePct, open: () => onOpenIndex?.(i.name) })),
    ...(strip.stocks ?? []).map(t => ({ key: `s-${t.symbol}`, label: t.symbol, value: t.cmp, chg: t.changePct, open: () => onOpenStock?.(t.symbol) })),
  ].filter(x => x.value != null);
  if (!items.length) return null;
  const row = hidden => (
    <div className="hk-run" aria-hidden={hidden || undefined} inert={hidden ? "" : undefined}>
      {items.map(x => (
        <button key={x.key} type="button" className="hk-item" onClick={x.open} tabIndex={hidden ? -1 : undefined}>
          <span className="hk-name">{x.label}</span>
          <b>{num(x.value)}</b>
          {x.chg != null && <i style={{ color: tone(x.chg) }}>{x.chg > 0 ? "▲" : x.chg < 0 ? "▼" : ""}{Math.abs(x.chg).toFixed(2)}%</i>}
        </button>
      ))}
    </div>
  );
  return (
    <div className="hk" role="region" aria-label={`Indices and the largest companies at NSE's close${strip.asOf ? ` on ${day(strip.asOf)}` : ""}`}>
      <div className="hk-track" style={{ "--hk-dur": `${Math.max(40, items.length * 3.2)}s` }}>{row(false)}{row(true)}</div>
    </div>
  );
}

