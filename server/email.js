// Outgoing email — today only password-reset links — through Resend's HTTP
// API. Needs a domain Resend has verified, so it's off until three settings
// exist (in .env locally, the host's dashboard live):
//   RESEND_API_KEY  the key from resend.com
//   EMAIL_FROM      e.g. "Stockwise India <no-reply@yourdomain.in>"
//   APP_URL         e.g. "https://yourdomain.in" — links in emails are built
//                   from this, never from the request's Host header, which a
//                   visitor can set (and so point a victim's link at their site)
// Until then the app doesn't offer password reset at all.

export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.APP_URL);
export const appUrl = () => String(process.env.APP_URL || "").replace(/\/+$/, "");

// Tests swap this for a stub; nothing else should
let sender = async ({ to, subject, text, html }) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Email not sent: ${body?.message ?? `HTTP ${res.status}`}`);
  }
};
export const setEmailSender = fn => { sender = fn; };

export const sendEmail = message => sender(message);

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function resetEmail(link) {
  const text = [
    "Someone — hopefully you — asked to reset the password for your Stockwise India account.",
    "",
    `Choose a new password here (the link works once, for one hour):`,
    link,
    "",
    "If it wasn't you, ignore this email: your password stays as it is.",
  ].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#101828;max-width:520px">
<p>Someone — hopefully you — asked to reset the password for your <b>Stockwise India</b> account.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Choose a new password</a></p>
<p style="color:#475467;font-size:13px">The link works once, for one hour. If it wasn't you, ignore this email: your password stays as it is.</p>
</div>`;
  return { subject: "Reset your Stockwise India password", text, html };
}
