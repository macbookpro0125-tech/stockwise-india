// scrypt (built into node:crypto) instead of adding bcrypt/argon2 as a
// dependency — it's a standard, memory-hard KDF, not a homegrown scheme.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { db } from "./db.js";
import { badRequest, conflict, unauthorized, notFound } from "./http-errors.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESET_TTL_MS = 60 * 60 * 1000; // a reset link works for an hour

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
  if (!email || !email.includes("@")) throw badRequest("Valid email required");
  if (!password || password.length < 8) throw badRequest("Password must be at least 8 characters");

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) throw conflict("An account with this email already exists");

  const { hash, salt } = hashPassword(password);
  const result = db.prepare(
    "INSERT INTO users (email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)"
  ).run(email, hash, salt, new Date().toISOString());

  return createSession(Number(result.lastInsertRowid));
}

export function login(email, password) {
  email = String(email ?? "").trim().toLowerCase();
  const user = db.prepare("SELECT id, password_hash, password_salt FROM users WHERE email = ?").get(email);
  // Same error for "no such user", "wrong password" and "signs in with
  // Google, no password" — distinguishing them tells an attacker which
  // emails are registered.
  if (!user?.password_hash || !verifyPassword(String(password ?? ""), user.password_salt, user.password_hash)) {
    throw unauthorized("Invalid email or password");
  }
  return createSession(Number(user.id));
}

// After firebase-auth.js has confirmed a Google, Apple or phone sign-in: the
// account Firebase's id belongs to; else, for a verified Google/Apple email,
// the account already using that email (it gains the sign-in); else a new
// account. Then our own session.
export function signInWithFirebase(claims) {
  const uid = claims.sub;
  const provider = claims.firebase?.sign_in_provider;
  // Only the three ways the app offers — not, say, an anonymous Firebase user
  if (!["google.com", "apple.com", "phone"].includes(provider)) throw badRequest("That way of signing in isn't offered here.");
  const email = claims.email && claims.email_verified ? String(claims.email).trim().toLowerCase() : null;
  const phone = provider === "phone" && claims.phone_number ? String(claims.phone_number) : null;
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim().slice(0, 80) : null;
  let user = db.prepare("SELECT id FROM users WHERE firebase_uid = ?").get(uid)
    ?? (email ? db.prepare("SELECT id FROM users WHERE email = ?").get(email) : null)
    ?? (phone ? db.prepare("SELECT id FROM users WHERE phone = ?").get(phone) : null);
  if (user) {
    db.prepare("UPDATE users SET firebase_uid = COALESCE(firebase_uid, ?), display_name = COALESCE(display_name, ?) WHERE id = ?").run(uid, name, user.id);
  } else {
    if (!email && !phone) throw unauthorized("That sign-in didn't come with a verified email or phone number.");
    const result = db.prepare("INSERT INTO users (email, phone, firebase_uid, display_name, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(email, phone, uid, name, new Date().toISOString());
    user = { id: result.lastInsertRowid };
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

// Who's signed in, for the Account menu: email or phone, name, and whether
// the account has a password at all (Google, Apple and phone ones don't)
export function accountInfo(userId) {
  const u = db.prepare("SELECT email, phone, display_name, password_hash FROM users WHERE id = ?").get(userId);
  return u ? { email: u.email ?? null, phone: u.phone ?? null, name: u.display_name ?? null, hasPassword: !!u.password_hash } : null;
}

// Password reset. The emailed link carries a random token; only its hash is
// stored, it works once, for an hour, and asking again replaces the last one.
const tokenHash = token => createHash("sha256").update(String(token)).digest("hex");

// A token for this email's account, or null when there's no such account —
// the caller must answer the same either way
export function createPasswordReset(email) {
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(String(email ?? "").trim().toLowerCase());
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?").run(user.id, new Date().toISOString());
  db.prepare("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(tokenHash(token), user.id, new Date(Date.now() + RESET_TTL_MS).toISOString());
  return token;
}

// Sets the new password and signs the account out everywhere (whoever knew
// the old one), then opens a fresh session for the person who reset it
export function resetPassword(token, password) {
  if (!password || password.length < 8) throw badRequest("Password must be at least 8 characters");
  const row = db.prepare("SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?").get(tokenHash(token));
  if (!row || row.used_at || row.expires_at < new Date().toISOString()) {
    throw badRequest("This reset link has expired or was already used. Ask for a new one from the sign-in page.");
  }
  const { hash, salt } = hashPassword(password);
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").run(hash, salt, row.user_id);
    db.prepare("UPDATE password_resets SET used_at = ? WHERE token_hash = ?").run(new Date().toISOString(), tokenHash(token));
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return createSession(Number(row.user_id));
}

// Removes the account and everything saved with it — what the privacy page
// promises. Asks for the password again, so a session left signed in on a
// shared computer can't do it. Each table is cleared by name rather than
// relying on ON DELETE CASCADE, which does nothing if foreign keys are off.
// An account without a password (Google, Apple, phone) confirms by typing
// DELETE instead.
export function deleteAccount(userId, password, confirm) {
  const user = db.prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").get(userId);
  if (!user) throw notFound("No such account");
  if (user.password_hash ? !verifyPassword(String(password ?? ""), user.password_salt, user.password_hash) : String(confirm ?? "").trim() !== "DELETE") {
    throw badRequest(user.password_hash ? "That password isn't right" : "Type DELETE to confirm");
  }
  db.exec("BEGIN");
  try {
    for (const table of ["sessions", "alerts", "watchlist", "holdings", "thesis_notes", "stock_notes", "saved_strategies", "telegram_links", "password_resets"]) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
