import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { sanitizeWorkbenchState } from '../store/workbenchValidation';
import type {
  WorkbenchCanonicalState,
  WorkbenchCollaborator,
  WorkbenchExperimentRecord,
  WorkbenchHistoryEntry,
  WorkbenchRunArtifact,
  WorkbenchSyncAuditEntry,
} from '../store/workbenchTypes';

type SqliteDb = BetterSqlite3.Database;
type ScopeResolveOptions = {
  forceExplicit?: boolean;
};

const DEFAULT_PROJECT_ID = 'default-workbench';
const SYSTEM_ACTOR_ID = 'system';
const LOCAL_STORE_DIR = path.join(process.cwd(), '.nexus');
const SERVERLESS_STORE_DIR = path.join('/tmp', '.nexus');

const EMPTY_STATE: WorkbenchCanonicalState = {
  schemaVersion: 1,
  revision: 0,
  lastMutationAt: 0,
  activeArtifactId: null,
  project: null,
  evidenceItems: [],
  selectedEvidenceIds: [],
  draftAnalyzeInput: '',
  workflowArtifact: null,
  analyzeArtifact: null,
  toolRuns: [],
  toolPayloads: {},
  runArtifacts: [],
  checkpoints: ['stage-1', 'stage-2', 'stage-3', 'stage-4'].map((id) => ({
    id: id as WorkbenchCanonicalState['checkpoints'][number]['id'],
    status: 'pending' as const,
    summary: 'Waiting for project context',
    updatedAt: 0,
  })),
  nextRecommendations: [],
  workflowControl: {
    machineState: 'idle',
    status: 'idle',
    currentToolId: null,
    nextRecommendedNode: 'pathd',
    missingEvidence: { minRequired: 0, have: 0, kinds: [] },
    confidence: null,
    uncertainty: null,
    validity: null,
    humanGateRequired: false,
    nextNodeIsContractOnly: false,
    isDemoOnly: false,
    latestRunStatus: null,
    latestRunToolId: null,
    reasonCodes: ['NO_TARGET'],
    explanation: 'No target product set. Set a target via /research or /analyze, then run PATHD.',
    iteration: 0,
    updatedAt: 0,
  },
};

let singletonDb: SqliteDb | null = null;

function now() {
  return Date.now();
}

function resolveStoreDir() {
  return process.env.VERCEL ? SERVERLESS_STORE_DIR : LOCAL_STORE_DIR;
}

function resolveDbPath() {
  return path.join(resolveStoreDir(), 'workbench.db');
}

function resolveLegacyJsonPath() {
  return path.join(resolveStoreDir(), 'workbench-state.json');
}

function toPayloadRecord(payload: WorkbenchRunArtifact['payloadSnapshot']) {
  return payload && typeof payload === 'object'
    ? payload as unknown as Record<string, unknown>
    : {};
}

function resolveProjectId(projectId?: string | null, state?: WorkbenchCanonicalState | null, options?: ScopeResolveOptions) {
  const candidate = options?.forceExplicit ? projectId : state?.project?.id ?? projectId;
  return candidate && candidate.trim().length > 0 ? candidate.trim() : DEFAULT_PROJECT_ID;
}

function resolveActorId(actorId?: string | null) {
  return actorId && actorId.trim().length > 0 ? actorId.trim() : SYSTEM_ACTOR_ID;
}

function inferProjectTitle(state: WorkbenchCanonicalState) {
  return state.project?.title || state.analyzeArtifact?.title || state.workflowArtifact?.intake.targetMolecule || 'Synthetic Biology Program';
}

function inferTargetProduct(state: WorkbenchCanonicalState) {
  return state.analyzeArtifact?.targetProduct || state.workflowArtifact?.intake.targetMolecule || state.project?.targetProduct || 'Target Product';
}

function inferProjectStatus(state: WorkbenchCanonicalState) {
  return state.project?.status || (state.runArtifacts.length > 0 ? 'iterating' : 'draft');
}

function classifyAuthorityTier(artifact: WorkbenchRunArtifact) {
  if (artifact.isSimulated) return 'simulated';
  if (['cellfree', 'dbtlflow', 'multio', 'scspatial'].includes(artifact.toolId)) return 'experiment-backed';
  if (artifact.sourceArtifactId || artifact.execution.analyzeRef) return 'evidence-linked';
  return 'contextual';
}

