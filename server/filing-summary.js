// Reads the original NSE attachment on demand and returns only source-linked
// extracts. We deliberately quote evidence instead of inventing an impact call.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { classifyAnnouncement } from "./company-extras.js";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 100;
const MAX_TEXT = 90_000;
const NSE_HOST = /(^|\.)nseindia\.com$/i;
const UA = "Mozilla/5.0 (compatible; StockwiseIndia/1.0; educational)";
const STOP = new Set(["about", "after", "also", "because", "being", "could", "from", "have", "into", "more", "other", "should", "their", "there", "these", "those", "under", "were", "which", "while", "would", "your", "company", "notice", "filing", "board", "meeting"]);
const summaryCache = new Map();

function safeAttachmentUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("NSE did not provide a usable attachment link."); }
  if (u.protocol !== "https:" || !NSE_HOST.test(u.hostname) || u.username || u.password) {
    throw new Error("This attachment link is outside NSE's secure filing archive.");
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
      if (!next || redirects === 3) throw new Error("NSE's attachment redirected too many times.");
      url = safeAttachmentUrl(new URL(next, url).href);
      continue;
    }
    if (!response.ok) throw new Error(`NSE attachment returned HTTP ${response.status}.`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_BYTES) throw new Error("This attachment is too large to read in the app (15 MB limit).");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error("This attachment is too large to read in the app (15 MB limit).");
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

function sentencesFor(pages) {
  return pages.flatMap(({ page, text }) => text.split(/(?<=[.!?])\s+(?=[A-Z0-9₹“"(])/)
    .map(sentence => ({ page, text: sentence.trim() }))
    .filter(s => s.text.length >= 55 && s.text.length <= 900));
}

function evidenceFrom(pages) {
  const candidates = sentencesFor(pages);
  const chosen = [];
  const seen = new Set();
  for (const s of candidates.map(s => {
    const words = s.text.toLowerCase().match(/[a-z][a-z-]{3,}/g) || [];
    const terms = [...new Set(words.filter(w => !STOP.has(w)))];
    const hasAmount = /(?:₹|\b(?:rs\.?|inr)\s*)\s?\d|\b\d[\d,.]*\s?(?:crore|lakh|million|billion|%)/i.test(s.text);
    const signal = /\b(?:approved|appointed|resigned|acquired|acquisition|penalty|order|contract|commissioned|capacity|revenue|profit|dividend|borrowings|default|investigation|auditor|qualified|results|agreement|terminated|effective|completed|disclosed|turnover|consideration|subsidiary)\b/i.test(s.text);
    return { ...s, rank: terms.length + (hasAmount ? 3 : 0) + (signal ? 2 : 0) };
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
  const review = classifyAnnouncement(title, allText);
  const result = {
    title, date, sourceUrl, kind: extracted.kind, pageCount: extracted.pageCount,
    pagesRead: extracted.pages.length, truncated: extracted.truncated,
    charactersRead: allText.length,
    category: review?.category ?? null,
    reviewPrompt: review?.reviewPrompt ?? null,
    matchedText: review?.matchedText ?? null,
    amounts: review?.extractedAmounts ?? [],
    evidence: evidenceFrom(extracted.pages),
    method: "Full attachment text extraction with quoted, page-linked passages; no financial impact or sentiment inferred.",
    limitation: extracted.truncated ? "The document exceeded the app's extraction limit; only the first 100 pages / 90,000 characters were read." : "Automated extraction can miss context or misread scanned tables. Verify the original filing.",
  };
  summaryCache.set(key, { at: Date.now(), value: result });
  if (summaryCache.size > 100) summaryCache.delete(summaryCache.keys().next().value);
  return result;
}
