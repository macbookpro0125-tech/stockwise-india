// The free copy's evening data pull (data-pull.js), against a pack served
// from this machine: it installs a newer pack, leaves a current one alone,
// throws away a pack that isn't whole, and is never on away from Render.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "stockwise-pull-"));
const dataDir = join(root, "data");
process.env.DATA_DIR = dataDir;
const { pullBaseUrl, pullOnce, installPack } = await import("./data-pull.js");
const { loadMarketSnapshot } = await import("./market-data.js");

// Never on away from Render (a test copy, the demo recorder), unless asked
assert.equal(pullBaseUrl({}), null, "off on this Mac");
assert.equal(pullBaseUrl({ DATA_JOBS: "off" }), null, "off on a local DATA_JOBS=off copy");
assert.equal(pullBaseUrl({ RENDER: "true" }), null, "off on a Render host that runs its own jobs");
assert.equal(pullBaseUrl({ RENDER: "true", DATA_JOBS: "off", RENDER_GIT_REPO_SLUG: "me/app" }), "https://github.com/me/app/releases/download/data-latest");
assert.equal(pullBaseUrl({ RENDER: "true", DATA_JOBS: "off", DATA_PULL: "off" }), null, "DATA_PULL=off wins");
assert.equal(pullBaseUrl({ DATA_PULL_URL: "http://x/y/" }), "http://x/y");

// What's being served: an older snapshot and one company
mkdirSync(join(dataDir, "market"), { recursive: true });
writeFileSync(join(dataDir, "market", "OLD.json"), "{}");
writeFileSync(join(dataDir, "market-snapshot.json"), JSON.stringify({ builtAt: "2026-10-01T10:00:00Z", pricesDate: "2026-10-01", prices: { OLD: 1 } }));

function makePack(name, { companies, builtAt }) {
  const dir = join(root, name);
  mkdirSync(join(dir, "market"), { recursive: true });
  for (let i = 0; i < companies; i++) writeFileSync(join(dir, "market", `C${i}.json`), "{}");
  mkdirSync(join(dir, "shareholding"));
  writeFileSync(join(dir, "market-snapshot.json"), JSON.stringify({ builtAt, pricesDate: builtAt.slice(0, 10), prices: { C0: 2 } }));
  writeFileSync(join(dir, "performance-snapshots.json"), "[]");
  const tgz = join(root, `${name}.tar.gz`);
  execFileSync("tar", ["-czf", tgz, "-C", dir, "market", "market-snapshot.json", "performance-snapshots.json", "shareholding"]);
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
const server = createServer((req, res) => {
  if (!published) { res.writeHead(404).end(); return; }
  if (req.url === "/manifest.json") res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ builtAt: "2026-10-09T15:00:00Z", pricesDate: "2026-10-09" }));
  else if (req.url === "/market-data.tar.gz") res.writeHead(200).end(readFileSync(good));
  else res.writeHead(404).end();
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

published = false;
assert.equal(await pullOnce(base), "none", "no pack published yet is not a failure");
published = true;
let warmed = 0;
assert.equal(await pullOnce(base, { onInstalled: () => warmed++ }), "installed", "a newer pack is installed");
assert.equal(warmed, 1, "the screen is worked out again after a pull");
assert.equal(readdirSync(join(dataDir, "market")).length, 1200, "the pack's companies replace the old ones");
assert.ok(!existsSync(join(dataDir, "market", "OLD.json")));
assert.equal(loadMarketSnapshot().pricesDate, "2026-10-09", "the snapshot served is the pack's, not a cached old one");
assert.ok(existsSync(join(dataDir, "performance-snapshots.json")));
assert.ok(!readdirSync(dataDir).some(f => f.startsWith(".old-") || f.startsWith(".pull")), "no leftovers beside the data");
assert.equal(await pullOnce(base), "current", "the same pack again is left alone");

server.close();
rmSync(root, { recursive: true, force: true });
console.log("All data-pull checks passed.");
