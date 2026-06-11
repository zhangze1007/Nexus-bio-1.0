/**
 * Workbench persistence layer — Turso (libSQL) via async helpers.
 *
 * All SQL is standard SQLite. Uses sqlGet/sqlAll/sqlRun/sqlBatch from libsqlDb.
 * Transactions are executed via sqlBatch (atomic batch of statements).
 *
 * MIGRATION PATH (M11): Migrated from better-sqlite3 (synchronous) to
 * @libsql/client (async) via libsqlDb.ts helpers.
 */
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { sqlAll, sqlGet, sqlRun, sqlBatch } from './libsqlDb';
import { sanitizeWorkbenchState } from '../store/workbenchValidation';
import type {
  WorkbenchCanonicalState,
  WorkbenchCollaborator,
  WorkbenchExperimentRecord,
  WorkbenchHistoryEntry,
  WorkbenchRunArtifact,
  WorkbenchSyncAuditEntry,
} from '../store/workbenchTypes';
import type { InStatement } from '@libsql/client';

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
  payloadAdmissionDecisionsByToolId: {},
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

// ─── Statement builders (return InStatement arrays for sqlBatch) ──────────────

function buildEnsureActorStatements(actorId: string): InStatement[] {
  const timestamp = now();
  return [{
    sql: `
      INSERT INTO actors (actor_id, display_name, role, created_at, last_seen_at)
      VALUES (?, ?, 'researcher', ?, ?)
      ON CONFLICT(actor_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at
    `,
    args: [actorId, actorId === SYSTEM_ACTOR_ID ? 'System' : `Researcher ${actorId.slice(-6)}`, timestamp, timestamp],
  }];
}

function buildEnsureProjectStatements(projectId: string, actorId: string, state: WorkbenchCanonicalState): InStatement[] {
  const timestamp = now();
  return [
    {
      sql: `
        INSERT INTO projects (project_id, title, target_product, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          title = excluded.title,
          target_product = excluded.target_product,
          status = excluded.status,
          updated_at = excluded.updated_at
      `,
      args: [
        projectId,
        inferProjectTitle(state),
        inferTargetProduct(state),
        inferProjectStatus(state),
        state.project?.createdAt ?? timestamp,
        timestamp,
      ],
    },
    {
      sql: `
        INSERT INTO project_members (project_id, actor_id, role, added_at, last_seen_at)
        VALUES (?, ?, 'editor', ?, ?)
        ON CONFLICT(project_id, actor_id) DO UPDATE SET
          last_seen_at = excluded.last_seen_at
      `,
      args: [projectId, actorId, timestamp, timestamp],
    },
  ];
}

function buildInsertRunArtifactStatements(projectId: string, revision: number, runArtifacts: WorkbenchRunArtifact[]): InStatement[] {
  return runArtifacts.map((artifact) => ({
    sql: `
      INSERT INTO project_run_artifact_index (
        artifact_id, project_id, revision, tool_id, stage_id, target_product,
        source_artifact_id, upstream_count, summary, authority_tier, created_at,
        is_simulated, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
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
    ],
  }));
}

function buildInsertExperimentRecordStatements(projectId: string, actorId: string, revision: number, runArtifacts: WorkbenchRunArtifact[]): InStatement[] {
  return runArtifacts.map((artifact) => {
    const category = ['cellfree', 'dbtlflow', 'multio', 'scspatial'].includes(artifact.toolId) ? 'experiment' : 'analysis';
    return {
      sql: `
        INSERT INTO experiment_records (
          record_id, project_id, revision, actor_id, tool_id, stage_id,
          category, title, summary, status, authority_tier, metrics_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
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
      ],
    };
  });
}

