// "Tell me when a company joins my screen" (screen-alerts.js)
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.STOCKWISE_DB = join(mkdtempSync(join(tmpdir(), "stockwise-screen-alerts-")), "test.db");
const { db } = await import("./db.js");
const { saveStrategies, listStrategies } = await import("./user-notes.js");
const { notifyScreenArrivals, screenArrivalsPush, screenArrivalsTelegram } = await import("./screen-alerts.js");

const user = Number(db.prepare("INSERT INTO users (email, password_hash, password_salt, created_at) VALUES ('a@example.test', 'x', 'y', 'now')").run().lastInsertRowid);
db.prepare("UPDATE users SET telegram_chat_id = '42' WHERE id = ?").run(user);
saveStrategies(user, [
  { id: "custom_1", name: "My value screen", custom: true, filters: [{ id: "pe", max: 20 }], notify: true },
  { id: "custom_2", name: "Quiet one", custom: true, filters: [{ id: "roce", min: 20 }] },
]);
assert.equal(listStrategies(user)[0].notify, true, "the switch is kept");
assert.equal(listStrategies(user)[1].notify, undefined, "and only when on");

let matches = { custom_1: ["TCS", "INFY"], custom_2: ["SBIN"] };
const matching = req => (req.filters[0].id === "pe" ? matches.custom_1 : matches.custom_2);
const nameOf = s => ({ TCS: "TCS", INFY: "Infosys", WIPRO: "Wipro", HCLTECH: "HCL Tech", SBIN: "SBI" })[s] ?? s;
const sentTg = [], sentPush = [];
const run = date => notifyScreenArrivals({ pricesDate: date, matching, nameOf, send: async (chat, html) => sentTg.push({ chat, html }), push: async (uid, m) => { sentPush.push(m); return true; }, log: () => {} });

// first check: the baseline only, no message about everything at once
let r = await run("2026-10-30");
assert.equal(r.users, 1); assert.equal(sentTg.length, 0);
// the same day again: not checked twice
r = await run("2026-10-30");
assert.equal(r.users, 0);
// next day: WIPRO joins the value screen, SBIN's quiet screen gains HCLTECH (not switched on)
matches = { custom_1: ["TCS", "INFY", "WIPRO"], custom_2: ["SBIN", "HCLTECH"] };
r = await run("2026-11-02");
assert.equal(r.sent, 1);
assert.equal(sentTg.length, 1);
assert.equal(String(sentTg[0].chat), "42");
assert.match(sentTg[0].html, /<b>My value screen<\/b>: Wipro/);
assert.doesNotMatch(sentTg[0].html, /Quiet one|HCL/, "a screen without the switch says nothing");
// a phone isn't on file: no push
assert.equal(sentPush.length, 0);
// the next day: nothing new, nothing sent
r = await run("2026-11-03");
assert.equal(sentTg.length, 1);

// the messages
assert.deepEqual(screenArrivalsPush([{ screen: "Breaking Out", symbols: ["TCS"] }], nameOf).title, "TCS joined “Breaking Out”");
const many = screenArrivalsPush([{ screen: "A", symbols: ["TCS", "INFY", "WIPRO", "SBIN"] }, { screen: "B", symbols: ["HCLTECH"] }], nameOf);
assert.equal(many.title, "5 new companies in your screens");
assert.equal(many.body, "A: TCS, Infosys, Wipro and 1 more · B: HCL Tech");
assert.equal(screenArrivalsPush([], nameOf), null);
assert.match(screenArrivalsTelegram([{ screen: "<b>x</b>", symbols: ["TCS"] }], nameOf), /&lt;b&gt;x&lt;\/b&gt;/, "a screen's name is escaped");
console.log("screen-alerts ok");
