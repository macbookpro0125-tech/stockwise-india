// credentials: "include" on every call — the session lives in an httpOnly
// cookie (server/http-server.js), so the browser must be told to send it;
// fetch omits cookies on same-origin requests through the Vite proxy by
// default only for cross-origin, but being explicit here means this still
// works once the API moves to its own subdomain in production.
//
// Riding out a deploy (20 Oct 2026): the server keeps its data on a disk, and
// Render can't hand a disk from the old server to the new one without a gap,
// so for 20–30 seconds each deploy it answers every request with its own HTML
// 502 page. That page means the request never reached the server, so it's
// sent again after a short wait, writes included, while onReconnecting's
// listeners show a notice (main.jsx). Our own errors are JSON (an NSE
// failure is a JSON 502) and come straight back, and so does a dropped
// connection: Render answers during a deploy, so that's being offline, which
// the app says at once rather than waiting.
let RETRY_DELAYS = [2000, 3000, 4000, 5000, 6000, 8000, 8000, 8000]; // ~45 s
export const setRetryDelays = delays => { RETRY_DELAYS = delays; };
const listeners = new Set();
export const onReconnecting = fn => { listeners.add(fn); return () => listeners.delete(fn); };
let waiting = 0;
const reconnecting = on => {
  waiting += on ? 1 : -1;
  if ((on && waiting === 1) || (!on && waiting === 0)) for (const fn of listeners) fn(on);
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const gatewayPage = res => [502, 503, 504].includes(res.status) && !(res.headers.get("content-type") ?? "").includes("application/json");

export async function request(path, options = {}) {
  const read = !options.method || options.method === "GET";
  let attempt = 0, flagged = false;
  try {
    for (;;) {
      const res = await fetch(path, {
        ...options,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...options.headers },
      });
      if (!gatewayPage(res)) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        return data;
      }
      // a gateway timeout on a write: the server may have done it
      if (res.status === 504 && !read) throw new Error("The server took too long to answer. Check whether it was saved before trying again.");
      if (attempt >= RETRY_DELAYS.length) throw new Error("Jocular Insights is updating. Try again in a minute.");
      if (!flagged) { flagged = true; reconnecting(true); }
      await sleep(RETRY_DELAYS[attempt++]);
    }
  } finally {
    if (flagged) reconnecting(false);
  }
}

