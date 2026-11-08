// "Updated 6 Nov 2026, 6:40 pm IST · prices to the NSE close on 6 Nov" under
// a data page's heading (8 Nov 2026, a review: freshness is what makes market
// data trusted): the time the evening build ran, from the data itself
import { loadMarketSnapshot } from "./market-data.js";

const IST = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export function updatedText(snap = loadMarketSnapshot()) {
  if (!snap?.builtAt) return null;
  const at = `${IST.format(new Date(snap.builtAt)).replace(/ (am|pm)$/i, (_, x) => ` ${x.toLowerCase()}`)} IST`;
  return `Updated ${at}${snap.pricesDate ? ` · prices to the NSE close on ${DAY.format(new Date(`${snap.pricesDate}T00:00:00Z`))}` : ""}`;
}
export const updatedLine = () => { const t = updatedText(); return t ? `<p class="seo-updated">${t.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</p>` : ""; };
