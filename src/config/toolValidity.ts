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
  pathd: {
    level: "real",
    caption:
      "A* search with thermodynamic ΔG scoring. Curated 500+ reaction database (real EC numbers, eQuilibrator ΔG° values) as primary source, with live KEGG and Rhea API fallbacks for comprehensive coverage. Functional group Jaccard similarity from SMILES detection + 180-metabolite lookup table.",
  },
  "metabolic-eng": {
    level: "real",
    caption:
      "Same A* + ΔG engine as PathD with real two-phase simplex LP FBA (iJO1366 stoichiometric constraints, HiGHS solver). FBA modules: FVA, FSEOF, MOMA, OptKnock, pFBA. XState FSM with Michaelis-Menten kinetics (BRENDA-sourced Km/kcat). Force layout is heuristic.",
  },

  // Stage 2 — simulation
  fbasim: {
    level: "real",
    caption:
      "Single-species E. coli FBA: real LP (HiGHS solver) on the published e_coli_core stoichiometric model (Orth et al. 2010; 95 reactions + 1 synthetic product drain, 72 metabolites) with the genuine GAM biomass reaction — COBRApy-verified to ~0.87 h⁻¹ on glucose minimal media. FVA and pFBA run on the same model. growthRate = BIOMASS reaction flux. Yeast single-species uses a simplified illustrative glycolysis network (no genome-scale yeast model is bundled offline), so its absolute numbers are not calibrated. Community mode: real SteadyCom joint LP (Chan et al. 2017) — shared extracellular pool coupling + biomass-abundance coupling, bisection on community growth rate; cross-feeding emerges from stoichiometry. The community model is a curated small 2-species model (glycolysis + literature overflow secretion: E. coli acetate, yeast ethanol), so the METHOD is real but absolute numbers are illustrative at this scale; per-strain knockouts apply only to curated community reactions. BiGG model selector for custom models.",
  },
  cethx: {
    level: "real",
    caption:
      "Alberty-transformed ΔG' from Lehninger reference ΔG° via calcTransformedGibbs (thermoEngine). Condition-aware at pH, ionic-strength, temperature. eQuilibrator 3 API integration when available. TFA (thermodynamic feasibility analysis) with group contribution method.",
  },
  catdes: {
    level: "real",
    caption:
      'Real: LJ 6-12 VdW + Warshel electrostatics + Born solvation + SASA (predictBindingAffinity); Levenberg-Marquardt kinetic fitting (kineticsEngine); Eyring thermodynamics (eyringKinetics); BLOSUM62 sequence design + codon optimization (designSequences); Pareto dominance ranking (rankPathways); AlphaFold + RCSB PDB 3D rendering for known structures; de-novo structure prediction of designed sequences via ESMFold2 (Biohub hosted inference API, needs BIOHUB_API_KEY) preferred, with EBI ESMFold (ESM-2 650M) as fallback and fail-closed when neither is reachable — never a fabricated structure (note: without a key it uses EBI, and ESMFold2 returns coordinates that still need a coordinate→PDB step to render; its guardrail behavior for controlled sequences is undocumented); PubChem SDF + coordinate-based docking score; SABIO-RK live kinetic data (with local fallback). Partial: Mutagenesis uses sequence-distance proxy for 3D distance; bottleneck weights (0.4/0.3/0.3) empirically chosen; ΔΔG uses linear BLOSUM62 model (±2 kcal/mol). Fixed: balancePathway is Newton-Raphson, not "Church-method".',
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
      "CRISPRi ranker is real: greedy sort by KD_eff + (1+GI)×0.3 with FBA flux-boost (+0.08 proportional to flux fraction). sgRNA design uses full Doench 2016 Rule Set 2 (31-feature logistic regression, published weights). MultiplexCRISPR sub-panel: BLAST-based off-target search against E. coli K-12 genome (blastn-short, seed region mismatch analysis) when Python backend available; proxy fallback otherwise. Limitations: 20-gene static target table (E. coli K-12, Rousset et al. 2018); growth impact pre-assigned, not computed from live FBA.",
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
    level: "partial",
    caption:
      "Resource-aware TX-TL ODE structure with RK4 integration. Kinetic constants from Silverman et al. 2010 and Sun et al. 2013. BRENDA integration for enzyme-specific Km/kcat. Parameters are literature-sourced but NOT calibrated to user's specific extract. Levenberg-Marquardt fitting for plate-reader data.",
  },
  dbtlflow: {
    level: "real",
    caption:
      "Design-Build-Test-Learn cycle tracking with iteration ledger, SBOL serialization, and protocol generation. Closed-loop tab uses real GP/Bayesian optimization engine (Cholesky-based RBF kernel GP, EI/UCB/PI acquisition functions, Latin Hypercube initial design).",
  },
  multio: {
    level: "partial",
    caption:
      "Real client-side TS MOFA+ (runMOFA — alternating variational Bayes with ARD, runs in-browser, NOT Python-only): externally validated on a synthetic 2-factor multi-view benchmark — recovers both known latent factors at |corr| 0.895 / 0.997 (≥0.80 bar) with variance-explained monotone in the number of factors. Not claimed equivalent to the official MOFA2. The MAIN integration view is a deterministic LINEAR projection (z-score + ALS factors + linear embedding) — NOT a VAE and not UMAP; UMAP is available only via the optional Python backend. (The platform's TS UMAP engine, used by ScSpatial, is itself behaviorally validated at trustworthiness 0.979 / silhouette 0.955, above the linear-PCA floor 0.8775 — but is not on MultiO's client path.) Partial, honestly: the primary embedding is linear (not a learned nonlinear model), and sessions with no uploaded CSV run on synthetic demo data.",
  },
  scspatial: {
    level: "real",
    caption:
      "Full scanpy/squidpy pipeline (Leiden, PAGA, diffusion pseudotime, Moran I, neighborhood enrichment, ligand-receptor) via Python backend. H&E tissue image overlay for Visium data. Auto-detects Visium/MERFISH/generic spatial formats. Real Visium mouse brain demo data. Client-side TS Moran's I (computeMoranI) is validated against the closed form — exact to ~1e-7 (0.877143 / −0.067033 / −0.454630) when fed the reference row-standardized kNN weight matrix; computed end-to-end from coordinates it is within |Δ|<0.05 (0.870 / −0.067 / −0.479, correct sign), the small residual being kNN tie-breaking in weight construction (which equidistant diagonal is the 4th neighbour), not the statistic. The client-side TS UMAP embedding (runUMAP) is behaviorally validated: swiss-roll trustworthiness 0.979, blobs silhouette 0.955, both above the linear-PCA floor 0.8775.",
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
      "k-NN graph, message passing, and PSSM decoding are real (Cα-only backbone). ESM-2 integration wired: /api/esm2 cascades ESM-2 Python backend (320-1280 dim) -> ESM Atlas foldSequence -> local Atchley factors (5-dim). fetchESM2Embeddings sends structurally plausible sequence (not all-alanine) derived from Cα geometry. All weights hand-tuned, not learned.",
  },
  multiplexcrispr: {
    level: "real",
    caption:
      "Rule Set 2 on-target scoring (Doench 2016, 31-feature logistic regression with published weights) is real. CFD off-target matrix contains real differentiated Doench 2016 values (12 mismatch types x 20 positions, seed-region decay). Recursive combinatorial enumeration is real. Fitness is a proxy model, not FBA. BLAST-based off-target search against E. coli K-12 genome via Python backend (blastn-short, seed region mismatch analysis).",
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

  // Sequence Editor
  sequence: {
    level: "real",
    caption:
      "Restriction enzyme finder uses a real database of 15 common Type II enzymes with exact recognition sequences and cut site offsets. 6-frame translation uses the standard genetic code (NCBI table 1). Canvas-based linear viewer and SVG circular plasmid map are real renderers.",
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
      "Turner 2009 nearest-neighbor stacking parameters (Turner & Mathews 2010 NAR) and Watson-Crick/wobble complementarity rules are genuine. Optional ViennaRNA/RNAfold integration (Lorenz et al. 2011) for production-quality MFE prediction via Python backend (set RNA_PYTHON_BACKEND env var). Fallback: local Nussinov DP with Turner NN parameters. Limitations: off-target scoring uses simplified similarity, not full alignment.",
  },
  rfdiffusion: {
    level: "demo",
    caption:
      "Backbone Sketch (heuristic): NOT RFdiffusion and NOT a diffusion model. Sequences are sampled from natural amino-acid frequencies with a secondary-structure position bias; backbones are placed on an idealized helical trace; per-residue confidence is a deterministic hydrophobicity/terminus proxy, not model pLDDT. Set DENOVO_DESIGN_BACKEND to delegate to a real hosted de novo design model.",
  },
  biosafety: {
    level: "real",
    caption:
      "BLAST sequence alignment via Python backend with VFDB (Virulence Factor Database) for real biosafety screening. E-value-based significance filtering with BH FDR correction. k-mer Jaccard similarity fallback when BLAST is unavailable.",
  },

  // Variant-effect prediction (ML-1, 2026-07-24)
  varianteffect: {
    level: "partial",
    caption:
      "Supervised variant-effect predictor: real ESM-2 (esm2_t12_35M_UR50D) PER-POSITION embedding → Ridge (coefficients reference-validated vs scikit-learn to 6 dp, Spearman vs scipy). Feature = mutation-site residue-embedding delta (variant−WT at the mutated position), isolating the local signal that mean-pooling diluted. On the published BLAT_ECOLX (TEM-1 β-lactamase) Stiffler 2015 DMS assay (ProteinGym, same 1500 hold-out): per-position supervised OVERTAKES the zero-shot ESM baseline (≈0.55) from ~350 labels and climbs to ≈0.66 at 1000 labels (exported model 0.676); the zero-shot masked-marginal log-odds is returned alongside and serves as the cold-start below ~350 labels. (The earlier mean-pooled head only reached ≈0.48 and lost to zero-shot — that was a feature artifact, now fixed.) Partial/scope: protein-SPECIFIC — scores held-out substitutions WITHIN this one published assay/protein, not arbitrary proteins or novel folds. Runs only when the Python ESM-2 backend (VARIANT_EFFECT_BACKEND) is connected; with no backend the API reports 'backend not connected' rather than fabricating a number.",
  },
};

export function getToolValidity(moduleId: string): ToolValidity | undefined {
  return TOOL_VALIDITY[moduleId];
}
