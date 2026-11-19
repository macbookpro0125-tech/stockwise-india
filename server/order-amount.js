// The size of an order a company told NSE it won, read from its own notice
// (19 Nov 2026, the owner: show "the major contract winners" on the day's
// market page). SEBI's format asks for the "broad consideration or size of
// the order(s)/contract(s)", so that line is read first; then a few plain
// phrasings ("order worth", "valued at", "amounting to"). Nothing found means
// "amount not stated" — an amount is never guessed or worked out.
//
//   node --no-warnings server/order-amount-test.js

// "Rs. 707.80 crore", "₹ 18,50,99,684", "INR 419.47 Cr", "Rupees 46,57,56,276.62/-",
// "Rs. 194.06 Million", "USD 10.77 million", "USD 2,345,208"
const MONEY = /(₹|\bRs\.?|\bINR|\bRupees|\bUSD|\bUS\s?\$|\$|\bEUR|€)\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(\/-)?\s*(crores?|cr\b\.?|lakhs?|lacs?|million|mn\b|billion|bn\b)?/gi;
// SEBI's own line first; a part's "contract value" can come before the total
const LABELS = [/broad\s+(?:commercial\s+)?consideration/gi, /size\s+of\s+(?:the\s+)?(?:order|contract|work\s+order)|order\s+size|value\s+of\s+the\s+(?:purchase\s+|work\s+)?order|(?:order|contract)\s+value/gi];
const PHRASE = /(?:order|contract|award|loa|letter of (?:award|acceptance))[^.]{0,80}?(?:of|worth|valued at|value of|amounting to|aggregating to|aggregating|for a value of|price of)\s*(?:approx(?:imately|\.)?\s*)?$/i;

const INR = new Set(["₹", "rs", "rs.", "inr", "rupees"]);
const unitCr = unit => {
  const u = (unit ?? "").toLowerCase().replace(/\.$/, "");
  if (/^(crores?|cr)$/.test(u)) return 1;
  if (/^(lakhs?|lacs?)$/.test(u)) return 0.01;
  if (/^(million|mn)$/.test(u)) return 0.1;
  if (/^(billion|bn)$/.test(u)) return 100;
  return 1e-7; // plain rupees
};
const unitMn = unit => {
  const u = (unit ?? "").toLowerCase();
  if (/^(million|mn)$/.test(u)) return 1;
  if (/^(billion|bn)$/.test(u)) return 1000;
  if (/^(crores?|cr)/.test(u)) return 10;
  if (/^(lakhs?|lacs?)/.test(u)) return 0.1;
  return 1e-6;
};

// One amount from the start of `text`: { cr } for rupees, { currency, mn } otherwise
function firstAmount(text) {
  MONEY.lastIndex = 0;
  for (const m of text.matchAll(MONEY)) {
    const [, cur, digits, , unit] = m;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 14);
    if (/^\s*(per|\/\s*(unit|mt|kwh|kg|ton))/i.test(after)) continue; // a tariff or a rate, not an order
    // a threshold ("Below ₹ 50 crore", "₹ 100 crore and above"), not an order
    if (/\b(below|above|less than|more than|exceeding|up to|upto)\s*$/i.test(text.slice(Math.max(0, m.index - 16), m.index)) || /^\s*(and above|to below|or more)/i.test(after)) continue;
    const n = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) continue;
    const c = cur.toLowerCase().replace(/\s/g, "");
    if (INR.has(c)) {
      const cr = n * unitCr(unit);
      if (cr < 0.01) continue; // under ₹1 lakh: a fee or a rate, not an order's size
      return { cr: Math.round(cr * 100) / 100 };
    }
    const currency = c.startsWith("eur") || c === "€" ? "EUR" : "USD";
    const mn = n * unitMn(unit);
    if (mn < 0.01) continue;
    return { currency, mn: Math.round(mn * 100) / 100 };
  }
  return null;
}

export function orderAmount(raw) {
  const text = String(raw ?? "").normalize("NFKC").replace(/\s+/g, " ");
  // the regulation's own line first
  for (const label of LABELS) {
    for (const m of text.matchAll(label)) {
      // only this item of the disclosure: it ends where "Whether the promoter…" begins
      const item = text.slice(m.index + m[0].length, m.index + m[0].length + 260).split(/\bwhether\b/i)[0];
      const found = firstAmount(item);
      if (found) return { ...found, from: "size" };
    }
  }
  // then "order of Rs. …", "order worth …", "valued at …", "amounting to …"
  for (const m of text.matchAll(MONEY)) {
    if (PHRASE.test(text.slice(Math.max(0, m.index - 140), m.index))) {
      const found = firstAmount(text.slice(m.index, m.index + 80));
      if (found) return { ...found, from: "phrase" };
    }
  }
  return null;
}

// Named the lowest bidder (L1) rather than awarded — said so beside it
export const lowestBidder = raw => /\blowest\s+bidder\b|\bL\s?-?\s?1\b(?!\d)/i.test(String(raw ?? ""));
