import type {
  WorkbenchAnalyzeArtifact,
  WorkbenchProjectBrief,
  WorkbenchRunArtifact,
} from '../../store/workbenchTypes';
import { buildExecutionSnapshot, diffExecutionSnapshot } from './workbenchExecution';

export type WorkbenchFreshnessStatus = 'fresh' | 'stale' | 'awaiting-upstream' | 'not-run';
export type ExperimentLedgerStatus = 'recorded' | 'committed' | 'attention' | 'draft';
export type WorkbenchAuthorityTier = 'simulated' | 'contextual' | 'evidence-linked' | 'experiment-backed';

export interface WorkbenchToolFreshness {
  toolId: string;
  status: WorkbenchFreshnessStatus;
  summary: string;
  latestRunArtifact: WorkbenchRunArtifact | null;
  blockingToolIds: string[];
  latestUpstreamArtifact: WorkbenchRunArtifact | null;
}

export interface WorkbenchExperimentLedgerEntry {
  id: string;
  toolId: string;
  sourceArtifactId?: string;
  title: string;
  summary: string;
  status: ExperimentLedgerStatus;
  metrics: string[];
  createdAt: number;
}

export function getAuthorityTier(artifact: WorkbenchRunArtifact): WorkbenchAuthorityTier {
  if (artifact.isSimulated) return 'simulated';
  if (['cellfree', 'dbtlflow', 'multio', 'scspatial'].includes(artifact.toolId)) return 'experiment-backed';
  if (artifact.sourceArtifactId || artifact.execution.analyzeRef) return 'evidence-linked';
  return 'contextual';
}

export function getAuthoritySummary(tier: WorkbenchAuthorityTier) {
  switch (tier) {
    case 'experiment-backed':
      return 'Backed by experimental or assay-linked outputs';
    case 'evidence-linked':
      return 'Linked to current evidence and analyze context';
    case 'contextual':
      return 'Derived from current project context';
    default:
      return 'Simulation-grade output, not experimental evidence';
  }
}

function latestArtifactByTool(runArtifacts: WorkbenchRunArtifact[]) {
  const map = new Map<string, WorkbenchRunArtifact>();
  runArtifacts.forEach((artifact) => {
    if (!map.has(artifact.toolId)) {
      map.set(artifact.toolId, artifact);
    }
  });
  return map;
}

export function getToolFreshness(
  runArtifacts: WorkbenchRunArtifact[],
  toolId?: string | null,
  context?: {
    project?: WorkbenchProjectBrief | null;
    analyzeArtifact?: WorkbenchAnalyzeArtifact | null;
  },
): WorkbenchToolFreshness {
  const empty: WorkbenchToolFreshness = {
    toolId: toolId ?? 'unknown',
    status: 'not-run',
    summary: 'No auditable run recorded yet',
    latestRunArtifact: null,
    blockingToolIds: [],
    latestUpstreamArtifact: null,
  };
  if (!toolId) return empty;

  const latestByTool = latestArtifactByTool(runArtifacts);
  const latestRunArtifact = latestByTool.get(toolId) ?? null;
  const currentExecution = buildExecutionSnapshot({
    toolId,
    project: context?.project,
    analyzeArtifact: context?.analyzeArtifact,
    runArtifacts,
  });
  const latestUpstreamArtifact = currentExecution.upstreamToolIds
    .map((upstreamToolId) => latestByTool.get(upstreamToolId))
    .filter((artifact): artifact is WorkbenchRunArtifact => Boolean(artifact))
    .sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;

  if (!latestRunArtifact) {
    if (currentExecution.analyzeRef || currentExecution.projectRef || currentExecution.upstreamToolIds.length) {
      return {
        toolId,
        status: 'awaiting-upstream',
        summary: currentExecution.upstreamToolIds.length
          ? `Upstream context from ${currentExecution.upstreamToolIds.map((upstreamToolId) => upstreamToolId.toUpperCase()).join(', ')} is ready, but this tool has not been rerun yet`
          : 'Project or Analyze context changed, but this tool has not been run yet',
        latestRunArtifact: null,
        blockingToolIds: currentExecution.upstreamToolIds,
        latestUpstreamArtifact,
      };
    }
    return empty;
  }

  const diff = diffExecutionSnapshot(latestRunArtifact.execution, currentExecution);
  if (diff.signatureChanged) {
    const reasons: string[] = [];
    if (diff.projectChanged) reasons.push('project context changed');
    if (diff.analyzeChanged) reasons.push('analyze artifact changed');
    if (diff.blockingToolIds.length) {
      reasons.push(`upstream rerun: ${diff.blockingToolIds.map((upstreamToolId) => upstreamToolId.toUpperCase()).join(', ')}`);
    }
    return {
      toolId,
      status: 'stale',
      summary: reasons.length
        ? reasons.join(' · ')
        : 'Current run no longer matches the latest execution context',
      latestRunArtifact,
      blockingToolIds: diff.blockingToolIds,
      latestUpstreamArtifact,
    };
  }

  return {
    toolId,
    status: 'fresh',
    summary: currentExecution.upstreamToolIds.length
      ? `Latest run matches current project, analyze, and upstream context from ${currentExecution.upstreamToolIds.map((upstreamToolId) => upstreamToolId.toUpperCase()).join(', ')}`
      : 'Latest run matches the current project and analyze context',
    latestRunArtifact,
    blockingToolIds: [],
    latestUpstreamArtifact,
  };
}

