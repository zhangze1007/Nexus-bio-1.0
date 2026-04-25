/**
 * axonAdapterRegistry — scalable adapter map for the orchestrator.
 *
 * PR-2b hard-coded two adapters (pathd, fbasim) via `buildDefaultAdapters`.
 * PR-3 introduces a registry pattern so future tool support can be added
 * without editing the orchestrator or its call sites. The registry is
 * still honest: unsupported tools are **not** silently stubbed. They
 * return `undefined` so the orchestrator surfaces an explicit "no
 * adapter registered" error on the task.
 *
 * Supported tools grow one at a time, only when a real execution surface
 * (an API route that actually computes something) is already in place.
 */
import type { AxonAdapter, AxonAdapterMap, AxonTool } from './AxonOrchestrator';
import { pathdAdapter, fbasimAdapter } from './axonAdapters';

export interface AxonAdapterRegistration {
  tool: AxonTool;
  adapter: AxonAdapter;
  /** Short human label used in logs / drawer. */
  label: string;
  /**
   * Optional: declare a stable shape contract. Not enforced at runtime;
   * kept for future typing work and so the registry self-documents.
   */
  inputShape?: string;
}

export interface AxonAdapterRegistry {
  get(tool: AxonTool): AxonAdapter | undefined;
  list(): AxonAdapterRegistration[];
  toMap(): AxonAdapterMap;
  isSupported(tool: AxonTool): boolean;
}

/**
 * Factory for the default registry shipped with the app. Tests can
 * construct their own via `createRegistry([...])` to stub a tool out.
 */
export function createAxonAdapterRegistry(
  registrations: AxonAdapterRegistration[],
): AxonAdapterRegistry {
  const byTool = new Map<AxonTool, AxonAdapterRegistration>();
  for (const r of registrations) byTool.set(r.tool, r);

  return {
    get(tool) {
      return byTool.get(tool)?.adapter;
    },
    list() {
      return Array.from(byTool.values());
    },
    toMap() {
      const map: AxonAdapterMap = {};
      for (const [tool, reg] of byTool) {
        map[tool] = reg.adapter;
      }
      return map;
    },
    isSupported(tool) {
      return byTool.has(tool);
    },
  };
}

export const DEFAULT_AXON_ADAPTERS: AxonAdapterRegistration[] = [
  {
    tool: 'pathd',
    adapter: pathdAdapter as AxonAdapter,
    label: 'Pathway design (PATHD)',
    inputShape: '{ targetProduct: string; hint?: string }',
  },
  {
    tool: 'fbasim',
    adapter: fbasimAdapter as AxonAdapter,
    label: 'Flux-balance analysis (FBASIM)',
    inputShape: '{ species?, objective?, glucoseUptake?, oxygenUptake?, knockouts? }',
  },
];

export function buildDefaultAxonAdapterRegistry(): AxonAdapterRegistry {
  return createAxonAdapterRegistry(DEFAULT_AXON_ADAPTERS);
}

/**
 * Phase-2B.1 — single source of truth for "does this tool have a real
 * Axon adapter?". The workflow snapshot, planner, and supervisor all
 * read this helper instead of duplicating the registered-tool list.
 *
 * The registry is built once and cached. If a future PR adds a new
 * adapter to DEFAULT_AXON_ADAPTERS, this helper picks it up
 * automatically — no parallel list to keep in sync.
 */
let cachedRegistry: AxonAdapterRegistry | null = null;
function defaultRegistry(): AxonAdapterRegistry {
  if (!cachedRegistry) cachedRegistry = buildDefaultAxonAdapterRegistry();
  return cachedRegistry;
}

export function isAxonToolSupported(toolId: AxonTool): boolean {
  return defaultRegistry().isSupported(toolId);
}
