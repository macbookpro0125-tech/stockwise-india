// The welcome email (12 Nov 2026: of 22 Google sign-ups, only 2 came back on
// a later day): sent once, right after an account is made, when the site can
// send email and the account has an address. Three things to try, each a link;
// the results email is the one that brings people back. Never throws:
// a sign-up must not fail over an email.
import { emailConfigured, sendEmail, appUrl } from "./email.js";
import { accountInfo } from "./auth.js";

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function welcomeEmail(name = null) {
  const site = appUrl() || "https://jocularinsights.in";
  const hi = name ? `Hi ${String(name).split(/\s+/)[0]},` : "Hi,";
  const steps = [
    ["Follow a few companies", "Tap the star on any company. Its results and news gather on your watchlist.", site],
    ["Get told before results", "Turn on the results email in Settings: an email the evening before a company you follow reports.", site],
    ["Open a ready-made screen", "Quality companies, ones below their fair value, small caps growing fast and more, every NSE company checked.", `${site}/screens`],
  ];
  const subject = "Welcome to Jocular Insights";
  const text = [
    hi, "",
    "Thanks for joining. Three things to try:", "",
    ...steps.flatMap(([t, p, u], i) => [`${i + 1}. ${t}: ${p}`, `   ${u}`, ""]),
    "Everything comes from the companies' own filings with NSE. Figures, not advice.",
    "",
    "You're getting this once, because you created an account.",
  ].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#101828;max-width:560px">
<p style="font-size:18px;font-weight:600;margin:0 0 4px">Welcome to Jocular Insights</p>
<p style="margin:0 0 16px">${esc(hi)} thanks for joining. Three things to try:</p>
${steps.map(([t, p, u], i) => `<div style="padding:10px 0;border-bottom:1px solid #eaecf0"><a href="${esc(u)}" style="color:#0b7a68;font-weight:600;text-decoration:none">${i + 1}. ${esc(t)}</a><div style="color:#475467;font-size:14px">${esc(p)}</div></div>`).join("")}
<p style="margin:24px 0"><a href="${esc(site)}" style="display:inline-block;background:#14B892;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Open Jocular Insights</a></p>
<p style="color:#667085;font-size:12px">Everything comes from the companies' own filings with NSE. Figures, not advice. You're getting this once, because you created an account.</p>
</div>`;
  return { subject, text, html };
}

// send: injectable for the tests
export async function sendWelcome(userId, { send = sendEmail, configured = emailConfigured(), log = console.error } = {}) {
  try {
    if (!configured) return false;
    const info = accountInfo(userId);
    if (!info?.email) return false;
    await send({ to: info.email, ...welcomeEmail(info.name) });
    return true;
  } catch (e) {
    log(`[welcome] account ${userId}: ${e.message}`);
    return false;
  }
}
