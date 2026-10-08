// The free copy on Render has no disk and doesn't fetch from NSE itself
// (DATA_JOBS=off), so its prices froze at whatever was packed into the build.
// GitHub Actions now runs the data jobs each evening
// (.github/workflows/data-refresh.yml) and publishes the result as a release
// asset, `data-latest`: market-data.tar.gz (the same files as the build's
// seed) and a small manifest.json. This checks the manifest every half hour
// and, when its snapshot is newer than the one being served, downloads the
// pack and swaps it in — no redeploy, no commit per day.
//
// On only on Render with DATA_JOBS=off (or wherever DATA_PULL_URL is set): a
// copy on this Mac — the test copies, the demo recorder — must never have its
// data/ replaced from the internet. DATA_PULL=off turns it off.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./paths.js";
import { loadMarketSnapshot, clearSnapshotCache } from "./market-data.js";

const run = promisify(execFile);
const HOUR = 3600 * 1000;
// A few hundred bytes a look; the pack itself only when it's newer
const CHECK_EVERY = HOUR / 2;
const MAX_PACK_BYTES = 60 * 1024 * 1024;
// What a pack replaces — the same list `npm run pack:seed` packs. The
// snapshot goes last: it's what tells the screen the data changed.
const PACK_ENTRIES = ["market", "shareholding", "performance-snapshots.json", "market-snapshot.json"];

// A file moved into place, copied if a move can't cross over
function moveFile(from, to) {
  try {
    renameSync(from, to);
  } catch (e) {
    if (e.code !== "EXDEV") throw e;
    copyFileSync(from, to);
    unlinkSync(from);
  }
}

// A folder's contents replaced file by file, the folder itself left where it
// is: on Render the build's data/ sits in a lower layer of the container's
// file system, which refuses to rename a folder from it ("EXDEV: cross-device
// link not permitted", 9 Oct 2026). Each file's move is whole; files the
// pack doesn't have are removed after.
function replaceContents(from, to) {
  mkdirSync(to, { recursive: true });
  const keep = new Set(readdirSync(from));
  for (const name of keep) {
    const src = join(from, name), dest = join(to, name);
    if (statSync(src).isDirectory()) replaceContents(src, dest);
    else moveFile(src, dest);
  }
  for (const name of readdirSync(to)) if (!keep.has(name)) rmSync(join(to, name), { recursive: true, force: true });
}

export const pullStatus = { enabled: false, lastCheckAt: null, lastPulledAt: null, pulledBuiltAt: null, lastError: null };

export function pullBaseUrl(env = process.env) {
  if (env.DATA_PULL === "off") return null;
  if (env.DATA_PULL_URL) return env.DATA_PULL_URL.replace(/\/+$/, "");
  if (!env.RENDER || env.DATA_JOBS !== "off") return null;
  const repo = env.RENDER_GIT_REPO_SLUG || "macbookpro0125-tech/stockwise-india";
  return `https://github.com/${repo}/releases/download/data-latest`;
}

// Unpacks a pack beside the live data, checks it, then moves it into place.
// A pack that doesn't look whole is thrown away and the data being served
// stays.
export async function installPack(tgzPath, dataDir = DATA_DIR) {
  const incoming = join(dataDir, ".incoming");
  rmSync(incoming, { recursive: true, force: true });
  mkdirSync(incoming, { recursive: true });
  try {
    await run("tar", ["-xzf", tgzPath, "-C", incoming]);
    const snap = JSON.parse(readFileSync(join(incoming, "market-snapshot.json"), "utf-8"));
    const companies = existsSync(join(incoming, "market")) ? readdirSync(join(incoming, "market")).filter(f => f.endsWith(".json")).length : 0;
    if (!snap.builtAt || !snap.pricesDate || !snap.prices) throw new Error("the pack's market snapshot is incomplete");
    if (companies < 1000) throw new Error(`the pack holds only ${companies} companies`);
    for (const name of PACK_ENTRIES) {
      const from = join(incoming, name);
      if (!existsSync(from)) continue;
      if (statSync(from).isDirectory()) replaceContents(from, join(dataDir, name));
      else moveFile(from, join(dataDir, name));
    }
    return { builtAt: snap.builtAt, pricesDate: snap.pricesDate, companies };
  } finally {
    rmSync(incoming, { recursive: true, force: true });
  }
}

let busy = false;
export async function pullOnce(base, { onInstalled } = {}) {
  if (busy) return "busy";
  busy = true;
  pullStatus.lastCheckAt = new Date().toISOString();
  try {
    const res = await fetch(`${base}/manifest.json`, { signal: AbortSignal.timeout(20_000) });
    // No pack published yet: nothing to do, not a failure
    if (res.status === 404) { pullStatus.lastError = null; return "none"; }
    if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
    const manifest = await res.json();
    const serving = loadMarketSnapshot()?.builtAt;
    if (!manifest.builtAt || (serving && Date.parse(manifest.builtAt) <= Date.parse(serving))) { pullStatus.lastError = null; return "current"; }

    const pack = await fetch(`${base}/market-data.tar.gz`, { signal: AbortSignal.timeout(120_000) });
    if (!pack.ok) throw new Error(`pack: HTTP ${pack.status}`);
    const bytes = Buffer.from(await pack.arrayBuffer());
    if (bytes.length > MAX_PACK_BYTES) throw new Error(`pack is ${bytes.length} bytes`);
    const tgz = join(DATA_DIR, ".pull.tar.gz");
    writeFileSync(tgz, bytes);
    try {
      const got = await installPack(tgz);
      clearSnapshotCache();
      pullStatus.lastPulledAt = new Date().toISOString();
      pullStatus.pulledBuiltAt = got.builtAt;
      pullStatus.lastError = null;
      console.error(`[pull] installed data built ${got.builtAt} (prices ${got.pricesDate}, ${got.companies} companies)`);
      onInstalled?.();
      return "installed";
    } finally {
      rmSync(tgz, { force: true });
    }
  } catch (e) {
    pullStatus.lastError = e.message;
    console.error(`[pull] ${e.message}`);
    return "failed";
  } finally {
    busy = false;
  }
}

export function startDataPull({ onInstalled } = {}) {
  const base = pullBaseUrl();
  if (!base) return;
  pullStatus.enabled = true;
  const check = () => pullOnce(base, { onInstalled });
  // Soon after start — a restart begins from the build's older seed
  setTimeout(check, 20_000).unref();
  setInterval(check, CHECK_EVERY).unref();
}
