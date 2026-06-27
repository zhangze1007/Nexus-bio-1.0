import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from '../../../src/lib/auth';
import { deriveAnalyzeCompatibilityProjection } from '../../../src/domain/workflowArtifactAdapters';
import type { WorkflowArtifact } from '../../../src/domain/workflowArtifact';
import { sanitizeWorkbenchState } from '../../../src/store/workbenchValidation';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { evaluateClaimSurfacePolicy } from '../../../src/services/trustPolicyEngine';
import {
  getBackendMeta,
  getWorkbenchDb,
  listCanonicalHistory,
  listExperimentRecords,
  listProjectMembers,
  listSyncAudit,
  projectStateExists,
  readProjectState,
  writeProjectState,
} from '../../../src/server/workbenchDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

function normalizeNonEmptyId(value: string | null | undefined) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function summarizeWorkflowArtifactDebug(artifact: WorkflowArtifact | null | undefined) {
  if (!artifact) return null;
  return {
    id: normalizeNonEmptyId(artifact.id) ?? null,
    status: artifact.status,
    schemaVersion: artifact.schemaVersion,
    version: artifact.version,
    hasGraph: Boolean(artifact.atomicPathwayGraph),
    nodeCount: artifact.atomicPathwayGraph?.nodes.length ?? 0,
    edgeCount: artifact.atomicPathwayGraph?.edges.length ?? 0,
    evidencePacketCount: artifact.evidencePackets.length,
  };
}

function getProjectScope(request: Request) {
  const url = new URL(request.url);
  const headerProjectId = request.headers.get('x-workbench-project-id');
  const headerActorId = request.headers.get('x-workbench-actor-id');
  return {
    artifactId: normalizeNonEmptyId(url.searchParams.get('artifact')),
    projectId: headerProjectId && headerProjectId.trim().length > 0 ? headerProjectId.trim() : undefined,
    actorId: headerActorId && headerActorId.trim().length > 0 ? headerActorId.trim() : undefined,
  };
}

// ── Export provenance interception ──
// When workbench state is exported (GET), check each tool payload for provenance.
// Payloads missing provenance are tagged [UNVERIFIED] so downstream consumers
// know the data has not been through the trust gate.

interface ExportProvenanceSummary {
  totalPayloads: number;
  verifiedPayloads: number;
  unverifiedPayloads: string[];
  decision: 'ok' | 'has-unverified';
}

interface TaggedPayload {
  toolId: string;
  unverified?: boolean;
  [key: string]: unknown;
}

function checkExportProvenance(state: Record<string, unknown>): ExportProvenanceSummary {
  const toolPayloads = state.toolPayloads as Record<string, unknown> | undefined;
  if (!toolPayloads || typeof toolPayloads !== 'object') {
    return { totalPayloads: 0, verifiedPayloads: 0, unverifiedPayloads: [], decision: 'ok' };
  }

  const unverified: string[] = [];
  let total = 0;
  let verified = 0;

  for (const [toolId, payload] of Object.entries(toolPayloads)) {
    if (!payload || typeof payload !== 'object') continue;
    total++;

    const record = payload as Record<string, unknown>;
    const hasProvenance = Boolean(record.runProvenance);
    const validityTier = typeof record.validity === 'string' ? record.validity : 'demo';
    const isDraft = Boolean(record.isDraft);

    // Evaluate the export claim-surface policy for this tool
    const gateDecision = evaluateClaimSurfacePolicy({
      toolId,
      surface: 'export',
      validityTier: validityTier as 'real' | 'partial' | 'demo',
      isDraft,
      provenanceIds: hasProvenance ? [`${toolId}:export-check`] : [],
    });

    if (gateDecision.status === 'ok' || gateDecision.status === 'demoOnly') {
      verified++;
    } else {
      unverified.push(toolId);
    }
  }

  return {
    totalPayloads: total,
    verifiedPayloads: verified,
    unverifiedPayloads: unverified,
    decision: unverified.length > 0 ? 'has-unverified' : 'ok',
  };
}

function tagUnverifiedPayloads(
  state: Record<string, unknown>,
  unverifiedToolIds: string[],
): Record<string, unknown> {
  if (unverifiedToolIds.length === 0) return state;

  const toolPayloads = state.toolPayloads as Record<string, unknown> | undefined;
  if (!toolPayloads || typeof toolPayloads !== 'object') return state;

  const tagged = { ...toolPayloads };
  for (const toolId of unverifiedToolIds) {
    const payload = tagged[toolId];
    if (payload && typeof payload === 'object') {
      tagged[toolId] = {
        ...(payload as Record<string, unknown>),
        unverified: true,
      } as TaggedPayload;
    }
  }

  return { ...state, toolPayloads: tagged };
}

