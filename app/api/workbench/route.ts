import { NextResponse } from 'next/server';
import { sanitizeWorkbenchState } from '../../../src/store/workbenchValidation';
import {
  getBackendMeta,
  getWorkbenchDb,
  listCanonicalHistory,
  listExperimentRecords,
  listProjectMembers,
  listSyncAudit,
  readProjectState,
  writeProjectState,
} from '../../../src/server/workbenchDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getProjectScope(request: Request) {
  const headerProjectId = request.headers.get('x-workbench-project-id');
  const headerActorId = request.headers.get('x-workbench-actor-id');
  return {
    projectId: headerProjectId && headerProjectId.trim().length > 0 ? headerProjectId.trim() : undefined,
    actorId: headerActorId && headerActorId.trim().length > 0 ? headerActorId.trim() : undefined,
  };
}

export async function GET(request: Request) {
  const { projectId, actorId } = getProjectScope(request);
  const db = await getWorkbenchDb();
  const state = readProjectState(db, projectId);
  const resolvedProjectId = state.project?.id ?? projectId;
  const backend = getBackendMeta(db, resolvedProjectId, actorId);
  const audit = listSyncAudit(db, resolvedProjectId);
  const history = listCanonicalHistory(db, resolvedProjectId);
  const members = listProjectMembers(db, resolvedProjectId);
  const experiments = listExperimentRecords(db, resolvedProjectId);
  return NextResponse.json({ ok: true, state, backend, members, experiments, audit, history });
}

export async function PUT(request: Request) {
  const { projectId: scopedProjectId, actorId } = getProjectScope(request);
  const body = await request.json().catch(() => null);
  const incoming = sanitizeWorkbenchState(body?.state);
  if (!incoming) {
    return NextResponse.json({ ok: false, error: 'Invalid workbench payload' }, { status: 400 });
  }

  const db = await getWorkbenchDb();
  const projectId = incoming.project?.id ?? scopedProjectId;
  const current = readProjectState(db, projectId);
  if (incoming.revision < current.revision) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Incoming workbench revision is stale',
        state: current,
        backend: getBackendMeta(db, projectId, actorId),
        members: listProjectMembers(db, projectId),
        experiments: listExperimentRecords(db, projectId),
        audit: listSyncAudit(db, projectId),
        history: listCanonicalHistory(db, projectId),
      },
      { status: 409 },
    );
  }

  const nextState = {
    ...incoming,
    schemaVersion: 1,
  };

  writeProjectState(db, projectId ?? nextState.project?.id ?? 'default-workbench', actorId ?? 'system', nextState, 'client-sync', `client synced revision ${nextState.revision}`);
  return NextResponse.json({
    ok: true,
    state: nextState,
    backend: getBackendMeta(db, projectId ?? nextState.project?.id, actorId),
    members: listProjectMembers(db, projectId ?? nextState.project?.id),
    experiments: listExperimentRecords(db, projectId ?? nextState.project?.id),
    audit: listSyncAudit(db, projectId ?? nextState.project?.id),
    history: listCanonicalHistory(db, projectId ?? nextState.project?.id),
  });
}
