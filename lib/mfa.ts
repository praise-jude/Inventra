import "server-only";
import crypto from "node:crypto";

// Excludes visually ambiguous characters (0/O, 1/I/L) — these are read off
// a screen or printout and re-typed by hand.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomCodeSegment(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

// e.g. "HDT4-9XPA" — ~40 bits of entropy per code, combined with per-user
// rate limiting on verification (see verifyRecoveryCode in
// lib/actions/mfa.ts) rather than relying on entropy alone.
export function generateRecoveryCode(): string {
  return `${randomCodeSegment(4)}-${randomCodeSegment(4)}`;
}

export function generateRecoveryCodes(count: number): string[] {
  return Array.from({ length: count }, () => generateRecoveryCode());
}

// scrypt rather than a fast hash (sha256) — these are stored long-term and
// worth the extra cost, same reasoning as bcrypt for passwords, using
// Node's built-in crypto instead of adding a new dependency.
const SCRYPT_KEYLEN = 64;

export function hashRecoveryCode(code: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(code.toUpperCase(), salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyRecoveryCodeHash(code: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(code.toUpperCase(), salt, SCRYPT_KEYLEN);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
