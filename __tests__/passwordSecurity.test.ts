import {
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
} from '../src/utils/passwordSecurity';

describe('validatePasswordStrength', () => {
  it('returns score 0 for empty password', () => {
    const result = validatePasswordStrength('');
    expect(result.valid).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback).toContain('Password cannot be empty');
  });

  it('gives low score for short simple password', () => {
    const result = validatePasswordStrength('abc');
    expect(result.valid).toBe(false);
    expect(result.score).toBeLessThan(50);
    expect(result.feedback).toContain('Use at least 8 characters');
  });

  it('gives medium score for 8-char mixed password', () => {
    const result = validatePasswordStrength('Abc123!x');
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.valid).toBe(true);
  });

  it('gives high score for 16+ char fully mixed password', () => {
    const result = validatePasswordStrength('MyStr0ng!P@ssw0rd#2024');
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('penalizes all-same-character password', () => {
    const result = validatePasswordStrength('aaaaaaaaaaaa');
    expect(result.score).toBeLessThan(50);
    expect(result.feedback).toContain('Avoid common patterns or dictionary words');
  });

  it('penalizes sequential numbers', () => {
    const result = validatePasswordStrength('123456789');
    expect(result.feedback).toContain('Avoid common patterns or dictionary words');
  });

  it('penalizes common dictionary words', () => {
    const result = validatePasswordStrength('password123');
    expect(result.valid).toBe(false);
    expect(result.feedback).toContain('Avoid common patterns or dictionary words');
  });

  it('penalizes repeated characters', () => {
    const result = validatePasswordStrength('Abc111!defghij');
    expect(result.feedback).toContain('Avoid repeating the same character 3+ times in a row');
  });

  it('gives feedback for missing character types', () => {
    const result = validatePasswordStrength('abcdefghijklmnop');
    expect(result.feedback).toContain('Add uppercase letters');
    expect(result.feedback).toContain('Add numbers');
    expect(result.feedback).toContain('Add special characters (!@#$%^&*...)');
  });

  it('rewards high unique character ratio', () => {
    const low = validatePasswordStrength('Abcdef1!');
    const high = validatePasswordStrength('A1b2C3d4E5f6G7!');
    // Both should be valid, high should score equal or better
    expect(high.score).toBeGreaterThanOrEqual(low.score);
  });
});

describe('hashPassword and verifyPassword', () => {
  it('hashes and verifies a correct password', async () => {
    const password = 'MyS3cureP@ss!';
    const hash = await hashPassword(password);
    expect(hash).toContain(':');
    const match = await verifyPassword(password, hash);
    expect(match).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('CorrectHorse');
    const match = await verifyPassword('WrongHorse', hash);
    expect(match).toBe(false);
  });

  it('returns false for malformed hash', async () => {
    const match = await verifyPassword('anything', 'badformat');
    expect(match).toBe(false);
  });

  it('produces different hashes for same password (random salt)', async () => {
    const password = 'SamePassword123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
    // Both should still verify
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });
});
