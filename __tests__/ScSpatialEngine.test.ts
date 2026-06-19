/** @jest-environment node */

import {
  preprocessAndQC,
  normalizeAndLog,
  selectHVGs,
  clusterCells,
  computePAGA,
  computeSpatialNeighbors,
  computeMoranI,
  trainScVAE,
  identifyHighYieldClusters,
  runFullPipeline,
  type CellRecord,
} from '../src/services/ScSpatialEngine';

// Helper to generate test cells
function makeCells(n: number, genes: string[] = ['geneA', 'geneB', 'geneC']): CellRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `cell-${i}`,
    barcode: `BC${i.toString().padStart(4, '0')}`,
    totalCounts: 1000 + Math.floor(Math.random() * 5000),
    nGenes: genes.length,
    mitoPercent: Math.random() * 30,
    geneExpression: Object.fromEntries(genes.map(g => [g, Math.random() * 10])),
    cluster: 0,
    cellType: 'unknown',
    pseudotime: 0,
    spatialX: Math.random() * 100,
    spatialY: Math.random() * 100,
    batchId: 0,
    qcPass: true,
  }));
}

// Helper to make cells that pass QC (totalCounts >= 500, nGenes >= 200, mitoPercent < 20)
function makePassingCells(n: number): CellRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `cell-${i}`,
    barcode: `BC${i.toString().padStart(4, '0')}`,
    totalCounts: 2000 + i * 100,
    nGenes: 250 + i,
    mitoPercent: 5 + (i % 10),
    geneExpression: {
      geneA: 1 + Math.sin(i) * 2,
      geneB: 2 + Math.cos(i) * 3,
      geneC: 0.5 + (i % 5),
      geneD: 3 + (i % 3),
      geneE: 1 + (i % 7) * 0.5,
    },
    cluster: 0,
    cellType: 'unknown',
    pseudotime: 0,
    spatialX: (i % 10) * 10,
    spatialY: Math.floor(i / 10) * 10,
    batchId: i < n / 2 ? 0 : 1,
    qcPass: true,
  }));
}

// ── preprocessAndQC ─────────────────────────────────────────────────────────

describe('preprocessAndQC', () => {
  it('filters cells by mito threshold', () => {
    const cells = makeCells(10);
    const { filtered, qc } = preprocessAndQC(cells, 20, 0, 0);
    expect(qc.totalCells).toBe(10);
    expect(filtered.length).toBeLessThanOrEqual(10);
    // All filtered cells should have mitoPercent < 20
    for (const c of filtered) {
      expect(c.mitoPercent).toBeLessThan(20);
    }
  });

  it('filters cells by min counts', () => {
    const cells: CellRecord[] = [
      { ...makeCells(1)[0], totalCounts: 100, mitoPercent: 5, nGenes: 500 },
      { ...makeCells(1)[0], totalCounts: 5000, mitoPercent: 5, nGenes: 500 },
    ];
    const { filtered, qc } = preprocessAndQC(cells, 20, 500, 200);
    expect(qc.totalCells).toBe(2);
    expect(filtered.length).toBe(1);
  });

  it('filters cells by min genes', () => {
    const cells: CellRecord[] = [
      { ...makeCells(1)[0], totalCounts: 5000, mitoPercent: 5, nGenes: 50 },
      { ...makeCells(1)[0], totalCounts: 5000, mitoPercent: 5, nGenes: 500 },
    ];
    const { filtered, qc } = preprocessAndQC(cells, 20, 500, 200);
    expect(filtered.length).toBe(1);
  });

  it('returns correct QC summary', () => {
    const cells = makeCells(20);
    const { qc } = preprocessAndQC(cells);
    expect(qc.totalCells).toBe(20);
    expect(qc.passedCells + qc.filteredCells).toBe(20);
    expect(qc.mitoThreshold).toBe(20);
    expect(qc.minCounts).toBe(500);
    expect(qc.minGenes).toBe(200);
  });

  it('computes medians on passing population', () => {
    const cells = makePassingCells(10);
    const { qc } = preprocessAndQC(cells, 20, 500, 200);
    expect(qc.medianCounts).toBeGreaterThan(0);
    expect(qc.medianGenes).toBeGreaterThan(0);
    expect(qc.medianMitoPercent).toBeGreaterThan(0);
  });

  it('handles empty input', () => {
    const { filtered, qc } = preprocessAndQC([]);
    expect(filtered).toHaveLength(0);
    expect(qc.totalCells).toBe(0);
    expect(qc.passedCells).toBe(0);
    expect(qc.medianCounts).toBe(0);
  });

  it('marks cells with qcPass flag', () => {
    const cells = makeCells(5);
    const { filtered } = preprocessAndQC(cells);
    for (const c of filtered) {
      expect(c.qcPass).toBe(true);
    }
  });
});

