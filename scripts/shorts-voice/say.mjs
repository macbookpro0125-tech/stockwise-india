// Numbers and names as Michael (Kokoro) should say them, shared by the Short writers
const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
const w99 = n => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""));
const w999 = n => (n >= 100 ? ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + w99(n % 100) : "") : w99(n));
export const words = n => {
  n = Math.round(Math.abs(n)); if (n === 0) return "zero";
  const parts = []; const lakh = Math.floor(n / 100000), th = Math.floor((n % 100000) / 1000), rest = n % 1000;
  if (lakh) parts.push(w999(lakh) + " lakh"); if (th) parts.push(w99(th) + " thousand"); if (rest) parts.push((parts.length && rest < 100 ? "and " : "") + w999(rest));
  return parts.join(" ");
};
export const sayPct = x => { const a = Math.abs(x); return a >= 10 ? `${words(a)} percent` : `${words(Math.floor(a))} point ${ONES[Math.round((a % 1) * 10) % 10]} percent`; };
// "The Jammu & Kashmir Bank" → "Jammu and Kashmir Bank"
export const sayName = n => n.replace(/&/g, " and ").replace(/\s+/g, " ").replace(/^The /, "").trim();
