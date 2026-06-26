/**
 * LIMS API Route
 *
 * GET  /api/lims         — List configured LIMS connections
 * POST /api/lims         — Add new LIMS connection config
 * POST /api/lims/sync    — Trigger sync for a connection
 *
 * Runtime: Node.js (uses crypto for credential hashing)
 */

import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { LIMSConfig, LIMSSyncAuditEntry } from '../../../src/services/lims/types';
import { BenchlingClient } from '../../../src/services/lims/benchlingClient';
import { GenericLIMSAdapter } from '../../../src/services/lims/genericAdapter';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── In-memory store (replace with DB in production) ──

const connections = new Map<string, LIMSConfig>();
const syncAudit: LIMSSyncAuditEntry[] = [];

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/**
 * GET /api/lims — List all configured LIMS connections.
 * Returns configs with credentials redacted.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const configId = url.searchParams.get('id');

  if (configId) {
    const config = connections.get(configId);
    if (!config) {
      return NextResponse.json(
        { ok: false, error: `Connection not found: ${configId}` },
        { status: 404, headers: getCorsHeaders(request) },
      );
    }
    return NextResponse.json(
      { ok: true, connection: redactConfig(config) },
      { headers: getCorsHeaders(request) },
    );
  }

  const all = Array.from(connections.values()).map(redactConfig);
  return NextResponse.json(
    { ok: true, connections: all, syncAudit: syncAudit.slice(-20) },
    { headers: getCorsHeaders(request) },
  );
}

/**
 * POST /api/lims — Add a new LIMS connection.
 * Body: LIMSConfig (without id — server generates it)
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Route to sync handler
  if (action === 'sync') {
    return handleSync(request);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body' },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const { name, type, baseUrl, authType, credentials, syncDirection } =
    body as Record<string, unknown>;

  // Validate required fields
  if (!name || typeof name !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'Missing required field: name' },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }
  if (!type || !['benchling', 'labarchives', 'rspace', 'generic'].includes(type as string)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid type — must be benchling, labarchives, rspace, or generic' },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }
  if (!baseUrl || typeof baseUrl !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'Missing required field: baseUrl' },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }
  if (!authType || !['api_key', 'oauth2', 'basic'].includes(authType as string)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid authType — must be api_key, oauth2, or basic' },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const config: LIMSConfig = {
    id: randomUUID(),
    name: name as string,
    type: type as LIMSConfig['type'],
    baseUrl: baseUrl as string,
    authType: authType as LIMSConfig['authType'],
    credentials: (credentials as Record<string, string>) ?? {},
    syncDirection: (syncDirection as LIMSConfig['syncDirection']) ?? 'pull',
  };

  connections.set(config.id, config);

  return NextResponse.json(
    { ok: true, connection: redactConfig(config) },
    { status: 201, headers: getCorsHeaders(request) },
  );
}

/**
 * Handle sync request — POST /api/lims?action=sync
 */
async function handleSync(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body' },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const { configId, entityType, since, endpoint } = body as Record<string, unknown>;

  if (!configId || typeof configId !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'Missing required field: configId' },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const config = connections.get(configId);
  if (!config) {
    return NextResponse.json(
      { ok: false, error: `Connection not found: ${configId}` },
      { status: 404, headers: getCorsHeaders(request) },
    );
  }

  const startTime = Date.now();

  try {
    let result;

    if (config.type === 'benchling') {
      const client = new BenchlingClient(config);
      // For benchling, sync specific entity types
      const entities = await client.getCustomEntities(
        (entityType as string) ?? 'default',
      );
      result = {
        direction: config.syncDirection,
        entityType: (entityType as string) ?? 'default',
        pushed: 0,
        pulled: entities.length,
        updated: 0,
        errors: [],
        syncedAt: new Date().toISOString(),
      };
    } else {
      const adapter = new GenericLIMSAdapter(config);
      result = await adapter.sync({
        direction: config.syncDirection,
        entityType: (entityType as string) ?? 'entities',
        since: since as string | undefined,
        endpoint: endpoint as string | undefined,
      });
    }

    // Update last sync timestamp
    config.lastSyncAt = result.syncedAt;
    connections.set(config.id, config);

    // Record audit entry
    const auditEntry: LIMSSyncAuditEntry = {
      id: randomUUID(),
      configId: config.id,
      direction: result.direction,
      entityType: result.entityType,
      timestamp: result.syncedAt,
      pushed: result.pushed,
      pulled: result.pulled,
      errors: result.errors.length,
      duration: Date.now() - startTime,
    };
    syncAudit.push(auditEntry);

    return NextResponse.json(
      { ok: true, result, audit: auditEntry },
      { headers: getCorsHeaders(request) },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 502, headers: getCorsHeaders(request) },
    );
  }
}

/**
 * Redact credentials from a config for safe API responses.
 */
function redactConfig(config: LIMSConfig): Omit<LIMSConfig, 'credentials'> & { credentialsHash: string } {
  const hash = createHash('sha256')
    .update(JSON.stringify(config.credentials))
    .digest('hex')
    .slice(0, 16);

  const { credentials: _creds, ...rest } = config;
  return {
    ...rest,
    credentialsHash: hash,
  };
}