// ── normalizeAndLog ─────────────────────────────────────────────────────────

describe('normalizeAndLog', () => {
  it('returns same number of cells', () => {
    const cells = makePassingCells(5);
    const normalized = normalizeAndLog(cells);
    expect(normalized).toHaveLength(5);
  });

  it('does not mutate input', () => {
    const cells = makePassingCells(3);
    const originalExpr = { ...cells[0].geneExpression };
    normalizeAndLog(cells);
    expect(cells[0].geneExpression).toEqual(originalExpr);
  });

  it('applies log1p transform', () => {
    const cells: CellRecord[] = [{
      ...makeCells(1)[0],
      totalCounts: 10000,
      geneExpression: { geneA: 5 },
    }];
    const normalized = normalizeAndLog(cells);
    // scaleFactor = 10000/10000 = 1, so normalized = log1p(5) ≈ 1.7918
    expect(normalized[0].geneExpression.geneA).toBeCloseTo(Math.log1p(5), 5);
  });

  it('handles zero totalCounts (uses 1 as fallback)', () => {
    const cells: CellRecord[] = [{
      ...makeCells(1)[0],
      totalCounts: 0,
      geneExpression: { geneA: 100 },
    }];
    const normalized = normalizeAndLog(cells);
    // scaleFactor = 10000/1 = 10000, so normalized = log1p(100 * 10000)
    expect(normalized[0].geneExpression.geneA).toBeCloseTo(Math.log1p(1000000), 3);
  });

  it('respects custom targetSum', () => {
    const cells: CellRecord[] = [{
      ...makeCells(1)[0],
      totalCounts: 1000,
      geneExpression: { geneA: 10 },
    }];
    const normalized = normalizeAndLog(cells, 5000);
    // scaleFactor = 5000/1000 = 5, so normalized = log1p(10 * 5) = log1p(50)
    expect(normalized[0].geneExpression.geneA).toBeCloseTo(Math.log1p(50), 5);
  });

  it('preserves all cell fields', () => {
    const cells = makePassingCells(2);
    const normalized = normalizeAndLog(cells);
    expect(normalized[0].id).toBe(cells[0].id);
    expect(normalized[0].barcode).toBe(cells[0].barcode);
    expect(normalized[0].totalCounts).toBe(cells[0].totalCounts);
  });
});

// ── selectHVGs ──────────────────────────────────────────────────────────────

describe('selectHVGs', () => {
  it('returns HVG result with correct structure', () => {
    const cells = makePassingCells(20);
    const normalized = normalizeAndLog(cells);
    const hvg = selectHVGs(normalized);
    expect(hvg.method).toBe('seurat_v3_vst');
    expect(hvg.genes.length).toBeGreaterThan(0);
    expect(typeof hvg.nHVGs).toBe('number');
  });

  it('each gene has required fields', () => {
    const cells = makePassingCells(10);
    const hvg = selectHVGs(cells);
    for (const g of hvg.genes) {
      expect(typeof g.gene).toBe('string');
      expect(typeof g.mean).toBe('number');
      expect(typeof g.variance).toBe('number');
      expect(typeof g.varianceNorm).toBe('number');
      expect(typeof g.isHVG).toBe('boolean');
    }
  });

  it('selects at most nTop HVGs', () => {
    const cells = makePassingCells(20);
    const hvg = selectHVGs(cells, 3);
    expect(hvg.nHVGs).toBeLessThanOrEqual(3);
    const hvgCount = hvg.genes.filter(g => g.isHVG).length;
    expect(hvgCount).toBe(hvg.nHVGs);
  });

  it('handles single gene', () => {
    const cells: CellRecord[] = [{
      ...makeCells(1)[0],
      geneExpression: { onlyGene: 5 },
    }];
    const hvg = selectHVGs(cells);
    expect(hvg.genes).toHaveLength(1);
    expect(hvg.genes[0].gene).toBe('onlyGene');
  });

  it('handles empty cells', () => {
    const hvg = selectHVGs([]);
    expect(hvg.genes).toHaveLength(0);
    expect(hvg.nHVGs).toBe(0);
  });
});

