/**
 * Tests for src/components/workbench/workbenchTrust.ts
 *
 * Covers:
 *  - getAuthorityTier
 *  - getAuthoritySummary
 *  - getToolFreshness
 *  - getFreshnessMap
 *  - buildExperimentLedger
 *  - Edge cases: empty arrays, null/undefined inputs
 */

import {
  getAuthorityTier,
  getAuthoritySummary,
  getToolFreshness,
  getFreshnessMap,
  buildExperimentLedger,
} from '../src/components/workbench/workbenchTrust';
import type { WorkbenchRunArtifact } from '../src/store/workbenchTypes';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRunArtifact(overrides: Partial<WorkbenchRunArtifact> = {}): WorkbenchRunArtifact {
  return {
    id: 'run-1',
    toolId: 'fbasim',
    stageId: 'stage-2',
    targetProduct: 'artemisinin',
    upstreamArtifactIds: [],
    execution: {
      projectRef: null,
      analyzeRef: null,
      upstreamToolIds: [],
      upstreamArtifactIds: [],
      dependencySignature: 'fbasim|project:none|analyze:none',
    },
    summary: 'FBA simulation run',
    payloadSnapshot: {
      toolId: 'fbasim',
      validity: 'partial',
      targetProduct: 'artemisinin',
      pathwayFocus: 'glycolysis',
      mode: 'single',
      objective: 'biomass',
      glucoseUptake: 10,
      oxygenUptake: 8,
      knockouts: [],
      result: {
        growthRate: 0.35,
        atpYield: 24,
        nadhProduction: 16,
        carbonEfficiency: 72,
        feasible: true,
        sensitivityCoefficients: { glc: 0.05, o2: 0.04, atp: 0.02 },
        topFluxes: [],
      },
      updatedAt: Date.now(),
    },
    createdAt: Date.now(),
    isSimulated: false,
    ...overrides,
  } as WorkbenchRunArtifact;
}

// ── getAuthorityTier ─────────────────────────────────────────────────────────

describe('getAuthorityTier', () => {
  it('returns simulated for simulated artifacts', () => {
    const artifact = makeRunArtifact({ isSimulated: true });
    expect(getAuthorityTier(artifact)).toBe('simulated');
  });

  it('returns experiment-backed for cellfree tool', () => {
    const artifact = makeRunArtifact({ toolId: 'cellfree' as any });
    expect(getAuthorityTier(artifact)).toBe('experiment-backed');
  });

  it('returns experiment-backed for dbtlflow tool', () => {
    const artifact = makeRunArtifact({ toolId: 'dbtlflow' as any });
    expect(getAuthorityTier(artifact)).toBe('experiment-backed');
  });

  it('returns experiment-backed for multio tool', () => {
    const artifact = makeRunArtifact({ toolId: 'multio' as any });
    expect(getAuthorityTier(artifact)).toBe('experiment-backed');
  });

  it('returns experiment-backed for scspatial tool', () => {
    const artifact = makeRunArtifact({ toolId: 'scspatial' as any });
    expect(getAuthorityTier(artifact)).toBe('experiment-backed');
  });

  it('returns evidence-linked when sourceArtifactId is present', () => {
    const artifact = makeRunArtifact({ sourceArtifactId: 'source-1' });
    expect(getAuthorityTier(artifact)).toBe('evidence-linked');
  });

  it('returns evidence-linked when execution.analyzeRef is present', () => {
    const artifact = makeRunArtifact({
      execution: {
        projectRef: null,
        analyzeRef: 'analyze-1',
        upstreamToolIds: [],
        upstreamArtifactIds: [],
        dependencySignature: 'fbasim|project:none|analyze:analyze-1',
      },
    });
    expect(getAuthorityTier(artifact)).toBe('evidence-linked');
  });

  it('returns contextual when no special conditions', () => {
    const artifact = makeRunArtifact();
    expect(getAuthorityTier(artifact)).toBe('contextual');
  });
});

// ── getAuthoritySummary ──────────────────────────────────────────────────────

