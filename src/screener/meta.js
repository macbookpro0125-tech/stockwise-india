import { useEffect, useState } from "react";
import { api } from "../api.js";

// The screener's metric list (server/metric-catalog.js via /api/metrics):
// labels, units, categories and each metric's spread for its slider. Loaded
// once and shared.

let cached = null;
let pending = null;

function load() {
  pending ??= api.metrics()
    .then(m => {
      cached = { ...m, byId: new Map([...m.metrics, ...m.categoryMetrics].map(x => [x.id, x])) };
      return cached;
    })
    .finally(() => { pending = null; });
  return pending;
}

export function useScreenerMeta() {
  const [meta, setMeta] = useState(cached);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (cached) return;
    load().then(setMeta).catch(e => setError(e.message || "Couldn't load the filters"));
  }, []);
  return { meta, error, retry: () => { setError(null); load().then(setMeta).catch(e => setError(e.message)); } };
}

// The table's columns before anyone changes them — the original's own set
export const DEFAULT_COLUMNS = ["pe", "roce", "roe", "promoterPct", "marketCapCr", "divYield"];

const inr = (v, d) => v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

// ₹ Cr in the table: 2.0K, 147.1K, 1.5L — as the table always showed them
export function compactCr(n) {
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  if (a >= 100000) return `${s}${(a / 100000).toFixed(1)}L`;
  if (a >= 1000) return `${s}${(a / 1000).toFixed(1)}K`;
  return `${s}${Math.round(a)}`;
}

// Share counts the Indian way: 36.6 L (lakh), 1.2 Cr (crore)
function compactShares(n) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)} L`;
  return Math.round(n).toLocaleString("en-IN");
}

// A metric's value for display. In a table cell a multiple is bare ("20.7",
// not "20.7x"), as the table always showed P/E — the header names it.
export function formatValue(def, v, { cell = false } = {}) {
  if (v == null || !Number.isFinite(v)) return "—";
  const d = def.decimals ?? 1;
  const sign = def.signed && v > 0 ? "+" : "";
  const neg = v < 0 ? "−" : "";
  const a = Math.abs(v);
  switch (def.unit) {
    case "%": return `${sign}${neg}${inr(a, d)}%`;
    case "x": return `${neg}${inr(a, d)}${cell ? "" : "x"}`;
    case "₹": return `${sign}${neg}₹${inr(a, d)}`;
    case "₹ Cr": return `${sign}${compactCr(v)}`;
    case "shares": return compactShares(v);
    case "Cr shares": return `${inr(a, d)} Cr`;
    case "/10": return `${inr(v, 0)}/10`;
    case "/9": return `${inr(v, 0)}/9`;
    default: return `${neg}${inr(a, d)}`;
  }
}

// A bound for a filter box: plain, no grouping, sensible precision
export function formatInput(def, v) {
  if (v == null || !Number.isFinite(v)) return "";
  const d = Math.abs(v) >= 1000 ? 0 : Math.min(def.decimals ?? 1, 2);
  return String(Number(v.toFixed(d)));
}

export function unitLabel(def) {
  return { "%": "%", x: "x", "₹": "₹", "₹ Cr": "₹ Cr", "/10": "of 10", "/9": "of 9", shares: "shares", "Cr shares": "crore shares" }[def.unit] ?? "";
}

// Colour for a cell: gains green and losses red for signed metrics, and the
// table's old good/bad marks for the metrics it always coloured
export function valueColor(def, v) {
  if (v == null || !Number.isFinite(v)) return "var(--t3)";
  if (def.signed) return v > 0 ? "var(--green)" : v < 0 ? "var(--red)" : "var(--t2)";
  if (def.id === "roce") return v >= 18 ? "var(--green)" : "var(--t2)";
  if (def.id === "roe" || def.id === "roeAvg") return v >= 15 ? "var(--green)" : "var(--t2)";
  if (def.id === "promoterPct") return v >= 50 ? "var(--green)" : v < 30 ? "var(--red)" : "var(--t2)";
  return "var(--t2)";
}