// ── clusterCells ────────────────────────────────────────────────────────────

describe('clusterCells', () => {
  it('clusters cells into groups', () => {
    const cells = makePassingCells(30);
    const { cells: clustered, result } = clusterCells(cells);
    expect(result.nClusters).toBeGreaterThan(0);
    expect(clustered).toHaveLength(30);
    for (const c of clustered) {
      expect(c.cluster).toBeGreaterThanOrEqual(0);
      expect(c.cluster).toBeLessThan(result.nClusters);
      expect(typeof c.cellType).toBe('string');
    }
  });

  it('handles empty input', () => {
    const { cells, result } = clusterCells([]);
    expect(cells).toHaveLength(0);
    expect(result.nClusters).toBe(0);
    expect(result.clusterSizes).toHaveLength(0);
  });

  it('respects resolution parameter', () => {
    const cells = makePassingCells(20);
    const low = clusterCells(cells, 0.1);
    const high = clusterCells(cells, 2.0);
    // Different resolutions may produce different cluster counts
    // At minimum, both should produce valid results
    expect(low.result.nClusters).toBeGreaterThan(0);
    expect(high.result.nClusters).toBeGreaterThan(0);
  });

  it('assigns cell type labels', () => {
    const cells = makePassingCells(20);
    const { result } = clusterCells(cells);
    for (const cs of result.clusterSizes) {
      expect(typeof cs.label).toBe('string');
      expect(cs.label.length).toBeGreaterThan(0);
      expect(cs.size).toBeGreaterThan(0);
    }
  });

  it('computes silhouette score', () => {
    const cells = makePassingCells(20);
    const { result } = clusterCells(cells);
    expect(typeof result.silhouetteScore).toBe('number');
    expect(result.silhouetteScore).toBeGreaterThanOrEqual(-1);
    expect(result.silhouetteScore).toBeLessThanOrEqual(1);
  });

  it('computes modularity', () => {
    const cells = makePassingCells(20);
    const { result } = clusterCells(cells);
    expect(typeof result.modularity).toBe('number');
  });
});

// ── computePAGA ─────────────────────────────────────────────────────────────

describe('computePAGA', () => {
  it('computes PAGA trajectory from clustered cells', () => {
    const cells = makePassingCells(30);
    const { cells: clustered, result: clusterResult } = clusterCells(cells);
    const paga = computePAGA(clustered, clusterResult);

    expect(paga.connectivities).toHaveLength(clusterResult.nClusters);
    expect(paga.connectivities[0]).toHaveLength(clusterResult.nClusters);
    expect(paga.clusterPseudotime).toHaveLength(clusterResult.nClusters);
    expect(paga.pseudotimeRange).toHaveLength(2);
    expect(typeof paga.rootCluster).toBe('number');
    expect(Array.isArray(paga.trajectory)).toBe(true);
    expect(Array.isArray(paga.branchingPoints)).toBe(true);
  });

  it('root cluster has pseudotime 0', () => {
    const cells = makePassingCells(30);
    const { cells: clustered, result: clusterResult } = clusterCells(cells);
    const paga = computePAGA(clustered, clusterResult);
    expect(paga.clusterPseudotime[paga.rootCluster]).toBe(0);
  });

  it('connectivities are symmetric', () => {
    const cells = makePassingCells(20);
    const { cells: clustered, result: clusterResult } = clusterCells(cells);
    const paga = computePAGA(clustered, clusterResult);
    for (let i = 0; i < clusterResult.nClusters; i++) {
      for (let j = 0; j < clusterResult.nClusters; j++) {
        expect(paga.connectivities[i][j]).toBeCloseTo(paga.connectivities[j][i], 10);
      }
    }
  });

  it('trajectory edges have weights', () => {
    const cells = makePassingCells(30);
    const { cells: clustered, result: clusterResult } = clusterCells(cells);
    const paga = computePAGA(clustered, clusterResult);
    for (const edge of paga.trajectory) {
      expect(typeof edge.from).toBe('number');
      expect(typeof edge.to).toBe('number');
      expect(typeof edge.weight).toBe('number');
      expect(edge.weight).toBeGreaterThan(0.15);
    }
  });

  it('handles single cluster', () => {
    const cells: CellRecord[] = Array.from({ length: 5 }, (_, i) => ({
      ...makePassingCells(1)[0],
      cluster: 0,
    }));
    const clusterResult = {
      nClusters: 1,
      clusterSizes: [{ cluster: 0, size: 5, label: 'A' }],
      silhouetteScore: 0,
      modularity: 0,
    };
    const paga = computePAGA(cells, clusterResult);
    expect(paga.connectivities).toHaveLength(1);
    expect(paga.trajectory).toHaveLength(0);
  });
});

