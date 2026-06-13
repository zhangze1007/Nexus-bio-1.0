import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface BiGGModel {
  bigg_id: string;
  organism: string;
  reaction_count: number;
  metabolite_count: number;
  gene_count: number;
}

export interface BiGGReaction {
  id: string;
  name: string;
  subsystem: string;
  lb: number;
  ub: number;
  stoichiometry: Record<string, number>;
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
      const res = await fetch('/api/bigg?type=models', { signal: AbortSignal.timeout(10000) });
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
      const res = await fetch(`/api/bigg?type=model&id=${modelId}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`BiGG returned ${res.status}`);
      return res.json();
    },
    MOCK_ECOLI_MODEL,
    'BiGG',
  );
}

async function fetchReactionDetail(modelId: string, rxnId: string, signal?: AbortSignal): Promise<BiGGReaction | null> {
  try {
    const res = await fetch(
      `/api/bigg?type=rxn_detail&id=${modelId}&rxnId=${rxnId}`,
      { signal: signal ?? AbortSignal.timeout(15000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const stoichiometry: Record<string, number> = {};
    if (Array.isArray(data.metabolites)) {
      for (const met of data.metabolites) {
        stoichiometry[met.bigg_id] = met.stoichiometry_coefficient;
      }
    }
    return {
      id: data.bigg_id ?? rxnId,
      name: data.name ?? rxnId,
      subsystem: data.subsystem ?? '',
      lb: data.lower_bound ?? 0,
      ub: data.upper_bound ?? 1000,
      stoichiometry,
    };
  } catch {
    return null;
  }
}

async function fetchModelMetabolites(modelId: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetch(
      `/api/bigg?type=metabolite&id=${modelId}`,
      { signal: signal ?? AbortSignal.timeout(15000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((m: { bigg_id: string }) => m.bigg_id);
  } catch {
    return [];
  }
}

function runBatched<T>(tasks: (() => Promise<T>)[], batchSize: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  async function runNext(): Promise<void> {
    while (idx < tasks.length) {
      const current = idx++;
      results[current] = await tasks[current]();
    }
  }
  const workers = Array.from({ length: Math.min(batchSize, tasks.length) }, () => runNext());
  return Promise.all(workers).then(() => results);
}

export async function getModelReactions(modelId: string): Promise<FallbackResult<{ reactions: BiGGReaction[]; metabolites: string[] }>> {
  return fetchWithFallback(
    async () => {
      const controller = new AbortController();
      const signal = controller.signal;

      const listRes = await fetch(
        `/api/bigg?type=reaction&id=${modelId}`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (!listRes.ok) throw new Error(`BiGG returned ${listRes.status}`);
      const listData = await listRes.json();
      const rxnList: Array<{ bigg_id: string; name: string }> = listData.results ?? [];

      if (rxnList.length === 0) throw new Error('No reactions in model');

      const tasks = rxnList.map((r) => () => fetchReactionDetail(modelId, r.bigg_id, signal));
      const detailResults = await runBatched(tasks, 10);

      const reactions: BiGGReaction[] = [];
      for (const detail of detailResults) {
        if (detail) reactions.push(detail);
      }

      if (reactions.length === 0) throw new Error('Failed to fetch any reaction details');

      const metabolites = await fetchModelMetabolites(modelId, signal);

      return { reactions, metabolites };
    },
    {
      reactions: [{
        id: 'mock_glc__D_e',
        name: 'D-Glucose exchange (demo)',
        subsystem: 'Exchange',
        lb: -10,
        ub: 1000,
        stoichiometry: { glc__D_e: -1 },
      }],
      metabolites: ['glc__D_e'],
    },
    'BiGG',
    { retries: 1, retryDelayMs: 2000 },
  );
}
