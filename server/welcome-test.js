// The welcome email (welcome.js)
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const DB_PATH = join(tmpdir(), `welcome-test-${process.pid}.db`);
process.env.STOCKWISE_DB = DB_PATH;
const { db } = await import("./db.js");
const { welcomeEmail, sendWelcome } = await import("./welcome.js");

const m = welcomeEmail("Asha Rao");
assert.equal(m.subject, "Welcome to Jocular Insights");
assert.ok(m.text.startsWith("Hi Asha,") && /results email/.test(m.text) && /not advice/.test(m.text) && /once, because you created an account/.test(m.text));
assert.ok(!/undefined|null/.test(m.text + m.html));
assert.ok(welcomeEmail().text.startsWith("Hi,"));

const withEmail = Number(db.prepare("INSERT INTO users (email, created_at) VALUES ('w@example.test', ?)").run(new Date().toISOString()).lastInsertRowid);
const phoneOnly = Number(db.prepare("INSERT INTO users (phone, created_at) VALUES ('+910000000000', ?)").run(new Date().toISOString()).lastInsertRowid);
const sent = [];
const send = async x => { sent.push(x); };
assert.equal(await sendWelcome(withEmail, { send, configured: false }), false, "no email service, nothing sent");
assert.equal(await sendWelcome(phoneOnly, { send, configured: true }), false, "no address, nothing sent");
assert.equal(await sendWelcome(withEmail, { send, configured: true }), true);
assert.equal(sent.length, 1);
assert.equal(sent[0].to, "w@example.test");
assert.equal(await sendWelcome(withEmail, { send: async () => { throw new Error("down"); }, configured: true, log: () => {} }), false, "a failed send never throws");

db.close();
for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) if (existsSync(f)) unlinkSync(f);
console.log("welcome tests passed");
