import { useState, useEffect } from "react";
import { api } from "./api.js";

// The strip across the top, as on Tickertape: the main indices and the
// largest companies with their day's change. These are closing prices, not
// live ones, and the strip says so. It scrolls slowly, stops while hovered,
// and stays still for anyone whose device asks for less motion.

function fmtDay(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

function Item({ label, value, changePct, onClick }) {
  const up = changePct > 0, down = changePct < 0;
  const color = up ? "var(--green)" : down ? "var(--red)" : "var(--t3)";
  const content = (
    <>
      <span style={{ color: "var(--t2)", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "var(--t1)", fontVariantNumeric: "tabular-nums" }}>{value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      {changePct != null && (
        <span style={{ color, fontVariantNumeric: "tabular-nums" }}>{up ? "▲" : down ? "▼" : ""}{Math.abs(changePct).toFixed(2)}%</span>
      )}
    </>
  );
  const style = { display: "inline-flex", alignItems: "center", gap: 6, padding: "0 16px", whiteSpace: "nowrap", fontSize: 12, background: "none", border: "none", cursor: onClick ? "pointer" : "default", fontFamily: "inherit" };
  return onClick ? <button type="button" onClick={onClick} style={style}>{content}</button> : <span style={style}>{content}</span>;
}

export default function PriceStrip({ onOpenStock }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.marketStrip().then(setData).catch(() => {}); }, []);
  if (!data || (!data.indices.length && !data.stocks.length)) return null;

  const items = [
    ...data.indices.map(i => <Item key={i.name} label={i.name} value={i.close} changePct={i.changePct} />),
    ...data.stocks.map(s => <Item key={s.symbol} label={s.symbol} value={s.cmp} changePct={s.changePct} onClick={onOpenStock ? () => onOpenStock(s.symbol) : undefined} />),
  ];
  return (
    <div className="price-strip" role="region" aria-label={`Closing prices, ${data.asOf ? fmtDay(data.asOf) : ""}`}>
      <span className="price-strip-label">Close {data.asOf ? fmtDay(data.asOf) : ""}</span>
      <div className="price-strip-window">
        {/* Twice over, so the loop is seamless; the copy is skipped by screen
            readers and the keyboard */}
        <div className="price-strip-track">
          <div style={{ display: "inline-flex" }}>{items}</div>
          <div style={{ display: "inline-flex" }} aria-hidden="true" inert>{items}</div>
        </div>
      </div>
    </div>
  );
}
