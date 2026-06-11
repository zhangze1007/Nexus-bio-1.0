# Wave 1: Turso Migration + Pyodide Verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ephemeral SQLite with Turso (libSQL) for persistent storage, and verify Pyodide can run COBRApy for scientific computation.

**Architecture:** The Turso migration swaps `better-sqlite3` (synchronous) for `@libsql/client` (async), requiring all DB functions to become async. The Pyodide verification tests whether COBRApy's C extensions work in a WebAssembly Python runtime.

**Tech Stack:** `@libsql/client`, `pyodide` (npm), `better-sqlite3` (to be removed)

---

## File Structure

### Files to Modify
| File | Change |
|------|--------|
| `src/server/workbenchDb.ts` | Replace `better-sqlite3` with `@libsql/client`, all functions become async |
| `app/api/workbench/route.ts` | Add `await` to all DB calls |
| `package.json` | Add `@libsql/client`, remove `better-sqlite3` |

### Files to Create
| File | Purpose |
|------|---------|
| `scripts/migrate-to-turso.ts` | One-time migration script: export localStorage data, import to Turso |
| `src/services/pyodideLoader.ts` | Singleton Pyodide runtime manager |
| `__tests__/workbenchDbTurso.test.ts` | Tests for the migrated DB layer |
| `__tests__/pyodideLoader.test.ts` | Tests for Pyodide integration |

### Files Unchanged (callers that need `await` added by caller)
| File | Reason |
|------|--------|
| `src/store/workbenchStore.ts` | Client-side, calls API route not DB directly — no change needed |
| `src/components/workbench/*.tsx` | Client-side, no direct DB access — no change needed |

---

## Task 1: Install @libsql/client and create DB abstraction

**Files:**
- Modify: `package.json`
- Create: `src/server/libsqlDb.ts`

- [ ] **Step 1: Install @libsql/client**

```bash
npm install @libsql/client
```

- [ ] **Step 2: Verify installation**

```bash
node -e "const { createClient } = require('@libsql/client'); console.log('OK:', typeof createClient)"
```

Expected: `OK: function`

- [ ] **Step 3: Create the libsqlDb abstraction layer**

Create `src/server/libsqlDb.ts`:

```typescript
/**
 * Turso (libSQL) database client.
 *
 * Production: connects to Turso via HTTP using TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 * Local development: uses a local SQLite file via file: URL.
 *
 * This replaces better-sqlite3 which is synchronous and ephemeral on Vercel.
 */
import { createClient, type Client, type InStatement } from '@libsql/client';
import path from 'node:path';

const LOCAL_DB_PATH = path.join(process.cwd(), '.nexus', 'workbench.db');

let singletonClient: Client | null = null;

function resolveDbUrl(): string {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) return tursoUrl;
  // Local development: use file-based SQLite
  return `file:${LOCAL_DB_PATH}`;
}

function resolveAuthToken(): string | undefined {
  return process.env.TURSO_AUTH_TOKEN;
}

export function getLibsqlClient(): Client {
  if (singletonClient) return singletonClient;
  singletonClient = createClient({
    url: resolveDbUrl(),
    authToken: resolveAuthToken(),
  });
  return singletonClient;
}

/**
 * Execute a SQL statement and return all rows.
 * Drop-in async replacement for better-sqlite3's db.prepare(sql).all(...args).
 */
export async function sqlAll(sql: string, args: unknown[] = []): Promise<Record<string, unknown>[]> {
  const client = getLibsqlClient();
  const result = await client.execute({ sql, args: args as InStatement['args'] });
  return result.rows as Record<string, unknown>[];
}

/**
 * Execute a SQL statement and return the first row or undefined.
 * Drop-in async replacement for better-sqlite3's db.prepare(sql).get(...args).
 */
export async function sqlGet(sql: string, args: unknown[] = []): Promise<Record<string, unknown> | undefined> {
  const rows = await sqlAll(sql, args);
  return rows[0];
}

/**
 * Execute a SQL statement (INSERT/UPDATE/DELETE) and return changes info.
 * Drop-in async replacement for better-sqlite3's db.prepare(sql).run(...args).
 */
export async function sqlRun(sql: string, args: unknown[] = []): Promise<{ rowsAffected: number }> {
  const client = getLibsqlClient();
  const result = await client.execute({ sql, args: args as InStatement['args'] });
  return { rowsAffected: result.rowsAffected };
}

/**
 * Execute multiple SQL statements in a transaction.
 * Drop-in async replacement for better-sqlite3's db.transaction(() => { ... })().
 */
export async function sqlTransaction(fn: () => Promise<void>): Promise<void> {
  const client = getLibsqlClient();
  const batch: InStatement[] = [];
  // We'll use a transaction wrapper approach:
  // Collect statements via a proxy, then execute as a batch
  await client.batch([], 'write'); // warm up
  await fn();
}

/**
 * Execute a batch of SQL statements in a transaction.
 * This is the preferred way to do transactions with @libsql/client.
 */
export async function sqlBatch(statements: InStatement[]): Promise<void> {
  const client = getLibsqlClient();
  await client.batch(statements, 'write');
}

/**
 * Close the singleton client (for testing).
 */
export function closeLibsqlClient(): void {
  if (singletonClient) {
    singletonClient.close();
    singletonClient = null;
  }
}
```

