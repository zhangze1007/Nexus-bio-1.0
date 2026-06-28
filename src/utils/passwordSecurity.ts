import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const COMMON_PATTERNS = [
  /^(.)\1+$/, // all same character
  /^(012|123|234|345|456|567|678|789|890)+$/, // sequential numbers
  /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i, // sequential letters
  /^(qwerty|password|letmein|admin|welcome|monkey|dragon|master|login|princess|football|shadow|sunshine|trustno1|iloveyou)/i,
  /^(123456|12345678|1234|111111|1234567|123456789|1234567890|000000|123123|654321|666666|123321|7777777|121212)$/,
];

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export interface PasswordValidation {
  valid: boolean;
  score: number;
  feedback: string[];
}

/**
 * Validates password strength and returns a score 0-100 with feedback.
 */
export function validatePasswordStrength(password: string): PasswordValidation {
  const feedback: string[] = [];
  let score = 0;

  if (!password || password.length === 0) {
    return { valid: false, score: 0, feedback: ["Password cannot be empty"] };
  }

  // Length scoring (up to 30 points)
  if (password.length >= 8) score += 10;
  else feedback.push("Use at least 8 characters");

  if (password.length >= 12) score += 10;
  else if (password.length >= 8) feedback.push("12+ characters recommended");

  if (password.length >= 16) score += 10;
  else if (password.length >= 12) feedback.push("16+ characters for strong security");

  // Character variety (up to 40 points)
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = SPECIAL_CHARS.test(password);

  if (hasLower) score += 10;
  else feedback.push("Add lowercase letters");

  if (hasUpper) score += 10;
  else feedback.push("Add uppercase letters");

  if (hasDigit) score += 10;
  else feedback.push("Add numbers");

  if (hasSpecial) score += 10;
  else feedback.push("Add special characters (!@#$%^&*...)");

  // Entropy bonus: unique character ratio (up to 15 points)
  const uniqueChars = new Set(password).size;
  const uniqueRatio = uniqueChars / password.length;
  if (uniqueRatio >= 0.8) score += 15;
  else if (uniqueRatio >= 0.6) score += 10;
  else if (uniqueRatio >= 0.4) score += 5;
  else feedback.push("Avoid repeating characters");

  // Common pattern penalty (up to -25 points)
  for (const pattern of COMMON_PATTERNS) {
    if (pattern.test(password)) {
      score -= 25;
      feedback.push("Avoid common patterns or dictionary words");
      break;
    }
  }

  // Sequential character penalty
  let sequentialCount = 0;
  for (let i = 1; i < password.length; i++) {
    if (password.charCodeAt(i) === password.charCodeAt(i - 1) + 1) {
      sequentialCount++;
    }
  }
  if (sequentialCount >= 4) {
    score -= 10;
    feedback.push("Avoid sequential characters (abcd, 1234)");
  }

  // Repeated character penalty
  let maxRepeat = 1;
  let currentRepeat = 1;
  for (let i = 1; i < password.length; i++) {
    if (password[i] === password[i - 1]) {
      currentRepeat++;
      maxRepeat = Math.max(maxRepeat, currentRepeat);
    } else {
      currentRepeat = 1;
    }
  }
  if (maxRepeat >= 3) {
    score -= 10;
    feedback.push("Avoid repeating the same character 3+ times in a row");
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Minimum threshold for validity
  const valid = score >= 50 && password.length >= 8;

  if (valid && feedback.length === 0) {
    feedback.push("Strong password");
  }

  return { valid, score, feedback };
}

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 32;

/**
 * Hashes a password using scrypt with a random salt.
 * Returns salt:hash in hex format.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a password against a scrypt hash (salt:hash format).
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedHash] = hash.split(":");
  if (!salt || !storedHash) {
    return false;
  }
  const derivedKey = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  const storedKey = Buffer.from(storedHash, "hex");
  if (derivedKey.length !== storedKey.length) {
    return false;
  }
  return timingSafeEqual(derivedKey, storedKey);
}
