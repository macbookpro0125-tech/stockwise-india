import { useState, useEffect } from "react";
import { api } from "./api.js";
import { DEFAULT_LEVEL_SETTINGS, userLevels } from "../server/levels.js";

// One shared copy of the signed-in user's own price levels — their settings
// (off until they turn them on) and any stock they set by hand — so the chart,
// Valuation tab, Discover table, watchlist, compare, export and alerts all
// draw the same levels, or none (server/levels.js userLevels).

const EMPTY = { settings: { enabled: false, ...DEFAULT_LEVEL_SETTINGS }, stocks: {} };
let mine = null;
let loading = null;
const listeners = new Set();
const set = next => { mine = next; listeners.forEach(fn => fn(mine)); };

function load() {
  loading ??= api.myLevels()
    .then(d => set({ settings: d.settings ?? EMPTY.settings, stocks: d.stocks ?? {} }))
    .catch(() => set(EMPTY))
    .finally(() => { loading = null; });
  return loading;
}

export function useMyLevels() {
  const [value, setValue] = useState(mine ?? EMPTY);
  useEffect(() => {
    listeners.add(setValue);
    if (mine) setValue(mine); else load();
    return () => listeners.delete(setValue);
  }, []);
  return value;
}

// A table row's fair values (screen.js tableRow) in the shape userLevels takes
export const rowFairValue = r => (r?.fv25 > 0 ? { fv25: r.fv25, fv27: r.fairValue, exact: r.fvExact ?? undefined } : null);

// A row with the user's levels on it, as the tables read them (safeBuyPrice
// is level 1) — or with none, while their levels are off
export function withMyLevels(row, levels = mine ?? EMPTY) {
  const l = userLevels(rowFairValue(row), levels, row?.symbol);
  return { ...row, safeBuyPrice: l?.p1 ?? null, p2: l?.p2 ?? null, p3: l?.p3 ?? null, stopLoss: l?.stopLoss ?? null, target: l?.target ?? null };
}

export async function saveLevelSettings(settings) {
  const { settings: saved } = await api.saveLevelSettings(settings);
  set({ ...(mine ?? EMPTY), settings: saved });
  return saved;
}
export async function setStockLevels(symbol, levels) {
  const { levels: saved } = await api.setStockLevels(symbol, levels);
  set({ ...(mine ?? EMPTY), stocks: { ...(mine ?? EMPTY).stocks, [symbol]: saved } });
}
export async function clearStockLevels(symbol) {
  await api.clearStockLevels(symbol);
  const { [symbol]: _gone, ...rest } = (mine ?? EMPTY).stocks;
  set({ ...(mine ?? EMPTY), stocks: rest });
}

// After sign-out, the next user must not see this one's levels
export function resetMyLevels() { mine = null; }
