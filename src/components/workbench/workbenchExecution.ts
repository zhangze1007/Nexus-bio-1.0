import type {
  WorkbenchAnalyzeArtifact,
  WorkbenchProjectBrief,
  WorkbenchRunArtifact,
} from '../../store/workbenchTypes';
import { getUpstreamToolIds } from '../tools/shared/workbenchGraph';

export interface WorkbenchExecutionSnapshot {
  projectRef: string | null;
  analyzeRef: string | null;
  upstreamToolIds: string[];
  upstreamArtifactIds: string[];
  dependencySignature: string;
}

function buildProjectRef(project?: WorkbenchProjectBrief | null) {
  if (!project) return null;
  return [project.id, project.updatedAt, project.targetProduct, project.status, project.isDemo ? 'demo' : 'project'].join(':');
}

function buildAnalyzeRef(analyzeArtifact?: WorkbenchAnalyzeArtifact | null) {
  if (!analyzeArtifact) return null;
  return [analyzeArtifact.id, analyzeArtifact.generatedAt, analyzeArtifact.targetProduct].join(':');
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

export function buildExecutionSnapshot(options: {
  toolId: string;
  project?: WorkbenchProjectBrief | null;
  analyzeArtifact?: WorkbenchAnalyzeArtifact | null;
  runArtifacts: WorkbenchRunArtifact[];
}) {
  const upstreamToolIds = getUpstreamToolIds(options.toolId, { deep: false, includeSupport: false });
  const latestByTool = latestArtifactByTool(options.runArtifacts);
  const upstreamArtifactIds = upstreamToolIds
    .map((toolId) => latestByTool.get(toolId)?.id)
    .filter((artifactId): artifactId is string => Boolean(artifactId));

  const projectRef = buildProjectRef(options.project);
  const analyzeRef = buildAnalyzeRef(options.analyzeArtifact);
  const dependencySignature = [
    options.toolId,
    projectRef ?? 'project:none',
    analyzeRef ?? 'analyze:none',
    ...upstreamToolIds.map((toolId) => `upstream:${toolId}:${latestByTool.get(toolId)?.id ?? 'none'}`),
  ].join('|');

  const snapshot: WorkbenchExecutionSnapshot = {
    projectRef,
    analyzeRef,
    upstreamToolIds,
    upstreamArtifactIds,
    dependencySignature,
  };

  return snapshot;
}

export function diffExecutionSnapshot(
  previous: WorkbenchExecutionSnapshot | null | undefined,
  current: WorkbenchExecutionSnapshot,
) {
  if (!previous) {
    return {
      projectChanged: Boolean(current.projectRef),
      analyzeChanged: Boolean(current.analyzeRef),
      blockingToolIds: current.upstreamToolIds,
      signatureChanged: true,
    };
  }

  const blockingToolIds = current.upstreamToolIds.filter((toolId, index) => {
    return previous.upstreamToolIds[index] !== toolId || previous.upstreamArtifactIds[index] !== current.upstreamArtifactIds[index];
  });

  return {
    projectChanged: previous.projectRef !== current.projectRef,
    analyzeChanged: previous.analyzeRef !== current.analyzeRef,
    blockingToolIds,
    signatureChanged: previous.dependencySignature !== current.dependencySignature,
  };
}
