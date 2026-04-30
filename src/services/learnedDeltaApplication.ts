import type { LearnedDeltaPack } from '../types/learnedDelta';
import { validateLearnedDeltaPack } from '../validation/learnedDeltaValidator';

export interface LearnedDeltaApplicationDecision {
  canApply: boolean;
  reason: string;
  appliedDeltaPackId?: string;
}

export function canApplyLearnedDeltaPack(
  deltaPack: unknown,
): LearnedDeltaApplicationDecision {
  const validation = validateLearnedDeltaPack(deltaPack);
  if (!validation.ok) {
    const firstError = validation.issues.find((issue) => issue.severity === 'error');
    return {
      canApply: false,
      reason: firstError?.message ?? 'LearnedDeltaPack failed validation.',
    };
  }

  const typedPack = deltaPack as LearnedDeltaPack;
  if (typedPack.humanGateStatus !== 'approved') {
    return {
      canApply: false,
      reason: `LearnedDeltaPack ${typedPack.deltaPackId} is ${typedPack.humanGateStatus}; only approved deltas can apply.`,
    };
  }

  if (!typedPack.sourceDbtlRunId.trim()) {
    return {
      canApply: false,
      reason: 'LearnedDeltaPack is missing sourceDbtlRunId.',
    };
  }

  if (typedPack.sourceExperimentRecordIds.length === 0) {
    return {
      canApply: false,
      reason: 'LearnedDeltaPack is missing sourceExperimentRecordIds.',
    };
  }

  return {
    canApply: true,
    reason: `LearnedDeltaPack ${typedPack.deltaPackId} is approved and valid.`,
    appliedDeltaPackId: typedPack.deltaPackId,
  };
}

export function filterApprovedLearnedDeltaPacks(
  deltaPacks: unknown[],
): LearnedDeltaPack[] {
  return deltaPacks.filter((deltaPack): deltaPack is LearnedDeltaPack => (
    canApplyLearnedDeltaPack(deltaPack).canApply
  ));
}
