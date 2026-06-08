/**
 * Tests for workbenchStore slices and shared helpers.
 *
 * Covers:
 * - summarizePayload (pure function)
 * - evaluateContractStatus (pure function)
 * - buildRunEvidenceSnapshot (pure function)
 * - Store actions: ensureProject, upsertEvidence, setToolPayload, visitTool
 */

import { summarizePayload, buildRunEvidenceSnapshot, evaluateContractStatus } from '../src/store/slices/sharedHelpers';
import type { WorkbenchToolPayloadMap } from '../src/store/workbenchPayloads';

// ── summarizePayload tests ──────────────────────────────────────────

describe('summarizePayload', () => {
  it('returns fallback for null/undefined payload', () => {
    expect(summarizePayload('pathd', null as never)).toBe('PATHD updated');
    expect(summarizePayload('fbasim', undefined as never)).toBe('FBASIM updated');
  });

  it('summarizes pathd payload', () => {
    const payload = {
      activeRouteLabel: 'Artemisinin',
      nodeCount: 7,
      result: { bottleneckCount: 2 },
    } as unknown as WorkbenchToolPayloadMap['pathd'];
    const summary = summarizePayload('pathd', payload);
    expect(summary).toContain('PATHD');
    expect(summary).toContain('Artemisinin');
    expect(summary).toContain('7 nodes');
    expect(summary).toContain('2 bottlenecks');
  });

  it('summarizes fbasim payload', () => {
    const payload = {
      mode: 'single',
      result: { growthRate: 0.85, feasible: true },
    } as unknown as WorkbenchToolPayloadMap['fbasim'];
    const summary = summarizePayload('fbasim', payload);
    expect(summary).toContain('FBA');
    expect(summary).toContain('single');
    expect(summary).toContain('0.850');
    expect(summary).toContain('yes');
  });

  it('summarizes cethx payload', () => {
    const payload = {
      pathway: 'Glycolysis',
      result: { gibbsFreeEnergy: -23.5, efficiency: 85.2 },
    } as unknown as WorkbenchToolPayloadMap['cethx'];
    const summary = summarizePayload('cethx', payload);
    expect(summary).toContain('Thermo');
    expect(summary).toContain('Glycolysis');
    expect(summary).toContain('-23.5');
    expect(summary).toContain('85.2%');
  });

  it('summarizes catdes payload', () => {
    const payload = {
      selectedEnzymeName: 'ADS',
      designCount: 5,
      result: { isViable: true },
    } as unknown as WorkbenchToolPayloadMap['catdes'];
    const summary = summarizePayload('catdes', payload);
    expect(summary).toContain('Catalyst');
    expect(summary).toContain('ADS');
    expect(summary).toContain('5 designs');
  });

  it('summarizes dyncon payload', () => {
    const payload = {
      result: { productTiter: 12.34, stable: true },
    } as unknown as WorkbenchToolPayloadMap['dyncon'];
    const summary = summarizePayload('dyncon', payload);
    expect(summary).toContain('Dynamic control');
    expect(summary).toContain('12.34');
    expect(summary).toContain('yes');
  });

  it('summarizes cellfree payload', () => {
    const payload = {
      targetConstruct: 'pET21a-GFP',
      result: { totalProteinYield: 2.5 },
    } as unknown as WorkbenchToolPayloadMap['cellfree'];
    const summary = summarizePayload('cellfree', payload);
    expect(summary).toContain('Cell-free');
    expect(summary).toContain('pET21a-GFP');
    expect(summary).toContain('2.50 mg/mL');
  });

  it('summarizes dbtlflow payload', () => {
    const payload = {
      proposedPhase: 'Design',
      passed: true,
      result: {
        feedback: { learnedMetrics: { yield: 0.85, titer: 12.0 } },
        learnedParameters: [],
      },
    } as unknown as WorkbenchToolPayloadMap['dbtlflow'];
    const summary = summarizePayload('dbtlflow', payload);
    expect(summary).toContain('DBTL');
    expect(summary).toContain('Design');
    expect(summary).toContain('pass yes');
    expect(summary).toContain('2 learned');
  });

  it('summarizes proevol payload', () => {
    const payload = {
      targetProtein: 'CYP71AV1',
      currentRound: 3,
      totalRounds: 5,
      result: { leadVariantName: 'V3-A7' },
    } as unknown as WorkbenchToolPayloadMap['proevol'];
    const summary = summarizePayload('proevol', payload);
    expect(summary).toContain('PROEVOL');
    expect(summary).toContain('CYP71AV1');
    expect(summary).toContain('3/5');
    expect(summary).toContain('V3-A7');
  });

  it('summarizes gecair payload', () => {
    const payload = {
      gateType: 'AND',
      result: { outputLevel: 0.75 },
    } as unknown as WorkbenchToolPayloadMap['gecair'];
    const summary = summarizePayload('gecair', payload);
    expect(summary).toContain('Gene circuit');
    expect(summary).toContain('AND');
    expect(summary).toContain('0.75');
  });

  it('summarizes genmim payload', () => {
    const payload = {
      result: { selectedTargets: 12, offTargetRisk: 0.15 },
    } as unknown as WorkbenchToolPayloadMap['genmim'];
    const summary = summarizePayload('genmim', payload);
    expect(summary).toContain('Genome minimizer');
    expect(summary).toContain('12 targets');
    expect(summary).toContain('0.15');
  });

  it('summarizes multio payload', () => {
    const payload = {
      selectedGene: 'CYP71AV1',
      result: { significantCount: 8 },
    } as unknown as WorkbenchToolPayloadMap['multio'];
    const summary = summarizePayload('multio', payload);
    expect(summary).toContain('Multi-omics');
    expect(summary).toContain('CYP71AV1');
    expect(summary).toContain('8 significant');
  });

  it('summarizes scspatial payload', () => {
    const payload = {
      highlightGene: 'ALDH1',
      result: { highestYieldCluster: 'Cluster-3' },
    } as unknown as WorkbenchToolPayloadMap['scspatial'];
    const summary = summarizePayload('scspatial', payload);
    expect(summary).toContain('Spatial');
    expect(summary).toContain('ALDH1');
    expect(summary).toContain('Cluster-3');
  });

  it('summarizes nexai payload', () => {
    const payload = {
      result: { mode: 'literature', citations: 15, confidence: 0.82 },
    } as unknown as WorkbenchToolPayloadMap['nexai'];
    const summary = summarizePayload('nexai', payload);
    expect(summary).toContain('Axon');
    expect(summary).toContain('literature');
    expect(summary).toContain('15 citations');
    expect(summary).toContain('82%');
  });

  it('returns fallback for unknown tool', () => {
    const summary = summarizePayload('unknown_tool' as never, {} as never);
    expect(summary).toBe('UNKNOWN_TOOL updated');
  });
});

