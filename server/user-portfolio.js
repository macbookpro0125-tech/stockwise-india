import { db } from "./db.js";
import { isValidSymbol } from "./screen.js";
import { badRequest, notFound } from "./http-errors.js";

// The original's portfolio: each lot you bought, with price, quantity, date
// and a note. Stored per account.

const row = h => ({
  id: h.id, ticker: h.ticker, name: h.name, buyPrice: h.buy_price, qty: h.qty,
  buyDate: h.buy_date, notes: h.notes ?? "", addedAt: h.added_at,
});

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
  const result = db.prepare(
    "INSERT INTO holdings (user_id, ticker, name, buy_price, qty, buy_date, notes, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(userId, h.ticker, h.name, h.buyPrice, h.qty, h.buyDate, h.notes, new Date().toISOString());
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
  db.prepare("UPDATE holdings SET name = ?, buy_price = ?, qty = ?, buy_date = ?, notes = ? WHERE id = ? AND user_id = ?")
    .run(h.name, h.buyPrice, h.qty, h.buyDate, h.notes, id, userId);
  return row(db.prepare("SELECT * FROM holdings WHERE id = ?").get(id));
}

export function removeHolding(userId, id) {
  db.prepare("DELETE FROM holdings WHERE id = ? AND user_id = ?").run(id, userId);
}
