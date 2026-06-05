/**
 * Pure helper functions and constants for workbenchStore.
 *
 * These are stateless utilities extracted from the 1900-line store
 * to improve readability and testability. They have zero store dependencies.
 */
import type { PathwayNode } from '../types';
import type { WorkbenchStageId } from '../components/tools/shared/workbenchConfig';
import type {
  WorkbenchAnalyzeArtifact,
  WorkbenchEvidenceItem,
  WorkbenchRunArtifact,
  WorkbenchToolRun,
  StageCheckpoint,
  NextStepRecommendation,
} from './workbenchTypes';
import type { WorkbenchToolPayloadMap } from './workbenchPayloads';

// ── Constants ──
export const STAGE_IDS: WorkbenchStageId[] = ['stage-1', 'stage-2', 'stage-3', 'stage-4'];
export const WORKBENCH_SCHEMA_VERSION = 1;
export const RUN_ARTIFACT_LIMIT = 160;
export const TOOL_RUN_LIMIT = 120;
export const WORKBENCH_ACTOR_KEY = 'nexus-bio:workbench-actor-id';
export const DEFAULT_PROJECT_SYNC_SCOPE = 'default-workbench';
export const PROVENANCE_MIDDLEWARE_TOOL_IDS = new Set(['pathd', 'dyncon', 'dbtlflow', 'catdes']);

// ── ID generation ──
export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getWorkbenchActorId() {
  if (typeof window === 'undefined') return 'system';
  try {
    const existing = window.localStorage.getItem(WORKBENCH_ACTOR_KEY);
    if (existing && existing.trim().length > 0) return existing;
    const generated = typeof window.crypto?.randomUUID === 'function'
      ? `actor-${window.crypto.randomUUID()}`
      : createId('actor');
    window.localStorage.setItem(WORKBENCH_ACTOR_KEY, generated);
    return generated;
  } catch {
    return 'system';
  }
}

// ── Serialization ──
export function stableSerialize(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export function normalizeNonEmptyId(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function isPayloadRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function payloadTimestamp(value: unknown): string | undefined {
  if (!isPayloadRecord(value) || typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) {
    return undefined;
  }
  return new Date(value.updatedAt).toISOString();
}

// ── Checkpoint builders ──
export function createEmptyCheckpoints(now = Date.now()): StageCheckpoint[] {
  return STAGE_IDS.map((id) => ({
    id,
    status: 'pending',
    summary: 'Waiting for project context',
    updatedAt: now,
  }));
}

export function buildCheckpoints(
  currentStageId: WorkbenchStageId | null,
  analyzeArtifact: WorkbenchAnalyzeArtifact | null,
  toolRuns: WorkbenchToolRun[],
): StageCheckpoint[] {
  const now = Date.now();
  const hasStageVisits = (stageId: WorkbenchStageId) => toolRuns.some((run) => run.stageId === stageId);

  return STAGE_IDS.map((stageId) => {
    if (stageId === 'stage-1' && analyzeArtifact) {
      return {
        id: stageId,
        status: currentStageId === stageId ? 'active' : 'complete',
        summary: `${analyzeArtifact.pathwayCandidates.length || 1} analyzed pathway candidate ready`,
        updatedAt: now,
      };
    }
    if (hasStageVisits(stageId)) {
      return {
        id: stageId,
        status: currentStageId === stageId ? 'active' : 'complete',
        summary: `Visited ${toolRuns.filter((run) => run.stageId === stageId).length} workbench step(s)`,
        updatedAt: now,
      };
    }
    return {
      id: stageId,
      status: currentStageId === stageId ? 'active' : 'pending',
      summary: currentStageId === stageId ? 'Current execution focus' : 'Not started',
      updatedAt: now,
    };
  });
}

// ── Evidence helpers ──
export function composeEvidenceText(items: WorkbenchEvidenceItem[]) {
  return items
    .map((item) => {
      const meta = [
        item.source ?? item.journal,
        item.year,
        item.doi ? `DOI: ${item.doi}` : null,
      ].filter(Boolean).join(' · ');
      return [
        `Title: ${item.title}`,
        item.authors.length ? `Authors: ${item.authors.join(', ')}` : null,
        meta ? `Source: ${meta}` : null,
        item.abstract ? `Abstract: ${item.abstract}` : null,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n---\n\n');
}

// ── Recommendation builders ──
export function buildRecommendationsFromToolIds(
  toolIds: string[],
  source: NextStepRecommendation['source'],
  reason: string,
): NextStepRecommendation[] {
  return toolIds.map((toolId) => ({
    id: `${source}-${toolId}`,
    toolId,
    source,
    reason,
  }));
}

// ── Project helpers ──
export function deriveTargetProduct(nodes: PathwayNode[]) {
  const preferred = [...nodes].reverse().find((node) => node.nodeType !== 'enzyme' && node.nodeType !== 'gene');
  return preferred?.label ?? nodes[nodes.length - 1]?.label ?? 'Target Product';
}

export function shouldAutoSeedDemo(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.location.search.includes('demo=1')) return true;
  } catch {
    // Ignore — sandboxed iframes can throw on .search access.
  }
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AUTO_DEMO === '1') return true;
  return false;
}

// ── Payload analysis ──
export function inferToolSimulation(payload: WorkbenchToolPayloadMap[keyof WorkbenchToolPayloadMap]) {
  if (!payload) return true;
  if ('validity' in payload && payload.validity === 'demo') return true;
  if ('result' in payload && payload.result && typeof payload.result === 'object') {
    if ('mode' in payload.result) {
      return payload.result.mode === 'mock' || payload.result.mode === 'idle';
    }
  }
  return false;
}

export function payloadValidity(payload: WorkbenchToolPayloadMap[keyof WorkbenchToolPayloadMap]): WorkbenchRunArtifact['validity'] {
  if (!payload || typeof payload !== 'object' || !('validity' in payload)) return null;
  const validity = payload.validity;
  return validity === 'real' || validity === 'partial' || validity === 'demo' ? validity : null;
}