// ── buildRunEvidenceSnapshot tests ──────────────────────────────────

describe('buildRunEvidenceSnapshot', () => {
  it('returns snapshot with zero evidence', () => {
    const state = { evidenceItems: [], selectedEvidenceIds: [] };
    const snapshot = buildRunEvidenceSnapshot(state, 'pathd');
    expect(snapshot).toBeDefined();
    expect(snapshot!.count).toBe(0);
    expect(snapshot!.selectedCount).toBe(0);
    expect(snapshot!.evidenceItemIds).toEqual([]);
    expect(snapshot!.selectedEvidenceIds).toEqual([]);
  });

  it('counts evidence items correctly', () => {
    const state = {
      evidenceItems: [
        { id: 'ev-1', sourceKind: 'literature' },
        { id: 'ev-2', sourceKind: 'analysis' },
        { id: 'ev-3', sourceKind: 'tool' },
      ],
      selectedEvidenceIds: ['ev-1', 'ev-3'],
    };
    const snapshot = buildRunEvidenceSnapshot(state as never, 'pathd');
    expect(snapshot).toBeDefined();
    expect(snapshot!.count).toBe(3);
    expect(snapshot!.selectedCount).toBe(2);
    expect(snapshot!.evidenceItemIds).toEqual(['ev-1', 'ev-2', 'ev-3']);
    expect(snapshot!.selectedEvidenceIds).toEqual(['ev-1', 'ev-3']);
  });

  it('filters out invalid selected IDs', () => {
    const state = {
      evidenceItems: [
        { id: 'ev-1', sourceKind: 'literature' },
      ],
      selectedEvidenceIds: ['ev-1', 'ev-nonexistent'],
    };
    const snapshot = buildRunEvidenceSnapshot(state as never, 'pathd');
    expect(snapshot).toBeDefined();
    expect(snapshot!.selectedCount).toBe(1);
    expect(snapshot!.selectedEvidenceIds).toEqual(['ev-1']);
  });
});

// ── evaluateContractStatus tests ────────────────────────────────────