export async function GET(request: Request) {
  // ── Authentication ──
  // Verify the request has a valid session. The middleware handles transport-level
  // auth (API key, same-origin), but the handler must also verify user identity
  // to prevent unauthenticated data access.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required' },
      { status: 401, headers: getCorsHeaders(request) },
    );
  }

  const { artifactId, projectId, actorId } = getProjectScope(request);
  await getWorkbenchDb();
  const useArtifactScope = Boolean(artifactId);
  const explicitScope = useArtifactScope ? { forceExplicit: true as const } : undefined;

  if (artifactId && !(await projectStateExists(artifactId, explicitScope))) {
    return NextResponse.json({ ok: false, error: 'Workflow artifact not found' }, { status: 404, headers: getCorsHeaders(request) });
  }

  // ── Project membership verification ──
  // When a specific project or artifact is requested, verify the requesting actor
  // is a member. This prevents users from reading other users' projects by forging
  // the x-workbench-project-id header. Skip for the default shared project scope
  // (no explicit project/artifact ID) to allow first-time access.
  const scopeId = artifactId ?? projectId;
  if (scopeId && actorId) {
    const members = await listProjectMembers(scopeId, 64, explicitScope);
    if (members.length > 0 && !members.some(m => m.actorId === actorId)) {
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403, headers: getCorsHeaders(request) },
      );
    }
  }

  const state = await readProjectState(artifactId ?? projectId, explicitScope);
  const resolvedProjectId = artifactId ?? state.project?.id ?? projectId;
  const [backend, audit, history, members, experiments] = await Promise.all([
    getBackendMeta(resolvedProjectId, actorId, explicitScope),
    listSyncAudit(resolvedProjectId, 12, explicitScope),
    listCanonicalHistory(resolvedProjectId, 16, explicitScope),
    listProjectMembers(resolvedProjectId, 24, explicitScope),
    listExperimentRecords(resolvedProjectId, 24, explicitScope),
  ]);

  // ── Export provenance interception ──
  // Check all tool payloads for provenance before returning export data.
  // Tag payloads missing provenance as [UNVERIFIED].
  const stateRecord = state as unknown as Record<string, unknown>;
  const exportProvenance = checkExportProvenance(stateRecord);
  const taggedState = exportProvenance.decision === 'has-unverified'
    ? tagUnverifiedPayloads(stateRecord, exportProvenance.unverifiedPayloads)
    : state;

  return NextResponse.json({
    ok: true,
    state: taggedState,
    backend,
    members,
    experiments,
    audit,
    history,
    exportProvenance,
  }, { headers: getCorsHeaders(request) });
}

