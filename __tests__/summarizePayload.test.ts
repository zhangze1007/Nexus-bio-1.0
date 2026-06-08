/** @jest-environment node */

import { summarizePayload } from '../src/store/slices/sharedHelpers';

describe('summarizePayload', () => {
  it('returns generic message for null payload', () => {
    expect(summarizePayload('pathd', null as any)).toBe('PATHD updated');
  });

  it('returns generic message for undefined payload', () => {
    expect(summarizePayload('fbasim', undefined as any)).toBe('FBASIM updated');
  });

  it('summarizes pathd payload', () => {
    const payload = {
      activeRouteLabel: 'Route A',
      nodeCount: 5,
      result: { bottleneckCount: 2 },
    } as any;
    const summary = summarizePayload('pathd', payload);
    expect(summary).toContain('PATHD');
    expect(summary).toContain('Route A');
    expect(summary).toContain('5 nodes');
    expect(summary).toContain('2 bottlenecks');
  });

  it('summarizes fbasim payload', () => {
    const payload = {
      mode: 'single',
      result: { growthRate: 0.823, feasible: true },
    } as any;
    const summary = summarizePayload('fbasim', payload);
    expect(summary).toContain('FBA');
    expect(summary).toContain('single');
    expect(summary).toContain('0.823');
    expect(summary).toContain('yes');
  });

  it('summarizes fbasim payload with infeasible result', () => {
    const payload = {
      mode: 'community',
      result: { growthRate: 0.0, feasible: false },
    } as any;
    const summary = summarizePayload('fbasim', payload);
    expect(summary).toContain('no');
  });

  it('summarizes cethx payload', () => {
    const payload = {
      pathway: 'Glycolysis',
      result: { gibbsFreeEnergy: -18.5, efficiency: 72.3 },
    } as any;
    const summary = summarizePayload('cethx', payload);
    expect(summary).toContain('Thermo');
    expect(summary).toContain('Glycolysis');
    expect(summary).toContain('-18.5');
    expect(summary).toContain('72.3%');
  });

  it('summarizes catdes payload', () => {
    const payload = {
      selectedEnzymeName: 'CYP71AV1',
      designCount: 8,
      result: { isViable: true },
    } as any;
    const summary = summarizePayload('catdes', payload);
    expect(summary).toContain('Catalyst');
    expect(summary).toContain('CYP71AV1');
    expect(summary).toContain('8 designs');
    expect(summary).toContain('yes');
  });

  it('summarizes catdes payload with non-viable result', () => {
    const payload = {
      selectedEnzymeName: 'Test',
      designCount: 3,
      result: { isViable: false },
    } as any;
    const summary = summarizePayload('catdes', payload);
    expect(summary).toContain('no');
  });

  it('summarizes dyncon payload', () => {
    const payload = {
      result: { productTiter: 12.34, stable: true },
    } as any;
    const summary = summarizePayload('dyncon', payload);
    expect(summary).toContain('Dynamic control');
    expect(summary).toContain('12.34');
    expect(summary).toContain('yes');
  });

  it('summarizes cellfree payload', () => {
    const payload = {
      targetConstruct: 'pET28a-GFP',
      result: { totalProteinYield: 2.56 },
    } as any;
    const summary = summarizePayload('cellfree', payload);
    expect(summary).toContain('Cell-free');
    expect(summary).toContain('pET28a-GFP');
    expect(summary).toContain('2.56');
  });

  it('summarizes dbtlflow payload with typed metrics', () => {
    const payload = {
      proposedPhase: 'Test',
      passed: true,
      result: {
        feedback: { learnedMetrics: { yield: 0.5, growth: 0.3 } },
      },
    } as any;
    const summary = summarizePayload('dbtlflow', payload);
    expect(summary).toContain('DBTL');
    expect(summary).toContain('Test');
    expect(summary).toContain('2 learned');
  });

  it('summarizes dbtlflow payload with legacy learned parameters', () => {
    const payload = {
      proposedPhase: 'Learn',
      passed: false,
      result: {
        learnedParameters: ['param1', 'param2', 'param3'],
      },
    } as any;
    const summary = summarizePayload('dbtlflow', payload);
    expect(summary).toContain('no');
    expect(summary).toContain('3 learned');
  });

  it('summarizes proevol payload', () => {
    const payload = {
      targetProtein: 'ADS',
      currentRound: 3,
      totalRounds: 5,
      result: { leadVariantName: 'ADS-V3-L1' },
    } as any;
    const summary = summarizePayload('proevol', payload);
    expect(summary).toContain('PROEVOL');
    expect(summary).toContain('ADS');
    expect(summary).toContain('3/5');
    expect(summary).toContain('ADS-V3-L1');
  });

  it('summarizes gecair payload', () => {
    const payload = {
      gateType: 'AND',
      result: { outputLevel: 0.85 },
    } as any;
    const summary = summarizePayload('gecair', payload);
    expect(summary).toContain('Gene circuit');
    expect(summary).toContain('AND');
    expect(summary).toContain('0.85');
  });

  it('summarizes genmim payload', () => {
    const payload = {
      result: { selectedTargets: 12, offTargetRisk: 0.15 },
    } as any;
    const summary = summarizePayload('genmim', payload);
    expect(summary).toContain('Genome minimizer');
    expect(summary).toContain('12 targets');
    expect(summary).toContain('0.15');
  });

  it('summarizes multio payload', () => {
    const payload = {
      selectedGene: 'CYP71AV1',
      result: { significantCount: 24 },
    } as any;
    const summary = summarizePayload('multio', payload);
    expect(summary).toContain('Multi-omics');
    expect(summary).toContain('CYP71AV1');
    expect(summary).toContain('24 significant');
  });

  it('summarizes scspatial payload', () => {
    const payload = {
      highlightGene: 'MT-CO1',
      result: { highestYieldCluster: 3 },
    } as any;
    const summary = summarizePayload('scspatial', payload);
    expect(summary).toContain('Spatial');
    expect(summary).toContain('MT-CO1');
    expect(summary).toContain('cluster 3');
  });

  it('summarizes nexai payload', () => {
    const payload = {
      result: { mode: 'literature', citations: 15, confidence: 0.87 },
    } as any;
    const summary = summarizePayload('nexai', payload);
    expect(summary).toContain('Axon');
    expect(summary).toContain('literature');
    expect(summary).toContain('15 citations');
    expect(summary).toContain('87% confidence');
  });

  it('returns generic message for unknown tool id', () => {
    const payload = { someField: 'value' } as any;
    const summary = summarizePayload('unknown_tool' as any, payload);
    expect(summary).toBe('UNKNOWN_TOOL updated');
  });
});