describe('getAuthoritySummary', () => {
  it('returns correct summary for simulated', () => {
    expect(getAuthoritySummary('simulated')).toContain('Simulation-grade');
  });

  it('returns correct summary for contextual', () => {
    expect(getAuthoritySummary('contextual')).toContain('Derived from');
  });

  it('returns correct summary for evidence-linked', () => {
    expect(getAuthoritySummary('evidence-linked')).toContain('Linked to');
  });

  it('returns correct summary for experiment-backed', () => {
    expect(getAuthoritySummary('experiment-backed')).toContain('Backed by');
  });
});

// ── getToolFreshness ─────────────────────────────────────────────────────────

describe('getToolFreshness', () => {
  it('returns not-run status when toolId is null', () => {
    const result = getToolFreshness([], null);
    expect(result.status).toBe('not-run');
    expect(result.toolId).toBe('unknown');
  });

  it('returns not-run status when toolId is undefined', () => {
    const result = getToolFreshness([], undefined);
    expect(result.status).toBe('not-run');
  });

  it('returns not-run or awaiting-upstream when no artifacts exist for the tool', () => {
    const result = getToolFreshness([], 'fbasim');
    // fbasim has upstream dependencies (pathd), so it may return awaiting-upstream
    expect(['not-run', 'awaiting-upstream']).toContain(result.status);
    expect(result.latestRunArtifact).toBeNull();
  });

  it('returns fresh or stale status when artifact exists for the tool', () => {
    const artifact = makeRunArtifact();
    const result = getToolFreshness([artifact], 'fbasim');
    // The status depends on whether the execution snapshot matches
    expect(['fresh', 'stale']).toContain(result.status);
    expect(result.latestRunArtifact).toBe(artifact);
  });

  it('returns correct toolId in result', () => {
    const result = getToolFreshness([], 'catdes');
    expect(result.toolId).toBe('catdes');
  });

  it('uses latest artifact by toolId (first occurrence)', () => {
    const artifact1 = makeRunArtifact({ id: 'run-1', createdAt: 100 });
    const artifact2 = makeRunArtifact({ id: 'run-2', createdAt: 200 });
    const result = getToolFreshness([artifact1, artifact2], 'fbasim');
    // latestArtifactByTool uses first occurrence per toolId
    expect(result.latestRunArtifact?.id).toBe('run-1');
  });

  it('handles empty runArtifacts array', () => {
    const result = getToolFreshness([], 'fbasim');
    // fbasim has upstream deps, so may be awaiting-upstream
    expect(['not-run', 'awaiting-upstream']).toContain(result.status);
    expect(Array.isArray(result.blockingToolIds)).toBe(true);
  });
});

// ── getFreshnessMap ──────────────────────────────────────────────────────────

describe('getFreshnessMap', () => {
  it('returns a map for all requested toolIds', () => {
    const map = getFreshnessMap([], ['fbasim', 'catdes', 'dyncon']);
    expect(Object.keys(map)).toEqual(['fbasim', 'catdes', 'dyncon']);
    // Tools with upstream deps may be awaiting-upstream
    expect(['not-run', 'awaiting-upstream']).toContain(map.fbasim.status);
    expect(['not-run', 'awaiting-upstream']).toContain(map.catdes.status);
    expect(['not-run', 'awaiting-upstream']).toContain(map.dyncon.status);
  });

  it('returns empty map for empty toolIds', () => {
    const map = getFreshnessMap([], []);
    expect(Object.keys(map)).toEqual([]);
  });

  it('matches artifacts to correct tools', () => {
    const fbaArtifact = makeRunArtifact({ id: 'fba-1', toolId: 'fbasim' });
    const catArtifact = makeRunArtifact({ id: 'cat-1', toolId: 'catdes' as any });
    const map = getFreshnessMap([fbaArtifact, catArtifact], ['fbasim', 'catdes']);
    // Both tools have artifacts, status depends on execution snapshot matching
    expect(map.fbasim.latestRunArtifact?.id).toBe('fba-1');
    expect(map.catdes.latestRunArtifact?.id).toBe('cat-1');
  });
});

// ── buildExperimentLedger ────────────────────────────────────────────────────

