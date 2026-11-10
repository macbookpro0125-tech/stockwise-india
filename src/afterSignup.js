// What a visitor asked for before they had an account, done once it is made
// (9 Nov 2026, the SEO audit): "Set a price alert" on a company's public page
// opens the alert form on the company's page in the app. ("Add to watchlist"
// adds the company itself, PublicStock.jsx.) Kept for this tab only, for two
// minutes, and only for that company.
const KEY = "ji-after-signup";
const FOR_MS = 2 * 60 * 1000;

export function askAfterSignup(what, symbol) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ what, symbol, at: Date.now() })); } catch {}
}

export function askedAfterSignup(what, symbol) {
  try {
    const a = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return !!a && a.what === what && a.symbol === symbol && Date.now() - a.at < FOR_MS;
  } catch { return false; }
}

export function doneAfterSignup() {
  try { sessionStorage.removeItem(KEY); } catch {}
}