function classifyExperimentStatus(artifact: WorkbenchRunArtifact) {
  const payload = toPayloadRecord(artifact.payloadSnapshot);
  if (artifact.toolId === 'dbtlflow' && payload.feedbackSource === 'committed') return 'committed';
  if (artifact.isSimulated) return 'simulated';
  return 'recorded';
}

function buildExperimentMetrics(artifact: WorkbenchRunArtifact) {
  const payload = toPayloadRecord(artifact.payloadSnapshot);
  const result = payload.result && typeof payload.result === 'object' ? payload.result as Record<string, unknown> : null;

  switch (artifact.toolId) {
    case 'cellfree':
      return [
        typeof result?.totalProteinYield === 'number' ? `${result.totalProteinYield.toFixed(2)} total protein` : null,
        typeof result?.energyDepletionTime === 'number' ? `${result.energyDepletionTime.toFixed(1)} min depletion` : null,
        typeof result?.confidence === 'number' ? `${(result.confidence * 100).toFixed(0)}% confidence` : null,
      ].filter(Boolean) as string[];
    case 'dbtlflow':
      return [
        typeof result?.passRate === 'number' ? `${result.passRate.toFixed(0)}% pass rate` : null,
        typeof result?.improvementRate === 'number' ? `${result.improvementRate.toFixed(2)} improvement` : null,
        typeof payload.proposedPhase === 'string' ? `${payload.proposedPhase} phase` : null,
      ].filter(Boolean) as string[];
    case 'fbasim':
      return [
        typeof result?.growthRate === 'number' ? `growth ${result.growthRate.toFixed(3)}` : null,
        typeof result?.carbonEfficiency === 'number' ? `${result.carbonEfficiency.toFixed(1)}% carbon efficiency` : null,
        result?.feasible === true ? 'feasible' : result?.feasible === false ? 'infeasible' : null,
      ].filter(Boolean) as string[];
    case 'dyncon':
      return [
        typeof result?.productTiter === 'number' ? `${result.productTiter.toFixed(2)} g/L titer` : null,
        typeof result?.doRmse === 'number' ? `DO RMSE ${result.doRmse.toFixed(3)}` : null,
        result?.stable === true ? 'stable controller' : result?.stable === false ? 'unstable controller' : null,
      ].filter(Boolean) as string[];
    default:
      return artifact.summary.split('·').map((item) => item.trim()).slice(0, 3);
  }
}

