// An earnings call in a few points (call-summary.js): node --no-warnings server/call-summary-test.js
import assert from "node:assert/strict";
import { checkPoints, transcriptText, summarizeCall } from "./call-summary.js";

const pages = [
  { page: 1, text: "Welcome to the Q2 FY27 earnings call. ".repeat(10) },
  { page: 3, text: "CFO: Revenue grew 6.2% to Rs 65,799 crore. Operating margin was 25.1%. ".repeat(5) },
  { page: 5, text: "CEO: Deal wins were USD 10.2 billion. We expect demand to improve in H2. Headcount fell by 1,200. ".repeat(5) },
];
const transcript = transcriptText(pages);
assert.ok(transcript.startsWith("[Page 1]\n") && transcript.includes("[Page 5]"), "each page marked");

const good = [
  "- The CFO said revenue grew 6.2% to Rs 65,799 crore (p. 3)",
  "- Operating margin was 25.1%, the CFO said (p. 3)",
  "- The CEO said deal wins were USD 10.2 billion and management expects demand to improve in H2 (p. 5)",
  "- Headcount fell by 1,200, management said (p. 5)",
].join("\n");
const ok = checkPoints(good, transcript, 5);
assert.ok(ok.ok, ok.why);
assert.deepEqual(ok.points.map(p => p.page), [3, 3, 5, 5]);
assert.equal(ok.points[0].text, "The CFO said revenue grew 6.2% to Rs 65,799 crore");

const bad = (lines, why) => { const c = checkPoints(lines.join("\n"), transcript, 5); assert.equal(c.ok, false, why); return c.why; };
bad(["- Revenue grew 9.9% (p. 3)", "- Margin 25.1% (p. 3)", "- Deals 10.2 billion (p. 5)"], "a number the transcript doesn't have");
bad(["- Revenue grew 6.2% (p. 3)", "- Margin 25.1% (p. 3)", "- A good time to buy the shares (p. 5)"], "advice");
bad(["- Revenue grew 6.2% (p. 3)", "- Margin 25.1% (p. 3)", "- Deals 10.2 billion (p. 9)"], "a page it doesn't have");
bad(["- Revenue grew 6.2%", "- Margin 25.1% (p. 3)", "- Deals 10.2 billion (p. 5)"], "a point without its page");
bad(["- Revenue grew 6.2% (p. 3)", "- Margin 25.1% (p. 3)"], "fewer than three");
bad(["Here is the summary:", "- Revenue grew 6.2% (p. 3)", "- Margin 25.1% (p. 3)", "- Deals 10.2 billion (p. 5)"], "anything but points");

// the whole run: off without a client; a stand-in client and reader; kept, so one request per call
assert.deepEqual(await summarizeCall("TCS", "TCS", { url: "u0" }, { client: null }), { points: null, reason: "off" });
let calls = 0, sent = "";
const client = { beta: { messages: { create: async req => { calls++; sent = req.messages[0].content; return { stop_reason: "end_turn", model: "m", content: [{ type: "text", text: good }], usage: {} }; } } } };
const read = async () => ({ pages, pageCount: 5 });
const filing = { url: "https://nsearchives.nseindia.com/t.pdf", date: "14-Oct-2026" };
const first = await summarizeCall("TCS", "Tata Consultancy Services", filing, { client, read });
assert.equal(first.points.length, 4);
assert.ok(sent.includes("<transcript>") && sent.includes("[Page 3]"), "the transcript sent as marked data");
await summarizeCall("TCS", "Tata Consultancy Services", filing, { client, read });
assert.equal(calls, 1, "kept: the same call isn't summarised twice");
// a reply that fails the checks shows nothing
const strays = { beta: { messages: { create: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "- Profit up 99% (p. 3)\n- x (p. 3)\n- y (p. 3)" }], usage: {} }) } } };
assert.deepEqual(await summarizeCall("TCS", "TCS", { url: "u2" }, { client: strays, read }), { points: null, reason: "unavailable" });
// a scanned transcript with no text
assert.deepEqual(await summarizeCall("TCS", "TCS", { url: "u3" }, { client, read: async () => ({ pages: [{ page: 1, text: "" }], pageCount: 1 }) }), { points: null, reason: "unreadable" });
console.log("ok: a call's points are checked against the transcript (numbers, pages, no advice) and kept");
