/**
 * MFA Service Tests
 *
 * Tests for TOTP secret generation, token verification, backup codes,
 * and encryption/decryption helpers.
 *
 * @jest-environment node
 */

// Set encryption key before importing the service (32 bytes = 64 hex chars)
process.env.MFA_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// Mock otplib to avoid ESM/CJS transform issues in Jest
jest.mock("otplib", () => {
  const crypto = require("node:crypto");

  // Base32 encode helper
  function base32Encode(buf: Buffer): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const b of buf) bits += b.toString(2).padStart(8, "0");
    let result = "";
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.slice(i, i + 5).padEnd(5, "0");
      result += alphabet[parseInt(chunk, 2)];
    }
    return result;
  }

  // Base32 decode helper
  function base32Decode(str: string): Buffer {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const c of str.toUpperCase()) {
      const val = alphabet.indexOf(c);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, "0");
    }
    const bytes = Buffer.alloc(Math.floor(bits.length / 8));
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    }
    return bytes;
  }

  // TOTP compute (RFC 6238)
  function computeTOTP(secret: string, time?: number): string {
    const key = base32Decode(secret);
    const epoch = Math.floor((time ?? Date.now()) / 1000 / 30);
    const timeBuf = Buffer.alloc(8);
    timeBuf.writeUInt32BE(Math.floor(epoch / 0x100000000), 0);
    timeBuf.writeUInt32BE(epoch & 0xffffffff, 4);
    const hmac = crypto.createHmac("sha1", key);
    hmac.update(timeBuf);
    const hash = hmac.digest();
    const offset = hash[hash.length - 1] & 0x0f;
    const code =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);
    return (code % 1000000).toString().padStart(6, "0");
  }

  return {
    generateSecret: ({ length = 20 }: { length?: number } = {}) => {
      return base32Encode(crypto.randomBytes(length));
    },
    generateURI: ({
      issuer,
      label,
      secret,
    }: {
      issuer: string;
      label: string;
      secret: string;
    }) => {
      return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    },
    verify: ({ secret, token }: { secret: string; token: string }) => {
      const expected = computeTOTP(secret);
      return { valid: token === expected, delta: 0 };
    },
    verifySync: ({ secret, token, epochTolerance }: { secret: string; token: string; epochTolerance?: number }) => {
      const expected = computeTOTP(secret);
      return { valid: token === expected, delta: 0 };
    },
  };
});

import {
  generateMfaSecret,
  generateBackupCodes,
  verifyToken,
  verifyBackupCode,
  encryptSecret,
  decryptSecret,
  hashBackupCodes,
} from "../src/services/auth/mfaService";

describe("generateMfaSecret", () => {
  it("returns a secret, QR code URL, and backup codes", () => {
    const result = generateMfaSecret("user-123", "researcher@example.com");

    expect(result.secret).toBeDefined();
    expect(typeof result.secret).toBe("string");
    expect(result.secret.length).toBeGreaterThanOrEqual(16);

    expect(result.qrCodeUrl).toBeDefined();
    expect(result.qrCodeUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(result.qrCodeUrl).toContain("Nexus-Bio");
    expect(result.qrCodeUrl).toContain("researcher%40example.com");

    expect(result.backupCodes).toBeDefined();
    expect(result.backupCodes).toHaveLength(8);
  });

  it("generates unique secrets on each call", () => {
    const a = generateMfaSecret("u1", "a@example.com");
    const b = generateMfaSecret("u2", "b@example.com");
    expect(a.secret).not.toBe(b.secret);
  });

  it("uses userId as label when email is empty", () => {
    const result = generateMfaSecret("user-42", "");
    expect(result.qrCodeUrl).toContain("user-42");
  });
});

describe("generateBackupCodes", () => {
  it("returns 8 codes", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
  });

  it("formats each code as XXXX-XXXX", () => {
    const codes = generateBackupCodes();
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    }
  });

  it("generates unique codes", () => {
    const codes = generateBackupCodes();
    const unique = new Set(codes);
    expect(unique.size).toBe(8);
  });
});

