import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { api } from "./api.js";

// Under Quarterly results (19 Nov 2026, the owner: "we should be able to
// download that file from there itself"): the quarters as a spreadsheet, and
// each quarter's original filing on NSE — the readable version, and its PDF
// when NSE has one.

const COLS = [
  ["Quarter ended", q => q.fyEnd], ["Filed", q => q.filed ?? ""], ["Basis", q => q.scope ?? ""],
  ["Sales (₹ cr)", q => q.revenueCr], ["Expenses (₹ cr)", q => q.expensesCr], ["Operating profit (₹ cr)", q => q.operatingProfitCr],
  ["Operating margin (%)", q => q.opm], ["Other income (₹ cr)", q => q.otherIncomeCr], ["Depreciation (₹ cr)", q => q.depreciationCr],
  ["Interest (₹ cr)", q => q.financeCostsCr], ["Exceptional items (₹ cr)", q => q.exceptionalCr], ["Profit before tax (₹ cr)", q => q.pbtCr],
  ["Net profit (₹ cr)", q => q.profitCr], ["EPS (₹)", q => q.eps], ["Sales vs a year earlier (%)", q => q.salesYoY], ["Profit vs a year earlier (%)", q => q.profitYoY],
];
const cell = v => (v == null || v === "" ? "" : typeof v === "number" ? String(Math.round(v * 100) / 100) : /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const monthOf = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

export default function QuarterDownloads({ symbol, quarters }) {
  const [filings, setFilings] = useState(null);
  useEffect(() => {
    let off = false;
    setFilings(null);
    api.panel(symbol, "result-filings").then(d => { if (!off) setFilings(d?.filings ?? []); }).catch(() => { if (!off) setFilings([]); });
    return () => { off = true; };
  }, [symbol]);

  const csv = () => {
    const rows = [COLS.map(([h]) => cell(h)).join(","), ...quarters.map(q => COLS.map(([, get]) => cell(get(q))).join(","))];
    // a byte-order mark so Excel reads ₹ right (as the screen's export)
    const url = URL.createObjectURL(new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${symbol}-quarterly-results.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div className="qd">
      <button type="button" className="qd-csv" onClick={csv}><Download size={15} aria-hidden="true" />Download these quarters (spreadsheet)</button>
      <div className="qd-h">The original filings on NSE</div>
      {filings == null && <p className="qd-note">Loading…</p>}
      {filings?.length === 0 && <p className="qd-note">NSE's filings couldn't be read just now.</p>}
      {filings?.length > 0 && (
        <ul className="qd-list">
          {filings.slice(0, 8).map(f => (
            <li key={`${f.periodEnd}-${f.scope}`}>
              <span className="qd-q">Quarter to {monthOf(f.periodEnd)}<small>{f.scope}{f.filed ? ` · filed ${new Date(`${f.filed}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}` : ""}</small></span>
              <span className="qd-links">
                {f.view && <a href={f.view} target="_blank" rel="noopener noreferrer"><FileText size={14} aria-hidden="true" />View</a>}
                {f.pdf && <a href={f.pdf} target="_blank" rel="noopener noreferrer"><Download size={14} aria-hidden="true" />PDF</a>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="qd-note">The filings open on NSE's own site. The spreadsheet has the figures shown above, as filed.</p>
    </div>
  );
}