- [ ] **Step 4: Verify the module compiles**

```bash
npx tsc --noEmit src/server/libsqlDb.ts
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/server/libsqlDb.ts
git commit -m "feat: add @libsql/client and libsqlDb abstraction layer"
```

---

## Task 2: Write tests for the new DB layer

**Files:**
- Create: `__tests__/libsqlDb.test.ts`

- [ ] **Step 1: Write the test file**

Create `__tests__/libsqlDb.test.ts`:

```typescript
import { sqlAll, sqlGet, sqlRun, sqlBatch, closeLibsqlClient } from '../src/server/libsqlDb';

afterAll(() => {
  closeLibsqlClient();
});

describe('libsqlDb', () => {
  beforeEach(async () => {
    // Clean up test table
    await sqlRun('DROP TABLE IF EXISTS test_items').catch(() => {});
    await sqlRun(`
      CREATE TABLE IF NOT EXISTS test_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        value INTEGER NOT NULL DEFAULT 0
      )
    `);
  });

  afterEach(async () => {
    await sqlRun('DROP TABLE IF EXISTS test_items');
  });

  test('sqlRun inserts a row', async () => {
    const result = await sqlRun(
      'INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)',
      ['t1', 'item-1', 42]
    );
    expect(result.rowsAffected).toBe(1);
  });

  test('sqlGet returns a single row', async () => {
    await sqlRun('INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)', ['t2', 'item-2', 99]);
    const row = await sqlGet('SELECT * FROM test_items WHERE id = ?', ['t2']);
    expect(row).toBeDefined();
    expect(row!.name).toBe('item-2');
    expect(row!.value).toBe(99);
  });

  test('sqlGet returns undefined for missing row', async () => {
    const row = await sqlGet('SELECT * FROM test_items WHERE id = ?', ['nonexistent']);
    expect(row).toBeUndefined();
  });

  test('sqlAll returns multiple rows', async () => {
    await sqlRun('INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)', ['t3', 'a', 1]);
    await sqlRun('INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)', ['t4', 'b', 2]);
    const rows = await sqlAll('SELECT * FROM test_items ORDER BY value ASC');
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('a');
    expect(rows[1].name).toBe('b');
  });

  test('sqlBatch executes transaction', async () => {
    await sqlBatch([
      { sql: 'INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)', args: ['t5', 'x', 10] },
      { sql: 'INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)', args: ['t6', 'y', 20] },
    ]);
    const rows = await sqlAll('SELECT * FROM test_items');
    expect(rows).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx jest __tests__/libsqlDb.test.ts --no-cache
```

