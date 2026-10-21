// The free copy's evening data pull (data-pull.js), against a pack served
// from this machine: it installs a newer pack, leaves a current one alone,
// throws away a pack that isn't whole, and is never on away from Render.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "stockwise-pull-"));
const dataDir = join(root, "data");
process.env.DATA_DIR = dataDir;
const { pullBaseUrl, pullOnce, installPack } = await import("./data-pull.js");
const { loadMarketSnapshot, clearSnapshotCache } = await import("./market-data.js");

// Never on away from Render (a test copy, the demo recorder), unless asked
assert.equal(pullBaseUrl({}), null, "off on this Mac");
assert.equal(pullBaseUrl({ DATA_JOBS: "off" }), null, "off on a local DATA_JOBS=off copy");
assert.equal(pullBaseUrl({ RENDER: "true" }), null, "off on a Render host that runs its own jobs");
assert.equal(pullBaseUrl({ RENDER: "true", DATA_JOBS: "off", RENDER_GIT_REPO_SLUG: "me/app" }), "https://github.com/me/app/releases/download/data-latest");
assert.equal(pullBaseUrl({ RENDER: "true", DATA_JOBS: "off", DATA_PULL: "off" }), null, "DATA_PULL=off wins");
assert.equal(pullBaseUrl({ RENDER: "true", DATA_JOBS: "pull", RENDER_GIT_REPO_SLUG: "me/app" }), "https://github.com/me/app/releases/download/data-latest", "on for the paid copy (DATA_JOBS=pull)");
assert.equal(pullBaseUrl({ DATA_JOBS: "pull" }), null, "off on this Mac even with DATA_JOBS=pull");
assert.equal(pullBaseUrl({ DATA_PULL_URL: "http://x/y/" }), "http://x/y");

// What's being served: an older snapshot and one company
mkdirSync(join(dataDir, "market"), { recursive: true });
writeFileSync(join(dataDir, "market", "OLD.json"), "{}");
writeFileSync(join(dataDir, "market-snapshot.json"), JSON.stringify({ builtAt: "2026-10-01T10:00:00Z", pricesDate: "2026-10-01", prices: { OLD: 1 } }));

function makePack(name, { companies, builtAt, cohortMonth = "2026-10" }) {
  const dir = join(root, name);
  mkdirSync(join(dir, "market"), { recursive: true });
  for (let i = 0; i < companies; i++) writeFileSync(join(dir, "market", `C${i}.json`), "{}");
  mkdirSync(join(dir, "shareholding"));
  mkdirSync(join(dir, "logos"));
  writeFileSync(join(dir, "logos", "TCS.img"), "pack logo");
  writeFileSync(join(dir, "logos", "TCS.json"), JSON.stringify({ at: builtAt, type: "image/png", source: "https://example.com/tcs.png" }));
  writeFileSync(join(dir, "logos", "MISSED.img"), "recovered logo");
  writeFileSync(join(dir, "logos", "MISSED.json"), JSON.stringify({ at: builtAt, type: "image/png", source: "https://example.com/missed.png" }));
  writeFileSync(join(dir, "logos", "NOICON.json"), JSON.stringify({ at: builtAt, miss: true }));
  writeFileSync(join(dir, "market-snapshot.json"), JSON.stringify({ builtAt, pricesDate: builtAt.slice(0, 10), prices: { C0: 2 } }));
  writeFileSync(join(dir, "performance-snapshots.json"), "[]");
  writeFileSync(join(dir, "research-score-cohorts.json"), JSON.stringify([{ month: cohortMonth, records: [{ ticker: "C0", overall: 70 }] }]));
  const tgz = join(root, `${name}.tar.gz`);
  execFileSync("tar", ["-czf", tgz, "-C", dir, "market", "logos", "market-snapshot.json", "performance-snapshots.json", "research-score-cohorts.json", "shareholding"]);
  return tgz;
}

// A pack that isn't whole is refused and nothing being served changes
const broken = makePack("broken", { companies: 5, builtAt: "2026-10-09T15:00:00Z" });
await assert.rejects(installPack(broken, dataDir), /only 5 companies/);
assert.ok(existsSync(join(dataDir, "market", "OLD.json")), "the served data stays after a bad pack");
assert.ok(!existsSync(join(dataDir, ".incoming")), "the unpacked copy is cleaned up");

