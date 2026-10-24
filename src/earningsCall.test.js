// The latest earnings call among a company's NSE announcements (earningsCall.js)
// node src/earningsCall.test.js
import assert from "node:assert/strict";
import { latestCall, callHistory } from "./earningsCall.js";

const ann = (date, title, summary, url = `https://nsearchives.nseindia.com/${date}.pdf`) => ({ date, title, summary, url });
const tcs = [
  ann("16-Oct-2026 16:29:00", "Analysts/Institutional Investor Meet/Con. Call Updates", "Tata Consultancy Services Limited has informed the Exchange about Schedule of meet"),
  ann("15-Oct-2026 10:00:00", "Board Meeting Outcome", "Results for the quarter"),
  ann("14-Oct-2026 16:00:08", "Analysts/Institutional Investor Meet/Con. Call Updates", "Tata Consultancy Services Limited has informed the Exchange about Transcript"),
  ann("08-Oct-2026 22:38:59", "Analysts/Institutional Investor Meet/Con. Call Updates", "Tata Consultancy Services Limited has informed the Exchange about Link of Recording"),
  ann("20-Jul-2026 16:00:00", "Analysts/Institutional Investor Meet/Con. Call Updates", "Tata Consultancy Services Limited has informed the Exchange about Transcript"),
];
{
  const c = latestCall(tcs);
  assert.equal(c.transcript.index, 2, "its place in the list, for the attachment reader");
  assert.equal(c.transcript.date, "2026-10-14");
  assert.equal(c.recording.index, 3);
  console.log("ok: the newest transcript and recording, by their place in the announcements");
}
{
  const infy = [ann("28-Jul-2026 20:24:53", "Updates", "Infosys Limited has informed the Exchange regarding 'Earnings Call Transcript'.")];
  assert.equal(latestCall(infy).transcript.date, "2026-07-28");
  assert.equal(latestCall(infy).recording, null);
  const itc = [ann("09-Sep-2026 11:09:57", "Analysts/Institutional Investor Meet/Con. Call Updates", "ITC Limited has informed the Exchange about Schedule of meet")];
  assert.deepEqual(latestCall(itc), { transcript: null, recording: null });
  assert.deepEqual(latestCall([ann("01-Oct-2026 10:00:00", "Updates", "Transcript", null)]), { transcript: null, recording: null }, "no attachment, nothing to read");
  console.log("ok: other wordings; a schedule of meetings isn't a transcript");
}

{
  // every call, its recording beside it; presentations; a call announced since
  const h = callHistory([
    ann("16-Oct-2026 16:29:00", "Analysts/Institutional Investor Meet/Con. Call Updates", "Tata Consultancy Services Limited has informed the Exchange about Schedule of meet"),
    ann("15-Oct-2026 10:00:00", "Investor Presentation", "Tata Consultancy Services Limited has informed the Exchange about Investor Presentation"),
    ann("14-Oct-2026 16:00:08", "Analysts/Institutional Investor Meet/Con. Call Updates", "Tata Consultancy Services Limited has informed the Exchange about Transcript"),
    ann("09-Oct-2026 22:38:59", "Analysts/Institutional Investor Meet/Con. Call Updates", "Tata Consultancy Services Limited has informed the Exchange about Link of Recording"),
    ann("20-Jul-2026 16:00:00", "Analysts/Institutional Investor Meet/Con. Call Updates", "Tata Consultancy Services Limited has informed the Exchange about Transcript"),
    ann("02-May-2026 16:00:00", "Analysts/Institutional Investor Meet/Con. Call Updates", "Tata Consultancy Services Limited has informed the Exchange about Link of Recording"),
  ]);
  assert.deepEqual(h.calls.map(c => [c.transcript.date, c.recording?.date ?? null]), [["2026-10-14", "2026-10-09"], ["2026-07-20", null]], "a recording more than three weeks before isn't that call's");
  assert.deepEqual(h.presentations.map(p => p.date), ["2026-10-15"]);
  assert.equal(h.scheduled.date, "2026-10-16", "a meet scheduled after the latest transcript");
  assert.equal(callHistory([ann("01-Oct-2026 10:00:00", "Analysts/Institutional Investor Meet/Con. Call Updates", "X has informed the Exchange about Schedule of meet"), ann("14-Oct-2026 10:00:00", "Updates", "Transcript")]).scheduled, null, "one before the latest transcript has been held");
  assert.deepEqual(callHistory(null), { calls: [], presentations: [], scheduled: null });
  console.log("ok: every call with its recording, the presentations, and a call announced since");
}
