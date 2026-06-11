import { createClient, type Client, type InArgs } from '@libsql/client';
import path from 'path';
import fs from 'fs';

/**
 * Shared database singleton for Nexus-Bio.
 *
 * Migrated from better-sqlite3 (synchronous) to @libsql/client (async).
 *
 * Storage:
 *   Local: .nexus/workbench.db (via file: URL)
 *   Production (Vercel): Turso via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 */

let _client: Client | null = null;

function resolveDbUrl(): string {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) return tursoUrl;
  const isVercel = !!process.env.VERCEL;
  const dbDir = isVercel
    ? path.join('/tmp', '.nexus')
    : path.join(process.cwd(), '.nexus');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return `file:${path.join(dbDir, 'workbench.db')}`;
}

export function getLibsqlClient(): Client {
  if (_client) return _client;

  const url = resolveDbUrl();
  _client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  return _client;
}

/** @deprecated Use getLibsqlClient() + sqlAll/sqlGet/sqlRun instead */
export function getDb() {
  return getLibsqlClient();
}

/**
 * Execute a SQL statement and return all rows.
 * Drop-in async replacement for better-sqlite3's db.prepare(sql).all(...args).
 */
export async function sqlAll(sql: string, args: unknown[] = []): Promise<Record<string, unknown>[]> {
  const client = getLibsqlClient();
  const result = await client.execute({ sql, args: args as InArgs });
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
  const result = await client.execute({ sql, args: args as InArgs });
  return { rowsAffected: result.rowsAffected };
}
