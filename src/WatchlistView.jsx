import { useState, useEffect } from "react";
import { api } from "./api.js";
import ResultsTable from "./ResultsTable.jsx";
import { useWatchlist, toggleWatch } from "./watchlist.js";

// Starred stocks in the same table as Discover — score, buy phases, 52-week
// range. Unstarring a row removes it straight away.
export default function WatchlistView({ onOpenStock }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const watched = useWatchlist();

  useEffect(() => {
    api.watchlist().then(setData).catch(e => setError(e.message));
  }, []);

  const rows = data?.results.filter(r => watched.has(r.symbol)) ?? null;
  const scored = rows?.filter(r => !r.missing) ?? null;
  const missing = rows?.filter(r => r.missing) ?? [];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px 80px" }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Watchlist</h1>
      <p style={{ fontSize: 12, color: "var(--t3)", margin: "0 0 8px" }}>
        Star any stock in Discover or on its page to follow it here. Saved to your account.
      </p>

      {error && (
        <div style={{ padding: "14px 18px", borderRadius: 12, background: "var(--red-dim)", border: "1px solid var(--red-bdr)", color: "var(--red)", fontSize: 13 }}>
          Couldn't load your watchlist: {error}
        </div>
      )}

      {!error && (
        <ResultsTable
          matches={scored}
          loading={!data}
          onAnalyze={onOpenStock}
          totalMatches={scored?.length ?? null}
          snapshot={data?.snapshot}
          noun={scored?.length === 1 ? "stock" : "stocks"}
          emptyTitle={missing.length ? "No scored stocks yet" : "Your watchlist is empty"}
          emptyHint="Tap the ☆ on any stock in Discover to add it"
        />
      )}

      {missing.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--t3)" }}>
          No usable filings for:{" "}
          {missing.map(r => (
            <span key={r.symbol} style={{ marginRight: 10 }}>
              <strong style={{ color: "var(--t2)" }}>{r.symbol}</strong>{" "}
              <button onClick={() => toggleWatch(r.symbol)} className="btn-ghost" style={{ height: 24, padding: "0 8px", fontSize: 11 }}>remove</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