// ── computeSpatialNeighbors ─────────────────────────────────────────────────

describe('computeSpatialNeighbors', () => {
  it('builds KNN spatial graph', () => {
    const cells = makePassingCells(20);
    const spatial = computeSpatialNeighbors(cells);
    expect(spatial.nCells).toBe(20);
    expect(spatial.graphType).toBe('knn');
    expect(spatial.adjacency.length).toBeGreaterThan(0);
  });

  it('respects k parameter', () => {
    const cells = makePassingCells(20);
    const k3 = computeSpatialNeighbors(cells, 3);
    const k6 = computeSpatialNeighbors(cells, 6);
    // More neighbors = more edges
    expect(k6.adjacency.length).toBeGreaterThanOrEqual(k3.adjacency.length);
  });

  it('handles empty cells', () => {
    const spatial = computeSpatialNeighbors([]);
    expect(spatial.nCells).toBe(0);
    expect(spatial.adjacency).toHaveLength(0);
  });

  it('handles single cell', () => {
    const cells = makePassingCells(1);
    const spatial = computeSpatialNeighbors(cells);
    expect(spatial.nCells).toBe(1);
    expect(spatial.adjacency).toHaveLength(0);
  });

  it('handles two cells', () => {
    const cells = makePassingCells(2);
    const spatial = computeSpatialNeighbors(cells, 1);
    expect(spatial.nCells).toBe(2);
    expect(spatial.adjacency.length).toBeGreaterThan(0);
  });
});

// ── computeMoranI ───────────────────────────────────────────────────────────

describe('computeMoranI', () => {
  it('computes Moran I for each gene', () => {
    const cells = makePassingCells(20);
    const spatial = computeSpatialNeighbors(cells);
    const result = computeMoranI(cells, spatial);

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.nGenesTested).toBe(result.results.length);
    for (const r of result.results) {
      expect(typeof r.gene).toBe('string');
      expect(typeof r.moranI).toBe('number');
      expect(typeof r.expectedI).toBe('number');
      expect(typeof r.zScore).toBe('number');
      expect(typeof r.pValue).toBe('number');
      expect(typeof r.isSpatiallyRestricted).toBe('boolean');
    }
  });

  it('tests specific genes when provided', () => {
    const cells = makePassingCells(20);
    const spatial = computeSpatialNeighbors(cells);
    const result = computeMoranI(cells, spatial, ['geneA', 'geneB']);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].gene).toBe('geneA');
    expect(result.results[1].gene).toBe('geneB');
  });

  it('results are sorted by Moran I descending', () => {
    const cells = makePassingCells(30);
    const spatial = computeSpatialNeighbors(cells);
    const result = computeMoranI(cells, spatial);

    for (let i = 1; i < result.results.length; i++) {
      expect(result.results[i - 1].moranI).toBeGreaterThanOrEqual(result.results[i].moranI);
    }
  });

  it('handles constant expression (denom=0)', () => {
    const cells: CellRecord[] = Array.from({ length: 10 }, (_, i) => ({
      ...makePassingCells(1)[0],
      spatialX: i * 10,
      spatialY: i * 10,
      geneExpression: { geneA: 5.0 }, // constant
    }));
    const spatial = computeSpatialNeighbors(cells);
    const result = computeMoranI(cells, spatial, ['geneA']);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].moranI).toBe(0);
    expect(result.results[0].pValue).toBe(1);
  });

  it('handles empty cells', () => {
    const spatial = computeSpatialNeighbors([]);
    const result = computeMoranI([], spatial);
    expect(result.results).toHaveLength(0);
  });

  it('pValues are between 0 and 1', () => {
    const cells = makePassingCells(20);
    const spatial = computeSpatialNeighbors(cells);
    const result = computeMoranI(cells, spatial);
    for (const r of result.results) {
      expect(r.pValue).toBeGreaterThanOrEqual(0);
      expect(r.pValue).toBeLessThanOrEqual(1);
    }
  });
});

