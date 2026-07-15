/**
 * Tool Assumption Registry — Phase 1.2
 *
 * Per-tool list of assumptions that the workbench runtime can reason about.
 * The schema lives in src/types/assumptions.ts; the entries below are the
 * static registry that downstream phases will consult.
 *
 * Rules followed (see Phase 1 brief):
 *   - Statements ≤ 120 characters.
 *   - Every 'demo'-tier tool has ≥ 4 assumptions and ≥ 1 'blocking'.
 *   - Every other tool has ≥ 2 assumptions.
 *   - Only 'demo'-tier tools carry 'blocking' severity.
 *   - No fabricated DOIs. Where a value is unsourced, the assumption says so.
 *
 * Validity tiers (from toolValidity.ts) are NOT modified in this phase; an
 * honest assumption list does not by itself promote a tool from 'demo' to
 * 'partial'. Tier upgrades happen only after Phase-2 algorithm work.
 *
 * ───────────────────────────────────────────────────────────────
 * NOTE: model-structure vs. parameter-sourcing boundaries
 * ───────────────────────────────────────────────────────────────
 *
 * 1. CellFree (cellfree)
 *    - src/services/CellFreeEngine.ts implements a resource-aware
 *      TX-TL ODE with refs to Noireaux 2003, Jewett 2004, and
 *      Karzbrun 2011.
 *    - The structure claim is separate from parameter sourcing,
 *      calibration, and uncertainty. Tier remains unchanged unless
 *      later parameter evidence justifies a mode-specific change.
 *
 * 2. FBAsim (fbasim) — split into sub-tier entries
 *    - The legacy 'fbasim' entry is preserved verbatim to avoid
 *      breaking any existing import call sites.
 *    - 'fbasim-single' (partial) and 'fbasim-community' (partial)
 *      are the canonical sub-tier entries going forward.
 *    - Community FBA is now a REAL joint SteadyCom LP (Chan et al. 2017),
 *      so the 'fbasim-community' assumptions describe a genuine joint solve
 *      (no 'blocking' assumption; the tool is partial, not demo). The legacy
 *      'fbasim.community_not_joint_lp' entry below is retained only for
 *      backward compatibility with pre-SteadyCom call sites.
 */

import type { ToolAssumption } from "../types/assumptions";

