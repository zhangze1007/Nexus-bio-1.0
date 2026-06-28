/**
 * Wave 10 — Computational Performance Benchmarks
 *
 * Measures execution time of each simulation engine's core operation.
 * Each benchmark runs WARMUP + ITERATIONS rounds; reports median, mean, stdev.
 *
 * Run:  npx jest __tests__/performanceBenchmark.test.ts --runInBand --verbose
 * Output: reports/performance-benchmarks/results.json + results.csv
 */

import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

// Benchmarks run multiple iterations of heavy solvers — needs longer timeout
jest.setTimeout(120_000);

const N_ITERATIONS = 5;
const WARMUP = 1;
const reportDir = path.join(__dirname, '..', 'reports', 'performance-benchmarks');

// ─── helpers ───────────────────────────────────────────────────────────────

interface BenchmarkResult {
  name: string;
  medianMs: number;
  meanMs: number;
  stdevMs: number;
  minMs: number;
  maxMs: number;
  iterations: number;
  error?: string;
}

function stats(times: number[]): Omit<BenchmarkResult, 'name'> {
  const sorted = [...times].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1
    ? sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
    : 0;
  return {
    medianMs: sorted[Math.floor(n / 2)],
    meanMs: mean,
    stdevMs: Math.sqrt(variance),
    minMs: sorted[0],
    maxMs: sorted[n - 1],
    iterations: n,
  };
}

