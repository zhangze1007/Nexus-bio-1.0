/**
 * BiGG Models API loader for genome-scale metabolic models.
 * Fetches reactions, metabolites, and stoichiometry from bigg.ucsd.edu.
 */

export interface BiGGReaction {
  id: string;
  name: string;
  stoichiometry: Record<string, number>;
  lowerBound: number;
  upperBound: number;
  subsystem?: string;
  geneReactionRule?: string;
}

export interface BiGGModel {
  id: string;
  name: string;
  reactions: BiGGReaction[];
  metabolites: string[];
  geneCount: number;
}

interface BiGGApiResponse {
  reactions_count: number;
  metabolites_count: number;
  genes_count: number;
}

interface BiGGReactionResponse {
  bigg_id: string;
  name: string;
  metabolites: Array<{ bigg_id: string; stoichiometry: number; compartment_bigg_id: string }>;
  lower_bound: number;
  upper_bound: number;
  subsystem?: string;
  gene_reaction_rule?: string;
}

const BIGG_BASE = 'https://bigg.ucsd.edu/api/v3';

const modelCache = new Map<string, BiGGModel>();
const reactionCache = new Map<string, BiGGReaction>();

/**
 * Load model metadata from BiGG.
 */
export async function getModelInfo(modelId: string): Promise<BiGGApiResponse> {
  const resp = await fetch(`${BIGG_BASE}/models/${modelId}`);
  if (!resp.ok) throw new Error(`BiGG API error: ${resp.status}`);
  return resp.json();
}

/**
 * Load a single reaction from BiGG.
 */
export async function loadReaction(modelId: string, reactionId: string): Promise<BiGGReaction> {
  const cacheKey = `${modelId}:${reactionId}`;
  if (reactionCache.has(cacheKey)) return reactionCache.get(cacheKey)!;

  const resp = await fetch(`${BIGG_BASE}/models/${modelId}/reactions/${reactionId}`);
  if (!resp.ok) throw new Error(`BiGG reaction not found: ${reactionId}`);

  const data: BiGGReactionResponse = await resp.json();

  const stoichiometry: Record<string, number> = {};
  for (const met of data.metabolites) {
    const key = `${met.bigg_id}_${met.compartment_bigg_id}`;
    stoichiometry[key] = met.stoichiometry;
  }

  const reaction: BiGGReaction = {
    id: data.bigg_id,
    name: data.name,
    stoichiometry,
    lowerBound: data.lower_bound,
    upperBound: data.upper_bound,
    subsystem: data.subsystem,
    geneReactionRule: data.gene_reaction_rule,
  };

  reactionCache.set(cacheKey, reaction);
  return reaction;
}

/**
 * Load all reactions for a model from BiGG (paginated).
 * This is a heavy operation — use with caution.
 */
export async function loadModel(modelId: string): Promise<BiGGModel> {
  if (modelCache.has(modelId)) return modelCache.get(modelId)!;

  const reactions: BiGGReaction[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const resp = await fetch(`${BIGG_BASE}/models/${modelId}/reactions?page=${page}&page_size=100`);
    if (!resp.ok) throw new Error(`BiGG model load error: ${resp.status}`);

    const data = await resp.json();
    const results = data.results || [];

    for (const r of results) {
      const stoichiometry: Record<string, number> = {};
      for (const met of (r.metabolites || [])) {
        const key = `${met.bigg_id}_${met.compartment_bigg_id}`;
        stoichiometry[key] = met.stoichiometry;
      }
      reactions.push({
        id: r.bigg_id,
        name: r.name || r.bigg_id,
        stoichiometry,
        lowerBound: r.lower_bound ?? 0,
        upperBound: r.upper_bound ?? 1000,
        subsystem: r.subsystem,
        geneReactionRule: r.gene_reaction_rule,
      });
    }

    hasMore = results.length === 100;
    page++;
  }

  const metabolites = new Set<string>();
  for (const r of reactions) {
    for (const m of Object.keys(r.stoichiometry)) {
      metabolites.add(m);
    }
  }

  const model: BiGGModel = {
    id: modelId,
    name: modelId,
    reactions,
    metabolites: [...metabolites],
    geneCount: 0, // would need separate API call
  };

  modelCache.set(modelId, model);
  return model;
}

/**
 * Convert a BiGG model to the format expected by fbaEngine.
 */
export function biggToFBAFormat(model: BiGGModel): {
  reactions: Array<{ id: string; stoichiometry: Record<string, number>; lowerBound: number; upperBound: number }>;
  metabolites: string[];
} {
  return {
    reactions: model.reactions.map(r => ({
      id: r.id,
      stoichiometry: r.stoichiometry,
      lowerBound: r.lowerBound,
      upperBound: r.upperBound,
    })),
    metabolites: model.metabolites,
  };
}

export function clearCache(): void {
  modelCache.clear();
  reactionCache.clear();
}