function initializeSchema(db: SqliteDb) {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS actors (
      actor_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'researcher',
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_product TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      added_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      PRIMARY KEY (project_id, actor_id),
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES actors(actor_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_state (
      project_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      last_mutation_at INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      last_actor_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
      FOREIGN KEY (last_actor_id) REFERENCES actors(actor_id)
    );

    CREATE TABLE IF NOT EXISTS project_run_artifact_index (
      artifact_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      tool_id TEXT NOT NULL,
      stage_id TEXT,
      target_product TEXT NOT NULL,
      source_artifact_id TEXT,
      upstream_count INTEGER NOT NULL DEFAULT 0,
      summary TEXT NOT NULL,
      authority_tier TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      is_simulated INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_project_run_artifact_project_revision ON project_run_artifact_index (project_id, revision DESC);
    CREATE INDEX IF NOT EXISTS idx_project_run_artifact_project_tool ON project_run_artifact_index (project_id, tool_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS experiment_records (
      record_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      actor_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      stage_id TEXT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      authority_tier TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES actors(actor_id)
    );

    CREATE INDEX IF NOT EXISTS idx_experiment_records_project_created ON experiment_records (project_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS sync_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES actors(actor_id)
    );

    CREATE TABLE IF NOT EXISTS project_history (
      project_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      actor_id TEXT NOT NULL,
      project_title TEXT NOT NULL,
      target_product TEXT NOT NULL,
      analyze_title TEXT,
      analyze_generated_at INTEGER,
      run_artifact_count INTEGER NOT NULL DEFAULT 0,
      mutation_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      PRIMARY KEY (project_id, revision),
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES actors(actor_id)
    );

    CREATE INDEX IF NOT EXISTS idx_project_history_project_updated ON project_history (project_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS canonical_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      last_mutation_at INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  ensureLegacyColumns(db);
}

function hasColumn(db: SqliteDb, tableName: string, columnName: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function ensureLegacyColumns(db: SqliteDb) {
  if (!hasColumn(db, 'sync_audit', 'project_id')) {
    db.exec(`ALTER TABLE sync_audit ADD COLUMN project_id TEXT NOT NULL DEFAULT '${DEFAULT_PROJECT_ID}'`);
  }
  if (!hasColumn(db, 'sync_audit', 'actor_id')) {
    db.exec(`ALTER TABLE sync_audit ADD COLUMN actor_id TEXT NOT NULL DEFAULT '${SYSTEM_ACTOR_ID}'`);
  }
  if (!hasColumn(db, 'sync_audit', 'revision')) {
    db.exec('ALTER TABLE sync_audit ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
  }
  if (!hasColumn(db, 'sync_audit', 'action')) {
    db.exec("ALTER TABLE sync_audit ADD COLUMN action TEXT NOT NULL DEFAULT 'legacy-sync'");
  }
  if (!hasColumn(db, 'sync_audit', 'status')) {
    db.exec("ALTER TABLE sync_audit ADD COLUMN status TEXT NOT NULL DEFAULT 'ok'");
  }
  if (!hasColumn(db, 'sync_audit', 'detail')) {
    db.exec('ALTER TABLE sync_audit ADD COLUMN detail TEXT');
  }
  if (!hasColumn(db, 'sync_audit', 'created_at')) {
    db.exec('ALTER TABLE sync_audit ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0');
  }
}

function ensureActor(db: SqliteDb, actorId: string) {
  const timestamp = now();
  db.prepare(`
    INSERT INTO actors (actor_id, display_name, role, created_at, last_seen_at)
    VALUES (?, ?, 'researcher', ?, ?)
    ON CONFLICT(actor_id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at
  `).run(actorId, actorId === SYSTEM_ACTOR_ID ? 'System' : `Researcher ${actorId.slice(-6)}`, timestamp, timestamp);
}

function ensureProject(db: SqliteDb, projectId: string, actorId: string, state: WorkbenchCanonicalState) {
  const timestamp = now();
  db.prepare(`
    INSERT INTO projects (project_id, title, target_product, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      title = excluded.title,
      target_product = excluded.target_product,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).run(
    projectId,
    inferProjectTitle(state),
    inferTargetProduct(state),
    inferProjectStatus(state),
    state.project?.createdAt ?? timestamp,
    timestamp,
  );

  db.prepare(`
    INSERT INTO project_members (project_id, actor_id, role, added_at, last_seen_at)
    VALUES (?, ?, 'editor', ?, ?)
    ON CONFLICT(project_id, actor_id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at
  `).run(projectId, actorId, timestamp, timestamp);
}

function insertRunArtifacts(db: SqliteDb, projectId: string, revision: number, runArtifacts: WorkbenchRunArtifact[]) {
  const insert = db.prepare(`
    INSERT INTO project_run_artifact_index (
      artifact_id,
      project_id,
      revision,
      tool_id,
      stage_id,
      target_product,
      source_artifact_id,
      upstream_count,
      summary,
      authority_tier,
      created_at,
      is_simulated,
      payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const artifact of runArtifacts) {
    insert.run(
      artifact.id,
      projectId,
      revision,
      artifact.toolId,
      artifact.stageId,
      artifact.targetProduct,
      artifact.sourceArtifactId ?? null,
      artifact.upstreamArtifactIds.length,
      artifact.summary,
      classifyAuthorityTier(artifact),
      artifact.createdAt,
      artifact.isSimulated ? 1 : 0,
      JSON.stringify(artifact.payloadSnapshot),
    );
  }
}

function insertExperimentRecords(db: SqliteDb, projectId: string, actorId: string, revision: number, runArtifacts: WorkbenchRunArtifact[]) {
  const insert = db.prepare(`
    INSERT INTO experiment_records (
      record_id,
      project_id,
      revision,
      actor_id,
      tool_id,
      stage_id,
      category,
      title,
      summary,
      status,
      authority_tier,
      metrics_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const artifact of runArtifacts) {
    const category = ['cellfree', 'dbtlflow', 'multio', 'scspatial'].includes(artifact.toolId) ? 'experiment' : 'analysis';
    insert.run(
      artifact.id,
      projectId,
      revision,
      actorId,
      artifact.toolId,
      artifact.stageId,
      category,
      `${artifact.toolId.toUpperCase()} run`,
      artifact.summary,
      classifyExperimentStatus(artifact),
      classifyAuthorityTier(artifact),
      JSON.stringify(buildExperimentMetrics(artifact)),
      artifact.createdAt,
      now(),
    );
  }
}

function insertProjectHistory(
  db: SqliteDb,
  projectId: string,
  actorId: string,
  state: WorkbenchCanonicalState,
  updatedAt: number,
) {
  db.prepare(`
    INSERT OR REPLACE INTO project_history (
      project_id,
      revision,
      actor_id,
      project_title,
      target_product,
      analyze_title,
      analyze_generated_at,
      run_artifact_count,
      mutation_at,
      updated_at,
      state_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    state.revision,
    actorId,
    inferProjectTitle(state),
    inferTargetProduct(state),
    state.analyzeArtifact?.title ?? null,
    state.analyzeArtifact?.generatedAt ?? null,
    state.runArtifacts.length,
    state.lastMutationAt,
    updatedAt,
    JSON.stringify(state),
  );
}

async function migrateLegacyJsonIfNeeded(db: SqliteDb) {
  const hasProjectState = db.prepare('SELECT COUNT(*) as count FROM project_state').get() as { count: number };
  if (hasProjectState.count > 0) return;

  try {
    await access(resolveLegacyJsonPath());
  } catch {
    return;
  }

  try {
    const raw = await readFile(resolveLegacyJsonPath(), 'utf8');
    const parsed = sanitizeWorkbenchState(JSON.parse(raw));
    if (!parsed) return;
    writeProjectState(db, resolveProjectId(undefined, parsed), SYSTEM_ACTOR_ID, parsed, 'legacy-json-migration', 'migrated legacy JSON snapshot into collaborative project state');
  } catch {
    db.prepare(`
      INSERT INTO sync_audit (project_id, actor_id, revision, action, status, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(DEFAULT_PROJECT_ID, SYSTEM_ACTOR_ID, 0, 'legacy-json-migration', 'failed', 'legacy JSON migration failed or contained invalid state', now());
  }
}

function migrateLegacyCanonicalIfNeeded(db: SqliteDb) {
  const hasProjectState = db.prepare('SELECT COUNT(*) as count FROM project_state').get() as { count: number };
  if (hasProjectState.count > 0) return;
  const row = db.prepare('SELECT state_json FROM canonical_state WHERE id = 1').get() as { state_json?: string } | undefined;
  if (!row?.state_json) return;
  const parsed = sanitizeWorkbenchState(JSON.parse(row.state_json));
  if (!parsed) return;
  writeProjectState(db, resolveProjectId(undefined, parsed), SYSTEM_ACTOR_ID, parsed, 'legacy-canonical-migration', 'migrated legacy canonical snapshot into project-scoped state');
}

function getDb() {
  if (singletonDb) return singletonDb;
  singletonDb = new BetterSqlite3(resolveDbPath());
  initializeSchema(singletonDb);
  return singletonDb;
}

export async function getWorkbenchDb() {
  await mkdir(resolveStoreDir(), { recursive: true });
  const db = getDb();
  migrateLegacyCanonicalIfNeeded(db);
  await migrateLegacyJsonIfNeeded(db);
  return db;
}

export function projectStateExists(db: SqliteDb, projectId?: string | null, options?: ScopeResolveOptions) {
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const row = db.prepare('SELECT 1 as present FROM project_state WHERE project_id = ?').get(resolvedProjectId) as { present?: number } | undefined;
  return Boolean(row?.present);
}

export function readProjectState(db: SqliteDb, projectId?: string | null, options?: ScopeResolveOptions): WorkbenchCanonicalState {
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const row = db.prepare('SELECT state_json FROM project_state WHERE project_id = ?').get(resolvedProjectId) as { state_json?: string } | undefined;
  if (!row?.state_json) return EMPTY_STATE;
  try {
    return sanitizeWorkbenchState(JSON.parse(row.state_json)) ?? EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

export function writeProjectState(
  db: SqliteDb,
  projectId: string,
  actorId: string,
  state: WorkbenchCanonicalState,
  action = 'sync',
  detail = 'project state updated',
  options?: ScopeResolveOptions,
) {
  const resolvedProjectId = resolveProjectId(projectId, state, options);
  const resolvedActorId = resolveActorId(actorId);
  const timestamp = now();

  const tx = db.transaction(() => {
    ensureActor(db, resolvedActorId);
    ensureProject(db, resolvedProjectId, resolvedActorId, state);

    db.prepare(`
      INSERT INTO project_state (project_id, schema_version, revision, last_mutation_at, state_json, last_actor_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        schema_version = excluded.schema_version,
        revision = excluded.revision,
        last_mutation_at = excluded.last_mutation_at,
        state_json = excluded.state_json,
        last_actor_id = excluded.last_actor_id,
        updated_at = excluded.updated_at
    `).run(
      resolvedProjectId,
      state.schemaVersion,
      state.revision,
      state.lastMutationAt,
      JSON.stringify(state),
      resolvedActorId,
      timestamp,
    );

    db.prepare('DELETE FROM project_run_artifact_index WHERE project_id = ?').run(resolvedProjectId);
    db.prepare('DELETE FROM experiment_records WHERE project_id = ?').run(resolvedProjectId);

    insertRunArtifacts(db, resolvedProjectId, state.revision, state.runArtifacts);
    insertExperimentRecords(db, resolvedProjectId, resolvedActorId, state.revision, state.runArtifacts);
    insertProjectHistory(db, resolvedProjectId, resolvedActorId, state, timestamp);

    db.prepare(`
      INSERT INTO sync_audit (project_id, actor_id, revision, action, status, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(resolvedProjectId, resolvedActorId, state.revision, action, 'ok', detail, timestamp);
  });

  tx();
}

export function getBackendMeta(db: SqliteDb, projectId?: string | null, actorId?: string | null, options?: ScopeResolveOptions) {
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const resolvedActorId = resolveActorId(actorId);
  const projectState = db.prepare('SELECT revision, updated_at FROM project_state WHERE project_id = ?').get(resolvedProjectId) as { revision?: number; updated_at?: number } | undefined;
  const runArtifactCount = db.prepare('SELECT COUNT(*) as count FROM project_run_artifact_index WHERE project_id = ?').get(resolvedProjectId) as { count: number };
  const auditCount = db.prepare('SELECT COUNT(*) as count FROM sync_audit WHERE project_id = ?').get(resolvedProjectId) as { count: number };
  const historyCount = db.prepare('SELECT COUNT(*) as count FROM project_history WHERE project_id = ?').get(resolvedProjectId) as { count: number };
  const experimentCount = db.prepare('SELECT COUNT(*) as count FROM experiment_records WHERE project_id = ?').get(resolvedProjectId) as { count: number };
  const memberCount = db.prepare('SELECT COUNT(*) as count FROM project_members WHERE project_id = ?').get(resolvedProjectId) as { count: number };
  const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };

  return {
    kind: 'sqlite' as const,
    driver: 'better-sqlite3' as const,
    scope: 'project' as const,
    path: resolveDbPath(),
    projectId: resolvedProjectId,
    actorId: resolvedActorId,
    revision: projectState?.revision ?? 0,
    updatedAt: projectState?.updated_at ?? 0,
    runArtifactCount: runArtifactCount.count,
    auditCount: auditCount.count,
    historyCount: historyCount.count,
    experimentCount: experimentCount.count,
    memberCount: memberCount.count,
    projectCount: projectCount.count,
  };
}

export function listSyncAudit(db: SqliteDb, projectId?: string | null, limit = 12, options?: ScopeResolveOptions): WorkbenchSyncAuditEntry[] {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const rows = db.prepare(`
    SELECT id, project_id, actor_id, revision, action, status, detail, created_at
    FROM sync_audit
    WHERE project_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(resolvedProjectId, safeLimit) as Array<{
    id: number;
    project_id: string;
    actor_id: string;
    revision: number;
    action: string;
    status: string;
    detail: string | null;
    created_at: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    actorId: row.actor_id,
    revision: row.revision,
    action: row.action,
    status: row.status,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}

export function listCanonicalHistory(db: SqliteDb, projectId?: string | null, limit = 16, options?: ScopeResolveOptions): WorkbenchHistoryEntry[] {
  const safeLimit = Math.max(1, Math.min(limit, 64));
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const rows = db.prepare(`
    SELECT
      project_id,
      revision,
      actor_id,
      project_title,
      target_product,
      analyze_title,
      analyze_generated_at,
      run_artifact_count,
      mutation_at,
      updated_at
    FROM project_history
    WHERE project_id = ?
    ORDER BY revision DESC
    LIMIT ?
  `).all(resolvedProjectId, safeLimit) as Array<{
    project_id: string;
    revision: number;
    actor_id: string;
    project_title: string;
    target_product: string;
    analyze_title: string | null;
    analyze_generated_at: number | null;
    run_artifact_count: number;
    mutation_at: number;
    updated_at: number;
  }>;

  return rows.map((row) => ({
    revision: row.revision,
    projectId: row.project_id,
    actorId: row.actor_id,
    projectTitle: row.project_title,
    targetProduct: row.target_product,
    analyzeTitle: row.analyze_title,
    analyzeGeneratedAt: row.analyze_generated_at,
    runArtifactCount: row.run_artifact_count,
    mutationAt: row.mutation_at,
    updatedAt: row.updated_at,
  }));
}

export function listProjectMembers(db: SqliteDb, projectId?: string | null, limit = 24, options?: ScopeResolveOptions): WorkbenchCollaborator[] {
  const safeLimit = Math.max(1, Math.min(limit, 64));
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const rows = db.prepare(`
    SELECT pm.actor_id, a.display_name, pm.role, pm.last_seen_at
    FROM project_members pm
    JOIN actors a ON a.actor_id = pm.actor_id
    WHERE pm.project_id = ?
    ORDER BY pm.last_seen_at DESC
    LIMIT ?
  `).all(resolvedProjectId, safeLimit) as Array<{
    actor_id: string;
    display_name: string;
    role: string;
    last_seen_at: number;
  }>;

  return rows.map((row) => ({
    actorId: row.actor_id,
    displayName: row.display_name,
    role: row.role,
    lastSeenAt: row.last_seen_at,
  }));
}

export function listExperimentRecords(db: SqliteDb, projectId?: string | null, limit = 24, options?: ScopeResolveOptions): WorkbenchExperimentRecord[] {
  const safeLimit = Math.max(1, Math.min(limit, 64));
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const rows = db.prepare(`
    SELECT
      record_id,
      project_id,
      actor_id,
      revision,
      tool_id,
      stage_id,
      category,
      title,
      summary,
      status,
      authority_tier,
      metrics_json,
      created_at,
      updated_at
    FROM experiment_records
    WHERE project_id = ?
    ORDER BY created_at DESC, updated_at DESC
    LIMIT ?
  `).all(resolvedProjectId, safeLimit) as Array<{
    record_id: string;
    project_id: string;
    actor_id: string;
    revision: number;
    tool_id: string;
    stage_id: string | null;
    category: string;
    title: string;
    summary: string;
    status: string;
    authority_tier: 'simulated' | 'contextual' | 'evidence-linked' | 'experiment-backed';
    metrics_json: string;
    created_at: number;
    updated_at: number;
  }>;

  return rows.map((row) => ({
    recordId: row.record_id,
    projectId: row.project_id,
    actorId: row.actor_id,
    revision: row.revision,
    toolId: row.tool_id,
    stageId: row.stage_id as WorkbenchExperimentRecord['stageId'],
    category: row.category === 'experiment' ? 'experiment' : 'analysis',
    title: row.title,
    summary: row.summary,
    status: row.status,
    authorityTier: row.authority_tier,
    metrics: (() => {
      try {
        const parsed = JSON.parse(row.metrics_json);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
      } catch {
        return [];
      }
    })(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
