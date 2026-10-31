import { db } from "./db.js";
import { badRequest } from "./http-errors.js";

// Each user's own Desk (31 Oct 2026, step 3 of "this kind of work, better"):
// the cards they chose, in their order, each one, two or three columns wide.
// Kept whole, as the page sends it, once it's been checked here.

export const CARD_KINDS = ["list", "chart", "business", "price", "peers", "mood", "patterns", "watchlist", "results", "notes"];
export const MAX_CARDS = 16;
const NOTE_MAX = 2000;

// A layout as sent → only what's allowed, or a 400
export function cleanLayout(input) {
  const cards = Array.isArray(input?.cards) ? input.cards : null;
  if (!cards) throw badRequest("A layout is a list of cards");
  if (cards.length > MAX_CARDS) throw badRequest(`At most ${MAX_CARDS} cards`);
  const seen = new Set();
  return {
    cards: cards.map(c => {
      if (!CARD_KINDS.includes(c?.kind)) throw badRequest("Unknown card");
      const id = typeof c.id === "string" && /^[a-z0-9-]{1,40}$/i.test(c.id) && !seen.has(c.id) ? c.id : `${c.kind}-${seen.size + 1}`;
      seen.add(id);
      const card = { id, kind: c.kind, w: [1, 2, 3].includes(c.w) ? c.w : 1 };
      if (c.kind === "notes") card.text = String(c.text ?? "").slice(0, NOTE_MAX);
      return card;
    }),
  };
}

export function getDeskLayout(userId) {
  const row = db.prepare("SELECT layout FROM desk_layouts WHERE user_id = ?").get(userId);
  if (!row) return null;
  try { return cleanLayout(JSON.parse(row.layout)); } catch { return null; }
}

export function saveDeskLayout(userId, input) {
  const layout = cleanLayout(input);
  db.prepare(`INSERT INTO desk_layouts (user_id, layout, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET layout = excluded.layout, updated_at = excluded.updated_at`)
    .run(userId, JSON.stringify(layout), new Date().toISOString());
  return layout;
}

export function clearDeskLayout(userId) {
  db.prepare("DELETE FROM desk_layouts WHERE user_id = ?").run(userId);
}
