// The latest earnings call among a company's NSE announcements (newest
// first, as the filings panel gets them): the transcript companies must file
// after the call, and the link to its recording, each with its place in the
// list so the attachment reader (/filings/:index/summary) can open it. A
// "schedule of meet" notice is the call announced, not held, and is skipped.

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const isoOf = s => {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(String(s ?? ""));
  return m && MONTHS[m[2]] ? `${m[3]}-${String(MONTHS[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};

export function latestCall(announcements) {
  const find = re => {
    const index = (announcements ?? []).findIndex(a => a?.url && re.test(`${a.title ?? ""} ${a.summary ?? ""}`));
    if (index < 0) return null;
    const a = announcements[index];
    return { index, date: isoOf(a.date), url: a.url, summary: a.summary ?? a.title };
  };
  return { transcript: find(/transcript/i), recording: find(/recording/i) };
}

// Every call among the announcements (24 Oct 2026: "show past calls,
// presentations, upcoming calls"): each transcript, newest first, with the
// recording filed nearest it; the investor presentations; and a call
// announced since the latest transcript (a "schedule of meet" with nothing
// after it), as NSE's notice rarely says the date itself.
const PRESENTATION = /investor presentation|earnings presentation|analysts? presentation|presentation (made|to (the )?analysts|for investors)|corporate presentation/i;
const SCHEDULE = /schedule of (analyst|investor|the )?meet|intimation of (analysts?|investors?) (meet|call)|earnings call (on|scheduled)|conference call (on|scheduled)/i;
const DAY = 86_400_000;

export function callHistory(announcements) {
  const list = (announcements ?? []).map((a, index) => ({ a, index, text: `${a?.title ?? ""} ${a?.summary ?? ""}`, date: isoOf(a?.date) }));
  const item = ({ a, index, date }) => ({ index, date, url: a.url, summary: a.summary ?? a.title });
  const transcripts = list.filter(x => x.a?.url && /transcript/i.test(x.text));
  const recordings = list.filter(x => x.a?.url && /recording/i.test(x.text));
  const calls = transcripts.map(t => {
    // a recording is filed on the call's day, so before the transcript, within three weeks
    const rec = recordings.find(r => r.date && t.date && r.date <= t.date && Date.parse(t.date) - Date.parse(r.date) <= 21 * DAY);
    return { transcript: item(t), recording: rec ? item(rec) : null };
  });
  const presentations = list.filter(x => x.a?.url && PRESENTATION.test(x.text)).map(item);
  // a call announced after the newest transcript (or with none on file)
  const latest = transcripts[0]?.date ?? "";
  const scheduled = list.find(x => SCHEDULE.test(x.text) && x.date && x.date > latest);
  return { calls, presentations, scheduled: scheduled ? item(scheduled) : null };
}
