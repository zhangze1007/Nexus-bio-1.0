import { type FallbackResult, fetchWithFallback } from "./fetchWithFallback";

/**
 * Rhea API client for enzyme-catalyzed reaction lookups.
 *
 * Rhea is a comprehensive, expert-curated database of biochemical reactions
 * built on the ChEBI (Chemical Entities of Biological Interest) ontology.
 * It provides high-quality, enzyme-specific reaction data including EC numbers,
 * reaction directionality, and substrate/product ChEBI IDs.
 *
 * Reference: Bansal et al. (2022) Nucleic Acids Res 50:D693-D700
 * API docs: https://www.rhea-db.org/help/programmatic-access
 */

const RHEA_API = "https://www.rhea-db.org/rest";

export interface RheaReaction {
  rheaId: string;
  name: string;
  /** EC number(s) associated with this reaction */
  ecNumbers: string[];
  /** Substrate ChEBI IDs */
  substrateChebiIds: string[];
  /** Product ChEBI IDs */
  productChebiIds: string[];
  /** Reaction direction: "UN" (undirected), "LR" (left-to-right), "RL" (right-to-left), "BI" (bidirectional) */
  direction: string;
  /** Whether the reaction is transport */
  isTransport: boolean;
}

export interface RheaSearchResult {
  id: string;
  name: string;
  ecNumbers: string[];
}

/**
 * Search Rhea for reactions matching a query string.
 *
 * @param query - Search term (e.g. "mevalonate kinase", "2.7.1.36")
 * @returns Array of matching Rhea reactions (summary level)
 */
export async function searchRhea(query: string): Promise<RheaSearchResult[]> {
  try {
    const res = await fetch(`${RHEA_API}/rhea/search?query=${encodeURIComponent(query)}&format=json`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results) return [];
    return data.results.map((r: Record<string, unknown>) => ({
      id: r.id ?? r.rheaId ?? "",
      name: r.name ?? "",
      ecNumbers: r.ecNumbers ?? [],
    }));
  } catch {
    return [];
  }
}

/**
 * Get full details for a specific Rhea reaction by ID.
 *
 * @param rheaId - Rhea ID (e.g. "RHEA:12345" or just "12345")
 * @returns Full reaction details, or null if not found
 */
export async function getRheaReaction(rheaId: string): Promise<RheaReaction | null> {
  try {
    // Normalize: accept both "RHEA:12345" and "12345"
    const normalizedId = rheaId.replace(/^RHEA:/i, "");
    const res = await fetch(`${RHEA_API}/rhea/${encodeURIComponent(normalizedId)}?format=json`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      rheaId: data.id ?? `RHEA:${normalizedId}`,
      name: data.name ?? "",
      ecNumbers: data.ecNumbers ?? [],
      substrateChebiIds: data.substrates?.map((s: Record<string, unknown>) => s.chebiId ?? "") ?? [],
      productChebiIds: data.products?.map((p: Record<string, unknown>) => p.chebiId ?? "") ?? [],
      direction: data.direction ?? "UN",
      isTransport: data.isTransport ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * Search Rhea with fallback to empty results.
 * Uses fetchWithFallback pattern consistent with other database clients.
 */
export async function searchRheaWithFallback(query: string): Promise<FallbackResult<RheaSearchResult[]>> {
  return fetchWithFallback(async () => searchRhea(query), [], "Rhea");
}
