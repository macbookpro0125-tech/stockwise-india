import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "./api.js";

// Ported from stock-screener's src/components/StockSearchBar.jsx: type a
// symbol or company name, pick from NSE's list, and see recent searches when
// the box is empty.

const HISTORY_KEY = "stockwise_india_search_history";
const MAX_HISTORY = 15;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}

function saveToHistory(ticker, name) {
  const history = loadHistory().filter(h => h.ticker !== ticker);
  history.unshift({ ticker, name, at: Date.now() });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  return history;
}

function removeFromHistory(ticker) {
  const history = loadHistory().filter(h => h.ticker !== ticker);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  return history;
}

export default function StockSearchBar({ onAnalyze, placeholder = "Search any stock…" }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [history, setHistory] = useState(loadHistory);
  const containerRef = useRef(null);
  const latest = useRef("");

  useEffect(() => {
    // pointerdown, not mousedown: dismisses reliably on touchscreens too
    const handler = e => { if (containerRef.current && !containerRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  const fetchSuggestions = async q => {
    latest.current = q;
    if (!q) { setSuggestions([]); return; }
    try {
      const data = await api.search(q);
      if (latest.current === q) setSuggestions(data); // a slower earlier reply mustn't overwrite a newer one
    } catch { setSuggestions([]); }
  };

  const handleChange = e => {
    const v = e.target.value;
    setQuery(v);
    setHighlightIdx(-1);
    setShowSuggestions(true);
    fetchSuggestions(v.trim());
  };

  const handleSelect = useCallback(s => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setHistory(saveToHistory(s.ticker, s.name));
    onAnalyze(s.ticker);
  }, [onAnalyze]);

  // Enter on free text: the top suggestion if there is one, else the text as a symbol
  const submitText = () => {
    const top = suggestions[0];
    if (top) handleSelect(top);
    else if (query.trim()) { onAnalyze(query.trim().toUpperCase()); setQuery(""); setShowSuggestions(false); }
  };

  const handleKeyDown = e => {
    const items = query ? suggestions : history;
    if (e.key === "Enter") {
      e.preventDefault();
      if (showSuggestions && highlightIdx >= 0 && items[highlightIdx]) handleSelect(items[highlightIdx]);
      else submitText();
      return;
    }
    if (!showSuggestions || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Escape") setShowSuggestions(false);
  };

  const showingHistory = !query && showSuggestions && history.length > 0;
  const showingResults = showSuggestions && query && suggestions.length > 0;
  const items = showingHistory ? history : showingResults ? suggestions : [];

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span style={{ position: "absolute", left: 12, color: "var(--t3)", fontSize: 14, pointerEvents: "none" }}>⌕</span>
        <input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if ((query && suggestions.length) || (!query && history.length)) setShowSuggestions(true); }}
          placeholder={placeholder}
          autoComplete="off"
          className="input-base"
          style={{ width: "100%", paddingLeft: 34, height: 38, fontSize: 13, borderRadius: 10 }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setSuggestions([]); }} style={{ position: "absolute", right: 10, background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 12, zIndex: 200, boxShadow: "var(--sh-lg)", overflow: "hidden" }}>
          {showingHistory && (
            <div style={{ padding: "6px 14px 4px", fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Recent searches</span>
              <button onPointerDown={e => { e.preventDefault(); try { localStorage.removeItem(HISTORY_KEY); } catch {} setHistory([]); setShowSuggestions(false); }} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 10, padding: 0 }}>Clear all</button>
            </div>
          )}
          {items.map((s, idx) => (
            <div key={s.ticker} onPointerDown={() => handleSelect(s)} onMouseEnter={() => setHighlightIdx(idx)} onMouseLeave={() => setHighlightIdx(-1)}
              style={{ padding: "10px 14px", cursor: "pointer", background: idx === highlightIdx ? "var(--s3)" : "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: idx < items.length - 1 ? "1px solid var(--bdr)" : "none", transition: "background 80ms" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                {showingHistory && <span style={{ fontSize: 12, color: "var(--t3)" }}>↻</span>}
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "SF Mono,monospace" }}>{s.ticker}</span>
                {showingHistory && (
                  <button onPointerDown={e => { e.stopPropagation(); e.preventDefault(); setHistory(removeFromHistory(s.ticker)); }} title="Remove from history" style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 12, padding: "0 2px", lineHeight: 1 }}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
