// The score check on this machine's data (score-audit.js), as the server
// runs it each evening — for the weekly review, or after changing a rule.
//   node scripts/score-audit.mjs           check now, print the list
//   node scripts/score-audit.mjs --save    also save it as tonight's file
//   node scripts/score-audit.mjs --json    the whole result as JSON
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATA_DIR ??= join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const { allMetrics } = await import("../server/screen.js");
const { auditScores, saveAudit, loadAudit } = await import("../server/score-audit.js");

const market = allMetrics();
const pricesDate = market.snapshot?.pricesDate ?? null;
const audit = process.argv.includes("--save") && pricesDate
  ? saveAudit(market.rows, pricesDate)
  : auditScores(market.rows, loadAudit()?.scores ?? null, { pricesDate });
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ...audit, scores: undefined }, null, 2));
} else {
  console.log(`Score check at the ${pricesDate} close, score version ${audit.scoreVersion}: ${audit.flagged} of ${audit.companies} companies flagged`);
  console.log(Object.entries(audit.byCheck).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(" · "));
  for (const f of audit.flags.slice(0, 60)) console.log(`${"!".repeat(f.severity).padEnd(3)} ${f.check.padEnd(17)} ${f.symbol.padEnd(12)} ${String(f.overall ?? "—").padStart(5)}  ${f.detail}`);
  if (audit.flags.length > 60) console.log(`… and ${audit.flags.length - 60} more (--json for all)`);
}
