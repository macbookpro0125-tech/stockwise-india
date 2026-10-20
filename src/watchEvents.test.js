// The Watchlist's "coming up" line (watchEvents.js): node src/watchEvents.test.js
import assert from "node:assert/strict";
import { nextEvent } from "./watchEvents.js";

const TODAY = "2026-10-20";
const action = (date, title) => ({ date, kind: "action", title });
const board = (date, title) => ({ date, kind: "board", title });

{
  // The soonest event in the next two weeks; results meetings are left to
  // the results line, past and far-off events are skipped
  const e = nextEvent({ events: [
    action("2026-10-14", "Interim Dividend - Rs 12 Per Share"),
    board("2026-10-23", "Board meeting: financial results, dividend"),
    action("2026-10-30", "Dividend - Rs 12.50 Per Share"),
    action("2026-11-20", "Bonus 1:1"),
  ] }, TODAY);
  assert.deepEqual(e, { date: "2026-10-30", kind: "dividend", text: "Ex-dividend 30 Oct · ₹12.5 a share" });
  console.log("ok: the soonest event in two weeks, results meetings and old or far events skipped");
}
{
  // Ordinary and special dividends on one line add up
  assert.equal(nextEvent({ events: [action("2026-10-27", "Dividend - Rs 5 Per Share/Special Dividend - Re 0.50 Per Share")] }, TODAY).text, "Ex-dividend 27 Oct · ₹5.5 a share");
  assert.equal(nextEvent({ events: [action("2026-10-20", "Dividend - Re 1 Per Share")] }, TODAY).text, "Ex-dividend today · ₹1 a share");
  console.log("ok: dividend amounts added up, and 'today' on the day");
}
{
  // Bonus, split, rights, buyback and a board meeting about something else
  const one = (e) => nextEvent({ events: [e] }, TODAY)?.text;
  assert.equal(one(action("2026-10-28", "Bonus 1:1")), "Ex-bonus 1:1 · 28 Oct");
  assert.equal(one(action("2026-10-28", "Face Value Split (Sub-Division) - From Rs 10/- Per Share To Re 1/- Per Share")), "Ex-split · 28 Oct");
  assert.equal(one(action("2026-10-28", "Rights 1:5 @ Premium Rs 90/-")), "Rights issue 1:5 · ex-date 28 Oct");
  assert.equal(one(action("2026-10-28", "Buy Back")), "Buyback · ex-date 28 Oct");
  assert.equal(one(action("2026-10-28", "Demerger")), "Demerger · ex-date 28 Oct");
  assert.equal(one(board("2026-10-24", "Board meeting: fund raising, other business matters")), "Board meeting 24 Oct: fund raising, other business matters");
  console.log("ok: bonus, split, rights, buyback, other actions and board meetings worded");
}
{
  // Nothing to say
  assert.equal(nextEvent({ events: [] }, TODAY), null);
  assert.equal(nextEvent({ events: null }, TODAY), null);
  assert.equal(nextEvent(null, TODAY), null);
  assert.equal(nextEvent({ events: [board("2026-10-22", "Board meeting: financial results")] }, TODAY), null);
  console.log("ok: no line when there's nothing coming up");
}
