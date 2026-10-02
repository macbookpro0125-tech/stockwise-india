import assert from "node:assert/strict";
import { fetchJson, fetchText, UpstreamError } from "./upstream.js";

let calls = 0;
const retried = await fetchJson("https://example.test/data", {
  service: "fixture",
  retries: 1,
  fetchImpl: async () => ++calls === 1 ? new Response("busy", { status: 503 }) : new Response('{"ok":true}', { status: 200 }),
});
assert.deepEqual(retried, { ok: true });
assert.equal(calls, 2);
console.log("ok: transient upstream 503 is retried once");

calls = 0;
const missing = await fetchText("https://example.test/missing", {
  notFoundAsNull: true,
  retries: 1,
  fetchImpl: async () => { calls++; return new Response("", { status: 404 }); },
});
assert.equal(missing, null);
assert.equal(calls, 1);
console.log("ok: expected archive 404 is not retried");

calls = 0;
await assert.rejects(fetchText("https://example.test/large", {
  maxBytes: 5,
  retries: 1,
  fetchImpl: async () => { calls++; return new Response("123456"); },
}), error => error instanceof UpstreamError && error.code === "UPSTREAM_TOO_LARGE");
assert.equal(calls, 1);
console.log("ok: oversized upstream responses are rejected without retry");

calls = 0;
const recovered = await fetchText("https://example.test/timeout", {
  retries: 1,
  fetchImpl: async () => {
    calls++;
    if (calls === 1) throw new DOMException("timed out", "TimeoutError");
    return new Response("available");
  },
});
assert.equal(recovered, "available");
assert.equal(calls, 2);
console.log("ok: timed-out upstream requests retry once");

await assert.rejects(fetchJson("https://example.test/bad-json", {
  retries: 0,
  fetchImpl: async () => new Response("not-json"),
}), error => error instanceof UpstreamError && error.code === "UPSTREAM_INVALID_JSON");
console.log("ok: invalid upstream JSON becomes a typed dependency error");

const originalFetch = globalThis.fetch;
const originalNow = Date.now;
let now = Date.UTC(2026, 9, 2, 12);
Date.now = () => now;
globalThis.fetch = async () => new Response(JSON.stringify({ chart: { result: [{
  timestamp: [Date.UTC(2026, 9, 1, 12) / 1000],
  indicators: { quote: [{ close: [123.45] }] },
}] } }), { headers: { "content-type": "application/json" } });
try {
  const { fetchCmp } = await import("./quote.js");
  const live = await fetchCmp("UPSTREAMFIXTURE");
  assert.equal(live.cmp, 123.45);
  now += 16 * 60 * 1000;
  globalThis.fetch = async () => { throw new TypeError("simulated network outage"); };
  const fallback = await fetchCmp("UPSTREAMFIXTURE");
  assert.equal(fallback.cmp, 123.45);
  assert.equal(fallback.stale, true);
  console.log("ok: quote refresh failure serves the last quote marked stale");
} finally {
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
}
