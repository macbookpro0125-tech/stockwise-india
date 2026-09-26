import { useState, useEffect } from "react";
import { api } from "./api.js";

export default function AlertsView({ onLogout }) {
  const [alerts, setAlerts] = useState(null); // null = loading, [] = loaded-and-empty
  const [ticker, setTicker] = useState("");
  const [condition, setCondition] = useState("below");
  const [threshold, setThreshold] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = () => {
    api.listAlerts().then(setAlerts).catch(e => setLoadError(e.message));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.createAlert({ ticker, condition, threshold: Number(threshold) });
      setTicker(""); setThreshold("");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    await api.deleteAlert(id);
    load();
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Your alerts</h1>
        <button className="btn-ghost" onClick={onLogout}>Sign out</button>
      </div>

      <form onSubmit={submit} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input placeholder="Ticker (e.g. TCS)" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} required style={{ flex: 1 }} />
        <select value={condition} onChange={e => setCondition(e.target.value)} style={{ height: 38, borderRadius: 8, border: "1px solid var(--bdr)", background: "var(--s1)", color: "var(--t1)" }}>
          <option value="below">Drops to</option>
          <option value="above">Rises to</option>
        </select>
        <input type="number" placeholder="Price" value={threshold} onChange={e => setThreshold(e.target.value)} required style={{ width: 110 }} />
        <button type="submit" className="btn-primary">Add</button>
      </form>
      {error && (
        <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 8, padding: "8px 12px", marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loadError ? (
        <div style={{ color: "var(--red)", fontSize: 13 }}>Couldn't load alerts: {loadError}</div>
      ) : alerts === null ? (
        <div style={{ color: "var(--t3)", fontSize: 13 }}>Loading…</div>
      ) : alerts.length === 0 ? (
        <div style={{ color: "var(--t3)", fontSize: 13, padding: "20px 0" }}>
          No alerts yet — add a ticker and a target price above to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map(a => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 10, background: "var(--s2)", border: "1px solid var(--bdr)" }}>
              <div>
                <strong>{a.ticker}</strong>
                <span style={{ color: "var(--t2)", marginLeft: 8 }}>
                  {a.condition === "below" ? "drops to" : "rises to"} ₹{a.threshold}
                </span>
              </div>
              <button className="btn-ghost" onClick={() => remove(a.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
