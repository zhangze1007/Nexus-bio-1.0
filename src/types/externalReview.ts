import type { ClaimSurface } from "../protocol/nexusTrustRuntime";

export type ExternalReviewerStatus = "ok" | "blocked" | "gated" | "demoOnly" | "unsure";

export type ExternalReviewConfidence = "low" | "medium" | "high";

export type ExternalReviewSuggestedAction =
  | "keep"
  | "tighten-policy"
  | "loosen-policy"
  | "add-benchmark-case"
  | "rewrite-wording"
  | "needs-domain-review";

export interface ExternalReviewCaseResponse {
  caseId: string;
  expectedStatus: string;
  runtimeStatus: string;
  reviewerStatus: ExternalReviewerStatus;
  reviewerConfidence: ExternalReviewConfidence;
  reviewerReason: string;
  blockReasonable?: boolean;
  evidenceSufficient?: boolean;
  provenanceSufficient?: boolean;
  wordingMisleading?: boolean;
  suggestedAction: ExternalReviewSuggestedAction;
}

export interface ExternalAdversarialAttempt {
  attemptId: string;
  targetSurface: ClaimSurface;
  sourceToolId: string;
  attemptedBypass: string;
  runtimeDecision?: string;
  bypassSucceeded: boolean;
  notes: string;
}

export interface ExternalReviewSubmission {
  schemaVersion: "external-review-v1";
  reviewId: string;
  reviewerLabel: string;
  reviewerRole?: string;
  reviewedAt: string;
  proofPackageCommit?: string;
  responses: ExternalReviewCaseResponse[];
  adversarialAttempts: ExternalAdversarialAttempt[];
  summary: {
    strongestAgreement: string[];
    strongestDisagreement: string[];
    unclearDocs: string[];
    suggestedBenchmarkAdditions: string[];
  };
}
