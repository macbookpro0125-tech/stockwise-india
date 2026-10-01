// Limits on password guessing and mass sign-ups. Held in memory: the app runs
// as one process (one Render instance), and a restart forgetting the counts is
// fine — they only have to slow guessing down. Checked before the password is
// hashed, so a flood of attempts can't keep scrypt busy either.

export function limiter({ max, windowMs }) {
  const hits = new Map(); // key -> times within the window, oldest first
  const recent = (key, now) => {
    const list = (hits.get(key) ?? []).filter(t => now - t < windowMs);
    if (list.length) hits.set(key, list); else hits.delete(key);
    return list;
  };
  // Keys nobody comes back to would otherwise stay forever
  setInterval(() => { const now = Date.now(); for (const key of hits.keys()) recent(key, now); }, windowMs).unref();
  return {
    // How long until this key may try again; 0 when it may now
    blockedFor(key, now = Date.now()) {
      const list = recent(key, now);
      return list.length >= max ? windowMs - (now - list[0]) : 0;
    },
    hit(key, now = Date.now()) {
      const list = recent(key, now);
      list.push(now);
      hits.set(key, list);
    },
    reset(key) { hits.delete(key); },
    clear() { hits.clear(); }, // the tests
  };
}

const MIN = 60_000;
export const limits = {
  // Per account: 5 wrong passwords in 15 minutes
  wrongPassword: limiter({ max: 5, windowMs: 15 * MIN }),
  // Per address, across accounts — generous, since many people can share one
  wrongPasswordIp: limiter({ max: 30, windowMs: 15 * MIN }),
  signupIp: limiter({ max: 10, windowMs: 60 * MIN }),
  // Password-reset emails: per account and per address
  resetEmail: limiter({ max: 3, windowMs: 60 * MIN }),
  resetIp: limiter({ max: 10, windowMs: 60 * MIN }),
};

// The visitor's address. Behind a host's proxy (TRUST_PROXY=1) the socket is
// the proxy's, so use what it passes on; elsewhere the socket's own.
export function clientIp(req) {
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"]?.split(",")[0];
    if (forwarded) return String(forwarded).trim();
  }
  return req.socket.remoteAddress || "unknown";
}

export const waitText = ms => {
  const minutes = Math.max(1, Math.ceil(ms / MIN));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};