// ── trainScVAE ──────────────────────────────────────────────────────────────

describe('trainScVAE', () => {
  it('returns VAE result with correct structure', async () => {
    const cells = makePassingCells(15);
    const vae = await trainScVAE(cells, 5, 0.5, 5);

    expect(vae.latentCells).toHaveLength(15);
    expect(typeof vae.elbo).toBe('number');
    expect(typeof vae.reconLoss).toBe('number');
    expect(typeof vae.klDivergence).toBe('number');
    expect(vae.latentDim).toBe(5);
    expect(typeof vae.batchCorrected).toBe('boolean');
    expect(Array.isArray(vae.convergenceHistory)).toBe(true);
  });

  it('latent cells have required fields', async () => {
    const cells = makePassingCells(10);
    const vae = await trainScVAE(cells, 5, 0.5, 5);
    for (const lc of vae.latentCells) {
      expect(typeof lc.id).toBe('string');
      expect(typeof lc.barcode).toBe('string');
      expect(Array.isArray(lc.z_mean)).toBe(true);
      expect(lc.z_mean).toHaveLength(5);
      expect(Array.isArray(lc.z_sample)).toBe(true);
      expect(lc.z_sample).toHaveLength(5);
      expect(typeof lc.umapX).toBe('number');
      expect(typeof lc.umapY).toBe('number');
      expect(typeof lc.metabolicEfficiency).toBe('number');
    }
  });

  it('handles empty cells', async () => {
    const vae = await trainScVAE([]);
    expect(vae.latentCells).toHaveLength(0);
    expect(vae.elbo).toBe(0);
    expect(vae.reconLoss).toBe(0);
    expect(vae.klDivergence).toBe(0);
    expect(vae.convergenceHistory).toHaveLength(0);
  });

  it('convergence history has entries', async () => {
    const cells = makePassingCells(10);
    const vae = await trainScVAE(cells, 5, 0.5, 20);
    expect(vae.convergenceHistory.length).toBeGreaterThan(0);
    for (const entry of vae.convergenceHistory) {
      expect(typeof entry.epoch).toBe('number');
      expect(typeof entry.loss).toBe('number');
      expect(typeof entry.kl).toBe('number');
      expect(typeof entry.recon).toBe('number');
    }
  });

  it('detects batch correction', async () => {
    const cells = makePassingCells(20);
    // All cells have batchId 0 or 1 (from makePassingCells)
    const vae = await trainScVAE(cells, 5, 0.5, 5);
    expect(vae.batchCorrected).toBe(true);
  });

  it('no batch correction with single batch', async () => {
    const cells = makePassingCells(10).map(c => ({ ...c, batchId: 0 }));
    const vae = await trainScVAE(cells, 5, 0.5, 5);
    expect(vae.batchCorrected).toBe(false);
  });

  it('custom batchLabels override cell batchId', async () => {
    const cells = makePassingCells(10).map(c => ({ ...c, batchId: 0 }));
    const batchLabels = cells.map((_, i) => i < 5 ? 0 : 1);
    const vae = await trainScVAE(cells, 5, 0.5, 5, batchLabels);
    expect(vae.batchCorrected).toBe(true);
  });

  it('metabolic efficiency is between 0 and 1', async () => {
    const cells = makePassingCells(10);
    const vae = await trainScVAE(cells, 5, 0.5, 5);
    for (const lc of vae.latentCells) {
      expect(lc.metabolicEfficiency).toBeGreaterThanOrEqual(0);
      expect(lc.metabolicEfficiency).toBeLessThanOrEqual(1);
    }
  });
});

// ── identifyHighYieldClusters ───────────────────────────────────────────────

