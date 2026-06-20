/**
 * axonAdapterRegistry — scalable adapter map for the orchestrator.
 *
 * Two types of adapters:
 *   1. Direct adapters (pathd, fbasim) — call existing API routes
 *   2. Pipeline adapters (all other tools) — call /api/pipeline/:tool
 *      which runs the pipeline server-side
 *
 * The registry never imports server-side code directly.
 * All pipeline execution goes through API routes.
 */
import type { AxonAdapter, AxonAdapterMap, AxonTool } from './AxonOrchestrator';
import { pathdAdapter, fbasimAdapter } from './axonAdapters';

export interface AxonAdapterRegistration {
  tool: AxonTool;
  adapter: AxonAdapter;
  label: string;
  inputShape?: string;
}

export interface AxonAdapterRegistry {
  get(tool: AxonTool): AxonAdapter | undefined;
  list(): AxonAdapterRegistration[];
  toMap(): AxonAdapterMap;
  isSupported(tool: AxonTool): boolean;
}

export function createAxonAdapterRegistry(
  registrations: AxonAdapterRegistration[],
): AxonAdapterRegistry {
  const byTool = new Map<AxonTool, AxonAdapterRegistration>();
  for (const r of registrations) byTool.set(r.tool, r);

  return {
    get(tool) { return byTool.get(tool)?.adapter; },
    list() { return Array.from(byTool.values()); },
    toMap() {
      const map: AxonAdapterMap = {};
      for (const [tool, reg] of byTool) map[tool] = reg.adapter;
      return map;
    },
    isSupported(tool) { return byTool.has(tool); },
  };
}

// ── Generic Pipeline Adapter ─────────────────────────────────────────────

/**
 * Build an adapter that calls /api/pipeline/:tool.
 * The API route runs the pipeline server-side and returns the result.
 */
function buildPipelineApiAdapter(tool: string, label: string): AxonAdapter {
  return async (input: unknown, ctx: { signal?: AbortSignal }) => {
    const response = await fetch(`/api/pipeline/${tool}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input ?? {}),
      signal: ctx.signal,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `Pipeline ${tool} failed (${response.status})`);
    }
    return response.json();
  };
}

// ── Registry ─────────────────────────────────────────────────────────────

export const DEFAULT_AXON_ADAPTERS: AxonAdapterRegistration[] = [
  // Original direct adapters
  { tool: 'pathd', adapter: pathdAdapter as AxonAdapter, label: 'Pathway design (PATHD)', inputShape: '{ targetProduct: string; hint?: string }' },
  { tool: 'fbasim', adapter: fbasimAdapter as AxonAdapter, label: 'Flux-balance analysis (FBASIM)', inputShape: '{ species?, objective?, glucoseUptake?, oxygenUptake?, knockouts? }' },

  // Pipeline-backed adapters (call /api/pipeline/:tool)
  { tool: 'catdes', adapter: buildPipelineApiAdapter('catdes', 'Catalyst Designer'), label: 'Catalyst Designer — bottleneck analysis', inputShape: '{ pathwaySteps?, fbaData?, cethxData? }' },
  { tool: 'proevol', adapter: buildPipelineApiAdapter('proevol', 'Protein Engineering'), label: 'Protein Engineering — ΔΔG + fitness + conservation', inputShape: '{ sequence?, pdbText?, maxMutations? }' },
  { tool: 'dyncon', adapter: buildPipelineApiAdapter('dyncon', 'Dynamic Control'), label: 'Dynamic Control — PID/MPC optimization', inputShape: '{ setpoint?, processGain?, timeConstant? }' },
  { tool: 'cethx', adapter: buildPipelineApiAdapter('cethx', 'Thermodynamics'), label: 'Thermodynamics — TFA feasibility analysis', inputShape: '{ reactions?, conditions? }' },
  { tool: 'gecair', adapter: buildPipelineApiAdapter('gecair', 'Gene Circuit'), label: 'Gene Circuit Reasoner — ODE + Jacobian + Pareto', inputShape: '{ topology?, sensitivityTarget? }' },
  { tool: 'cellfree', adapter: buildPipelineApiAdapter('cellfree', 'Cell-Free'), label: 'Cell-Free Robustness — Monte Carlo + sensitivity', inputShape: '{ singleCellData?, nTrials? }' },
  { tool: 'genmim', adapter: buildPipelineApiAdapter('genmim', 'Genome Minimization'), label: 'Genome Minimization — CRISPRi scheduling', inputShape: '{ species?, targetGenomeReduction? }' },
  { tool: 'multio', adapter: buildPipelineApiAdapter('multio', 'Multi-Omics'), label: 'Multi-Omics — MOFA+ factorization', inputShape: '{ datasets?, nFactors? }' },
  { tool: 'scspatial', adapter: buildPipelineApiAdapter('scspatial', 'Single-Cell Spatial'), label: 'Single-Cell Spatial — clustering + Moran\'s I', inputShape: '{ expressionMatrix?, geneNames? }' },
  { tool: 'nexai', adapter: buildPipelineApiAdapter('nexai', 'Research'), label: 'Research — paper scoring + evidence synthesis', inputShape: '{ question?, papers? }' },

  // Frontier engines (2025-2026)
  { tool: 'inversefolding' as AxonTool, adapter: buildPipelineApiAdapter('inversefolding', 'Inverse Folding'), label: 'Inverse Folding — ProteinMPNN-style sequence design', inputShape: '{ backbone?, nSequences?, temperature? }' },
  { tool: 'multiplexcrispr' as AxonTool, adapter: buildPipelineApiAdapter('multiplexcrispr', 'Multiplex CRISPR'), label: 'Multiplex CRISPR — combinatorial editing strategy', inputShape: '{ genes?, maxEdits?, minFitness? }' },
  { tool: 'pathwaydiscovery' as AxonTool, adapter: buildPipelineApiAdapter('pathwaydiscovery', 'Pathway Discovery'), label: 'Pathway Discovery — A* search + thermodynamic scoring', inputShape: '{ target?, precursors?, maxLength? }' },
  { tool: 'digitaltwin' as AxonTool, adapter: buildPipelineApiAdapter('digitaltwin', 'Digital Twin'), label: 'Digital Twin — EKF state estimation + Monte Carlo forecast', inputShape: '{ config?, sensorReadings?, forecastHorizon? }' },
];

export function buildDefaultAxonAdapterRegistry(): AxonAdapterRegistry {
  return createAxonAdapterRegistry(DEFAULT_AXON_ADAPTERS);
}

let cachedRegistry: AxonAdapterRegistry | null = null;
function defaultRegistry(): AxonAdapterRegistry {
  if (!cachedRegistry) cachedRegistry = buildDefaultAxonAdapterRegistry();
  return cachedRegistry;
}

export function isAxonToolSupported(toolId: AxonTool): boolean {
  return defaultRegistry().isSupported(toolId);
}
