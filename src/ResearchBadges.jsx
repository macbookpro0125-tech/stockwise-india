// Badges for the research score (server/research.js), shared by Discover,
// the watchlist, compare and peers: quality out of 100 as a coloured pill,
// and the overall research score with its stance. A company with too little
// filed data shows a grey dash, never a 0.

const MONO = { fontVariantNumeric: "tabular-nums" };

// Quality: 70+ green, 50–69 amber, under 50 red — on the rounded figure, so a
// 49.9 shown as "50" is amber like the 50 it reads as
export function qualityTone(raw) {
  if (raw == null) return { border: "var(--bdr2)", bg: "var(--s2)", color: "var(--t3)", dot: "var(--t3)" };
  const v = Math.round(raw);
  if (v >= 70) return { border: "var(--green-bdr)", bg: "var(--green-dim)", color: "var(--green)", dot: "var(--green)" };
  if (v >= 50) return { border: "var(--yellow-bdr)", bg: "var(--yellow-dim)", color: "var(--yellow)", dot: "var(--yellow)" };
  return { border: "var(--red-bdr)", bg: "var(--red-dim)", color: "var(--red)", dot: "var(--red)" };
}

// The overall score's stance bands: Strong / Constructive green, Mixed amber,
// Challenged / Weak red
export function overallTone(v) {
  return qualityTone(v == null ? null : v >= 65 ? 100 : v >= 50 ? 60 : 0);
}

// Everything the headline numbers say, for a hover title
export function researchTitle(r) {
  if (!r || r.quality == null) return "Not rated — too few years of filings to score";
  const n = v => (v == null ? "—" : Math.round(v));
  return [
    `Quality ${n(r.quality)}/100${r.capped ? " (capped at 69 — see the stock page)" : r.provisional ? " (provisional)" : ""} · without valuation ${n(r.qualityOnly)}`,
    `Overall research score ${r.overall == null ? r.stance : `${n(r.overall)} — ${r.stance}`}`,
    `Valuation ${n(r.valuation)} — ${r.valuationLabel}`,
    `Technical setup ${n(r.technical)} — ${r.technicalLabel}`,
    `Risk ${n(r.risk)} — ${r.riskLabel} (higher = riskier)`,
    `${r.coverage?.checked} of ${r.coverage?.total} checks have data · data quality ${n(r.confidence)}/100`,
    ...(r.flags?.includes("auditQualified") ? ["Red flag: the auditor qualified the latest accounts"] : []),
    ...(r.flags?.includes("auditorResigned") ? ["Caution: the statutory auditor resigned in the last three years"] : []),
  ].join("\n");
}

export function QualityBadge({ research, size = 11.5 }) {
  const v = research?.quality ?? null;
  const t = qualityTone(v);
  return (
    <span title={researchTitle(research)} style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999,
      border: `1px solid ${t.border}`, background: t.bg, color: t.color, fontSize: size, fontWeight: 650, whiteSpace: "nowrap", ...MONO,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.dot, flexShrink: 0 }} />
      {v == null ? "—" : Math.round(v)}
      {v != null && <span style={{ fontWeight: 500, opacity: 0.7, fontSize: size - 1.5 }}>/100</span>}
    </span>
  );
}

// The overall score as a number with its stance word beneath
export function OverallScore({ research }) {
  const v = research?.overall ?? null;
  const t = overallTone(v);
  return (
    <span title={researchTitle(research)} style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.25, whiteSpace: "nowrap" }}>
      <span style={{ fontSize: 13, fontWeight: 650, color: v == null ? "var(--t3)" : "var(--t1)", ...MONO }}>{v == null ? "—" : Math.round(v)}</span>
      <span style={{ fontSize: 10.5, color: research?.stance === "Review required" ? "var(--red)" : v == null ? "var(--t3)" : t.color, fontWeight: 500 }}>{research?.stance ?? "Not rated"}</span>
    </span>
  );
}
