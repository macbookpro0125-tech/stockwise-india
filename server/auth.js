// scrypt (built into node:crypto) instead of adding bcrypt/argon2 as a
// dependency — it's a standard, memory-hard KDF, not a homegrown scheme.
import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHash } from "node:crypto";
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
  // Anything but text (a number, null, an object) is refused as such, not
  // left to crash the hash and come back as a server error
  email = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) throw badRequest("Valid email required");
  if (typeof password !== "string" || password.length < 8) throw badRequest("Password must be at least 8 characters");

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) throw conflict("An account with this email already exists");

  const { hash, salt } = hashPassword(password);
  const result = db.prepare(
    "INSERT INTO users (email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)"
  ).run(email, hash, salt, new Date().toISOString());

  return createSession(Number(result.lastInsertRowid));
}

// Sign-up with a code (when email can be sent): the email and password are
// held, a 6-digit code goes to the email, and the account is made only when
// that code comes back — so nobody can open an account on someone else's
// address. A code lasts 15 minutes, five wrong tries end the attempt, and a
// new code (or a new sign-up) replaces the last.
const CODE_TTL_MS = 15 * 60_000, CODE_TRIES = 5;
const codeHash = (email, code) => createHash("sha256").update(`${email}:${code}`).digest("hex");
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const cleanEmail = email => (typeof email === "string" ? email.trim().toLowerCase() : "");

// Returns the code to email
export function startSignup(email, password) {
  email = cleanEmail(email);
  if (!email || !email.includes("@")) throw badRequest("Valid email required");
  if (typeof password !== "string" || password.length < 8) throw badRequest("Password must be at least 8 characters");
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) throw conflict("An account with this email already exists");
  const { hash, salt } = hashPassword(password);
  const code = newCode(), now = Date.now();
  db.prepare("DELETE FROM pending_signups WHERE expires_at < ?").run(new Date(now).toISOString());
  db.prepare(`INSERT INTO pending_signups (email, password_hash, password_salt, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, password_salt = excluded.password_salt, code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, created_at = excluded.created_at`)
    .run(email, hash, salt, codeHash(email, code), new Date(now + CODE_TTL_MS).toISOString(), new Date(now).toISOString());
  return code;
}

// A new code for a sign-up still waiting; null when there's none (the caller
// answers the same either way)
export function resendSignupCode(email) {
  email = cleanEmail(email);
  const row = db.prepare("SELECT email FROM pending_signups WHERE email = ?").get(email);
  if (!row) return null;
  const code = newCode();
  db.prepare("UPDATE pending_signups SET code_hash = ?, expires_at = ?, attempts = 0 WHERE email = ?")
    .run(codeHash(email, code), new Date(Date.now() + CODE_TTL_MS).toISOString(), email);
  return code;
}

export function finishSignup(email, code) {
  email = cleanEmail(email);
  code = String(code ?? "").replace(/\s/g, "");
  const row = db.prepare("SELECT * FROM pending_signups WHERE email = ?").get(email);
  if (!row) throw badRequest("That code isn't right, or has already been used. Start again if you need a new one.");
  if (row.expires_at < new Date().toISOString()) throw badRequest("That code has expired. Ask for a new one.");
  const given = Buffer.from(codeHash(email, code), "hex"), expected = Buffer.from(row.code_hash, "hex");
  if (!timingSafeEqual(given, expected)) {
    if (row.attempts + 1 >= CODE_TRIES) {
      db.prepare("DELETE FROM pending_signups WHERE email = ?").run(email);
      throw badRequest("Too many wrong codes. Please sign up again for a new one.");
    }
    db.prepare("UPDATE pending_signups SET attempts = attempts + 1 WHERE email = ?").run(email);
    throw badRequest("That code isn't right. Check the email and try again.");
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    db.prepare("DELETE FROM pending_signups WHERE email = ?").run(email);
    throw conflict("An account with this email already exists");
  }
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    const result = db.prepare("INSERT INTO users (email, password_hash, password_salt, created_at, email_verified_at) VALUES (?, ?, ?, ?, ?)")
      .run(email, row.password_hash, row.password_salt, now, now);
    db.prepare("DELETE FROM pending_signups WHERE email = ?").run(email);
    db.exec("COMMIT");
    return createSession(Number(result.lastInsertRowid));
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
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
//
// Anyone can type any email at sign-up, so a password account's email is
// unproven until a verified sign-in with it. That sign-in takes the account
// over, as Firebase itself does: the unproven password is removed and its
// sessions end — else someone who signed up with your Gmail first would keep
// a way into the account you then use.
export function signInWithFirebase(claims) {
  const uid = claims.sub;
  const provider = claims.firebase?.sign_in_provider;
  // Only the three ways the app offers — not, say, an anonymous Firebase user
  if (!["google.com", "apple.com", "phone"].includes(provider)) throw badRequest("That way of signing in isn't offered here.");
  const email = claims.email && claims.email_verified ? String(claims.email).trim().toLowerCase() : null;
  const phone = provider === "phone" && claims.phone_number ? String(claims.phone_number) : null;
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim().slice(0, 80) : null;
  const now = new Date().toISOString();
  let user = db.prepare("SELECT id FROM users WHERE firebase_uid = ?").get(uid);
  if (!user && email) {
    const owner = db.prepare("SELECT id, password_hash, email_verified_at FROM users WHERE email = ?").get(email);
    if (owner) {
      if (owner.password_hash && !owner.email_verified_at) {
        db.prepare("UPDATE users SET password_hash = NULL, password_salt = NULL WHERE id = ?").run(owner.id);
        db.prepare("DELETE FROM sessions WHERE user_id = ?").run(owner.id);
      }
      db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?").run(now, owner.id);
      user = owner;
    }
  }
  user ??= phone ? db.prepare("SELECT id FROM users WHERE phone = ?").get(phone) : null;
  if (user) {
    db.prepare("UPDATE users SET firebase_uid = COALESCE(firebase_uid, ?), display_name = COALESCE(display_name, ?) WHERE id = ?").run(uid, name, user.id);
  } else {
    if (!email && !phone) throw unauthorized("That sign-in didn't come with a verified email or phone number.");
    const result = db.prepare("INSERT INTO users (email, phone, firebase_uid, display_name, created_at, email_verified_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(email, phone, uid, name, now, email ? now : null);
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
  if (typeof password !== "string" || password.length < 8) throw badRequest("Password must be at least 8 characters");
  const row = db.prepare("SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?").get(tokenHash(token));
  if (!row || row.used_at || row.expires_at < new Date().toISOString()) {
    throw badRequest("This reset link has expired or was already used. Ask for a new one from the sign-in page.");
  }
  const { hash, salt } = hashPassword(password);
  db.exec("BEGIN");
  try {
    // the link reached the inbox, so the email is the owner's
    db.prepare("UPDATE users SET password_hash = ?, password_salt = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?").run(hash, salt, new Date().toISOString(), row.user_id);
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
