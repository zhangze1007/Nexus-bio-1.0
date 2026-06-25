import { type FallbackResult, fetchWithFallback } from "./fetchWithFallback";

export interface DockingResult {
  protein: string;
  ligand: string;
  dockingScore: number; // kcal/mol (more negative = better binding)
  bindingEnergy: number;
  contactsFound: number;
  source: string;
}

export interface DockingOptions {
  uniprotId?: string;
  substrateSmiles?: string;
}

/**
 * Run molecular docking via the /api/docking proxy.
 *
 * The API now accepts either:
 *   - raw `proteinPdb` + `ligandSdf` 3D coordinate data, or
 *   - identifiers (`proteinPdbId` / `uniprotId` + `ligandSmiles`) and fetches structures server-side.
 *
 * Falls back to mock data if the service is unavailable.
 */
export async function runDocking(
  proteinPdbId: string,
  ligandSmiles: string,
  options?: DockingOptions,
): Promise<FallbackResult<DockingResult>> {
  return fetchWithFallback(
    async () => {
      const payload: Record<string, string> = {
        proteinPdbId,
        ligandSmiles,
      };

      // Pass uniprotId so the API can try AlphaFold before RCSB
      if (options?.uniprotId) {
        payload.uniprotId = options.uniprotId;
      }

      const res = await fetch("/api/docking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Docking returned ${res.status}`);
      const data = (await res.json()) as {
        ok: boolean;
        protein: string;
        ligand: string;
        dockingScore: number;
        bindingEnergy: number;
        contactsFound: number;
        source: string;
      };
      if (!data.ok) throw new Error("Docking request failed");
      return {
        protein: data.protein,
        ligand: data.ligand,
        dockingScore: data.dockingScore,
        bindingEnergy: data.bindingEnergy,
        contactsFound: data.contactsFound ?? 0,
        source: data.source,
      };
    },
    {
      protein: proteinPdbId,
      ligand: ligandSmiles,
      dockingScore: -5.0,
      bindingEnergy: -6.0,
      contactsFound: 0,
      source: "mock",
    },
    "Docking",
  );
}
