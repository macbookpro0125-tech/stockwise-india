import { revealPart } from "./phoneTabs.js";
import { CalendarClock } from "lucide-react";
import { navigate } from "./site.jsx";
import { docTop } from "./motion.js";

// When a company page's figures are from (the server's dataDates, from the
// filings it read and the market snapshot): a line under the key figures,
// and the full list at the end of the page. Users of other screeners
// complain most about figures that lag new results without saying so, so
// every date here is the one the figures actually use.

const day = iso => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);
const short = iso => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : null);

function toList() {
  const el = document.getElementById("sec-data");
  if (!el) return;
  if (revealPart(el)) { requestAnimationFrame(() => requestAnimationFrame(toList)); return; }
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
  const bar = document.querySelector("[data-sticky-top]")?.offsetHeight ?? 0;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: docTop(el) - header - bar - 12, behavior: reduced ? "auto" : "smooth" });
}

// "Results to 30 Sep 2026, filed 8 Oct · NSE close of 19 Oct · All dates"
export function DataNote({ dates }) {
  if (!dates || (!dates.quarter && !dates.year && !dates.prices)) return null;
  const results = dates.quarter ?? dates.year;
  return (
    <p className="sd-datanote">
      {results && <>Results to {day(results.end)}{results.filed ? `, filed ${short(results.filed)}` : ""}</>}
      {results && dates.prices && " · "}
      {dates.prices && <>NSE close of {short(dates.prices)}</>}
      {" · "}<button type="button" onClick={toList}>All dates</button>
    </p>
  );
}

export default function StockDataDates({ dates, quote, research }) {
  if (!dates) return null;
  const rows = [];
  const quoteNewer = quote?.asOf && dates.prices && quote.asOf > dates.prices;
  if (dates.prices || quote?.asOf) {
    rows.push(["Share price", quoteNewer
      ? `The close of ${day(quote.asOf)} at the top of the page; returns, scores and levels use NSE's close of ${day(dates.prices)}`
      : `NSE's closing price of ${day(dates.prices ?? quote.asOf)}`]);
  }
  if (dates.quarter) rows.push(["Latest quarter", `The quarter to ${day(dates.quarter.end)}${dates.quarter.filed ? `, filed with NSE on ${day(dates.quarter.filed)}` : ""}. P/E and EPS over the last four quarters end here`]);
  if (dates.year) rows.push(["Latest audited year", `The year to ${day(dates.year.end)}${dates.year.filed ? `, filed with NSE on ${day(dates.year.filed)}` : ""}`]);
  if (research?.valuation?.asOf) rows.push(["Scores and fair value", `Worked out at the ${day(research.valuation.asOf)} close, from the results above`]);
  if (dates.read) rows.push(["Filings last read", `${day(dates.read)}. A company is read again when it files new results`]);
  if (!rows.length) return null;
  return (
    <section id="sec-data" className="ss-section sd-card sd-dates" aria-labelledby="dates-title">
      <h3 id="dates-title" className="sd-card-title"><CalendarClock size={17} aria-hidden="true" /> Where these figures come from</h3>
      <dl>
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}.</dd></div>)}
      </dl>
      <p className="sd-foot">
        Company figures are the results companies file with NSE, and returns, the chart and the latest close at the top use NSE's daily closes. NSE's prices and new filings are read each weekday evening after the close.{" "}
        <a href="/help" onClick={e => { e.preventDefault(); navigate("/help"); window.scrollTo(0, 0); }}>How the figures work</a>
      </p>
    </section>
  );
}