// Served over HTTP the way GitHub serves release assets
const good = makePack("good", { companies: 1200, builtAt: "2026-10-09T15:00:00Z" });
let published = true;
let packedAt = "2026-10-09T15:30:00Z";
let latestPack = good;
const server = createServer((req, res) => {
  if (!published) { res.writeHead(404).end(); return; }
  if (req.url === "/manifest.json") res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ builtAt: "2026-10-09T15:00:00Z", packedAt, pricesDate: "2026-10-09" }));
  else if (req.url === "/market-data.tar.gz") res.writeHead(200).end(readFileSync(latestPack));
  else res.writeHead(404).end();
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

published = false;
assert.equal(await pullOnce(base), "none", "no pack published yet is not a failure");
published = true;
let warmed = 0;
// Render's file system refuses to rename a folder that came with the build,
// so the folder stays and its files are replaced
const marketInode = statSync(join(dataDir, "market")).ino;
mkdirSync(join(dataDir, "logos"), { recursive: true });
writeFileSync(join(dataDir, "logos", "KEEP.img"), "local logo");
writeFileSync(join(dataDir, "logos", "KEEP.json"), JSON.stringify({ type: "image/png" }));
writeFileSync(join(dataDir, "logos", "MISSED.json"), JSON.stringify({ miss: true }));
assert.equal(await pullOnce(base, { onInstalled: () => warmed++ }), "installed", "a newer pack is installed");
assert.equal(statSync(join(dataDir, "market")).ino, marketInode, "the market folder itself is never moved");
assert.equal(warmed, 1, "the screen is worked out again after a pull");
assert.equal(readdirSync(join(dataDir, "market")).length, 1200, "the pack's companies replace the old ones");
assert.ok(!existsSync(join(dataDir, "market", "OLD.json")));
assert.equal(readFileSync(join(dataDir, "logos", "TCS.img"), "utf8"), "pack logo", "a logo from the pack is added");
assert.equal(readFileSync(join(dataDir, "logos", "KEEP.img"), "utf8"), "local logo", "a logo already on the persistent disk is kept");
assert.equal(readFileSync(join(dataDir, "logos", "MISSED.img"), "utf8"), "recovered logo", "a positive pack logo replaces a local negative-cache entry");
assert.ok(!existsSync(join(dataDir, "logos", "NOICON.json")), "negative logo entries from the pack are ignored");
assert.equal(loadMarketSnapshot().pricesDate, "2026-10-09", "the snapshot served is the pack's, not a cached old one");
assert.ok(existsSync(join(dataDir, "performance-snapshots.json")));
assert.deepEqual(JSON.parse(readFileSync(join(dataDir, "research-score-cohorts.json"), "utf8")), [{ month: "2026-10", records: [{ ticker: "C0", overall: 70 }] }], "monthly score-validation cohorts arrive with the market data");
assert.ok(!readdirSync(dataDir).some(f => f.startsWith(".old-") || f.startsWith(".pull")), "no leftovers beside the data");
assert.equal(await pullOnce(base), "current", "the same pack again is left alone");

latestPack = makePack("format-update", { companies: 1200, builtAt: "2026-10-09T15:00:00Z", cohortMonth: "2026-09" });
packedAt = "2026-10-09T16:00:00Z";
assert.equal(await pullOnce(base), "installed", "a newer pack is installed even when its market snapshot date is unchanged");
assert.deepEqual(JSON.parse(readFileSync(join(dataDir, "research-score-cohorts.json"), "utf8")), [{ month: "2026-09", records: [{ ticker: "C0", overall: 70 }] }], "same-date pack updates replace the cohort history");
assert.equal(await pullOnce(base), "current", "the installed pack timestamp prevents repeat downloads");

// A restart forgets which pack was installed (the free host keeps nothing),
// and serves the build's seed. The release isn't newer just because there's
// no record: a seed built later stays, and the same data isn't fetched again.
const restart = snapshot => {
  rmSync(join(dataDir, "data-pack-state.json"), { force: true });
  writeFileSync(join(dataDir, "market-snapshot.json"), JSON.stringify(snapshot));
  clearSnapshotCache();
};
packedAt = "2026-10-11T12:00:00Z";
restart({ builtAt: "2026-10-11T08:00:00Z", pricesDate: "2026-10-10", prices: { C0: 3 } });
assert.equal(await pullOnce(base), "current", "an older release never replaces a newer seed after a restart");
assert.equal(loadMarketSnapshot().pricesDate, "2026-10-10", "the seed's prices are still served");
restart({ builtAt: "2026-10-09T15:00:00Z", pricesDate: "2026-10-09", prices: { C0: 2 } });
assert.equal(await pullOnce(base), "current", "the same data isn't downloaded again on every wake-up");

server.close();
rmSync(root, { recursive: true, force: true });
console.log("All data-pull checks passed.");
