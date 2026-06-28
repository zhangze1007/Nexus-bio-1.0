/**
 * SSO Service — SAML Configuration Management for Nexus-Bio
 *
 * Manages SSO configuration per organization. This is a preparation layer:
 * stores SAML provider metadata and generates data-model-level SAML request
 * structures. Actual SAML XML parsing/signing is deferred to a future integration
 * with a library like `@node-saml/node-saml`.
 *
 * Config is stored in a `sso_configs` table via libsql.
 *
 * Supports:
 *   - Per-org SAML provider configuration
 *   - SAML AuthnRequest generation (data model)
 *   - SAML Response validation stub (data model)
 *   - Enable/disable SSO per org
 */

import { sqlAll, sqlGet, sqlRun } from "../../lib/db";

// ─── Types ────────────────────────────────────────────────────────────────

export interface SSOConfig {
  id: string;
  org_id: string;
  provider: string;
  metadata_url: string;
  entity_id: string;
  acs_url: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SSOConfigInput {
  provider: string;
  metadata_url: string;
  entity_id: string;
  acs_url: string;
  enabled?: boolean;
}

export interface SAMLRequest {
  id: string;
  issue_instant: string;
  destination: string;
  issuer: string;
  acs_url: string;
  org_id: string;
  name_id_policy: string;
}

export interface SAMLResult {
  valid: boolean;
  org_id?: string;
  name_id?: string;
  session_index?: string;
  attributes?: Record<string, string>;
  error?: string;
}

// ─── Schema initialization ────────────────────────────────────────────────

let schemaReady = false;

export async function ensureSSOSchema(): Promise<void> {
  if (schemaReady) return;
  await sqlRun(`
    CREATE TABLE IF NOT EXISTS sso_configs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      metadata_url TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      acs_url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await sqlRun(`
    CREATE INDEX IF NOT EXISTS idx_sso_configs_org_id ON sso_configs (org_id)
  `);
  schemaReady = true;
}

// ─── Row mapper ───────────────────────────────────────────────────────────

function rowToSSOConfig(row: Record<string, unknown>): SSOConfig {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    provider: String(row.provider),
    metadata_url: String(row.metadata_url),
    entity_id: String(row.entity_id),
    acs_url: String(row.acs_url),
    enabled: Number(row.enabled) === 1,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Get the SSO configuration for an organization.
 *
 * Returns the config if one exists, or `undefined` if the org has no SSO setup.
 */
export async function getSSOConfig(orgId: string): Promise<SSOConfig | undefined> {
  await ensureSSOSchema();
  const row = await sqlGet("SELECT * FROM sso_configs WHERE org_id = ?", [orgId]);
  return row ? rowToSSOConfig(row) : undefined;
}

/**
 * Create or update the SSO configuration for an organization.
 *
 * Uses an upsert so the caller does not need to know whether a config
 * already exists. Returns the full persisted config.
 */
export async function updateSSOConfig(orgId: string, input: SSOConfigInput): Promise<SSOConfig> {
  await ensureSSOSchema();

  const now = new Date().toISOString();
  const existing = await getSSOConfig(orgId);

  if (existing) {
    await sqlRun(
      `UPDATE sso_configs
       SET provider = ?, metadata_url = ?, entity_id = ?, acs_url = ?, enabled = ?, updated_at = ?
       WHERE org_id = ?`,
      [input.provider, input.metadata_url, input.entity_id, input.acs_url, input.enabled ? 1 : 0, now, orgId],
    );
  } else {
    await sqlRun(
      `INSERT INTO sso_configs (id, org_id, provider, metadata_url, entity_id, acs_url, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        orgId,
        input.provider,
        input.metadata_url,
        input.entity_id,
        input.acs_url,
        input.enabled ? 1 : 0,
        now,
        now,
      ],
    );
  }

  const updated = await getSSOConfig(orgId);
  // Should always exist after insert/update
  return updated!;
}

/**
 * List all SSO configurations across all organizations.
 *
 * Useful for admin dashboards. Returns an empty array when no orgs have SSO.
 */
export async function listSSOConfigs(): Promise<SSOConfig[]> {
  await ensureSSOSchema();
  const rows = await sqlAll("SELECT * FROM sso_configs ORDER BY created_at ASC");
  return rows.map(rowToSSOConfig);
}

/**
 * Delete the SSO configuration for an organization.
 *
 * Returns `true` if a row was deleted, `false` if no config existed.
 */
export async function deleteSSOConfig(orgId: string): Promise<boolean> {
  await ensureSSOSchema();
  const result = await sqlRun("DELETE FROM sso_configs WHERE org_id = ?", [orgId]);
  return result.rowsAffected > 0;
}

/**
 * Generate a SAML AuthnRequest data structure for an organization.
 *
 * This produces the data model that would be serialized into a SAML XML
 * AuthnRequest. Actual XML generation is deferred to a future integration.
 *
 * The `destination` is taken from the org's configured `acs_url`.
 * The `issuer` is taken from the org's configured `entity_id`.
 */
export async function generateSAMLRequest(orgId: string): Promise<SAMLRequest> {
  const config = await getSSOConfig(orgId);

  if (!config) {
    throw new Error(`No SSO configuration found for organization "${orgId}"`);
  }

  if (!config.enabled) {
    throw new Error(`SSO is disabled for organization "${orgId}"`);
  }

  return {
    id: `_${crypto.randomUUID()}`,
    issue_instant: new Date().toISOString(),
    destination: config.acs_url,
    issuer: config.entity_id,
    acs_url: config.acs_url,
    org_id: orgId,
    name_id_policy: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  };
}

/**
 * Validate a SAML Response data structure.
 *
 * This is a stub that performs structural validation on the data model.
 * Actual XML signature verification and assertion parsing is deferred to
 * a future integration with a SAML library.
 *
 * The `response` parameter is expected to be a parsed SAML response object
 * with at minimum: `in_response_to`, `status`, and `assertion` fields.
 */
export async function validateSAMLResponse(response: Record<string, unknown>): Promise<SAMLResult> {
  if (!response || typeof response !== "object") {
    return { valid: false, error: "Response must be a non-null object" };
  }

  // Check required top-level fields
  const status = response.status as string | undefined;
  if (!status) {
    return { valid: false, error: "Missing required field: status" };
  }

  if (status !== "success") {
    return { valid: false, error: `SAML status is not success: "${status}"` };
  }

  const assertion = response.assertion as Record<string, unknown> | undefined;
  if (!assertion || typeof assertion !== "object") {
    return { valid: false, error: "Missing or invalid assertion in SAML response" };
  }

  const nameId = assertion.name_id as string | undefined;
  if (!nameId) {
    return { valid: false, error: "Missing name_id in assertion" };
  }

  // Extract attributes if present
  const rawAttrs = assertion.attributes as Record<string, string> | undefined;
  const attributes: Record<string, string> = rawAttrs && typeof rawAttrs === "object" ? { ...rawAttrs } : {};

  // Resolve org_id from the issuer if available
  const issuer = assertion.issuer as string | undefined;
  let orgId: string | undefined;

  if (issuer) {
    const rows = await sqlAll("SELECT org_id FROM sso_configs WHERE entity_id = ?", [issuer]);
    if (rows.length > 0) {
      orgId = String(rows[0].org_id);
    }
  }

  return {
    valid: true,
    org_id: orgId,
    name_id: nameId,
    session_index: assertion.session_index as string | undefined,
    attributes,
  };
}
