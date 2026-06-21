/**
 * Evidence Wrapper — Attach evidence metadata to any biological result
 *
 * Rule: Any biological output must be wrapped with evidence before
 * entering the UI or being used for downstream decisions.
 *
 * Without evidence, outputs are automatically tagged as 'unverified'
 * and cannot appear in the "trusted results" section of the UI.
 */

import type { BioEvidence, EvidenceSourceType, EvidenceConfidence } from './bioEvidence';

export type ResultStatus = 'production' | 'research' | 'demo';

export interface EvidenceWrapped<T> {
  /** The raw result */
  result: T;
  /** Evidence supporting this result */
  evidence: BioEvidence[];
  /** Overall confidence (aggregated from evidence) */
  confidence: EvidenceConfidence;
  /** Whether this result is suitable for production use */
  isProductionReady: boolean;
  /** Status: production / research / demo */
  status: ResultStatus;
  /** Whether this result contains simulated/predicted data */
  containsSimulated: boolean;
  /** Whether this result has been experimentally validated */
  isExperimentallyValidated: boolean;
  /** Human-readable summary of evidence quality */
  evidenceSummary: string;
}

/**
 * Wrap a result with evidence metadata.
 */
export function withEvidence<T>(
  result: T,
  evidence: BioEvidence[],
  forcedStatus?: ResultStatus,
): EvidenceWrapped<T> {
  const hasExperimental = evidence.some(e => e.sourceType === 'experimental');
  const hasPredicted = evidence.some(e => e.sourceType === 'predicted' || e.sourceType === 'simulated');
  const hasLiterature = evidence.some(e => e.sourceType === 'literature');
  const hasDatabase = evidence.some(e => e.sourceType === 'database');

  // Determine confidence
  let confidence: EvidenceConfidence;
  if ((hasExperimental || hasLiterature || hasDatabase) && !hasPredicted) confidence = 'high';
  else if (hasPredicted && (hasLiterature || hasDatabase)) confidence = 'medium';
  else if (hasPredicted) confidence = 'low';
  else confidence = 'uncertain';

  // Determine status
  let status: ResultStatus;
  if (forcedStatus) {
    status = forcedStatus;
  } else if (hasExperimental || (hasLiterature && !hasPredicted) || (hasDatabase && !hasPredicted)) {
    status = 'production';
  } else if (hasPredicted) {
    status = 'research';
  } else {
    status = 'demo';
  }

  const isProductionReady = status === 'production' && confidence === 'high';
  const containsSimulated = hasPredicted;
  const isExperimentallyValidated = hasExperimental;

  // Evidence summary
  const sources = evidence.map(e => `${e.sourceType}:${e.source}`).join(', ');
  const evidenceSummary = evidence.length > 0
    ? `${evidence.length} evidence(s): ${sources}`
    : 'No evidence attached — result is unverified';

  return {
    result,
    evidence,
    confidence,
    isProductionReady,
    status,
    containsSimulated,
    isExperimentallyValidated,
    evidenceSummary,
  };
}

/**
 * Check if a wrapped result can be displayed in the "trusted results" section.
 */
export function isTrustedResult<T>(wrapped: EvidenceWrapped<T>): boolean {
  return wrapped.isProductionReady && wrapped.evidence.length > 0;
}

/**
 * Get display label for evidence status.
 */
export function getEvidenceStatusLabel<T>(wrapped: EvidenceWrapped<T>): string {
  if (wrapped.isProductionReady) return '✓ Validated';
  if (wrapped.isExperimentallyValidated) return '✓ Experimental';
  if (wrapped.containsSimulated) return '⚠ Predicted/Simulated';
  if (wrapped.evidence.length === 0) return '✗ No Evidence';
  return '○ Research-grade';
}