export async function PUT(request: Request) {
  // ── Auth chain ──
  // Requests reaching this handler have already passed middleware.ts authentication.
  // middleware.ts checks: (1) Sec-Fetch-Site: same-origin, (2) X-API-Key header,
  // (3) Authorization: Bearer token. Unauthenticated requests get a 401 before
  // reaching this handler. Additional CSRF and payload validation follows below.

  // ── Origin checking (CSRF protection) ──
  const origin = request.headers.get('origin') ?? '';
  const ALLOWED_ORIGINS = [
    'https://nexus-bio-1-0.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { ok: false, error: 'Forbidden: invalid origin' },
      { status: 403, headers: getCorsHeaders(request) },
    );
  }

  // ── CSRF: require JSON content type ──
  const putContentType = request.headers.get('content-type') ?? '';
  if (!putContentType.includes('application/json')) {
    return NextResponse.json(
      { ok: false, error: 'Invalid content type' },
      { status: 415, headers: getCorsHeaders(request) },
    );
  }

  // ── Body size limit (1MB) ──
  const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
  if (contentLength > 1_000_000) {
    return NextResponse.json(
      { ok: false, error: 'Request body too large' },
      { status: 413, headers: getCorsHeaders(request) },
    );
  }

  const { artifactId: scopedArtifactId, projectId: scopedProjectId, actorId } = getProjectScope(request);
  const body = await request.json().catch(() => null);
  const incoming = sanitizeWorkbenchState(body?.state);
  if (!incoming) {
    return NextResponse.json({ ok: false, error: 'Invalid workbench payload' }, { status: 400, headers: getCorsHeaders(request) });
  }

  // ── State payload size guard (500KB) ──
  const stateJson = JSON.stringify(incoming);
  if (stateJson.length > 500_000) {
    return NextResponse.json(
      { ok: false, error: 'State payload too large' },
      { status: 413, headers: getCorsHeaders(request) },
    );
  }

  await getWorkbenchDb();
  const needsArtifactScope = Boolean(scopedArtifactId || incoming.activeArtifactId || incoming.workflowArtifact);
  const resolvedArtifactId = scopedArtifactId
    || normalizeNonEmptyId(incoming.activeArtifactId)
    || normalizeNonEmptyId(incoming.workflowArtifact?.id)
    || (incoming.workflowArtifact ? `artifact-${randomUUID()}` : undefined);
  if (needsArtifactScope && !resolvedArtifactId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Artifact-scoped persistence could not resolve a stable artifact ID',
      },
      { status: 500 },
    );
  }
  const scopeId: string = needsArtifactScope
    ? resolvedArtifactId!
    : incoming.project?.id ?? scopedProjectId ?? 'default-workbench';
  const explicitScope = needsArtifactScope ? { forceExplicit: true as const } : undefined;
  if (needsArtifactScope && process.env.NODE_ENV !== 'production') {
    console.info('[api/workbench] canonical artifact save request payload', {
      scopedArtifactId: scopedArtifactId ?? null,
      resolvedArtifactId: resolvedArtifactId ?? null,
      scopeId: scopeId ?? null,
      explicitScope: true,
      incomingState: {
        activeArtifactId: normalizeNonEmptyId(incoming.activeArtifactId) ?? null,
        workflowArtifact: summarizeWorkflowArtifactDebug(incoming.workflowArtifact),
      },
    });
  }
  const current = await readProjectState(scopeId, explicitScope);
  if (incoming.revision < current.revision) {
    const [backend, members, experiments, audit, history] = await Promise.all([
      getBackendMeta(scopeId, actorId, explicitScope),
      listProjectMembers(scopeId, 24, explicitScope),
      listExperimentRecords(scopeId, 24, explicitScope),
      listSyncAudit(scopeId, 12, explicitScope),
      listCanonicalHistory(scopeId, 16, explicitScope),
    ]);
    return NextResponse.json(
      {
        ok: false,
        error: 'Incoming workbench revision is stale',
        state: current,
        backend,
        members,
        experiments,
        audit,
        history,
      },
      { status: 409 },
    );
  }

  const nextStateBase = {
    ...incoming,
    schemaVersion: 1,
  };
  const now = Date.now();
  const resolvedWorkflowArtifact: WorkflowArtifact | null = needsArtifactScope
    ? (() => {
        const candidate = nextStateBase.workflowArtifact ?? current.workflowArtifact;
        if (!candidate || !resolvedArtifactId) return null;
        const status: WorkflowArtifact['status'] = candidate.status === 'error' ? 'error' : 'compiled';
        return {
          ...candidate,
          id: resolvedArtifactId,
          schemaVersion: 1,
          version: Math.max(candidate.version, current.workflowArtifact?.version ?? 0, 1),
          status,
          createdAt: current.workflowArtifact?.createdAt ?? candidate.createdAt ?? now,
          updatedAt: now,
        };
      })()
    : nextStateBase.workflowArtifact;
  const resolvedAnalyzeArtifact = resolvedWorkflowArtifact
    ? deriveAnalyzeCompatibilityProjection(resolvedWorkflowArtifact)
    : nextStateBase.analyzeArtifact;
  const nextState = {
    ...nextStateBase,
    activeArtifactId: resolvedWorkflowArtifact?.id ?? nextStateBase.activeArtifactId,
    workflowArtifact: resolvedWorkflowArtifact,
    analyzeArtifact: resolvedAnalyzeArtifact,
    project: nextStateBase.project
      ? {
          ...nextStateBase.project,
          summary: resolvedAnalyzeArtifact?.summary ?? nextStateBase.project.summary,
          targetProduct: resolvedAnalyzeArtifact?.targetProduct ?? nextStateBase.project.targetProduct,
          sourceQuery: resolvedWorkflowArtifact?.intake.sourceQuery ?? nextStateBase.project.sourceQuery,
          status: resolvedAnalyzeArtifact ? 'active' : nextStateBase.project.status,
          isDemo: resolvedAnalyzeArtifact ? false : nextStateBase.project.isDemo,
          updatedAt: now,
        }
      : nextStateBase.project,
  };

  await writeProjectState(
    scopeId,
    actorId ?? 'system',
    nextState,
    'client-sync',
    `client synced revision ${nextState.revision}`,
    explicitScope,
  );
  if (needsArtifactScope && process.env.NODE_ENV !== 'production') {
    console.info('[api/workbench] canonical artifact save response payload', {
      ok: true,
      state: {
        activeArtifactId: nextState.activeArtifactId ?? null,
        workflowArtifact: summarizeWorkflowArtifactDebug(nextState.workflowArtifact),
      },
      scopeId,
      explicitScope: true,
    });
  }
  const [backend, members, experiments, audit, history] = await Promise.all([
    getBackendMeta(scopeId, actorId, explicitScope),
    listProjectMembers(scopeId, 24, explicitScope),
    listExperimentRecords(scopeId, 24, explicitScope),
    listSyncAudit(scopeId, 12, explicitScope),
    listCanonicalHistory(scopeId, 16, explicitScope),
  ]);
  return NextResponse.json({
    ok: true,
    state: nextState,
    backend,
    members,
    experiments,
    audit,
    history,
  });
}