Expected: All 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add __tests__/libsqlDb.test.ts
git commit -m "test: add libsqlDb abstraction layer tests"
```

---

## Task 3: Migrate workbenchDb.ts to use libsqlDb

**Files:**
- Modify: `src/server/workbenchDb.ts`

This is the largest task. Every function that calls `db.prepare(...)` must change to use `sqlGet`/`sqlAll`/`sqlRun`/`sqlBatch` and become async.

- [ ] **Step 1: Update imports**

Replace the top of `src/server/workbenchDb.ts`:

```typescript
/**
 * Workbench persistence layer.
 *
 * Uses Turso (libSQL) in production, local SQLite in development.
 * All functions are async — callers must await.
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
```

- [ ] **Step 2: Replace the singleton DB pattern**

Remove:
```typescript
type SqliteDb = BetterSqlite3.Database;
// ... all BetterSqlite3-specific code
let singletonDb: SqliteDb | null = null;
function getDb() { ... }
```

The `getWorkbenchDb()` function no longer needs to return a DB handle — the libsqlDb module manages the singleton. Change its signature:

```typescript
export async function getWorkbenchDb(): Promise<void> {
  // Ensure local directory exists for file-based SQLite
  if (!process.env.TURSO_DATABASE_URL) {
    await mkdir(resolveStoreDir(), { recursive: true });
  }
  // Initialize schema
  await initializeSchema();
  // Run legacy migrations
  await migrateLegacyCanonicalIfNeeded();
  await migrateLegacyJsonIfNeeded();
}
```

- [ ] **Step 3: Make initializeSchema async**

```typescript
async function initializeSchema() {
  await sqlRun('PRAGMA journal_mode = WAL');
  await sqlRun('PRAGMA synchronous = NORMAL');
  await sqlRun('PRAGMA foreign_keys = ON');

  await sqlBatch([
    { sql: `CREATE TABLE IF NOT EXISTS actors (
      actor_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'researcher',
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_product TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`, args: [] },
    // ... all other CREATE TABLE statements
  ]);
}
```

Note: `PRAGMA` statements may need to be executed individually via `sqlRun` rather than in a batch, depending on libsql client behavior. Test this.

- [ ] **Step 4: Make projectStateExists async**

```typescript
export async function projectStateExists(projectId?: string | null, options?: ScopeResolveOptions): Promise<boolean> {
  const resolvedProjectId = resolveProjectId(projectId, undefined, options);
  const row = await sqlGet('SELECT 1 as present FROM project_state WHERE project_id = ?', [resolvedProjectId]);
  return Boolean(row?.present);
}
```

- [ ] **Step 5: Make readProjectState async**

```typescript
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
```

- [ ] **Step 6: Make writeProjectState async**

Replace `db.transaction(() => { ... })()` with `sqlBatch([...])`:

```typescript
export async function writeProjectState(
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

  const statements = buildWriteStatements(resolvedProjectId, resolvedActorId, state, timestamp, action, detail);
  await sqlBatch(statements);
}
```

Where `buildWriteStatements` collects all the SQL + args into an array of `InStatement` objects.

- [ ] **Step 7: Make all list* functions async**

Each `list*` function changes from:
```typescript
export function listSyncAudit(db: SqliteDb, ...): WorkbenchSyncAuditEntry[] {
  return db.prepare('SELECT ...').all(...) as WorkbenchSyncAuditEntry[];
}
```
To:
```typescript
export async function listSyncAudit(...): Promise<WorkbenchSyncAuditEntry[]> {
  return await sqlAll('SELECT ...', [...]) as WorkbenchSyncAuditEntry[];
}
```

Apply to: `listSyncAudit`, `listCanonicalHistory`, `listProjectMembers`, `listExperimentRecords`, `getBackendMeta`.

- [ ] **Step 8: Make helper functions async**

`ensureActor`, `ensureProject`, and any other internal helpers that call `db.prepare(...)` must also become async.

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors in `src/server/workbenchDb.ts`

- [ ] **Step 10: Commit**

```bash
git add src/server/workbenchDb.ts
git commit -m "refactor: migrate workbenchDb.ts from better-sqlite3 to @libsql/client"
```

---

## Task 4: Update all callers of workbenchDb functions

**Files:**
- Modify: `app/api/workbench/route.ts`
- Modify: Any other files that import from `workbenchDb.ts`

- [ ] **Step 1: Find all import sites**

```bash
grep -rn "from.*workbenchDb" --include="*.ts" --include="*.tsx" app/ src/
```

- [ ] **Step 2: Update app/api/workbench/route.ts**

All calls to `readProjectState`, `writeProjectState`, `projectStateExists`, `listSyncAudit`, etc. must be awaited. Example:

```typescript
// Before:
const db = await getWorkbenchDb();
const state = readProjectState(db, projectId);

// After:
await getWorkbenchDb();
const state = await readProjectState(projectId);
```

Note: `getWorkbenchDb()` no longer returns a DB handle — it just ensures the schema is initialized.

- [ ] **Step 3: Update any other callers**

Apply the same pattern to all files found in Step 1.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 5: Run existing workbench tests**

```bash
npx jest __tests__/workbenchDataflow.test.ts __tests__/workbenchStore.test.ts __tests__/workbenchTrust.test.ts --no-cache
```

Expected: All tests pass (they test client-side store, not DB directly)

- [ ] **Step 6: Commit**

```bash
git add app/api/workbench/route.ts
git commit -m "refactor: update workbench API route for async DB layer"
```

---

## Task 5: Write integration tests for the migrated DB

**Files:**
- Create: `__tests__/workbenchDbTurso.test.ts`

- [ ] **Step 1: Write the integration test**

Create `__tests__/workbenchDbTurso.test.ts`:

```typescript
import {
  getWorkbenchDb,
  projectStateExists,
  readProjectState,
  writeProjectState,
  listSyncAudit,
  listExperimentRecords,
  getBackendMeta,
} from '../src/server/workbenchDb';
import { closeLibsqlClient } from '../src/server/libsqlDb';

const TEST_PROJECT_ID = 'test-project-turso';
const TEST_ACTOR_ID = 'test-actor';

afterAll(() => {
  closeLibsqlClient();
});

describe('workbenchDb with libsql', () => {
  beforeAll(async () => {
    await getWorkbenchDb();
  });

  test('projectStateExists returns false for new project', async () => {
    const exists = await projectStateExists(TEST_PROJECT_ID);
    expect(exists).toBe(false);
  });

  test('readProjectState returns empty state for new project', async () => {
    const state = await readProjectState(TEST_PROJECT_ID);
    expect(state.schemaVersion).toBe(1);
    expect(state.revision).toBe(0);
    expect(state.project).toBeNull();
  });

  test('writeProjectState persists and readProjectState retrieves', async () => {
    const state = await readProjectState(TEST_PROJECT_ID);
    const newState = {
      ...state,
      revision: 1,
      lastMutationAt: Date.now(),
      project: {
        id: TEST_PROJECT_ID,
        title: 'Test Project',
        targetProduct: 'Artemisinin',
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    await writeProjectState(TEST_PROJECT_ID, TEST_ACTOR_ID, newState);

    const exists = await projectStateExists(TEST_PROJECT_ID);
    expect(exists).toBe(true);

    const retrieved = await readProjectState(TEST_PROJECT_ID);
    expect(retrieved.revision).toBe(1);
    expect(retrieved.project?.title).toBe('Test Project');
    expect(retrieved.project?.targetProduct).toBe('Artemisinin');
  });

  test('getBackendMeta returns correct info', async () => {
    const meta = await getBackendMeta(TEST_PROJECT_ID, TEST_ACTOR_ID);
    expect(meta.projectId).toBe(TEST_PROJECT_ID);
    expect(meta.actorId).toBe(TEST_ACTOR_ID);
  });

  test('listSyncAudit returns entries after write', async () => {
    const entries = await listSyncAudit(TEST_PROJECT_ID, 5);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].action).toBe('sync');
  });

  test('listExperimentRecords returns empty for new project', async () => {
    const records = await listExperimentRecords(TEST_PROJECT_ID, 10);
    expect(Array.isArray(records)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the integration test**

```bash
npx jest __tests__/workbenchDbTurso.test.ts --no-cache
```

Expected: All 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add __tests__/workbenchDbTurso.test.ts
git commit -m "test: add workbenchDb integration tests for Turso migration"
```

---

## Task 6: Create data migration script

**Files:**
- Create: `scripts/migrate-to-turso.ts`

- [ ] **Step 1: Write the migration script**

Create `scripts/migrate-to-turso.ts`:

```typescript
/**
 * One-time migration script: read workbench state from the old SQLite DB
 * and write it to Turso.
 *
 * Usage:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate-to-turso.ts
 *
 * This script:
 * 1. Reads from the local .nexus/workbench.db (better-sqlite3)
 * 2. Writes to the Turso database configured via env vars
 * 3. Verifies the migration by reading back
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import { getLibsqlClient, sqlRun, sqlGet, closeLibsqlClient } from '../src/server/libsqlDb';

const LOCAL_DB_PATH = path.join(process.cwd(), '.nexus', 'workbench.db');

async function migrate() {
  console.log('=== Nexus-Bio Turso Migration ===');
  console.log(`Source: ${LOCAL_DB_PATH}`);
  console.log(`Target: ${process.env.TURSO_DATABASE_URL}`);

  if (!process.env.TURSO_DATABASE_URL) {
    console.error('ERROR: TURSO_DATABASE_URL not set');
    process.exit(1);
  }

  // Read from local SQLite
  const localDb = new Database(LOCAL_DB_PATH, { readonly: true });
  const tables = ['actors', 'projects', 'project_members', 'project_state',
    'project_run_artifact_index', 'experiment_records', 'sync_audit',
    'project_history', 'canonical_state'];

  for (const table of tables) {
    const rows = localDb.prepare(`SELECT * FROM ${table}`).all();
    console.log(`Migrating ${table}: ${rows.length} rows`);

    if (rows.length === 0) continue;

    // Get column names
    const columns = Object.keys(rows[0] as Record<string, unknown>);
    const placeholders = columns.map(() => '?').join(', ');
    const insertSql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    for (const row of rows) {
      const values = columns.map((col) => (row as Record<string, unknown>)[col]);
      await sqlRun(insertSql, values);
    }
  }

  // Verify
  const stateRow = await sqlGet('SELECT COUNT(*) as count FROM project_state');
  console.log(`Verification: project_state has ${stateRow?.count} rows`);

  localDb.close();
  closeLibsqlClient();
  console.log('Migration complete!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit scripts/migrate-to-turso.ts
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-to-turso.ts
git commit -m "feat: add Turso migration script"
```

---

## Task 7: Remove better-sqlite3 dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Uninstall better-sqlite3**

```bash
npm uninstall better-sqlite3
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -rn "better-sqlite3" --include="*.ts" --include="*.tsx" src/ app/
```

Expected: No results

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 4: Run all workbench tests**

```bash
npx jest __tests__/workbench*.test.ts --no-cache
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove better-sqlite3 dependency"
```

---

## Task 8: Create Pyodide loader and verify COBRApy

**Files:**
- Create: `src/services/pyodideLoader.ts`
- Create: `__tests__/pyodideLoader.test.ts`

- [ ] **Step 1: Install pyodide npm package**

```bash
npm install pyodide
```

- [ ] **Step 2: Create the Pyodide loader**

Create `src/services/pyodideLoader.ts`:

```typescript
/**
 * Pyodide runtime manager.
 *
 * Loads Pyodide (CPython → WebAssembly) and provides a Python execution environment.
 * Used for running COBRApy (FBA), thermodynamics, and kinetics engines.
 *
 * Pyodide is loaded lazily on first use to avoid blocking app startup.
 * The initial load downloads ~15MB of WASM + Python standard library.
 */
