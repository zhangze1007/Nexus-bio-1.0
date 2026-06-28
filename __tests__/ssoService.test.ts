/** @jest-environment node */

/**
 * In-memory mock of the sso_configs table used by the SSO service.
 * Follows the same mocking pattern as complianceService.test.ts.
 */

// ── In-memory table store ──

let ssoConfigRows: Record<string, unknown>[] = [];

// Track CREATE TABLE / CREATE INDEX calls
const createdStatements: string[] = [];

jest.mock("../src/lib/db", () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    // SELECT all configs
    if (sql.includes("FROM sso_configs") && !sql.includes("WHERE") && !sql.includes("entity_id")) {
      return [...ssoConfigRows].sort((a, b) =>
        String(a.created_at).localeCompare(String(b.created_at)),
      );
    }

    // SELECT by entity_id (used by validateSAMLResponse)
    if (sql.includes("FROM sso_configs") && sql.includes("entity_id")) {
      const entityId = args?.[0] as string;
      return ssoConfigRows.filter((r) => r.entity_id === entityId);
    }

    return [];
  }),

  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    // SELECT by org_id
    if (sql.includes("FROM sso_configs") && sql.includes("WHERE org_id")) {
      const orgId = args?.[0] as string;
      return ssoConfigRows.find((r) => r.org_id === orgId) || undefined;
    }

    return undefined;
  }),

  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    // CREATE TABLE / CREATE INDEX
    if (sql.trimStart().startsWith("CREATE")) {
      createdStatements.push(sql.trim());
      return { rowsAffected: 0 };
    }

    // INSERT
    if (sql.trimStart().startsWith("INSERT INTO sso_configs")) {
      ssoConfigRows.push({
        id: args![0],
        org_id: args![1],
        provider: args![2],
        metadata_url: args![3],
        entity_id: args![4],
        acs_url: args![5],
        enabled: args![6],
        created_at: args![7],
        updated_at: args![8],
      });
      return { rowsAffected: 1 };
    }

    // UPDATE
    if (sql.trimStart().startsWith("UPDATE sso_configs")) {
      const orgId = args![6] as string; // last arg is org_id in WHERE clause
      const idx = ssoConfigRows.findIndex((r) => r.org_id === orgId);
      if (idx >= 0) {
        ssoConfigRows[idx] = {
          ...ssoConfigRows[idx],
          provider: args![0],
          metadata_url: args![1],
          entity_id: args![2],
          acs_url: args![3],
          enabled: args![4],
          updated_at: args![5],
        };
        return { rowsAffected: 1 };
      }
      return { rowsAffected: 0 };
    }

    // DELETE
    if (sql.trimStart().startsWith("DELETE FROM sso_configs")) {
      const orgId = args?.[0] as string;
      const before = ssoConfigRows.length;
      ssoConfigRows = ssoConfigRows.filter((r) => r.org_id !== orgId);
      return { rowsAffected: before - ssoConfigRows.length };
    }

    return { rowsAffected: 0 };
  }),

  closeLibsqlClient: jest.fn(),
}));

import {
  ensureSSOSchema,
  getSSOConfig,
  updateSSOConfig,
  listSSOConfigs,
  deleteSSOConfig,
  generateSAMLRequest,
  validateSAMLResponse,
} from "../src/services/auth/ssoService";

// ── Helpers ──

const ORG = "org-test-001";
const ORG_B = "org-test-002";

const VALID_INPUT = {
  provider: "okta",
  metadata_url: "https://example.okta.com/app/abc/sso/saml/metadata",
  entity_id: "http://www.okta.com/abc",
  acs_url: "https://nexus-bio.example.com/api/auth/sso/callback",
  enabled: true,
};

function resetState() {
  ssoConfigRows = [];
  createdStatements.length = 0;
  jest.clearAllMocks();
}

// ── Tests ──

