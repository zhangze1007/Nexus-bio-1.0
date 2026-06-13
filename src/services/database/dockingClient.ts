import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface DockingResult {
  protein: string;
  ligand: string;
  dockingScore: number; // kcal/mol (more negative = better binding)
  bindingEnergy: number;
  source: string;
}

/**
 * Run molecular docking via the /api/docking proxy.
 * Falls back to mock data if the service is unavailable.
 */
export async function runDocking(
  proteinPdbId: string,
  ligandSmiles: string,
): Promise<FallbackResult<DockingResult>> {
  return fetchWithFallback(
    async () => {
      const res = await fetch('/api/docking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proteinPdbId, ligandSmiles }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Docking returned ${res.status}`);
      const data = (await res.json()) as {
        ok: boolean;
        protein: string;
        ligand: string;
        dockingScore: number;
        bindingEnergy: number;
        source: string;
      };
      if (!data.ok) throw new Error('Docking request failed');
      return {
        protein: data.protein,
        ligand: data.ligand,
        dockingScore: data.dockingScore,
        bindingEnergy: data.bindingEnergy,
        source: data.source,
      };
    },
    {
      protein: proteinPdbId,
      ligand: ligandSmiles,
      dockingScore: -5.0,
      bindingEnergy: -6.0,
      source: 'mock',
    },
    'Docking',
  );
}
