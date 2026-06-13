import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface UniProtEntry {
  accession: string;
  geneName: string;
  organism: string;
  sequence: string;
  length: number;
  function: string;
}

const MOCK_ENTRIES: Record<string, UniProtEntry> = {
  P00044: {
    accession: 'P00044', geneName: 'cytC', organism: 'Homo sapiens',
    sequence: 'MGDVEKGKKIFVQKCAQCHTVEKGGKHKTGPNLHGLFGRKTGQAPGFTYTDANKNKGITWKEETLMEYLENPKKYIPGTKMIFAGIKKKTEREDLIAYLKKATNE',
    length: 105, function: 'Electron carrier protein',
  },
};

export async function searchUniProt(query: string): Promise<FallbackResult<UniProtEntry>> {
  const mockData = MOCK_ENTRIES[query.toUpperCase()] ?? {
    accession: query, geneName: query, organism: 'Unknown',
    sequence: '', length: 0, function: 'No data available',
  };

  return fetchWithFallback(
    async () => {
      const res = await fetch(`/api/uniprot?type=search&id=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`UniProt returned ${res.status}`);
      return res.json();
    },
    mockData,
    'UniProt',
  );
}
