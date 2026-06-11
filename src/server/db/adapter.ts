/**
 * Database Adapter — Abstraction layer for Turso (libSQL)
 *
 * Usage:
 *   import { getDb } from './db/adapter';
 *   const db = getDb();
 *   db.exec('SELECT ...');
 *
 * Environment variables for Turso:
 *   TURSO_DATABASE_URL=libsql://your-db.turso.io
 *   TURSO_AUTH_TOKEN=your-auth-token
 *
 * Migrated from better-sqlite3 to @libsql/client (Tasks 1-7).
 * For local development without TURSO_DATABASE_URL, use file: URL.
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
 * otherwise falls back to a local file-based SQLite via @libsql/client.
 */
export function getDb(): DatabaseAdapter {
  if (cachedDb) return cachedDb;

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    cachedDb = createTursoAdapter(tursoUrl, tursoToken);
  } else {
    // Local development: file-based SQLite via @libsql/client
    const path = require('path') as typeof import('path');
    const fs = require('fs') as typeof import('fs');
    const dbDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const localUrl = `file:${path.join(dbDir, 'workbench.db')}`;
    cachedDb = createTursoAdapter(localUrl, undefined);
  }

  return cachedDb;
}

function createTursoAdapter(url: string, authToken: string | undefined): DatabaseAdapter {
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
