export interface FallbackResult<T> {
  data: T;
  source: 'live' | 'mock';
  error?: string;
}

/**
 * Try a live fetcher; on failure, fall back to mock data.
 * Logs a warning when falling back so users know they're seeing demo data.
 */
export async function fetchWithFallback<T>(
  fetcher: () => Promise<T>,
  mockData: T,
  label: string,
): Promise<FallbackResult<T>> {
  try {
    const data = await fetcher();
    return { data, source: 'live' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[${label}] API unavailable, using mock data: ${msg}`);
    return { data: mockData, source: 'mock', error: msg };
  }
}
