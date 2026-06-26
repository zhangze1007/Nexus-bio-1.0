/**
 * Tests for PluginRegistry — CRUD and install/uninstall operations.
 *
 * Mocks the libsqlDb layer so tests run without a real database.
 */

import type { PluginManifest } from "../../src/services/plugins/types";

// ---------------------------------------------------------------------------
// In-memory mock DB stores
// ---------------------------------------------------------------------------
let pluginStore: Map<string, Record<string, unknown>> = new Map();
let installStore: Map<string, Record<string, unknown>> = new Map();

jest.mock("../../src/server/libsqlDb", () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[]) => {
    // Plugin queries
    if (sql.includes("FROM plugins")) {
      let rows = Array.from(pluginStore.values());
      // Simple filter simulation for orgId / status
      if (sql.includes("orgId =") && args.length >= 1) {
        rows = rows.filter((r) => r.orgId === args[0]);
      }
      if (sql.includes("status =") && args.length >= 1) {
        const statusIdx = sql.includes("orgId =") ? 1 : 0;
        rows = rows.filter((r) => r.status === args[statusIdx]);
      }
      return rows;
    }
    // Installation queries
    if (sql.includes("FROM plugin_installations")) {
      let rows = Array.from(installStore.values());
      if (sql.includes("projectId =") && args.length >= 1) {
        rows = rows.filter((r) => r.projectId === args[0]);
      }
      return rows;
    }
    return [];
  }),
  sqlGet: jest.fn(async (sql: string, args: unknown[]) => {
    if (sql.includes("FROM plugins")) {
      const id = args[0] as string;
      return pluginStore.get(id) ?? undefined;
    }
    if (sql.includes("FROM plugin_installations")) {
      const id = args[0] as string;
      return installStore.get(id) ?? undefined;
    }
    return undefined;
  }),
  sqlRun: jest.fn(async (sql: string, args: unknown[]) => {
    if (sql.startsWith("INSERT INTO plugins")) {
      // INSERT INTO plugins (id, orgId, manifest, status, packageUrl, createdBy, createdAt)
      // VALUES (?, ?, ?, ?, ?, ?, ?)
      const row = {
        id: args[0] as string,
        orgId: args[1] as string,
        manifest: args[2] as string, // JSON string
        status: args[3] as string,
        packageUrl: args[4] as string | null,
        createdBy: args[5] as string,
        createdAt: args[6] as string,
      };
      pluginStore.set(row.id, row);
      return { rowsAffected: 1 };
    }
    if (sql.startsWith("INSERT INTO plugin_installations")) {
      // INSERT INTO plugin_installations (id, pluginId, projectId, config, installedBy, installedAt)
      // VALUES (?, ?, ?, ?, ?, ?)
      const row = {
        id: args[0] as string,
        pluginId: args[1] as string,
        projectId: args[2] as string,
        config: args[3] as string | null,
        installedBy: args[4] as string,
        installedAt: args[5] as string,
      };
      installStore.set(row.id, row);
      return { rowsAffected: 1 };
    }
    if (sql.startsWith("UPDATE plugins")) {
      const id = args[args.length - 1] as string;
      const existing = pluginStore.get(id);
      if (!existing) return { rowsAffected: 0 };
      const updated = { ...existing };
      let argIdx = 0;
      if (sql.includes("status =")) {
        updated.status = args[argIdx++] as string;
      }
      if (sql.includes("manifest =")) {
        updated.manifest = args[argIdx++] as string;
      }
      if (sql.includes("packageUrl =")) {
        updated.packageUrl = args[argIdx++] as string;
      }
      pluginStore.set(id, updated);
      return { rowsAffected: 1 };
    }
    if (sql.startsWith("DELETE FROM plugin_installations")) {
      const id = args[0] as string;
      const existed = installStore.has(id);
      installStore.delete(id);
      return { rowsAffected: existed ? 1 : 0 };
    }
    return { rowsAffected: 0 };
  }),
  sqlBatch: jest.fn(async () => {}),
}));

