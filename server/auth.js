// scrypt (built into node:crypto) instead of adding bcrypt/argon2 as a
// dependency — it's a standard, memory-hard KDF, not a homegrown scheme.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  // Constant-time compare — a plain === leaks how many leading bytes matched
  // via timing, which is exactly the kind of thing that turns "just check
  // the password" into a real vulnerability.
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signup(email, password) {
  email = email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Valid email required");
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters");

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) throw new Error("An account with this email already exists");

  const { hash, salt } = hashPassword(password);
  const result = db.prepare(
    "INSERT INTO users (email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)"
  ).run(email, hash, salt, new Date().toISOString());

  return createSession(Number(result.lastInsertRowid));
}

export function login(email, password) {
  email = email.trim().toLowerCase();
  const user = db.prepare("SELECT id, password_hash, password_salt FROM users WHERE email = ?").get(email);
  // Same error for "no such user" and "wrong password" — distinguishing them
  // tells an attacker which emails are registered.
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    throw new Error("Invalid email or password");
  }
  return createSession(Number(user.id));
}

function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
  return { token, userId };
}

export function verifySession(token) {
  if (!token) return null;
  const row = db.prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?").get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return Number(row.user_id);
}

export function logout(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function accountEmail(userId) {
  return db.prepare("SELECT email FROM users WHERE id = ?").get(userId)?.email ?? null;
}

// Removes the account and everything saved with it — what the privacy page
// promises. Asks for the password again, so a session left signed in on a
// shared computer can't do it. Each table is cleared by name rather than
// relying on ON DELETE CASCADE, which does nothing if foreign keys are off.
export function deleteAccount(userId, password) {
  const user = db.prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").get(userId);
  if (!user || !verifyPassword(String(password ?? ""), user.password_salt, user.password_hash)) {
    throw new Error("That password isn't right");
  }
  db.exec("BEGIN");
  try {
    for (const table of ["sessions", "alerts", "watchlist", "holdings"]) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
