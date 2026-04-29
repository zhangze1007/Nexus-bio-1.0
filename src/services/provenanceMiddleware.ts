import type {
  ClaimSurface,
  ProvenanceEntry,
} from '../protocol/nexusTrustRuntime';
import { TOOL_VALIDITY } from '../components/tools/shared/toolValidity';
import type {
  ProvenanceEntry as WorkbenchProvenanceEntry,
} from '../types/assumptions';

export interface ProvenanceContext {
  toolId: string;
  activityType: ProvenanceEntry['activityType'];
  surface?: ClaimSurface;
  actor?: string;
  inputAssumptionIds?: string[];
  outputAssumptionIds?: string[];
  evidenceIds?: string[];
  upstreamProvenanceIds?: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface WithProvenanceResult<TPayload> {
  payload: TPayload;
  provenanceEntry: ProvenanceEntry;
}

export interface ProvenanceChainDiagnostics {
  provenanceIds: string[];
  chainLength: number;
  missingUpstreamProvenanceIds: string[];
  hasMissingUpstream: boolean;
}

type ProvenanceLike = ProvenanceEntry | WorkbenchProvenanceEntry;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter((item) => item.trim().length > 0)));
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function generatedProvenanceId(context: ProvenanceContext, startedAt: string, completedAt?: string): string {
  const material = JSON.stringify({
    toolId: context.toolId,
    activityType: context.activityType,
    surface: context.surface ?? null,
    actor: context.actor ?? null,
    inputAssumptionIds: context.inputAssumptionIds ?? [],
    outputAssumptionIds: context.outputAssumptionIds ?? [],
    evidenceIds: context.evidenceIds ?? [],
    upstreamProvenanceIds: context.upstreamProvenanceIds ?? [],
    startedAt,
    completedAt: completedAt ?? null,
  });
  return `provenance:${context.toolId}:${context.activityType}:${stableHash(material)}`;
}

function provenanceTimestamp(startedAt: string): number {
  const parsed = Date.parse(startedAt);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function toWorkbenchProvenanceEntry(entry: ProvenanceEntry): WorkbenchProvenanceEntry {
  return {
    toolId: entry.toolId,
    timestamp: provenanceTimestamp(entry.startedAt),
    inputAssumptions: [...entry.inputAssumptionIds],
    outputAssumptions: [...entry.outputAssumptionIds],
    evidence: [],
    validityTier: TOOL_VALIDITY[entry.toolId]?.level ?? 'partial',
    upstreamProvenance: [...entry.upstreamProvenanceIds],
  };
}

function makeProvenanceEntry(context: ProvenanceContext, startedAt: string, completedAt?: string): ProvenanceEntry {
  return {
    provenanceId: generatedProvenanceId(context, startedAt, completedAt),
    toolId: context.toolId,
    activityType: context.activityType,
    ...(context.surface ? { surface: context.surface } : {}),
    startedAt,
    ...(completedAt ? { completedAt } : {}),
    inputAssumptionIds: unique(context.inputAssumptionIds ?? []),
    outputAssumptionIds: unique(context.outputAssumptionIds ?? []),
    evidenceIds: unique(context.evidenceIds ?? []),
    upstreamProvenanceIds: unique(context.upstreamProvenanceIds ?? []),
    ...(context.actor ? { actor: context.actor } : {}),
  };
}

function cloneWithRunProvenance<TPayload>(
  payload: TPayload,
  provenanceEntry: ProvenanceEntry,
): TPayload {
  if (!isRecord(payload)) return payload;
  const workbenchEntry = toWorkbenchProvenanceEntry(provenanceEntry);
  const existing = payload.runProvenance;

  if (Array.isArray(existing)) {
    return {
      ...payload,
      runProvenance: [...existing, workbenchEntry],
    } as TPayload;
  }

  if (existing !== undefined) {
    return {
      ...payload,
      runProvenance: [existing, workbenchEntry],
    } as TPayload;
  }

  return {
    ...payload,
    runProvenance: workbenchEntry,
  } as TPayload;
}

export function appendRunProvenance<TPayload>(
  payload: TPayload,
  provenanceEntry: ProvenanceEntry,
): TPayload {
  return cloneWithRunProvenance(payload, provenanceEntry);
}

export async function withProvenance<TPayload>(
  inputPayload: TPayload,
  context: ProvenanceContext,
  run: (payload: TPayload) => Promise<TPayload>,
): Promise<WithProvenanceResult<TPayload>> {
  const startedAt = context.startedAt ?? new Date().toISOString();
  const outputPayload = await run(inputPayload);
  const completedAt = context.completedAt ?? new Date().toISOString();
  const provenanceEntry = makeProvenanceEntry(context, startedAt, completedAt);
  return {
    payload: appendRunProvenance(outputPayload, provenanceEntry),
    provenanceEntry,
  };
}

export function withProvenanceSync<TPayload>(
  inputPayload: TPayload,
  context: ProvenanceContext,
  run: (payload: TPayload) => TPayload,
): WithProvenanceResult<TPayload> {
  const startedAt = context.startedAt ?? new Date().toISOString();
  const outputPayload = run(inputPayload);
  const completedAt = context.completedAt ?? new Date().toISOString();
  const provenanceEntry = makeProvenanceEntry(context, startedAt, completedAt);
  return {
    payload: appendRunProvenance(outputPayload, provenanceEntry),
    provenanceEntry,
  };
}

function provenanceIdFromEntry(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.provenanceId === 'string') return value.provenanceId;
  if (typeof value.toolId === 'string' && typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)) {
    return `${value.toolId}:${value.timestamp}`;
  }
  return null;
}

function upstreamIdsFromEntry(value: unknown): string[] {
  if (!isRecord(value)) return [];
  const protocolIds = Array.isArray(value.upstreamProvenanceIds)
    ? value.upstreamProvenanceIds.filter((item): item is string => typeof item === 'string')
    : [];
  const workbenchIds = Array.isArray(value.upstreamProvenance)
    ? value.upstreamProvenance.filter((item): item is string => typeof item === 'string')
    : [];
  return unique([...protocolIds, ...workbenchIds]);
}

function entriesFromPayload(payload: unknown): ProvenanceLike[] {
  if (!isRecord(payload)) return [];
  const value = payload.runProvenance;
  if (Array.isArray(value)) {
    return value.filter((entry): entry is ProvenanceLike => provenanceIdFromEntry(entry) !== null);
  }
  return provenanceIdFromEntry(value) ? [value as ProvenanceLike] : [];
}

export function collectProvenanceIds(payload: unknown): string[] {
  return unique(entriesFromPayload(payload).map((entry) => provenanceIdFromEntry(entry)).filter((id): id is string => id !== null));
}

export function getProvenanceChainLength(payload: unknown): number {
  return collectProvenanceIds(payload).length;
}

export function findMissingUpstreamProvenance(payload: unknown): string[] {
  const entries = entriesFromPayload(payload);
  const localIds = new Set(collectProvenanceIds(payload));
  const referencedIds = unique(entries.flatMap(upstreamIdsFromEntry));
  return referencedIds.filter((id) => !localIds.has(id));
}

export function getProvenanceChainDiagnostics(payload: unknown): ProvenanceChainDiagnostics {
  const provenanceIds = collectProvenanceIds(payload);
  const missingUpstreamProvenanceIds = findMissingUpstreamProvenance(payload);
  return {
    provenanceIds,
    chainLength: provenanceIds.length,
    missingUpstreamProvenanceIds,
    hasMissingUpstream: missingUpstreamProvenanceIds.length > 0,
  };
}
