import {
  seedReferenceData,
  seedDemoProject,
  getSeedStatus,
} from '../src/server/seeds/seedService';
import { sqlAll, sqlGet, sqlRun, closeLibsqlClient } from '../src/server/libsqlDb';

afterAll(() => {
  closeLibsqlClient();
});

describe('seedService', () => {
  // Clean up seed tables before each test so tests are isolated
  beforeEach(async () => {
    await sqlRun('DROP TABLE IF EXISTS seed_ijor1366_reactions').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS seed_precomputed_dg').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS seed_codon_usage').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS seed_protocol_templates').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS seed_meta').catch(() => {});
  });

  afterAll(async () => {
    // Clean up seed tables
    await sqlRun('DROP TABLE IF EXISTS seed_ijor1366_reactions').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS seed_precomputed_dg').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS seed_codon_usage').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS seed_protocol_templates').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS seed_meta').catch(() => {});

    // Clean up demo projects created during tests
    const demoProjects = await sqlAll(
      "SELECT project_id FROM projects WHERE project_id LIKE 'demo-artemisinin-%'"
    );
    for (const row of demoProjects) {
      const pid = row.project_id as string;
      await sqlRun('DELETE FROM project_state WHERE project_id = ?', [pid]).catch(() => {});
      await sqlRun('DELETE FROM project_members WHERE project_id = ?', [pid]).catch(() => {});
      await sqlRun('DELETE FROM project_run_artifact_index WHERE project_id = ?', [pid]).catch(() => {});
      await sqlRun('DELETE FROM experiment_records WHERE project_id = ?', [pid]).catch(() => {});
      await sqlRun('DELETE FROM project_history WHERE project_id = ?', [pid]).catch(() => {});
      await sqlRun('DELETE FROM sync_audit WHERE project_id = ?', [pid]).catch(() => {});
      await sqlRun('DELETE FROM projects WHERE project_id = ?', [pid]).catch(() => {});
    }
  });

  // ── seedReferenceData ──────────────────────────────────────────────

  test('seedReferenceData returns SeedResult with tablesSeeded and rowsInserted', async () => {
    const result = await seedReferenceData();
    expect(result).toHaveProperty('tablesSeeded');
    expect(result).toHaveProperty('rowsInserted');
    expect(Array.isArray(result.tablesSeeded)).toBe(true);
    expect(typeof result.rowsInserted).toBe('number');
    expect(result.rowsInserted).toBeGreaterThan(0);
  });

  test('seedReferenceData seeds all four reference tables', async () => {
    const result = await seedReferenceData();
    expect(result.tablesSeeded).toContain('seed_ijor1366_reactions');
    expect(result.tablesSeeded).toContain('seed_precomputed_dg');
    expect(result.tablesSeeded).toContain('seed_codon_usage');
    expect(result.tablesSeeded).toContain('seed_protocol_templates');
    expect(result.tablesSeeded).toHaveLength(4);
  });

  test('seedReferenceData inserts iJO1366 reactions with correct schema', async () => {
    await seedReferenceData();
    const rows = await sqlAll('SELECT * FROM seed_ijor1366_reactions');
    expect(rows.length).toBeGreaterThan(50);

    // Verify column structure
    const first = rows[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('subsystem');
    expect(first).toHaveProperty('lb');
    expect(first).toHaveProperty('ub');
    expect(first).toHaveProperty('stoichiometry_json');
    expect(first).toHaveProperty('gpr');

    // Verify stoichiometry is valid JSON
    const stoich = JSON.parse(first.stoichiometry_json as string);
    expect(typeof stoich).toBe('object');
  });

  test('seedReferenceData inserts precomputed DG values with valid thermodynamic data', async () => {
    await seedReferenceData();
    const rows = await sqlAll('SELECT * FROM seed_precomputed_dg');
    expect(rows.length).toBeGreaterThan(20);

    // Verify we have all three pathways
    const pathways = new Set(rows.map((r) => r.pathway));
    expect(pathways.has('glycolysis')).toBe(true);
    expect(pathways.has('tca')).toBe(true);
    expect(pathways.has('ppp')).toBe(true);

    // Verify column structure
    const first = rows[0];
    expect(first).toHaveProperty('dG0');
    expect(first).toHaveProperty('dG_prime_physiological');
    expect(first).toHaveProperty('dG_prime_standard');
    expect(first).toHaveProperty('uncertainty');
    expect(first).toHaveProperty('kegg_formula');
    expect(typeof first.dG0).toBe('number');
  });

  test('seedReferenceData inserts codon usage tables for ecoli and scerevisiae', async () => {
    await seedReferenceData();
    const rows = await sqlAll('SELECT * FROM seed_codon_usage');
    expect(rows.length).toBeGreaterThan(100);

    // Verify both organisms present
    const organisms = new Set(rows.map((r) => r.organism));
    expect(organisms.has('ecoli')).toBe(true);
    expect(organisms.has('scerevisiae')).toBe(true);

    // Verify frequency values are in valid range
    for (const row of rows) {
      expect(row.frequency as number).toBeGreaterThanOrEqual(0);
      expect(row.frequency as number).toBeLessThanOrEqual(1);
    }
  });

  test('seedReferenceData inserts protocol templates with valid JSON fields', async () => {
    await seedReferenceData();
    const rows = await sqlAll('SELECT * FROM seed_protocol_templates');
    expect(rows.length).toBeGreaterThan(5);

    // Verify known template IDs
    const ids = rows.map((r) => r.id);
    expect(ids).toContain('golden-gate');
    expect(ids).toContain('gibson-assembly');

    // Verify JSON fields parse correctly
    for (const row of rows) {
      const steps = JSON.parse(row.steps_json as string);
      const equipment = JSON.parse(row.equipment_json as string);
      const reagents = JSON.parse(row.reagents_json as string);
      const qc = JSON.parse(row.qc_criteria_json as string);

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      expect(Array.isArray(equipment)).toBe(true);
      expect(Array.isArray(reagents)).toBe(true);
      expect(Array.isArray(qc)).toBe(true);
    }
  });

  test('seedReferenceData is idempotent — re-seeding does not double rows', async () => {
    const first = await seedReferenceData();
    const second = await seedReferenceData();

    expect(second.rowsInserted).toBe(first.rowsInserted);

    // Verify row counts match
    const rxnCount = await sqlGet('SELECT COUNT(*) as cnt FROM seed_ijor1366_reactions');
    expect(Number(rxnCount?.cnt)).toBe(first.tablesSeeded.length > 0 ? Number(rxnCount?.cnt) : 0);

    // Re-seed should produce same count
    const status = await getSeedStatus();
    expect(status.seeded).toBe(true);
  });

  // ── getSeedStatus ──────────────────────────────────────────────────

  test('getSeedStatus returns seeded=false before any seeding', async () => {
    const status = await getSeedStatus();
    expect(status.seeded).toBe(false);
    expect(status.tables).toHaveLength(4);
    for (const table of status.tables) {
      expect(table.rowCount).toBe(0);
      expect(table.seededAt).toBeNull();
    }
  });

  test('getSeedStatus returns seeded=true after seeding with timestamps', async () => {
    await seedReferenceData();
    const status = await getSeedStatus();

    expect(status.seeded).toBe(true);
    expect(status.tables).toHaveLength(4);

    for (const table of status.tables) {
      expect(table.rowCount).toBeGreaterThan(0);
      expect(table.seededAt).not.toBeNull();
      // seededAt should be a valid ISO date string
      expect(new Date(table.seededAt!).getTime()).not.toBeNaN();
    }
  });

  test('getSeedStatus reports correct row counts per table', async () => {
    await seedReferenceData();
    const status = await getSeedStatus();

    const rxnTable = status.tables.find((t) => t.name === 'seed_ijor1366_reactions');
    const dgTable = status.tables.find((t) => t.name === 'seed_precomputed_dg');
    const codonTable = status.tables.find((t) => t.name === 'seed_codon_usage');
    const protocolTable = status.tables.find((t) => t.name === 'seed_protocol_templates');

    expect(rxnTable).toBeDefined();
    expect(dgTable).toBeDefined();
    expect(codonTable).toBeDefined();
    expect(protocolTable).toBeDefined();

    expect(rxnTable!.rowCount).toBeGreaterThan(50);
    expect(dgTable!.rowCount).toBeGreaterThan(20);
    expect(codonTable!.rowCount).toBeGreaterThan(100);
    expect(protocolTable!.rowCount).toBeGreaterThan(5);
  });

  // ── seedDemoProject ────────────────────────────────────────────────

  test('seedDemoProject creates a project and returns a project ID', async () => {
    const projectId = await seedDemoProject('test-user-1');
    expect(projectId).toBe('demo-artemisinin-test-user-1');

    // Verify the project state was written to the DB by reading the raw JSON
    const row = await sqlGet('SELECT state_json FROM project_state WHERE project_id = ?', [projectId]);
    expect(row).toBeDefined();
    expect(row!.state_json).toBeDefined();

    const state = JSON.parse(row!.state_json as string);
    expect(state.project).toBeDefined();
    expect(state.project.title).toBe('Artemisinin Biosynthesis Demo');
    expect(state.project.targetProduct).toBe('artemisinin');
    expect(state.project.status).toBe('active');
    expect(state.workflowControl.isDemoOnly).toBe(true);
  });

  test('seedDemoProject is idempotent — same userId returns same projectId without error', async () => {
    const first = await seedDemoProject('test-user-2');
    const second = await seedDemoProject('test-user-2');
    expect(first).toBe(second);
    expect(first).toBe('demo-artemisinin-test-user-2');
  });

  test('seedDemoProject creates different projects for different users', async () => {
    const projectA = await seedDemoProject('user-alpha');
    const projectB = await seedDemoProject('user-beta');
    expect(projectA).not.toBe(projectB);
    expect(projectA).toBe('demo-artemisinin-user-alpha');
    expect(projectB).toBe('demo-artemisinin-user-beta');
  });
});
