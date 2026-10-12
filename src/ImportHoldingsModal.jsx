import { useEffect, useState } from "react";
import { X, Upload, Check } from "lucide-react";
import { api } from "./api.js";
import { readHoldingsFile } from "./holdingsFile.js";

// Holdings from a broker's export file — Zerodha Console or Kite, Groww,
// Upstox, Angel One, any CSV or Excel with a symbol (or ISIN, or name),
// quantity and average price. Read here in the browser; only those three
// fields go to the server, which matches each to a listed company
// (server/portfolio-import.js). No broker account is linked.

const STATUS = {
  ok: ["Will be added", "var(--green)"],
  held: ["Already in your portfolio — skipped", "var(--t3)"],
  duplicate: ["Twice in the file — skipped", "var(--t3)"],
  unknown: ["Not matched", "var(--yellow)"],
  invalid: ["Missing figures", "var(--yellow)"],
};

export default function ImportHoldingsModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choose = async f => {
    setFile(f); setParsed(null); setPreview(null); setError("");
    if (!f) return;
    setBusy(true);
    try {
      const read = await readHoldingsFile(f);
      if (!read || !read.rows.length) {
        setError("Couldn't find a holdings table in this file. It needs columns for the stock (symbol, ISIN or name), quantity and average price.");
        return;
      }
      setParsed(read);
      setPreview(await api.importHoldings(read.rows, false));
    } catch (e) {
      setError(e.message || "Couldn't read this file.");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true); setError("");
    try {
      const result = await api.importHoldings(parsed.rows, true);
      onImported(result.added);
    } catch (e) {
      setError(e.message || "Couldn't add the holdings.");
      setBusy(false);
    }
  };

  const ready = preview?.rows.filter(r => r.status === "ok") ?? [];
  const fmt = n => (n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
  return (
    <div role="dialog" aria-modal="true" aria-label="Import holdings from a broker file" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Import from a broker file</div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost" style={{ height: 30, width: 30, padding: 0, justifyContent: "center" }}><X size={15} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6, margin: "0 0 12px" }}>
          Download your holdings from your broker as CSV or Excel — Zerodha (Console → Portfolio → Holdings → Download, or Kite's holdings download), Groww, Upstox, Angel One or any other — and choose the file here. It's read in your browser: only each stock, its quantity and average price are sent. No broker account is linked.
        </p>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderRadius: 10, border: "1px dashed var(--bdr3, var(--bdr2))", background: "var(--s1)", color: "var(--t1)", fontSize: 13, cursor: busy ? "wait" : "pointer" }}>
          <Upload size={15} /> {file ? file.name : "Choose a CSV or Excel file"}
          <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={e => choose(e.target.files?.[0] ?? null)} style={{ display: "none" }} disabled={busy} />
        </label>

        {busy && !preview && <div role="status" style={{ fontSize: 12, color: "var(--t3)", marginTop: 12 }}>Reading the file…</div>}
        {error && <div role="alert" style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 8, padding: "8px 12px", marginTop: 12 }}>{error}</div>}

        {parsed && preview && (
          <>
            <div style={{ fontSize: 11.5, color: "var(--t3)", margin: "12px 0 8px", lineHeight: 1.5 }}>
              {preview.rows.length} rows from {parsed.sheetName ? `“${parsed.sheetName}”` : "the file"} — using {Object.entries(parsed.used).map(([f, h]) => `“${h}” for ${{ symbol: "the symbol", isin: "the ISIN", name: "the name", qty: "quantity", avgPrice: "average price" }[f]}`).join(", ")}.
              {" "}{ready.length} will be added at their average price, without a buy date.
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--bdr)", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ color: "var(--t3)", textAlign: "left", position: "sticky", top: 0, background: "var(--s2)" }}>
                  {["Stock", "Qty", "Avg price", ""].map((h, i) => <th key={i} style={{ padding: "7px 10px", fontWeight: 500, borderBottom: "1px solid var(--bdr2)", textAlign: i === 1 || i === 2 ? "right" : "left" }}>{h}</th>)}
                </tr></thead>
                <tbody>{preview.rows.map(r => {
                  const [label, color] = STATUS[r.status] ?? [r.status, "var(--t3)"];
                  return (
                    <tr key={r.row}>
                      <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bdr)", minWidth: 0 }}>
                        <div style={{ color: "var(--t1)", fontWeight: 550 }}>{r.symbol ?? r.from}</div>
                        {r.name && <div style={{ fontSize: 10.5, color: "var(--t3)" }}>{r.name}</div>}
                      </td>
                      <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bdr)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.qty)}</td>
                      <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bdr)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.avgPrice ? `₹${fmt(r.avgPrice)}` : "—"}</td>
                      <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bdr)", color, fontSize: 11 }} title={r.reason ?? undefined}>{r.status === "ok" && <Check size={12} style={{ verticalAlign: "-2px", marginRight: 3 }} />}{label}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ height: 36 }}>Cancel</button>
              <button type="button" onClick={commit} disabled={busy || !ready.length} className="btn-primary" style={{ height: 36, padding: "0 16px", opacity: busy || !ready.length ? 0.6 : 1 }}>
                {busy ? "Adding…" : ready.length ? `Add ${ready.length} holding${ready.length === 1 ? "" : "s"}` : "Nothing new to add"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
