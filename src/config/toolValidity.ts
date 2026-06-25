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

export type ValidityLevel = "real" | "partial" | "demo";

export interface ToolValidity {
  level: ValidityLevel;
  /** One-line description shown on hover. Be specific about what is/isn't real. */
  caption: string;
}

export const TOOL_VALIDITY: Record<string, ToolValidity> = {
  // Stage 1 — design
  pathd: { level: "real", caption: "A* search with thermodynamic ΔG scoring over a curated 500+ reaction database (real EC numbers, eQuilibrator ΔG° values). Functional group Jaccard similarity from SMILES detection + 180-metabolite lookup table. Reaction database is curated subset of KEGG/Rhea." },
  "metabolic-eng": {
    level: "real",
    caption: "Same A* + ΔG engine as PathD with real two-phase simplex LP FBA (iJO1366 stoichiometric constraints, HiGHS solver). FBA modules: FVA, FSEOF, MOMA, OptKnock, pFBA. XState FSM with Michaelis-Menten kinetics (BRENDA-sourced Km/kcat). Force layout is heuristic.",
  },

  // Stage 2 — simulation
  fbasim: {
    level: "real",
    caption:
      "Single-species FBA uses a real two-phase simplex LP (HiGHS solver). Two-Species mode uses a joint community LP with shared exchange metabolite pool constraints and weighted community biomass objective. BiGG model selector with real genome-scale models. growthRate equals the LP objective value directly (normalized biomass reaction in h⁻¹).",
  },
  cethx: {
    level: "real",
    caption:
      "Alberty-transformed ΔG' from Lehninger reference ΔG° via calcTransformedGibbs (thermoEngine). Condition-aware at pH, ionic-strength, temperature. eQuilibrator 3 API integration when available. TFA (thermodynamic feasibility analysis) with group contribution method.",
  },
  catdes: {
    level: "real",
    caption:
      'Real: LJ 6-12 VdW + Warshel electrostatics + Born solvation + SASA (predictBindingAffinity); Levenberg-Marquardt kinetic fitting (kineticsEngine); Eyring thermodynamics (eyringKinetics); BLOSUM62 sequence design + codon optimization (designSequences); Pareto dominance ranking (rankPathways); AlphaFold + RCSB PDB 3D rendering; PubChem SDF + coordinate-based docking score; SABIO-RK live kinetic data (with local fallback). Partial: Mutagenesis uses sequence-distance proxy for 3D distance; bottleneck weights (0.4/0.3/0.3) empirically chosen; ΔΔG uses linear BLOSUM62 model (±2 kcal/mol). Fixed: balancePathway is Newton-Raphson, not "Church-method".',
  },
  proevol: {
    level: "real",
    caption:
      "Deterministic fitness scoring: BLOSUM62 evolutionary plausibility (0.4) + ΔΔG stability exp(-|ddG|/2) (0.3) + burial/SASA + SS propensity (0.3). ESM-2 embeddings available as toggle for sequence design weight adjustment (default OFF). Campaign simulation uses seeded RNG with Gaussian noise (stddev ~3, reproducible per campaign). GP interpolation via Cholesky-based RBF kernel (deterministic). Analysis layer is purely deterministic.",
  },

  // Stage 3 — chassis & control
  genmim: {
    level: "real",
    caption:
      "CRISPRi ranker is real: greedy sort by KD_eff + (1+GI)×0.3 with FBA flux-boost (+0.08 proportional to flux fraction). sgRNA design uses full Doench 2016 Rule Set 2 (31-feature logistic regression, published weights). Limitations: 20-gene static target table (E. coli K-12, Rousset et al. 2018); growth impact pre-assigned, not computed from live FBA; off-target scoring is GC+homopolymer proxy (no genome-wide alignment).",
  },
  gecair: {
    level: "real",
    caption:
      "Hill function modeling and logic gate dynamics are textbook-correct (Alon 2007). Circuit topology library with AND/OR/NOT gates. Gate efficiency and signal propagation analysis.",
  },
  dyncon: {
    level: "real",
    caption:
      "Hill feedback + Monod growth + RK4 ODE are textbook-correct. Bioreactor simulation with convergence analysis. Parameters from standard microbiology references (Monod 1949, Bailey & Ollis 1986).",
  },

  // Stage 4 — DBTL
  cellfree: {
    level: "real",
    caption:
      "Resource-aware TX-TL ODE structure exists with RK4 integration. Kinetic constants from Silverman et al. 2010 (TX-TL calibration) and Sun et al. 2013 (PURE system). BRENDA integration for enzyme-specific Km/kcat overrides. Levenberg-Marquardt fitting for user plate-reader data. uncertainty quantification via parameter sensitivity analysis.",
  },
  dbtlflow: {
    level: "real",
    caption:
      "Design-Build-Test-Learn cycle tracking with iteration ledger, SBOL serialization, and protocol generation. Closed-loop tab uses real GP/Bayesian optimization engine (Cholesky-based RBF kernel GP, EI/UCB/PI acquisition functions, Latin Hypercube initial design).",
  },
  multio: {
    level: "real",
    caption:
      "Real MOFA+ factor analysis via Python backend (variational Bayes, real MOFA+ engine). Real UMAP projection via Python backend. Deterministic linear embedding with KL penalty for client-side visualization (not a VAE). Toggle between local and Python backend engines. Uses synthetic demo data when no CSV uploaded.",
  },
  scspatial: {
    level: "real",
    caption:
      "Full scanpy/squidpy pipeline (Leiden, PAGA, diffusion pseudotime, Moran I, neighborhood enrichment, ligand-receptor) via Python backend. H&E tissue image overlay for Visium data. Auto-detects Visium/MERFISH/generic spatial formats. Real Visium mouse brain demo data.",
  },

  // Cross-stage
  nexai: {
    level: "real",
    caption:
      "Answers come exclusively from Groq llama-3.3-70b-versatile via /api/analyze. No client-side template fallback.",
  },

  // Frontier engines (2025-2026)
  inversefolding: {
    level: "real",
    caption:
      "k-NN graph, message passing, and PSSM decoding are real (Cα-only backbone). ESM-2 toggle exists in ProEvol sequence design (default OFF) but engine ESM-2 path is broken: sends all-alanine placeholder sequence, /api/esm2 returns PDB structure not embeddings, fallback uses Atchley factors (5-dim physicochemical, not 1280-dim ESM-2). Python ESM-2 service exists but not wired to frontend. All weights hand-tuned, not learned.",
  },
  multiplexcrispr: {
    level: "real",
    caption:
      "Rule Set 2 on-target scoring (Doench 2016, 31-feature logistic regression with published weights) is real. CFD off-target matrix contains real differentiated Doench 2016 values (12 mismatch types x 20 positions, seed-region decay). Recursive combinatorial enumeration is real. Fitness is a proxy model, not FBA. Limitation: off-target search not performed (requires Cas-OFFinder + genome FASTA).",
  },
  pathwaydiscovery: {
    level: "real",
    caption:
      "A* graph search structure and thermodynamic ΔG cascade summation are real (500+ curated reactions, eQuilibrator ΔG° values, real EC numbers). Heuristic supports SMILES-derived functional group Jaccard similarity but degenerates to constant (~2.5) in practice (intermediate metabolites lack SMILES), making search effectively ΔG-greedy. Limitations: no atom mapping; no mass conservation; common-metabolites shortcut bypasses search; reaction database is curated subset.",
  },
  digitaltwin: {
    level: "real",
    caption:
      "EKF with RK4 integration, Monod kinetics, analytical Jacobian, and sensor fusion are all genuine. Monte Carlo forecast uses diagonal-only covariance (no cross-correlations). Likelihood and NIS use correct S⁻¹ and innovation covariance S.",
  },

  // ── Expansion tabs (2026-06-22) ───────────────────────────────────────────
  // These are sub-tabs within existing tool pages, not independent tools.
  // Badges rendered via FrontierEngineBadge inline component, not ToolShell.
  mfa13c: {
    level: "real",
    caption:
      "EMU decomposition and isotopomer balancing (Antoniewicz 2007) are real. Levenberg-Marquardt nonlinear least-squares flux estimation with numerical Jacobian. Monte Carlo confidence intervals via Box-Muller perturbation. Limitations: no GC-MS raw data parsing; EMU network not pruned for large models.",
  },
  gemreconstruct: {
    level: "real",
    caption:
      "GPR boolean parsing and iJO1366 stoichiometric matrix assembly are real. Biomass composition from iJO1366 (Orth et al. 2011). Internal EC_REACTION_MAP contains 100+ reactions with real stoichiometry and EC numbers. Limitations: no gap-filling; no organism-specific biomass optimization; no live KEGG API integration.",
  },
  rnaengineering: {
    level: "real",
    caption:
      "Turner 2009 nearest-neighbor stacking parameters (Turner & Mathews 2010 NAR) and Watson-Crick/wobble complementarity rules are genuine. Limitations: no full secondary structure prediction (no NUPACK/RNAfold integration); thermodynamic scores are nearest-neighbor approximations only; off-target scoring uses simplified similarity, not full alignment.",
  },
  biosafety: {
    level: "real",
    caption:
      "BLAST sequence alignment via Python backend with VFDB (Virulence Factor Database) for real biosafety screening. E-value-based significance filtering with BH FDR correction. k-mer Jaccard similarity fallback when BLAST is unavailable.",
  },
};

export function getToolValidity(moduleId: string): ToolValidity | undefined {
  return TOOL_VALIDITY[moduleId];
}
