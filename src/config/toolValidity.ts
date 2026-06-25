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
  fbasim:       { level: 'real',    caption: 'Single-species FBA uses a real two-phase simplex LP. Two-Species mode uses a joint community LP with shared exchange metabolite pool constraints (4 metabolites) and weighted community biomass objective. growthRate equals the LP objective value directly (normalized biomass reaction in h⁻¹). Toy-core network (10 reactions per species) for educational demonstration.' },
  cethx:        { level: 'real',    caption: "Alberty-transformed ΔG' from Lehninger reference ΔG° via calcTransformedGibbs (thermoEngine). Condition-aware at pH, ionic-strength, temperature. eQuilibrator 3 API integration when available. TFA (thermodynamic feasibility analysis) with group contribution method." },
  catdes:       { level: 'partial', caption: 'Real: LJ 6-12 VdW + Warshel electrostatics + Born solvation + SASA (predictBindingAffinity); Levenberg-Marquardt kinetic fitting (kineticsEngine); Eyring thermodynamics (eyringKinetics); BLOSUM62 sequence design + codon optimization (designSequences); Pareto dominance ranking (rankPathways); AlphaFold + RCSB PDB 3D rendering; PubChem SDF + coordinate-based docking score; SABIO-RK live kinetic data (with local fallback). Partial: Mutagenesis uses sequence-distance proxy for 3D distance; bottleneck weights (0.4/0.3/0.3) empirically chosen; ΔΔG uses linear BLOSUM62 model (±2 kcal/mol). Fixed: balancePathway is Newton-Raphson, not "Church-method".' },
  proevol:      { level: 'partial', caption: 'Campaign scoring, survivor selection, lineage tracking, and next-round recommendations are deterministic modeled heuristics; outputs are simulated/inferred decision support, not wet-lab measurements.' },

  // Stage 3 — chassis & control
  genmim:       { level: 'partial', caption: 'Greedy CRISPRi ranker is real (score = KD_eff + (1+GI)×0.3); viability uses additive growth-impact (no epistatic/Wagner network interactions).' },
  gecair:       { level: 'real',    caption: 'Hill function modeling and logic gate dynamics are textbook-correct (Alon 2007). Circuit topology library with AND/OR/NOT gates. Gate efficiency and signal propagation analysis.' },
  dyncon:       { level: 'real',    caption: 'Hill feedback + Monod growth + RK4 ODE are textbook-correct. Bioreactor simulation with convergence analysis. Parameters from standard microbiology references (Monod 1949, Bailey & Ollis 1986).' },

  // Stage 4 — DBTL
  cellfree:     { level: 'real',    caption: 'Resource-aware TX-TL ODE with RK4 integration. Kinetic constants from Silverman et al. 2010 (TX-TL calibration) and Sun et al. 2013 (PURE system). BRENDA integration for enzyme-specific Km/kcat overrides. Levenberg-Marquardt fitting for user plate-reader data.' },
  dbtlflow:     { level: 'real',    caption: 'Design-Build-Test-Learn cycle tracking with iteration ledger, SBOL serialization, and protocol generation. Learning loop uses Bayesian-inspired parameter updates across iterations.' },
  multio:       { level: 'partial', caption: 'MOFA+ factor analysis via Python backend (variational Bayes, real MOFA+). Deterministic linear embedding with KL penalty for client-side visualization. Limitations: client-side embedding is not a production VAE (no autograd); no scVI integration; demo uses synthetic data when no CSV uploaded.' },
  scspatial:    { level: 'real',    caption: 'Full scanpy/squidpy pipeline (Leiden, PAGA, diffusion pseudotime, Moran I, neighborhood enrichment, ligand-receptor) via Python backend. H&E tissue image overlay for Visium data. Auto-detects Visium/MERFISH/generic spatial formats. Real Visium mouse brain demo data.' },

  // Cross-stage
  nexai:        { level: 'real',    caption: 'Answers come exclusively from Groq llama-3.3-70b-versatile via /api/analyze. No client-side template fallback.' },

  // Frontier engines (2025-2026)
  inversefolding:    { level: 'partial', caption: 'k-NN graph, message passing, and PSSM decoding are real (Cα-only backbone). ESM-2 protein language model endpoint available via Python backend (embeddings, fitness scoring via log-likelihood ratios). Limitations: BLOSUM62 declared but unused (uniform prior); all weights hand-tuned, not learned; ESM-2 requires separate torch installation.' },
  multiplexcrispr:   { level: 'partial', caption: 'Rule Set 2 on-target scoring (Doench 2016 weights) and recursive combinatorial enumeration are real. CFD off-target matrix is uniform placeholder (all 0.893). Fitness is a proxy model, not FBA.' },
  pathwaydiscovery:  { level: 'partial', caption: 'A* graph search structure and thermodynamic ΔG cascade summation are real. Heuristic uses SMILES-derived functional groups (Jaccard similarity) when available; atom economy is a fixed lookup; no mass conservation; common-metabolites shortcut bypasses search.' },
  digitaltwin:       { level: 'real',    caption: 'EKF with RK4 integration, Monod kinetics, analytical Jacobian, and sensor fusion are all genuine. Monte Carlo forecast uses diagonal-only covariance (no cross-correlations). Likelihood and NIS use correct S⁻¹ and innovation covariance S.' },

  // ── Expansion tabs (2026-06-22) ───────────────────────────────────────────
  // These are sub-tabs within existing tool pages, not independent tools.
  // Badges rendered via FrontierEngineBadge inline component, not ToolShell.
  mfa13c:            { level: 'partial', caption: 'EMU decomposition and isotopomer balancing (Antoniewicz 2007) are real. Monte Carlo confidence intervals via Box-Muller perturbation are genuine. Limitations: flux estimation uses grid search (not nonlinear least-squares); no atom mapping verification; σ=0.01 noise level is fixed, not data-driven.' },
  gemreconstruct:    { level: 'partial', caption: 'GPR boolean parsing and iJO1366 stoichiometric matrix assembly are real. Biomass composition from iJO1366 (Orth et al. 2011). Limitations: KEGG reaction mapping uses iJO1366Subset as proxy (no live KEGG API); no gap-filling; no organism-specific biomass optimization.' },
  rnaengineering:    { level: 'partial', caption: 'Turner 2009 nearest-neighbor stacking parameters (Turner & Mathews 2010 NAR) and Watson-Crick/wobble complementarity rules are genuine. Limitations: no full secondary structure prediction (no NUPACK/RNAfold integration); thermodynamic scores are nearest-neighbor approximations only; off-target scoring uses simplified similarity, not full alignment.' },
  biosafety:         { level: 'real',    caption: 'BLAST sequence alignment via Python backend with VFDB (Virulence Factor Database) for real biosafety screening. E-value-based significance filtering with BH FDR correction. k-mer Jaccard similarity fallback when BLAST is unavailable.' },
};

export function getToolValidity(moduleId: string): ToolValidity | undefined {
  return TOOL_VALIDITY[moduleId];
}