function buildInsertProjectHistoryStatements(
  projectId: string,
  actorId: string,
  state: WorkbenchCanonicalState,
  updatedAt: number,
): InStatement[] {
  return [{
    sql: `
      INSERT OR REPLACE INTO project_history (
        project_id, revision, actor_id, project_title, target_product,
        analyze_title, analyze_generated_at, run_artifact_count,
        mutation_at, updated_at, state_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
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
    ],
  }];
}

// ─── Schema initialization ───────────────────────────────────────────────────

/** Whitelist of valid table names — prevents latent SQL injection via PRAGMA. */
const VALID_TABLE_NAMES = new Set([
  'actors', 'projects', 'project_members', 'project_state',
  'project_run_artifact_index', 'experiment_records', 'sync_audit',
  'project_history', 'canonical_state',
]);

async function hasColumn(tableName: string, columnName: string): Promise<boolean> {
  if (!VALID_TABLE_NAMES.has(tableName)) {
    throw new Error(`hasColumn: invalid table name "${tableName}"`);
  }
  // PRAGMA doesn't support parameterized queries; whitelist above is the guard.
  const rows = await sqlAll(`PRAGMA table_info(${tableName})`);
  return rows.some((row) => row.name === columnName);
}

async function ensureLegacyColumns(): Promise<void> {
  const legacyColumns: Array<{ table: string; column: string; definition: string }> = [
    { table: 'sync_audit', column: 'project_id', definition: `TEXT NOT NULL DEFAULT '${DEFAULT_PROJECT_ID}'` },
    { table: 'sync_audit', column: 'actor_id', definition: `TEXT NOT NULL DEFAULT '${SYSTEM_ACTOR_ID}'` },
    { table: 'sync_audit', column: 'revision', definition: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'sync_audit', column: 'action', definition: "TEXT NOT NULL DEFAULT 'legacy-sync'" },
    { table: 'sync_audit', column: 'status', definition: "TEXT NOT NULL DEFAULT 'ok'" },
    { table: 'sync_audit', column: 'detail', definition: 'TEXT' },
    { table: 'sync_audit', column: 'created_at', definition: 'INTEGER NOT NULL DEFAULT 0' },
  ];

  for (const { table, column, definition } of legacyColumns) {
    if (!(await hasColumn(table, column))) {
      await sqlRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

async function initializeSchema(): Promise<void> {
  // PRAGMAs must be executed individually (not batched)
  await sqlRun('PRAGMA journal_mode = WAL');
  await sqlRun('PRAGMA synchronous = NORMAL');
  await sqlRun('PRAGMA foreign_keys = ON');

  const schemaStatements: InStatement[] = [
    { sql: `
      CREATE TABLE IF NOT EXISTS actors (
        actor_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'researcher',
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      )
    ` },
    { sql: `
      CREATE TABLE IF NOT EXISTS projects (
        project_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        target_product TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    ` },
    { sql: `
      CREATE TABLE IF NOT EXISTS project_members (
        project_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'editor',
        added_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        PRIMARY KEY (project_id, actor_id),
        FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES actors(actor_id) ON DELETE CASCADE
      )
    ` },
    { sql: `
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
      )
    ` },
    { sql: `
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
      )
    ` },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_project_run_artifact_project_revision ON project_run_artifact_index (project_id, revision DESC)' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_project_run_artifact_project_tool ON project_run_artifact_index (project_id, tool_id, created_at DESC)' },
    { sql: `
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
      )
    ` },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_experiment_records_project_created ON experiment_records (project_id, created_at DESC)' },
    { sql: `
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
      )
    ` },
    { sql: `
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
      )
    ` },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_project_history_project_updated ON project_history (project_id, updated_at DESC)' },
    { sql: `
      CREATE TABLE IF NOT EXISTS canonical_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        schema_version INTEGER NOT NULL,
        revision INTEGER NOT NULL,
        last_mutation_at INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    ` },
  ];

  await sqlBatch(schemaStatements);
  await ensureLegacyColumns();
}

// ─── Legacy migrations ───────────────────────────────────────────────────────

async function migrateLegacyCanonicalIfNeeded(): Promise<void> {
  const hasProjectState = await sqlGet('SELECT COUNT(*) as count FROM project_state');
  if (hasProjectState && (hasProjectState.count as number) > 0) return;
  const row = await sqlGet('SELECT state_json FROM canonical_state WHERE id = 1');
  if (!row?.state_json) return;
  let parsed;
  try {
    parsed = sanitizeWorkbenchState(JSON.parse(row.state_json as string));
  } catch {
    console.warn('[workbenchDb] Failed to parse legacy canonical state — skipping migration');
    return;
  }
  if (!parsed) return;
  await writeProjectState(resolveProjectId(undefined, parsed), SYSTEM_ACTOR_ID, parsed, 'legacy-canonical-migration', 'migrated legacy canonical snapshot into project-scoped state');
}

async function migrateLegacyJsonIfNeeded(): Promise<void> {
  const hasProjectState = await sqlGet('SELECT COUNT(*) as count FROM project_state');
  if (hasProjectState && (hasProjectState.count as number) > 0) return;

  try {
    await access(resolveLegacyJsonPath());
  } catch {
    return;
  }

  try {
    const raw = await readFile(resolveLegacyJsonPath(), 'utf8');
    const parsed = sanitizeWorkbenchState(JSON.parse(raw));
    if (!parsed) return;
    await writeProjectState(resolveProjectId(undefined, parsed), SYSTEM_ACTOR_ID, parsed, 'legacy-json-migration', 'migrated legacy JSON snapshot into collaborative project state');
  } catch {
    await sqlRun(
      `INSERT INTO sync_audit (project_id, actor_id, revision, action, status, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [DEFAULT_PROJECT_ID, SYSTEM_ACTOR_ID, 0, 'legacy-json-migration', 'failed', 'legacy JSON migration failed or contained invalid state', now()],
    );
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

