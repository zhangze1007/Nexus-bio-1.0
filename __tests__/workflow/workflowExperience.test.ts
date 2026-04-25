/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import {
  buildWorkflowDashboardItems,
  buildWorkflowHandoffSummary,
} from '../../src/components/workbench/workflowExperience';
import type {
  WorkbenchRunArtifact,
  WorkbenchWorkflowControlSnapshot,
} from '../../src/store/workbenchTypes';

const BASE_WORKFLOW: WorkbenchWorkflowControlSnapshot = {
  machineState: 'targetSet',
  status: 'ready',
  currentToolId: 'pathd',
  nextRecommendedNode: 'pathd',
  missingEvidence: { minRequired: 0, have: 0, kinds: [] },
  confidence: null,
  uncertainty: null,
  validity: null,
  humanGateRequired: false,
  nextNodeIsContractOnly: false,
  isDemoOnly: false,
  latestRunStatus: null,
  latestRunToolId: null,
  reasonCodes: ['CURRENT_TOOL_NOT_READY'],
  explanation: 'Run PATHD for the active target.',
  iteration: 0,
  updatedAt: 1,
};

function run(toolId: WorkbenchRunArtifact['toolId'], status: WorkbenchRunArtifact['status']): WorkbenchRunArtifact {
  return {
    id: `run-${toolId}`,
    toolId,
    stageId: 'stage-1',
    targetProduct: 'limonene',
    upstreamArtifactIds: [],
    execution: {
      projectRef: 'project-1',
      analyzeRef: 'artifact-1',
      upstreamToolIds: [],
      upstreamArtifactIds: [],
      dependencySignature: `${toolId}:${status}`,
    },
    summary: `${toolId.toUpperCase()} test run`,
    payloadSnapshot: {
      toolId,
      validity: status === 'demoOnly' ? 'demo' : 'partial',
      updatedAt: 1,
    } as WorkbenchRunArtifact['payloadSnapshot'],
    createdAt: 1,
    isSimulated: status === 'demoOnly',
    status,
  };
}

describe('workflowExperience — PATHD to FBASim handoff', () => {
  it('shows FBASim blocked until PATHD publishes result.pathwayCandidates', () => {
    const handoff = buildWorkflowHandoffSummary('fbasim', BASE_WORKFLOW, []);
    expect(handoff?.availability).toBe('blocked');
    expect(handoff?.upstreamRows[0]).toMatchObject({
      toolId: 'pathd',
      artifactPath: 'result.pathwayCandidates',
      present: false,
      status: 'missing',
    });
  });

  it('shows PATHD handoff available for FBASim when PATHD run is ok', () => {
    const handoff = buildWorkflowHandoffSummary(
      'pathd',
      { ...BASE_WORKFLOW, machineState: 'pathdReady', currentToolId: 'fbasim', nextRecommendedNode: 'fbasim' },
      [run('pathd', 'ok')],
    );
    expect(handoff?.nextToolId).toBe('fbasim');
    expect(handoff?.nextArtifactPath).toBe('result.pathwayCandidates');
    expect(handoff?.nextArtifactPresent).toBe(true);
    expect(handoff?.availability).toBe('available');
  });

  it('uses workflowControl.nextRecommendedNode for UI-facing handoff even when the contract successor differs', () => {
    const handoff = buildWorkflowHandoffSummary(
      'pathd',
      { ...BASE_WORKFLOW, machineState: 'pathdReady', currentToolId: 'catdes', nextRecommendedNode: 'catdes' },
      [run('pathd', 'ok')],
    );
    expect(handoff?.nextToolId).toBe('catdes');
    expect(handoff?.nextToolName).toBe('Catalyst Designer');
  });

  it('keeps demo PATHD output machine-visible as DemoOnly', () => {
    const handoff = buildWorkflowHandoffSummary('pathd', BASE_WORKFLOW, [run('pathd', 'demoOnly')]);
    expect(handoff?.availability).toBe('demoOnly');
    expect(handoff?.nextArtifactPresent).toBe(false);
  });

  it('renders the golden path plus NEXAI supervisor node', () => {
    const items = buildWorkflowDashboardItems(
      { ...BASE_WORKFLOW, machineState: 'pathdReady', currentToolId: 'fbasim', nextRecommendedNode: 'fbasim' },
      [run('pathd', 'ok')],
    );
    expect(items.map((item) => item.id)).toEqual([
      'target',
      'pathd',
      'fbasim',
      'catdes',
      'dyncon',
      'cellfree',
      'dbtlflow',
      'nexai',
    ]);
    expect(items.find((item) => item.id === 'pathd')?.status).toBe('complete');
    expect(items.find((item) => item.id === 'fbasim')?.status).toBe('current');
  });

  it('marks only workflowControl.nextRecommendedNode as the dashboard next item', () => {
    const items = buildWorkflowDashboardItems(
      { ...BASE_WORKFLOW, machineState: 'pathdReady', currentToolId: 'fbasim', nextRecommendedNode: 'catdes' },
      [run('pathd', 'ok'), run('fbasim', 'ok')],
    );
    expect(items.filter((item) => item.status === 'next').map((item) => item.id)).toEqual(['catdes']);

    const terminalItems = buildWorkflowDashboardItems(
      { ...BASE_WORKFLOW, machineState: 'dbtlCommitted', status: 'complete', currentToolId: 'dbtlflow', nextRecommendedNode: null },
      [],
    );
    expect(terminalItems.filter((item) => item.status === 'next')).toEqual([]);
  });

  it('keeps visible next-step surfaces sourced from workflowControl rather than local successor helpers', () => {
    const root = path.resolve(__dirname, '../..');
    const inlineContext = fs.readFileSync(path.join(root, 'src/components/workbench/WorkbenchInlineContext.tsx'), 'utf8');
    const statusBar = fs.readFileSync(path.join(root, 'src/components/workbench/WorkbenchStatusBar.tsx'), 'utf8');
    const workflowExperience = fs.readFileSync(path.join(root, 'src/components/workbench/workflowExperience.ts'), 'utf8');

    expect(inlineContext).not.toMatch(/getNextToolIds\(/);
    expect(statusBar).not.toMatch(/getNextToolIds\(/);
    expect(workflowExperience).not.toMatch(/getGoldenPathSuccessor\(/);
    expect(inlineContext).not.toMatch(/addToolRun/);
  });
});
