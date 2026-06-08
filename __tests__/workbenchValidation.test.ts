/**
 * Tests for src/store/workbenchValidation.ts
 *
 * Covers all exported sanitize* functions: sanitizeWorkbenchState,
 * sanitizeWorkbenchBackendMeta, sanitizeWorkbenchCollaborators,
 * sanitizeWorkbenchExperimentRecords, sanitizeWorkbenchAuditLog,
 * sanitizeWorkbenchHistory.
 */

import {
  sanitizeWorkbenchState,
  sanitizeWorkbenchBackendMeta,
  sanitizeWorkbenchCollaborators,
  sanitizeWorkbenchExperimentRecords,
  sanitizeWorkbenchAuditLog,
  sanitizeWorkbenchHistory,
} from '../src/store/workbenchValidation';

// ────────────────────────────────────────────────────────
// sanitizeWorkbenchState
// ────────────────────────────────────────────────────────
describe('sanitizeWorkbenchState', () => {
  it('returns null for non-object input', () => {
    expect(sanitizeWorkbenchState(null)).toBeNull();
    expect(sanitizeWorkbenchState(undefined)).toBeNull();
    expect(sanitizeWorkbenchState('string')).toBeNull();
    expect(sanitizeWorkbenchState(42)).toBeNull();
    expect(sanitizeWorkbenchState([])).toBeNull();
  });

  it('returns a valid state with defaults from a minimal object', () => {
    const result = sanitizeWorkbenchState({});
    expect(result).not.toBeNull();
    expect(result!.schemaVersion).toBe(1);
    expect(result!.revision).toBe(0);
    expect(result!.lastMutationAt).toBe(0);
    expect(result!.activeArtifactId).toBeNull();
    expect(result!.project).toBeNull();
    expect(result!.evidenceItems).toEqual([]);
    expect(result!.selectedEvidenceIds).toEqual([]);
    expect(result!.draftAnalyzeInput).toBe('');
    expect(result!.workflowArtifact).toBeNull();
    expect(result!.analyzeArtifact).toBeNull();
    expect(result!.toolRuns).toEqual([]);
    expect(result!.toolPayloads).toEqual({});
    expect(result!.runArtifacts).toEqual([]);
    expect(result!.checkpoints).toEqual([]);
    expect(result!.nextRecommendations).toEqual([]);
    expect(result!.workflowControl).toBeDefined();
    expect(result!.workflowControl.machineState).toBe('idle');
  });

  it('preserves valid activeArtifactId', () => {
    const result = sanitizeWorkbenchState({ activeArtifactId: 'artifact-1' });
    expect(result!.activeArtifactId).toBe('artifact-1');
  });

  it('converts non-string activeArtifactId to null', () => {
    expect(sanitizeWorkbenchState({ activeArtifactId: 123 })!.activeArtifactId).toBeNull();
    expect(sanitizeWorkbenchState({ activeArtifactId: null })!.activeArtifactId).toBeNull();
  });

  it('sanitizes revision and lastMutationAt with Math.max(0, ...)', () => {
    const result = sanitizeWorkbenchState({ revision: -5, lastMutationAt: -10 });
    expect(result!.revision).toBe(0);
    expect(result!.lastMutationAt).toBe(0);
  });

  it('sanitizes project via sanitizeProject', () => {
    const result = sanitizeWorkbenchState({
      project: { id: 'p1', title: 'Test', summary: 'Sum', targetProduct: 'TP' },
    });
    expect(result!.project).not.toBeNull();
    expect(result!.project!.id).toBe('p1');
    expect(result!.project!.title).toBe('Test');
    expect(result!.project!.status).toBe('draft');
  });

  it('project defaults for missing fields', () => {
    const result = sanitizeWorkbenchState({ project: {} });
    expect(result!.project!.title).toBe('Synthetic Biology Program');
    expect(result!.project!.targetProduct).toBe('Target Product');
    expect(result!.project!.status).toBe('draft');
    expect(result!.project!.isDemo).toBe(false);
  });

  it('project accepts valid status values', () => {
    const active = sanitizeWorkbenchState({ project: { status: 'active' } });
    expect(active!.project!.status).toBe('active');
    const iterating = sanitizeWorkbenchState({ project: { status: 'iterating' } });
    expect(iterating!.project!.status).toBe('iterating');
    const invalid = sanitizeWorkbenchState({ project: { status: 'bad' } });
    expect(invalid!.project!.status).toBe('draft');
  });

  it('filters invalid evidence items', () => {
    const result = sanitizeWorkbenchState({
      evidenceItems: [
        { id: 'e1', title: 'Paper', abstract: 'Abs', authors: ['A'], savedAt: 100 },
        { notId: 'x' }, // missing id -> filtered
        null,
      ],
    });
    expect(result!.evidenceItems).toHaveLength(1);
    expect(result!.evidenceItems[0].id).toBe('e1');
  });

  it('sanitizes evidence item sourceKind with valid values', () => {
    const result = sanitizeWorkbenchState({
      evidenceItems: [
        { id: 'e1', sourceKind: 'analysis', savedAt: 100 },
        { id: 'e2', sourceKind: 'tool', savedAt: 100 },
        { id: 'e3', sourceKind: 'system', savedAt: 100 },
        { id: 'e4', sourceKind: 'invalid', savedAt: 100 },
      ],
    });
    expect(result!.evidenceItems[0].sourceKind).toBe('analysis');
    expect(result!.evidenceItems[1].sourceKind).toBe('tool');
    expect(result!.evidenceItems[2].sourceKind).toBe('system');
    expect(result!.evidenceItems[3].sourceKind).toBe('literature'); // fallback
  });

  it('filters tool runs without required fields', () => {
    const result = sanitizeWorkbenchState({
      toolRuns: [
        { id: 'tr1', toolId: 'pathd', title: 'T', summary: 'S', isSimulated: false, createdAt: 100 },
        { id: 'tr2' }, // missing toolId
        { toolId: 'fbasim' }, // missing id
      ],
    });
    expect(result!.toolRuns).toHaveLength(1);
  });

  it('sanitizes checkpoints with valid status', () => {
    const result = sanitizeWorkbenchState({
      checkpoints: [
        { id: 'stage-1', status: 'active', summary: 'S', updatedAt: 100 },
        { id: 'stage-2', status: 'complete', summary: 'S', updatedAt: 100 },
        { id: 'stage-3', status: 'bad', summary: 'S', updatedAt: 100 },
        { noId: true },
      ],
    });
    expect(result!.checkpoints).toHaveLength(3);
    expect(result!.checkpoints[0].status).toBe('active');
    expect(result!.checkpoints[1].status).toBe('complete');
    expect(result!.checkpoints[2].status).toBe('pending'); // fallback
  });

  it('sanitizes nextRecommendations', () => {
    const result = sanitizeWorkbenchState({
      nextRecommendations: [
        { id: 'r1', toolId: 'pathd', source: 'analysis', reason: 'R' },
        { id: 'r2', toolId: 'fbasim', source: 'bad', reason: 'R' },
        { id: 'no-tool' }, // missing toolId
      ],
    });
    expect(result!.nextRecommendations).toHaveLength(2);
    expect(result!.nextRecommendations[0].source).toBe('analysis');
    expect(result!.nextRecommendations[1].source).toBe('flow'); // fallback
  });

  it('sanitizes workflowControl with defaults for non-object', () => {
    const result = sanitizeWorkbenchState({ workflowControl: null });
    expect(result!.workflowControl.machineState).toBe('idle');
    expect(result!.workflowControl.status).toBe('idle');
    expect(result!.workflowControl.currentToolId).toBeNull();
    expect(result!.workflowControl.nextRecommendedNode).toBe('pathd');
    expect(result!.workflowControl.reasonCodes).toEqual(['NO_TARGET']);
    expect(result!.workflowControl.iteration).toBe(0);
  });

  it('sanitizes workflowControl with valid object', () => {
    const result = sanitizeWorkbenchState({
      workflowControl: {
        machineState: 'pathdReady',
        status: 'ready',
        currentToolId: 'pathd',
        nextRecommendedNode: 'fbasim',
        missingEvidence: { minRequired: 2, have: 1, kinds: ['literature'] },
        confidence: 0.8,
        uncertainty: 0.1,
        validity: 'real',
        humanGateRequired: true,
        nextNodeIsContractOnly: false,
        isDemoOnly: false,
        latestRunStatus: 'ok',
        latestRunToolId: 'pathd',
        reasonCodes: ['TARGET_SET'],
        explanation: 'Ready to go',
        iteration: 3,
        updatedAt: 1000,
      },
    });
    expect(result!.workflowControl.machineState).toBe('pathdReady');
    expect(result!.workflowControl.status).toBe('ready');
    expect(result!.workflowControl.confidence).toBe(0.8);
    expect(result!.workflowControl.validity).toBe('real');
    expect(result!.workflowControl.iteration).toBe(3);
  });

  it('workflowControl falls back to idle for invalid machineState', () => {
    const result = sanitizeWorkbenchState({
      workflowControl: { machineState: 'invalid', status: 'idle' },
    });
    expect(result!.workflowControl.machineState).toBe('idle');
  });

  it('workflowControl sets isDemoOnly to true when status is demoOnly', () => {
    const result = sanitizeWorkbenchState({
      workflowControl: { status: 'demoOnly', isDemoOnly: false },
    });
    expect(result!.workflowControl.isDemoOnly).toBe(true);
  });

  it('sanitizes toolPayloads filtering invalid entries', () => {
    const result = sanitizeWorkbenchState({
      toolPayloads: {
        pathd: { toolId: 'pathd', updatedAt: 1000, validity: 'real' },
        badTool: { toolId: 'bad', updatedAt: 1000, validity: 'real' },
        fbasim: { toolId: 'fbasim', updatedAt: 1000, validity: 'bad' },
      },
    });
    expect(Object.keys(result!.toolPayloads)).toEqual(['pathd']);
  });

  it('sanitizes runArtifacts', () => {
    const result = sanitizeWorkbenchState({
      runArtifacts: [
        { id: 'r1', toolId: 'pathd', payloadSnapshot: {}, summary: 'S', createdAt: 100, isSimulated: false },
        { id: 'r2' }, // missing toolId and payloadSnapshot
      ],
    });
    expect(result!.runArtifacts).toHaveLength(1);
  });

  it('sanitizes gateway decision map', () => {
    const result = sanitizeWorkbenchState({
      payloadAdmissionDecisionsByToolId: {
        pathd: {
          status: 'ok',
          reason: 'Allowed',
          allowedSurfaces: ['payload'],
          blockedSurfaces: [],
        },
        bad: 'not an object',
      },
    });
    expect(result!.payloadAdmissionDecisionsByToolId.pathd).toBeDefined();
    expect(result!.payloadAdmissionDecisionsByToolId.pathd.status).toBe('ok');
    expect(result!.payloadAdmissionDecisionsByToolId.bad).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────
// sanitizeWorkbenchBackendMeta
// ────────────────────────────────────────────────────────
describe('sanitizeWorkbenchBackendMeta', () => {
  it('returns null for non-object input', () => {
    expect(sanitizeWorkbenchBackendMeta(null)).toBeNull();
    expect(sanitizeWorkbenchBackendMeta(undefined)).toBeNull();
    expect(sanitizeWorkbenchBackendMeta('str')).toBeNull();
  });

  it('returns null if kind is not sqlite', () => {
    expect(sanitizeWorkbenchBackendMeta({ kind: 'postgres', path: '/db' })).toBeNull();
  });

  it('returns null if path is missing', () => {
    expect(sanitizeWorkbenchBackendMeta({ kind: 'sqlite' })).toBeNull();
  });

  it('returns valid meta for correct input', () => {
    const result = sanitizeWorkbenchBackendMeta({
      kind: 'sqlite',
      path: '/data/db.sqlite',
      driver: 'better-sqlite3',
      scope: 'project',
      projectId: 'p1',
      actorId: 'actor1',
      revision: 5,
      updatedAt: 1000,
      runArtifactCount: 3,
      auditCount: 10,
      historyCount: 2,
      experimentCount: 1,
      memberCount: 4,
      projectCount: 1,
    });
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('sqlite');
    expect(result!.driver).toBe('better-sqlite3');
    expect(result!.scope).toBe('project');
    expect(result!.path).toBe('/data/db.sqlite');
    expect(result!.projectId).toBe('p1');
    expect(result!.actorId).toBe('actor1');
    expect(result!.revision).toBe(5);
  });

  it('uses defaults for missing optional fields', () => {
    const result = sanitizeWorkbenchBackendMeta({ kind: 'sqlite', path: '/db' });
    expect(result!.driver).toBe('better-sqlite3');
    expect(result!.scope).toBe('project');
    expect(result!.projectId).toBe('default-workbench');
    expect(result!.actorId).toBe('system');
    expect(result!.revision).toBe(0);
  });

  it('clamps negative numbers to 0', () => {
    const result = sanitizeWorkbenchBackendMeta({
      kind: 'sqlite',
      path: '/db',
      revision: -1,
      updatedAt: -100,
      runArtifactCount: -5,
    });
    expect(result!.revision).toBe(0);
    expect(result!.updatedAt).toBe(0);
    expect(result!.runArtifactCount).toBe(0);
  });
});

// ────────────────────────────────────────────────────────
// sanitizeWorkbenchCollaborators
// ────────────────────────────────────────────────────────
describe('sanitizeWorkbenchCollaborators', () => {
  it('returns empty array for non-array input', () => {
    expect(sanitizeWorkbenchCollaborators(null)).toEqual([]);
    expect(sanitizeWorkbenchCollaborators(undefined)).toEqual([]);
    expect(sanitizeWorkbenchCollaborators('str')).toEqual([]);
    expect(sanitizeWorkbenchCollaborators({})).toEqual([]);
  });

  it('filters collaborators without actorId', () => {
    const result = sanitizeWorkbenchCollaborators([
      { actorId: 'a1', displayName: 'Alice', role: 'researcher', lastSeenAt: 100 },
      { displayName: 'NoId', role: 'researcher' },
      { actorId: '', displayName: 'EmptyId' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].actorId).toBe('a1');
  });

  it('uses defaults for missing fields', () => {
    const result = sanitizeWorkbenchCollaborators([{ actorId: 'a1' }]);
    expect(result[0].displayName).toBe('a1');
    expect(result[0].role).toBe('researcher');
    expect(result[0].lastSeenAt).toBe(0);
  });
});

// ────────────────────────────────────────────────────────
// sanitizeWorkbenchExperimentRecords
// ────────────────────────────────────────────────────────
describe('sanitizeWorkbenchExperimentRecords', () => {
  it('returns empty array for non-array input', () => {
    expect(sanitizeWorkbenchExperimentRecords(null)).toEqual([]);
    expect(sanitizeWorkbenchExperimentRecords(42)).toEqual([]);
  });

  it('filters records missing required fields', () => {
    const result = sanitizeWorkbenchExperimentRecords([
      { recordId: 'r1', projectId: 'p1', actorId: 'a1', toolId: 'pathd', title: 'T', summary: 'S', status: 'ok' },
      { recordId: 'r2' }, // missing projectId and actorId
      { projectId: 'p1', actorId: 'a1' }, // missing recordId
    ]);
    expect(result).toHaveLength(1);
  });

  it('sanitizes category and authorityTier', () => {
    const result = sanitizeWorkbenchExperimentRecords([
      { recordId: 'r1', projectId: 'p1', actorId: 'a1', category: 'experiment', authorityTier: 'experiment-backed' },
      { recordId: 'r2', projectId: 'p1', actorId: 'a1', category: 'bad', authorityTier: 'bad' },
    ]);
    expect(result[0].category).toBe('experiment');
    expect(result[0].authorityTier).toBe('experiment-backed');
    expect(result[1].category).toBe('analysis');
    expect(result[1].authorityTier).toBe('simulated');
  });

  it('handles valid stageId values', () => {
    const result = sanitizeWorkbenchExperimentRecords([
      { recordId: 'r1', projectId: 'p1', actorId: 'a1', stageId: 'stage-1' },
    ]);
    expect(result[0].stageId).toBe('stage-1');
  });

  it('sets stageId to null for non-string', () => {
    const result = sanitizeWorkbenchExperimentRecords([
      { recordId: 'r1', projectId: 'p1', actorId: 'a1', stageId: 123 },
    ]);
    expect(result[0].stageId).toBeNull();
  });
});

// ────────────────────────────────────────────────────────
// sanitizeWorkbenchAuditLog
// ────────────────────────────────────────────────────────
describe('sanitizeWorkbenchAuditLog', () => {
  it('returns empty array for non-array input', () => {
    expect(sanitizeWorkbenchAuditLog(null)).toEqual([]);
    expect(sanitizeWorkbenchAuditLog({})).toEqual([]);
  });

  it('filters non-record entries', () => {
    const result = sanitizeWorkbenchAuditLog([null, 42, 'str', { id: 1, action: 'save', status: 'ok' }]);
    expect(result).toHaveLength(1);
  });

  it('sanitizes audit entry fields', () => {
    const result = sanitizeWorkbenchAuditLog([
      { id: 5, projectId: 'p1', actorId: 'a1', revision: 3, action: 'sync', status: 'ok', detail: 'some detail', createdAt: 100 },
    ]);
    expect(result[0].id).toBe(5);
    expect(result[0].projectId).toBe('p1');
    expect(result[0].actorId).toBe('a1');
    expect(result[0].revision).toBe(3);
    expect(result[0].detail).toBe('some detail');
  });

  it('handles null optional fields', () => {
    const result = sanitizeWorkbenchAuditLog([
      { id: 1, action: 'sync', status: 'ok' },
    ]);
    expect(result[0].projectId).toBeNull();
    expect(result[0].actorId).toBeNull();
    expect(result[0].detail).toBeNull();
  });
});

// ────────────────────────────────────────────────────────
// sanitizeWorkbenchHistory
// ────────────────────────────────────────────────────────
describe('sanitizeWorkbenchHistory', () => {
  it('returns empty array for non-array input', () => {
    expect(sanitizeWorkbenchHistory(null)).toEqual([]);
    expect(sanitizeWorkbenchHistory(42)).toEqual([]);
  });

  it('filters non-record entries', () => {
    const result = sanitizeWorkbenchHistory([null, 'str', 42, { revision: 1 }]);
    expect(result).toHaveLength(1);
  });

  it('sanitizes history entry with defaults', () => {
    const result = sanitizeWorkbenchHistory([
      { revision: 5, projectId: 'p1', actorId: 'a1', projectTitle: 'PT', targetProduct: 'TP' },
    ]);
    expect(result[0].revision).toBe(5);
    expect(result[0].projectTitle).toBe('PT');
    expect(result[0].targetProduct).toBe('TP');
    expect(result[0].analyzeTitle).toBeNull();
    expect(result[0].analyzeGeneratedAt).toBeNull();
    expect(result[0].runArtifactCount).toBe(0);
  });

  it('handles analyzeGeneratedAt as number only', () => {
    const result = sanitizeWorkbenchHistory([
      { revision: 1, analyzeGeneratedAt: 1000 },
    ]);
    expect(result[0].analyzeGeneratedAt).toBe(1000);

    const result2 = sanitizeWorkbenchHistory([
      { revision: 1, analyzeGeneratedAt: 'not-a-number' },
    ]);
    expect(result2[0].analyzeGeneratedAt).toBeNull();
  });

  it('clamps negative numbers', () => {
    const result = sanitizeWorkbenchHistory([
      { revision: -1, runArtifactCount: -5, mutationAt: -10, updatedAt: -20 },
    ]);
    expect(result[0].revision).toBe(0);
    expect(result[0].runArtifactCount).toBe(0);
    expect(result[0].mutationAt).toBe(0);
    expect(result[0].updatedAt).toBe(0);
  });
});

// ────────────────────────────────────────────────────────
// Workflow artifact sanitization (internal to sanitizeWorkbenchState)
// ────────────────────────────────────────────────────────
describe('sanitizeWorkbenchState — workflowArtifact', () => {
  it('returns null workflowArtifact when missing', () => {
    const result = sanitizeWorkbenchState({});
    expect(result!.workflowArtifact).toBeNull();
  });

  it('returns null workflowArtifact for non-record', () => {
    const result = sanitizeWorkbenchState({ workflowArtifact: 'bad' });
    expect(result!.workflowArtifact).toBeNull();
  });

  it('returns null workflowArtifact when id is missing', () => {
    const result = sanitizeWorkbenchState({ workflowArtifact: { status: 'draft' } });
    expect(result!.workflowArtifact).toBeNull();
  });

  it('sanitizes a minimal workflowArtifact', () => {
    const result = sanitizeWorkbenchState({
      workflowArtifact: {
        id: 'wf-1',
        status: 'compiled',
        sourcePage: 'analyze',
        intake: { rawAnalyzeInput: 'test' },
        evidencePackets: [],
        atomicPathwayGraph: null,
        candidateRoutes: [],
        provenance: { compiledFrom: 'manual-text', evidencePacketIds: [] },
        workbench: { scientificStage: 'design' },
        createdAt: 1000,
        updatedAt: 2000,
      },
    });
    expect(result!.workflowArtifact).not.toBeNull();
    expect(result!.workflowArtifact!.id).toBe('wf-1');
    expect(result!.workflowArtifact!.status).toBe('compiled');
    expect(result!.workflowArtifact!.sourcePage).toBe('analyze');
  });

  it('falls back status to draft for invalid values', () => {
    const result = sanitizeWorkbenchState({
      workflowArtifact: { id: 'wf-1', status: 'bad' },
    });
    expect(result!.workflowArtifact!.status).toBe('draft');
  });

  it('falls back sourcePage to analyze for invalid values', () => {
    const result = sanitizeWorkbenchState({
      workflowArtifact: { id: 'wf-1', sourcePage: 'bad' },
    });
    expect(result!.workflowArtifact!.sourcePage).toBe('analyze');
  });

  it('sanitizes workflow artifact nodes with valid roles', () => {
    const result = sanitizeWorkbenchState({
      workflowArtifact: {
        id: 'wf-1',
        atomicPathwayGraph: {
          nodes: [
            { id: 'n1', role: 'metabolite', label: 'M' },
            { id: 'n2', role: 'enzyme', label: 'E' },
            { id: 'n3', role: 'bad', label: 'X' }, // filtered
          ],
          edges: [],
        },
      },
    });
    expect(result!.workflowArtifact!.atomicPathwayGraph!.nodes).toHaveLength(2);
  });

  it('sanitizes workflow artifact edges with valid roles and key', () => {
    const result = sanitizeWorkbenchState({
      workflowArtifact: {
        id: 'wf-1',
        atomicPathwayGraph: {
          nodes: [],
          edges: [
            { start: 'a', end: 'b', key: 'k1', role: 'evidence-backed-transition' },
            { start: 'a', end: 'b', key: 'k2', role: 'catalysis' },
            { start: 'a', end: 'b', key: '', role: 'catalysis' }, // empty key -> filtered
            { start: 'a', end: 'b', key: 'k3', role: 'bad' }, // bad role -> filtered
            { start: 'a', key: 'k4', role: 'catalysis' }, // missing end -> filtered
          ],
        },
      },
    });
    expect(result!.workflowArtifact!.atomicPathwayGraph!.edges).toHaveLength(2);
  });

  it('sanitizes provenance compiledFrom', () => {
    const result = sanitizeWorkbenchState({
      workflowArtifact: {
        id: 'wf-1',
        provenance: { compiledFrom: 'pdf' },
      },
    });
    expect(result!.workflowArtifact!.provenance.compiledFrom).toBe('pdf');

    const result2 = sanitizeWorkbenchState({
      workflowArtifact: {
        id: 'wf-1',
        provenance: { compiledFrom: 'invalid' },
      },
    });
    expect(result2!.workflowArtifact!.provenance.compiledFrom).toBe('manual-text');
  });

  it('sanitizes scientificStage', () => {
    const result = sanitizeWorkbenchState({
      workflowArtifact: {
        id: 'wf-1',
        workbench: { scientificStage: 'simulate-optimize' },
      },
    });
    expect(result!.workflowArtifact!.workbench.scientificStage).toBe('simulate-optimize');

    const result2 = sanitizeWorkbenchState({
      workflowArtifact: {
        id: 'wf-1',
        workbench: { scientificStage: 'bad' },
      },
    });
    expect(result2!.workflowArtifact!.workbench.scientificStage).toBe('design');
  });
});

// ────────────────────────────────────────────────────────
// sanitizeWorkbenchState — analyzeArtifact
// ────────────────────────────────────────────────────────
describe('sanitizeWorkbenchState — analyzeArtifact', () => {
  it('returns null analyzeArtifact when missing', () => {
    const result = sanitizeWorkbenchState({});
    expect(result!.analyzeArtifact).toBeNull();
  });

  it('returns null when id is missing', () => {
    const result = sanitizeWorkbenchState({ analyzeArtifact: { title: 'T' } });
    expect(result!.analyzeArtifact).toBeNull();
  });

  it('sanitizes a minimal analyzeArtifact', () => {
    const result = sanitizeWorkbenchState({
      analyzeArtifact: { id: 'aa-1' },
    });
    expect(result!.analyzeArtifact!.id).toBe('aa-1');
    expect(result!.analyzeArtifact!.title).toBe('');
    expect(result!.analyzeArtifact!.targetProduct).toBe('Target Product');
    expect(result!.analyzeArtifact!.nodes).toEqual([]);
    expect(result!.analyzeArtifact!.edges).toEqual([]);
    expect(result!.analyzeArtifact!.pathwayCandidates).toEqual([]);
    expect(result!.analyzeArtifact!.bottleneckAssumptions).toEqual([]);
    expect(result!.analyzeArtifact!.enzymeCandidates).toEqual([]);
    expect(result!.analyzeArtifact!.thermodynamicConcerns).toEqual([]);
    expect(result!.analyzeArtifact!.recommendedNextTools).toEqual([]);
    expect(result!.analyzeArtifact!.evidenceTraceIds).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────
// sanitizeWorkbenchState — runArtifact edge cases
// ────────────────────────────────────────────────────────
describe('sanitizeWorkbenchState — runArtifact edge cases', () => {
  it('sanitizes runArtifact with execution record', () => {
    const result = sanitizeWorkbenchState({
      runArtifacts: [{
        id: 'r1',
        toolId: 'pathd',
        payloadSnapshot: { targetProduct: 'TP', updatedAt: 100 },
        execution: {
          projectRef: 'p1',
          analyzeRef: 'a1',
          upstreamToolIds: ['fbasim'],
          upstreamArtifactIds: [],
          dependencySignature: 'sig',
        },
        summary: 'S',
        createdAt: 100,
        isSimulated: false,
      }],
    });
    expect(result!.runArtifacts[0].execution.projectRef).toBe('p1');
    expect(result!.runArtifacts[0].execution.analyzeRef).toBe('a1');
  });

  it('sanitizes runArtifact without execution record', () => {
    const result = sanitizeWorkbenchState({
      runArtifacts: [{
        id: 'r1',
        toolId: 'pathd',
        payloadSnapshot: {},
        upstreamArtifactIds: ['ua1'],
        summary: 'S',
        createdAt: 100,
        isSimulated: false,
      }],
    });
    expect(result!.runArtifacts[0].execution.projectRef).toBeNull();
    expect(result!.runArtifacts[0].execution.analyzeRef).toBeNull();
    expect(result!.runArtifacts[0].execution.upstreamArtifactIds).toEqual(['ua1']);
  });

  it('sanitizes runArtifact status field', () => {
    const result = sanitizeWorkbenchState({
      runArtifacts: [
        { id: 'r1', toolId: 'pathd', payloadSnapshot: {}, status: 'ok' },
        { id: 'r2', toolId: 'fbasim', payloadSnapshot: {}, status: 'blocked' },
        { id: 'r3', toolId: 'cethx', payloadSnapshot: {}, status: 'bad' },
      ],
    });
    expect(result!.runArtifacts[0].status).toBe('ok');
    expect(result!.runArtifacts[1].status).toBe('blocked');
    expect(result!.runArtifacts[2].status).toBeUndefined();
  });

  it('sanitizes optional runArtifact fields', () => {
    const result = sanitizeWorkbenchState({
      runArtifacts: [{
        id: 'r1',
        toolId: 'pathd',
        payloadSnapshot: {},
        confidence: 0.8,
        uncertainty: 0.1,
        validity: 'real',
        humanGateRequired: true,
        iteration: 3,
        statusReason: 'blocked',
        blockingUpstreamToolIds: ['fbasim'],
        evidenceSnapshot: {
          count: 2,
          selectedCount: 1,
          evidenceItemIds: ['e1', 'e2'],
          selectedEvidenceIds: ['e1'],
          status: 'satisfied',
          missingEvidence: { minRequired: 1, have: 2, kinds: ['literature'], missingKinds: [] },
        },
      }],
    });
    const run = result!.runArtifacts[0];
    expect(run.confidence).toBe(0.8);
    expect(run.uncertainty).toBe(0.1);
    expect(run.validity).toBe('real');
    expect(run.humanGateRequired).toBe(true);
    expect(run.iteration).toBe(3);
    expect(run.statusReason).toBe('blocked');
    expect(run.blockingUpstreamToolIds).toEqual(['fbasim']);
    expect(run.evidenceSnapshot).toBeDefined();
    expect(run.evidenceSnapshot!.count).toBe(2);
  });

  it('omits optional fields when not present', () => {
    const result = sanitizeWorkbenchState({
      runArtifacts: [{
        id: 'r1',
        toolId: 'pathd',
        payloadSnapshot: {},
      }],
    });
    const run = result!.runArtifacts[0];
    expect(run.confidence).toBeUndefined();
    expect(run.validity).toBeUndefined();
    expect(run.humanGateRequired).toBeUndefined();
    expect(run.evidenceSnapshot).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────
// sanitizeWorkbenchState — workflowControl edge cases
// ────────────────────────────────────────────────────────
describe('sanitizeWorkbenchState — workflowControl edge cases', () => {
  it('validates all machineState values', () => {
    const validStates = ['idle', 'targetSet', 'pathdReady', 'fbasimReady', 'catdesReady', 'dynconReady', 'cellfreeReady', 'dbtlCommitted'];
    for (const ms of validStates) {
      const result = sanitizeWorkbenchState({ workflowControl: { machineState: ms } });
      expect(result!.workflowControl.machineState).toBe(ms);
    }
  });

  it('validates all status values', () => {
    const validStatuses = ['idle', 'ready', 'blocked', 'gated', 'demoOnly', 'complete'];
    for (const s of validStatuses) {
      const result = sanitizeWorkbenchState({ workflowControl: { status: s } });
      expect(result!.workflowControl.status).toBe(s);
    }
  });

  it('validates latestRunStatus values', () => {
    const validRunStatuses = ['ok', 'simulated', 'blocked', 'gated', 'demoOnly'];
    for (const rs of validRunStatuses) {
      const result = sanitizeWorkbenchState({ workflowControl: { latestRunStatus: rs } });
      expect(result!.workflowControl.latestRunStatus).toBe(rs);
    }
  });

  it('nulls invalid latestRunStatus', () => {
    const result = sanitizeWorkbenchState({ workflowControl: { latestRunStatus: 'bad' } });
    expect(result!.workflowControl.latestRunStatus).toBeNull();
  });

  it('validates validity field', () => {
    for (const v of ['real', 'partial', 'demo']) {
      const result = sanitizeWorkbenchState({ workflowControl: { validity: v } });
      expect(result!.workflowControl.validity).toBe(v);
    }
    const bad = sanitizeWorkbenchState({ workflowControl: { validity: 'bad' } });
    expect(bad!.workflowControl.validity).toBeNull();
  });
});
