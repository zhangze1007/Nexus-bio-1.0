import { type FallbackResult, fetchWithFallback } from "./fetchWithFallback";

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

export interface FullBiGGModel {
  modelId: string;
  reactions: BiGGReaction[];
  metabolites: string[];
  reactionCount: number;
  metaboliteCount: number;
}

const MOCK_ECOLI_MODEL: BiGGModel = {
  bigg_id: "e_coli_core",
  organism: "Escherichia coli str. K-12 substr. MG1655",
  reaction_count: 95,
  metabolite_count: 72,
  gene_count: 137,
};

export async function listBiGGModels(): Promise<FallbackResult<BiGGModel[]>> {
  return fetchWithFallback(
    async () => {
      const res = await fetch("/api/bigg?type=models", { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`BiGG returned ${res.status}`);
      const data = await res.json();
      return data.results ?? [];
    },
    [MOCK_ECOLI_MODEL],
    "BiGG",
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
    "BiGG",
  );
}

async function fetchReactionDetail(modelId: string, rxnId: string, signal?: AbortSignal): Promise<BiGGReaction | null> {
  try {
    const res = await fetch(`/api/bigg?type=rxn_detail&id=${modelId}&rxnId=${rxnId}`, {
      signal: signal ?? AbortSignal.timeout(15000),
    });
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
      subsystem: data.subsystem ?? "",
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
    const res = await fetch(`/api/bigg?type=metabolite&id=${modelId}`, {
      signal: signal ?? AbortSignal.timeout(15000),
    });
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

export async function getModelReactions(
  modelId: string,
): Promise<FallbackResult<{ reactions: BiGGReaction[]; metabolites: string[] }>> {
  return fetchWithFallback(
    async () => {
      const controller = new AbortController();
      const signal = controller.signal;

      const listRes = await fetch(`/api/bigg?type=reaction&id=${modelId}`, { signal: AbortSignal.timeout(15000) });
      if (!listRes.ok) throw new Error(`BiGG returned ${listRes.status}`);
      const listData = await listRes.json();
      const rxnList: Array<{ bigg_id: string; name: string }> = listData.results ?? [];

      if (rxnList.length === 0) throw new Error("No reactions in model");

      const tasks = rxnList.map((r) => () => fetchReactionDetail(modelId, r.bigg_id, signal));
      const detailResults = await runBatched(tasks, 10);

      const reactions: BiGGReaction[] = [];
      for (const detail of detailResults) {
        if (detail) reactions.push(detail);
      }

      if (reactions.length === 0) throw new Error("Failed to fetch any reaction details");

      return { reactions, metabolites: [] as string[] };
    },
    {
      reactions: [
        {
          id: "mock_glc__D_e",
          name: "D-Glucose exchange (demo)",
          subsystem: "Exchange",
          lb: -10,
          ub: 1000,
          stoichiometry: { glc__D_e: -1 },
        },
      ],
      metabolites: ["glc__D_e"],
    },
    "BiGG",
    { retries: 1, retryDelayMs: 2000 },
  );
}

/**
 * Fetch the FULL genome-scale model from BiGG (all reactions, all pages).
 *
 * For large models like iJO1366 (2583 reactions), this fetches all pages
 * of the reactions list (100 per page), then fetches stoichiometry details
 * for each reaction in batches of 10 concurrent requests.
 *
 * WARNING: For large models, this can take several minutes and ~2500 API calls.
 * Results are cached in-memory for the session.
 */
const fullModelCache = new Map<string, FullBiGGModel>();

export async function getFullModel(modelId: string): Promise<FallbackResult<FullBiGGModel>> {
  const cached = fullModelCache.get(modelId);
  if (cached) {
    return { data: cached, source: "live", apiName: "BiGG" };
  }

  return fetchWithFallback(
    async () => {
      // Step 1: Fetch all reaction IDs via paginated list
      const allReactionIds: Array<{ bigg_id: string; name: string }> = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const listRes = await fetch(`/api/bigg?type=rxn_page&id=${modelId}&page=${page}`, {
          signal: AbortSignal.timeout(30000),
        });
        if (!listRes.ok) throw new Error(`BiGG page ${page} returned ${listRes.status}`);
        const listData = await listRes.json();
        const results: Array<{ bigg_id: string; name: string }> = listData.results ?? [];
        allReactionIds.push(...results);

        // BiGG API returns `next` URL when more pages exist
        if (!listData.next || results.length < perPage) break;
        page++;
      }

      if (allReactionIds.length === 0) throw new Error("No reactions found in model");

      // Step 2: Fetch reaction details in batches
      const controller = new AbortController();
      const signal = controller.signal;
      const tasks = allReactionIds.map((r) => () => fetchReactionDetail(modelId, r.bigg_id, signal));
      const detailResults = await runBatched(tasks, 10);

      const reactions: BiGGReaction[] = [];
      for (const detail of detailResults) {
        if (detail) reactions.push(detail);
      }

      if (reactions.length === 0) throw new Error("Failed to fetch any reaction details");

      // Step 3: Extract all unique metabolite IDs
      const metSet = new Set<string>();
      for (const rxn of reactions) {
        for (const metId of Object.keys(rxn.stoichiometry)) {
          metSet.add(metId);
        }
      }
      const metabolites = Array.from(metSet).sort();

      const model: FullBiGGModel = {
        modelId,
        reactions,
        metabolites,
        reactionCount: reactions.length,
        metaboliteCount: metabolites.length,
      };

      fullModelCache.set(modelId, model);
      return model;
    },
    null as unknown as FullBiGGModel,
    "BiGG",
    { retries: 1, retryDelayMs: 5000 },
  );
}