describe("verifyToken", () => {
  it("returns false for an invalid token", () => {
    const { secret } = generateMfaSecret("user-1", "test@example.com");
    expect(verifyToken(secret, "000000")).toBe(false);
  });

  it("returns false for garbage input", () => {
    const { secret } = generateMfaSecret("user-1", "test@example.com");
    expect(verifyToken(secret, "not-a-token")).toBe(false);
  });

  it("returns true for a valid token computed from the same secret", () => {
    const { secret } = generateMfaSecret("user-1", "test@example.com");
    // The mock verifySync compares against the standard TOTP algorithm
    // We need to compute the expected token the same way
    const { createHmac } = require("node:crypto");

    // Decode Base32
    const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const c of secret.toUpperCase()) {
      const val = base32Chars.indexOf(c);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, "0");
    }
    const keyBytes = Buffer.alloc(Math.floor(bits.length / 8));
    for (let i = 0; i < keyBytes.length; i++) {
      keyBytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    }

    // Compute TOTP for current time
    const epoch = Math.floor(Date.now() / 1000 / 30);
    const timeBuf = Buffer.alloc(8);
    timeBuf.writeUInt32BE(Math.floor(epoch / 0x100000000), 0);
    timeBuf.writeUInt32BE(epoch & 0xffffffff, 4);
    const hmac = createHmac("sha1", keyBytes);
    hmac.update(timeBuf);
    const hash = hmac.digest();
    const offset = hash[hash.length - 1] & 0x0f;
    const code =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);
    const token = (code % 1000000).toString().padStart(6, "0");

    expect(verifyToken(secret, token)).toBe(true);
  });
});

describe("verifyBackupCode", () => {
  const codes = ["ABCD-1234", "EFGH-5678", "IJKL-9012"];
  const hashes = hashBackupCodes(codes);

  it("accepts a valid backup code", () => {
    const result = verifyBackupCode(hashes, "ABCD-1234");
    expect(result.valid).toBe(true);
    expect(result.remaining).toHaveLength(2);
  });

  it("rejects an invalid backup code", () => {
    const result = verifyBackupCode(hashes, "XXXX-9999");
    expect(result.valid).toBe(false);
    expect(result.remaining).toHaveLength(3);
  });

  it("is case-insensitive", () => {
    const result = verifyBackupCode(hashes, "abcd-1234");
    expect(result.valid).toBe(true);
  });

  it("removes only the used code from remaining", () => {
    const result = verifyBackupCode(hashes, "EFGH-5678");
    expect(result.valid).toBe(true);
    expect(result.remaining).toHaveLength(2);
    const remainingSet = new Set(result.remaining);
    expect(remainingSet.size).toBe(2);
  });

  it("does not allow reuse of the same code", () => {
    const first = verifyBackupCode(hashes, "ABCD-1234");
    const second = verifyBackupCode(first.remaining, "ABCD-1234");
    expect(second.valid).toBe(false);
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a secret through encryption", () => {
    const plaintext = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(plaintext);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext on each encryption (random IV)", () => {
    const plaintext = "JBSWY3DPEHPK3PXP";
    const a = encryptSecret(plaintext);
    const b = encryptSecret(plaintext);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(plaintext);
    expect(decryptSecret(b)).toBe(plaintext);
  });

  it("throws on invalid encrypted format", () => {
    expect(() => decryptSecret("not-valid")).toThrow("Invalid encrypted secret format");
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptSecret("secret123");
    const parts = encrypted.split(":");
    parts[2] = "deadbeef" + parts[2].slice(8);
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });
});

describe("hashBackupCodes", () => {
  it("returns SHA-256 hex strings", () => {
    const hashes = hashBackupCodes(["ABCD-1234"]);
    expect(hashes).toHaveLength(1);
    expect(hashes[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalizes to uppercase before hashing", () => {
    const upper = hashBackupCodes(["ABCD-1234"]);
    const lower = hashBackupCodes(["abcd-1234"]);
    expect(upper[0]).toBe(lower[0]);
  });

  it("produces deterministic output", () => {
    const a = hashBackupCodes(["TEST-CODE"]);
    const b = hashBackupCodes(["TEST-CODE"]);
    expect(a[0]).toBe(b[0]);
  });
});
