// Proves the multi-tenant foundation actually isolates before anything is
// built on top of it: two real users, each with their own alerts, verifying
// neither can see or touch the other's data — the exact gap stock-screener
// has today (one shared alerts.json for everyone).
import { unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "data", "app.db");
if (existsSync(DB_PATH)) unlinkSync(DB_PATH); // fresh DB each run

const { signup, login, verifySession } = await import("./auth.js");
const { createAlert, listAlerts, deleteAlert } = await import("./user-alerts.js");

function assert(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok: ${msg}`);
}

const alice = signup("alice@example.com", "correcthorsebattery");
const bob = signup("bob@example.com", "correcthorsebattery2");
assert(alice.userId !== bob.userId, "two signups get different user ids");

assert(verifySession(alice.token) === alice.userId, "alice's session resolves to her own user id");
assert(verifySession("not-a-real-token") === null, "a bogus session token resolves to nothing");

let loginFailed = false;
try { login("alice@example.com", "wrongpassword"); } catch { loginFailed = true; }
assert(loginFailed, "wrong password is rejected");

const aliceLogin = login("alice@example.com", "correcthorsebattery");
assert(aliceLogin.userId === alice.userId, "logging back in resolves to the same user");

createAlert(alice.userId, { ticker: "WIPRO", condition: "below", threshold: 250 });
createAlert(bob.userId, { ticker: "WIPRO", condition: "below", threshold: 999 });
assert(listAlerts(alice.userId).length === 1 && listAlerts(alice.userId)[0].threshold === 250, "alice sees only her own WIPRO alert at her own threshold");
assert(listAlerts(bob.userId).length === 1 && listAlerts(bob.userId)[0].threshold === 999, "bob sees only his own WIPRO alert at his own threshold — same ticker, no collision");

let duplicateCaught = false;
try {
  createAlert(alice.userId, { ticker: "WIPRO", condition: "below", threshold: 300 });
} catch (e) {
  duplicateCaught = e.duplicate === true;
}
assert(duplicateCaught, "a second alert for the same user+ticker+condition is rejected at the DB level, not just in application code");

deleteAlert(bob.userId, listAlerts(alice.userId)[0].id); // bob tries to delete alice's alert by id
assert(listAlerts(alice.userId).length === 1, "bob cannot delete alice's alert even knowing its id — the query is scoped to his own user_id");

deleteAlert(alice.userId, listAlerts(alice.userId)[0].id);
assert(listAlerts(alice.userId).length === 0, "alice can delete her own alert");

console.log("\nAll checks passed — multi-tenant isolation holds.");
