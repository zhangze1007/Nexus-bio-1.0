export interface FallbackResult<T> {
  data: T;
  source: 'live' | 'mock';
  error?: string;
  apiName: string;
}

export interface FallbackOptions {
  retries?: number;
  retryDelayMs?: number;
}

/**
 * Try a live fetcher; on failure, fall back to mock data.
 * Supports optional retry logic for transient failures.
 * Logs a warning when falling back so users know they're seeing demo data.
 */
export async function fetchWithFallback<T>(
  fetcher: () => Promise<T>,
  mockData: T,
  label: string,
  options?: FallbackOptions,
): Promise<FallbackResult<T>> {
  const maxAttempts = (options?.retries ?? 0) + 1;
  const delay = options?.retryDelayMs ?? 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fetcher();
      return { data, source: 'live', apiName: label };
    } catch (e) {
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[${label}] API unavailable after ${maxAttempts} attempt(s), using mock: ${msg}`);
      return { data: mockData, source: 'mock', error: msg, apiName: label };
    }
  }

  // Unreachable but TypeScript needs it
  return { data: mockData, source: 'mock', error: 'unreachable', apiName: label };
}
