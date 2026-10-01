import { useState, useEffect } from "react";
import { Pencil, X, RefreshCw, Bell, Send, CircleCheck } from "lucide-react";
import { api } from "./api.js";
import { alertsStore } from "./stores.js";

// The original's Alerts panel (stock-screener src/components/AlertsPanel.jsx):
// summary and Check Now, what has triggered, then every alert grouped, each
// with view / edit / on-off / delete. Plus Telegram: an account that connects
// it gets each alert as a message when the price crosses (checked every 15
// minutes while NSE trades — server/alert-notifier.js). There's no email
// channel yet; the page says what's checked when.

const MONO = { fontVariantNumeric: "tabular-nums" };

function fmtRs(n) {
  if (n == null || isNaN(n)) return "—";
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function timeAgo(ts) {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Toggle({ on, onChange }) {
  const w = 34, h = 18, dot = 14;
  return (
    <button onClick={onChange} title={on ? "Pause alert" : "Resume alert"} style={{ width: w, height: h, borderRadius: h / 2, border: "none", cursor: "pointer", background: on ? "var(--accent)" : "var(--s4)", position: "relative", transition: "background 150ms", flexShrink: 0, padding: 0 }}>
      <span style={{ position: "absolute", top: 2, width: dot, height: dot, borderRadius: dot / 2, background: "#fff", transition: "left 150ms", left: on ? w - dot - 2 : 2 }} />
    </button>
  );
}

function EditAlertModal({ alert, onSave, onClose }) {
  const [condition, setCondition] = useState(alert.condition);
  const [threshold, setThreshold] = useState(alert.threshold);
  const [error, setError] = useState("");
  const valid = threshold && !isNaN(Number(threshold)) && Number(threshold) > 0;
  const save = async () => {
    if (!valid) return;
    try {
      await onSave({ condition, threshold: Number(threshold) });
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div style={{ background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, padding: 28, width: 380, maxWidth: "90vw", boxShadow: "var(--sh-lg)", animation: "fadeUp 200ms cubic-bezier(0,0,0.2,1) backwards" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--t1)", marginBottom: 4, letterSpacing: "-0.02em" }}>Edit Alert</div>
        <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20 }}>{alert.name || alert.ticker}</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t3)", marginBottom: 8 }}>Condition</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["below", "above"].map(v => (
              <button key={v} onClick={() => setCondition(v)} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: condition === v ? "1.5px solid var(--accent)" : "1px solid var(--bdr2)", background: condition === v ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--s3)", color: condition === v ? "var(--accent)" : "var(--t2)", fontSize: 13, fontWeight: 500, transition: "all 150ms" }}>
                {v === "below" ? "▼ Drops to" : "▲ Rises to"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t3)", marginBottom: 8 }}>Target Price (₹)</div>
          <input autoFocus type="number" value={threshold} onChange={e => setThreshold(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }}
            className="input-base" style={{ fontSize: 18, fontWeight: 600, textAlign: "center" }} />
        </div>
        {error && <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={save} disabled={!valid} className="btn-primary" style={{ flex: 1 }}>Save Changes</button>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1, height: 44 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const actionBtn = { width: 30, height: 30, borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--t3)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms" };

function AlertCard({ a, onView, onEdit, onDelete, onToggle }) {
  const away = a.cmp != null ? ((a.threshold - a.cmp) / a.cmp) * 100 : null;
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--bdr2)", background: a.enabled ? "var(--s2)" : "var(--s1)", opacity: a.enabled ? 1 : 0.55, transition: "all 150ms" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--t1)", letterSpacing: "-0.01em" }}>{a.name || a.ticker}</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: "var(--accent-glow)", color: "var(--accent)" }}>Price</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--t2)", ...MONO, marginBottom: 6 }}>
            <span style={{ color: a.condition === "below" ? "var(--red)" : "var(--green)", fontWeight: 600 }}>{a.condition === "above" ? "▲" : "▼"}</span>
            {" "}Price {a.condition} <strong style={{ color: "var(--t1)" }}>{fmtRs(a.threshold)}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 10, color: "var(--t3)" }}>
            <span style={MONO}>{a.cmp != null ? `${a.priceSource === "live" ? "Live" : "Close"} ${fmtRs(a.cmp)}` : "No recent price"}</span>
            {a.triggered === false && away != null && <span>· {Math.abs(away).toFixed(1)}% away</span>}
            {a.created_at && <span>· added {timeAgo(a.created_at)}</span>}
            {a.notified_at && <span style={{ color: "var(--accent)" }}>· sent to Telegram {timeAgo(a.notified_at)}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginTop: 2 }}>
          <button onClick={onView} title="View stock" style={{ ...actionBtn, fontSize: 12 }}>→</button>
          <button onClick={onEdit} title="Edit alert" aria-label="Edit alert" style={actionBtn}><Pencil size={14} /></button>
          <Toggle on={a.enabled} onChange={onToggle} />
          <button onClick={onDelete} title="Delete alert" aria-label="Delete alert" style={actionBtn}><X size={15} /></button>
        </div>
      </div>
    </div>
  );
}

