/**
 * axonContext — workbench → copilot context bridge.
 *
 * The Copilot overlay (CopilotSlideOver) and the deep NEXAI page both
 * need to feed the current workbench state into the prompt. Before PR-3
 * this happened ad-hoc inside NEXAIPage and was completely missing in
 * the overlay. PR-3 centralises it here so every copilot entry point
 * augments prompts the same way, and so the augmentation is explicit,
 * inspectable, and bounded.
 *
 * Rules (non-negotiable):
 *   • Never silently send huge blobs — every field is length-capped.
 *   • Never hallucinate context — if a field is missing, it is omitted.
 *   • The augmentation is deterministic for identical state.
 *   • The summary-one-line is used for the UI "using workbench context"
 *     indicator; the promptAugmentation is what we append to the query.
 */

import type {
  NextStepRecommendation,
  WorkbenchAnalyzeArtifact,
  WorkbenchEvidenceItem,
  WorkbenchProjectBrief,
} from '../store/workbenchTypes';

export interface WorkbenchContextSnapshot {
  targetProduct: string | null;
  project: Pick<WorkbenchProjectBrief, 'title' | 'targetProduct'> | null;
  analyzeArtifact: Pick<
    WorkbenchAnalyzeArtifact,
    'targetProduct' | 'bottleneckAssumptions' | 'thermodynamicConcerns' | 'pathwayCandidates'
  > | null;
  evidenceItems: Pick<WorkbenchEvidenceItem, 'title' | 'id' | 'year'>[];
  selectedEvidenceIds: string[];
  nextRecommendations: Pick<NextStepRecommendation, 'toolId' | 'reason'>[];
  currentToolId: string | null;
}

export interface WorkbenchCopilotContext {
  hasContext: boolean;
  targetProduct: string | null;
  evidenceTotal: number;
  evidenceSelected: number;
  nextToolIds: string[];
  currentToolId: string | null;
  /** Short pill text: "artemisinin · 3/5 evidence · stage pathd". */
  summaryOneLine: string;
  /**
   * Bounded prompt-augmentation block. Empty string when there is no
   * meaningful context. Otherwise 4–8 lines, no free-form user text,
   * no secrets, nothing that could balloon in size.
   */
  promptAugmentation: string;
}

const MAX_EVIDENCE_TITLES = 3;
const MAX_TITLE_CHARS = 80;
const MAX_BOTTLENECK_CHARS = 120;
const MAX_RECOMMENDATIONS = 3;

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

export function buildWorkbenchCopilotContext(
  snapshot: WorkbenchContextSnapshot,
): WorkbenchCopilotContext {
  const target =
    snapshot.analyzeArtifact?.targetProduct ??
    snapshot.project?.targetProduct ??
    null;

  const evidenceTotal = snapshot.evidenceItems.length;
  const evidenceSelected = snapshot.selectedEvidenceIds.length;
  const nextToolIds = snapshot.nextRecommendations
    .slice(0, MAX_RECOMMENDATIONS)
    .map((r) => r.toolId);

  const hasContext = Boolean(
    target ||
      evidenceTotal > 0 ||
      nextToolIds.length > 0 ||
      snapshot.currentToolId,
  );

  const summaryParts: string[] = [];
  if (target) summaryParts.push(target);
  if (evidenceTotal > 0) {
    summaryParts.push(`${evidenceSelected}/${evidenceTotal} evidence`);
  }
  if (snapshot.currentToolId) summaryParts.push(`on ${snapshot.currentToolId}`);
  const summaryOneLine = summaryParts.join(' · ') || 'No active workbench context';

  const augmentationLines: string[] = [];
  if (hasContext) {
    augmentationLines.push('Workbench context (read-only):');
    if (target) augmentationLines.push(`- Target product: ${target}`);
    if (snapshot.currentToolId) {
      augmentationLines.push(`- Active tool: ${snapshot.currentToolId}`);
    }
    if (evidenceTotal > 0) {
      augmentationLines.push(
        `- Evidence bundle: ${evidenceSelected} selected of ${evidenceTotal} saved`,
      );
      const titles = snapshot.evidenceItems
        .slice(0, MAX_EVIDENCE_TITLES)
        .map((item) => {
          const year = item.year ? ` (${item.year})` : '';
          return `  • ${truncate(item.title, MAX_TITLE_CHARS)}${year}`;
        });
      augmentationLines.push(...titles);
    }
    const bottleneck = snapshot.analyzeArtifact?.bottleneckAssumptions?.[0];
    if (bottleneck) {
      augmentationLines.push(
        `- Top bottleneck: ${truncate(bottleneck.label, MAX_BOTTLENECK_CHARS)}`,
      );
    }
    const thermo = snapshot.analyzeArtifact?.thermodynamicConcerns?.[0];
    if (thermo) {
      augmentationLines.push(
        `- Thermodynamic concern: ${truncate(thermo, MAX_BOTTLENECK_CHARS)}`,
      );
    }
    if (nextToolIds.length > 0) {
      augmentationLines.push(
        `- Queued next steps: ${nextToolIds.join(', ')}`,
      );
    }
    augmentationLines.push(
      'Use this context to ground the answer; do not invent additional workbench state.',
    );
  }

  return {
    hasContext,
    targetProduct: target,
    evidenceTotal,
    evidenceSelected,
    nextToolIds,
    currentToolId: snapshot.currentToolId,
    summaryOneLine,
    promptAugmentation: augmentationLines.join('\n'),
  };
}

/**
 * Compose a full copilot query by appending the bounded context block
 * when it is non-empty. No-op when there is no active workbench state.
 */
export function composeCopilotQuery(
  rawQuery: string,
  context: WorkbenchCopilotContext,
): string {
  const trimmed = rawQuery.trim();
  if (!trimmed) return trimmed;
  if (!context.hasContext || !context.promptAugmentation) return trimmed;
  return `${trimmed}\n\n${context.promptAugmentation}`;
}
