import { generateApiKey, hashApiKey } from '../src/utils/apiKeys';

describe('API Keys', () => {
  it('should generate a key with nxb_ prefix', () => {
    const { key, hash, prefix } = generateApiKey();
    expect(key).toMatch(/^nxb_[A-Za-z0-9_-]{32}$/);
    expect(hash).toHaveLength(64); // SHA-256 hex
    expect(prefix).toMatch(/^nxb_[A-Za-z0-9_-]{7}$/);
  });

  it('should produce deterministic hashes', () => {
    const { key, hash } = generateApiKey();
    expect(hashApiKey(key)).toBe(hash);
  });

  it('should generate unique keys', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey().key));
    expect(keys.size).toBe(100);
  });
});