describe('identifyHighYieldClusters', () => {
  it('identifies high-yield clusters', () => {
    const cells = makePassingCells(30);
    const { cells: clustered, result: clusterResult } = clusterCells(cells);
    const paga = computePAGA(clustered, clusterResult);
    const withPseudotime = clustered.map(c => ({
      ...c,
      pseudotime: paga.clusterPseudotime[c.cluster] ?? 0,
    }));
    const spatial = computeSpatialNeighbors(withPseudotime);
    const autocorr = computeMoranI(withPseudotime, spatial);

    const results = identifyHighYieldClusters(withPseudotime, clusterResult, paga, autocorr);
    expect(results.length).toBeGreaterThan(0);

    for (const r of results) {
      expect(typeof r.clusterId).toBe('number');
      expect(typeof r.label).toBe('string');
      expect(r.nCells).toBeGreaterThan(0);
      expect(typeof r.avgMetabolicEfficiency).toBe('number');
      expect(typeof r.avgProductivity).toBe('number');
      expect(Array.isArray(r.keyGenes)).toBe(true);
      expect(['productive', 'stressed', 'quiescent']).toContain(r.fate);
      expect(typeof r.spatiallyLocalized).toBe('boolean');
    }
  });

  it('results are sorted by productivity descending', () => {
    const cells = makePassingCells(30);
    const { cells: clustered, result: clusterResult } = clusterCells(cells);
    const paga = computePAGA(clustered, clusterResult);
    const withPseudotime = clustered.map(c => ({
      ...c,
      pseudotime: paga.clusterPseudotime[c.cluster] ?? 0,
    }));
    const spatial = computeSpatialNeighbors(withPseudotime);
    const autocorr = computeMoranI(withPseudotime, spatial);

    const results = identifyHighYieldClusters(withPseudotime, clusterResult, paga, autocorr);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].avgProductivity).toBeGreaterThanOrEqual(results[i].avgProductivity);
    }
  });

  it('key genes have required fields', () => {
    const cells = makePassingCells(20);
    const { cells: clustered, result: clusterResult } = clusterCells(cells);
    const paga = computePAGA(clustered, clusterResult);
    const withPseudotime = clustered.map(c => ({
      ...c,
      pseudotime: paga.clusterPseudotime[c.cluster] ?? 0,
    }));
    const spatial = computeSpatialNeighbors(withPseudotime);
    const autocorr = computeMoranI(withPseudotime, spatial);

    const results = identifyHighYieldClusters(withPseudotime, clusterResult, paga, autocorr);
    for (const r of results) {
      for (const kg of r.keyGenes) {
        expect(typeof kg.gene).toBe('string');
        expect(typeof kg.meanExpression).toBe('number');
        expect(typeof kg.pctExpressed).toBe('number');
      }
    }
  });

  it('classifies fate based on efficiency', () => {
    const cells = makePassingCells(20);
    const { cells: clustered, result: clusterResult } = clusterCells(cells);
    const paga = computePAGA(clustered, clusterResult);
    const withPseudotime = clustered.map(c => ({
      ...c,
      pseudotime: paga.clusterPseudotime[c.cluster] ?? 0,
    }));
    const spatial = computeSpatialNeighbors(withPseudotime);
    const autocorr = computeMoranI(withPseudotime, spatial);

    const results = identifyHighYieldClusters(withPseudotime, clusterResult, paga, autocorr);
    const fates = new Set(results.map(r => r.fate));
    // Should have at least one fate type
    expect(fates.size).toBeGreaterThan(0);
  });
});

// ── runFullPipeline ─────────────────────────────────────────────────────────

describe('runFullPipeline', () => {
  it('runs the complete pipeline', async () => {
    const cells = makePassingCells(30);
    const result = await runFullPipeline(cells);

    expect(result.qc).toBeDefined();
    expect(result.hvg).toBeDefined();
    expect(result.clusters).toBeDefined();
    expect(result.paga).toBeDefined();
    expect(result.spatial).toBeDefined();
    expect(result.autocorrelation).toBeDefined();
    expect(result.vae).toBeDefined();
    expect(result.highYieldClusters).toBeDefined();
  });

  it('handles empty input', async () => {
    const result = await runFullPipeline([]);
    expect(result.qc.totalCells).toBe(0);
    expect(result.hvg.nHVGs).toBe(0);
    expect(result.clusters.nClusters).toBe(0);
  });

  it('QC filters are applied', async () => {
    const cells = makeCells(50); // some will fail QC
    const result = await runFullPipeline(cells);
    expect(result.qc.passedCells).toBeLessThanOrEqual(50);
  });

  it('pipeline produces consistent cluster assignments', async () => {
    const cells = makePassingCells(20);
    const result = await runFullPipeline(cells);
    // All clustered cells should have valid cluster IDs
    for (const lc of result.vae.latentCells) {
      expect(lc.cluster).toBeGreaterThanOrEqual(0);
      expect(lc.cluster).toBeLessThan(result.clusters.nClusters);
    }
  });
});