// Telegram: connect once (a one-time t.me link the server makes; tapping Start
// in Telegram links the chat), then test or disconnect. The link is fetched
// ahead, so the button is a plain link a pop-up blocker won't stop; codes
// last 15 minutes, so it's renewed every 10.
function TelegramCard({ onStatus }) {
  const [tg, setTg] = useState(null);
  const [link, setLink] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [note, setNote] = useState(null); // { text, ok }

  const load = () => api.telegram().then(s => { setTg(s); onStatus(s); return s; }).catch(() => null);
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!tg?.configured || tg.connected) return;
    const get = () => api.telegramLink().then(r => setLink(r.url)).catch(() => setLink(null));
    get();
    const t = setInterval(get, 10 * 60_000);
    return () => clearInterval(t);
  }, [tg?.configured, tg?.connected]);

  // After the link opens: look for the connection every 3 s, for 3 minutes
  useEffect(() => {
    if (!waiting) return;
    let n = 0;
    const t = setInterval(async () => {
      const s = await load();
      if (s?.connected || ++n >= 60) { setWaiting(false); clearInterval(t); }
    }, 3000);
    return () => clearInterval(t);
  }, [waiting]);

  const test = async () => {
    setNote(null);
    try { await api.telegramTest(); setNote({ text: "Sent — check Telegram.", ok: true }); }
    catch (e) { setNote({ text: e.message, ok: false }); }
  };
  const disconnect = async () => { await api.telegramDisconnect(); setNote(null); await load(); };

  if (!tg) return null;
  const box = { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "14px 16px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--s2)", boxShadow: "var(--sh-xs)", marginBottom: 20 };
  const icon = (
    <span style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
      <Send size={17} />
    </span>
  );
  if (!tg.configured) {
    return (
      <div style={{ ...box, boxShadow: "none", background: "var(--s1)" }}>
        {icon}
        <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.5 }}>Telegram alerts aren't set up on this server yet, so alerts only show on this page.</div>
      </div>
    );
  }
  if (tg.connected) {
    return (
      <div style={box}>
        {icon}
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>
            <CircleCheck size={15} style={{ color: "var(--green)" }} /> Telegram connected
          </div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
            Alerts go to {tg.name ? <strong style={{ color: "var(--t2)" }}>{tg.name}</strong> : "your chat"}{tg.bot ? <> from @{tg.bot}</> : null}
            {note && <span style={{ color: note.ok ? "var(--green)" : "var(--red)", marginLeft: 8 }}>{note.text}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={test} className="btn-ghost" style={{ height: 32, fontSize: 12.5 }}>Send test</button>
          <button onClick={disconnect} className="btn-ghost" style={{ height: 32, fontSize: 12.5, color: "var(--t2)" }}>Disconnect</button>
        </div>
      </div>
    );
  }
  return (
    <div style={box}>
      {icon}
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Get your alerts on Telegram</div>
        <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, lineHeight: 1.5 }}>
          {waiting ? "Tap Start in Telegram — this page updates once you're connected." : "A message on your phone when a price crosses one of your alerts. Free, no phone number shared with us."}
          {note && <span style={{ color: "var(--red)", marginLeft: 8 }}>{note.text}</span>}
        </div>
      </div>
      <a href={link ?? undefined} target="_blank" rel="noreferrer" onClick={e => { if (!link) e.preventDefault(); else setWaiting(true); }}
        className="btn-primary" style={{ height: 34, padding: "0 16px", fontSize: 13, textDecoration: "none", opacity: link ? 1 : 0.6, pointerEvents: link ? "auto" : "none" }}>
        <Send size={14} /> {waiting ? "Waiting…" : "Connect Telegram"}
      </a>
    </div>
  );
}

