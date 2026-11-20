// Reading and writing the last good copies in data/cache/ (paths.js
// CACHE_DIR). The first version (20 Nov 2026) wrote them into data/market/,
// where a new file makes the server rebuild the whole market beside the one
// it holds — it ran out of memory. A copy left there is only read, never
// moved or deleted (that too would set off a rebuild); the evening data pull
// replaces data/market/ and clears it safely.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR, MARKET_DIR } from "./paths.js";

export const cachePath = name => join(CACHE_DIR, name);

export function readCache(name, fallback = null) {
  for (const file of [join(CACHE_DIR, name), join(MARKET_DIR, name)]) {
    try { if (existsSync(file)) return JSON.parse(readFileSync(file, "utf-8")); } catch { /* the next one */ }
  }
  return fallback;
}

export function writeCache(name, data) {
  try { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(join(CACHE_DIR, name), JSON.stringify(data)); } catch { /* a read-only disk: the copy in memory serves */ }
}
