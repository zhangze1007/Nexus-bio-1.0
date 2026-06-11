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
