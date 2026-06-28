/**
 * FBA Performance Benchmark Tests
 *
 * Measures FBA solver performance across different model sizes
 * to ensure acceptable performance on Vercel Serverless.
 *
 * Tests:
 *   1. Small model (10 reactions) — should complete in <100ms
 *   2. Medium model (50 reactions) — should complete in <500ms
 *   3. Large model (200 reactions) — should complete in <2000ms
 *   4. E. coli iJO1366 subset — should complete in <5000ms
 */

import { solveAuthorityFBA } from '../../src/server/fbaEngine';

describe('FBA Performance Benchmarks', () => {
  // Helper to measure execution time
  async function measureTime(fn: () => Promise<void>): Promise<number> {
    const start = performance.now();
    await fn();
    return performance.now() - start;
  }

  it('E. coli iJO1366 biomass FBA completes in <5s', async () => {
    const time = await measureTime(async () => {
      await solveAuthorityFBA({
        species: 'ecoli',
        objective: 'biomass',
        glucoseUptake: 10,
        oxygenUptake: 20,
        knockouts: [],
      });
    });

    expect(time).toBeLessThan(5000);
    console.log(`E. coli biomass FBA: ${time.toFixed(0)}ms`);
  });

  it('E. coli ATP FBA completes in <5s', async () => {
    const time = await measureTime(async () => {
      await solveAuthorityFBA({
        species: 'ecoli',
        objective: 'atp',
        glucoseUptake: 10,
        oxygenUptake: 20,
        knockouts: [],
      });
    });

    expect(time).toBeLessThan(5000);
    console.log(`E. coli ATP FBA: ${time.toFixed(0)}ms`);
  });

  it('E. coli product FBA completes in <5s', async () => {
    const time = await measureTime(async () => {
      await solveAuthorityFBA({
        species: 'ecoli',
        objective: 'product',
        glucoseUptake: 10,
        oxygenUptake: 20,
        knockouts: [],
      });
    });

    expect(time).toBeLessThan(5000);
    console.log(`E. coli product FBA: ${time.toFixed(0)}ms`);
  });

  it('FBA with knockouts completes in <5s', async () => {
    const time = await measureTime(async () => {
      await solveAuthorityFBA({
        species: 'ecoli',
        objective: 'biomass',
        glucoseUptake: 10,
        oxygenUptake: 20,
        knockouts: ['PFK', 'PGK'],
      });
    });

    expect(time).toBeLessThan(5000);
    console.log(`E. coli knockout FBA: ${time.toFixed(0)}ms`);
  });

  it('Yeast FBA completes in <5s', async () => {
    const time = await measureTime(async () => {
      await solveAuthorityFBA({
        species: 'yeast',
        objective: 'biomass',
        glucoseUptake: 10,
        oxygenUptake: 20,
        knockouts: [],
      });
    });

    expect(time).toBeLessThan(5000);
    console.log(`Yeast biomass FBA: ${time.toFixed(0)}ms`);
  });

  it('Community FBA (ecoli + yeast) completes in <10s', async () => {
    const { solveAuthorityCommunityFBA } = await import('../../src/server/fbaEngine');

    const time = await measureTime(async () => {
      await solveAuthorityCommunityFBA({
        objective: 'biomass',
        ecoli: {
          glucoseUptake: 10,
          oxygenUptake: 20,
          knockouts: [],
        },
        yeast: {
          glucoseUptake: 10,
          oxygenUptake: 20,
          knockouts: [],
        },
        alpha: 0.5,
      });
    });

    expect(time).toBeLessThan(10000);
    console.log(`Community FBA: ${time.toFixed(0)}ms`);
  });
});