describe('buildExperimentLedger', () => {
  it('returns empty array when no matching artifacts', () => {
    const artifact = makeRunArtifact({ toolId: 'fbasim' });
    const ledger = buildExperimentLedger([artifact]);
    expect(ledger).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(buildExperimentLedger([])).toEqual([]);
  });

  it('filters to only experiment-backed tool types', () => {
    const fba = makeRunArtifact({ id: 'fba-1', toolId: 'fbasim' });
    const cellfree = makeRunArtifact({
      id: 'cf-1',
      toolId: 'cellfree' as any,
      payloadSnapshot: {
        toolId: 'cellfree',
        validity: 'partial',
        targetProduct: 'artemisinin',
        targetConstruct: 'ADS',
        constructCount: 3,
        temperature: 30,
        simulationTime: 240,
        result: {
          totalProteinYield: 1.5,
          energyDepletionTime: 180,
          isResourceLimited: false,
          invitroMaxProtein: 2.0,
          invivoExpression: 1.2,
          confidence: 0.7,
        },
        updatedAt: Date.now(),
      },
    } as any);
    const ledger = buildExperimentLedger([fba, cellfree]);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].toolId).toBe('cellfree');
  });

  it('builds cellfree ledger entry correctly', () => {
    const artifact = makeRunArtifact({
      id: 'cf-1',
      toolId: 'cellfree' as any,
      summary: 'Cell-free test run',
      payloadSnapshot: {
        toolId: 'cellfree',
        validity: 'partial',
        targetProduct: 'artemisinin',
        targetConstruct: 'ADS construct',
        constructCount: 3,
        temperature: 30,
        simulationTime: 240,
        result: {
          totalProteinYield: 1.8,
          energyDepletionTime: 180,
          isResourceLimited: false,
          invitroMaxProtein: 2.1,
          invivoExpression: 1.2,
          confidence: 0.72,
        },
        updatedAt: Date.now(),
      },
    } as any);
    const ledger = buildExperimentLedger([artifact]);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].title).toContain('Cell-free validation');
    expect(ledger[0].title).toContain('ADS construct');
    expect(ledger[0].status).toBe('recorded');
    expect(ledger[0].metrics.length).toBe(3);
  });

  it('builds cellfree ledger entry with attention status when resource limited', () => {
    const artifact = makeRunArtifact({
      id: 'cf-1',
      toolId: 'cellfree' as any,
      summary: 'Resource limited run',
      payloadSnapshot: {
        toolId: 'cellfree',
        validity: 'partial',
        targetProduct: 'artemisinin',
        targetConstruct: 'ADS',
        constructCount: 3,
        temperature: 30,
        simulationTime: 240,
        result: {
          totalProteinYield: 0.5,
          energyDepletionTime: 60,
          isResourceLimited: true,
          invitroMaxProtein: 2.0,
          invivoExpression: 1.2,
          confidence: 0.3,
        },
        updatedAt: Date.now(),
      },
    } as any);
    const ledger = buildExperimentLedger([artifact]);
    expect(ledger[0].status).toBe('attention');
  });

  it('builds dbtlflow ledger entry correctly', () => {
    const artifact = makeRunArtifact({
      id: 'dbtl-1',
      toolId: 'dbtlflow' as any,
      summary: 'DBTL iteration 1',
      payloadSnapshot: {
        toolId: 'dbtlflow',
        validity: 'partial',
        targetProduct: 'artemisinin',
        proposedPhase: 'Learn',
        draftHypothesis: 'Test',
        measuredResult: 12,
        unit: 'mg/L',
        passed: true,
        feedbackSource: 'committed',
        feedbackIterationId: 1,
        result: {
          bestIteration: 1,
          improvementRate: 15,
          passRate: 80,
          latestPhase: 'Learn',
        },
        updatedAt: Date.now(),
      },
    } as any);
    const ledger = buildExperimentLedger([artifact]);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].title).toContain('DBTL');
    expect(ledger[0].title).toContain('Learn');
    expect(ledger[0].status).toBe('committed');
  });

  it('builds dbtlflow ledger entry with draft status', () => {
    const artifact = makeRunArtifact({
      id: 'dbtl-1',
      toolId: 'dbtlflow' as any,
      payloadSnapshot: {
        toolId: 'dbtlflow',
        validity: 'partial',
        targetProduct: 'artemisinin',
        proposedPhase: 'Test',
        draftHypothesis: 'Test',
        measuredResult: 12,
        unit: 'mg/L',
        passed: false,
        feedbackSource: 'draft',
        feedbackIterationId: 1,
        result: {
          bestIteration: 1,
          improvementRate: 5,
          passRate: 50,
          latestPhase: 'Test',
        },
        updatedAt: Date.now(),
      },
    } as any);
    const ledger = buildExperimentLedger([artifact]);
    expect(ledger[0].status).toBe('draft');
  });

  it('builds multio ledger entry correctly', () => {
    const artifact = makeRunArtifact({
      id: 'mo-1',
      toolId: 'multio' as any,
      summary: 'Multi-omics integration',
      payloadSnapshot: {
        toolId: 'multio',
        validity: 'partial',
        targetProduct: 'artemisinin',
        selectedGene: 'ADS',
        activeView: 'volcano',
        thresholds: { fc: 1.5, pv: 0.05 },
        result: {
          significantCount: 42,
          dominantLayer: 'proteomics',
          bottleneckGene: 'ADS',
          bottleneckConfidence: 0.85,
          mofaVarianceExplained: 0.65,
          topEfficiencyGene: 'HMGR',
          topEfficiencyScore: 0.92,
          vaeElbo: -1200,
        },
        updatedAt: Date.now(),
      },
    } as any);
    const ledger = buildExperimentLedger([artifact]);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].title).toContain('Multi-omics');
    expect(ledger[0].title).toContain('ADS');
    expect(ledger[0].metrics.length).toBe(3);
  });

  it('builds scspatial ledger entry correctly', () => {
    const artifact = makeRunArtifact({
      id: 'ss-1',
      toolId: 'scspatial' as any,
      summary: 'Spatial analysis',
      payloadSnapshot: {
        toolId: 'scspatial',
        validity: 'partial',
        targetProduct: 'artemisinin',
        artifactId: 'art-1',
        source: 'upload',
        datasetMeta: {} as any,
        selectedCluster: 'cluster-1',
        selectedCellId: null,
        highlightGene: 'CYP71AV1',
        activeView: 'spatial-2d',
        exportableArtifacts: [],
        result: {
          totalCells: 5000,
          passedCells: 4500,
          topSpatialGene: 'CYP71AV1',
          topMoranI: 0.72,
          highestYieldCluster: 'cluster-1',
          hotspotCount: 3,
        },
        updatedAt: Date.now(),
      },
    } as any);
    const ledger = buildExperimentLedger([artifact]);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].title).toContain('Single-cell');
    expect(ledger[0].title).toContain('CYP71AV1');
  });

  it('respects limit parameter', () => {
    const artifacts = Array.from({ length: 20 }, (_, i) =>
      makeRunArtifact({
        id: `cf-${i}`,
        toolId: 'cellfree' as any,
        payloadSnapshot: {
          toolId: 'cellfree',
          validity: 'partial',
          targetProduct: 'artemisinin',
          targetConstruct: 'ADS',
          constructCount: 3,
          temperature: 30,
          simulationTime: 240,
          result: {
            totalProteinYield: 1.5,
            energyDepletionTime: 180,
            isResourceLimited: false,
            invitroMaxProtein: 2.0,
            invivoExpression: 1.2,
            confidence: 0.7,
          },
          updatedAt: Date.now(),
        },
      } as any),
    );
    const ledger = buildExperimentLedger(artifacts, 5);
    expect(ledger).toHaveLength(5);
  });

  it('cellfree ledger includes null confidence as pending', () => {
    const artifact = makeRunArtifact({
      id: 'cf-1',
      toolId: 'cellfree' as any,
      payloadSnapshot: {
        toolId: 'cellfree',
        validity: 'partial',
        targetProduct: 'artemisinin',
        targetConstruct: 'ADS',
        constructCount: 3,
        temperature: 30,
        simulationTime: 240,
        result: {
          totalProteinYield: 1.5,
          energyDepletionTime: 180,
          isResourceLimited: false,
          invitroMaxProtein: 2.0,
          invivoExpression: 1.2,
          confidence: null,
        },
        updatedAt: Date.now(),
      },
    } as any);
    const ledger = buildExperimentLedger([artifact]);
    expect(ledger[0].metrics[2]).toBe('confidence pending');
  });
});
