/** @jest-environment node */
import {
  createExperiment,
  updateExperimentStatus,
  addExperimentData,
  getExperimentTimeline,
  ensureExperimentTrackerSchema,
  type Experiment,
  type ExperimentStatus,
} from '../src/services/instruments/experimentTracker';
import { sqlAll, sqlGet, sqlRun, closeLibsqlClient } from '../src/server/libsqlDb';

afterAll(() => {
  closeLibsqlClient();
});

describe('experimentTracker', () => {
  beforeEach(async () => {
    // Clean tables in dependency order
    await sqlRun('DELETE FROM lab_experiment_data').catch(() => {});
    await sqlRun('DELETE FROM lab_experiments').catch(() => {});
    await ensureExperimentTrackerSchema();
  });

  afterEach(async () => {
    await sqlRun('DELETE FROM lab_experiment_data').catch(() => {});
    await sqlRun('DELETE FROM lab_experiments').catch(() => {});
  });

  // ── createExperiment ──────────────────────────────────────────

  test('createExperiment returns a valid experiment record', async () => {
    const exp = await createExperiment('Titer screen A', 'proto-1', 'proj-1', 'alice');

    expect(exp.id).toBeDefined();
    expect(exp.name).toBe('Titer screen A');
    expect(exp.protocol_id).toBe('proto-1');
    expect(exp.project_id).toBe('proj-1');
    expect(exp.status).toBe('planned');
    expect(exp.started_at).toBeNull();
    expect(exp.completed_at).toBeNull();
    expect(exp.created_by).toBe('alice');
  });

  test('createExperiment defaults created_by to "system"', async () => {
    const exp = await createExperiment('Default user test', 'proto-2', 'proj-2');
    expect(exp.created_by).toBe('system');
  });

  test('createExperiment persists to the database', async () => {
    const exp = await createExperiment('Persistence check', 'proto-3', 'proj-3');

    const row = await sqlGet('SELECT * FROM lab_experiments WHERE id = ?', [exp.id]);
    expect(row).toBeDefined();
    expect(row!.name).toBe('Persistence check');
    expect(row!.status).toBe('planned');
  });

  test('createExperiment records a timeline event', async () => {
    const exp = await createExperiment('Timeline seed', 'proto-4', 'proj-4');

    const events = await getExperimentTimeline(exp.id);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('created');
    expect(events[0].details).toContain('Timeline seed');
  });

  test('createExperiment rejects empty name', async () => {
    await expect(createExperiment('', 'proto-5', 'proj-5')).rejects.toThrow(
      'Experiment name must not be empty',
    );
  });

  test('createExperiment rejects empty protocol ID', async () => {
    await expect(createExperiment('Test', '', 'proj-6')).rejects.toThrow(
      'Protocol ID must not be empty',
    );
  });

  test('createExperiment rejects empty project ID', async () => {
    await expect(createExperiment('Test', 'proto-7', '')).rejects.toThrow(
      'Project ID must not be empty',
    );
  });

  // ── updateExperimentStatus ────────────────────────────────────

  test('updateExperimentStatus transitions to running and sets started_at', async () => {
    const exp = await createExperiment('Run test', 'proto-8', 'proj-8');

    await updateExperimentStatus(exp.id, 'running');

    const row = await sqlGet('SELECT * FROM lab_experiments WHERE id = ?', [exp.id]);
    expect(row!.status).toBe('running');
    expect(row!.started_at).not.toBeNull();
    expect(Number(row!.started_at)).toBeGreaterThan(0);
  });

  test('updateExperimentStatus transitions to completed and sets completed_at', async () => {
    const exp = await createExperiment('Complete test', 'proto-9', 'proj-9');
    await updateExperimentStatus(exp.id, 'running');
    await updateExperimentStatus(exp.id, 'completed');

    const row = await sqlGet('SELECT * FROM lab_experiments WHERE id = ?', [exp.id]);
    expect(row!.status).toBe('completed');
    expect(row!.completed_at).not.toBeNull();
  });

  test('updateExperimentStatus records a timeline event', async () => {
    const exp = await createExperiment('Status event test', 'proto-10', 'proj-10');

    await updateExperimentStatus(exp.id, 'running');

    const events = await getExperimentTimeline(exp.id);
    // Should have "created" + "status_change"
    expect(events).toHaveLength(2);
    expect(events[1].event_type).toBe('status_change');
    expect(events[1].details).toContain('running');
  });

  test('updateExperimentStatus rejects invalid status', async () => {
    const exp = await createExperiment('Bad status test', 'proto-11', 'proj-11');

    await expect(
      updateExperimentStatus(exp.id, 'invalid_status' as ExperimentStatus),
    ).rejects.toThrow('Invalid status');
  });

  test('updateExperimentStatus rejects nonexistent experiment', async () => {
    await expect(
      updateExperimentStatus('nonexistent-id', 'running'),
    ).rejects.toThrow('Experiment not found');
  });

  // ── addExperimentData ─────────────────────────────────────────

  test('addExperimentData attaches a key-value pair', async () => {
    const exp = await createExperiment('Data test', 'proto-12', 'proj-12');

    await addExperimentData(exp.id, 'temperature_C', '37');

    const row = await sqlGet(
      'SELECT * FROM lab_experiment_data WHERE experiment_id = ? AND key = ?',
      [exp.id, 'temperature_C'],
    );
    expect(row).toBeDefined();
    expect(row!.value).toBe('37');
  });

  test('addExperimentData upserts existing key', async () => {
    const exp = await createExperiment('Upsert test', 'proto-13', 'proj-13');

    await addExperimentData(exp.id, 'titer', '100');
    await addExperimentData(exp.id, 'titer', '250');

    const rows = await sqlAll(
      'SELECT * FROM lab_experiment_data WHERE experiment_id = ? AND key = ?',
      [exp.id, 'titer'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('250');
  });

  test('addExperimentData rejects empty key', async () => {
    const exp = await createExperiment('Empty key test', 'proto-14', 'proj-14');

    await expect(addExperimentData(exp.id, '', 'val')).rejects.toThrow(
      'Data key must not be empty',
    );
  });

  test('addExperimentData rejects nonexistent experiment', async () => {
    await expect(
      addExperimentData('nonexistent-id', 'key', 'value'),
    ).rejects.toThrow('Experiment not found');
  });

  // ── getExperimentTimeline ─────────────────────────────────────

  test('getExperimentTimeline returns all events in chronological order', async () => {
    const exp = await createExperiment('Timeline order test', 'proto-15', 'proj-15');

    // Use distinct keys so each data event creates a new row (upsert would overwrite same key)
    await addExperimentData(exp.id, 'step_1', '1');
    await updateExperimentStatus(exp.id, 'running');
    await addExperimentData(exp.id, 'step_2', '2');
    await updateExperimentStatus(exp.id, 'completed');

    const events = await getExperimentTimeline(exp.id);
    expect(events.length).toBeGreaterThanOrEqual(5);

    // Verify chronological order
    for (let i = 1; i < events.length; i++) {
      expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i - 1].timestamp);
    }

    // First event should be creation
    expect(events[0].event_type).toBe('created');
  });

  test('getExperimentTimeline rejects nonexistent experiment', async () => {
    await expect(getExperimentTimeline('nonexistent-id')).rejects.toThrow(
      'Experiment not found',
    );
  });

  // ── Full lifecycle ────────────────────────────────────────────

  test('full experiment lifecycle: create, run, add data, complete', async () => {
    const exp = await createExperiment(
      'Full lifecycle run',
      'proto-final',
      'proj-final',
      'researcher-1',
    );
    expect(exp.status).toBe('planned');

    await updateExperimentStatus(exp.id, 'running');
    await addExperimentData(exp.id, 'OD600', '0.85');
    await addExperimentData(exp.id, 'glucose_g_per_L', '12.5');
    await addExperimentData(exp.id, 'product_titer_mg_per_L', '340');
    await updateExperimentStatus(exp.id, 'completed');

    // Verify final state
    const row = await sqlGet('SELECT * FROM lab_experiments WHERE id = ?', [exp.id]);
    expect(row!.status).toBe('completed');
    expect(row!.started_at).not.toBeNull();
    expect(row!.completed_at).not.toBeNull();

    // Verify all timeline events
    const timeline = await getExperimentTimeline(exp.id);
    const eventTypes = timeline.map((e) => e.event_type);
    expect(eventTypes).toContain('created');
    expect(eventTypes).toContain('status_change');
    expect(eventTypes.filter((t) => t === 'status_change')).toHaveLength(2);

    // Verify data was recorded
    const dataEvents = timeline.filter((e) => e.key === 'product_titer_mg_per_L');
    expect(dataEvents).toHaveLength(1);
    expect(dataEvents[0].value).toBe('340');
  });
});
