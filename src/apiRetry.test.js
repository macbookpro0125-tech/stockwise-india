// Riding out a deploy (api.js request): node src/apiRetry.test.js
// While Render swaps the server it answers with its own HTML 502 page; the
// request never reached us, so the app waits and tries again. Our own errors
// are JSON and come straight back.
import assert from "node:assert/strict";
import { request, onReconnecting, setRetryDelays } from "./api.js";

setRetryDelays([1, 1, 1]); // milliseconds, for the test
const html502 = () => new Response("<html>502 Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } });
const ok = body => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const states = [];
onReconnecting(on => states.push(on));

function fakeFetch(replies) {
  const calls = [];
  globalThis.fetch = async (path, opts) => {
    calls.push(opts?.method ?? "GET");
    const r = replies.shift();
    if (r instanceof Error) throw r;
    return r();
  };
  return calls;
}

{
  const calls = fakeFetch([html502, html502, () => ok({ hello: 1 })]);
  assert.deepEqual(await request("/api/x"), { hello: 1 });
  assert.equal(calls.length, 3);
  assert.deepEqual(states.splice(0), [true, false], "the notice shows while retrying, then goes");
  console.log("ok: Render's 502 page during a deploy is waited out");
}
{
  const calls = fakeFetch([() => new Response(JSON.stringify({ error: "NSE didn't answer" }), { status: 502, headers: { "content-type": "application/json" } })]);
  await assert.rejects(request("/api/stock/TCS"), /NSE didn't answer/);
  assert.equal(calls.length, 1);
  assert.deepEqual(states.splice(0), []);
  console.log("ok: our own 502 (an upstream failure, as JSON) comes straight back");
}
{
  const calls = fakeFetch([html502, () => ok({ saved: true })]);
  assert.deepEqual(await request("/api/watchlist", { method: "POST", body: "{}" }), { saved: true });
  assert.deepEqual(calls, ["POST", "POST"], "a POST is sent again: the gateway answered, so the server never saw it");
  states.splice(0);
  console.log("ok: a save during a deploy is sent again once the server is back");
}
{
  // Offline or a dropped connection isn't a deploy (Render answers then, with
  // its page): it comes straight back, so the app can say it's offline
  const calls = fakeFetch([new TypeError("Failed to fetch"), () => ok({ n: 2 })]);
  await assert.rejects(request("/api/y"), /Failed to fetch/);
  assert.equal(calls.length, 1);
  assert.deepEqual(states.splice(0), []);
  console.log("ok: a dropped connection isn't waited on — offline shows as offline");
}
{
  const calls = fakeFetch([html502, html502, html502, html502]);
  await assert.rejects(request("/api/x"), /updating|try again/i);
  assert.equal(calls.length, 4, "the first try and three retries, then it gives up");
  assert.deepEqual(states.splice(0), [true, false]);
  console.log("ok: after the retries it gives up with a plain message");
}
