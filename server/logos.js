// Company logos: each company's own site icon, read from the website it gives
// in its BRSR filing (company-extras.js), kept on disk and served from this
// server — the reader's browser never asks a third party, so the privacy
// page's "no outside requests" stays true.
//
// The address comes from a filing, so it's treated as untrusted: only public
// addresses are connected to (checked at connection time, so a DNS answer
// can't swap in a private one later), ports 80/443, a few redirects, small
// size and time caps, and only PNG/JPEG/GIF/WebP/ICO by their first bytes —
// never SVG, which can carry script.
import { lookup as dnsLookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./paths.js";

const LOGO_DIR = join(DATA_DIR, "logos");
const KEEP_DAYS = 30, MISS_DAYS = 7;
const PAGE_BYTES = 512 * 1024, IMAGE_BYTES = 200 * 1024, TIMEOUT_MS = 8000, MAX_REDIRECTS = 4;
// Says plainly what it is. A browser's name without a browser's other headers
// is what bot filters (TCS', Infosys') turn away, and so is a crawler-style
// "+https://…" contact link
const UA = "JocularInsights-logo/1.0";

// ── Public addresses only ───────────────────────────────────────────────────
export function isPublicAddress(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
  }
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return !(v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff") || v.startsWith("64:ff9b"));
  }
  return false;
}

function publicLookup(hostname, options, callback) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    if (!addresses.length || !addresses.every(a => isPublicAddress(a.address))) return callback(new Error("not a public address"));
    if (options?.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

// One GET, following a few redirects; resolves { url, type, body } or throws.
// `truncate`: past maxBytes keep what came (a page's icons are in its head)
function get(url, maxBytes, { truncate = false } = {}, hops = 0) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { return reject(new Error("bad address")); }
    if (!/^https?:$/.test(u.protocol) || (u.port && u.port !== "80" && u.port !== "443") || u.username || isIP(u.hostname) || u.hostname.startsWith("[")) return reject(new Error("address not allowed"));
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.get(u, { lookup: publicLookup, timeout: TIMEOUT_MS, headers: { "user-agent": UA, accept: "text/html,image/*;q=0.9,*/*;q=0.5", "accept-language": "en-IN,en;q=0.9" } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (hops >= MAX_REDIRECTS) return reject(new Error("too many redirects"));
        return resolve(get(new URL(res.headers.location, u).href, maxBytes, { truncate }, hops + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      let size = 0, done = false;
      const finish = () => { if (!done) { done = true; resolve({ url: u.href, type: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks) }); } };
      res.on("data", c => {
        size += c.length;
        if (size > maxBytes) {
          if (truncate) { chunks.push(c.subarray(0, c.length - (size - maxBytes))); finish(); }
          req.destroy(truncate ? undefined : new Error("too large"));
          return;
        }
        chunks.push(c);
      });
      res.on("end", finish);
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
  });
}

// ── What an icon is, from its first bytes ───────────────────────────────────
export function imageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return "image/x-icon";
  return null;
}

// The page's icons, best first: the touch icon (usually 180 px), then the
// largest declared icon, then /favicon.ico. SVG icons are skipped.
export function iconCandidates(html, pageUrl) {
  const links = [];
  for (const tag of String(html).slice(0, PAGE_BYTES).match(/<link\b[^>]*>/gi) ?? []) {
    const attr = name => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find(v => v != null) ?? null;
    const rel = (attr("rel") ?? "").toLowerCase();
    const href = attr("href");
    if (!href || !/\bicon\b|apple-touch-icon/.test(rel) || /mask-icon/.test(rel)) continue;
    if (/\.svg(\?|#|$)/i.test(href) || /svg/i.test(attr("type") ?? "")) continue;
    let url;
    try { url = new URL(href.replace(/&amp;/g, "&"), pageUrl).href; } catch { continue; }
    const size = Math.max(0, ...String(attr("sizes") ?? "").split(/\s+/).map(s => Number(s.split(/x/i)[0]) || 0));
    links.push({ url, rank: (/apple-touch-icon/.test(rel) ? 1000 : 0) + Math.min(size, 512) });
  }
  links.sort((a, b) => b.rank - a.rank);
  const out = [...new Set(links.map(l => l.url))];
  try { out.push(new URL("/favicon.ico", pageUrl).href); } catch {}
  return [...new Set(out)];
}

export async function readLogo(website) {
  const page = await get(website, PAGE_BYTES, { truncate: true });
  for (const candidate of iconCandidates(page.body.toString("utf8"), page.url).slice(0, 4)) {
    try {
      const img = await get(candidate, IMAGE_BYTES);
      const type = imageType(img.body);
      if (type && img.body.length >= 64) return { type, body: img.body, source: img.url };
    } catch (e) { if (process.env.LOGO_DEBUG) console.error(candidate, e.message); }
  }
  return null;
}

// ── Disk cache and a one-at-a-time queue ────────────────────────────────────
const metaPath = sym => join(LOGO_DIR, `${sym}.json`);
const imgPath = sym => join(LOGO_DIR, `${sym}.img`);
function readMeta(sym) {
  try { return JSON.parse(readFileSync(metaPath(sym), "utf8")); } catch { return null; }
}
const fresh = meta => meta && Date.now() - Date.parse(meta.at) < (meta.miss ? MISS_DAYS : KEEP_DAYS) * 86400000;

const inFlight = new Map();
let chain = Promise.resolve();
const queued = fn => (chain = chain.then(fn, fn));

// { type, body } or null. `websiteOf(sym)` gives the company's site (or null).
export function logoFor(sym, websiteOf) {
  const meta = readMeta(sym);
  if (fresh(meta)) return Promise.resolve(meta.miss ? null : cachedImage(sym, meta));
  if (inFlight.has(sym)) return inFlight.get(sym);
  const job = queued(async () => {
    const website = await websiteOf(sym).catch(() => null);
    const logo = website ? await readLogo(website).catch(() => null) : null;
    mkdirSync(LOGO_DIR, { recursive: true });
    if (logo) {
      writeFileSync(imgPath(sym), logo.body);
      writeFileSync(metaPath(sym), JSON.stringify({ at: new Date().toISOString(), type: logo.type, source: logo.source, website }));
      return { type: logo.type, body: logo.body };
    }
    // Kept a while so a company without one isn't asked again on every view;
    // an older good logo stays in use meanwhile
    if (meta && !meta.miss && existsSync(imgPath(sym))) return cachedImage(sym, meta);
    try { unlinkSync(imgPath(sym)); } catch {}
    writeFileSync(metaPath(sym), JSON.stringify({ at: new Date().toISOString(), miss: true, website }));
    return null;
  }).finally(() => inFlight.delete(sym));
  inFlight.set(sym, job);
  return job;
}

function cachedImage(sym, meta) {
  try { return { type: meta.type, body: readFileSync(imgPath(sym)) }; } catch { return null; }
}