export const api = {
  me: () => request("/api/auth/me"),
  // A company's public summary, for someone not signed in (PublicStock.jsx)
  publicStock: symbol => request(`/api/public/stock/${encodeURIComponent(symbol)}`),
  signup: (email, password) => request("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  // Sign-up's emailed code (when the server can send email)
  signupVerify: (email, code) => request("/api/auth/signup/verify", { method: "POST", body: JSON.stringify({ email, code }) }),
  signupResend: (email) => request("/api/auth/signup/resend", { method: "POST", body: JSON.stringify({ email }) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  // The Android app's notification token (src/push.js)
  pushToken: (token, platform) => request("/api/push/token", { method: "POST", body: JSON.stringify({ token, platform }) }),
  pushTokenRemove: (token) => request("/api/push/token", { method: "DELETE", body: JSON.stringify({ token }) }),
  // password, or for an account without one (Google, Apple, phone) confirm: "DELETE"
  deleteAccount: (password, confirm) => request("/api/auth/delete-account", { method: "POST", body: JSON.stringify({ password, confirm }) }),
  // Password reset: offered only when the server can send email
  authOptions: () => request("/api/auth/options"),
  // A Google / Apple / phone sign-in Firebase confirmed (src/socialSignIn.js)
  firebaseSignIn: (idToken) => request("/api/auth/firebase", { method: "POST", body: JSON.stringify({ idToken }) }),
  forgotPassword: (email) => request("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) }),
  presets: () => request("/api/presets"),
  metrics: () => request("/api/metrics"),
  marketStrip: () => request("/api/market-strip"),
  stats: () => request("/api/stats"),
  // As a GET the browser keeps the reply and re-checks it on the next visit
  // (an unchanged market is a 304, not ~600 KB again); a very long request
  // still goes as a POST
  screen: (criteria) => {
    const q = JSON.stringify(criteria), inUrl = encodeURIComponent(q);
    return inUrl.length <= 6000 ? request(`/api/screen?q=${inUrl}`) : request("/api/screen", { method: "POST", body: q });
  },
  momentum: (body) => request("/api/momentum", { method: "POST", body: JSON.stringify(body) }),
  stock: (symbol) => request(`/api/stock/${encodeURIComponent(symbol)}`),
  prices: (symbol, range) => request(`/api/stock/${encodeURIComponent(symbol)}/prices?range=${range}`),
  // The stock page's other panels: technicals, shareholding, filings, news, peers
  panel: (symbol, name) => request(`/api/stock/${encodeURIComponent(symbol)}/${name}`),
  filingSummary: (symbol, index) => request(`/api/stock/${encodeURIComponent(symbol)}/filings/${index}/summary`),
  search: (q) => request(`/api/search?q=${encodeURIComponent(q)}`),
  // The News page (NewsView.jsx): companies' announcements to NSE and the day's headlines
  news: ({ kind = "all", before = null, size = "large" } = {}) => request(`/api/news?kind=${encodeURIComponent(kind)}&size=${size}${before ? `&before=${encodeURIComponent(before)}` : ""}`),
  newsWatchLatest: since => request(`/api/news/watchlist-latest${since ? `?since=${encodeURIComponent(since)}` : ""}`),
  newsTop: (n = 3) => request(`/api/news/top?n=${n}`),
  // The Explore page (ExploreView.jsx): the indices, and one in full
  explore: () => request("/api/explore"),
  exploreIndex: name => request(`/api/explore/index?name=${encodeURIComponent(name)}`),
  movers: period => request(`/api/explore/movers?period=${period}`),
  resultsWeek: () => request("/api/explore/results"),
  heatmap: (set, period) => request(`/api/explore/heatmap?set=${encodeURIComponent(set)}&period=${period}`),
  newsItem: id => request(`/api/news/item/${encodeURIComponent(id)}`),
  newsFilingLines: id => request(`/api/news/item/${encodeURIComponent(id)}/read`),
  currentPrices: (symbols) => request(`/api/prices?symbols=${symbols.map(encodeURIComponent).join(",")}`),
  watchlist: () => request("/api/watchlist"),
  thesis: symbol => request(`/api/thesis/${encodeURIComponent(symbol)}`),
  notes: () => request("/api/notes"),
  saveNote: (symbol, note) => request(`/api/notes/${encodeURIComponent(symbol)}`, { method: "PUT", body: JSON.stringify(note) }),
  deleteNote: symbol => request(`/api/notes/${encodeURIComponent(symbol)}`, { method: "DELETE" }),
  strategies: () => request("/api/strategies"),
  saveStrategies: strategies => request("/api/strategies", { method: "PUT", body: JSON.stringify({ strategies }) }),
  checkStrategyMatches: () => request("/api/strategies/check", { method: "POST" }),
  acknowledgeStrategyMatches: id => request(`/api/strategies/${encodeURIComponent(id)}/matches/ack`, { method: "POST" }),
  researchProfile: symbol => request(`/api/stock/${encodeURIComponent(symbol)}/research`),
  saveThesis: (symbol, thesis) => request(`/api/thesis/${encodeURIComponent(symbol)}`, { method: "PUT", body: JSON.stringify(thesis) }),
  addWatch: (ticker, price) => request("/api/watchlist", { method: "POST", body: JSON.stringify({ ticker, price }) }),
  setWatchNote: (ticker, note) => request(`/api/watchlist/${encodeURIComponent(ticker)}`, { method: "PUT", body: JSON.stringify({ note }) }),
  removeWatch: (ticker) => request(`/api/watchlist/${encodeURIComponent(ticker)}`, { method: "DELETE" }),
  portfolio: () => request("/api/portfolio"),
  addHolding: (h) => request("/api/portfolio", { method: "POST", body: JSON.stringify(h) }),
  importHoldings: (rows, commit) => request("/api/portfolio/import", { method: "POST", body: JSON.stringify({ rows, commit }) }),
  updateHolding: (id, h) => request(`/api/portfolio/${id}`, { method: "PUT", body: JSON.stringify(h) }),
  removeHolding: (id) => request(`/api/portfolio/${id}`, { method: "DELETE" }),
  performance: () => request("/api/performance"),
  takePerformanceSnapshot: () => request("/api/performance/snapshot", { method: "POST" }),
  listAlerts: (live = false) => request(`/api/alerts${live ? "?live=1" : ""}`),
  // Telegram alerts: connection status, the one-time connect link, a test, disconnect
  telegram: () => request("/api/telegram"),
  telegramLink: () => request("/api/telegram/link", { method: "POST" }),
  telegramTest: () => request("/api/telegram/test", { method: "POST" }),
  telegramDisconnect: () => request("/api/telegram", { method: "DELETE" }),
  createAlert: (alert) => request("/api/alerts", { method: "POST", body: JSON.stringify(alert) }),
  updateAlert: (id, patch) => request(`/api/alerts/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteAlert: (id) => request(`/api/alerts/${id}`, { method: "DELETE" }),
};
