import { fetchWithFallback } from '../../src/services/database/fetchWithFallback';

describe('fetchWithFallback', () => {
  it('returns live data when fetcher succeeds', async () => {
    const result = await fetchWithFallback(
      async () => ({ value: 42 }),
      { value: 0 },
      'test'
    );
    expect(result.data).toEqual({ value: 42 });
    expect(result.source).toBe('live');
    expect(result.error).toBeUndefined();
  });

  it('returns mock data when fetcher fails', async () => {
    const result = await fetchWithFallback(
      async () => { throw new Error('network error'); },
      { value: 0 },
      'test'
    );
    expect(result.data).toEqual({ value: 0 });
    expect(result.source).toBe('mock');
    expect(result.error).toContain('network error');
  });

  it('returns live data even if it equals mock data', async () => {
    const result = await fetchWithFallback(
      async () => ({ value: 0 }),
      { value: 0 },
      'test'
    );
    expect(result.source).toBe('live');
  });

  it('retries on transient failure then succeeds', async () => {
    let attempts = 0;
    const result = await fetchWithFallback(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error('transient');
        return { value: 42 };
      },
      { value: 0 },
      'retry-test',
      { retries: 2, retryDelayMs: 10 }
    );
    expect(result.data).toEqual({ value: 42 });
    expect(result.source).toBe('live');
    expect(attempts).toBe(2);
  });

  it('falls back to mock after exhausting all retries', async () => {
    let attempts = 0;
    const result = await fetchWithFallback(
      async () => {
        attempts++;
        throw new Error('persistent failure');
      },
      { value: 0 },
      'retry-exhaust',
      { retries: 2, retryDelayMs: 10 }
    );
    expect(result.data).toEqual({ value: 0 });
    expect(result.source).toBe('mock');
    expect(result.error).toContain('persistent failure');
    expect(attempts).toBe(3); // 1 initial + 2 retries
  });
});
