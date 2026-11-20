// Start the evening data job ourselves (20 Nov 2026, the owner: "why is live
// still showing 19 Nov?"). GitHub's own timer (data-refresh.yml cron) has
// been starting it about 8 hours late every day, so the day's prices landed
// after midnight. This always-on server asks GitHub to run it at 16:45 and
// 20:15 IST on weekdays, only while today's close isn't in; GitHub's timer
// stays as the backup. Needs GITHUB_DISPATCH_TOKEN in Render (a fine-grained
// token for this one repository with Actions: read and write); without it,
// nothing happens.

const REPO = () => process.env.GITHUB_REPO || "macbookpro0125-tech/stockwise-india";
const WORKFLOW = "data-refresh.yml";
const SLOTS = [["16:45", "first"], ["20:15", "second"]];
const CHECK_EVERY = 5 * 60_000;

export const triggerStatus = { enabled: false, lastAt: null, lastSlot: null, lastResult: null };

const istParts = now => {
  const t = new Date(now.getTime() + 330 * 60_000);
  return { day: t.toISOString().slice(0, 10), hm: t.toISOString().slice(11, 16), weekday: t.getUTCDay() };
};

// The slot due now ("2026-11-20 first"), or null: a weekday in India, past the
// slot's time, today's close not in yet, and this slot not asked for today
export function dueSlot(now, pricesDate, asked) {
  const { day, hm, weekday } = istParts(now);
  if (weekday === 0 || weekday === 6) return null;
  if (pricesDate && pricesDate >= day) return null;
  for (const [at, name] of [...SLOTS].reverse()) {
    const key = `${day} ${name}`;
    if (hm >= at) return asked.has(key) ? null : key;
  }
  return null;
}

async function dispatch(token) {
  const res = await fetch(`https://api.github.com/repos/${REPO()}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "JocularInsights" },
    body: JSON.stringify({ ref: "main", inputs: { evening: "true" } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status !== 204) throw new Error(`GitHub said ${res.status}`);
}

export function startRefreshTrigger({ pricesDate }) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return;
  triggerStatus.enabled = true;
  const asked = new Set();
  const check = async () => {
    const slot = dueSlot(new Date(), pricesDate(), asked);
    if (!slot) return;
    asked.add(slot);
    triggerStatus.lastAt = new Date().toISOString(); triggerStatus.lastSlot = slot;
    try { await dispatch(token); triggerStatus.lastResult = "started"; console.error(`[trigger] asked GitHub to run the evening data job (${slot})`); }
    catch (e) { triggerStatus.lastResult = e.message; console.error(`[trigger] couldn't start the evening data job: ${e.message}`); }
  };
  setTimeout(check, 30_000).unref?.();
  setInterval(check, CHECK_EVERY).unref();
}
