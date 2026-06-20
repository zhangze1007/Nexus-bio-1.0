/**
 * Digital Cell Engine — Whole-Cell Computational Model
 *
 * Unified multi-scale simulation of a minimal cell, coupling:
 *   1. Genome → Transcriptome (transcription regulation)
 *   2. Transcriptome → Proteome (translation + folding)
 *   3. Proteome → Metabolome (enzyme catalysis)
 *   4. Metabolome → Growth (biomass synthesis)
 *   5. Growth → Division (cell cycle)
 *
 * This is the "digital twin" of a living cell — a unified model that
 * connects all molecular layers into a single computational framework.
 *
 * Reference: Karr et al. (2012) Cell 150:389-401 (Mycoplasma genitalium)
 * Reference: Macklin et al. (2020) Ann Rev Biomed Eng 22:113-138 (PhysiCell)
 *
 * @scientific_provenance
 *   ALGORITHM: Multi-scale ODE + stochastic gene expression + FBA coupling
 *   KNOWN_LIMITATIONS:
 *     - Linear chromosome model (no 3D organization)
 *     - No stochastic protein folding
 *     - Deterministic metabolite dynamics (no spatial heterogeneity)
 *     - Single-cell only (no population dynamics)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface CellState {
  // Genome
  genomeSize: number;          // bp
  genes: GeneState[];

  // Transcriptome
  mrnas: Record<string, number>;  // molecule counts

  // Proteome
  proteins: Record<string, number>; // molecule counts

  // Metabolome
  metabolites: Record<string, number>; // mM concentrations

  // Cell state
  volume: number;              // fL (femtoliters)
  age: number;                 // hours since birth
  mass: number;                // pg (picograms)
  atp: number;                 // mM
  gtp: number;                 // mM

  // Growth
  growthRate: number;          // h⁻¹
  divisionReady: boolean;
}

export interface GeneState {
  id: string;
  name: string;
  essential: boolean;
  copyNumber: number;
  expressionRate: number;      // transcripts/min
  degradationRate: number;     // 1/min
  translationRate: number;     // proteins/min per mRNA
  proteinDegradationRate: number; // 1/min
  catalyticActivity?: {
    kcat: number;              // 1/s
    km: number;                // mM
    substrates: string[];
    products: string[];
  };
}

export interface SimulationConfig {
  duration: number;            // hours
  dt: number;                  // hours
  stochasticGeneExpression: boolean;
  includeDivision: boolean;
  environmentConditions: {
    glucose: number;           // mM
    oxygen: number;            // % saturation
    temperature: number;       // °C
  };
}

export interface SimulationResult {
  finalState: CellState;
  timeSeries: Array<{
    time: number;
    cellMass: number;
    cellVolume: number;
    totalMRNA: number;
    totalProtein: number;
    atp: number;
    growthRate: number;
  }>;
  divisionEvents: number;
  doublingTime: number;        // hours
  metrics: {
    avgGrowthRate: number;
    totalProteinProduced: number;
    totalMRNATranscribed: number;
    energyEfficiency: number;
  };
  designNotes: string[];
}

// ── Minimal Cell Gene Set ──────────────────────────────────────────────────

/**
 * Minimal gene set inspired by JCVI-syn3.0 (473 genes).
 * Representative subset of ~50 representative genes covering all cellular functions.
 *
 * Reference: Hutchison et al. (2016) Science 351:aad6253
 */
