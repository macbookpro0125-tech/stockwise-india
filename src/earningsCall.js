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
