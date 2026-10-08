// One pass of the data jobs a server with a disk runs by itself
// (server/data-jobs.js): the market snapshot (prices, dividends, splits,
// 52-week range), companies that filed results since the last check,
// shareholding a quarter behind, new listings, the strategy picks when due.
// Run each evening by .github/workflows/data-refresh.yml, which then
// publishes data/ for the free copy to pull in (server/data-pull.js). Without
// Telegram, alert checks or backups — this isn't a server.
//
// Exits 0 when the snapshot was rebuilt in this run, so a run that couldn't
// reach NSE publishes nothing rather than yesterday's data again.
import { startDataJobs, jobStatus } from "../server/data-jobs.js";
import { loadMarketSnapshot } from "../server/market-data.js";

const before = loadMarketSnapshot()?.builtAt ?? null;
const started = Date.now();
startDataJobs();

let idleTicks = 0, last = "";
const timer = setInterval(() => {
  const s = jobStatus();
  const line = s.running ? `${s.running}${s.progress ? ` ${s.progress.done}/${s.progress.total} (ok ${s.progress.ok}, failed ${s.progress.fail})` : ""}` : "idle";
  if (line !== last) console.log(`${((Date.now() - started) / 1000).toFixed(0)}s  ${line}`);
  last = line;
  // Jobs follow one another at once, so three idle looks in a row is the end
  idleTicks = s.running ? 0 : idleTicks + 1;
  if (idleTicks < 3) return;
  clearInterval(timer);
  if (s.lastError) console.log(`A job reported a problem (${s.lastErrorJob}): ${s.lastError}`);
  // (the snapshot job clears the cached copy after rebuilding it)
  const after = loadMarketSnapshot()?.builtAt ?? null;
  const rebuilt = !!after && after !== before;
  console.log(rebuilt ? `Snapshot rebuilt: ${after}` : "The snapshot wasn't rebuilt — nothing to publish.");
  process.exit(rebuilt ? 0 : 1);
}, 5000);
