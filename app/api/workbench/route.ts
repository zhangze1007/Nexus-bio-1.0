import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { deriveAnalyzeCompatibilityProjection } from '../../../src/domain/workflowArtifactAdapters';
import type { WorkflowArtifact } from '../../../src/domain/workflowArtifact';
import { sanitizeWorkbenchState } from '../../../src/store/workbenchValidation';
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

function getProjectScope(request: Request) {
  const url = new URL(request.url);
  const headerProjectId = request.headers.get('x-workbench-project-id');
  const headerActorId = request.headers.get('x-workbench-actor-id');
  return {
    artifactId: url.searchParams.get('artifact')?.trim() || undefined,
    projectId: headerProjectId && headerProjectId.trim().length > 0 ? headerProjectId.trim() : undefined,
    actorId: headerActorId && headerActorId.trim().length > 0 ? headerActorId.trim() : undefined,
  };
}

export async function GET(request: Request) {
  const { artifactId, projectId, actorId } = getProjectScope(request);
  const db = await getWorkbenchDb();
  const useArtifactScope = Boolean(artifactId);
  const explicitScope = useArtifactScope ? { forceExplicit: true as const } : undefined;

  if (artifactId && !projectStateExists(db, artifactId, explicitScope)) {
    return NextResponse.json({ ok: false, error: 'Workflow artifact not found' }, { status: 404 });
  }

  const state = readProjectState(db, artifactId ?? projectId, explicitScope);
  const resolvedProjectId = artifactId ?? state.project?.id ?? projectId;
  const backend = getBackendMeta(db, resolvedProjectId, actorId, explicitScope);
  const audit = listSyncAudit(db, resolvedProjectId, 12, explicitScope);
  const history = listCanonicalHistory(db, resolvedProjectId, 16, explicitScope);
  const members = listProjectMembers(db, resolvedProjectId, 24, explicitScope);
  const experiments = listExperimentRecords(db, resolvedProjectId, 24, explicitScope);
  return NextResponse.json({ ok: true, state, backend, members, experiments, audit, history });
}

export async function PUT(request: Request) {
  const { artifactId: scopedArtifactId, projectId: scopedProjectId, actorId } = getProjectScope(request);
  const body = await request.json().catch(() => null);
  const incoming = sanitizeWorkbenchState(body?.state);
  if (!incoming) {
    return NextResponse.json({ ok: false, error: 'Invalid workbench payload' }, { status: 400 });
  }

  const db = await getWorkbenchDb();
  const needsArtifactScope = Boolean(scopedArtifactId || incoming.activeArtifactId || incoming.workflowArtifact);
  const resolvedArtifactId = scopedArtifactId
    ?? incoming.activeArtifactId
    ?? incoming.workflowArtifact?.id?.trim()
    ?? (incoming.workflowArtifact ? `artifact-${randomUUID()}` : undefined);
  const scopeId = resolvedArtifactId ?? incoming.project?.id ?? scopedProjectId ?? 'default-workbench';
  const explicitScope = resolvedArtifactId ? { forceExplicit: true as const } : undefined;
  const current = readProjectState(db, scopeId, explicitScope);
  if (incoming.revision < current.revision) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Incoming workbench revision is stale',
        state: current,
        backend: getBackendMeta(db, scopeId, actorId, explicitScope),
        members: listProjectMembers(db, scopeId, 24, explicitScope),
        experiments: listExperimentRecords(db, scopeId, 24, explicitScope),
        audit: listSyncAudit(db, scopeId, 12, explicitScope),
        history: listCanonicalHistory(db, scopeId, 16, explicitScope),
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

  writeProjectState(
    db,
    scopeId,
    actorId ?? 'system',
    nextState,
    'client-sync',
    `client synced revision ${nextState.revision}`,
    explicitScope,
  );
  return NextResponse.json({
    ok: true,
    state: nextState,
    backend: getBackendMeta(db, scopeId, actorId, explicitScope),
    members: listProjectMembers(db, scopeId, 24, explicitScope),
    experiments: listExperimentRecords(db, scopeId, 24, explicitScope),
    audit: listSyncAudit(db, scopeId, 12, explicitScope),
    history: listCanonicalHistory(db, scopeId, 16, explicitScope),
  });
}
