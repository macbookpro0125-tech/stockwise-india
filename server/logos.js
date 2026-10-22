// Company logos: each company's own site icon, read from a website listed in
// its BRSR filing or NSE company directory, kept on disk and served from this
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
const LISTED_LOGO_ORIGIN = "https://api.dharun.dev";
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

// ── Good enough to show? ────────────────────────────────────────────────────
// A logo sits in a 28–42 px tile on a white background, drawn at up to 3× on
// a phone (22 Oct 2026, from a scan of every cached logo: 630 favicons under
// 64 px were blurry, about 30 wide banners shrank to a strip, 12 white logos
// vanished on the white, and one file came from TradingView).
//
// { w, h } from the header, or null. An ICO gives its largest picture.
export function imageSize(buf) {
  const type = imageType(buf);
  try {
    if (type === "image/png") return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (type === "image/gif") return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
    if (type === "image/x-icon") {
      let best = 0;
      for (let i = 0, n = buf.readUInt16LE(4); i < n && 6 + i * 16 < buf.length; i++) best = Math.max(best, buf[6 + i * 16] || 256);
      return best ? { w: best, h: best } : null;
    }
    if (type === "image/webp") {
      const kind = buf.toString("ascii", 12, 16);
      if (kind === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
      if (kind === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
      if (kind === "VP8L") { const v = buf.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
      return null;
    }
    if (type === "image/jpeg") {
      for (let i = 2; i + 9 < buf.length;) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch {}
  return null;
}

// White logos on a clear background, which vanish on the app's white tile —
// found by drawing every cached logo (22 Oct 2026). Only their company-site
// files: a replacement from the logo directory is judged on its own
const INVISIBLE = new Set(["ALPA", "ANTHEM", "CAMPUS", "GROBTEA", "NECLIFE", "PCBL", "PFOCUS", "STYRENIX", "TITAGARH", "VSSL", "WINDMACHIN", "ZENITHEXPO"]);
const DIRECTORY = "Indian listed company logos API";

// null when fine; else why not: "small" (32–63 px: shown, but replaced when a
// sharper one exists) or "tiny" (under 32 px), "banner", "invisible" or
// "source" (taken from TradingView, whose terms don't allow reuse) — not shown
export function logoFlaw(body, meta, sym) {
  if (/tradingview/i.test(`${meta?.sourceProvider ?? ""} ${meta?.source ?? ""}`)) return "source";
  if (INVISIBLE.has(sym) && !meta?.sourceProvider) return "invisible";
  const size = imageSize(body);
  if (!size?.w || !size?.h) return null;
  const aspect = size.w / size.h;
  if (aspect > 2.5 || aspect < 0.4) return "banner";
  const side = Math.min(size.w, size.h);
  return side < 32 ? "tiny" : side < 64 ? "small" : null;
}

// A second, symbol-independent source for stocks whose company website has no
// compatible icon. Match the source record to NSE's ISIN first, request PNG
// only (never its SVG), and reject its generated monogram fallback.
async function limitedBody(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("logo response too large");
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error("logo response too large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

const validIsin = isin => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(String(isin ?? "").toUpperCase());

export async function listedCompanyLogo(company, expectedIsin) {
  const isin = String(expectedIsin ?? "").toUpperCase();
  if (!validIsin(isin) || String(company?.isin ?? "").toUpperCase() !== isin || typeof company?.hasLogo !== "boolean") {
    return { checked: false, logo: null };
  }
  if (!company.hasLogo) return { checked: true, logo: null };

  const source = `${LISTED_LOGO_ORIGIN}/v1/logos/${encodeURIComponent(isin)}?format=png&size=128`;
  const response = await fetch(source, {
    headers: { "user-agent": UA, accept: "image/png" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "error",
  });
  if (response.status === 404) return { checked: true, logo: null };
  if (!response.ok) throw new Error(`listed-logo source: HTTP ${response.status}`);
  if (new URL(response.url).origin !== LISTED_LOGO_ORIGIN) throw new Error("listed-logo source redirected outside its host");
  if (response.headers.has("x-logo-fallback")) return { checked: false, logo: null };
  if (!/^image\/png\b/i.test(response.headers.get("content-type") ?? "")) throw new Error("listed-logo source did not return PNG");
  const body = await limitedBody(response, IMAGE_BYTES);
  if (body.length < 64 || imageType(body) !== "image/png") throw new Error("listed-logo source returned an invalid PNG");
  return { checked: true, logo: { type: "image/png", body, source } };
}

export async function listedLogoForIsin(value) {
  const isin = String(value ?? "").toUpperCase();
  if (!validIsin(isin)) return { checked: false, logo: null };
  const response = await fetch(`${LISTED_LOGO_ORIGIN}/v1/companies/${encodeURIComponent(isin)}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "error",
  });
  if (response.status === 404) return { checked: true, logo: null };
  if (!response.ok) throw new Error(`listed-logo metadata: HTTP ${response.status}`);
  if (new URL(response.url).origin !== LISTED_LOGO_ORIGIN) throw new Error("listed-logo metadata redirected outside its host");
  const body = await limitedBody(response, 64 * 1024);
  let metadata;
  try { metadata = JSON.parse(body.toString("utf8"))?.data; } catch { throw new Error("listed-logo metadata was not valid JSON"); }
  return listedCompanyLogo(metadata, isin);
}

// ── Disk cache and a one-at-a-time queue ────────────────────────────────────
const metaPath = sym => join(LOGO_DIR, `${sym}.json`);
const imgPath = sym => join(LOGO_DIR, `${sym}.img`);
function readMeta(sym) {
  try { return JSON.parse(readFileSync(metaPath(sym), "utf8")); } catch { return null; }
}
const fresh = meta => meta && Date.now() - Date.parse(meta.at) < (meta.miss ? MISS_DAYS : KEEP_DAYS) * 86400000
  && (!meta.miss || meta.providerChecked === true || Date.now() < Date.parse(meta.retryAt ?? ""));

const inFlight = new Map();
let chain = Promise.resolve();
const queued = fn => (chain = chain.then(fn, fn));

// The cached logo as it should be served: { type, body } (with `noStore` while
// a sharper one is still being looked for), or null for the letters tile.
// A flawed one sends for a better one from the logo directory, once.
function shown(sym, meta, isinOf) {
  const img = cachedImage(sym, meta);
  if (!img) return null;
  const flaw = logoFlaw(img.body, meta, sym);
  if (!flaw) return img;
  if (!meta.betterChecked) betterLogo(sym, meta, flaw, isinOf);
  return flaw === "small" ? { ...img, noStore: !meta.betterChecked } : null;
}

async function isinFor(sym, isinOf) {
  return typeof isinOf === "function" ? Promise.resolve(isinOf(sym)).catch(() => null) : isinOf;
}

// A sharper or usable logo from the directory, in the background. Only a
// definite answer is recorded: when the directory can't be reached, the next
// view tries again
function betterLogo(sym, meta, flaw, isinOf) {
  const key = `better:${sym}`;
  if (inFlight.has(key)) return;
  const job = queued(async () => {
    const isin = await isinFor(sym, isinOf);
    let result;
    try { result = await listedLogoForIsin(isin); }
    catch (e) { if (process.env.LOGO_DEBUG) console.error(`better logo ${sym}:`, e.message); return; }
    const logo = result.logo && !logoFlaw(result.logo.body, { sourceProvider: DIRECTORY }, sym) ? result.logo : null;
    mkdirSync(LOGO_DIR, { recursive: true });
    if (logo) {
      writeFileSync(imgPath(sym), logo.body);
      writeFileSync(metaPath(sym), JSON.stringify({ at: new Date().toISOString(), type: logo.type, source: logo.source, sourceProvider: DIRECTORY, isin, website: meta.website ?? null, upgradedFrom: flaw, betterChecked: true }));
    } else if (result.checked) {
      writeFileSync(metaPath(sym), JSON.stringify({ ...meta, betterChecked: true, betterCheckedAt: new Date().toISOString() }));
    }
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
}

// For tests: resolves once the queued logo jobs are done
export const logoJobsSettled = () => chain.then(() => {}, () => {});

// { type, body[, noStore] } or null. `websiteOf(sym)` gives the company's site
// and `isinOf(sym)` its NSE identity, so the alternate logo source cannot match
// a similarly named company by ticker alone.
export function logoFor(sym, websiteOf, isinOf) {
  const meta = readMeta(sym);
  if (fresh(meta)) return Promise.resolve(meta.miss ? null : shown(sym, meta, isinOf));
  if (inFlight.has(sym)) return inFlight.get(sym);
  const job = queued(async () => {
    // Backfilled entries may include a website from NSE's company directory
    // for issuers without a BRSR profile. Keep using that verified source when
    // the cached icon expires instead of dropping back to a BRSR-only lookup.
    const website = await websiteOf(sym).catch(() => null) || meta?.website || null;
    const logo = website ? await readLogo(website).catch(() => null) : null;
    const siteFlaw = logo ? logoFlaw(logo.body, {}, sym) : null;
    mkdirSync(LOGO_DIR, { recursive: true });
    if (logo && !siteFlaw) {
      writeFileSync(imgPath(sym), logo.body);
      writeFileSync(metaPath(sym), JSON.stringify({ at: new Date().toISOString(), type: logo.type, source: logo.source, website }));
      return { type: logo.type, body: logo.body };
    }
    let providerResult = { checked: false, logo: null };
    const isin = await isinFor(sym, isinOf);
    try {
      providerResult = await listedLogoForIsin(isin);
    } catch (e) { if (process.env.LOGO_DEBUG) console.error(`listed-logo ${sym}:`, e.message); }
    if (providerResult.logo && !logoFlaw(providerResult.logo.body, { sourceProvider: DIRECTORY }, sym)) {
      writeFileSync(imgPath(sym), providerResult.logo.body);
      writeFileSync(metaPath(sym), JSON.stringify({ at: new Date().toISOString(), type: providerResult.logo.type, source: providerResult.logo.source, sourceProvider: DIRECTORY, isin, website, ...(siteFlaw ? { upgradedFrom: siteFlaw, betterChecked: true } : {}) }));
      return { type: providerResult.logo.type, body: providerResult.logo.body };
    }
    // The site's small icon, when the directory has nothing sharper
    if (logo && siteFlaw === "small") {
      writeFileSync(imgPath(sym), logo.body);
      writeFileSync(metaPath(sym), JSON.stringify({ at: new Date().toISOString(), type: logo.type, source: logo.source, website, ...(providerResult.checked ? { betterChecked: true } : {}) }));
      return { type: logo.type, body: logo.body, ...(providerResult.checked ? {} : { noStore: true }) };
    }
    // Kept a while so a company without one isn't asked again on every view;
    // an older good logo stays in use meanwhile
    if (meta && !meta.miss && existsSync(imgPath(sym))) return shown(sym, meta, isinOf);
    try { unlinkSync(imgPath(sym)); } catch {}
    const at = Date.now();
    writeFileSync(metaPath(sym), JSON.stringify({
      at: new Date(at).toISOString(), miss: true, website,
      providerChecked: providerResult.checked,
      ...(!providerResult.checked ? { retryAt: new Date(at + 60 * 60 * 1000).toISOString() } : {}),
    }));
    return null;
  }).finally(() => inFlight.delete(sym));
  inFlight.set(sym, job);
  return job;
}

function cachedImage(sym, meta) {
  try { return { type: meta.type, body: readFileSync(imgPath(sym)) }; } catch { return null; }
}
