// A company's name as the phone's list cards show it (ResultsTable.jsx): the
// "Limited" / "Ltd" every listed company ends with adds nothing there (the
// company page keeps the full name); and its letters, for a tile in place of
// a logo it doesn't have.
export const cardName = name => String(name ?? "").replace(/\s+(limited|ltd\.?)\s*$/i, "").trim();

export function initials(name) {
  const words = cardName(name).split(/[\s&-]+/).filter(w => w && !/^(the|of|and)$/i.test(w));
  return words.slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
}
