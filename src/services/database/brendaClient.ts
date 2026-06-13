import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface BRENDAKinetics {
  ecNumber: string;
  enzymeName: string;
  km: { value: number; unit: string; substrate: string }[];
  kcat: { value: number; unit: string; substrate: string }[];
}

const MOCK_KINETICS: Record<string, BRENDAKinetics> = {
  '2.7.1.1': {
    ecNumber: '2.7.1.1',
    enzymeName: 'Hexokinase',
    km: [{ value: 0.1, unit: 'mM', substrate: 'D-glucose' }],
    kcat: [{ value: 200, unit: '1/s', substrate: 'D-glucose' }],
  },
  '2.7.1.11': {
    ecNumber: '2.7.1.11',
    enzymeName: 'Phosphofructokinase',
    km: [{ value: 0.1, unit: 'mM', substrate: 'D-fructose 6-phosphate' }],
    kcat: [{ value: 150, unit: '1/s', substrate: 'F6P' }],
  },
};

export async function getBRENDAKinetics(ecNumber: string): Promise<FallbackResult<BRENDAKinetics>> {
  const mockData = MOCK_KINETICS[ecNumber] ?? {
    ecNumber, enzymeName: 'Unknown enzyme', km: [], kcat: [],
  };

  return fetchWithFallback(
    async () => {
      const res = await fetch(`/api/brenda?type=kinetics&id=${ecNumber}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`BRENDA returned ${res.status}`);
      return res.json();
    },
    mockData,
    'BRENDA',
  );
}
