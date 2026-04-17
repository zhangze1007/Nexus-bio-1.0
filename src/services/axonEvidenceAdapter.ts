/**
 * axonEvidenceAdapter — evidence / literature expansion seam.
 *
 * PR-4 brief: "Strengthen the research usefulness of Axon by improving
 * evidence gathering, but only where grounded. If literature APIs or
 * evidence adapters already exist in repo, integrate them properly. If
 * they do not exist, do NOT invent fake literature access — instead
 * create a clean extension seam for future adapters and explicitly mark
 * unimplemented evidence domains."
 *
 * What exists today:
 *   • The workbench store already holds a real `evidenceItems` array —
 *     these are items the user saved from elsewhere (analyze flow,
 *     semantic search). That IS real evidence; we expose it via the
 *     `workbench` source adapter.
 *
 * What does NOT exist today:
 *   • An integrated PubMed / bioRxiv / Semantic Scholar adapter. We
 *     expose named stubs for those sources so callers can enumerate
 *     them (and so the UI can show "source not wired yet") without
 *     pretending the data is available.
 */

import type {
  NextStepRecommendation,
  WorkbenchAnalyzeArtifact,
  WorkbenchEvidenceItem,
} from '../store/workbenchTypes';

export type EvidenceSourceId =
  | 'workbench'
  | 'pubmed'
  | 'biorxiv'
  | 'semantic-scholar';

export type EvidenceAdapterStatus = 'available' | 'not-implemented';

export interface EvidenceQuery {
  targetProduct: string | null;
  /** Optional free-text expansion (e.g. the copilot question). */
  hint?: string;
  /** Max items the caller wants; adapters cap down to a safe ceiling. */
  limit?: number;
}

export interface EvidenceSummaryItem {
  id: string;
  title: string;
  year?: string;
  sourceKind: string;
  /** The adapter that produced this item. */
  source: EvidenceSourceId;
  /** Short excerpt, length-capped. */
  excerpt?: string;
}

export interface EvidenceSummaryProvenance {
  source: EvidenceSourceId;
  retrievedAt: number;
  queryTarget: string | null;
  /** Reason the summary is empty, if it is. */
  emptyReason?: string;
}

export interface EvidenceSummaryResult {
  status: EvidenceAdapterStatus;
  items: EvidenceSummaryItem[];
  provenance: EvidenceSummaryProvenance;
  /** Plain-text warning for unimplemented sources. */
  warning?: string;
}

export interface EvidenceAdapter {
  source: EvidenceSourceId;
  label: string;
  status: EvidenceAdapterStatus;
  query: (q: EvidenceQuery) => EvidenceSummaryResult;
}

const EXCERPT_CAP = 220;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 12;

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Real adapter over the workbench evidence ledger — no network, no LLM,
 * no side-effects. Returns items the user has actually saved.
 */
export function createWorkbenchEvidenceAdapter(
  read: () => {
    evidenceItems: WorkbenchEvidenceItem[];
    analyzeArtifact: WorkbenchAnalyzeArtifact | null;
    nextRecommendations: NextStepRecommendation[];
  },
  now: () => number = Date.now,
): EvidenceAdapter {
  return {
    source: 'workbench',
    label: 'Workbench evidence ledger',
    status: 'available',
    query(q) {
      const snap = read();
      const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      const items = snap.evidenceItems.slice(0, limit).map((item) => ({
        id: item.id,
        title: truncate(item.title, 120),
        year: item.year,
        sourceKind: item.sourceKind,
        source: 'workbench' as const,
        excerpt: item.abstract
          ? truncate(item.abstract, EXCERPT_CAP)
          : undefined,
      }));
      return {
        status: 'available',
        items,
        provenance: {
          source: 'workbench',
          retrievedAt: now(),
          queryTarget: q.targetProduct,
          emptyReason: items.length === 0 ? 'No workbench evidence saved yet' : undefined,
        },
      };
    },
  };
}

/**
 * Explicitly-unimplemented adapter. Calling `query` does NOT hit a
 * network. It returns a clearly-labelled empty result with a warning
 * so the planner / UI can display "source not wired" rather than
 * silently pretending the data is available.
 */
export function createStubEvidenceAdapter(
  source: EvidenceSourceId,
  label: string,
  now: () => number = Date.now,
): EvidenceAdapter {
  return {
    source,
    label,
    status: 'not-implemented',
    query(q) {
      return {
        status: 'not-implemented',
        items: [],
        provenance: {
          source,
          retrievedAt: now(),
          queryTarget: q.targetProduct,
          emptyReason: `${label} adapter is not wired yet; skipping query.`,
        },
        warning: `${label} is a PR-4 extension seam — no data returned. Connect a real adapter in PR-5+.`,
      };
    },
  };
}

export interface EvidenceAdapterRegistry {
  list: () => EvidenceAdapter[];
  get: (source: EvidenceSourceId) => EvidenceAdapter | undefined;
  isAvailable: (source: EvidenceSourceId) => boolean;
}

export function createEvidenceAdapterRegistry(
  adapters: EvidenceAdapter[],
): EvidenceAdapterRegistry {
  const byId = new Map(adapters.map((a) => [a.source, a]));
  return {
    list() {
      return adapters.slice();
    },
    get(source) {
      return byId.get(source);
    },
    isAvailable(source) {
      return byId.get(source)?.status === 'available';
    },
  };
}

/**
 * Default registry: one real adapter (workbench ledger) + three named
 * stubs for future literature sources. This keeps the surface honest:
 * UI consumers can enumerate sources and see which are wired.
 */
export function buildDefaultEvidenceRegistry(
  readWorkbench: Parameters<typeof createWorkbenchEvidenceAdapter>[0],
): EvidenceAdapterRegistry {
  return createEvidenceAdapterRegistry([
    createWorkbenchEvidenceAdapter(readWorkbench),
    createStubEvidenceAdapter('pubmed', 'PubMed'),
    createStubEvidenceAdapter('biorxiv', 'bioRxiv'),
    createStubEvidenceAdapter('semantic-scholar', 'Semantic Scholar'),
  ]);
}
