import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../src/lib/auth';
import { getLibsqlClient } from '../../../src/lib/db';
import { generateApiKey } from '../../../src/utils/apiKeys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/keys — List the authenticated user's API keys.
 * Returns metadata only (no raw keys or hashes).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = getLibsqlClient();
  const result = await client.execute({
    sql: `SELECT id, name, key_prefix, scopes, expires_at, last_used_at, created_at
          FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
    args: [session.user.id],
  });

  const keys = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ keys });
}

/**
 * POST /api/keys — Create a new API key.
 * Returns the raw key ONCE — it cannot be retrieved later.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, scopes, expiresAt } = body;

  if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
    return NextResponse.json({ error: 'Invalid name (1-100 characters required)' }, { status: 400 });
  }

  const { key, hash, prefix } = generateApiKey();
  const id = randomUUID();

  const client = getLibsqlClient();
  await client.execute({
    sql: `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, scopes, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      session.user.id,
      name,
      hash,
      prefix,
      scopes ? JSON.stringify(scopes) : 'read,write',
      expiresAt || null,
      new Date().toISOString(),
    ],
  });

  // Return the raw key ONCE — it cannot be retrieved later
  return NextResponse.json({ key, prefix, name }, { status: 201 });
}
