/**
 * MFA (TOTP) Service — Multi-Factor Authentication for Nexus-Bio
 *
 * Uses otplib v13 for TOTP generation/verification (RFC 6238).
 * MFA secrets are encrypted at rest with AES-256-GCM.
 * Backup codes are hashed with SHA-256 before storage.
 *
 * Compatible with Google Authenticator, Authy, Microsoft Authenticator, etc.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { generateSecret, generateURI, verifySync } from "otplib";

const ISSUER = "Nexus-Bio";
const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_LENGTH = 8;
const MFA_ENC_KEY_ENV = "MFA_ENCRYPTION_KEY";

// ─── helpers ──────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const hex = process.env[MFA_ENC_KEY_ENV];
  if (!hex) {
    throw new Error(`${MFA_ENC_KEY_ENV} environment variable is not set`);
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error(`${MFA_ENC_KEY_ENV} must be 32 bytes (64 hex chars)`);
  }
  return buf;
}

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// ─── public API ───────────────────────────────────────────────────────

/**
 * Generate a new TOTP secret for a user.
 *
 * Returns the plaintext secret (for the QR code URL), an otpauth:// URI,
 * and 8 one-time backup codes. The caller is responsible for encrypting
 * the secret and hashing the backup codes before persisting.
 */
export function generateMfaSecret(
  userId: string,
  email: string,
): {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
} {
  const secret = generateSecret({ length: 20 });

  const qrCodeUrl = generateURI({
    issuer: ISSUER,
    label: email || userId,
    secret,
  });

  const backupCodes = generateBackupCodes();

  return { secret, qrCodeUrl, backupCodes };
}

/**
 * Verify a 6-digit TOTP token against a (decrypted) secret.
 */
export function verifyToken(secret: string, token: string): boolean {
  try {
    const result = verifySync({ secret, token, epochTolerance: 1 });
    return result.valid === true;
  } catch {
    return false;
  }
}

/**
 * Generate `BACKUP_CODE_COUNT` random alphanumeric backup codes.
 * Each code is formatted as XXXX-XXXX for readability.
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const raw = randomBytes(BACKUP_CODE_LENGTH).toString("hex").slice(0, BACKUP_CODE_LENGTH).toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

/**
 * Verify a single backup code against stored SHA-256 hashes.
 *
 * Returns `{ valid, remaining }` where `remaining` is the list of hashes
 * with the consumed code removed (so the caller can update storage).
 */
export function verifyBackupCode(storedHashes: string[], code: string): { valid: boolean; remaining: string[] } {
  const normalized = code.trim().toUpperCase();
  const hash = sha256(normalized);

  const idx = storedHashes.indexOf(hash);
  if (idx === -1) {
    return { valid: false, remaining: storedHashes };
  }

  const remaining = [...storedHashes];
  remaining.splice(idx, 1);
  return { valid: true, remaining };
}

// ─── encryption helpers ───────────────────────────────────────────────

/**
 * Encrypt a plaintext MFA secret with AES-256-GCM.
 * Returns `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted MFA secret.
 * Expects format `iv:authTag:ciphertext` (all hex).
 */
export function decryptSecret(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertext] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted secret format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Hash an array of plaintext backup codes for storage.
 */
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map((c) => sha256(c.trim().toUpperCase()));
}
