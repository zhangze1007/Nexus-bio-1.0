/**
 * Turso (libSQL) database client.
 *
 * Production: connects to Turso via HTTP using TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 * Local development: uses a local SQLite file via file: URL.
 *
 * This replaces better-sqlite3 which is synchronous and ephemeral on Vercel.
 */
import { createClient, type Client, type InArgs, type InStatement } from '@libsql/client';
import fs from 'node:fs';
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

  const url = resolveDbUrl();
  const isRemote = url.startsWith('http');

  // Issue 2: When using a remote Turso URL, TURSO_AUTH_TOKEN must be present.
  if (isRemote && !process.env.TURSO_AUTH_TOKEN) {
    throw new Error(
      'TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing. ' +
      'Both environment variables are required for a remote Turso connection.',
    );
  }

  // Issue 1: Ensure the parent directory exists for local file-based databases.
  if (!isRemote) {
    const dbDir = path.dirname(LOCAL_DB_PATH);
    fs.mkdirSync(dbDir, { recursive: true });
  }

  singletonClient = createClient({
    url,
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