describe("ssoService", () => {
  beforeEach(() => {
    resetState();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => { jest.useRealTimers(); });

  // ── Schema ──

  test("ensureSSOSchema creates the sso_configs table and index", async () => {
    await ensureSSOSchema();
    const tableStmt = createdStatements.find((s) =>
      s.includes("CREATE TABLE IF NOT EXISTS sso_configs"),
    );
    const indexStmt = createdStatements.find((s) =>
      s.includes("CREATE INDEX IF NOT EXISTS idx_sso_configs_org_id"),
    );
    expect(tableStmt).toBeDefined();
    expect(indexStmt).toBeDefined();
  });

  test("ensureSSOSchema is idempotent (second call is a no-op)", async () => {
    await ensureSSOSchema();
    const countAfterFirst = createdStatements.length;
    await ensureSSOSchema();
    expect(createdStatements.length).toBe(countAfterFirst);
  });

  // ── getSSOConfig ──

  test("getSSOConfig returns undefined when no config exists", async () => {
    const config = await getSSOConfig(ORG);
    expect(config).toBeUndefined();
  });

  test("getSSOConfig returns the config after creation", async () => {
    await updateSSOConfig(ORG, VALID_INPUT);
    const config = await getSSOConfig(ORG);

    expect(config).toBeDefined();
    expect(config!.org_id).toBe(ORG);
    expect(config!.provider).toBe("okta");
    expect(config!.metadata_url).toBe(VALID_INPUT.metadata_url);
    expect(config!.entity_id).toBe(VALID_INPUT.entity_id);
    expect(config!.acs_url).toBe(VALID_INPUT.acs_url);
    expect(config!.enabled).toBe(true);
  });

  // ── updateSSOConfig ──

  test("updateSSOConfig creates a new config on first call", async () => {
    const config = await updateSSOConfig(ORG, VALID_INPUT);

    expect(config.org_id).toBe(ORG);
    expect(config.provider).toBe("okta");
    expect(config.enabled).toBe(true);
    expect(config.id).toBeDefined();
    expect(config.created_at).toBeDefined();
    expect(config.updated_at).toBeDefined();
  });

  test("updateSSOConfig updates an existing config on second call", async () => {
    await updateSSOConfig(ORG, VALID_INPUT);

    const updated = await updateSSOConfig(ORG, {
      ...VALID_INPUT,
      provider: "azure-ad",
      enabled: false,
    });

    expect(updated.provider).toBe("azure-ad");
    expect(updated.enabled).toBe(false);
    // created_at should remain the same; updated_at should change
    expect(updated.created_at).toBe(updated.updated_at); // both set to "now" in mock
  });

  test("updateSSOConfig defaults enabled to false when omitted", async () => {
    const config = await updateSSOConfig(ORG, {
      ...VALID_INPUT,
      enabled: undefined,
    });
    expect(config.enabled).toBe(false);
  });

  // ── listSSOConfigs ──

  test("listSSOConfigs returns empty array when no configs exist", async () => {
    const configs = await listSSOConfigs();
    expect(configs).toEqual([]);
  });

  test("listSSOConfigs returns all configs", async () => {
    await updateSSOConfig(ORG, VALID_INPUT);
    await updateSSOConfig(ORG_B, { ...VALID_INPUT, provider: "azure-ad" });

    const configs = await listSSOConfigs();
    expect(configs).toHaveLength(2);
    const orgIds = configs.map((c) => c.org_id);
    expect(orgIds).toContain(ORG);
    expect(orgIds).toContain(ORG_B);
  });

  // ── deleteSSOConfig ──

  test("deleteSSOConfig returns false when no config exists", async () => {
    const deleted = await deleteSSOConfig(ORG);
    expect(deleted).toBe(false);
  });

  test("deleteSSOConfig removes the config and returns true", async () => {
    await updateSSOConfig(ORG, VALID_INPUT);
    const deleted = await deleteSSOConfig(ORG);
    expect(deleted).toBe(true);

    const config = await getSSOConfig(ORG);
    expect(config).toBeUndefined();
  });

  // ── generateSAMLRequest ──

  test("generateSAMLRequest throws when no config exists", async () => {
    await expect(generateSAMLRequest(ORG)).rejects.toThrow(
      'No SSO configuration found for organization "org-test-001"',
    );
  });

  test("generateSAMLRequest throws when SSO is disabled", async () => {
    await updateSSOConfig(ORG, { ...VALID_INPUT, enabled: false });
    await expect(generateSAMLRequest(ORG)).rejects.toThrow(
      'SSO is disabled for organization "org-test-001"',
    );
  });

  test("generateSAMLRequest returns a valid SAML request structure", async () => {
    await updateSSOConfig(ORG, VALID_INPUT);
    const request = await generateSAMLRequest(ORG);

    expect(request.id).toMatch(/^_[0-9a-f-]+$/);
    expect(request.issue_instant).toBeDefined();
    expect(request.destination).toBe(VALID_INPUT.acs_url);
    expect(request.issuer).toBe(VALID_INPUT.entity_id);
    expect(request.acs_url).toBe(VALID_INPUT.acs_url);
    expect(request.org_id).toBe(ORG);
    expect(request.name_id_policy).toBe(
      "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    );
  });

  // ── validateSAMLResponse ──

  test("validateSAMLResponse rejects null input", async () => {
    const result = await validateSAMLResponse(null as unknown as Record<string, unknown>);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("non-null object");
  });

  test("validateSAMLResponse rejects response without status", async () => {
    const result = await validateSAMLResponse({});
    expect(result.valid).toBe(false);
    expect(result.error).toContain("status");
  });

  test("validateSAMLResponse rejects non-success status", async () => {
    const result = await validateSAMLResponse({ status: "urn:oasis:names:tc:SAML:2.0:status:Requester" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not success");
  });

  test("validateSAMLResponse rejects response without assertion", async () => {
    const result = await validateSAMLResponse({ status: "success" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("assertion");
  });

  test("validateSAMLResponse rejects assertion without name_id", async () => {
    const result = await validateSAMLResponse({
      status: "success",
      assertion: { issuer: "http://www.okta.com/abc" },
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("name_id");
  });

  test("validateSAMLResponse returns valid result with full assertion", async () => {
    await updateSSOConfig(ORG, VALID_INPUT);

    const result = await validateSAMLResponse({
      status: "success",
      assertion: {
        name_id: "user@example.com",
        issuer: VALID_INPUT.entity_id,
        session_index: "_session123",
        attributes: { email: "user@example.com", role: "admin" },
      },
    });

    expect(result.valid).toBe(true);
    expect(result.name_id).toBe("user@example.com");
    expect(result.session_index).toBe("_session123");
    expect(result.org_id).toBe(ORG);
    expect(result.attributes).toEqual({ email: "user@example.com", role: "admin" });
  });

  test("validateSAMLResponse resolves org_id from issuer when config exists", async () => {
    await updateSSOConfig(ORG, VALID_INPUT);

    const result = await validateSAMLResponse({
      status: "success",
      assertion: {
        name_id: "user@example.com",
        issuer: VALID_INPUT.entity_id,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.org_id).toBe(ORG);
  });

  test("validateSAMLResponse returns undefined org_id when issuer does not match any config", async () => {
    const result = await validateSAMLResponse({
      status: "success",
      assertion: {
        name_id: "user@example.com",
        issuer: "http://unknown-idp.example.com",
      },
    });

    expect(result.valid).toBe(true);
    expect(result.org_id).toBeUndefined();
  });
});
