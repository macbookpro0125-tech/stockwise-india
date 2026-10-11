import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "stockwise-refresh-test-"));
try {
  const dataDir = join(root, "data");
  mkdirSync(dataDir, { recursive: true });
  const snapshotPath = join(dataDir, "market-snapshot.json");
  const outputPath = join(root, "github-output");
  const builtAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const pricesDate = new Date().toISOString().slice(0, 10);
  const runRefresh = force => {
    writeFileSync(snapshotPath, JSON.stringify({ builtAt, pricesDate, prices: { TCS: 1 } }));
    writeFileSync(outputPath, "");
    const result = spawnSync(process.execPath, ["scripts/refresh-data.mjs"], {
      encoding: "utf8",
      env: { ...process.env, DATA_DIR: dataDir, GITHUB_OUTPUT: outputPath, FORCE_DATA_PACK: String(force) },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return { output: readFileSync(outputPath, "utf8"), log: result.stdout };
  };

  const current = runRefresh(false);
  assert.match(current.output, /publish=false/);
  console.log("ok: a fresh snapshot skips duplicate data-pack publication");

  const formatUpdate = runRefresh(true);
  assert.match(formatUpdate.output, /publish=true/);
  assert.match(formatUpdate.log, /updated pack format/);
  console.log("ok: a fresh snapshot can still publish when the data-pack format changes");
} finally {
  rmSync(root, { recursive: true, force: true });
}
