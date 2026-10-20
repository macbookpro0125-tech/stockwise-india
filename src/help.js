// "Report a problem": an email to us with the page, the app and its build
// filled in, so a report can be traced without back-and-forth. Nothing about
// the account goes in; the person adds what they choose.
export const CONTACT_EMAIL = "jocularinsights@gmail.com";

export function problemMailto() {
  const app = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() ? `${window.Capacitor.getPlatform()} app` : "website";
  const build = typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : "dev";
  const page = typeof window !== "undefined" ? window.location.pathname : "";
  const body = `What happened, or your question:\n\n\nIf a figure looks wrong: the company, the figure, and what you expected.\n\n— Page: ${page}\n— App: ${app}, build ${build}`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Jocular Insights: a problem or question")}&body=${encodeURIComponent(body)}`;
}
