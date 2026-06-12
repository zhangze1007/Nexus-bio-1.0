import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface KEGGPathwayResult {
  id: string;
  name: string;
  reactions: string[];
  compounds: string[];
}

export interface KEGGCompoundResult {
  id: string;
  name: string;
  formula: string;
  molWeight: number;
}

const MOCK_PATHWAYS: Record<string, KEGGPathwayResult> = {
  glycolysis: {
    id: 'map00010',
    name: 'Glycolysis / Gluconeogenesis',
    reactions: ['R00200', 'R00658', 'R01015', 'R01061'],
    compounds: ['C00022', 'C00024', 'C00033', 'C00074'],
  },
  tca: {
    id: 'map00020',
    name: 'Citrate cycle (TCA cycle)',
    reactions: ['R00351', 'R00709', 'R01325', 'R01900'],
    compounds: ['C00024', 'C00036', 'C00042', 'C00122'],
  },
  mevalonate: {
    id: 'map00900',
    name: 'Terpenoid backbone biosynthesis',
    reactions: ['R02872', 'R02873', 'R02874', 'R05688'],
    compounds: ['C00083', 'C00129', 'C00235', 'C00448'],
  },
};

export async function searchKEGGPathway(
  query: string,
): Promise<FallbackResult<KEGGPathwayResult>> {
  const mockKey = query.toLowerCase();
  const mockData = MOCK_PATHWAYS[mockKey] ?? MOCK_PATHWAYS.glycolysis;

  return fetchWithFallback(
    async () => {
      const res = await fetch(`/api/kegg?pathway=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`KEGG returned ${res.status}`);
      const data = await res.json();
      return {
        id: data.id ?? query,
        name: data.name ?? query,
        reactions: data.reactions ?? [],
        compounds: data.compounds ?? [],
      };
    },
    mockData,
    'KEGG',
  );
}

export async function getKEGGCompound(
  compoundId: string,
): Promise<FallbackResult<KEGGCompoundResult>> {
  const mockData: KEGGCompoundResult = {
    id: compoundId,
    name: 'Unknown compound',
    formula: '',
    molWeight: 0,
  };

  return fetchWithFallback(
    async () => {
      const res = await fetch(`/api/kegg?compound=${compoundId}`);
      if (!res.ok) throw new Error(`KEGG returned ${res.status}`);
      const data = await res.json();
      return {
        id: data.id ?? compoundId,
        name: data.name ?? 'Unknown',
        formula: data.formula ?? '',
        molWeight: data.molWeight ?? 0,
      };
    },
    mockData,
    'KEGG',
  );
}
