import { useState } from "react";
import { ChartPie, NotebookPen, Pencil, X } from "lucide-react";
import { api } from "./api.js";
import { portfolioStore } from "./stores.js";
import AddHoldingModal from "./AddHoldingModal.jsx";

// Ported from stock-screener's src/components/PortfolioPanel.jsx — summary
// bar, sort pills, one row per lot, allocation bar. Holdings are saved to the
// account instead of the browser; prices are live where Yahoo answers, else
// NSE's last close. One addition: each row says where the price sits on the
// stock's buy ladder (buy phase, hold, sell zone, below stop loss).

const MONO = { fontVariantNumeric: "tabular-nums" };
const COLORS = ["var(--accent)", "var(--green)", "var(--yellow)", "#A78BFA", "#F472B6", "#FB923C", "#38BDF8"];

function fmtRs(n) {
  if (n == null || isNaN(n)) return "—";
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

const plColor = n => (n == null ? "var(--t3)" : n >= 0 ? "var(--green)" : "var(--red)");
const fmtDate = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);

const label = { fontSize: 11.5, color: "var(--t3)", fontWeight: 600 };

export default function PortfolioView({ onOpenStock }) {
  const data = portfolioStore.use();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [sortBy, setSortBy] = useState("value");
  const [sortDir, setSortDir] = useState("desc");

  const holdings = data?.holdings ?? [];
  const prices = data?.prices ?? {};
  const status = data?.status ?? {};

  const save = async h => {
    if (editItem) await api.updateHolding(editItem.id, h);
    else await api.addHolding(h);
    setShowModal(false);
    setEditItem(null);
    portfolioStore.refresh();
  };

  const remove = async id => {
    await api.removeHolding(id);
    portfolioStore.refresh();
  };

  const enriched = holdings.map(h => {
    const cmp = prices[h.ticker]?.price ?? null;
    const invested = h.buyPrice * h.qty;
    const currentVal = cmp ? cmp * h.qty : null;
    const pl = currentVal != null ? currentVal - invested : null;
    const plPct = invested > 0 && pl != null ? (pl / invested) * 100 : null;
    return { ...h, cmp, invested, currentVal, pl, plPct };
  });

  const totalInvested = enriched.reduce((s, h) => s + h.invested, 0);
  const totalCurrent = enriched.reduce((s, h) => s + (h.currentVal ?? h.invested), 0);
  const totalPL = totalCurrent - totalInvested;
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
  // The prices have all been looked up by now; a holding without one has
  // none to find, so the totals say so rather than showing a loading mark
  const unpriced = [...new Set(enriched.filter(h => h.cmp == null).map(h => h.ticker))];
  const allPricesLoaded = unpriced.length === 0;
  const anyClose = holdings.some(h => prices[h.ticker]?.source === "close");

  const sorted = [...enriched].sort((a, b) => {
    let c = 0;
    if (sortBy === "value") c = (a.currentVal ?? a.invested) - (b.currentVal ?? b.invested);
    else if (sortBy === "pl") c = (a.plPct ?? 0) - (b.plPct ?? 0);
    else if (sortBy === "name") c = (a.name || "").localeCompare(b.name || "");
    return sortDir === "desc" ? -c : c;
  });

  // One allocation segment per stock, across its lots
  const grouped = {};
  for (const h of enriched) {
    grouped[h.ticker] ??= { ticker: h.ticker, name: h.name, value: 0 };
    grouped[h.ticker].value += h.currentVal ?? h.invested;
  }
  const groups = Object.values(grouped);

  const SortPill = ({ id, label: text }) => {
    const active = sortBy === id;
    return (
      <button
        onClick={() => { if (active) setSortDir(d => (d === "desc" ? "asc" : "desc")); else { setSortBy(id); setSortDir("desc"); } }}
        style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? "var(--accent)" : "var(--bdr2)"}`, background: active ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent", color: active ? "var(--accent)" : "var(--t3)", transition: "all 120ms" }}
      >
        {text} {active && (sortDir === "desc" ? "↓" : "↑")}
      </button>
    );
  };

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "8px 20px 80px", animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>
      {holdings.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: "16px 20px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--s2)", marginBottom: 20, alignItems: "center" }}>
          <div>
            <div style={label}>Invested</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", ...MONO }}>{fmtRs(totalInvested)}</div>
          </div>
          <div>
            <div style={label}>Current Value</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", ...MONO }}>{allPricesLoaded ? fmtRs(totalCurrent) : <span style={{ color: "var(--t3)" }}>—</span>}</div>
          </div>
          <div>
            <div style={label}>P&L</div>
            {allPricesLoaded ? (
              <div style={{ fontSize: 18, fontWeight: 700, color: plColor(totalPL), ...MONO }}>
                {fmtRs(totalPL)} <span style={{ fontSize: 12 }}>({fmtPct(totalPLPct)})</span>
              </div>
            ) : <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t3)", ...MONO }}>—</div>}
          </div>
          {unpriced.length > 0 && (
            <div style={{ fontSize: 11.5, color: "var(--yellow)", flexBasis: "100%", order: 9 }}>
              No price found for {unpriced.join(", ")}, so the totals can't be worked out.
            </div>
          )}
          <div style={{ marginLeft: "auto" }}>
            <div style={label}>Holdings</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", ...MONO }}>{holdings.length}</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {holdings.length > 0 && (
            <>
              <SortPill id="value" label="Value" />
              <SortPill id="pl" label="P&L" />
              <SortPill id="name" label="Name" />
            </>
          )}
        </div>
        <button onClick={() => { setEditItem(null); setShowModal(true); }} className="btn-primary" style={{ height: 32, padding: "0 16px", fontSize: 12, borderRadius: 8, boxShadow: "none" }}>
          + Add Holding
        </button>
      </div>

      {data && holdings.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 0", color: "var(--t3)", border: "1px dashed var(--bdr2)", borderRadius: 14, background: "var(--s1)" }}>
          <ChartPie size={36} strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 14, color: "var(--t2)", fontWeight: 500, marginBottom: 4 }}>Portfolio is empty</p>
          <p style={{ fontSize: 12 }}>Add your holdings to track P&L and allocation</p>
        </div>
      )}
      {!data && <div style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: "var(--t3)" }}>Loading portfolio…</div>}

      {sorted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map(h => {
            const alloc = totalCurrent > 0 && h.currentVal ? (h.currentVal / totalCurrent) * 100 : null;
            const st = status[h.ticker];
            return (
              <div key={h.id} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--s2)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 160px", minWidth: 130 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--t1)", letterSpacing: "-0.01em" }}>{h.name}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                    {h.ticker} · {h.qty} @ {fmtRs(h.buyPrice)}
                    {h.buyDate && <span style={{ marginLeft: 6 }}>· {fmtDate(h.buyDate)}</span>}
                  </div>
                  {h.notes && <div style={{ fontSize: 11.5, color: "var(--t2)", marginTop: 4 }}><NotebookPen size={12} style={{ marginRight: 5, verticalAlign: "-1px", color: "var(--t3)" }} />{h.notes}</div>}
                </div>

                <div style={{ textAlign: "center", minWidth: 65 }}>
                  <div style={label}>CMP</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", ...MONO }}>{h.cmp ? fmtRs(h.cmp) : <span style={{ color: "var(--t3)" }} title="No price found for this symbol">—</span>}</div>
                </div>

                <div style={{ textAlign: "center", minWidth: 70 }}>
                  <div style={label}>Value</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", ...MONO }}>{h.currentVal != null ? fmtRs(h.currentVal) : <span style={{ color: "var(--t3)" }}>—</span>}</div>
                </div>

                <div style={{ textAlign: "center", minWidth: 80 }}>
                  <div style={label}>P&L</div>
                  {h.pl != null ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: plColor(h.pl), ...MONO }}>
                      {fmtRs(h.pl)} <span style={{ fontSize: 10 }}>({fmtPct(h.plPct)})</span>
                    </div>
                  ) : <span style={{ fontSize: 13, color: "var(--t3)" }}>—</span>}
                </div>

                <div style={{ textAlign: "center", minWidth: 50 }}>
                  <div style={label}>Alloc</div>
                  {alloc != null ? <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", ...MONO }}>{alloc.toFixed(1)}%</div> : <span style={{ fontSize: 12, color: "var(--t3)" }}>—</span>}
                </div>

                <div style={{ textAlign: "center", minWidth: 110 }}>
                  <div style={label}>Ladder</div>
                  {st?.action
                    ? <div style={{ fontSize: 11, fontWeight: 700, color: st.color }} title={st.levels ? `P1 ₹${st.levels.p1} · Stop loss ₹${st.levels.stopLoss} · Target ₹${st.levels.target}` : undefined}>{st.action}</div>
                    : <div style={{ fontSize: 11, color: "var(--t3)" }}>—</div>}
                </div>

                <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                  <button onClick={() => onOpenStock(h.ticker)} className="btn-primary" style={{ height: 30, padding: "0 12px", fontSize: 11, borderRadius: 8, boxShadow: "none" }}>Analyze</button>
                  <button onClick={() => { setEditItem(h); setShowModal(true); }} title="Edit holding" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--t3)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Edit holding"><Pencil size={14} /></button>
                  <button onClick={() => remove(h.id)} title="Remove holding" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--t3)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Remove holding"><X size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {groups.length > 1 && allPricesLoaded && (
        <div style={{ marginTop: 20, padding: "16px 20px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--s2)" }}>
          <div style={{ ...label, marginBottom: 12 }}>Allocation</div>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
            {groups.map((g, i) => {
              const pct = totalCurrent > 0 ? (g.value / totalCurrent) * 100 : 0;
              return <div key={g.ticker} title={`${g.name}: ${pct.toFixed(1)}%`} style={{ width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 2, minWidth: pct > 0 ? 3 : 0, transition: "width 300ms" }} />;
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 10 }}>
            {groups.map((g, i) => (
              <div key={g.ticker} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--t2)" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                {g.name} <span style={{ color: "var(--t3)", ...MONO }}>{totalCurrent > 0 ? ((g.value / totalCurrent) * 100).toFixed(1) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {holdings.length > 0 && (
        <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 14, lineHeight: 1.6 }}>
          Prices are live from Yahoo Finance{anyClose ? " where available, otherwise NSE's last close" : ""}. "Ladder" is where the price sits on each stock's buy ladder (the stock page has the levels). Saved to your account.
        </p>
      )}

      {showModal && <AddHoldingModal initial={editItem} onSave={save} onClose={() => { setShowModal(false); setEditItem(null); }} />}
    </div>
  );
}