let schemaReady = false;

export async function getWorkbenchDb(): Promise<void> {
  if (schemaReady) return;
  if (!process.env.TURSO_DATABASE_URL) {
    await mkdir(resolveStoreDir(), { recursive: true });
  }
  await initializeSchema();
  await migrateLegacyCanonicalIfNeeded();
  await migrateLegacyJsonIfNeeded();
  schemaReady = true;
}

export async function projectStateExists(projectId?: string | null, options?: ScopeResolveOptions): Promise<boolean> {
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const row = await sqlGet('SELECT 1 as present FROM project_state WHERE project_id = ?', [resolvedProjectId]);
  return Boolean(row?.present);
}

export async function readProjectState(projectId?: string | null, options?: ScopeResolveOptions): Promise<WorkbenchCanonicalState> {
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const row = await sqlGet('SELECT state_json FROM project_state WHERE project_id = ?', [resolvedProjectId]);
  if (!row?.state_json) return EMPTY_STATE;
  try {
    return sanitizeWorkbenchState(JSON.parse(row.state_json as string)) ?? EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

export async function writeProjectState(
  projectId: string,
  actorId: string,
  state: WorkbenchCanonicalState,
  action = 'sync',
  detail = 'project state updated',
  options?: ScopeResolveOptions,
): Promise<void> {
  const resolvedProjectId = resolveProjectId(projectId, state, options);
  const resolvedActorId = resolveActorId(actorId);
  const timestamp = now();

  // Collect all statements into a single atomic batch
  const statements: InStatement[] = [
    ...buildEnsureActorStatements(resolvedActorId),
    ...buildEnsureProjectStatements(resolvedProjectId, resolvedActorId, state),
    {
      sql: `
        INSERT INTO project_state (project_id, schema_version, revision, last_mutation_at, state_json, last_actor_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          schema_version = excluded.schema_version,
          revision = excluded.revision,
          last_mutation_at = excluded.last_mutation_at,
          state_json = excluded.state_json,
          last_actor_id = excluded.last_actor_id,
          updated_at = excluded.updated_at
      `,
      args: [
        resolvedProjectId,
        state.schemaVersion,
        state.revision,
        state.lastMutationAt,
        JSON.stringify(state),
        resolvedActorId,
        timestamp,
      ],
    },
    { sql: 'DELETE FROM project_run_artifact_index WHERE project_id = ?', args: [resolvedProjectId] },
    { sql: 'DELETE FROM experiment_records WHERE project_id = ?', args: [resolvedProjectId] },
    ...buildInsertRunArtifactStatements(resolvedProjectId, state.revision, state.runArtifacts),
    ...buildInsertExperimentRecordStatements(resolvedProjectId, resolvedActorId, state.revision, state.runArtifacts),
    ...buildInsertProjectHistoryStatements(resolvedProjectId, resolvedActorId, state, timestamp),
    {
      sql: `
        INSERT INTO sync_audit (project_id, actor_id, revision, action, status, detail, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [resolvedProjectId, resolvedActorId, state.revision, action, 'ok', detail, timestamp],
    },
  ];

  await sqlBatch(statements);
}

export async function getBackendMeta(projectId?: string | null, actorId?: string | null, options?: ScopeResolveOptions) {
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const resolvedActorId = resolveActorId(actorId);
  const [projectState, runArtifactCount, auditCount, historyCount, experimentCount, memberCount, projectCount] = await Promise.all([
    sqlGet('SELECT revision, updated_at FROM project_state WHERE project_id = ?', [resolvedProjectId]),
    sqlGet('SELECT COUNT(*) as count FROM project_run_artifact_index WHERE project_id = ?', [resolvedProjectId]),
    sqlGet('SELECT COUNT(*) as count FROM sync_audit WHERE project_id = ?', [resolvedProjectId]),
    sqlGet('SELECT COUNT(*) as count FROM project_history WHERE project_id = ?', [resolvedProjectId]),
    sqlGet('SELECT COUNT(*) as count FROM experiment_records WHERE project_id = ?', [resolvedProjectId]),
    sqlGet('SELECT COUNT(*) as count FROM project_members WHERE project_id = ?', [resolvedProjectId]),
    sqlGet('SELECT COUNT(*) as count FROM projects'),
  ]);

  return {
    kind: 'sqlite' as const,
    driver: 'libsql' as const,
    scope: 'project' as const,
    path: resolveDbPath(),
    projectId: resolvedProjectId,
    actorId: resolvedActorId,
    revision: (projectState?.revision as number) ?? 0,
    updatedAt: (projectState?.updated_at as number) ?? 0,
    runArtifactCount: (runArtifactCount?.count as number) ?? 0,
    auditCount: (auditCount?.count as number) ?? 0,
    historyCount: (historyCount?.count as number) ?? 0,
    experimentCount: (experimentCount?.count as number) ?? 0,
    memberCount: (memberCount?.count as number) ?? 0,
    projectCount: (projectCount?.count as number) ?? 0,
  };
}

export async function listSyncAudit(projectId?: string | null, limit = 12, options?: ScopeResolveOptions): Promise<WorkbenchSyncAuditEntry[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const rows = await sqlAll(`
    SELECT id, project_id, actor_id, revision, action, status, detail, created_at
    FROM sync_audit
    WHERE project_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `, [resolvedProjectId, safeLimit]);

  return rows.map((row) => ({
    id: row.id as number,
    projectId: row.project_id as string,
    actorId: row.actor_id as string,
    revision: row.revision as number,
    action: row.action as string,
    status: row.status as string,
    detail: row.detail as string | null,
    createdAt: row.created_at as number,
  }));
}

export async function listCanonicalHistory(projectId?: string | null, limit = 16, options?: ScopeResolveOptions): Promise<WorkbenchHistoryEntry[]> {
  const safeLimit = Math.max(1, Math.min(limit, 64));
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const rows = await sqlAll(`
    SELECT
      project_id, revision, actor_id, project_title, target_product,
      analyze_title, analyze_generated_at, run_artifact_count,
      mutation_at, updated_at
    FROM project_history
    WHERE project_id = ?
    ORDER BY revision DESC
    LIMIT ?
  `, [resolvedProjectId, safeLimit]);

  return rows.map((row) => ({
    revision: row.revision as number,
    projectId: row.project_id as string,
    actorId: row.actor_id as string,
    projectTitle: row.project_title as string,
    targetProduct: row.target_product as string,
    analyzeTitle: row.analyze_title as string | null,
    analyzeGeneratedAt: row.analyze_generated_at as number | null,
    runArtifactCount: row.run_artifact_count as number,
    mutationAt: row.mutation_at as number,
    updatedAt: row.updated_at as number,
  }));
}

export async function listProjectMembers(projectId?: string | null, limit = 24, options?: ScopeResolveOptions): Promise<WorkbenchCollaborator[]> {
  const safeLimit = Math.max(1, Math.min(limit, 64));
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const rows = await sqlAll(`
    SELECT pm.actor_id, a.display_name, pm.role, pm.last_seen_at
    FROM project_members pm
    JOIN actors a ON a.actor_id = pm.actor_id
    WHERE pm.project_id = ?
    ORDER BY pm.last_seen_at DESC
    LIMIT ?
  `, [resolvedProjectId, safeLimit]);

  return rows.map((row) => ({
    actorId: row.actor_id as string,
    displayName: row.display_name as string,
    role: row.role as string,
    lastSeenAt: row.last_seen_at as number,
  }));
}

export async function listExperimentRecords(projectId?: string | null, limit = 24, options?: ScopeResolveOptions): Promise<WorkbenchExperimentRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 64));
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const rows = await sqlAll(`
    SELECT
      record_id, project_id, actor_id, revision, tool_id, stage_id,
      category, title, summary, status, authority_tier, metrics_json,
      created_at, updated_at
    FROM experiment_records
    WHERE project_id = ?
    ORDER BY created_at DESC, updated_at DESC
    LIMIT ?
  `, [resolvedProjectId, safeLimit]);

  return rows.map((row) => ({
    recordId: row.record_id as string,
    projectId: row.project_id as string,
    actorId: row.actor_id as string,
    revision: row.revision as number,
    toolId: row.tool_id as string,
    stageId: row.stage_id as WorkbenchExperimentRecord['stageId'],
    category: row.category === 'experiment' ? 'experiment' : 'analysis',
    title: row.title as string,
    summary: row.summary as string,
    status: row.status as string,
    authorityTier: row.authority_tier as 'simulated' | 'contextual' | 'evidence-linked' | 'experiment-backed',
    metrics: (() => {
      try {
        const parsed = JSON.parse(row.metrics_json as string);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
      } catch {
        return [];
      }
    })(),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  }));
}
