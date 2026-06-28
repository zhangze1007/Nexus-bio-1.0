/**
 * Plugin registry — CRUD operations and per-project installation management.
 *
 * Uses the libsqlDb helpers (async, Turso-compatible) for persistence.
 * All plugin manifests are validated before being written.
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";
import type { Plugin, PluginInstallation, PluginManifest, PluginStatus } from "./types";
import { validateManifest } from "./pluginValidator";

// ---------------------------------------------------------------------------
// Table creation SQL
// ---------------------------------------------------------------------------

const CREATE_PLUGINS_TABLE = `
  CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    orgId TEXT NOT NULL DEFAULT 'default',
    manifest TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    packageUrl TEXT,
    createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`;

const CREATE_INSTALLATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS plugin_installations (
    id TEXT PRIMARY KEY,
    pluginId TEXT NOT NULL,
    projectId TEXT NOT NULL,
    config TEXT,
    installedBy TEXT NOT NULL,
    installedAt TEXT NOT NULL,
    FOREIGN KEY (pluginId) REFERENCES plugins(id)
  )
`;

// ---------------------------------------------------------------------------
// PluginRegistry
// ---------------------------------------------------------------------------

export class PluginRegistry {
  private initialized = false;

  /**
   * Ensure the plugin tables exist. Called automatically before any operation.
   */
  private async ensureTables(): Promise<void> {
    if (this.initialized) return;
    await sqlBatch([
      { sql: CREATE_PLUGINS_TABLE, args: [] },
      { sql: CREATE_INSTALLATIONS_TABLE, args: [] },
    ]);
    this.initialized = true;
  }

  // ---- CREATE ----

  /**
   * Register a new plugin after validating its manifest.
   * New plugins always start in "draft" status.
   */
  async register(manifest: PluginManifest, packageUrl: string, userId: string, orgId = "default"): Promise<Plugin> {
    await this.ensureTables();

    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Invalid manifest: ${validation.errors.join("; ")}`);
    }

    const id = `plug_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    await sqlRun(
      `INSERT INTO plugins (id, orgId, manifest, status, packageUrl, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, JSON.stringify(manifest), "draft", packageUrl, userId, now],
    );

    return {
      id,
      orgId,
      manifest,
      status: "draft",
      packageUrl,
      createdBy: userId,
      createdAt: now,
    };
  }

  // ---- READ ----

  /**
   * Get a single plugin by ID, or null if not found.
   */
  async get(id: string): Promise<Plugin | null> {
    await this.ensureTables();
    const row = await sqlGet("SELECT * FROM plugins WHERE id = ?", [id]);
    if (!row) return null;
    return rowToPlugin(row);
  }

  /**
   * List plugins, optionally filtered by orgId and/or status.
   */
  async list(options?: { orgId?: string; status?: string }): Promise<Plugin[]> {
    await this.ensureTables();

    let sql = "SELECT * FROM plugins WHERE 1=1";
    const args: unknown[] = [];

    if (options?.orgId) {
      sql += " AND orgId = ?";
      args.push(options.orgId);
    }
    if (options?.status) {
      sql += " AND status = ?";
      args.push(options.status);
    }

    sql += " ORDER BY createdAt DESC";

    const rows = await sqlAll(sql, args);
    return rows.map(rowToPlugin);
  }

  // ---- UPDATE ----

  /**
   * Update mutable fields on a plugin record.
   * Only status, manifest, and packageUrl may be changed.
   */
  async update(id: string, updates: Partial<Pick<Plugin, "status" | "manifest" | "packageUrl">>): Promise<Plugin> {
    await this.ensureTables();

    // Verify the plugin exists
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Plugin not found: ${id}`);
    }

    const setClauses: string[] = [];
    const args: unknown[] = [];

    if (updates.status !== undefined) {
      setClauses.push("status = ?");
      args.push(updates.status);
    }
    if (updates.manifest !== undefined) {
      const validation = validateManifest(updates.manifest);
      if (!validation.valid) {
        throw new Error(`Invalid manifest: ${validation.errors.join("; ")}`);
      }
      setClauses.push("manifest = ?");
      args.push(JSON.stringify(updates.manifest));
    }
    if (updates.packageUrl !== undefined) {
      setClauses.push("packageUrl = ?");
      args.push(updates.packageUrl);
    }

    if (setClauses.length === 0) {
      return existing;
    }

    args.push(id);
    await sqlRun(`UPDATE plugins SET ${setClauses.join(", ")} WHERE id = ?`, args);

    return { ...existing, ...updates };
  }

  // ---- DISABLE ----

  /**
   * Set a plugin's status to "disabled".
   */
  async disable(id: string): Promise<void> {
    await this.update(id, { status: "disabled" });
  }

  // ---- INSTALL / UNINSTALL ----

  /**
   * Install an active plugin to a project.
   * The plugin must be in "active" status.
   */
  async install(
    pluginId: string,
    projectId: string,
    userId: string,
    config?: Record<string, unknown>,
  ): Promise<PluginInstallation> {
    await this.ensureTables();

    const plugin = await this.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    if (plugin.status !== "active") {
      throw new Error(`Cannot install plugin "${pluginId}": status is "${plugin.status}", expected "active"`);
    }

    const id = `inst_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    await sqlRun(
      `INSERT INTO plugin_installations (id, pluginId, projectId, config, installedBy, installedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, pluginId, projectId, config ? JSON.stringify(config) : null, userId, now],
    );

    return {
      id,
      pluginId,
      projectId,
      config,
      installedBy: userId,
      installedAt: now,
    };
  }

  /**
   * Remove a plugin installation by its installation ID.
   */
  async uninstall(installationId: string): Promise<void> {
    await this.ensureTables();

    const existing = await sqlGet("SELECT * FROM plugin_installations WHERE id = ?", [installationId]);
    if (!existing) {
      throw new Error(`Installation not found: ${installationId}`);
    }

    await sqlRun("DELETE FROM plugin_installations WHERE id = ?", [installationId]);
  }

  /**
   * List all plugin installations for a given project.
   */
  async listInstalled(projectId: string): Promise<PluginInstallation[]> {
    await this.ensureTables();

    const rows = await sqlAll("SELECT * FROM plugin_installations WHERE projectId = ? ORDER BY installedAt DESC", [
      projectId,
    ]);

    return rows.map(rowToInstallation);
  }
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToPlugin(row: Record<string, unknown>): Plugin {
  return {
    id: row.id as string,
    orgId: row.orgId as string,
    manifest: typeof row.manifest === "string" ? JSON.parse(row.manifest as string) : (row.manifest as PluginManifest),
    status: row.status as PluginStatus,
    packageUrl: row.packageUrl as string | undefined,
    createdBy: row.createdBy as string,
    createdAt: row.createdAt as string,
  };
}

function rowToInstallation(row: Record<string, unknown>): PluginInstallation {
  return {
    id: row.id as string,
    pluginId: row.pluginId as string,
    projectId: row.projectId as string,
    config: row.config
      ? typeof row.config === "string"
        ? JSON.parse(row.config as string)
        : (row.config as Record<string, unknown>)
      : undefined,
    installedBy: row.installedBy as string,
    installedAt: row.installedAt as string,
  };
}
