/**
 * Assumption-Gated BioDesign Runtime — Phase 1 Schema
 *
 * Background:
 *   Static validity tiers ('real' | 'partial' | 'demo' in toolValidity.ts)
 *   tell users *what kind* of math a tool runs, but they do not let the
 *   runtime *reason about* the assumptions a tool depends on, nor block
 *   downstream tools from consuming outputs that violate their inputs'
 *   assumptions.
 *
 *   This module promotes "assumption", "evidence", and "provenance" to
 *   first-class typed objects so the workbench payload bus can carry them,
 *   and so future phases can add UI gating and runtime violation detection.
 *
 * Differentiation vs. prior art:
 *   MIRIAM (DOI: 10.1038/nbt1156), BioModels curation tiers, COMBINE/OMEX,
 *   and Galaxy provenance all standardize *static* metadata. The
 *   differentiation space for Nexus-Bio is *runtime* gating: assumptions
 *   that can be checked when an upstream payload arrives at a downstream
 *   tool, and that can block or warn at the UI layer.
 *
 * Phase 1 scope:
 *   Define the types only. Do NOT wire violation checking, UI banners
 *   (beyond CETHX), or runtime gating in this phase. Those are Phase 2.
 */

/**
 * A single assumption that a tool either makes about its inputs or asserts
 * about its outputs.
 *
 * Design intent:
 *   - `id` is namespaced by toolId (e.g. "fbasim.steady_state") so the
 *     registry can be loaded into a single Map without collisions.
 *   - `category` segments assumptions for filtering in the UI; biological
 *     and mathematical assumptions tend to read very differently to users.
 *   - `severity` is the runtime-gating dial. Phase 2 will use this to
 *     decide whether a downstream tool refuses to run, warns, or proceeds
 *     silently when the assumption is violated.
 */
export interface ToolAssumption {
  /** Unique ID, namespaced by tool. Example: "fbasim.steady_state". */
  id: string;
  /** Tool that owns this assumption (matches keys in TOOL_VALIDITY). */
  toolId: string;
  /**
   * Coarse classification:
   *   - 'biological'     : about the biology being modeled (e.g. steady state)
   *   - 'mathematical'   : about the math/solver (e.g. linearity, convexity)
   *   - 'data'           : about input data shape or provenance
   *   - 'computational'  : about runtime, numerical precision, or scaling
   */
  category: 'biological' | 'mathematical' | 'data' | 'computational';
  /** One-line statement, ≤ 120 characters. Imperative, specific, honest. */
  statement: string;
  /** Optional DOI or URL backing the assumption. */
  reference?: string;
  /**
   * Runtime gating level:
   *   - 'blocking' : a violation must prevent downstream consumption
   *   - 'warning'  : a violation surfaces a UI warning but does not block
   *   - 'info'     : displayed for transparency only; never gates
   */
  severity: 'blocking' | 'warning' | 'info';
}

/**
 * A piece of evidence backing a value, decision, or output produced by a
 * tool. Evidence is per-output, not per-tool, because a single tool run
 * may emit values whose confidence varies by source (e.g. literature ΔG
 * for one reaction, group-contribution estimate for another).
 *
 * Design intent:
 *   - `confidence` is intentionally separate from `source`. A literature
 *     value can still be 'low' confidence if the paper is contested; a
 *     computed value can be 'high' if the algorithm is well-validated.
 *   - The 'demo' confidence tier is reserved for outputs whose values
 *     have no scientific meaning and exist only for UI illustration. It
 *     is NOT the same as 'low'.
 */
export interface Evidence {
  /** Unique ID for cross-referencing from ProvenanceEntry.evidence. */
  id: string;
  /** Where this evidence comes from. 'mock' = no scientific source. */
  source: 'literature' | 'database' | 'computation' | 'mock';
  /** DOI, URL, database query string, or the literal token "MOCK". */
  reference: string;
  /** Confidence band. 'demo' is for UI-illustration-only outputs. */
  confidence: 'high' | 'medium' | 'low' | 'demo';
  /** Optional free-text annotation (e.g. "extrapolated outside fitted range"). */
  notes?: string;
}

/**
 * A record of a single tool execution, written to the workbench payload
 * bus alongside the tool's normal output.
 *
 * Design intent:
 *   - `inputAssumptions` and `outputAssumptions` are kept as ID lists, not
 *     embedded objects, so a single registry remains the source of truth
 *     for assumption text and severity. This avoids drift if an
 *     assumption's wording is updated.
 *   - `upstreamProvenance` lets the runtime walk a chain of tool runs
 *     backward to surface the full assumption set behind a final output.
 *   - `validityTier` duplicates toolValidity.ts so a payload remains
 *     interpretable even if the registry is re-keyed in a future refactor.
 */
export interface ProvenanceEntry {
  /** Tool that produced this entry (matches keys in TOOL_VALIDITY). */
  toolId: string;
  /** Wall-clock timestamp (ms since epoch) when the entry was written. */
  timestamp: number;
  /** Assumption IDs that this run depends on its inputs satisfying. */
  inputAssumptions: string[];
  /** Assumption IDs that this run introduces about its outputs. */
  outputAssumptions: string[];
  /** Evidence backing the values produced by this run. */
  evidence: Evidence[];
  /** Snapshot of the tool's validity tier at the time of the run. */
  validityTier: 'real' | 'partial' | 'demo';
  /**
   * Provenance entry IDs (or composite "toolId:timestamp" keys) for the
   * upstream tool runs whose outputs fed into this run. Phase 1 stores
   * these as opaque strings; Phase 2 may add a registry to resolve them.
   */
  upstreamProvenance: string[];
}

/**
 * A detected violation of an assumption, produced by the runtime when an
 * upstream payload contradicts a downstream tool's input assumption.
 *
 * Phase 1: type only — no detection logic ships in this phase.
 * Phase 2: violation checking, UI surfacing, and gating.
 */
export interface AssumptionViolation {
  /** ID of the violated assumption (matches ToolAssumption.id). */
  assumptionId: string;
  /** Human-readable explanation of why the assumption was violated. */
  reason: string;
  /**
   * Severity of *this* violation. Usually inherited from the assumption,
   * but the runtime may downgrade (e.g. blocking → warning) when an
   * override is configured for a given workflow.
   */
  severity: 'blocking' | 'warning';
  /**
   * Identifier of the upstream payload, tool run, or specific field that
   * triggered this violation. Free-form; format is defined per-trigger.
   */
  triggeredBy: string;
}
