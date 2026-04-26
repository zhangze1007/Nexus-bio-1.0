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
 */

import type { ToolAssumption } from '../../../types/assumptions';

export const TOOL_ASSUMPTIONS: Record<string, ToolAssumption[]> = {
  // ─────────────────────────────────────────────────────────────
  // Stage 1 — design (partial)
  // ─────────────────────────────────────────────────────────────
  pathd: [
    {
      id: 'pathd.template_route_synthesis',
      toolId: 'pathd',
      category: 'computational',
      statement:
        'Pathway route synthesis is template-based; no learned retrosynthesis or RXN-prediction model.',
      severity: 'warning',
    },
    {
      id: 'pathd.delta_g_lookup_real',
      toolId: 'pathd',
      category: 'data',
      statement:
        'Pathway ΔG° aggregation uses reference-table values; inherits all CETHX caveats.',
      severity: 'info',
    },
  ],

  'metabolic-eng': [
    {
      id: 'metabolic-eng.shared_engine_with_pathd',
      toolId: 'metabolic-eng',
      category: 'computational',
      statement:
        'UI wraps PathD engine; force-directed layout is heuristic and is for visualization only.',
      severity: 'info',
    },
    {
      id: 'metabolic-eng.live_fba_hooks',
      toolId: 'metabolic-eng',
      category: 'computational',
      statement:
        'Flux overlays come from live /api/fba calls; inherit all fbasim.* assumptions.',
      severity: 'info',
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // Stage 2 — simulation
  // ─────────────────────────────────────────────────────────────
  fbasim: [
    {
      id: 'fbasim.steady_state',
      toolId: 'fbasim',
      category: 'biological',
      statement:
        'Assumes the metabolic network is at steady state (dx/dt = 0); transient dynamics are not represented.',
      severity: 'warning',
    },
    {
      id: 'fbasim.biomass_objective',
      toolId: 'fbasim',
      category: 'biological',
      statement:
        'Default objective is biomass maximization; assumes evolutionary optimization for growth.',
      severity: 'warning',
    },
    {
      id: 'fbasim.no_regulation',
      toolId: 'fbasim',
      category: 'biological',
      statement:
        'No transcriptional or allosteric regulation; flux bounds come from stoichiometry only.',
      severity: 'warning',
    },
    {
      id: 'fbasim.community_not_joint_lp',
      toolId: 'fbasim',
      category: 'mathematical',
      statement:
        'Two-Species mode runs two independent LPs and post-hoc scales exchange flux; NOT a joint community LP.',
      severity: 'warning',
    },
    {
      id: 'fbasim.simplex_real',
      toolId: 'fbasim',
      category: 'mathematical',
      statement:
        'Single-species solver is two-phase simplex LP on the iJO1366 subset (real implementation).',
      severity: 'info',
    },
  ],

  cethx: [
    {
      id: 'cethx.uniform_ph_factor',
      toolId: 'cethx',
      category: 'biological',
      statement:
        'ΔG° pH/T transform uses a uniform 0.1 discount per pH unit; NOT a reaction-specific Alberty transform.',
      severity: 'blocking',
    },
    {
      id: 'cethx.linear_temperature_only',
      toolId: 'cethx',
      category: 'mathematical',
      statement:
        'Temperature dependence is linear T/298.15; ignores enthalpy/entropy split and heat-capacity terms.',
      severity: 'warning',
    },
    {
      id: 'cethx.no_ionic_strength_correction',
      toolId: 'cethx',
      category: 'mathematical',
      statement:
        'No Debye-Hückel ionic strength correction is applied to standard ΔG° values.',
      severity: 'warning',
    },
    {
      id: 'cethx.lehninger_lookup',
      toolId: 'cethx',
      category: 'data',
      statement:
        'ΔG° values are Lehninger/NIST reference table, pH 7, 25 °C; no live group-contribution recompute.',
      severity: 'info',
    },
    {
      id: 'cethx.atp_yields_hardcoded',
      toolId: 'cethx',
      category: 'biological',
      statement:
        'ATP/NADH yields are hardcoded per step; not derived from balanced reaction stoichiometry.',
      severity: 'warning',
    },
  ],

  catdes: [
    {
      id: 'catdes.warshel_dielectric',
      toolId: 'catdes',
      category: 'mathematical',
      statement:
        'Electrostatic scoring uses Warshel ε with a fixed value; no protein-environment dielectric mapping.',
      severity: 'warning',
    },
    {
      id: 'catdes.hand_tuned_weights',
      toolId: 'catdes',
      category: 'mathematical',
      statement:
        'Pareto objective weights are curated reference values; no automated weight optimization.',
      severity: 'warning',
    },
    {
      id: 'catdes.alphafold3_inspired',
      toolId: 'catdes',
      category: 'computational',
      statement:
        'Binding affinity scoring is AlphaFold3-inspired heuristic; NOT the actual AF3 model.',
      severity: 'info',
    },
    {
      id: 'catdes.codon_table_yeast',
      toolId: 'catdes',
      category: 'data',
      statement:
        'Codon optimization table is S. cerevisiae default; chassis switch is a curated swap, not learned.',
      severity: 'info',
    },
  ],

  proevol: [
    {
      id: 'proevol.deterministic_heuristic',
      toolId: 'proevol',
      category: 'computational',
      statement:
        'Variant scoring and lineage tracking use deterministic heuristics; no stochastic mutational sampling.',
      severity: 'warning',
    },
    {
      id: 'proevol.simulated_not_wet_lab',
      toolId: 'proevol',
      category: 'biological',
      statement:
        'Outputs are simulated or inferred decision support; values are not wet-lab measurements.',
      severity: 'warning',
    },
    {
      id: 'proevol.no_epistasis_model',
      toolId: 'proevol',
      category: 'biological',
      statement:
        'Fitness scoring is additive across positions; no pairwise or higher-order epistasis terms.',
      severity: 'warning',
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // Stage 3 — chassis & control (partial)
  // ─────────────────────────────────────────────────────────────
  genmim: [
    {
      id: 'genmim.greedy_not_optimal',
      toolId: 'genmim',
      category: 'mathematical',
      statement:
        'CRISPRi schedule uses a greedy ranker (score = KD_eff + (1+GI)·0.3); not provably optimal.',
      severity: 'warning',
    },
    {
      id: 'genmim.additive_growth_impact',
      toolId: 'genmim',
      category: 'biological',
      statement:
        'Viability uses additive growth-impact; no Wagner-style epistatic gene-network interactions.',
      severity: 'warning',
    },
    {
      id: 'genmim.essential_gene_curated',
      toolId: 'genmim',
      category: 'data',
      statement:
        'Essential gene list is curated from literature; not a user-specific essentiality screen.',
      severity: 'info',
    },
  ],

  gecair: [
    {
      id: 'gecair.hill_steady_state',
      toolId: 'gecair',
      category: 'biological',
      statement:
        'Hill curve fits assume steady-state TF binding; transient pre-steady-state dynamics are ignored.',
      severity: 'warning',
    },
    {
      id: 'gecair.curated_topology_lib',
      toolId: 'gecair',
      category: 'data',
      statement:
        'Logic-gate topology library is curated reference circuits; not learned from circuit-database mining.',
      severity: 'info',
    },
    {
      id: 'gecair.no_resource_competition',
      toolId: 'gecair',
      category: 'biological',
      statement:
        'Independent gate dynamics; no shared RNAP/ribosome resource competition across gates.',
      severity: 'warning',
    },
  ],

  dyncon: [
    {
      id: 'dyncon.rk4_real',
      toolId: 'dyncon',
      category: 'mathematical',
      statement:
        'Bioreactor ODE is integrated with RK4; Hill feedback and Monod growth are textbook-correct.',
      severity: 'info',
    },
    {
      id: 'dyncon.parameters_reference',
      toolId: 'dyncon',
      category: 'data',
      statement:
        'Reactor and Monod parameters are reference defaults; not fit to user batch fermentation data.',
      severity: 'warning',
    },
    {
      id: 'dyncon.no_noise',
      toolId: 'dyncon',
      category: 'computational',
      statement:
        'Deterministic simulation; no measurement noise or stochastic biological variability.',
      severity: 'warning',
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // Stage 4 — DBTL
  // ─────────────────────────────────────────────────────────────
  cellfree: [
    {
      id: 'cellfree.parameters_curated',
      toolId: 'cellfree',
      category: 'data',
      statement:
        'Rate constants k_tx, k_tl, k_decay are curated reference values; not fit to user batch data.',
      severity: 'blocking',
    },
    {
      id: 'cellfree.tx_tl_kinetics_ref',
      toolId: 'cellfree',
      category: 'mathematical',
      statement:
        'Resource-aware TX-TL ODE refs Noireaux 2003, Jewett 2004, Karzbrun 2011; integrator is deterministic.',
      severity: 'info',
    },
    {
      id: 'cellfree.no_chassis_specificity',
      toolId: 'cellfree',
      category: 'biological',
      statement:
        'Single shared parameter set; no S30 vs PURE vs E. coli vs yeast extract specialization.',
      severity: 'warning',
    },
    {
      id: 'cellfree.lm_fitting_local',
      toolId: 'cellfree',
      category: 'computational',
      statement:
        'Levenberg-Marquardt fitter is local; no global search and may settle in a local minimum.',
      severity: 'warning',
    },
    {
      id: 'cellfree.iviv_mlp_unfit',
      toolId: 'cellfree',
      category: 'mathematical',
      statement:
        'In-vitro→in-vivo MLP regression weights ship with reference defaults; not retrained per user.',
      severity: 'warning',
    },
  ],

  dbtlflow: [
    {
      id: 'dbtlflow.heuristic_learning',
      toolId: 'dbtlflow',
      category: 'computational',
      statement:
        'Iteration-to-iteration learning uses heuristic weights; not Bayesian optimization or active learning.',
      severity: 'warning',
    },
    {
      id: 'dbtlflow.sbol_real',
      toolId: 'dbtlflow',
      category: 'data',
      statement:
        'SBOL serialization follows the v3 spec; round-trip preserves part, role, and sequence fields.',
      severity: 'info',
    },
  ],

  multio: [
    {
      id: 'multio.not_mofa_plus',
      toolId: 'multio',
      category: 'mathematical',
      statement:
        'ALS factor decomposition lacks variational priors and Bayesian inference; despite legacy name, NOT MOFA+.',
      severity: 'blocking',
    },
    {
      id: 'multio.not_vae',
      toolId: 'multio',
      category: 'mathematical',
      statement:
        'Encoder/decoder is deterministic linear; no q(z|x), no KL term; despite legacy name, NOT a VAE.',
      severity: 'blocking',
    },
    {
      id: 'multio.no_umap',
      toolId: 'multio',
      category: 'mathematical',
      statement:
        '3D projection uses a PCA-style linear projection, not UMAP fuzzy-simplicial-set embedding.',
      severity: 'warning',
    },
    {
      id: 'multio.deterministic_no_uncertainty',
      toolId: 'multio',
      category: 'mathematical',
      statement:
        'All outputs are deterministic; no posterior uncertainty bands on factor loadings.',
      severity: 'warning',
    },
    {
      id: 'multio.linear_perturbation',
      toolId: 'multio',
      category: 'biological',
      statement:
        'Perturbation prediction is sensitivity analysis on a linear embedding, not a learned causal model.',
      severity: 'info',
    },
  ],

  scspatial: [
    {
      id: 'scspatial.not_vae',
      toolId: 'scspatial',
      category: 'mathematical',
      statement:
        'trainScVAE is a deterministic linear encoder/decoder; despite legacy name, NOT a variational autoencoder.',
      severity: 'warning',
    },
    {
      id: 'scspatial.real_pipeline',
      toolId: 'scspatial',
      category: 'mathematical',
      statement:
        'QC, HVG, Louvain, Moran I, and PAGA are real implementations; reproducible via seeded PRNG.',
      severity: 'info',
    },
    {
      id: 'scspatial.dataset_required',
      toolId: 'scspatial',
      category: 'data',
      statement:
        'Spatial-mode features require x/y coordinates in obs; missing fields downgrade to non-spatial mode.',
      severity: 'warning',
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // Cross-stage (real)
  // ─────────────────────────────────────────────────────────────
  nexai: [
    {
      id: 'nexai.groq_only',
      toolId: 'nexai',
      category: 'computational',
      statement:
        'Answers come exclusively from Groq llama-3.3-70b-versatile via /api/analyze.',
      severity: 'info',
    },
    {
      id: 'nexai.no_template_fallback',
      toolId: 'nexai',
      category: 'computational',
      statement:
        'No client-side template fallback; if the API fails, the user sees an explicit error.',
      severity: 'info',
    },
  ],
};

export function getToolAssumptions(toolId: string): ToolAssumption[] {
  return TOOL_ASSUMPTIONS[toolId] ?? [];
}
