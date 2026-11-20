import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";

// A company's bonds and NCDs on NSE (20 Nov 2026; server/company-bonds.js):
// each one's interest rate, price against face value, maturity and the rating
// it listed with, beside what the government pays now for a loan as long.
// Facts only: no yield of our own (NSE doesn't say how often each pays, or
// whether its price includes the interest earned so far). Loaded when it
// comes into view. `quiet`: show nothing at all when it has none (a phone's
// block), else say so.

const rs = v => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const left = y => (y < 1 ? `${Math.max(1, Math.round(y * 12))} month${Math.round(y * 12) === 1 ? "" : "s"}` : `${y.toFixed(1)} years`);
const crore = v => (v >= 1 ? `₹${v.toFixed(1)} cr` : v >= 0.01 ? `₹${Math.round(v * 100)} lakh` : "under ₹1 lakh");

export default function CompanyBonds({ symbol, quiet = false, eager = false, onHas }) {
  const box = useRef(null);
  const [seen, setSeen] = useState(false);
  const [d, setD] = useState(null);
  useEffect(() => {
    setSeen(false); setD(null);
    const el = box.current;
    if (eager || !el || typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [symbol, eager]);
  useEffect(() => {
    if (!seen) return;
    let off = false;
    api.panel(symbol, "bonds").then(x => { if (!off) { setD(x); onHas?.(x?.bonds?.length > 0); } }).catch(() => { if (!off) setD({ bonds: [], failed: true }); });
    return () => { off = true; };
  }, [seen, symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const bonds = d?.bonds ?? [];
  if (quiet && d && !bonds.length) return null;
  // a zero-coupon bond pays no yearly interest (it repays more at the end): out of the range
  const rates = bonds.map(b => b.coupon).filter(v => v > 0);
  return (
    <div ref={box} className="cb">
      {!d && <p className="cb-note">Reading NSE's bond prices…</p>}
      {d && !bonds.length && <p className="cb-note">{d.failed ? "NSE's bond prices couldn't be read just now." : "None of its bonds or NCDs traded on NSE lately. It may not borrow through listed bonds, or they trade elsewhere."}</p>}
      {bonds.length > 0 && <>
        <p className="cb-sum">{bonds.length} of its bonds and NCDs trade on NSE{rates.length ? `, paying ${Math.min(...rates).toFixed(2)}% to ${Math.max(...rates).toFixed(2)}% a year in interest` : ""}.</p>
        <ul className="cb-list">
          {bonds.map(b => (
            <li key={b.isin}>
              <div className="cb-top">
                <span className="cb-who"><b>{b.coupon > 0 ? `${b.coupon.toFixed(2)}% a year` : b.coupon === 0 ? "Zero-coupon: no yearly interest" : "Interest rate not given"}</b><small>{b.symbol}{b.series ? ` · ${b.series}` : ""} · matures {day(b.maturity)} ({left(b.years)})</small></span>
                <span className="cb-px"><b>{rs(b.price)}</b><small>{b.vsFace == null ? "" : Math.abs(b.vsFace) < 0.05 ? `at its face value of ${rs(b.face)}` : `${Math.abs(b.vsFace).toFixed(1)}% ${b.vsFace > 0 ? "over" : "under"} its ${rs(b.face)} face value`}</small></span>
              </div>
              <div className="cb-meta">
                {b.govYield != null && <span>The government pays <b>{b.govYield.toFixed(2)}%</b> now for a loan as long</span>}
                <span className={b.rating ? "cb-rating" : "cb-norating"}>{b.rating ? `${b.rating.replace(/\/\s*$/, "")}${b.agency ? ` · ${b.agency}` : ""}` : "No rating in NSE's list"}</span>
                <span>Last traded {day(b.traded)}{b.valueCr ? `, ${crore(b.valueCr)}` : ""}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="cb-note">From NSE's cash market. The rating is the one the bond listed with; it may have changed since. The government's rate is RBI's{d.govAsOn ? ` as on ${d.govAsOn}` : ""}: a company paying well above it is one lenders see as riskier. Not advice to buy or sell.</p>
      </>}
    </div>
  );
}
