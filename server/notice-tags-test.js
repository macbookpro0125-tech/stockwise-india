// The red "Review promptly" tag on NSE notices: real problems get it, routine
// wording that merely contains an alarming word doesn't.
import { classifyAnnouncement } from "./company-extras.js";

let failed = 0;
const check = (title, body, want, why) => {
  const got = classifyAnnouncement(title, body)?.category ?? null;
  if (got === want) console.log(`ok: ${why}`);
  else { failed++; console.error(`FAIL: ${why} — got ${got}, expected ${want}`); }
};

check("Outcome of Board Meeting", "Joint Statutory Auditors of the Company, with unmodified opinion are attached", "Results / governance", "a clean audit (\"unmodified opinion\") is routine, not an audit alarm");
check("Outcome of Board Meeting", "results with the auditors' unqualified opinion", "Results / governance", "an unqualified opinion is routine too");
check("Other Restructuring", "Roptonal stands dissolved as per the certificate issued by the Department of Insolvency, Republic of Cyprus", null, "a registrar called 'Department of Insolvency' is not an insolvency");
check("Financial Results", "The financial statements are prepared on a going concern basis", "Results / governance", "the usual going-concern basis is not a going-concern doubt");
check("Outcome of Board Meeting", "Audited results along with the Statement on Impact of Audit Qualifications", "Audit / accounts", "a statement on audit qualifications is flagged");
check("Auditors report", "the auditor has expressed a qualified opinion", "Audit / accounts", "a qualified opinion is flagged");
check("Auditors report", "material uncertainty related to going concern", "Audit / accounts", "a going-concern doubt is flagged");
check("Default", "The company has defaulted in repayment of principal of a term loan", "Debt / insolvency", "a loan default is flagged");
check("Corporate Insolvency Resolution Process", "NCLT admitted the petition", "Debt / insolvency", "an insolvency process is flagged");
check("Scheme of Arrangement", "NCLT sanctioned the scheme of amalgamation", "Capital allocation / transaction", "a court-approved merger is a transaction, not a legal alarm");

if (failed) { console.error(`\n${failed} notice-tag check(s) failed.`); process.exit(1); }
console.log("\nAll notice-tag checks passed.");
process.exit(0);
