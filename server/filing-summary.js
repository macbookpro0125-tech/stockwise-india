// Reads the original NSE attachment on demand and returns only source-linked
// extracts. We deliberately quote evidence instead of inventing an impact call.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { HttpError } from "./http-errors.js";
// Problems with the attachment itself are 422s with their reason; anything
// else is reported as a temporary failure by the route
const unreadable = message => new HttpError(message, 422);

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 100;
const MAX_TEXT = 90_000;
const NSE_HOST = /(^|\.)nseindia\.com$/i;
const UA = "Mozilla/5.0 (compatible; StockwiseIndia/1.0; educational)";
const STOP = new Set(["about", "after", "also", "because", "being", "could", "from", "have", "into", "more", "other", "should", "their", "there", "these", "those", "under", "were", "which", "while", "would", "your", "company", "notice", "filing", "board", "meeting"]);
const summaryCache = new Map();

function safeAttachmentUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw unreadable("NSE did not provide a usable attachment link."); }
  if (u.protocol !== "https:" || !NSE_HOST.test(u.hostname) || u.username || u.password) {
    throw unreadable("This attachment link is outside NSE's secure filing archive.");
  }
  return u;
}

async function fetchAttachment(raw) {
  let url = safeAttachmentUrl(raw);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/pdf,application/octet-stream,text/html,text/plain,*/*" },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get("location");
      if (!next || redirects === 3) throw unreadable("NSE's attachment redirected too many times.");
      url = safeAttachmentUrl(new URL(next, url).href);
      continue;
    }
    if (!response.ok) throw new Error(`NSE attachment returned HTTP ${response.status}.`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_BYTES) throw unreadable("This attachment is too large to read in the app (15 MB limit). Open the original on NSE.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw unreadable("This attachment is too large to read in the app (15 MB limit). Open the original on NSE.");
    return { bytes, url, contentType: response.headers.get("content-type") || "" };
  }
  throw new Error("Could not open the NSE attachment.");
}

async function extractPdf(bytes) {
  const task = getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true, verbosity: 0 });
  const pdf = await task.promise;
  const pages = [];
  let size = 0;
  const totalPages = pdf.numPages;
  const count = Math.min(totalPages, MAX_PAGES);
  for (let pageNo = 1; pageNo <= count && size < MAX_TEXT; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str || "").join(" ").replace(/\s+/g, " ").trim();
    if (text) { pages.push({ page: pageNo, text: text.slice(0, Math.max(0, MAX_TEXT - size)) }); size += text.length; }
    page.cleanup();
  }
  await task.destroy();
  return { pages, pageCount: totalPages, truncated: totalPages > count || size >= MAX_TEXT, kind: "PDF" };
}

function extractText(bytes, contentType) {
  let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (/html|xml/i.test(contentType) || /^\s*</.test(text)) {
    text = text.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|tr|li|h[1-6])\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  }
  text = text.replace(/\u0000/g, "").replace(/[\t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return text ? [{ page: null, text: text.slice(0, MAX_TEXT) }] : [];
}

// Letterheads, exchange addresses, sign-offs and the auditor's standard
// review wording fill the first lines of most attachments and say nothing
// about the event — the first version quoted them as "evidence"
const BOILERPLATE = /e-?mail\s*:|website\s*:|\btel(?:ephone)?\s*[:.]|\bfax\b|www\.|registered office|corporate office|corporate identi(?:ty|fication) (?:no|number)|\bCIN\b|exchange plaza|bandra kurla|dalal street|phiroze jeejeebhoy|listing (?:department|compliance)|scrip code|dear sir|yours (?:faithfully|truly|sincerely)|for and on behalf of|membership no|standard on review engagements|nothing has come to our attention|we conducted our review|SRE 2410|whether due to fraud or error|this report is intended solely/i;

function sentencesFor(pages) {
  return pages.flatMap(({ page, text }) => text.split(/(?<=[.!?])\s+(?=[A-Z0-9₹“"(])/)
    .map(sentence => ({ page, text: sentence.trim() }))
    .filter(s => s.text.length >= 55 && s.text.length <= 900)
    // prose, not a flattened table of figures or a letterhead
    .filter(s => (s.text.match(/[A-Za-z]/g)?.length ?? 0) / s.text.length >= 0.55 && !BOILERPLATE.test(s.text)));
}

function evidenceFrom(pages) {
  const candidates = sentencesFor(pages);
  const chosen = [];
  const seen = new Set();
  for (const s of candidates.map((s, order) => {
    const words = s.text.toLowerCase().match(/[a-z][a-z-]{3,}/g) || [];
    const terms = new Set(words.filter(w => !STOP.has(w))).size;
    const hasAmount = /(?:₹|\b(?:rs\.?|inr)\s*)\s?\d|\b\d[\d,.]*\s?(?:crore|lakh|million|billion|%)/i.test(s.text);
    const signal = /\b(?:approved|appointed|resigned|acquired|acquisition|penalty|order|contract|commissioned|capacity|revenue|profit|dividend|borrowings|default|investigation|auditor|qualified|results|agreement|terminated|effective|completed|disclosed|turnover|consideration|subsidiary)\b/i.test(s.text);
    // Signals and amounts matter more than length; earlier lines a little more
    return { ...s, rank: Math.min(terms, 14) + (hasAmount ? 5 : 0) + (signal ? 5 : 0) - order * 0.01 };
  }).sort((a, b) => b.rank - a.rank)) {
    const key = s.text.toLowerCase().slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push({ page: s.page, text: s.text.slice(0, 460) });
    if (chosen.length === 4) break;
  }
  return chosen;
}

export async function summarizeFiling({ url, title, date }) {
  const key = `${url}|${date || ""}`;
  const cached = summaryCache.get(key);
  if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.value;
  const { bytes, url: sourceUrl, contentType } = await fetchAttachment(url);
  const pdf = new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
  const extracted = pdf
    ? await extractPdf(bytes)
    : { pages: extractText(bytes, contentType), pageCount: null, truncated: bytes.byteLength >= MAX_TEXT, kind: /html/i.test(contentType) ? "HTML" : "text" };
  const allText = extracted.pages.map(p => p.text).join(" ").slice(0, MAX_TEXT);
  if (allText.replace(/\s/g, "").length < 80) {
    const result = { title, date, sourceUrl, kind: extracted.kind, pageCount: extracted.pageCount, error: "The attachment opened, but it has no readable text. It may be a scanned document; open the original filing on NSE." };
    summaryCache.set(key, { at: Date.now(), value: result });
    return result;
  }
  const result = {
    title, date, sourceUrl, kind: extracted.kind, pageCount: extracted.pageCount,
    pagesRead: extracted.pages.length, truncated: extracted.truncated,
    charactersRead: allText.length,
    evidence: evidenceFrom(extracted.pages),
    method: "Full attachment text extraction with quoted, page-linked passages; no financial impact or sentiment inferred.",
    limitation: extracted.truncated ? "The document exceeded the app's extraction limit; only the first 100 pages / 90,000 characters were read." : "Automated extraction can miss context or misread scanned tables. Verify the original filing.",
  };
  summaryCache.set(key, { at: Date.now(), value: result });
  if (summaryCache.size > 100) summaryCache.delete(summaryCache.keys().next().value);
  return result;
}
