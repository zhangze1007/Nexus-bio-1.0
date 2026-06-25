import type { ExternalReviewSubmission } from "../types/externalReview";

export interface ExternalReviewMetrics {
  totalResponses: number;
  agreementRate: number;
  disagreementRate: number;
  unsureRate: number;
  bypassAttemptCount: number;
  bypassSuccessRate: number;
  suggestedBenchmarkAdditionCount: number;
  wordingIssueCount: number;
}

function roundedRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function normalizedStatus(value: string): string {
  return value.trim();
}

function comparisonTarget(runtimeStatus: string, expectedStatus: string): string {
  const runtime = normalizedStatus(runtimeStatus);
  if (runtime.length > 0) return runtime;
  return normalizedStatus(expectedStatus);
}

export function computeExternalReviewMetrics(submission: ExternalReviewSubmission): ExternalReviewMetrics {
  const totalResponses = submission.responses.length;
  let agreementCount = 0;
  let disagreementCount = 0;
  let unsureCount = 0;
  let suggestedBenchmarkAdditionCount = 0;
  let wordingIssueCount = 0;

  for (const response of submission.responses) {
    if (response.reviewerStatus === "unsure") {
      unsureCount += 1;
    } else if (response.reviewerStatus === comparisonTarget(response.runtimeStatus, response.expectedStatus)) {
      agreementCount += 1;
    } else {
      disagreementCount += 1;
    }

    if (response.suggestedAction === "add-benchmark-case") {
      suggestedBenchmarkAdditionCount += 1;
    }
    if (response.wordingMisleading === true || response.suggestedAction === "rewrite-wording") {
      wordingIssueCount += 1;
    }
  }

  const bypassAttemptCount = submission.adversarialAttempts.length;
  const bypassSuccessCount = submission.adversarialAttempts.filter((attempt) => attempt.bypassSucceeded).length;

  return {
    totalResponses,
    agreementRate: roundedRate(agreementCount, totalResponses),
    disagreementRate: roundedRate(disagreementCount, totalResponses),
    unsureRate: roundedRate(unsureCount, totalResponses),
    bypassAttemptCount,
    bypassSuccessRate: roundedRate(bypassSuccessCount, bypassAttemptCount),
    suggestedBenchmarkAdditionCount,
    wordingIssueCount,
  };
}