describe('evaluateContractStatus', () => {
  it('returns ok status when no contract exists', () => {
    const decision = evaluateContractStatus(
      'unknown_tool' as never,
      {} as never,
      new Map(),
      false,
    );
    expect(decision.status).toBe('ok');
    expect(decision.blockingUpstreamToolIds).toEqual([]);
    expect(decision.humanGateRequired).toBe(false);
  });

  it('returns valid decision for known tool', () => {
    const decision = evaluateContractStatus(
      'pathd',
      {} as WorkbenchToolPayloadMap['pathd'],
      new Map(),
      false,
    );
    expect(decision.status).toBeDefined();
    expect(typeof decision.status).toBe('string');
  });
});

// ── Store integration tests ─────────────────────────────────────────

describe('workbenchStore actions', () => {
  // Dynamic import to avoid SSR issues with zustand
  let useWorkbenchStore: typeof import('../src/store/workbenchStore').useWorkbenchStore;

  beforeAll(async () => {
    const mod = await import('../src/store/workbenchStore');
    useWorkbenchStore = mod.useWorkbenchStore;
  });

  beforeEach(() => {
    // Reset store to initial state
    useWorkbenchStore.setState({
      project: null,
      evidenceItems: [],
      selectedEvidenceIds: [],
      toolRuns: [],
      toolPayloads: {},
      runArtifacts: [],
      currentToolId: null,
      currentStageId: null,
    } as never);
  });

  it('ensureProject creates a project with defaults', () => {
    const { ensureProject } = useWorkbenchStore.getState();
    ensureProject();
    const { project } = useWorkbenchStore.getState();
    expect(project).not.toBeNull();
    expect(project?.id).toBeDefined();
    expect(project?.title).toBeDefined();
  });

  it('ensureProject patches existing project', () => {
    const { ensureProject } = useWorkbenchStore.getState();
    ensureProject({ title: 'Test Project' });
    const { project } = useWorkbenchStore.getState();
    expect(project?.title).toBe('Test Project');
  });

  it('upsertEvidence adds an item', () => {
    const { ensureProject, upsertEvidence } = useWorkbenchStore.getState();
    ensureProject();
    const id = upsertEvidence({
      title: 'Test Evidence',
      sourceKind: 'literature',
      source: 'https://example.com',
      abstract: 'Test snippet',
      authors: ['Test Author'],
    });
    expect(id).toBeDefined();
    const { evidenceItems } = useWorkbenchStore.getState();
    expect(evidenceItems.length).toBe(1);
    expect(evidenceItems[0].title).toBe('Test Evidence');
  });

  it('toggleEvidenceSelection toggles selection', () => {
    const { ensureProject, upsertEvidence, toggleEvidenceSelection } = useWorkbenchStore.getState();
    ensureProject();
    const id = upsertEvidence({
      title: 'Test Evidence',
      sourceKind: 'literature',
      source: 'https://example.com',
      abstract: 'Test snippet',
      authors: ['Test Author'],
    });
    toggleEvidenceSelection(id);
    expect(useWorkbenchStore.getState().selectedEvidenceIds).toContain(id);
    toggleEvidenceSelection(id);
    expect(useWorkbenchStore.getState().selectedEvidenceIds).not.toContain(id);
  });

  it('visitTool sets currentToolId and currentStageId', () => {
    const { ensureProject, visitTool } = useWorkbenchStore.getState();
    ensureProject();
    visitTool('pathd');
    const { currentToolId, currentStageId } = useWorkbenchStore.getState();
    expect(currentToolId).toBe('pathd');
    expect(currentStageId).toBeDefined();
  });

  it('setToolPayload creates a run artifact', () => {
    const { ensureProject, setToolPayload } = useWorkbenchStore.getState();
    ensureProject();
    setToolPayload('pathd', {
      activeRouteLabel: 'Test Route',
      nodeCount: 5,
      result: { bottleneckCount: 1 },
    } as never);
    const { runArtifacts, toolRuns } = useWorkbenchStore.getState();
    // setToolPayload creates run artifacts and tool runs
    expect(runArtifacts.length).toBeGreaterThan(0);
    expect(toolRuns.length).toBeGreaterThan(0);
    expect(toolRuns[0].toolId).toBe('pathd');
  });

  it('resetWorkbench clears all state', () => {
    const { ensureProject, upsertEvidence, resetWorkbench } = useWorkbenchStore.getState();
    ensureProject();
    upsertEvidence({
      title: 'Test',
      sourceKind: 'literature',
      source: 'https://example.com',
      abstract: 'Test',
      authors: ['Test Author'],
    });
    resetWorkbench();
    const state = useWorkbenchStore.getState();
    expect(state.project).toBeNull();
    expect(state.evidenceItems).toEqual([]);
    expect(state.toolRuns).toEqual([]);
  });
});
