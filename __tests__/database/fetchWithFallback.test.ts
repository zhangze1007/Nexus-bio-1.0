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
});
