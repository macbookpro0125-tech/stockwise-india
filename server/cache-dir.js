// Reading and writing the last good copies in data/cache/ (paths.js
// CACHE_DIR). A copy left in data/market/ by the first version (20 Nov 2026)
// is moved here the first time it's read.
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR, MARKET_DIR } from "./paths.js";

export function cachePath(name) {
  const file = join(CACHE_DIR, name), old = join(MARKET_DIR, name);
  try {
    if (existsSync(old)) {
      mkdirSync(CACHE_DIR, { recursive: true });
      if (existsSync(file)) unlinkSync(old); else renameSync(old, file);
    }
  } catch { /* left where it was */ }
  return file;
}
export const readCache = (name, fallback = null) => { try { const f = cachePath(name); return existsSync(f) ? JSON.parse(readFileSync(f, "utf-8")) : fallback; } catch { return fallback; } };
export const writeCache = (name, data) => { try { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(cachePath(name), JSON.stringify(data)); } catch { /* a read-only disk: the copy in memory serves */ } };
