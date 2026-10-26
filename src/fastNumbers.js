// A number's toLocaleString("en-IN", {...}) builds a whole Intl.NumberFormat
// on every call, and on an Android phone that's slow: a company page's chart
// formats prices thousands of times as it draws, ~70 ms of each opening at a
// phone's speed (measured 26 Oct 2026). The same formatter is kept and reused
// for each locale and set of options — the same text, without the rebuild.
const cache = new Map();
const original = Number.prototype.toLocaleString;

function cachedToLocaleString(locales, options) {
  if (locales === undefined && options === undefined) return original.call(this);
  let key;
  try { key = `${Array.isArray(locales) ? locales.join(",") : locales}|${options ? JSON.stringify(options) : ""}`; } catch { return original.call(this, locales, options); }
  let format = cache.get(key);
  if (!format) {
    try { format = new Intl.NumberFormat(locales, options); } catch { return original.call(this, locales, options); }
    if (cache.size < 300) cache.set(key, format);
  }
  return format.format(this);
}

export function installFastNumbers() {
  if (Number.prototype.toLocaleString !== cachedToLocaleString) Number.prototype.toLocaleString = cachedToLocaleString;
}
