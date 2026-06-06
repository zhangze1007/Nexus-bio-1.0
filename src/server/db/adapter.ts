/**
 * Database Adapter — Abstraction layer for SQLite (local) and Turso (production)
 *
 * Usage:
 *   import { getDb } from './db/adapter';
 *   const db = getDb();
 *   db.exec('SELECT ...');
 *
 * Environment variables for Turso:
 *   TURSO_DATABASE_URL=libsql://your-db.turso.io
 *   TURSO_AUTH_TOKEN=your-auth-token
 */

export interface DatabaseAdapter {
  exec(sql: string): void;
  prepare(sql: string): PreparedStatement;
  pragma(pragma: string): void;
  close(): void;
}

export interface PreparedStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

let cachedDb: DatabaseAdapter | null = null;

/**
 * Get a database instance. Uses Turso if TURSO_DATABASE_URL is set,
 * otherwise falls back to local SQLite via better-sqlite3.
 */
export function getDb(): DatabaseAdapter {
  if (cachedDb) return cachedDb;

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    // Turso (production)
    cachedDb = createTursoAdapter(tursoUrl, tursoToken);
  } else {
    // Local SQLite (development)
    cachedDb = createSqliteAdapter();
  }

  return cachedDb;
}

function createSqliteAdapter(): DatabaseAdapter {
  // Dynamic import to avoid bundling better-sqlite3 in Edge Runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  const path = require('path');
  const fs = require('fs');

  const dbDir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const dbPath = path.join(dbDir, 'workbench.db');
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  return {
    exec: (sql: string) => db.exec(sql),
    prepare: (sql: string) => {
      const stmt = db.prepare(sql);
      return {
        run: (...params: unknown[]) => stmt.run(...params),
        get: (...params: unknown[]) => stmt.get(...params),
        all: (...params: unknown[]) => stmt.all(...params),
      };
    },
    pragma: (pragma: string) => db.pragma(pragma),
    close: () => db.close(),
  };
}

function createTursoAdapter(url: string, authToken: string): DatabaseAdapter {
  // Dynamic import to avoid bundling @libsql/client in Edge Runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@libsql/client');
  const client = createClient({ url, authToken });

  return {
    exec: (sql: string) => {
      client.execute(sql);
    },
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        const result = client.execute({ sql, args: params as unknown[] });
        return {
          changes: result.rowsAffected,
          lastInsertRowid: result.lastInsertRowid ?? 0,
        };
      },
      get: (...params: unknown[]) => {
        const result = client.execute({ sql, args: params as unknown[] });
        return result.rows[0] as Record<string, unknown> | undefined;
      },
      all: (...params: unknown[]) => {
        const result = client.execute({ sql, args: params as unknown[] });
        return result.rows as Record<string, unknown>[];
      },
    }),
    pragma: () => { /* Turso handles pragmas automatically */ },
    close: () => { client.close(); },
  };
}
