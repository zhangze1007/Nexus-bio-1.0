/** @jest-environment node */
/**
 * workbenchDbTurso — integration tests for the Turso/libSQL workbenchDb layer.
 *
 * Verifies full round-trip: schema init → write state → read it back →
 * metadata and audit entries. Uses a local file-based SQLite database
 * (the default when TURSO_DATABASE_URL is not set).
 */
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
        status: 'draft' as const,
        summary: '',
        isDemo: false,
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
