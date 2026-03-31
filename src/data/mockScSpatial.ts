/**
 * Mock single-cell & spatial transcriptomics data
 * Simulates engineered S. cerevisiae producing artemisinin
 * 200 cells across 5 clusters with realistic sparse expression
 */
import type { CellRecord } from '../services/ScSpatialEngine';

// --- Seeded PRNG (linear congruential) ---
let _seed = 42;
function rand(): number {
  _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function randRange(lo: number, hi: number) { return lo + rand() * (hi - lo); }
function randInt(lo: number, hi: number) { return Math.floor(randRange(lo, hi + 1)); }
function randGauss(mean: number, sd: number) {
  const u = rand() || 1e-10;
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// --- Gene list (30 genes) ---
export const GENE_LIST: string[] = [
  // MVA pathway
  'ERG10', 'ERG13', 'tHMGR', 'ERG12', 'ERG8', 'MVD1', 'IDI1', 'ERG20',
  // Artemisinin pathway
  'ADS', 'CYP71AV1', 'CPR1', 'ADH1', 'ALDH1',
  // Housekeeping
  'ACT1', 'TDH3', 'PGK1', 'ENO2', 'FBA1',
  // Stress response
  'HSP26', 'SSA1', 'HSP104', 'SOD1', 'CTT1',
  // Growth / division
  'CLN1', 'CLN2', 'CLB1', 'SIC1',
  // Mitochondrial
  'COX1', 'ATP6', 'CYB',
];

export const CLUSTER_LABELS: Record<number, string> = {
  0: 'High Producers',
  1: 'Metabolically Active',
  2: 'Stressed',
  3: 'Quiescent',
  4: 'Transitioning',
};

// Cluster sizes (total = 200)
const CLUSTER_SIZES = [35, 45, 40, 40, 40];

// Spatial cluster centers (within ~50-unit radius circle)
const CLUSTER_CENTERS: [number, number][] = [
  [20, 25],    // high producers — upper right
  [-15, 20],   // metabolically active — upper left
  [-25, -15],  // stressed — lower left
  [10, -25],   // quiescent — lower center
  [0, 0],      // transitioning — center
];

// Per-cluster expression profiles: [mean, sd] for each gene index
type Profile = [number, number][];

function baseProfile(): Profile {
  return GENE_LIST.map(() => [0.2, 0.3] as [number, number]);
}

function buildProfiles(): Profile[] {
  const profiles: Profile[] = [];

  // Cluster 0 — High Producers: high ADS, CYP71AV1, CPR1
  const p0 = baseProfile();
  p0[8] = [6.0, 1.5]; p0[9] = [5.5, 1.2]; p0[10] = [4.0, 1.0]; // ADS, CYP71AV1, CPR1
  p0[11] = [3.0, 1.0]; p0[12] = [2.8, 0.9]; // ADH1, ALDH1
  p0[7] = [3.5, 1.0]; // ERG20 (FPP synthase)
  p0[13] = [2.0, 0.5]; p0[14] = [2.2, 0.5]; // housekeeping baseline
  profiles.push(p0);

  // Cluster 1 — Metabolically Active: high MVA enzymes
  const p1 = baseProfile();
  p1[0] = [4.5, 1.2]; p1[1] = [4.0, 1.0]; p1[2] = [5.5, 1.5]; // ERG10, ERG13, tHMGR
  p1[3] = [3.5, 1.0]; p1[4] = [3.2, 0.9]; p1[5] = [3.8, 1.0]; // ERG12, ERG8, MVD1
  p1[6] = [3.0, 0.8]; p1[7] = [4.2, 1.1]; // IDI1, ERG20
  p1[13] = [2.5, 0.6]; p1[14] = [2.8, 0.6]; // housekeeping
  profiles.push(p1);

  // Cluster 2 — Stressed: high stress markers, elevated mito genes
  const p2 = baseProfile();
  p2[18] = [6.0, 1.5]; p2[19] = [5.0, 1.3]; p2[20] = [4.5, 1.2]; // HSP26, SSA1, HSP104
  p2[21] = [3.5, 1.0]; p2[22] = [3.0, 0.9]; // SOD1, CTT1
  p2[28] = [3.0, 1.0]; p2[29] = [2.8, 0.8]; p2[27] = [2.5, 0.7]; // COX1, ATP6, SIC1 (arrest)
  profiles.push(p2);

  // Cluster 3 — Quiescent: low everything
  const p3 = baseProfile();
  p3[13] = [1.0, 0.4]; p3[14] = [0.8, 0.3]; // minimal housekeeping
  p3[27] = [1.5, 0.5]; // SIC1 (CDK inhibitor → G1 arrest)
  profiles.push(p3);

  // Cluster 4 — Transitioning: mixed profile
  const p4 = baseProfile();
  p4[2] = [2.5, 1.0]; p4[7] = [2.0, 0.8]; // some MVA
  p4[8] = [2.0, 1.2]; p4[9] = [1.5, 1.0]; // some artemisinin
  p4[18] = [2.0, 1.0]; p4[19] = [1.8, 0.9]; // some stress
  p4[23] = [2.5, 0.8]; p4[24] = [2.2, 0.7]; // CLN1, CLN2 (cycling)
  p4[25] = [1.8, 0.7]; // CLB1
  profiles.push(p4);

  return profiles;
}

function generateCells(): CellRecord[] {
  _seed = 42; // reset seed for reproducibility
  const profiles = buildProfiles();
  const cells: CellRecord[] = [];
  let idx = 0;

  for (let c = 0; c < 5; c++) {
    const size = CLUSTER_SIZES[c];
    const [cx, cy] = CLUSTER_CENTERS[c];
    const prof = profiles[c];

    for (let i = 0; i < size; i++) {
      // Spatial position — gaussian scatter around cluster center
      const sx = clamp(randGauss(cx, 8), -50, 50);
      const sy = clamp(randGauss(cy, 8), -50, 50);

      // Quality metrics by cluster
      let totalCounts: number;
      let nGenes: number;
      let mitoPercent: number;

      switch (c) {
        case 0: // high producers
          totalCounts = randInt(6000, 14000);
          nGenes = randInt(1000, 1900);
          mitoPercent = clamp(randGauss(6, 2), 2, 12);
          break;
        case 1: // metabolically active
          totalCounts = randInt(5000, 12000);
          nGenes = randInt(900, 1800);
          mitoPercent = clamp(randGauss(7, 2.5), 2, 14);
          break;
        case 2: // stressed — high mito
          totalCounts = randInt(3000, 9000);
          nGenes = randInt(600, 1400);
          mitoPercent = clamp(randGauss(18, 4), 10, 28);
          break;
        case 3: // quiescent — low counts
          totalCounts = randInt(800, 3500);
          nGenes = randInt(200, 700);
          mitoPercent = clamp(randGauss(5, 2), 2, 10);
          break;
        default: // transitioning
          totalCounts = randInt(3500, 10000);
          nGenes = randInt(700, 1500);
          mitoPercent = clamp(randGauss(10, 3), 3, 18);
      }

      // Inject ~15 QC-fail cells across clusters
      if (idx % 14 === 13) {
        if (rand() > 0.5) mitoPercent = clamp(randGauss(24, 3), 21, 30);
        else totalCounts = randInt(100, 480);
      }

      // Gene expression — sparse with cluster-specific highs
      const geneExpression: Record<string, number> = {};
      for (let g = 0; g < GENE_LIST.length; g++) {
        const [mean, sd] = prof[g];
        // Dropout: probability inversely related to mean
        const dropout = Math.exp(-mean * 0.8);
        if (rand() < dropout) {
          geneExpression[GENE_LIST[g]] = 0;
        } else {
          geneExpression[GENE_LIST[g]] = Math.round(
            clamp(randGauss(mean, sd), 0, 12) * 100,
          ) / 100;
        }
      }

      // Pseudotime: quiescent→0, productive→1, stressed→0.8, transitioning→0.5
      const ptBase = [0.85, 0.6, 0.75, 0.1, 0.45][c];
      const pseudotime = clamp(randGauss(ptBase, 0.12), 0, 1);

      cells.push({
        id: `cell_${String(idx).padStart(3, '0')}`,
        barcode: `ACGT${String(idx).padStart(4, '0')}-1`,
        totalCounts: Math.round(totalCounts),
        nGenes,
        mitoPercent: Math.round(mitoPercent * 100) / 100,
        geneExpression,
        cluster: c,
        cellType: CLUSTER_LABELS[c],
        pseudotime: Math.round(pseudotime * 1000) / 1000,
        spatialX: Math.round(sx * 100) / 100,
        spatialY: Math.round(sy * 100) / 100,
        batchId: idx % 2,
        qcPass: true,
      });
      idx++;
    }
  }
  return cells;
}

export const SC_SPATIAL_DATA: CellRecord[] = generateCells();
