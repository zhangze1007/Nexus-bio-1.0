import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface BiGGModel {
  bigg_id: string;
  organism: string;
  reaction_count: number;
  metabolite_count: number;
  gene_count: number;
}

const MOCK_ECOLI_MODEL: BiGGModel = {
  bigg_id: 'e_coli_core',
  organism: 'Escherichia coli str. K-12 substr. MG1655',
  reaction_count: 95,
  metabolite_count: 72,
  gene_count: 137,
};

export async function listBiGGModels(): Promise<FallbackResult<BiGGModel[]>> {
  return fetchWithFallback(
    async () => {
      const res = await fetch('/api/bigg?type=models');
      if (!res.ok) throw new Error(`BiGG returned ${res.status}`);
      const data = await res.json();
      return data.results ?? [];
    },
    [MOCK_ECOLI_MODEL],
    'BiGG',
  );
}

export async function getBiGGModel(modelId: string): Promise<FallbackResult<BiGGModel>> {
  return fetchWithFallback(
    async () => {
      const res = await fetch(`/api/bigg?type=model&id=${modelId}`);
      if (!res.ok) throw new Error(`BiGG returned ${res.status}`);
      return res.json();
    },
    MOCK_ECOLI_MODEL,
    'BiGG',
  );
}
