/** @jest-environment node */
/**
 * projectSharing — unit tests for the project share links service.
 *
 * Tests the full lifecycle: create, lookup, list, revoke, and expiry.
 * Uses a local file-based SQLite database (the default when TURSO_DATABASE_URL is not set).
 */

import {
  shareProject,
  getShareLink,
  revokeShareLink,
  listShareLinks,
  type SharePermission,
} from "../src/services/collaboration/projectSharing";
import { closeLibsqlClient, sqlRun } from "../src/server/libsqlDb";

const TEST_PROJECT_ID = "test-share-project";
const TEST_USER_ID = "test-user-share";

afterAll(() => {
  closeLibsqlClient();
});

describe("projectSharing", () => {
  beforeAll(async () => {
    // Clean up leftover data from prior runs
    await sqlRun("DELETE FROM share_links WHERE project_id = ?", [TEST_PROJECT_ID]).catch(() => {});
  });

  afterEach(async () => {
    // Clean up after each test
    await sqlRun("DELETE FROM share_links WHERE project_id = ?", [TEST_PROJECT_ID]).catch(() => {});
  });

  test("shareProject creates a link with correct fields", async () => {
    const link = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "view");

    expect(link.id).toBeDefined();
    expect(link.id.length).toBeGreaterThan(0);
    expect(link.projectId).toBe(TEST_PROJECT_ID);
    expect(link.token).toBeDefined();
    expect(link.token.length).toBe(10);
    expect(link.permission).toBe("view");
    expect(link.createdBy).toBe(TEST_USER_ID);
    expect(link.expiresAt).toBeNull();
    expect(link.useCount).toBe(0);
    expect(link.createdAt).toBeGreaterThan(0);
  });

  test("shareProject defaults to view permission", async () => {
    const link = await shareProject(TEST_PROJECT_ID, TEST_USER_ID);
    expect(link.permission).toBe("view");
  });

  test("shareProject supports edit permission", async () => {
    const link = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "edit");
    expect(link.permission).toBe("edit");
  });

  test("shareProject with ttlMs sets expiresAt", async () => {
    const before = Date.now();
    const ttl = 60_000; // 1 minute
    const link = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "view", ttl);

    expect(link.expiresAt).not.toBeNull();
    expect(link.expiresAt!).toBeGreaterThanOrEqual(before + ttl);
    expect(link.expiresAt!).toBeLessThanOrEqual(before + ttl + 1000);
  });

  test("getShareLink retrieves a link by token and increments use_count", async () => {
    const created = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "comment");

    const found = await getShareLink(created.token);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.projectId).toBe(TEST_PROJECT_ID);
    expect(found!.permission).toBe("comment");
    expect(found!.useCount).toBe(1);

    // Second access increments again
    const found2 = await getShareLink(created.token);
    expect(found2!.useCount).toBe(2);
  });

  test("getShareLink returns null for nonexistent token", async () => {
    const found = await getShareLink("nonexistent_token");
    expect(found).toBeNull();
  });

  test("getShareLink returns null for expired link", async () => {
    // Create a link that already expired (ttl = 1ms, will expire almost immediately)
    const created = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "view", 1);

    // Wait a tick to ensure expiry
    await new Promise((resolve) => setTimeout(resolve, 50));

    const found = await getShareLink(created.token);
    expect(found).toBeNull();
  });

  test("listShareLinks returns all active links for a project", async () => {
    const link1 = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "view");
    const link2 = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "edit");
    const link3 = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "comment");

    const links = await listShareLinks(TEST_PROJECT_ID);
    expect(links.length).toBeGreaterThanOrEqual(3);

    const tokens = links.map((l) => l.token);
    expect(tokens).toContain(link1.token);
    expect(tokens).toContain(link2.token);
    expect(tokens).toContain(link3.token);
  });

  test("listShareLinks excludes expired links", async () => {
    // Create one active and one expired link
    const active = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "view");
    await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "view", 1);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const links = await listShareLinks(TEST_PROJECT_ID);
    const tokens = links.map((l) => l.token);
    expect(tokens).toContain(active.token);
    // The expired link should not appear
    expect(links.every((l) => l.expiresAt === null || l.expiresAt > Date.now())).toBe(true);
  });

  test("revokeShareLink removes a link", async () => {
    const created = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "view");

    await revokeShareLink(created.token);

    const found = await getShareLink(created.token);
    expect(found).toBeNull();
  });

  test("revokeShareLink throws for nonexistent token", async () => {
    await expect(revokeShareLink("nonexistent_token_xyz")).rejects.toThrow("Share link not found");
  });

  test("each shareProject call generates a unique token", async () => {
    const link1 = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "view");
    const link2 = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "view");
    const link3 = await shareProject(TEST_PROJECT_ID, TEST_USER_ID, "view");

    const tokens = new Set([link1.token, link2.token, link3.token]);
    expect(tokens.size).toBe(3);
  });

  test("listShareLinks returns empty array for project with no links", async () => {
    const links = await listShareLinks("no-such-project-id");
    expect(links).toEqual([]);
  });
});