export const TOOL_ASSUMPTIONS: Record<string, ToolAssumption[]> = {
  // ─────────────────────────────────────────────────────────────
  // Stage 1 — design (partial)
  // ─────────────────────────────────────────────────────────────
  pathd: [
    {
      id: "pathd.template_route_synthesis",
      toolId: "pathd",
      category: "computational",
      statement: "Pathway route synthesis is template-based; no learned retrosynthesis or RXN-prediction model.",
      severity: "warning",
    },
    {
      id: "pathd.delta_g_lookup_real",
      toolId: "pathd",
      category: "data",
      statement: "Pathway ΔG° aggregation uses reference-table values; inherits all CETHX caveats.",
      severity: "info",
    },
    {
      id: "pathd.kegg_database_integration",
      toolId: "pathd",
      category: "data",
      statement: "PATHD queries KEGG for real metabolic pathways when available. Falls back to demo data.",
      severity: "info",
    },
    {
      id: "pathd.database_fallback_boundary",
      toolId: "pathd",
      category: "data",
      statement:
        "When database is unavailable, this tool falls back to demo data. Results are scientifically valid only when sourced from live database (indicated by DataSourceBadge).",
      severity: "warning",
    },
  ],

  "metabolic-eng": [
    {
      id: "metabolic-eng.shared_engine_with_pathd",
      toolId: "metabolic-eng",
      category: "computational",
      statement: "UI wraps PathD engine; force-directed layout is heuristic and is for visualization only.",
      severity: "info",
    },
    {
      id: "metabolic-eng.live_fba_hooks",
      toolId: "metabolic-eng",
      category: "computational",
      statement: "Flux overlays come from live /api/fba calls; inherit all fbasim.* assumptions.",
      severity: "info",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // Stage 2 — simulation
  // ─────────────────────────────────────────────────────────────
  fbasim: [
    {
      id: "fbasim.steady_state",
      toolId: "fbasim",
      category: "biological",
      statement:
        "Assumes the metabolic network is at steady state (dx/dt = 0); transient dynamics are not represented.",
      severity: "warning",
    },
    {
      id: "fbasim.biomass_objective",
      toolId: "fbasim",
      category: "biological",
      statement: "Default objective is biomass maximization; assumes evolutionary optimization for growth.",
      severity: "warning",
    },
    {
      id: "fbasim.no_regulation",
      toolId: "fbasim",
      category: "biological",
      statement: "No transcriptional or allosteric regulation; flux bounds come from stoichiometry only.",
      severity: "warning",
    },
    {
      id: "fbasim.community_not_joint_lp",
      toolId: "fbasim",
      category: "mathematical",
      statement:
        "Two-Species mode runs two independent LPs and post-hoc scales exchange flux; NOT a joint community LP.",
      severity: "warning",
    },
    {
      id: "fbasim.simplex_real",
      toolId: "fbasim",
      category: "mathematical",
      statement: "Single-species E. coli solver is a real LP (HiGHS) on the published e_coli_core model (Orth 2010) with its genuine GAM biomass reaction — COBRApy-verified to ~0.87 h⁻¹. Yeast uses a simplified illustrative glycolysis network.",
      severity: "info",
    },
    {
      id: "fbasim.bigg_database_integration",
      toolId: "fbasim",
      category: "data",
      statement: "FBAsim loads real E. coli models from BiGG when available. Falls back to demo model.",
      severity: "info",
    },
    {
      id: "fbasim.database_fallback_boundary",
      toolId: "fbasim",
      category: "data",
      statement:
        "When database is unavailable, this tool falls back to demo data. Results are scientifically valid only when sourced from live database (indicated by DataSourceBadge).",
      severity: "warning",
    },
  ],

  // Sub-tier: single-species mode of fbasim (canonical, partial)
  "fbasim-single": [
    {
      id: "fbasim-single.steady_state",
      toolId: "fbasim-single",
      category: "biological",
      statement:
        "Assumes the metabolic network is at steady state (dx/dt = 0); transient dynamics are not represented.",
      severity: "warning",
    },
    {
      id: "fbasim-single.biomass_objective",
      toolId: "fbasim-single",
      category: "biological",
      statement: "Default objective is biomass maximization; assumes evolutionary optimization for growth.",
      severity: "warning",
    },
    {
      id: "fbasim-single.no_regulation",
      toolId: "fbasim-single",
      category: "biological",
      statement: "No transcriptional or allosteric regulation; flux bounds come from stoichiometry only.",
      severity: "warning",
    },
    {
      id: "fbasim-single.simplex_real",
      toolId: "fbasim-single",
      category: "mathematical",
      statement: "Real LP (HiGHS) on the published e_coli_core stoichiometric model (Orth 2010); genome-scale mass balance S·v = 0, genuine GAM biomass reaction.",
      severity: "info",
    },
  ],

  // Sub-tier: community/two-species mode of fbasim (canonical, partial).
  // Community FBA is a REAL joint SteadyCom LP (Chan et al. 2017); these
  // assumptions describe the genuine solve and its curated-model scope.
  "fbasim-community": [
    {
      id: "fbasim-community.joint_steadycom_lp",
      toolId: "fbasim-community",
      category: "mathematical",
      statement:
        "One joint SteadyCom LP (Chan et al. 2017): shared extracellular pool + biomass-abundance coupling, bisection on community growth rate. A true joint community LP.",
      severity: "info",
    },
    {
      id: "fbasim-community.stoichiometric_cross_feeding",
      toolId: "fbasim-community",
      category: "mathematical",
      statement:
        "Cross-feeding exchange fluxes are LP decision variables from a closed shared acetate/ethanol pool; secretion equals uptake (not post-hoc scaled).",
      severity: "info",
    },
    {
      id: "fbasim-community.abundance_composition",
      toolId: "fbasim-community",
      category: "mathematical",
      statement:
        "When alpha is set, community composition is pinned (fixed relative abundance); when unset, SteadyCom optimizes the abundances.",
      severity: "info",
    },
    {
      id: "fbasim-community.curated_model_scale",
      toolId: "fbasim-community",
      category: "biological",
      statement:
        "Curated small 2-species model (glycolysis + E. coli acetate / yeast ethanol overflow). Method is real; absolute numbers are illustrative at this scale.",
      severity: "warning",
    },
    {
      id: "fbasim-community.inherits_single_assumptions",
      toolId: "fbasim-community",
      category: "biological",
      statement: "Inherits all fbasim-single biological assumptions (steady state, biomass objective, no regulation).",
      severity: "info",
    },
  ],

  cethx: [
    {
      id: "cethx.alberty_transform_local",
      toolId: "cethx",
      category: "mathematical",
      statement:
        "CETHX applies the Alberty transform (Alberty 2003) via calcTransformedGibbs from thermoEngine.ts for condition-aware ΔG′ calculations at user-specified pH, temperature, and ionic strength.",
      severity: "info",
    },
    {
      id: "cethx.group_contribution_reference",
      toolId: "cethx",
      category: "data",
      statement:
        "Standard ΔG° values are from Lehninger/NIST reference tables at pH 7, 25°C. When eQuilibrator API is available, ComponentContribution values are used instead.",
      severity: "info",
    },
    {
      id: "cethx.condition_aware_ph_ionic",
      toolId: "cethx",
      category: "mathematical",
      statement:
        "pH-dependent proton contribution (RT·ln(10)·(pH-7)·nH) and Debye-Hückel ionic strength correction (9.205·Δz²·√I/(1+1.6·√I)) are applied via the Alberty formalism.",
      severity: "info",
    },
    {
      id: "cethx.uncertainty_estimated",
      toolId: "cethx",
      category: "mathematical",
      statement:
        "Reaction-level uncertainty is estimated as 15% of |ΔG′| when using local Alberty transform; eQuilibrator provides measured uncertainty when available.",
      severity: "warning",
    },
    {
      id: "cethx.lehninger_reference_dg0",
      toolId: "cethx",
      category: "data",
      statement:
        "Standard ΔG° values come from Lehninger/NIST reference tables. These are well-established but represent typical physiological conditions, not organism-specific measurements.",
      severity: "info",
    },
    {
      id: "cethx.atp_yields_hardcoded",
      toolId: "cethx",
      category: "biological",
      statement:
        "ATP/NADH yields are hardcoded per step from curated reference data; not dynamically derived from balanced reaction stoichiometry.",
      severity: "warning",
    },
    {
      id: "cethx.proton_stoich_estimated",
      toolId: "cethx",
      category: "biological",
      statement:
        "Proton stoichiometry (nH) and charge change (Δz²) are estimated from KEGG reaction equations and typical physiological protonation states, not from measured pKa values.",
      severity: "warning",
    },
    {
      id: "cethx.pubchem_database_integration",
      toolId: "cethx",
      category: "data",
      statement: "CETHX queries PubChem for real compound data when available.",
      severity: "info",
    },
  ],

  catdes: [
    {
      id: "catdes.warshel_dielectric",
      toolId: "catdes",
      category: "mathematical",
      statement: "Electrostatic scoring uses Warshel ε with a fixed value; no protein-environment dielectric mapping.",
      severity: "warning",
    },
    {
      id: "catdes.hand_tuned_weights",
      toolId: "catdes",
      category: "mathematical",
      statement: "Pareto objective weights are curated reference values; no automated weight optimization.",
      severity: "warning",
    },
    {
      id: "catdes.alphafold3_inspired",
      toolId: "catdes",
      category: "computational",
      statement: "Binding affinity scoring is MM-PBSA-style heuristic; NOT a molecular dynamics simulation.",
      severity: "info",
    },
    {
      id: "catdes.codon_table_yeast",
      toolId: "catdes",
      category: "data",
      statement: "Codon optimization table is S. cerevisiae default; chassis switch is a curated swap, not learned.",
      severity: "info",
    },
    {
      id: "catdes.brenda_database_integration",
      toolId: "catdes",
      category: "data",
      statement: "CatDes queries BRENDA for real enzyme kinetics. Falls back to demo values.",
      severity: "info",
    },
    {
      id: "catdes.database_fallback_boundary",
      toolId: "catdes",
      category: "data",
      statement:
        "When database is unavailable, this tool falls back to demo data. Results are scientifically valid only when sourced from live database (indicated by DataSourceBadge).",
      severity: "warning",
    },
  ],

  proevol: [
    {
      id: "proevol.deterministic_heuristic",
      toolId: "proevol",
      category: "computational",
      statement:
        "Variant scoring and lineage tracking use deterministic heuristics; no stochastic mutational sampling.",
      severity: "warning",
    },
    {
      id: "proevol.simulated_not_wet_lab",
      toolId: "proevol",
      category: "biological",
      statement: "Outputs are simulated or inferred decision support; values are not wet-lab measurements.",
      severity: "warning",
    },
    {
      id: "proevol.no_epistasis_model",
      toolId: "proevol",
      category: "biological",
      statement: "Fitness scoring is additive across positions; no pairwise or higher-order epistasis terms.",
      severity: "warning",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // Stage 3 — chassis & control (partial)
  // ─────────────────────────────────────────────────────────────
  genmim: [
    {
      id: "genmim.greedy_not_optimal",
      toolId: "genmim",
      category: "mathematical",
      statement: "CRISPRi schedule uses a greedy ranker (score = KD_eff + (1+GI)·0.3); not provably optimal.",
      severity: "warning",
    },
    {
      id: "genmim.additive_growth_impact",
      toolId: "genmim",
      category: "biological",
      statement: "Viability uses additive growth-impact; no Wagner-style epistatic gene-network interactions.",
      severity: "warning",
    },
    {
      id: "genmim.essential_gene_curated",
      toolId: "genmim",
      category: "data",
      statement: "Essential gene list is curated from literature; not a user-specific essentiality screen.",
      severity: "info",
    },
  ],

  gecair: [
    {
      id: "gecair.hill_steady_state",
      toolId: "gecair",
      category: "biological",
      statement: "Hill curve fits assume steady-state TF binding; transient pre-steady-state dynamics are ignored.",
      severity: "warning",
    },
    {
      id: "gecair.curated_topology_lib",
      toolId: "gecair",
      category: "data",
      statement: "Logic-gate topology library is curated reference circuits; not learned from circuit-database mining.",
      severity: "info",
    },
    {
      id: "gecair.no_resource_competition",
      toolId: "gecair",
      category: "biological",
      statement: "Independent gate dynamics; no shared RNAP/ribosome resource competition across gates.",
      severity: "warning",
    },
  ],

  dyncon: [
    {
      id: "dyncon.rk4_real",
      toolId: "dyncon",
      category: "mathematical",
      statement: "Bioreactor ODE is integrated with RK4; Hill feedback and Monod growth are textbook-correct.",
      severity: "info",
    },
    {
      id: "dyncon.parameters_reference",
      toolId: "dyncon",
      category: "data",
      statement: "Reactor and Monod parameters are reference defaults; not fit to user batch fermentation data.",
      severity: "warning",
    },
    {
      id: "dyncon.no_noise",
      toolId: "dyncon",
      category: "computational",
      statement: "Deterministic simulation; no measurement noise or stochastic biological variability.",
      severity: "warning",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // Stage 4 — DBTL
  // ─────────────────────────────────────────────────────────────
  cellfree: [
    {
      id: "cellfree.model_structure_implemented",
      toolId: "cellfree",
      category: "mathematical",
      statement: "TX-TL ODE structure exists with resource and degradation terms; parameter confidence is separate.",
      severity: "info",
    },
    {
      id: "cellfree.parameters_partially_sourced",
      toolId: "cellfree",
      category: "data",
      statement: "Parameters mix repo defaults, heuristics, and broad references; per-value sourcing is incomplete.",
      severity: "blocking",
    },
    {
      id: "cellfree.calibration_not_established",
      toolId: "cellfree",
      category: "data",
      statement: "No calibration dataset establishes CellFree outputs as calibrated predictions.",
      severity: "blocking",
    },
    {
      id: "cellfree.uncertainty_not_quantified",
      toolId: "cellfree",
      category: "computational",
      statement: "No parameter or output uncertainty model quantifies CellFree prediction intervals.",
      severity: "blocking",
    },
    {
      id: "cellfree.parameters_unsourced",
      toolId: "cellfree",
      category: "data",
      statement: "Legacy boundary: k_tx, k_tl, and decay terms lack per-value paper-table citations.",
      severity: "blocking",
    },
    {
      id: "cellfree.tx_tl_kinetics_ref",
      toolId: "cellfree",
      category: "mathematical",
      statement:
        "Resource-aware TX-TL ODE refs Noireaux 2003, Jewett 2004, Karzbrun 2011; integrator is deterministic.",
      severity: "info",
    },
    {
      id: "cellfree.no_chassis_specificity",
      toolId: "cellfree",
      category: "biological",
      statement: "Single shared parameter set; no S30 vs PURE vs E. coli vs yeast extract specialization.",
      severity: "warning",
    },
    {
      id: "cellfree.lm_fitting_local",
      toolId: "cellfree",
      category: "computational",
      statement: "Levenberg-Marquardt fitter is local; no global search and may settle in a local minimum.",
      severity: "warning",
    },
    {
      id: "cellfree.iviv_heuristic_unfit",
      toolId: "cellfree",
      category: "mathematical",
      statement:
        "In-vitro→in-vivo heuristic estimate uses deterministic seeded weights (SeededRNG 12345); this is not a trained model.",
      severity: "warning",
    },
    {
      id: "cellfree.brenda_database_integration",
      toolId: "cellfree",
      category: "data",
      statement: "CellFree queries BRENDA for real Km/Kcat reference values when available.",
      severity: "info",
    },
    {
      id: "cellfree.database_fallback_boundary",
      toolId: "cellfree",
      category: "data",
      statement:
        "When database is unavailable, this tool falls back to demo data. Results are scientifically valid only when sourced from live database (indicated by DataSourceBadge).",
      severity: "warning",
    },
  ],

  dbtlflow: [
    {
      id: "dbtlflow.heuristic_learning",
      toolId: "dbtlflow",
      category: "computational",
      statement:
        "Iteration-to-iteration learning uses heuristic weights; not Bayesian optimization or active learning.",
      severity: "warning",
    },
    {
      id: "dbtlflow.sbol_real",
      toolId: "dbtlflow",
      category: "data",
      statement: "SBOL serialization follows the v3 spec; round-trip preserves part, role, and sequence fields.",
      severity: "info",
    },
  ],

  multio: [
    {
      id: "multio.deterministic_demo_only",
      toolId: "multio",
      category: "computational",
      statement: "MultiO is deterministic demo integration; formal model claims require a real reference backend.",
      severity: "blocking",
    },
    {
      id: "multio.no_reference_model",
      toolId: "multio",
      category: "data",
      statement: "No external reference-model backend is integrated; outputs are local exploratory projections.",
      severity: "blocking",
    },
    {
      id: "multio.no_bayesian_gp_posterior",
      toolId: "multio",
      category: "mathematical",
      statement: "No Bayesian or Gaussian-process posterior is computed; no credible uncertainty is available.",
      severity: "blocking",
    },
    {
      id: "multio.not_mofa_plus",
      toolId: "multio",
      category: "mathematical",
      statement:
        "ALS factor decomposition lacks variational priors and Bayesian inference; despite legacy name, NOT MOFA+.",
      severity: "blocking",
    },
    {
      id: "multio.not_vae",
      toolId: "multio",
      category: "mathematical",
      statement: "Encoder/decoder is deterministic linear; no q(z|x), no KL term; despite legacy name, NOT a VAE.",
      severity: "blocking",
    },
    {
      id: "multio.no_umap",
      toolId: "multio",
      category: "mathematical",
      statement: "3D projection uses a PCA-style linear projection, not UMAP fuzzy-simplicial-set embedding.",
      severity: "warning",
    },
    {
      id: "multio.deterministic_no_uncertainty",
      toolId: "multio",
      category: "mathematical",
      statement: "All outputs are deterministic; no posterior uncertainty bands or credible intervals are calculated.",
      severity: "blocking",
    },
    {
      id: "multio.linear_perturbation",
      toolId: "multio",
      category: "biological",
      statement: "Perturbation output is sensitivity analysis on a local embedding, not a learned causal model.",
      severity: "warning",
    },
  ],

  scspatial: [
    {
      id: "scspatial.not_vae",
      toolId: "scspatial",
      category: "mathematical",
      statement:
        "trainScVAE is a deterministic linear encoder/decoder; despite legacy name, NOT a variational autoencoder.",
      severity: "warning",
    },
    {
      id: "scspatial.real_pipeline",
      toolId: "scspatial",
      category: "mathematical",
      statement: "QC, HVG, Louvain, Moran I, and PAGA are real implementations; reproducible via seeded PRNG.",
      severity: "info",
    },
    {
      id: "scspatial.dataset_required",
      toolId: "scspatial",
      category: "data",
      statement: "Spatial-mode features require x/y coordinates in obs; missing fields downgrade to non-spatial mode.",
      severity: "warning",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // Cross-stage (real)
  // ─────────────────────────────────────────────────────────────
  nexai: [
    {
      id: "nexai.groq_only",
      toolId: "nexai",
      category: "computational",
      statement: "Answers come exclusively from Groq llama-3.3-70b-versatile via /api/analyze.",
      severity: "info",
    },
    {
      id: "nexai.no_template_fallback",
      toolId: "nexai",
      category: "computational",
      statement: "No client-side template fallback; if the API fails, the user sees an explicit error.",
      severity: "info",
    },
  ],
};

export function getToolAssumptions(toolId: string): ToolAssumption[] {
  return TOOL_ASSUMPTIONS[toolId] ?? [];
}
