import { createHash, randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

/**
 * Generate a URL-safe random string of the given length using crypto.randomBytes.
 * This avoids the ESM-only nanoid dependency issue with Jest/ts-jest.
 */
function randomString(length: number): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

/**
 * Generate a new API key with nxb_ prefix.
 *
 * Returns:
 *   - key:   the raw key (shown to user ONCE at creation)
 *   - hash:  SHA-256 hex digest for storage
 *   - prefix: first 11 chars for display (nxb_ + 7 random chars)
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = randomString(32);
  const key = `nxb_${randomPart}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 11); // nxb_ + 7 chars
  return { key, hash, prefix };
}

/**
 * Hash an API key with SHA-256. Deterministic — same input always produces same output.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
