import { db } from "./db.js";
import { isValidSymbol } from "./screen.js";
import { badRequest } from "./http-errors.js";

const fields = {
  case: "case_text",
  marketGap: "market_gap",
  breakers: "breakers",
};

function cleanTicker(ticker) {
  const value = String(ticker ?? "").trim().toUpperCase();
  if (!isValidSymbol(value)) throw badRequest("Enter a valid NSE symbol");
  return value;
}

function shape(row, ticker) {
  return row ? {
    ticker: row.ticker,
    case: row.case_text,
    marketGap: row.market_gap,
    breakers: row.breakers,
    updatedAt: row.updated_at,
  } : { ticker, case: "", marketGap: "", breakers: "", updatedAt: null };
}

export function getThesis(userId, ticker) {
  const symbol = cleanTicker(ticker);
  const row = db.prepare("SELECT ticker, case_text, market_gap, breakers, updated_at FROM thesis_notes WHERE user_id = ? AND ticker = ?").get(userId, symbol);
  return shape(row, symbol);
}

export function saveThesis(userId, ticker, input = {}) {
  const symbol = cleanTicker(ticker);
  const text = key => String(input[key] ?? "").trim().slice(0, 4000);
  const values = [text("case"), text("marketGap"), text("breakers"), new Date().toISOString()];
  db.prepare(`
    INSERT INTO thesis_notes (user_id, ticker, case_text, market_gap, breakers, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, ticker) DO UPDATE SET
      case_text = excluded.case_text,
      market_gap = excluded.market_gap,
      breakers = excluded.breakers,
      updated_at = excluded.updated_at
  `).run(userId, symbol, ...values);
  return getThesis(userId, symbol);
}
