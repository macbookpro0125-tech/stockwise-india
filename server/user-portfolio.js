import { db } from "./db.js";
import { isValidSymbol } from "./screen.js";
import { loadMarketSnapshot } from "./market-data.js";
import { badRequest, notFound } from "./http-errors.js";

// The original's portfolio: each lot you bought, with price, quantity, date
// and a note. Stored per account.

// Splits and bonus issues since a lot's figures were entered (16 Oct 2026): a
// 1:1 bonus doubles the shares and halves the price, so a lot entered before
// one read as a 50% loss. Counted from the day the figures were entered or
// last edited, not the buy date — a broker's app shows figures already
// adjusted, and someone copying them in with an older buy date mustn't be
// adjusted twice. Shown adjusted; an edit saves them as shown, from today.
export const splitFactorSince = (ticker, iso) => (iso ? (loadMarketSnapshot()?.splits?.[ticker] ?? []) : [])
  .filter(s => s.exDate > String(iso).slice(0, 10)).reduce((f, s) => f * s.ratio, 1);

const row = h => {
  const basis = h.basis_date ?? h.added_at;
  const f = splitFactorSince(h.ticker, basis);
  return {
    id: h.id, ticker: h.ticker, name: h.name, buyPrice: h.buy_price / f, qty: h.qty * f,
    buyDate: h.buy_date, notes: h.notes ?? "", addedAt: h.added_at,
    ...(f !== 1 && { splitAdjusted: { ratio: f, since: String(basis).slice(0, 10) } }),
  };
};

function validate({ ticker, name, buyPrice, qty, buyDate, notes }) {
  ticker = String(ticker || "").trim().toUpperCase();
  if (!isValidSymbol(ticker)) throw badRequest("Enter an NSE symbol, e.g. TCS");
  buyPrice = Number(buyPrice);
  qty = Number(qty);
  if (!(buyPrice > 0)) throw badRequest("Buy price must be more than 0");
  if (!(qty > 0)) throw badRequest("Quantity must be more than 0");
  if (buyDate && !/^\d{4}-\d{2}-\d{2}$/.test(buyDate)) throw badRequest("Buy date must be a date");
  return {
    ticker,
    name: String(name || "").trim().slice(0, 200) || ticker,
    buyPrice, qty,
    buyDate: buyDate || null,
    notes: String(notes || "").trim().slice(0, 500),
  };
}

export function listHoldings(userId) {
  return db.prepare("SELECT * FROM holdings WHERE user_id = ? ORDER BY added_at").all(userId).map(row);
}

export function addHolding(userId, input) {
  const h = validate(input);
  const now = new Date().toISOString();
  const result = db.prepare(
    "INSERT INTO holdings (user_id, ticker, name, buy_price, qty, buy_date, notes, added_at, basis_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(userId, h.ticker, h.name, h.buyPrice, h.qty, h.buyDate, h.notes, now, now);
  return row(db.prepare("SELECT * FROM holdings WHERE id = ?").get(result.lastInsertRowid));
}

// The ticker of an existing lot stays as it was (the original locks it too).
// Fields left out keep their saved values; an empty one clears it.
export function updateHolding(userId, id, input) {
  const existing = db.prepare("SELECT * FROM holdings WHERE id = ? AND user_id = ?").get(id, userId);
  if (!existing) throw notFound("No such holding");
  const h = validate({
    ...row(existing),
    ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
    ticker: existing.ticker,
  });
  // row(existing) is on today's share basis, so the saved figures are too
  db.prepare("UPDATE holdings SET name = ?, buy_price = ?, qty = ?, buy_date = ?, notes = ?, basis_date = ? WHERE id = ? AND user_id = ?")
    .run(h.name, h.buyPrice, h.qty, h.buyDate, h.notes, new Date().toISOString(), id, userId);
  return row(db.prepare("SELECT * FROM holdings WHERE id = ?").get(id));
}

// Several lots at once (a broker file's import): all saved or none
export function addHoldings(userId, inputs) {
  const lots = inputs.map(validate);
  const insert = db.prepare("INSERT INTO holdings (user_id, ticker, name, buy_price, qty, buy_date, notes, added_at, basis_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const at = new Date().toISOString();
  db.exec("BEGIN");
  try {
    for (const h of lots) insert.run(userId, h.ticker, h.name, h.buyPrice, h.qty, h.buyDate, h.notes, at, at);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return lots.length;
}

export function removeHolding(userId, id) {
  db.prepare("DELETE FROM holdings WHERE id = ? AND user_id = ?").run(id, userId);
}
