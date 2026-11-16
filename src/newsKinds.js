// What each filing or news item is about, in one short label (16 Nov 2026,
// the owner: "news should be updated and improved"), so a reader can scan the
// list or pick one kind. Routine notices (newspaper copies, meeting
// schedules, compliance certificates) are folded away until asked for.
// Labels describe the subject only; nothing here says whether it's good news.
const KINDS = [
  ["results", "Results", /financial results|quarterly results|results for the (quarter|year)|\bq[1-4]\b.*results|outcome of board meeting.*(results|financial)|profit|revenue/i],
  ["dividend", "Dividend", /dividend|record date|book closure/i],
  ["order", "Order or contract", /order (win|received|bagged|from)|bags? .*order|wins? .*(order|contract)|contract|letter of award|\bLoA\b|purchase order/i],
  ["deal", "Deal", /acquisition|acquire|merger|amalgamation|demerger|scheme of arrangement|joint venture|stake|divest|sale of (?:shares|business|undertaking)|preferential issue|\bQIP\b|rights issue|buy-?back|fund rais/i],
  ["people", "Management", /appointment|appointed|resign|cessation|re-?appoint|managing director|\bCEO\b|\bCFO\b|key managerial|change in (?:director|management)|auditor/i],
  ["rating", "Credit rating", /credit rating|rating(s)? (?:reaffirmed|upgraded|downgraded|assigned)|\bCRISIL\b|\bICRA\b|\bCARE\b ratings|India Ratings/i],
  ["legal", "Legal or regulator", /penalty|show cause|litigation|court|tribunal|\bNCLT\b|SEBI.{0,30}order|tax demand|GST demand|search and seizure|investigation/i],
  ["expansion", "Expansion", /capacity|new plant|commission(?:ed|ing)|expansion|capex|launch(?:es|ed)?/i],
  ["holding", "Shareholding", /shareholding pattern|insider|SAST|pledge|encumbrance|promoter.{0,20}(?:sale|purchase|holding)/i],
  ["meeting", "Meeting", /board meeting|annual general meeting|\bAGM\b|\bEGM\b|postal ballot|e-voting|voting results/i],
];
const ROUTINE = /newspaper|publication of|analyst|investor (?:meet|conference|presentation)|institutional investor|con\.? call|earnings call|trading window|duplicate share|loss of share certificate|certificate under reg|regulation 74|reg\.? 74|compliance certificate|statement of investor complaints|copy of (?:newspaper|advertisement)|^updates?$|general updates|clarification sought/i;

export function kindOf(title = "", sub = "") {
  const text = `${title} ${sub ?? ""}`;
  const hit = KINDS.find(([, , re]) => re.test(text));
  const routine = ROUTINE.test(String(title)) && !(hit && ["results", "dividend", "order", "deal", "legal"].includes(hit[0]));
  return { id: hit?.[0] ?? "other", label: hit?.[1] ?? "Other", routine };
}

export const KIND_ORDER = KINDS.map(([id, label]) => ({ id, label })).concat({ id: "other", label: "Other" });
