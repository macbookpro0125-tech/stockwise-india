// A company's recent YouTube videos, for its page's "Around the web" (24 Oct
// 2026). From YouTube's own Data API, so off unless the server has
// YOUTUBE_API_KEY (set in Render, never in the repository; a free key from
// Google Cloud). A search costs 100 of the key's 10,000 free units a day, so
// each company's are kept for a day. The videos play in YouTube's own player
// (src/AroundTheWeb.jsx); only their title, channel, date and thumbnail come here.

import { fetchJson } from "./upstream.js";
import { cached } from "./company-extras.js";

const DAY = 86_400_000;
const MAX = 6;

export const videosOn = () => !!process.env.YOUTUBE_API_KEY;

// YouTube's titles come with HTML entities (&amp; &#39; &quot;)
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
const decode = s => String(s ?? "").replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, e) => ENTITIES[e]).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

// The API's search response, as the page shows it
export function videosFrom(response) {
  return (response?.items ?? [])
    .filter(i => i?.id?.kind === "youtube#video" && /^[\w-]{6,20}$/.test(i.id.videoId ?? ""))
    .map(i => ({
      id: i.id.videoId,
      title: decode(i.snippet?.title),
      channel: decode(i.snippet?.channelTitle) || null,
      publishedAt: i.snippet?.publishedAt ?? null,
      thumb: i.snippet?.thumbnails?.medium?.url ?? i.snippet?.thumbnails?.high?.url ?? i.snippet?.thumbnails?.default?.url ?? null,
    }))
    .filter(v => v.title)
    .slice(0, MAX);
}

// name: as people write it (src/webLinks.js searchName); the last six months, in English, for India
export async function companyVideos(symbol, name, now = Date.now()) {
  if (!videosOn()) return { on: false, videos: [] };
  return cached(`videos:${symbol}`, DAY, async () => {
    const params = new URLSearchParams({
      part: "snippet", type: "video", maxResults: String(MAX), order: "relevance", safeSearch: "strict",
      regionCode: "IN", relevanceLanguage: "en", publishedAfter: new Date(now - 182 * DAY).toISOString(),
      q: `"${name}" share`, key: process.env.YOUTUBE_API_KEY,
    });
    const data = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params}`, { service: "YouTube", timeoutMs: 10_000 });
    return { on: true, videos: videosFrom(data) };
  });
}
