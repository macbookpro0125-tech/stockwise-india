import { api } from "./api.js";

// The strategies a user saves on Discover and their "My Notes", kept with the
// account (they used to stay in one browser). One shared copy each, loaded at
// sign-in, changed optimistically and saved behind the scenes; pages listen
// for the events below to redraw.

const emit = name => window.dispatchEvent(new Event(name));

let strategies = null;
export const strategiesStore = {
  get: () => strategies ?? [],
  load: () => api.strategies().then(d => { strategies = d.strategies ?? []; emit("customPresetsUpdated"); }).catch(() => {}),
  set(list) {
    strategies = list;
    emit("customPresetsUpdated");
    return api.saveStrategies(list).then(d => { strategies = d.strategies ?? list; emit("customPresetsUpdated"); }).catch(() => {});
  },
  reset() { strategies = null; emit("customPresetsUpdated"); },
};

let notes = null;
export const notesStore = {
  get: symbol => notes?.[symbol] ?? null,
  loaded: () => notes != null,
  load: () => api.notes().then(d => { notes = d.notes ?? {}; emit("notesUpdated"); }).catch(() => {}),
  save(symbol, note) {
    notes = { ...notes, [symbol]: note };
    emit("notesUpdated");
    return api.saveNote(symbol, note);
  },
  remove(symbol) {
    const next = { ...notes };
    delete next[symbol];
    notes = next;
    emit("notesUpdated");
    return api.deleteNote(symbol);
  },
  reset() { notes = null; emit("notesUpdated"); },
};

// Strategies and notes saved in this browser before they moved to accounts.
// They're not filed under anyone, so they're never added to an account by
// themselves — on a shared computer they could be someone else's. The person
// signed in decides: move them to this account, or discard them.
const OLD_STRATEGIES = "customPresets", OLD_NOTES = "stockwise-india-notes";
const readOld = (key, empty) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? empty; } catch { return empty; } };
export function browserLeftovers() {
  const s = readOld(OLD_STRATEGIES, []), n = readOld(OLD_NOTES, {});
  const strategyCount = Array.isArray(s) ? s.length : 0, noteCount = n && typeof n === "object" ? Object.keys(n).length : 0;
  return strategyCount || noteCount ? { strategyCount, noteCount } : null;
}
export function discardLeftovers() {
  try { localStorage.removeItem(OLD_STRATEGIES); localStorage.removeItem(OLD_NOTES); } catch {}
}
export async function moveLeftovers() {
  const oldStrategies = readOld(OLD_STRATEGIES, []), oldNotes = readOld(OLD_NOTES, {});
  await Promise.all([strategiesStore.load(), notesStore.load()]);
  const have = new Set(strategiesStore.get().map(p => p.id));
  const added = (Array.isArray(oldStrategies) ? oldStrategies : []).filter(p => p && !have.has(p.id));
  if (added.length) await strategiesStore.set([...strategiesStore.get(), ...added]);
  // A note already on the account wins over this browser's copy
  for (const [symbol, note] of Object.entries(oldNotes && typeof oldNotes === "object" ? oldNotes : {})) {
    if (!notesStore.get(symbol) && note?.verdict) await notesStore.save(symbol, note).catch(() => {});
  }
  discardLeftovers();
}