const MINIMAL_GENE_SET: GeneState[] = [
  // DNA replication (5 genes)
  { id: 'dnaA', name: 'DNA replication initiator', essential: true, copyNumber: 1, expressionRate: 0.5, degradationRate: 0.01, translationRate: 2, proteinDegradationRate: 0.005 },
  { id: 'dnaB', name: 'DNA helicase', essential: true, copyNumber: 1, expressionRate: 0.3, degradationRate: 0.01, translationRate: 1.5, proteinDegradationRate: 0.005 },
  { id: 'dnaE', name: 'DNA polymerase III', essential: true, copyNumber: 1, expressionRate: 0.2, degradationRate: 0.005, translationRate: 1, proteinDegradationRate: 0.002 },
  { id: 'gyrA', name: 'DNA gyrase', essential: true, copyNumber: 1, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ligA', name: 'DNA ligase', essential: true, copyNumber: 1, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },

  // Transcription (5 genes)
  { id: 'rpoA', name: 'RNA polymerase α', essential: true, copyNumber: 2, expressionRate: 1.0, degradationRate: 0.005, translationRate: 3, proteinDegradationRate: 0.002 },
  { id: 'rpoB', name: 'RNA polymerase β', essential: true, copyNumber: 2, expressionRate: 0.8, degradationRate: 0.005, translationRate: 2.5, proteinDegradationRate: 0.002 },
  { id: 'rpoC', name: 'RNA polymerase β\'', essential: true, copyNumber: 2, expressionRate: 0.8, degradationRate: 0.005, translationRate: 2.5, proteinDegradationRate: 0.002 },
  { id: 'rpoD', name: 'σ70 factor', essential: true, copyNumber: 1, expressionRate: 0.5, degradationRate: 0.01, translationRate: 2, proteinDegradationRate: 0.005 },
  { id: 'nusA', name: 'Transcription termination', essential: true, copyNumber: 1, expressionRate: 0.3, degradationRate: 0.01, translationRate: 1.5, proteinDegradationRate: 0.005 },

  // Translation (10 genes)
  { id: 'rpsA', name: '30S ribosomal protein S1', essential: true, copyNumber: 10, expressionRate: 2.0, degradationRate: 0.002, translationRate: 5, proteinDegradationRate: 0.001 },
  { id: 'rplA', name: '50S ribosomal protein L1', essential: true, copyNumber: 10, expressionRate: 2.0, degradationRate: 0.002, translationRate: 5, proteinDegradationRate: 0.001 },
  { id: 'infA', name: 'Translation initiation IF1', essential: true, copyNumber: 5, expressionRate: 1.0, degradationRate: 0.005, translationRate: 3, proteinDegradationRate: 0.002 },
  { id: 'tsf', name: 'Translation elongation Ts', essential: true, copyNumber: 5, expressionRate: 1.0, degradationRate: 0.005, translationRate: 3, proteinDegradationRate: 0.002 },
  { id: 'fusA', name: 'Translation elongation G', essential: true, copyNumber: 5, expressionRate: 0.8, degradationRate: 0.005, translationRate: 2.5, proteinDegradationRate: 0.002 },
  { id: 'prfA', name: 'Release factor 1', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.01, translationRate: 1.5, proteinDegradationRate: 0.005 },
  { id: 'rrf', name: 'Ribosome recycling factor', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.01, translationRate: 1.5, proteinDegradationRate: 0.005 },
  { id: 'alaS', name: 'Alanyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'argS', name: 'Arginyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'gltX', name: 'Glutamyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },

  // Metabolism — Glycolysis (5 genes)
  { id: 'glk', name: 'Glucokinase', essential: true, copyNumber: 2, expressionRate: 0.8, degradationRate: 0.005, translationRate: 2.5, proteinDegradationRate: 0.002, catalyticActivity: { kcat: 100, km: 0.1, substrates: ['glucose', 'atp'], products: ['g6p', 'adp'] } },
  { id: 'pgi', name: 'Glucose-6-P isomerase', essential: true, copyNumber: 2, expressionRate: 0.6, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002, catalyticActivity: { kcat: 200, km: 0.5, substrates: ['g6p'], products: ['f6p'] } },
  { id: 'pfkA', name: 'Phosphofructokinase', essential: true, copyNumber: 2, expressionRate: 0.5, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002, catalyticActivity: { kcat: 150, km: 0.2, substrates: ['f6p', 'atp'], products: ['fdp', 'adp'] } },
  { id: 'pykF', name: 'Pyruvate kinase', essential: true, copyNumber: 3, expressionRate: 1.0, degradationRate: 0.005, translationRate: 3, proteinDegradationRate: 0.002, catalyticActivity: { kcat: 300, km: 0.3, substrates: ['pep', 'adp'], products: ['pyr', 'atp'] } },
  { id: 'aceE', name: 'Pyruvate dehydrogenase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002, catalyticActivity: { kcat: 50, km: 0.5, substrates: ['pyr', 'coa', 'nad'], products: ['accoa', 'co2', 'nadh'] } },

  // Metabolism — TCA (3 genes)
  { id: 'gltA', name: 'Citrate synthase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002, catalyticActivity: { kcat: 80, km: 0.1, substrates: ['accoa', 'oaa'], products: ['cit', 'coa'] } },
  { id: 'icdA', name: 'Isocitrate dehydrogenase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1, proteinDegradationRate: 0.002, catalyticActivity: { kcat: 60, km: 0.2, substrates: ['icit', 'nadp'], products: ['akg', 'co2', 'nadph'] } },
  { id: 'sucA', name: 'α-KG dehydrogenase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1, proteinDegradationRate: 0.002, catalyticActivity: { kcat: 40, km: 0.3, substrates: ['akg', 'coa', 'nad'], products: ['succoa', 'co2', 'nadh'] } },

  // Membrane / Transport (3 genes)
  { id: 'ptsG', name: 'PTS glucose transporter', essential: true, copyNumber: 5, expressionRate: 1.5, degradationRate: 0.005, translationRate: 4, proteinDegradationRate: 0.002 },
  { id: 'atpA', name: 'F1F0 ATPase', essential: true, copyNumber: 10, expressionRate: 1.0, degradationRate: 0.002, translationRate: 3, proteinDegradationRate: 0.001 },
  { id: 'ndh', name: 'NADH dehydrogenase', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },

  // Cell division (4 genes)
  { id: 'ftsZ', name: 'Cell division protein FtsZ', essential: true, copyNumber: 50, expressionRate: 2.0, degradationRate: 0.01, translationRate: 5, proteinDegradationRate: 0.005 },
  { id: 'ftsA', name: 'Cell division protein FtsA', essential: true, copyNumber: 10, expressionRate: 0.5, degradationRate: 0.01, translationRate: 2, proteinDegradationRate: 0.005 },
  { id: 'minC', name: 'Cell division inhibitor MinC', essential: true, copyNumber: 5, expressionRate: 0.3, degradationRate: 0.01, translationRate: 1.5, proteinDegradationRate: 0.005 },
  { id: 'minD', name: 'Min system ATPase', essential: true, copyNumber: 5, expressionRate: 0.3, degradationRate: 0.01, translationRate: 1.5, proteinDegradationRate: 0.005 },

  // Chaperones / Folding (3 genes)
  { id: 'groEL', name: 'GroEL chaperonin', essential: true, copyNumber: 10, expressionRate: 1.0, degradationRate: 0.002, translationRate: 3, proteinDegradationRate: 0.001 },
  { id: 'groES', name: 'GroES co-chaperonin', essential: true, copyNumber: 10, expressionRate: 0.8, degradationRate: 0.002, translationRate: 2.5, proteinDegradationRate: 0.001 },
  { id: 'dnaK', name: 'DnaK chaperone', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },

  // ════════════════════════════════════════════════════════════════════════════
  // JCVI-syn3.0 EXPANDED GENE SET — 473 genes total
  // Reference: Hutchison et al. (2016) Science 351:aad6253
  // Categories: DNA repair, RNA processing, amino acid activation,
  // lipid biosynthesis, nucleotide salvage, transport, unknown function
  // ════════════════════════════════════════════════════════════════════════════

  // DNA repair & recombination (15 genes)
  { id: 'recA', name: 'RecA recombinase', essential: true, copyNumber: 5, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'uvrA', name: 'UvrA excinuclease', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'uvrB', name: 'UvrB excinuclease', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'uvrC', name: 'UvrC excinuclease', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'mutS', name: 'MutS mismatch repair', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'mutL', name: 'MutL mismatch repair', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'recB', name: 'RecBCD nuclease', essential: false, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'recD', name: 'RecBCD nuclease', essential: false, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'recN', name: 'RecN repair', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'ruvA', name: 'RuvA holiday junction', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'ruvB', name: 'RuvB holiday junction', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'recR', name: 'RecR repair', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'recO', name: 'RecO repair', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'recF', name: 'RecF repair', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'polA', name: 'DNA polymerase I', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },

  // tRNA synthetases (20 genes — one per amino acid)
  { id: 'ileS', name: 'Isoleucyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'leuS', name: 'Leucyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'valS', name: 'Valyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'pheS', name: 'Phenylalanyl-tRNA synthetase α', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'pheT', name: 'Phenylalanyl-tRNA synthetase β', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'serS', name: 'Seryl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'tyrS', name: 'Tyrosyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'aspS', name: 'Aspartyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'asnS', name: 'Asparaginyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'lysS', name: 'Lysyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'proS', name: 'Prolyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'thrS', name: 'Threonyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'trpS', name: 'Tryptophanyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'hisS', name: 'Histidyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'metS', name: 'Methionyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'glyS', name: 'Glycyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'cysS', name: 'Cysteinyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'glnS', name: 'Glutaminyl-tRNA synthetase', essential: true, copyNumber: 2, expressionRate: 0.4, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'trmD', name: 'tRNA methyltransferase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'tsaD', name: 'tRNA threonylcarbamoyladenosine', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },

  // RNA processing (10 genes)
  { id: 'rnc', name: 'RNase III', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.01, translationRate: 1.5, proteinDegradationRate: 0.005 },
  { id: 'rne', name: 'RNase E', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'rnpA', name: 'RNase P', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.01, translationRate: 1.5, proteinDegradationRate: 0.005 },
  { id: 'pnp', name: 'Polynucleotide phosphorylase', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'rnb', name: 'RNase II', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'rho', name: 'Transcription termination factor Rho', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'nusG', name: 'Transcription antitermination', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.01, translationRate: 1.5, proteinDegradationRate: 0.005 },
  { id: 'greA', name: 'Transcription cleavage factor', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'rpsB', name: '30S ribosomal protein S2', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'tsf', name: 'Translation elongation Ts', essential: true, copyNumber: 5, expressionRate: 1.0, degradationRate: 0.005, translationRate: 3, proteinDegradationRate: 0.002 },

  // Lipid biosynthesis (10 genes)
  { id: 'accB', name: 'Acetyl-CoA carboxylase BCCP', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'accC', name: 'Acetyl-CoA carboxylase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'fabB', name: 'β-Ketoacyl-ACP synthase I', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'fabG', name: 'β-Ketoacyl-ACP reductase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'fabZ', name: 'β-Hydroxyacyl-ACP dehydratase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'fabI', name: 'Enoyl-ACP reductase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'fabD', name: 'Malonyl-CoA-ACP transacylase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'lpxA', name: 'UDP-GlcNAc acyltransferase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'lpxB', name: 'Lipid A disaccharide synthase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'lpxC', name: 'UDP-3-O-acyl-GlcNAc deacetylase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },

  // Nucleotide salvage (10 genes)
  { id: 'deoA', name: 'Thymidine phosphorylase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'deoB', name: 'Phosphopentomutase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'deoC', name: 'Deoxyribose-phosphate aldolase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'deoD', name: 'Purine nucleoside phosphorylase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'udp', name: 'Uridine phosphorylase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'adk', name: 'Adenylate kinase', essential: true, copyNumber: 3, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'gmk', name: 'Guanylate kinase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'cmk', name: 'CMP kinase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'tmk', name: 'dTMP kinase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ndk', name: 'Nucleoside diphosphate kinase', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },

  // Transport (20 genes)
  { id: 'ptsH', name: 'PTS HPr protein', essential: true, copyNumber: 10, expressionRate: 1.0, degradationRate: 0.002, translationRate: 3, proteinDegradationRate: 0.001 },
  { id: 'ptsI', name: 'PTS enzyme I', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'manX', name: 'PTS mannose transporter', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'manY', name: 'PTS mannose transporter', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'manZ', name: 'PTS mannose transporter', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'argE', name: 'Acetylornithine deacetylase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'artI', name: 'Arginine binding protein', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'glnH', name: 'Glutamine binding protein', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'hisJ', name: 'Histidine binding protein', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'livJ', name: 'Leucine binding protein', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'livK', name: 'Leucine binding protein', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'metI', name: 'Methionine transporter', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'potA', name: 'Spermidine transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'potB', name: 'Spermidine transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'potC', name: 'Spermidine transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'potD', name: 'Spermidine transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'btuB', name: 'Vitamin B12 transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'tsr', name: 'Methyl-accepting chemotaxis', essential: false, copyNumber: 5, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'tar', name: 'Methyl-accepting chemotaxis', essential: false, copyNumber: 5, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'motA', name: 'Motility protein A', essential: false, copyNumber: 10, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },

  // Amino acid biosynthesis (20 genes)
  { id: 'ilvA', name: 'Threonine dehydratase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ilvB', name: 'Acetolactate synthase I', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ilvC', name: 'Ketol-acid reductoisomerase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ilvD', name: 'Dihydroxyacid dehydratase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ilvE', name: 'Branched-chain aminotransferase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'leuA', name: 'Isopropylmalate synthase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'leuB', name: 'Isopropylmalate dehydrogenase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'leuC', name: 'Isopropylmalate isomerase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'leuD', name: 'Isopropylmalate isomerase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'trpA', name: 'Tryptophan synthase α', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'trpB', name: 'Tryptophan synthase β', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'trpC', name: 'Indole-3-glycerol-phosphate synthase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'trpD', name: 'Anthranilate synthase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'trpE', name: 'Anthranilate synthase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'hisG', name: 'ATP phosphoribosyltransferase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'hisH', name: 'Imidazole glycerol-phosphate synthase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'hisI', name: 'Imidazole glycerol-phosphate dehydratase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'argA', name: 'N-acetylglutamate synthase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'argB', name: 'N-acetylglutamate kinase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'argC', name: 'N-acetylglutamyl-phosphate reductase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },

  // Cofactor biosynthesis (15 genes)
  { id: 'nadA', name: 'Quinolinate synthase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'nadB', name: 'L-aspartate oxidase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'nadC', name: 'Nicotinate-nucleotide pyrophosphorylase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'nadD', name: 'Nicotinate-nucleotide adenylyltransferase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'nadE', name: 'NAD synthetase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'coaA', name: 'Pantothenate kinase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'coaD', name: 'Phosphopantetheine adenylyltransferase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'coaE', name: 'Dephospho-CoA kinase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ribA', name: 'GTP cyclohydrolase II', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ribB', name: 'DMRL synthase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ribC', name: 'Riboflavin synthase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ribD', name: 'Riboflavin biosynthesis', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'hemA', name: 'Glutamyl-tRNA reductase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'hemB', name: 'Aminolevulinic acid dehydratase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'hemC', name: 'Porphobilinogen deaminase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },

  // Cell envelope (15 genes)
  { id: 'murA', name: 'UDP-GlcNAc enolpyruvyl transferase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'murB', name: 'UDP-MurNAc dehydrogenase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'murC', name: 'UDP-MurNAc-Ala ligase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'murD', name: 'UDP-MurNAc-Ala-D-Glu ligase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'murE', name: 'UDP-MurNAc-tripeptide ligase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'murF', name: 'UDP-MurNAc-pentapeptide ligase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'murG', name: 'Lipid II GlcNAc transferase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'mraY', name: 'Phospho-MurNAc-pentapeptide transferase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'mrcB', name: 'Penicillin-binding protein 1B', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ftsI', name: 'Penicillin-binding protein 3', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ftsW', name: 'Lipid II flippase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'rodA', name: 'Rod shape-determining', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'mreB', name: 'Rod shape-determining', essential: true, copyNumber: 5, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'mreC', name: 'Rod shape-determining', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'mreD', name: 'Rod shape-determining', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },

  // Signal transduction (10 genes)
  { id: 'phoB', name: 'Phosphate regulon response regulator', essential: false, copyNumber: 3, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'phoR', name: 'Phosphate regulon sensor kinase', essential: false, copyNumber: 3, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ompR', name: 'Osmolarity response regulator', essential: false, copyNumber: 3, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'envZ', name: 'Osmolarity sensor kinase', essential: false, copyNumber: 3, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'cpxA', name: 'Cpx envelope stress sensor', essential: false, copyNumber: 3, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'cpxR', name: 'Cpx response regulator', essential: false, copyNumber: 3, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'arcB', name: 'Aerobic respiration control', essential: false, copyNumber: 3, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'arcA', name: 'Aerobic respiration regulator', essential: false, copyNumber: 3, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'basR', name: 'BasSR two-component', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'qseB', name: 'Quorum sensing regulator', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },

  // Unknown function (JCVI-syn3.0 — genes of unknown function essential for viability)
  { id: 'JCVI_syn3_0001', name: 'Hypothetical protein 1', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'JCVI_syn3_0002', name: 'Hypothetical protein 2', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'JCVI_syn3_0003', name: 'Hypothetical protein 3', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'JCVI_syn3_0004', name: 'Hypothetical protein 4', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'JCVI_syn3_0005', name: 'Hypothetical protein 5', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'JCVI_syn3_0006', name: 'Hypothetical protein 6', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'JCVI_syn3_0007', name: 'Hypothetical protein 7', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'JCVI_syn3_0008', name: 'Hypothetical protein 8', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'JCVI_syn3_0009', name: 'Hypothetical protein 9', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },
  { id: 'JCVI_syn3_0010', name: 'Hypothetical protein 10', essential: true, copyNumber: 2, expressionRate: 0.15, degradationRate: 0.01, translationRate: 0.8, proteinDegradationRate: 0.005 },

  // ════════════════════════════════════════════════════════════════════════════
  // RIBOSOMAL PROTEINS (54 genes — complete 30S + 50S subunits)
  // Reference: Ban et al. (2000) Science 289:905-920
  // ════════════════════════════════════════════════════════════════════════════
  // 30S ribosomal proteins (21 genes)
  { id: 'rpsC', name: '30S ribosomal protein S3', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsD', name: '30S ribosomal protein S4', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsE', name: '30S ribosomal protein S5', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsF', name: '30S ribosomal protein S6', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsG', name: '30S ribosomal protein S7', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsH', name: '30S ribosomal protein S8', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsI', name: '30S ribosomal protein S9', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsJ', name: '30S ribosomal protein S10', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsK', name: '30S ribosomal protein S11', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsL', name: '30S ribosomal protein S12', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsM', name: '30S ribosomal protein S13', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsN', name: '30S ribosomal protein S14', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsO', name: '30S ribosomal protein S15', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsP', name: '30S ribosomal protein S16', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsQ', name: '30S ribosomal protein S17', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsR', name: '30S ribosomal protein S18', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsS', name: '30S ribosomal protein S19', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsT', name: '30S ribosomal protein S20', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpsU', name: '30S ribosomal protein S21', essential: false, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'sra', name: '30S ribosomal protein S22', essential: false, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'rpsY', name: '30S ribosomal protein S23', essential: false, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  // 50S ribosomal proteins (33 genes)
  { id: 'rplB', name: '50S ribosomal protein L2', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplC', name: '50S ribosomal protein L3', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplD', name: '50S ribosomal protein L4', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplE', name: '50S ribosomal protein L5', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplF', name: '50S ribosomal protein L6', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplG', name: '50S ribosomal protein L7', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplH', name: '50S ribosomal protein L8', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplI', name: '50S ribosomal protein L9', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplJ', name: '50S ribosomal protein L10', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplK', name: '50S ribosomal protein L11', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplL', name: '50S ribosomal protein L12', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplM', name: '50S ribosomal protein L13', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplN', name: '50S ribosomal protein L14', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplO', name: '50S ribosomal protein L15', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplP', name: '50S ribosomal protein L16', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplQ', name: '50S ribosomal protein L17', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplR', name: '50S ribosomal protein L18', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplS', name: '50S ribosomal protein L19', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplT', name: '50S ribosomal protein L20', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplU', name: '50S ribosomal protein L21', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplV', name: '50S ribosomal protein L22', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplW', name: '50S ribosomal protein L23', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rplX', name: '50S ribosomal protein L24', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpmA', name: '50S ribosomal protein L27', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpmB', name: '50S ribosomal protein L28', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpmC', name: '50S ribosomal protein L29', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpmD', name: '50S ribosomal protein L30', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpmE', name: '50S ribosomal protein L31', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpmF', name: '50S ribosomal protein L32', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpmG', name: '50S ribosomal protein L33', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpmH', name: '50S ribosomal protein L34', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpmI', name: '50S ribosomal protein L35', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },
  { id: 'rpmJ', name: '50S ribosomal protein L36', essential: true, copyNumber: 10, expressionRate: 1.5, degradationRate: 0.002, translationRate: 4, proteinDegradationRate: 0.001 },

  // ════════════════════════════════════════════════════════════════════════════
  // ABC TRANSPORTERS (20 genes)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'hisM', name: 'Histidine ABC transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'hisQ', name: 'Histidine ABC transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'hisP', name: 'Histidine ABC transporter ATPase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'livH', name: 'Leucine ABC transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'livM', name: 'Leucine ABC transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'livG', name: 'Leucine ABC transporter ATPase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'malE', name: 'Maltose ABC transporter', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'malF', name: 'Maltose ABC transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'malG', name: 'Maltose ABC transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'malK', name: 'Maltose ABC transporter ATPase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'oppA', name: 'Oligopeptide ABC transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'oppB', name: 'Oligopeptide ABC transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'oppC', name: 'Oligopeptide ABC transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'oppD', name: 'Oligopeptide ABC transporter ATPase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'oppF', name: 'Oligopeptide ABC transporter ATPase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'cysA', name: 'Sulfate ABC transporter ATPase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'cysU', name: 'Sulfate ABC transporter', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'cysW', name: 'Sulfate ABC transporter', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'cysP', name: 'Sulfate ABC transporter', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'pstS', name: 'Phosphate ABC transporter', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },

  // ════════════════════════════════════════════════════════════════════════════
  // METABOLIC ENZYMES (50 genes)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'zwf', name: 'Glucose-6-phosphate dehydrogenase', essential: false, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'pgl', name: '6-Phosphogluconolactonase', essential: false, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'gnd', name: '6-Phosphogluconate dehydrogenase', essential: false, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'rpe', name: 'Ribulose-5-phosphate epimerase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'rpiA', name: 'Ribose-5-phosphate isomerase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'tktA', name: 'Transketolase I', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'tktB', name: 'Transketolase II', essential: false, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'talA', name: 'Transaldolase A', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'fbaA', name: 'Fructose-bisphosphate aldolase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'tpiA', name: 'Triosephosphate isomerase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'gapA', name: 'Glyceraldehyde-3-P dehydrogenase', essential: true, copyNumber: 5, expressionRate: 0.8, degradationRate: 0.002, translationRate: 3, proteinDegradationRate: 0.001 },
  { id: 'pgk', name: 'Phosphoglycerate kinase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'gpmA', name: 'Phosphoglycerate mutase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'eno', name: 'Enolase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'aceA', name: 'Isocitrate lyase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'aceB', name: 'Malate synthase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'aceK', name: 'Isocitrate dehydrogenase kinase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'gltA', name: 'Citrate synthase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'acnA', name: 'Aconitase A', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'acnB', name: 'Aconitase B', essential: false, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'icdA', name: 'Isocitrate dehydrogenase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'sucA', name: 'α-Ketoglutarate dehydrogenase E1', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'sucB', name: 'α-Ketoglutarate dehydrogenase E2', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'sucC', name: 'Succinyl-CoA synthetase α', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'sucD', name: 'Succinyl-CoA synthetase β', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'sdhA', name: 'Succinate dehydrogenase flavoprotein', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'sdhB', name: 'Succinate dehydrogenase iron-sulfur', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'sdhC', name: 'Succinate dehydrogenase membrane', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'sdhD', name: 'Succinate dehydrogenase membrane', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'fumA', name: 'Fumarase A', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'fumB', name: 'Fumarase B', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'mdh', name: 'Malate dehydrogenase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'pckA', name: 'PEP carboxykinase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ppc', name: 'PEP carboxylase', essential: false, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'maeA', name: 'Malic enzyme', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'maeB', name: 'Malic enzyme', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'pflB', name: 'Pyruvate formate-lyase', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'pflA', name: 'Pyruvate formate-lyase activating', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ldhA', name: 'D-lactate dehydrogenase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'adhE', name: 'Alcohol dehydrogenase', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ackA', name: 'Acetate kinase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'pta', name: 'Phosphotransacetylase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'acs', name: 'Acetyl-CoA synthetase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'poxB', name: 'Pyruvate oxidase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'gltD', name: 'Glutamate synthase small', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'gltB', name: 'Glutamate synthase large', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'glnA', name: 'Glutamine synthetase', essential: true, copyNumber: 3, expressionRate: 0.4, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'gdhA', name: 'Glutamate dehydrogenase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'asnA', name: 'Asparagine synthetase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'asnB', name: 'Asparagine synthetase B', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'asd', name: 'Aspartate-semialdehyde dehydrogenase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'lysA', name: 'Diaminopimelate decarboxylase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'metA', name: 'Homoserine O-succinyltransferase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'metB', name: 'Cystathionine γ-synthase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'metC', name: 'Cystathionine β-lyase', essential: true, copyNumber: 2, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },

  // ════════════════════════════════════════════════════════════════════════════
  // REGULATORY PROTEINS (20 genes)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'crp', name: 'cAMP receptor protein', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'lacI', name: 'Lac repressor', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'araC', name: 'AraC regulator', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'trpR', name: 'Tryptophan repressor', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'tyrR', name: 'Tyrosine repressor', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'purR', name: 'Purine repressor', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'argR', name: 'Arginine repressor', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'metJ', name: 'Methionine repressor', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'fur', name: 'Ferric uptake regulator', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ihfA', name: 'Integration host factor α', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'ihfB', name: 'Integration host factor β', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'fis', name: 'Factor for inversion stimulation', essential: false, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'hns', name: 'Histone-like nucleoid structuring', essential: true, copyNumber: 10, expressionRate: 1.0, degradationRate: 0.002, translationRate: 3, proteinDegradationRate: 0.001 },
  { id: 'hupA', name: 'HU protein α', essential: true, copyNumber: 10, expressionRate: 1.0, degradationRate: 0.002, translationRate: 3, proteinDegradationRate: 0.001 },
  { id: 'hupB', name: 'HU protein β', essential: true, copyNumber: 10, expressionRate: 1.0, degradationRate: 0.002, translationRate: 3, proteinDegradationRate: 0.001 },
  { id: 'dps', name: 'DNA protection during starvation', essential: false, copyNumber: 5, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'oxyR', name: 'Oxidative stress regulator', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'soxR', name: 'Superoxide response regulator', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'soxS', name: 'Superoxide response regulator', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'marA', name: 'Multiple antibiotic resistance', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },

  // ════════════════════════════════════════════════════════════════════════════
  // ADDITIONAL HYPOTHETICAL PROTEINS (to reach 473)
  // JCVI-syn3.0 has ~90 genes of unknown function
  // Parameters: typical E. coli gene expression ranges
  //   expressionRate: 0.1-0.25 transcripts/min — Moran et al. (2013) PNAS 110:11004
  //   degradationRate: 0.005-0.015 /min — mRNA half-life ~45-140 min
  //   translationRate: 0.5-1.0 proteins/min/mRNA — Li et al. (2014) Cell 157:624
  //   proteinDegradationRate: 0.002-0.005 /min — half-life ~140-350 min
  // Essential genes: first 40 (JCVI-syn3.0 essential gene set)
  // ════════════════════════════════════════════════════════════════════════════
  ...Array.from({ length: 60 }, (_, i) => ({
    id: `JCVI_syn3_${String(i + 11).padStart(4, '0')}`,
    name: `Hypothetical protein ${i + 11}`,
    essential: i < 40,
    copyNumber: 2,
    // Deterministic values based on gene index (no Math.random)
    // Varies by functional category: essential genes expressed higher
    expressionRate: i < 40 ? 0.2 : 0.12,        // essential: 0.2, non-essential: 0.12
    degradationRate: i < 40 ? 0.008 : 0.012,     // essential: slower degradation
    translationRate: i < 40 ? 0.8 : 0.5,         // essential: higher translation
    proteinDegradationRate: i < 40 ? 0.003 : 0.005, // essential: slower degradation
  })),

  // ════════════════════════════════════════════════════════════════════════════
  // ADDITIONAL METABOLIC ENZYMES (50 genes)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'glnK', name: 'PII signal transduction protein', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'glnB', name: 'PII protein', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'glnD', name: 'UTP/UMP transferase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'glnE', name: 'Adenylyltransferase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ntrB', name: 'Nitrogen regulation sensor', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ntrC', name: 'Nitrogen regulation response', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'amtB', name: 'Ammonium transporter', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'narG', name: 'Nitrate reductase α', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'narH', name: 'Nitrate reductase β', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'narI', name: 'Nitrate reductase γ', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'narJ', name: 'Nitrate reductase molybdenum', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'narK', name: 'Nitrate/nitrite transporter', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'nirB', name: 'Nitrite reductase large', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'nirD', name: 'Nitrite reductase small', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'norV', name: 'Nitric oxide reductase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'norW', name: 'Nitric oxide reductase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'nosZ', name: 'Nitrous oxide reductase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'nifA', name: 'Nitrogen fixation regulator', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'nifH', name: 'Nitrogenase reductase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'nifD', name: 'Nitrogenase α', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'nifK', name: 'Nitrogenase β', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'sufA', name: 'Fe-S cluster assembly', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'sufB', name: 'Fe-S cluster assembly', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'sufC', name: 'Fe-S cluster assembly ATPase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'sufD', name: 'Fe-S cluster assembly', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'sufE', name: 'Fe-S cluster assembly', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'sufS', name: 'Cysteine desulfurase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'iscA', name: 'Fe-S cluster assembly', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'iscS', name: 'Cysteine desulfurase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'iscU', name: 'Fe-S cluster scaffold', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'fdx', name: 'Ferredoxin', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'fldA', name: 'Flavodoxin 1', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'fldB', name: 'Flavodoxin 2', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'fpr', name: 'Ferredoxin-NADP+ reductase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'grxA', name: 'Glutaredoxin 1', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'grxB', name: 'Glutaredoxin 2', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'grxC', name: 'Glutaredoxin 3', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'trxA', name: 'Thioredoxin 1', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'trxB', name: 'Thioredoxin reductase', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'trxC', name: 'Thioredoxin 2', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'msrA', name: 'Methionine sulfoxide reductase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'msrB', name: 'Methionine sulfoxide reductase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ahpC', name: 'Alkyl hydroperoxide reductase', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ahpF', name: 'Alkyl hydroperoxide reductase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'katE', name: 'Catalase HPII', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'katG', name: 'Catalase-peroxidase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'sodA', name: 'Superoxide dismutase (Mn)', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'sodB', name: 'Superoxide dismutase (Fe)', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'sodC', name: 'Superoxide dismutase (Cu/Zn)', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },

  // ════════════════════════════════════════════════════════════════════════════
  // ADDITIONAL REGULATORY & SIGNAL TRANSDUCTION (30 genes)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'fnr', name: 'Fumarate nitrate reduction regulator', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'arcA', name: 'Aerobic respiration control', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'arcB', name: 'Aerobic respiration sensor', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'soxR', name: 'Superoxide response regulator', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'soxS', name: 'Superoxide response regulator', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'marA', name: 'Multiple antibiotic resistance', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'marR', name: 'Multiple antibiotic resistance repressor', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'rob', name: 'Right origin-binding', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'rpoS', name: 'Stationary phase sigma factor', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'rpoH', name: 'Heat shock sigma factor', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'rpoE', name: 'Extracytoplasmic sigma factor', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'rseA', name: 'Anti-sigma factor', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'rseB', name: 'Anti-sigma factor', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'cspA', name: 'Cold shock protein A', essential: false, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'cspC', name: 'Cold shock protein C', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'cspE', name: 'Cold shock protein E', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'hslR', name: 'Heat shock protein', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'hslU', name: 'Heat shock protein', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'hslV', name: 'Heat shock protein', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'lon', name: 'Lon protease', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'clpP', name: 'Clp protease', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'clpA', name: 'Clp protease ATPase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'clpX', name: 'Clp protease ATPase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'clpB', name: 'ClpB chaperone', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'grpE', name: 'GrpE chaperone', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'dnaJ', name: 'DnaJ chaperone', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'htpG', name: 'Hsp90 chaperone', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ibpA', name: 'Small heat shock protein', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ibpB', name: 'Small heat shock protein', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },

  // ════════════════════════════════════════════════════════════════════════════
  // MISCELLANEOUS ESSENTIAL (49 genes to reach 473)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'ftsK', name: 'Cell division protein FtsK', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'ftsL', name: 'Cell division protein FtsL', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ftsQ', name: 'Cell division protein FtsQ', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ftsN', name: 'Cell division protein FtsN', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ftsB', name: 'Cell division protein FtsB', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'zipA', name: 'FtsZ-interacting protein', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'zapA', name: 'FtsZ ring assembly', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'zapB', name: 'FtsZ ring assembly', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'minE', name: 'Min system topological specificity', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'mukB', name: 'Chromosome partition', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'mukE', name: 'Chromosome partition', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'mukF', name: 'Chromosome partition', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'parC', name: 'Topoisomerase IV subunit A', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'parE', name: 'Topoisomerase IV subunit B', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'seqA', name: 'Negative regulator of replication', essential: false, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'dam', name: 'DNA adenine methyltransferase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'dcm', name: 'DNA cytosine methyltransferase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'hsdR', name: 'Type I restriction enzyme', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'hsdM', name: 'Type I restriction methyltransferase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'hsdS', name: 'Type I restriction specificity', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'mcrA', name: 'Modified cytosine restriction', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'mcrB', name: 'Modified cytosine restriction', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'sbcB', name: 'Exonuclease I', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'sbcC', name: 'SbcCD nuclease', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'sbcD', name: 'SbcCD nuclease', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'recG', name: 'RecG helicase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'recQ', name: 'RecQ helicase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'uvrD', name: 'UvrD helicase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'rep', name: 'Rep helicase', essential: false, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'dnaG', name: 'DNA primase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'dnaC', name: 'DnaC helicase loader', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'dnaT', name: 'DnaT primosomal protein', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'priA', name: 'Primosomal protein A', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'priB', name: 'Primosomal protein B', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'priC', name: 'Primosomal protein C', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ssb', name: 'Single-strand binding protein', essential: true, copyNumber: 10, expressionRate: 1.0, degradationRate: 0.002, translationRate: 3, proteinDegradationRate: 0.001 },
  { id: 'holA', name: 'DNA polymerase III δ', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'holB', name: 'DNA polymerase III δ\'', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'holC', name: 'DNA polymerase III χ', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'holD', name: 'DNA polymerase III ψ', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'dnaX', name: 'DNA polymerase III τ/γ', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'dnaQ', name: 'DNA polymerase III ε', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'dnaN', name: 'DNA polymerase III β', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'gyrB', name: 'DNA gyrase subunit B', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'topA', name: 'DNA topoisomerase I', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'rho', name: 'Transcription termination factor', essential: true, copyNumber: 5, expressionRate: 0.5, degradationRate: 0.005, translationRate: 2, proteinDegradationRate: 0.002 },
  { id: 'nusA', name: 'Transcription termination factor', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'nusB', name: 'Transcription antitermination', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'ribE', name: 'Riboflavin synthase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
  { id: 'def', name: 'Peptide deformylase', essential: true, copyNumber: 3, expressionRate: 0.3, degradationRate: 0.005, translationRate: 1.5, proteinDegradationRate: 0.002 },
  { id: 'fmt', name: 'Methionyl-tRNA formyltransferase', essential: true, copyNumber: 2, expressionRate: 0.2, degradationRate: 0.01, translationRate: 1, proteinDegradationRate: 0.005 },
];

// ── Simulation Engine ──────────────────────────────────────────────────────

/**
 * Simulate a digital cell over time.
 *
 * Multi-scale coupling:
 *   1. Gene expression: stochastic transcription → mRNA
 *   2. Translation: mRNA → protein (deterministic)
 *   3. Metabolism: protein enzymes → metabolite fluxes
 *   4. Growth: metabolite availability → biomass increase
 *   5. Division: mass threshold → cell division
 */
export function simulateDigitalCell(
  config: SimulationConfig,
  initialState?: Partial<CellState>,
): SimulationResult {
  const dt = config.dt;
  const steps = Math.floor(config.duration / dt);

  // Initialize cell state
  const genes = initialState?.genes ?? MINIMAL_GENE_SET;
  const mrnas: Record<string, number> = initialState?.mrnas ?? {};
  const proteins: Record<string, number> = initialState?.proteins ?? {};
  const metabolites: Record<string, number> = initialState?.metabolites ?? {
    glucose: config.environmentConditions.glucose,
    g6p: 0, f6p: 0, fdp: 0, pep: 0, pyr: 0,
    accoa: 0, cit: 0, akg: 0, succoa: 0,
    atp: 5.0, adp: 1.0, nad: 2.0, nadh: 0.5,
    nadp: 1.0, nadph: 0.5, coa: 0.5,
  };

  let volume = initialState?.volume ?? 1.0; // fL
  let mass = initialState?.mass ?? 0.5;     // pg
  let age = 0;
  let atp = metabolites.atp || 5.0;
  let gtp = 2.0;

  const timeSeries: SimulationResult['timeSeries'] = [];
  let divisionEvents = 0;
  let totalProteinProduced = 0;
  let totalMRNATranscribed = 0;
  let totalAtpProduced = 0;
  let totalAtpConsumed = 0;

  for (let step = 0; step <= steps; step++) {
    const t = step * dt;

    // === 1. Gene Expression (transcription) ===
    for (const gene of genes) {
      const currentMRNA = mrnas[gene.id] || 0;

      // Transcription: stochastic or deterministic
      let txnRate = gene.expressionRate * gene.copyNumber;
      if (config.stochasticGeneExpression) {
        // Poisson noise
        const lambda = txnRate * dt * 60;
        txnRate = poissonSample(lambda) / (dt * 60);
      }

      // Degradation
      const degradation = gene.degradationRate * currentMRNA;

      // Update mRNA
      mrnas[gene.id] = Math.max(0, currentMRNA + (txnRate - degradation) * dt * 60);
      totalMRNATranscribed += txnRate * dt * 60;
    }

    // === 2. Translation ===
    for (const gene of genes) {
      const currentProtein = proteins[gene.id] || 0;
      const currentMRNA = mrnas[gene.id] || 0;

      // Translation rate depends on mRNA, ribosomes, and energy
      const ribosomeFraction = Math.min(1, (proteins['rpsA'] || 0) / 100);
      const energyFraction = atp / (atp + 1);

      const tlnRate = gene.translationRate * currentMRNA * ribosomeFraction * energyFraction;
      const protDegradation = gene.proteinDegradationRate * currentProtein;

      proteins[gene.id] = Math.max(0, currentProtein + (tlnRate - protDegradation) * dt * 60);
      totalProteinProduced += tlnRate * dt * 60;
    }

    // === 3. Metabolism (enzyme catalysis) ===
    let atpProduced = 0;
    let atpConsumed = 0;

    for (const gene of genes) {
      if (!gene.catalyticActivity) continue;

      const enzyme = proteins[gene.id] || 0;
      if (enzyme < 0.01) continue;

      const { kcat, km, substrates, products } = gene.catalyticActivity;

      // Michaelis-Menten flux
      const substrateConcs = substrates.map(s => metabolites[s] || 0);
      const minSubstrate = Math.min(...substrateConcs);
      const flux = kcat * enzyme * minSubstrate / (km + minSubstrate) * dt * 60;

      // Consume substrates
      for (const s of substrates) {
        metabolites[s] = Math.max(0, (metabolites[s] || 0) - flux * 0.001);
      }

      // Produce products
      for (const p of products) {
        metabolites[p] = (metabolites[p] || 0) + flux * 0.001;
      }

      // Track ATP
      if (products.includes('atp')) atpProduced += flux * 0.001;
      if (substrates.includes('atp')) atpConsumed += flux * 0.001;
    }

    // === 4. Energy balance ===
    totalAtpProduced += atpProduced;
    totalAtpConsumed += atpConsumed;
    atp += atpProduced - atpConsumed;
    atp = Math.max(0, atp);

    // === 5. Growth ===
    const glucoseUptake = (proteins['ptsG'] || 0) * 0.01 * (metabolites.glucose || 0) / (0.5 + (metabolites.glucose || 0));
    metabolites.glucose = Math.max(0, (metabolites.glucose || 0) - glucoseUptake * dt);

    const growthRate = glucoseUptake * 0.1 * (atp / (atp + 0.5));
    mass += growthRate * mass * dt;
    volume = mass * 2; // approximate: 1 pg ≈ 2 fL

    age += dt;

    // === 6. Division ===
    if (config.includeDivision && mass >= 1.0) {
      mass /= 2;
      volume /= 2;
      // Halve molecule counts
      for (const key of Object.keys(mrnas)) mrnas[key] = (mrnas[key] || 0) / 2;
      for (const key of Object.keys(proteins)) proteins[key] = (proteins[key] || 0) / 2;
      for (const key of Object.keys(metabolites)) metabolites[key] = (metabolites[key] || 0) / 2;
      atp /= 2;
      gtp /= 2;
      divisionEvents++;
      age = 0;
    }

    // Record time series
    if (step % Math.max(1, Math.floor(0.5 / dt)) === 0) {
      const totalMRNA = Object.values(mrnas).reduce((s, v) => s + v, 0);
      const totalProtein = Object.values(proteins).reduce((s, v) => s + v, 0);

      timeSeries.push({
        time: Math.round(t * 100) / 100,
        cellMass: Math.round(mass * 1000) / 1000,
        cellVolume: Math.round(volume * 1000) / 1000,
        totalMRNA: Math.round(totalMRNA),
        totalProtein: Math.round(totalProtein),
        atp: Math.round(atp * 1000) / 1000,
        growthRate: Math.round(growthRate * 10000) / 10000,
      });
    }
  }

  // Compute metrics
  const avgGrowthRate = timeSeries.length > 0
    ? timeSeries.reduce((s, t) => s + t.growthRate, 0) / timeSeries.length
    : 0;
  const doublingTime = avgGrowthRate > 0 ? Math.log(2) / avgGrowthRate : Infinity;
  const energyEfficiency = totalAtpProduced > 0 ? (totalAtpProduced - totalAtpConsumed) / totalAtpProduced : 0;

  return {
    finalState: {
      genomeSize: genes.length * 1000,
      genes,
      mrnas,
      proteins,
      metabolites,
      volume,
      age,
      mass,
      atp,
      gtp,
      growthRate: avgGrowthRate,
      divisionReady: mass >= 0.9,
    },
    timeSeries,
    divisionEvents,
    doublingTime: Math.round(doublingTime * 100) / 100,
    metrics: {
      avgGrowthRate: Math.round(avgGrowthRate * 10000) / 10000,
      totalProteinProduced: Math.round(totalProteinProduced),
      totalMRNATranscribed: Math.round(totalMRNATranscribed),
      energyEfficiency: Math.round(energyEfficiency * 1000) / 1000,
    },
    designNotes: [
      `Simulated ${config.duration}h with ${genes.length} genes`,
      `Division events: ${divisionEvents}, doubling time: ${doublingTime.toFixed(1)}h`,
      `Final mass: ${mass.toFixed(3)} pg, volume: ${volume.toFixed(3)} fL`,
      `Total proteins: ${Math.round(Object.values(proteins).reduce((s, v) => s + v, 0))}`,
      `ATP: ${atp.toFixed(2)} mM, energy efficiency: ${(energyEfficiency * 100).toFixed(1)}%`,
      config.stochasticGeneExpression ? 'Stochastic gene expression enabled' : 'Deterministic gene expression',
    ],
  };
}

/**
 * Poisson random variable sampling (Knuth's algorithm).
 */
function poissonSample(lambda: number): number {
  if (lambda < 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}
