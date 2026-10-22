// Is the site up, its app loading, and its market data fresh? (22 Oct 2026:
// nothing told the owner if jocularinsights.in went down.) Run every 30
// minutes by .github/workflows/site-watch.yml; a failed run is the alarm —
// GitHub emails the owner when a scheduled workflow fails. It looks three
// times, two minutes apart, before failing, so a deploy's half-minute gap
// or a one-off hiccup isn't an alarm.
//
//   node scripts/site-watch.mjs [https://jocularinsights.in]
import { pathToFileURL } from "node:url";

// The evening refresh runs on weekdays: Friday evening to Monday evening is
// about 72 hours, a long weekend about 96
export const STALE_HOURS = 100;

// "answered 502", or "didn't answer (timed out after 20 s)"
const said = r => (typeof r?.status === "number" ? `answered ${r.status}` : `didn't answer (${r?.status ?? "no reply"})`);

export function problems({ home, script, health }) {
  const out = [];
  if (!home?.ok) out.push(`The home page ${said(home)}.`);
  else if (!script) out.push("The home page doesn't name its app script.");
  else if (!script.ok) out.push(`The app script ${said(script)}: the page would be blank.`);
  if (!health?.ok) out.push(`The health check ${said(health)}.`);
  else {
    const h = health.body ?? {};
    if (h.ok !== true) out.push("The health check doesn't say ok.");
    if (h.snapshotAgeHours == null) out.push("There's no market data.");
    else if (h.snapshotAgeHours > STALE_HOURS) out.push(`The market data is ${Math.round(h.snapshotAgeHours)} hours old: the evening refresh has stopped.`);
    if (h.dataPull?.lastError) out.push(`Getting the evening data failed: ${h.dataPull.lastError}`);
    if (h.jobs?.lastError) out.push(`A data job failed: ${h.jobs.lastError}`);
  }
  return out;
}

async function get(url, json) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "jocular-site-watch" }, signal: AbortSignal.timeout(20_000) });
    return { ok: res.ok, status: res.status, body: json ? await res.json().catch(() => null) : await res.text() };
  } catch (e) {
    return { ok: false, status: e.name === "TimeoutError" ? "timed out after 20 s" : e.cause?.code ?? e.message };
  }
}

export async function look(site) {
  const home = await get(`${site}/`);
  const src = home.ok ? String(home.body).match(/\/assets\/index-[\w-]+\.js/)?.[0] : null;
  const script = src ? await get(`${site}${src}`) : null;
  const health = await get(`${site}/api/health`, true);
  return problems({ home, script, health });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const site = (process.argv[2] ?? "https://jocularinsights.in").replace(/\/$/, "");
  let found = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    found = await look(site);
    if (!found.length) { console.log(`${site} is up, its app loads, and its data is fresh.`); process.exit(0); }
    console.log(`Look ${attempt}: ${found.join(" ")}`);
    if (attempt < 3) await new Promise(r => setTimeout(r, 120_000));
  }
  console.error(`::error::${site} — ${found.join(" ")}`);
  process.exit(1);
}
