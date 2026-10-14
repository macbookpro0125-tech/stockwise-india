import { useState } from "react";

// Ported from stock-screener's src/components/AddHoldingModal.jsx. The
// company name can be left blank — the server fills it from NSE's list.

const MONO = { fontVariantNumeric: "tabular-nums" };

export default function AddHoldingModal({ onSave, onClose, initial = null }) {
  const [ticker, setTicker] = useState(initial?.ticker || "");
  const [name, setName] = useState(initial?.name || "");
  const [buyPrice, setBuyPrice] = useState(initial?.buyPrice ?? "");
  const [qty, setQty] = useState(initial?.qty ?? "");
  const [buyDate, setBuyDate] = useState(initial?.buyDate || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = ticker.trim() && buyPrice > 0 && qty > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      await onSave({
        ticker: ticker.trim().toUpperCase(),
        name: name.trim(),
        buyPrice: parseFloat(buyPrice),
        qty: parseFloat(qty),
        buyDate: buyDate || null,
        notes: notes.trim(),
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const inputStyle = {
    width: "100%", height: 40, padding: "10px 12px", borderRadius: 4,
    border: "1px solid var(--bdr2)", background: "var(--s3)",
    color: "var(--t1)", fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 11.5, color: "var(--t3)", fontWeight: 600, marginBottom: 6, display: "block" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeUp 180ms ease backwards" }}>
      <form onClick={e => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: "min(440px, 92vw)", padding: 28, borderRadius: 6, border: "1px solid var(--bdr2)", background: "var(--s1)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700, color: "var(--t1)" }}>{initial ? "Edit Holding" : "Add Holding"}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label htmlFor="h-ticker" style={labelStyle}>Ticker *</label>
            <input id="h-ticker" value={ticker} onChange={e => setTicker(e.target.value)} placeholder="e.g. TCS" style={{ ...inputStyle, ...MONO }} autoFocus disabled={!!initial} />
          </div>
          <div>
            <label htmlFor="h-name" style={labelStyle}>Company Name</label>
            <input id="h-name" maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="Filled in if blank" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label htmlFor="h-price" style={labelStyle}>Buy Price (₹) *</label>
            <input id="h-price" type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="0.00" min="0.01" step="0.01" style={{ ...inputStyle, ...MONO }} />
          </div>
          <div>
            <label htmlFor="h-qty" style={labelStyle}>Quantity *</label>
            <input id="h-qty" type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" min="1" step="1" style={{ ...inputStyle, ...MONO }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="h-date" style={labelStyle}>Buy Date</label>
          <input id="h-date" type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="h-notes" style={labelStyle}>Notes</label>
          <input id="h-notes" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." style={inputStyle} />
        </div>

        {error && <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 4, padding: "8px 12px", marginBottom: 14 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ height: 36, padding: "0 18px", fontSize: 13, borderRadius: 4 }}>Cancel</button>
          <button type="submit" disabled={!valid || busy} className="btn-primary" style={{ height: 36, padding: "0 20px", fontSize: 13, borderRadius: 4, boxShadow: "none", opacity: valid ? 1 : 0.4 }}>
            {busy ? "Saving…" : initial ? "Save Changes" : "Add to Portfolio"}
          </button>
        </div>
      </form>
    </div>
  );
}
