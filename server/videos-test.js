// A company's YouTube videos (videos.js): node --no-warnings server/videos-test.js
import assert from "node:assert/strict";
import { videosFrom, companyVideos, videosOn } from "./videos.js";

delete process.env.YOUTUBE_API_KEY;
assert.equal(videosOn(), false);
assert.deepEqual(await companyVideos("TCS", "Tata Consultancy Services"), { on: false, videos: [] }, "off without a key, and nothing fetched");

const item = (id, title, extra = {}) => ({ id: { kind: "youtube#video", videoId: id }, snippet: { title, channelTitle: "Markets &amp; More", publishedAt: "2026-10-20T10:00:00Z", thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } } }, ...extra });
const v = videosFrom({ items: [
  item("abcDEF12345", "TCS Q2 results: what&#39;s next? &quot;Explained&quot;"),
  { id: { kind: "youtube#channel", channelId: "UC123" }, snippet: { title: "A channel" } },
  item("bad id!", "Not a video id"),
  item("xyz_-987654", ""),
] });
assert.equal(v.length, 1, "videos only, with a proper id and a title");
assert.deepEqual(v[0], { id: "abcDEF12345", title: 'TCS Q2 results: what\'s next? "Explained"', channel: "Markets & More", publishedAt: "2026-10-20T10:00:00Z", thumb: "https://i.ytimg.com/vi/abcDEF12345/mqdefault.jpg" });
assert.deepEqual(videosFrom(null), []);
assert.equal(videosFrom({ items: Array.from({ length: 10 }, (_, i) => item(`vid${i}abcdefg`, `Video ${i}`)) }).length, 6, "six at most");
console.log("ok: YouTube videos read from the API's answer; off without a key");
