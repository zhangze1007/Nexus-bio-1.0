import type { CommunityFBAOutput, FBAOutput } from '../data/mockFBA';

export type FBAObjective = 'biomass' | 'atp' | 'product';

interface SingleAuthorityRequest {
  species?: 'ecoli' | 'yeast';
  objective: FBAObjective;
  glucoseUptake: number;
  oxygenUptake: number;
  knockouts?: string[];
}

interface CommunityAuthorityRequest {
  objective: FBAObjective;
  alpha?: number;
  ecoli: {
    glucoseUptake: number;
    oxygenUptake: number;
    knockouts?: string[];
  };
  yeast: {
    glucoseUptake: number;
    oxygenUptake: number;
    knockouts?: string[];
  };
}

async function requestAuthorityResult<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/fba', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    signal,
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? 'Authoritative FBA service failed');
  }

  return payload.result as T;
}

export function solveAuthorityFBA(request: SingleAuthorityRequest, signal?: AbortSignal) {
  return requestAuthorityResult<FBAOutput>(
    {
      mode: 'single',
      species: request.species ?? 'ecoli',
      objective: request.objective,
      glucoseUptake: request.glucoseUptake,
      oxygenUptake: request.oxygenUptake,
      knockouts: request.knockouts ?? [],
    },
    signal,
  );
}

export function solveAuthorityCommunityFBA(request: CommunityAuthorityRequest, signal?: AbortSignal) {
  return requestAuthorityResult<CommunityFBAOutput>(
    {
      mode: 'community',
      objective: request.objective,
      alpha: request.alpha ?? 0.5,
      ecoli: request.ecoli,
      yeast: request.yeast,
    },
    signal,
  );
}
