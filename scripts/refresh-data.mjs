// One pass of the data jobs a server with a disk runs by itself
// (server/data-jobs.js): the market snapshot (prices, dividends, splits,
// 52-week range), companies that filed results since the last check,
// shareholding a quarter behind, new listings, the strategy picks when due.
// Run each evening by .github/workflows/data-refresh.yml, which then
// publishes data/ for the free copy to pull in (server/data-pull.js). Without
// Telegram, alert checks or backups — this isn't a server.
//
// Tells the workflow whether to publish (`publish=true|false` in
// $GITHUB_OUTPUT): when the snapshot was rebuilt, or the workflow needs to
// republish a new data-pack entry. A run that couldn't reach NSE therefore
// doesn't publish yesterday's data again. Exits 1 when a due snapshot can't
// be rebuilt after one retry; NSE refusing the first minutes of a run needn't
// mean it refuses all of it. Failures are printed as workflow annotations.
import { appendFileSync } from "node:fs";
import { startDataJobs, jobStatus } from "../server/data-jobs.js";
import { buildMarketSnapshot, loadMarketSnapshot, clearSnapshotCache } from "../server/market-data.js";
import { fiscalYearEnds } from "../server/build-snapshot.js";

// The morning run is a second try for an evening that failed: when the
// snapshot it starts from is this fresh, the evening's data is already out
const FRESH_HOURS = 18;

const output = (key, value) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`); };
const escape = s => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const annotate = (level, title, message) => console.log(`::${level} title=${escape(title)}::${escape(message)}`);

process.on("uncaughtException", e => { annotate("error", "Refresh crashed", e.stack || e.message); process.exit(1); });
process.on("unhandledRejection", e => { annotate("error", "Refresh crashed", e?.stack || String(e)); process.exit(1); });

// data-jobs.js logs each failed job's real reason; its status keeps only a
// generic line. Keep the reasons for the annotations.
const jobFailures = [];
const logError = console.error;
console.error = (...args) => {
  const line = args.join(" ");
  const failed = line.match(/^\[jobs\] (.+?) failed: (.*)$/s);
  if (failed) jobFailures.push({ job: failed[1], reason: failed[2] });
  logError(...args);
};

const start = loadMarketSnapshot();
const before = start?.builtAt ?? null;
const ageHours = before ? (Date.now() - Date.parse(before)) / 3600000 : Infinity;
if (ageHours < FRESH_HOURS) {
  if (process.env.FORCE_DATA_PACK === "true") {
    console.log(`The snapshot is ${ageHours.toFixed(1)} h old (prices ${start.pricesDate}) — republishing the current data with the updated pack format.`);
    output("publish", "true");
  } else {
    console.log(`The snapshot is ${ageHours.toFixed(1)} h old (prices ${start.pricesDate}) — already up to date, nothing to do.`);
    output("publish", "false");
  }
  process.exit(0);
}

const started = Date.now();
startDataJobs();

let idleTicks = 0, last = "";
const timer = setInterval(async () => {
  const s = jobStatus();
  const line = s.running ? `${s.running}${s.progress ? ` ${s.progress.done}/${s.progress.total} (ok ${s.progress.ok}, failed ${s.progress.fail})` : ""}` : "idle";
  if (line !== last) console.log(`${((Date.now() - started) / 1000).toFixed(0)}s  ${line}`);
  last = line;
  // Jobs follow one another at once, so three idle looks in a row is the end
  idleTicks = s.running ? 0 : idleTicks + 1;
  if (idleTicks < 3) return;
  clearInterval(timer);
  // A failed results or shareholding check doesn't stop a publish — the
  // records stay queued for the next run — but it's worth seeing
  for (const f of jobFailures) annotate(f.job === "prices" ? "error" : "warning", `Job "${f.job}" failed`, f.reason);
  // (the snapshot job clears the cached copy after rebuilding it)
  let after = loadMarketSnapshot()?.builtAt ?? null;
  if (!after || after === before) {
    console.log("The snapshot wasn't rebuilt — trying it once more.");
    try {
      await buildMarketSnapshot(fiscalYearEnds());
      clearSnapshotCache();
      after = loadMarketSnapshot()?.builtAt ?? null;
    } catch (e) {
      annotate("error", "Price snapshot failed twice", e.stack || e.message);
    }
  }
  const rebuilt = !!after && after !== before;
  console.log(rebuilt ? `Snapshot rebuilt: ${after} (prices ${loadMarketSnapshot()?.pricesDate})` : "The snapshot wasn't rebuilt — nothing to publish.");
  output("publish", String(rebuilt));
  process.exit(rebuilt ? 0 : 1);
}, 5000);