// Import AFTER mock setup
import { PluginRegistry } from "../../src/services/plugins/pluginRegistry";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
function validManifest(): PluginManifest {
  return {
    name: "test-plugin",
    version: "1.0.0",
    description: "A test plugin",
    author: "tester",
    inputs: [
      { name: "sequence", type: "string", required: true, description: "DNA sequence" },
    ],
    outputs: [
      { name: "result", type: "string", description: "Output" },
    ],
    engine: { runtime: "javascript", entrypoint: "index.js" },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    pluginStore = new Map();
    installStore = new Map();
    registry = new PluginRegistry();
  });

  // ---- register ----
  describe("register", () => {
    it("registers a new plugin and returns a Plugin object", async () => {
      const plugin = await registry.register(validManifest(), "https://pkg.url", "user1");
      expect(plugin.id).toBeTruthy();
      expect(plugin.orgId).toBe("default");
      expect(plugin.manifest.name).toBe("test-plugin");
      expect(plugin.status).toBe("draft");
      expect(plugin.packageUrl).toBe("https://pkg.url");
      expect(plugin.createdBy).toBe("user1");
      expect(plugin.createdAt).toBeTruthy();
    });

    it("rejects an invalid manifest", async () => {
      await expect(
        registry.register({ name: "" } as unknown as PluginManifest, "url", "user1"),
      ).rejects.toThrow(/manifest/i);
    });
  });

  // ---- get ----
  describe("get", () => {
    it("retrieves a registered plugin by id", async () => {
      const created = await registry.register(validManifest(), "url", "user1");
      const fetched = await registry.get(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.manifest.name).toBe("test-plugin");
    });

    it("returns null for unknown id", async () => {
      const result = await registry.get("nonexistent");
      expect(result).toBeNull();
    });
  });

  // ---- list ----
  describe("list", () => {
    it("lists all plugins", async () => {
      await registry.register(validManifest(), "url1", "user1");
      await registry.register(validManifest(), "url2", "user2");
      const list = await registry.list();
      expect(list.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---- update ----
  describe("update", () => {
    it("updates plugin status", async () => {
      const plugin = await registry.register(validManifest(), "url", "user1");
      const updated = await registry.update(plugin.id, { status: "active" });
      expect(updated.status).toBe("active");
    });

    it("rejects update for nonexistent plugin", async () => {
      await expect(
        registry.update("nonexistent", { status: "active" }),
      ).rejects.toThrow(/not found/i);
    });
  });

  // ---- disable ----
  describe("disable", () => {
    it("sets plugin status to disabled", async () => {
      const plugin = await registry.register(validManifest(), "url", "user1");
      await registry.disable(plugin.id);
      const fetched = await registry.get(plugin.id);
      expect(fetched!.status).toBe("disabled");
    });
  });

  // ---- install / uninstall / listInstalled ----
  describe("installations", () => {
    it("installs a plugin to a project", async () => {
      const plugin = await registry.register(validManifest(), "url", "user1");
      await registry.update(plugin.id, { status: "active" });
      const inst = await registry.install(plugin.id, "proj1", "user1");
      expect(inst.id).toBeTruthy();
      expect(inst.pluginId).toBe(plugin.id);
      expect(inst.projectId).toBe("proj1");
    });

    it("rejects installing a non-active plugin", async () => {
      const plugin = await registry.register(validManifest(), "url", "user1");
      // plugin is still draft
      await expect(
        registry.install(plugin.id, "proj1", "user1"),
      ).rejects.toThrow(/expected "active"/i);
    });

    it("lists installations for a project", async () => {
      const plugin = await registry.register(validManifest(), "url", "user1");
      await registry.update(plugin.id, { status: "active" });
      await registry.install(plugin.id, "proj1", "user1");
      const list = await registry.listInstalled("proj1");
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0].projectId).toBe("proj1");
    });

    it("uninstalls a plugin installation", async () => {
      const plugin = await registry.register(validManifest(), "url", "user1");
      await registry.update(plugin.id, { status: "active" });
      const inst = await registry.install(plugin.id, "proj1", "user1");
      await registry.uninstall(inst.id);
      const list = await registry.listInstalled("proj1");
      expect(list.find((i) => i.id === inst.id)).toBeUndefined();
    });

    it("rejects uninstall of nonexistent installation", async () => {
      await expect(
        registry.uninstall("nonexistent"),
      ).rejects.toThrow(/not found/i);
    });
  });
});
