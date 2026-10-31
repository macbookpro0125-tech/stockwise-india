import { Suspense, useEffect, useState } from "react";
import { lazyPage } from "./lazyPage.js";
import { api } from "./api.js";
const CompareView = lazyPage(() => import("./CompareView.jsx"));

// Compare from anywhere (31 Oct 2026): a company page's peers, the watchlist.
// Fetches the table's rows for the companies named (two to five), then opens
// the same side-by-side view the Workspace's ticks open.
export default function CompareFor({ symbols, onClose }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let off = false;
    api.compareRows(symbols).then(r => { if (!off) setD(r); }).catch(e => { if (!off) setError(e.message || "Couldn't load them"); });
    return () => { off = true; };
  }, [symbols.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <div role="alert" className="compare-loading" onClick={onClose}>{error}</div>;
  if (!d) return <div role="status" className="compare-loading">Loading comparison…</div>;
  const stocks = d.results.filter(r => !r.missing);
  return (
    <Suspense fallback={<div role="status" className="compare-loading">Loading comparison…</div>}>
      <CompareView stocks={stocks} pricesDate={d.snapshot?.pricesDate} onClose={onClose} />
    </Suspense>
  );
}