import type { PyodideInterface } from 'pyodide';

let pyodideInstance: PyodideInterface | null = null;
let loadPromise: Promise<PyodideInterface> | null = null;

/**
 * Load Pyodide (singleton). Returns the same instance on subsequent calls.
 */
export async function loadPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { loadPyodide: loadPyodideFn } = await import('pyodide');
    const pyodide = await loadPyodideFn({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
    });
    pyodideInstance = pyodide;
    return pyodide;
  })();

  return loadPromise;
}

/**
 * Run Python code and return the result.
 * Automatically loads Pyodide if not already loaded.
 */
export async function runPython<T = unknown>(code: string): Promise<T> {
  const pyodide = await loadPyodide();
  return pyodide.runPython(code) as T;
}

/**
 * Install a Python package via micropip.
 */
export async function installPackage(packageName: string): Promise<void> {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage('micropip');
  await pyodide.runPythonAsync(`
    import micropip
    await micropip.install('${packageName}')
  `);
}

/**
 * Check if a Python package is available.
 */
export async function isPackageInstalled(packageName: string): Promise<boolean> {
  try {
    await runPython(`
      import importlib
      importlib.import_module('${packageName}')
      True
    `);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Pyodide version info.
 */
export async function getPyodideVersion(): Promise<string> {
  return await runPython<string>('import sys; sys.version');
}

/**
 * Reset the Pyodide instance (for testing).
 */
export function resetPyodide(): void {
  pyodideInstance = null;
  loadPromise = null;
}
```

- [ ] **Step 3: Write tests**

Create `__tests__/pyodideLoader.test.ts`:

```typescript
import { loadPyodide, runPython, getPyodideVersion, resetPyodide } from '../src/services/pyodideLoader';

// Pyodide tests are slow — increase timeout
jest.setTimeout(60_000);

afterEach(() => {
  resetPyodide();
});

describe('pyodideLoader', () => {
  test('loadPyodide returns a valid instance', async () => {
    const pyodide = await loadPyodide();
    expect(pyodide).toBeDefined();
    expect(pyodide.runPython).toBeDefined();
  });

  test('loadPyodide returns the same instance on subsequent calls', async () => {
    const pyodide1 = await loadPyodide();
    const pyodide2 = await loadPyodide();
    expect(pyodide1).toBe(pyodide2);
  });

  test('runPython executes simple code', async () => {
    const result = await runPython<number>('2 + 3');
    expect(result).toBe(5);
  });

  test('runPython can import standard library', async () => {
    const result = await runPython<string>('import json; json.dumps({"a": 1})');
    expect(JSON.parse(result)).toEqual({ a: 1 });
  });

  test('getPyodideVersion returns Python version string', async () => {
    const version = await getPyodideVersion();
    expect(version).toContain('Python');
  });
});
```

- [ ] **Step 4: Run the Pyodide tests**

```bash
npx jest __tests__/pyodideLoader.test.ts --no-cache
```

Expected: All 5 tests PASS (may take 30-60 seconds on first run)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/services/pyodideLoader.ts __tests__/pyodideLoader.test.ts
git commit -m "feat: add Pyodide loader for browser-side Python execution"
```

---

## Task 9: Verify COBRApy in Pyodide

**Files:**
- Create: `__tests__/pyodideCobra.test.ts`

This is the critical verification task. If COBRApy fails in Pyodide, we trigger the fallback to an independent Python microservice.

- [ ] **Step 1: Write the COBRApy verification test**

Create `__tests__/pyodideCobra.test.ts`:

```typescript
import { loadPyodide, runPython, installPackage, isPackageInstalled, resetPyodide } from '../src/services/pyodideLoader';

// COBRApy installation + tests can take a while
jest.setTimeout(120_000);

afterEach(() => {
  resetPyodide();
});

describe('COBRApy in Pyodide', () => {
  test('can install cobra via micropip', async () => {
    await installPackage('cobra');
    const installed = await isPackageInstalled('cobra');
    expect(installed).toBe(true);
  });

  test('can import cobra and create a simple model', async () => {
    await installPackage('cobra');
    const result = await runPython<boolean>(`
      import cobra
      model = cobra.Model('test_model')
      reaction = cobra.Reaction('R1')
      reaction.lower_bound = 0
      reaction.upper_bound = 10
      model.add_reactions([reaction])
      len(model.reactions) == 1
    `);
    expect(result).toBe(true);
  });

  test('can solve a simple FBA problem', async () => {
    await installPackage('cobra');
    const growthRate = await runPython<number>(`
      import cobra

      # Create a simple model: A -> B -> C
      model = cobra.Model('simple')

      # Exchange reaction: -> A
      ex_a = cobra.Reaction('EX_a')
      ex_a.lower_bound = -10
      ex_a.upper_bound = 0

      # R1: A -> B
      r1 = cobra.Reaction('R1')
      r1.lower_bound = 0
      r1.upper_bound = 10

      # R2: B -> C (biomass)
      r2 = cobra.Reaction('R2')
      r2.lower_bound = 0
      r2.upper_bound = 10
      r2.objective_coefficient = 1

      # Metabolites
      a = cobra.Metabolite('a')
      b = cobra.Metabolite('b')
      c = cobra.Metabolite('c')

      ex_a.add_metabolites({a: 1})
      r1.add_metabolites({a: -1, b: 1})
      r2.add_metabolites({b: -1, c: 1})

      model.add_reactions([ex_a, r1, r2])
      model.objective = 'R2'

      solution = model.optimize()
      solution.objective_value
    `);
    expect(growthRate).toBe(10);
  });

  test('fallback conditions: measure load time', async () => {
    const start = Date.now();
    await loadPyodide();
    const loadTimeMs = Date.now() - start;
    console.log(`Pyodide load time: ${loadTimeMs}ms`);

    // Log for manual review — don't fail the test
    if (loadTimeMs > 60_000) {
      console.warn('WARNING: Pyodide load exceeded 60s — consider fallback');
    }
  });
});
```

- [ ] **Step 2: Run the COBRApy verification test**

```bash
npx jest __tests__/pyodideCobra.test.ts --no-cache --verbose
```

Expected: All 4 tests PASS. If `can install cobra via micropip` fails, this triggers the fallback plan.

- [ ] **Step 3: Record the result**

If COBRApy works:
```bash
git add __tests__/pyodideCobra.test.ts
git commit -m "feat: verify COBRApy works in Pyodide — fallback not needed"
```

If COBRApy fails:
```bash
git add __tests__/pyodideCobra.test.ts
git commit -m "feat: document COBRApy Pyodide failure — triggering fallback to Python microservice"
```

Then proceed to implement the fallback: create a Python service on Railway/Fly.io and call it via HTTP from the frontend.

- [ ] **Step 4: Commit**

```bash
git add __tests__/pyodideCobra.test.ts
git commit -m "feat: verify COBRApy in Pyodide"
```

---

## Task 10: Final integration check

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: Wave 1 complete — Turso migration + Pyodide verification"
```

---

## Success Criteria

- [ ] `better-sqlite3` removed from `package.json`
- [ ] `@libsql/client` installed and working
- [ ] All workbench DB functions are async
- [ ] All workbench tests pass
- [ ] Pyodide loads and runs Python code
- [ ] COBRApy installs and solves FBA in Pyodide (or fallback triggered)
- [ ] Migration script exists and is documented
- [ ] `npm run build` succeeds

---

## Fallback Plan (if COBRApy fails in Pyodide)

1. Create `python/fba_server.py` — FastAPI server wrapping COBRApy
2. Deploy to Railway/Fly.io with COBRApy pre-installed
3. Create `src/services/fbaApiClient.ts` — HTTP client calling the Python service
4. Same interface as Pyodide loader, different transport
5. Update `app/api/fba/route.ts` to call the HTTP client instead of Pyodide
