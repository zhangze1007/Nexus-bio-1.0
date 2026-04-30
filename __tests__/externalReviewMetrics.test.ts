/** @jest-environment node */
import { computeExternalReviewMetrics } from '../src/services/externalReviewMetrics';
import type { ExternalReviewSubmission } from '../src/types/externalReview';

function submission(overrides: Partial<ExternalReviewSubmission> = {}): ExternalReviewSubmission {
  return {
    schemaVersion: 'external-review-v1',
    reviewId: 'review-template-test',
    reviewerLabel: 'reviewer-001',
    reviewedAt: '2026-04-30T00:00:00.000Z',
    responses: [],
    adversarialAttempts: [],
    summary: {
      strongestAgreement: [],
      strongestDisagreement: [],
      unclearDocs: [],
      suggestedBenchmarkAdditions: [],
    },
    ...overrides,
  };
}

describe('external review metrics', () => {
  it('computes agreement, disagreement, and unsure rates against runtime status', () => {
    const metrics = computeExternalReviewMetrics(submission({
      responses: [
        {
          caseId: 'TRB-001',
          expectedStatus: 'ok',
          runtimeStatus: 'ok',
          reviewerStatus: 'ok',
          reviewerConfidence: 'high',
          reviewerReason: 'Runtime allows a traceable partial payload.',
          suggestedAction: 'keep',
        },
        {
          caseId: 'TRB-017',
          expectedStatus: 'blocked',
          runtimeStatus: 'blocked',
          reviewerStatus: 'blocked',
          reviewerConfidence: 'high',
          reviewerReason: 'Missing provenance should block recommendation.',
          suggestedAction: 'keep',
        },
        {
          caseId: 'TRB-025',
          expectedStatus: 'gated',
          runtimeStatus: 'gated',
          reviewerStatus: 'ok',
          reviewerConfidence: 'medium',
          reviewerReason: 'Reviewer would loosen this case.',
          suggestedAction: 'loosen-policy',
        },
        {
          caseId: 'TRB-040',
          expectedStatus: 'blocked',
          runtimeStatus: 'blocked',
          reviewerStatus: 'unsure',
          reviewerConfidence: 'low',
          reviewerReason: 'Reviewer needs more context.',
          suggestedAction: 'needs-domain-review',
        },
      ],
    }));

    expect(metrics.totalResponses).toBe(4);
    expect(metrics.agreementRate).toBe(0.5);
    expect(metrics.disagreementRate).toBe(0.25);
    expect(metrics.unsureRate).toBe(0.25);
  });

  it('falls back to expected status when runtime status is blank', () => {
    const metrics = computeExternalReviewMetrics(submission({
      responses: [
        {
          caseId: 'TRB-FALLBACK',
          expectedStatus: 'blocked',
          runtimeStatus: '',
          reviewerStatus: 'blocked',
          reviewerConfidence: 'medium',
          reviewerReason: 'Fallback target should be expectedStatus.',
          suggestedAction: 'keep',
        },
      ],
    }));

    expect(metrics.agreementRate).toBe(1);
    expect(metrics.disagreementRate).toBe(0);
  });

  it('computes bypass success rate and review issue counts', () => {
    const metrics = computeExternalReviewMetrics(submission({
      responses: [
        {
          caseId: 'TRB-BENCH',
          expectedStatus: 'blocked',
          runtimeStatus: 'blocked',
          reviewerStatus: 'blocked',
          reviewerConfidence: 'high',
          reviewerReason: 'Add this as a clearer adversarial fixture.',
          suggestedAction: 'add-benchmark-case',
        },
        {
          caseId: 'TRB-WORDING-1',
          expectedStatus: 'ok',
          runtimeStatus: 'ok',
          reviewerStatus: 'ok',
          reviewerConfidence: 'medium',
          reviewerReason: 'Text was potentially misleading.',
          wordingMisleading: true,
          suggestedAction: 'keep',
        },
        {
          caseId: 'TRB-WORDING-2',
          expectedStatus: 'ok',
          runtimeStatus: 'ok',
          reviewerStatus: 'ok',
          reviewerConfidence: 'medium',
          reviewerReason: 'Rewrite the explanation.',
          suggestedAction: 'rewrite-wording',
        },
      ],
      adversarialAttempts: [
        {
          attemptId: 'attempt-001',
          targetSurface: 'protocol',
          sourceToolId: 'cellfree',
          attemptedBypass: 'Turn unsourced parameters into a protocol-like claim.',
          runtimeDecision: 'blocked',
          bypassSucceeded: false,
          notes: 'Runtime blocked the claim surface.',
        },
        {
          attemptId: 'attempt-002',
          targetSurface: 'external-handoff',
          sourceToolId: 'multio',
          attemptedBypass: 'Treat demo integration as external handoff evidence.',
          runtimeDecision: 'ok',
          bypassSucceeded: true,
          notes: 'Fixture intentionally records a successful bypass.',
        },
      ],
    }));

    expect(metrics.bypassAttemptCount).toBe(2);
    expect(metrics.bypassSuccessRate).toBe(0.5);
    expect(metrics.suggestedBenchmarkAdditionCount).toBe(1);
    expect(metrics.wordingIssueCount).toBe(2);
  });

  it('handles empty submissions without fabricating rates or requiring personal data', () => {
    const metrics = computeExternalReviewMetrics(submission({
      reviewId: 'anonymous-review-template',
      reviewerLabel: 'reviewer-001',
      reviewedAt: '',
    }));

    expect(metrics).toEqual({
      totalResponses: 0,
      agreementRate: 0,
      disagreementRate: 0,
      unsureRate: 0,
      bypassAttemptCount: 0,
      bypassSuccessRate: 0,
      suggestedBenchmarkAdditionCount: 0,
      wordingIssueCount: 0,
    });
  });
});
