import { useState, useEffect } from "react";
import { api } from "./api.js";

export default function AlertsView() {
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
    setError("");
    await api.deleteAlert(id);
    load();
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px" }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Your alerts</h1>
      <p style={{ fontSize: 12, color: "var(--t3)", margin: "0 0 20px", lineHeight: 1.6 }}>
        Checked against the latest daily close{alerts?.[0]?.priceDate ? ` (${new Date(`${alerts[0].priceDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })})` : ""} whenever you open this page. No email or phone notifications yet.
      </p>

      <form onSubmit={submit} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input placeholder="Ticker (e.g. TCS)" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} required style={{ flex: 1 }} />
        <select value={condition} onChange={e => setCondition(e.target.value)}>
          <option value="below">Drops to</option>
          <option value="above">Rises to</option>
        </select>
        <input type="number" placeholder="Price" value={threshold} onChange={e => setThreshold(e.target.value)} required style={{ width: 110 }} />
        <button type="submit" className="btn-primary" style={{ height: 40 }}>Add</button>
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
          {alerts.map(a => {
            const away = a.cmp != null ? Math.abs((a.threshold - a.cmp) / a.cmp) * 100 : null;
            return (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: a.triggered ? "var(--green-dim)" : "var(--s2)", border: `1px solid ${a.triggered ? "var(--green-bdr)" : "var(--bdr)"}` }}>
                <div style={{ minWidth: 0 }}>
                  <div>
                    <strong>{a.ticker}</strong>
                    <span style={{ color: "var(--t2)", marginLeft: 8 }}>
                      {a.condition === "below" ? "drops to" : "rises to"} ₹{a.threshold.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                    {a.cmp == null ? "no recent close" : `last close ₹${a.cmp.toLocaleString("en-IN")}`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {a.triggered === true && <span className="pill badge-green">Triggered</span>}
                  {a.triggered === false && away != null && <span style={{ fontSize: 11, color: "var(--t3)" }}>{away.toFixed(1)}% away</span>}
                  <button className="btn-ghost" onClick={() => remove(a.id)} style={{ height: 32, fontSize: 12 }}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
