/**
 * axonAdapters — thin tool-execution adapters for the Axon orchestrator.
 *
 * Two adapters ship in PR-2b:
 *
 *   • pathdAdapter  → routes through the existing `/api/analyze` endpoint
 *                     (searchQuery mode) and returns the enriched pathway
 *                     JSON. This is real execution — the same backend the
 *                     NEXAI plain-language surface already uses.
 *
 *   • fbasimAdapter → routes through the existing `/api/fba` endpoint.
 *                     This is a real LP simplex solve in the Node.js runtime.
 *
 * Both adapters are deliberately thin: they don't fabricate results, they
 * don't emit mock data, and on unsupported inputs they throw explicit
 * errors so the orchestrator can surface them via `task.error`. This keeps
 * PR-2b honest about what is wired vs. still-deferred.
 *
 * Adding a new tool: implement an `AxonAdapter`, add it to the union in
 * AxonOrchestrator, and register it in `buildDefaultAdapters`.
 */
import type { AxonAdapter, AxonAdapterMap } from './AxonOrchestrator';

// ── PATHD ────────────────────────────────────────────────────────────

export interface PathdAdapterInput {
  targetProduct: string;
  /** Optional hint surfaced to the backend — not yet acted on but
   *  captured so future PR-3 routing can inspect it. */
  hint?: string;
}

export interface PathdAdapterResult {
  provider: string;
  rawText: string;
  nodeCount: number;
  bottleneckCount: number;
  parseError: { code: string; message: string } | null;
}

export const pathdAdapter: AxonAdapter<PathdAdapterInput, PathdAdapterResult> =
  async (input, ctx) => {
    if (!input || typeof input.targetProduct !== 'string' || !input.targetProduct.trim()) {
      throw new Error('PATHD adapter requires a non-empty targetProduct');
    }

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchQuery: input.targetProduct.trim() }),
      signal: ctx.signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : `PATHD backend returned HTTP ${res.status}`,
      );
    }

    const rawText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('PATHD backend returned no candidate text');
    }

    const meta = (data?.meta ?? {}) as Record<string, unknown>;
    const parseErrorRaw = meta.parseError as { code?: unknown; message?: unknown } | undefined;

    let nodeCount = 0;
    let bottleneckCount = 0;
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed?.nodes)) nodeCount = parsed.nodes.length;
      if (Array.isArray(parsed?.bottleneck_enzymes)) {
        bottleneckCount = parsed.bottleneck_enzymes.length;
      }
    } catch {
      // prose or malformed — nodeCount stays 0; parseError is still surfaced
    }

    return {
      provider: typeof meta.provider === 'string' ? meta.provider : 'unknown',
      rawText,
      nodeCount,
      bottleneckCount,
      parseError: parseErrorRaw && typeof parseErrorRaw.code === 'string'
        ? {
            code: parseErrorRaw.code,
            message: typeof parseErrorRaw.message === 'string'
              ? parseErrorRaw.message
              : 'Parse error reported without message',
          }
        : null,
    };
  };

// ── FBASIM ───────────────────────────────────────────────────────────

export type FbasimSpecies = 'ecoli' | 'yeast';
export type FbasimObjective = 'biomass' | 'atp' | 'product';

export interface FbasimAdapterInput {
  species?: FbasimSpecies;
  objective?: FbasimObjective;
  glucoseUptake?: number;
  oxygenUptake?: number;
  knockouts?: string[];
}

export interface FbasimAdapterResult {
  species: FbasimSpecies;
  objective: FbasimObjective;
  objectiveValue: number;
  fluxCount: number;
  raw: unknown;
}

export const fbasimAdapter: AxonAdapter<FbasimAdapterInput, FbasimAdapterResult> =
  async (input, ctx) => {
    const payload: Record<string, unknown> = {
      species: input?.species ?? 'ecoli',
      objective: input?.objective ?? 'biomass',
      glucoseUptake: typeof input?.glucoseUptake === 'number' ? input.glucoseUptake : 10,
      oxygenUptake: typeof input?.oxygenUptake === 'number' ? input.oxygenUptake : 12,
      knockouts: Array.isArray(input?.knockouts) ? input.knockouts : [],
    };

    const res = await fetch('/api/fba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctx.signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : `FBASIM backend returned HTTP ${res.status}`,
      );
    }

    const result = data.result ?? {};
    const fluxes = Array.isArray(result?.fluxes) ? result.fluxes : [];
    return {
      species: payload.species as FbasimSpecies,
      objective: payload.objective as FbasimObjective,
      objectiveValue: typeof result?.objectiveValue === 'number' ? result.objectiveValue : 0,
      fluxCount: fluxes.length,
      raw: result,
    };
  };

// ── Adapter registry ─────────────────────────────────────────────────

/**
 * Production adapter map. Tests pass their own map to keep fetch mocked
 * out of the orchestrator core.
 */
export function buildDefaultAdapters(): AxonAdapterMap {
  return {
    pathd: pathdAdapter as AxonAdapter,
    fbasim: fbasimAdapter as AxonAdapter,
  };
}

/**
 * Returns a map where unimplemented tools are stubbed with a function
 * that throws a controlled "unsupported" error. Useful when we want the
 * orchestrator to visibly reject a task rather than fail silently during
 * a gradual PR-2b → PR-3 rollout.
 */
export function buildUnsupportedAdapter(toolName: string): AxonAdapter {
  return async () => {
    throw new Error(
      `Tool "${toolName}" has no execution adapter wired yet (deferred to PR-3).`,
    );
  };
}