async function benchmark(name: string, fn: () => void | Promise<void>): Promise<BenchmarkResult> {
  for (let i = 0; i < WARMUP; i++) await fn();
  const times: number[] = [];
  for (let i = 0; i < N_ITERATIONS; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  return { name, ...stats(times) };
}

// ─── tests ─────────────────────────────────────────────────────────────────

const results: BenchmarkResult[] = [];

afterAll(() => {
  fs.mkdirSync(reportDir, { recursive: true });
  const report = {
    schemaVersion: 'performance-benchmark-v1',
    generatedAt: new Date().toISOString(),
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    config: { iterations: N_ITERATIONS, warmupIterations: WARMUP },
    results,
  };
  const jsonPath = path.join(reportDir, 'results.json');
  const csvPath = path.join(reportDir, 'results.csv');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  const csvHeader = 'name,medianMs,meanMs,stdevMs,minMs,maxMs,iterations';
  const csvRows = results
    .filter(r => !r.error)
    .map(r => `"${r.name}",${r.medianMs.toFixed(2)},${r.meanMs.toFixed(2)},${r.stdevMs.toFixed(2)},${r.minMs.toFixed(2)},${r.maxMs.toFixed(2)},${r.iterations}`);
  fs.writeFileSync(csvPath, [csvHeader, ...csvRows].join('\n') + '\n', 'utf8');
});

describe('Computational Performance Benchmarks', () => {

  test('FBA — solveAuthorityFBA (ecoli, biomass)', async () => {
    const { solveAuthorityFBA } = await import('../src/server/fbaEngine');
    const r = await benchmark('FBA — solveAuthorityFBA', async () => {
      await solveAuthorityFBA({
        species: 'ecoli',
        objective: 'biomass',
        glucoseUptake: 10,
        oxygenUptake: 20,
        knockouts: [],
      });
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(30000);
  });

  test('Thermo — estimateFormationEnergy × 50', async () => {
    const { estimateFormationEnergy } = await import('../src/utils/groupContribution');
    const smiles = [
      'CC(=O)SCC', 'OC(=O)CCC(=O)O', 'C1=CC=C(C=C1)O',
      'CC(C)C(=O)O', 'C(C(=O)O)N', 'CC(=O)O',
      'C1=CN=CN1', 'C(CO)O', 'CC(=O)C(=O)O', 'OC(=O)C=CC(=O)O',
    ];
    const r = await benchmark('Thermo — estimateFormationEnergy × 50', () => {
      for (let i = 0; i < 50; i++) {
        estimateFormationEnergy(smiles[i % smiles.length]);
      }
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(10000);
  });

  test('Thermo — calcPathwayDeltaG (6-step artemisinin)', async () => {
    const { calcPathwayDeltaG } = await import('../src/services/thermoEngine');
    const steps = [
      { dG0: -25.0, name: 'acetyl_coa → hmg_coa' },
      { dG0: -15.0, name: 'hmg_coa → mevalonate' },
      { dG0: -20.0, name: 'mevalonate → fpp' },
      { dG0: -10.0, name: 'fpp → amorpha_diene' },
      { dG0: -30.0, name: 'amorpha_diene → artemisinic_acid' },
      { dG0: -12.0, name: 'artemisinic_acid → artemisinin' },
    ];
    const r = await benchmark('Thermo — calcPathwayDeltaG (6-step)', () => {
      calcPathwayDeltaG(steps, 7.0, 0.1, 298.15);
    });
    results.push(r);
  });

  test('Kinetics — simulateEnzymeSystem (2 enzymes, adaptive RK4)', async () => {
    const { simulateEnzymeSystem } = await import('../src/services/kineticsEngine');
    const r = await benchmark('Kinetics — simulateEnzymeSystem', () => {
      simulateEnzymeSystem(
        [
          { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 2 },
          { id: 'E2', substrateIndex: 1, productIndex: 2, vmax: 5, km: 1 },
        ],
        [10, 0, 0],
        20, 0.1,
        { adaptive: true, rtol: 1e-6, atol: 1e-9 },
      );
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(5000);
  });

  test('Kinetics — runRK4 (1000 steps)', async () => {
    const { runRK4 } = await import('../src/utils/kinetics');
    const r = await benchmark('Kinetics — runRK4 (1000 steps)', () => {
      runRK4(10, 0, 50, 2, 0.5, 0.1, undefined, undefined, 10, 1000);
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(5000);
  });

  test('CatDes — predictBindingAffinity', async () => {
    const { predictBindingAffinity } = await import('../src/services/CatalystDesignerEngine');
    const enzyme = {
      id: 'bench', name: 'BenchEnzyme', ecNumber: '1.1.1.1',
      uniprotId: 'P00001', sequence: 'M' + 'ALMVGFWYCDESTNQKRHP'.repeat(20), length: 201,
      catalyticResidues: [{
        position: 50, residue: 'S', role: 'nucleophile' as const,
        distanceToSubstrate: 2.8, optimalDistance: 2.7,
        orientationAngle: 110, optimalAngle: 108,
        pKa: 6.0, pKaShift: -0.3,
      }],
      substrate: 'substrate', product: 'product',
      kcat: 10, km: 0.5, vmax: 100,
      optimalTemp: 37, optimalPH: 7.0,
      meltingTemp: 55, molecularWeight: 45,
    };
    const r = await benchmark('CatDes — predictBindingAffinity', () => {
      predictBindingAffinity(enzyme);
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(10000);
  });

  test('CatDes — runFullDesignPipeline', async () => {
    const { runFullDesignPipeline } = await import('../src/services/CatalystDesignerEngine');
    const enzyme = {
      id: 'bench', name: 'BenchEnzyme', ecNumber: '1.1.1.1',
      uniprotId: 'P00001', sequence: 'M' + 'ALMVGFWYCDESTNQKRHP'.repeat(20), length: 201,
      catalyticResidues: [{
        position: 50, residue: 'S', role: 'nucleophile' as const,
        distanceToSubstrate: 2.8, optimalDistance: 2.7,
        orientationAngle: 110, optimalAngle: 108,
        pKa: 6.0, pKaShift: -0.3,
      }],
      substrate: 'substrate', product: 'product',
      kcat: 10, km: 0.5, vmax: 100,
      optimalTemp: 37, optimalPH: 7.0,
      meltingTemp: 55, molecularWeight: 45,
    };
    const r = await benchmark('CatDes — runFullDesignPipeline', () => {
      runFullDesignPipeline(enzyme, [
        {
          stepNumber: 1, enzyme: 'HMGR', substrate: 'hmg_coa', product: 'mevalonate',
          kcat: 10, km: 0.5, currentFlux: 5, targetFlux: 8,
          intermediateConc: 0.1, toxicityThreshold: 1.0, isToxic: false,
          adjustedKcat: 10, expressionMultiplier: 1.0,
        },
        {
          stepNumber: 2, enzyme: 'ERG20', substrate: 'mevalonate', product: 'fpp',
          kcat: 8, km: 0.3, currentFlux: 4, targetFlux: 7,
          intermediateConc: 0.05, toxicityThreshold: 0.5, isToxic: false,
          adjustedKcat: 8, expressionMultiplier: 1.0,
        },
      ], [
        {
          id: 'c1', name: 'candidate1', steps: 2, deltaG: -40,
          theoreticalYield: 0.8, atpBurden: 2, nadphBurden: 1,
          enzymeComplexity: 2, toxicIntermediates: 0,
          paretoRank: 0, dominatedBy: [],
          scores: { thermodynamic: 0.8, yield: 0.8, metabolicCost: 0.7, feasibility: 0.75 },
        },
      ]);
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(10000);
  });

  test('CellFree — runFullCFSPipeline', async () => {
    const { runFullCFSPipeline } = await import('../src/services/CellFreeEngine');
    const r = await benchmark('CellFree — runFullCFSPipeline', () => {
      runFullCFSPipeline();
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(5000);
  });

  test('CellFree — simulateCFPS (3 constructs)', async () => {
    const { simulateCFPS, generateDefaultConstructs, generateDefaultParameters } = await import('../src/services/CellFreeEngine');
    const constructs = generateDefaultConstructs();
    const params = generateDefaultParameters();
    const r = await benchmark('CellFree — simulateCFPS', () => {
      simulateCFPS(constructs, params);
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(5000);
  });

  test('MultiO — computeEmbeddings (50 genes)', async () => {
    const { OmicsFoundationModel } = await import('../src/services/OmicsIntegrator');
    const genes = ['ADS', 'CYP71AV1', 'ERG20', 'HMGR', 'IDI1', 'FPP', 'DBR2', 'CPR1',
      'ALDH1', 'DXS', 'DXR', 'MCT', 'CMK', 'MCS', 'HDS', 'HDR', 'IDP', 'GPPS',
      'SQS', 'SQE', 'BAS', 'CYP71', 'ADH', 'CYB5', 'CPR', 'RED1', 'OX1', 'OX2',
      'DH1', 'DH2', 'ER1', 'ER2', 'KR1', 'KR2', 'AR1', 'AR2', 'TR1', 'TR2',
      'OX3', 'DH3', 'ER3', 'KR3', 'AR3', 'TR3', 'OX4', 'DH4', 'ER4', 'KR4',
      'AR4', 'TR4'];
    const data = genes.map((g, i) => ({
      id: String(i + 1), gene: g,
      transcript: 2 + Math.sin(i) * 4,
      protein: 1.5 + Math.cos(i) * 3,
      metabolite: 1 + Math.sin(i * 0.7) * 2,
      fold_change: 0.5 + Math.abs(Math.sin(i * 0.3)) * 2,
      pValue: 0.001 + (i % 10) * 0.05,
    }));
    const r = await benchmark('MultiO — computeEmbeddings (50 genes)', () => {
      const model = new OmicsFoundationModel(data);
      model.computeEmbeddings();
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(10000);
  });

  test('MultiO — full pipeline (50 genes)', async () => {
    const { OmicsFoundationModel } = await import('../src/services/OmicsIntegrator');
    const data = Array.from({ length: 50 }, (_, i) => ({
      id: String(i + 1), gene: `gene_${i}`,
      transcript: 2 + Math.sin(i) * 4,
      protein: 1.5 + Math.cos(i) * 3,
      metabolite: 1 + Math.sin(i * 0.7) * 2,
      fold_change: 0.5 + Math.abs(Math.sin(i * 0.3)) * 2,
      pValue: 0.001 + (i % 10) * 0.05,
    }));
    const r = await benchmark('MultiO — full pipeline', () => {
      const model = new OmicsFoundationModel(data);
      model.computeEmbeddings();
      model.analyzeBottleneck();
      model.simulatePerturbation('gene_0', 8.0);
      model.computeCorrelationMatrix();
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(10000);
  });

  test('ScSpatial — runFullPipeline (200 cells)', async () => {
    const { runFullPipeline } = await import('../src/services/ScSpatialEngine');
    const genes = ['ACT1', 'ADS', 'CYP71AV1', 'ERG20', 'HMGR', 'IDI1', 'FPP', 'DBR2',
      'CPR1', 'ALDH1', 'DXS', 'DXR', 'MCT', 'CMK', 'MCS', 'HDS', 'HDR', 'IDP',
      'SOX2', 'NES', 'VIM', 'ATP5F1', 'COX4I1', 'SDHB', 'HSPA5', 'DDIT3', 'ATF4',
      'MKI67', 'PCNA', 'TOP2A'];
    const cells = Array.from({ length: 200 }, (_, i) => ({
      id: `cell_${i}`,
      barcode: `BC${i}`,
      totalCounts: 1000 + (i * 37) % 5000,
      nGenes: 100 + (i * 13) % 500,
      mitoPercent: (i * 7) % 15,
      geneExpression: Object.fromEntries(genes.map((g, j) => [g, Math.abs(Math.sin(i * 0.1 + j * 0.3)) * 8])),
      cluster: i % 5,
      cellType: '',
      pseudotime: 0,
      spatialX: (i * 3.7) % 100 - 50,
      spatialY: (i * 2.3) % 100 - 50,
      batchId: 0,
      qcPass: true,
    }));
    const r = await benchmark('ScSpatial — runFullPipeline (200 cells)', async () => {
      await runFullPipeline(cells);
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(30000);
  });

  test('ScSpatial — clusterCells (200 cells)', async () => {
    const { clusterCells } = await import('../src/services/ScSpatialEngine');
    const genes = ['ACT1', 'ADS', 'CYP71AV1', 'ERG20', 'HMGR', 'IDI1', 'FPP', 'DBR2',
      'CPR1', 'ALDH1', 'DXS', 'DXR', 'MCT', 'CMK', 'MCS', 'HDS', 'HDR', 'IDP',
      'SOX2', 'NES', 'VIM', 'ATP5F1', 'COX4I1', 'SDHB', 'HSPA5', 'DDIT3', 'ATF4',
      'MKI67', 'PCNA', 'TOP2A'];
    const cells = Array.from({ length: 200 }, (_, i) => ({
      id: `cell_${i}`,
      barcode: `BC${i}`,
      totalCounts: 1000 + (i * 37) % 5000,
      nGenes: 100 + (i * 13) % 500,
      mitoPercent: (i * 7) % 15,
      geneExpression: Object.fromEntries(genes.map((g, j) => [g, Math.abs(Math.sin(i * 0.1 + j * 0.3)) * 8])),
      cluster: i % 5,
      cellType: '',
      pseudotime: 0,
      spatialX: (i * 3.7) % 100 - 50,
      spatialY: (i * 2.3) % 100 - 50,
      batchId: 0,
      qcPass: true,
    }));
    const r = await benchmark('ScSpatial — clusterCells (200 cells)', () => {
      clusterCells(cells, 1.0);
    });
    results.push(r);
    expect(r.medianMs).toBeLessThan(30000);
  });

});