export default function AlertsView({ onOpenStock }) {
  const stored = alertsStore.use();
  const [live, setLive] = useState(null); // alerts re-read with live prices (Check Now)
  const [checkedAt, setCheckedAt] = useState(null);
  const [checking, setChecking] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [tg, setTg] = useState(null); // the Telegram card's status, for the note below the list

  const alerts = live ?? stored ?? [];
  const reload = async () => { setLive(null); await alertsStore.refresh(); };

  const check = async () => {
    setChecking(true);
    try {
      setLive(await api.listAlerts(true));
      setCheckedAt(new Date());
    } finally {
      setChecking(false);
    }
  };

  const update = async (id, patch) => { await api.updateAlert(id, patch); await reload(); };
  const remove = async id => { await api.deleteAlert(id); await reload(); };

  const byNewest = (x, y) => String(y.created_at).localeCompare(String(x.created_at));
  const triggered = alerts.filter(a => a.enabled && a.triggered);
  const groups = [
    { key: "watching", label: "Watching", color: "var(--green)", items: alerts.filter(a => a.enabled && !a.triggered).sort(byNewest), hint: null },
    { key: "triggered", label: "Price reached", color: "var(--yellow)", items: triggered.sort(byNewest), hint: "At or past your price on the latest check." },
    { key: "paused", label: "Paused", color: "var(--t3)", items: alerts.filter(a => !a.enabled).sort(byNewest), hint: "Switched off — not checked until you turn them back on." },
  ].filter(g => g.items.length);
  const activeCount = alerts.filter(a => a.enabled).length;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "8px 20px 80px", animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Alerts</div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
            {alerts.length === 0 ? "No alerts configured" : `${activeCount} active of ${alerts.length}`}
            {checkedAt && <span> · checked {timeAgo(checkedAt)}</span>}
          </div>
        </div>
        <button onClick={check} disabled={checking || alerts.length === 0} className="btn-primary" style={{ height: 34, padding: "0 18px", fontSize: 12, borderRadius: 8, boxShadow: "none", display: "flex", alignItems: "center", gap: 6 }}>
          {checking
            ? <><span style={{ width: 12, height: 12, border: "2px solid color-mix(in srgb, var(--on-accent) 25%, transparent)", borderTopColor: "var(--on-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />Checking…</>
            : <><RefreshCw size={14} />Check Now</>}
        </button>
      </div>

      <TelegramCard onStatus={setTg} />

      {triggered.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--yellow)", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--yellow)", display: "inline-block" }} />
            Triggered ({triggered.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {triggered.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderRadius: 12, background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--t1)" }}>{t.name || t.ticker}</span>
                  <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 4, ...MONO }}>
                    Price: <strong style={{ color: "var(--yellow)" }}>{fmtRs(t.cmp)}</strong> ({t.condition === "above" ? "▲" : "▼"} {fmtRs(t.threshold)})
                  </div>
                </div>
                <button onClick={() => onOpenStock(t.ticker)} style={{ height: 28, padding: "0 12px", fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: "pointer", border: "1px solid var(--yellow-bdr)", background: "transparent", color: "var(--yellow)" }}>View</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {stored == null && !live ? (
        <div style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: "var(--t3)" }}>Loading alerts…</div>
      ) : alerts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--t3)", border: "1px dashed var(--bdr2)", borderRadius: 14, background: "var(--s1)" }}>
          <Bell size={38} strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 15, color: "var(--t2)", fontWeight: 600, marginBottom: 6 }}>No alerts yet</p>
          <p style={{ fontSize: 12, maxWidth: 300, margin: "0 auto", lineHeight: 1.6 }}>
            Use the <Bell size={13} style={{ verticalAlign: "-2px" }} /> button on any stock in results, your watchlist, or its page to set a price alert.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {groups.map(group => (
            <div key={group.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 11.5, fontWeight: 600, color: group.color }}>
                <span>{group.label}</span>
                <span style={{ color: "var(--t3)", fontWeight: 600 }}>{group.items.length}</span>
                <span style={{ flex: 1, height: 1, background: "var(--bdr)" }} />
              </div>
              {group.hint && <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: -4, lineHeight: 1.5 }}>{group.hint}</div>}
              {group.items.map(a => (
                <AlertCard key={a.id} a={a}
                  onView={() => onOpenStock(a.ticker)}
                  onEdit={() => setEditTarget(a)}
                  onDelete={() => remove(a.id)}
                  onToggle={() => update(a.id, { enabled: !a.enabled })} />
              ))}
            </div>
          ))}
        </div>
      )}

      {alerts.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 16, textAlign: "center", lineHeight: 1.6 }}>
          Checked against the latest price when you open this tab (NSE's daily close) or press <strong>Check Now</strong> (live where available).
          {tg?.connected
            ? " While NSE is open they're also checked every 15 minutes and sent to your Telegram — once when the price crosses, again only if it crosses back and returns."
            : tg?.configured ? " Connect Telegram above to get them on your phone." : " Nothing is sent to your phone yet."}
        </div>
      )}

      {editTarget && <EditAlertModal alert={editTarget} onSave={patch => update(editTarget.id, patch)} onClose={() => setEditTarget(null)} />}
    </div>
  );
}
