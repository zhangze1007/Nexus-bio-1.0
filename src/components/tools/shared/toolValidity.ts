/**
 * Tool Validity Registry
 *
 * Per the Round-1 reviewer roadmap (REVIEW_REPORT.md, P0.4), every tool page
 * must surface an honest "what kind of computation is this?" badge so users
 * cannot mistake demo math for production-grade simulation.
 *
 * Levels:
 *   - 'real'    : the algorithm matches its scientific name (e.g. simplex LP,
 *                 Michaelis–Menten, RK4 ODE, Hill kinetics).
 *   - 'partial' : core math is real but key parameters or coupling terms are
 *                 placeholders / hand-tuned (e.g. CatDes physics scoring with
 *                 reference weights, GenMIM greedy schedule on real viability).
 *   - 'demo'    : the visualization is real but the underlying numbers are
 *                 reference tables, force-directed projections, or otherwise
 *                 not what the scientific label would imply.
 *
 * Adding a tool: add a row here AND a `validity` field in workbenchPayloads.ts.
 */

export type ValidityLevel = 'real' | 'partial' | 'demo';

export interface ToolValidity {
  level: ValidityLevel;
  /** One-line description shown on hover. Be specific about what is/isn't real. */
  caption: string;
}

export const TOOL_VALIDITY: Record<string, ToolValidity> = {
  // Stage 1 — design
  pathd:        { level: 'partial', caption: 'Pathway graph + Δ G° lookup are real; route synthesis is template-based.' },
  'metabolic-eng': { level: 'partial', caption: 'Same engine as PathD with live FBA hooks; force layout is heuristic.' },

  // Stage 2 — simulation
  fbasim:       { level: 'partial', caption: 'Single-species FBA uses a real two-phase simplex LP. Two-Species mode runs two independent LPs and post-hoc scales exchange fluxes — NOT a joint community LP.' },
  cethx:        { level: 'demo',    caption: 'ΔG°\u0027 values are Lehninger reference (pH 7, 25°C). No live Alberty pH/T transform — eQuilibrator integration pending.' },
  catdes:       { level: 'partial', caption: 'Distance / orientation / VdW / electrostatic scoring is real (Warshel ε); residue weights are curated reference values.' },
  proevol:      { level: 'partial', caption: 'Campaign scoring, survivor selection, lineage tracking, and next-round recommendations are deterministic modeled heuristics; outputs are simulated/inferred decision support, not wet-lab measurements.' },

  // Stage 3 — chassis & control
  genmim:       { level: 'partial', caption: 'Greedy CRISPRi ranker is real (score = KD_eff + (1+GI)×0.3); viability uses additive growth-impact (no epistatic/Wagner network interactions).' },
  gecair:       { level: 'partial', caption: 'Hill curves and logic gate dynamics are real; circuit topology library is curated.' },
  dyncon:       { level: 'partial', caption: 'Hill feedback + Monod growth + RK4 ODE are textbook-correct; bioreactor parameters are reference values.' },

  // Stage 4 — DBTL
  cellfree:     { level: 'demo',    caption: 'Cell-free expression yield uses a curated lookup; no live TXTL kinetic model.' },
  dbtlflow:     { level: 'partial', caption: 'Iteration ledger and SBOL serialization are real; learning loop weights are heuristic.' },
  multio:       { level: 'demo',    caption: 'Integration uses deterministic factor decomposition and linear embeddings. Legacy MOFA+/VAE/UMAP labels have been removed from the UI.' },
  scspatial:    { level: 'partial', caption: 'h5ad ingestion, spatial coordinates, Moran I, neighborhood graphs, PAGA, and UMAP are real when dataset fields are present. Missing spatial metadata downgrades the page to partial mode.' },

  // Cross-stage
  nexai:        { level: 'real',    caption: 'Answers come exclusively from Groq llama-3.3-70b-versatile via /api/analyze. No client-side template fallback.' },
};

export function getToolValidity(moduleId: string): ToolValidity | undefined {
  return TOOL_VALIDITY[moduleId];
}
