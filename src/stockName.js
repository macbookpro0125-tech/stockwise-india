// A company's name as the phone's list cards show it (ResultsTable.jsx): the
// "Limited" / "Ltd" every listed company ends with adds nothing there (the
// company page keeps the full name); and its letters, for a tile in place of
// a logo it doesn't have.
export const cardName = name => String(name ?? "").replace(/\s+(limited|ltd\.?)\s*$/i, "").trim();

export function initials(name) {
  const words = cardName(name).split(/[\s&-]+/).filter(w => w && !/^(the|of|and)$/i.test(w));
  return words.slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
}

// A measure's figure for a card's tray (ResultsTable.jsx): the unit ("%",
// "x", "/9") apart, to be set small beside the number as "/100" is beside the
// scores, so the number fits a third of a phone's width (21 Oct 2026: a
// promoters' holding showed as "71.…")
export function splitUnit(text) {
  const s = String(text ?? "—");
  const m = /^(.*\d)(%|x|\/\d+)$/.exec(s);
  return m ? [m[1], m[2]] : [s, null];
}