export function getFreshnessMap(
  runArtifacts: WorkbenchRunArtifact[],
  toolIds: string[],
  context?: {
    project?: WorkbenchProjectBrief | null;
    analyzeArtifact?: WorkbenchAnalyzeArtifact | null;
  },
) {
  return Object.fromEntries(toolIds.map((toolId) => [toolId, getToolFreshness(runArtifacts, toolId, context)]));
}

function isCellFreePayload(payload: WorkbenchRunArtifact['payloadSnapshot']) {
  return payload.toolId === 'cellfree';
}

function isDBTLPayload(payload: WorkbenchRunArtifact['payloadSnapshot']) {
  return payload.toolId === 'dbtlflow';
}

function isMultiOPayload(payload: WorkbenchRunArtifact['payloadSnapshot']) {
  return payload.toolId === 'multio';
}

function isSpatialPayload(payload: WorkbenchRunArtifact['payloadSnapshot']) {
  return payload.toolId === 'scspatial';
}

export function buildExperimentLedger(runArtifacts: WorkbenchRunArtifact[], limit = 8): WorkbenchExperimentLedgerEntry[] {
  return runArtifacts
    .filter((artifact) => ['cellfree', 'dbtlflow', 'multio', 'scspatial'].includes(artifact.toolId))
    .slice(0, limit)
    .map((artifact) => {
      const payload = artifact.payloadSnapshot;

      if (isCellFreePayload(payload)) {
        return {
          id: artifact.id,
          toolId: artifact.toolId,
          sourceArtifactId: artifact.sourceArtifactId,
          title: `Cell-free validation · ${payload.targetConstruct}`,
          summary: artifact.summary,
          status: payload.result.isResourceLimited ? 'attention' : 'recorded',
          metrics: [
            `${payload.result.totalProteinYield.toFixed(2)} mg/mL`,
            `depletion ${payload.result.energyDepletionTime.toFixed(1)} min`,
            payload.result.confidence !== null ? `${(payload.result.confidence * 100).toFixed(0)}% confidence` : 'confidence pending',
          ],
          createdAt: artifact.createdAt,
        };
      }

      if (isDBTLPayload(payload)) {
        return {
          id: artifact.id,
          toolId: artifact.toolId,
          sourceArtifactId: artifact.sourceArtifactId,
          title: `DBTL ${payload.result.latestPhase} cycle`,
          summary: artifact.summary,
          status: payload.feedbackSource === 'committed' ? 'committed' : 'draft',
          metrics: [
            `${payload.result.passRate.toFixed(0)}% pass`,
            `${payload.result.improvementRate.toFixed(0)}% improvement`,
            payload.passed ? 'threshold passed' : 'threshold missed',
          ],
          createdAt: artifact.createdAt,
        };
      }

      if (isMultiOPayload(payload)) {
        return {
          id: artifact.id,
          toolId: artifact.toolId,
          sourceArtifactId: artifact.sourceArtifactId,
          title: `Multi-omics integration · ${payload.selectedGene}`,
          summary: artifact.summary,
          status: 'recorded',
          metrics: [
            `${payload.result.significantCount} significant`,
            `${payload.result.dominantLayer}`,
            `${(payload.result.bottleneckConfidence * 100).toFixed(0)}% bottleneck confidence`,
          ],
          createdAt: artifact.createdAt,
        };
      }

      if (isSpatialPayload(payload)) {
        return {
          id: artifact.id,
          toolId: artifact.toolId,
          sourceArtifactId: artifact.sourceArtifactId,
          title: `Single-cell / spatial readout · ${payload.highlightGene}`,
          summary: artifact.summary,
          status: 'recorded',
          metrics: [
            `${payload.result.totalCells} cells`,
            `${payload.result.highestYieldCluster} highest-yield cluster`,
            `Moran's I ${payload.result.topMoranI.toFixed(2)}`,
          ],
          createdAt: artifact.createdAt,
        };
      }

      return {
        id: artifact.id,
        toolId: artifact.toolId,
        sourceArtifactId: artifact.sourceArtifactId,
        title: artifact.toolId.toUpperCase(),
        summary: artifact.summary,
        status: 'recorded',
        metrics: [],
        createdAt: artifact.createdAt,
      };
    });
}
