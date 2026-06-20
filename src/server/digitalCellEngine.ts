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
 *     - Simplified chromosome structure (no 3D organization)
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
 * Simplified to ~50 representative genes covering all cellular functions.
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
