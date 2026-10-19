import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "./api.js";
import { qualityTone } from "./ResearchBadges.jsx";

const FACTORS = [
  { id: "business", label: "Business quality", detail: "Returns on capital, margin stability and returns on new investment." },
  { id: "earnings", label: "Earnings quality", detail: "Cash behind reported profits, accruals, free cash flow and EPS trends." },
  { id: "balance", label: "Balance sheet", detail: "Debt, interest cover, liquidity and working capital. Banks use bank-specific checks." },
  { id: "governance", label: "Governance", detail: "Promoter holding changes, pledging, dilution and audit signals." },
  { id: "growth", label: "Growth", detail: "Sales growth over three and five years, and three-year EPS growth." },
  { id: "valuation", label: "Valuation", detail: "Price against the company's usual multiples, sector peers and cash-flow measures. Higher means cheaper." },
];

export default function ResearchProfile({ research, symbol, expanded = false, onToggle, triggerOnly = false, panelOnly = false }) {
  const [activeFactor, setActiveFactor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!expanded || triggerOnly || !symbol || detail?.symbol === symbol) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api.researchProfile(symbol)
      .then(result => { if (!cancelled) setDetail(result); })
      .catch(e => { if (!cancelled) setError(e.message || "Couldn't load the filing checks."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [expanded, triggerOnly, symbol, detail?.symbol, retry]);

  if (!research?.groups || typeof research.groups !== "object" || Array.isArray(research.groups)) return null;

  const coverage = research.coverage;
  const selected = FACTORS.find(f => f.id === activeFactor);
  const groupDetail = detail?.groups?.find(g => g.id === activeFactor);
  const toggle = () => onToggle?.();

  return (
    <div className={`research-profile${panelOnly ? " research-profile-panel-only" : ""}`} onClick={e => e.stopPropagation()}>
      {!panelOnly && (
        <button
          type="button"
          className="research-profile-toggle"
          aria-label={`${expanded ? "Hide" : "Show"} six-factor research profile${research.quality == null ? "" : `, quality ${Math.round(research.quality)} out of 100`}`}
          aria-expanded={expanded}
          onClick={toggle}
        >
          <span>Research profile</span>
          <span className="research-profile-toggle-score">
            {research.quality == null ? "Not scored" : `Quality ${Math.round(research.quality)}/100`}
          </span>
          <ChevronDown size={14} aria-hidden="true" data-open={expanded || undefined} />
        </button>
      )}

      {!triggerOnly && expanded && (
        <section className="research-profile-panel" aria-label="Six quality factors">
          <div className="research-profile-heading">
            <strong>Six factors behind Quality</strong>
            <span>{coverage ? `${coverage.checked} of ${coverage.total} checks have data` : "Filing checks"}</span>
          </div>
          <div className="research-profile-grid">
            {FACTORS.map(factor => {
              const score = research.groups[factor.id] ?? null;
              const tone = qualityTone(score);
              const active = activeFactor === factor.id;
              return (
                <div className={`research-profile-factor${active ? " active" : ""}`} key={factor.id}>
                  <button
                    type="button"
                    className="research-profile-factor-button"
                    aria-label={`${active ? "Hide" : "Show checks for"} ${factor.label}: ${score == null ? "not scored" : `${Math.round(score)} out of 100`}`}
                    aria-expanded={active}
                    onClick={() => setActiveFactor(active ? null : factor.id)}
                  >
                    <span className="research-profile-factor-top">
                      <span>{factor.label}</span>
                      <strong style={{ color: score == null ? "var(--t3)" : tone.color }}>
                        {score == null ? "—" : `${Math.round(score)}`}
                      </strong>
                    </span>
                    <span className="research-profile-track" aria-hidden="true">
                      <span style={{ width: `${Math.max(0, Math.min(100, Number(score) || 0))}%`, background: tone.color }} />
                    </span>
                    <span className="research-profile-hint">{active ? "Checks shown below" : "Tap to view checks"}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {selected && (
            <div className="research-profile-checks" aria-live="polite">
              <div className="research-profile-checks-heading">
                <strong>{selected.label}</strong>
                <span>{groupDetail ? `${groupDetail.checked} of ${groupDetail.total} checked` : "Filing evidence"}</span>
              </div>
              <p className="research-profile-checks-intro">{selected.detail}</p>
              {loading && <p className="research-profile-checks-state">Loading filing checks…</p>}
              {error && (
                <p className="research-profile-checks-state" role="alert">
                  {error} <button type="button" onClick={() => { setDetail(null); setError(""); setRetry(n => n + 1); }}>Retry</button>
                </p>
              )}
              {!loading && !error && groupDetail && (
                <ul className="research-profile-check-list">
                  {groupDetail.items.map(item => (
                    <li className="research-profile-check" key={item.id}>
                      <div className="research-profile-check-top">
                        <strong>{item.label}</strong>
                        <span>{item.na ? "Not applicable" : item.missing ? "No data" : item.display ?? (item.score == null ? "Not scored" : `${Math.round(item.score)}/100`)}</span>
                      </div>
                      <p>{item.na || item.missing || item.reason || "This check is included in the factor score."}</p>
                    </li>
                  ))}
                </ul>
              )}
              {!loading && !error && !groupDetail && <p className="research-profile-checks-state">{selected.detail}</p>}
            </div>
          )}
          {research.capped && research.capReason && <p className="research-profile-note">Quality cap: {research.capReason}</p>}
          <p className="research-profile-note">Technical setup and risk are shown separately from these quality factors.</p>
        </section>
      )}
    </div>
  );
}
