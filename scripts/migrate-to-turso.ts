/**
 * One-time migration script: read workbench state from the old SQLite DB
 * and write it to Turso.
 *
 * Usage:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate-to-turso.ts
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
