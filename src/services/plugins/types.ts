/**
 * Plugin system type definitions.
 *
 * Defines the manifest schema, plugin records, and installation records
 * for the Nexus-Bio community plugin system.
 */

/** Descriptor for a single plugin input parameter. */
export interface PluginInput {
  name: string;
  type: "string" | "number" | "boolean" | "file" | "json";
  required: boolean;
  description: string;
  default?: unknown;
}

/** Descriptor for a single plugin output value. */
export interface PluginOutput {
  name: string;
  type: "string" | "number" | "json" | "file";
  description: string;
}

/** Optional UI metadata for rendering the plugin in the tool palette. */
export interface PluginUI {
  icon: string;
  color: string;
  category: string;
}

/** Runtime configuration for the plugin engine. */
export interface PluginEngine {
  runtime: "javascript" | "python" | "wasm";
  entrypoint: string;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

/**
 * Full plugin manifest — the declarative descriptor that authors ship with
 * their plugin package.
 */
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license?: string;
  inputs: PluginInput[];
  outputs: PluginOutput[];
  ui?: PluginUI;
  engine: PluginEngine;
}

/** Lifecycle status of a registered plugin. */
export type PluginStatus = "draft" | "active" | "disabled";

/**
 * A plugin record as stored in the registry database.
 */
export interface Plugin {
  id: string;
  orgId: string;
  manifest: PluginManifest;
  status: PluginStatus;
  packageUrl?: string;
  createdBy: string;
  createdAt: string;
}

/**
 * A per-project installation of a plugin.
 */
export interface PluginInstallation {
  id: string;
  pluginId: string;
  projectId: string;
  config?: Record<string, unknown>;
  installedBy: string;
  installedAt: string;
}
