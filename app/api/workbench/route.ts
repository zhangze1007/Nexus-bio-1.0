import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { deriveAnalyzeCompatibilityProjection } from '../../../src/domain/workflowArtifactAdapters';
import type { WorkflowArtifact } from '../../../src/domain/workflowArtifact';
import { sanitizeWorkbenchState } from '../../../src/store/workbenchValidation';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
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

export async function GET(request: Request) {
  const { artifactId, projectId, actorId } = getProjectScope(request);
  await getWorkbenchDb();
  const useArtifactScope = Boolean(artifactId);
  const explicitScope = useArtifactScope ? { forceExplicit: true as const } : undefined;

  if (artifactId && !await projectStateExists(artifactId, explicitScope)) {
    return NextResponse.json({ ok: false, error: 'Workflow artifact not found' }, { status: 404, headers: getCorsHeaders(request) });
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
  return NextResponse.json({ ok: true, state, backend, members, experiments, audit, history }, { headers: getCorsHeaders(request) });
}

export async function PUT(request: Request) {
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
