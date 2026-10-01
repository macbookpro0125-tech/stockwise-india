// A copy of the accounts database (users, watchlists, alerts, portfolios) each
// day, the last 14 kept, in DATA_DIR/backups — so a bad deploy, a bug that
// writes the wrong thing, or a corrupted file costs at most a day. They sit
// on the same disk as the database, so they don't cover losing the disk
// itself: on Render that's the host's own disk snapshots.
//
// VACUUM INTO writes a consistent copy even while the app is writing, and the
// copy is written under a temporary name first, so a crash mid-way never
// leaves a half-written file looking like a backup.
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db.js";
import { DATA_DIR } from "./paths.js";

export const BACKUP_DIR = join(DATA_DIR, "backups");
const KEEP = 14;
const NAME = /^app-\d{4}-\d{2}-\d{2}\.db$/;

export function backupDatabase({ dir = BACKUP_DIR, keep = KEEP, now = new Date() } = {}) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `app-${now.toISOString().slice(0, 10)}.db`);
  if (!existsSync(file)) {
    const tmp = `${file}.partial`;
    if (existsSync(tmp)) unlinkSync(tmp);
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    renameSync(tmp, file);
  }
  const all = readdirSync(dir).filter(f => NAME.test(f)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - keep))) unlinkSync(join(dir, old));
  return file;
}

// At start (if today's is missing) and every 6 hours after, which makes one a day
export function startBackups({ log = console.error } = {}) {
  const run = () => {
    try {
      backupDatabase();
    } catch (e) {
      log(`[backup] ${e.message}`);
    }
  };
  run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}
