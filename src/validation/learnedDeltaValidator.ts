import type { DBTLLearnedMetrics } from "../types/dbtlFeedback";
import {
  type BoundDelta,
  LEARNED_DELTA_CLASSIFICATIONS,
  LEARNED_DELTA_HUMAN_GATE_STATUSES,
  type LearnedDeltaClassification,
  type LearnedDeltaHumanGateStatus,
  type LearnedDeltaPack,
  type NumericDelta,
} from "../types/learnedDelta";

export type LearnedDeltaValidationCode =
  | "MISSING_REQUIRED_FIELD"
  | "EMPTY_SOURCE"
  | "EMPTY_TARGET_TOOLS"
  | "INVALID_DELTA_VALUE"
  | "MISSING_EXPERIMENT_SOURCE"
  | "MISSING_DBTL_SOURCE"
  | "UNAPPROVED_DELTA"
  | "INVALID_DATE";

export interface LearnedDeltaValidationIssue {
  field: string;
  code: LearnedDeltaValidationCode;
  message: string;
  severity: "error" | "warning";
}

export interface LearnedDeltaValidationResult {
  ok: boolean;
  issues: LearnedDeltaValidationIssue[];
}

const METRIC_KEYS: Array<keyof DBTLLearnedMetrics> = [
  "drainPercent",
  "doRmse",
  "cfpsConfidence",
  "bindingKdUM",
  "yieldChangePercent",
  "growthPenaltyPercent",
  "confidenceScore",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasNonEmptyStrings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function isClassification(value: unknown): value is LearnedDeltaClassification {
  return typeof value === "string" && (LEARNED_DELTA_CLASSIFICATIONS as readonly string[]).includes(value);
}

function isHumanGateStatus(value: unknown): value is LearnedDeltaHumanGateStatus {
  return typeof value === "string" && (LEARNED_DELTA_HUMAN_GATE_STATUSES as readonly string[]).includes(value);
}

function pushIssue(issues: LearnedDeltaValidationIssue[], issue: LearnedDeltaValidationIssue): void {
  issues.push(issue);
}

function validateRequiredString(
  record: Record<string, unknown>,
  field: string,
  issues: LearnedDeltaValidationIssue[],
): void {
  if (!isNonEmptyString(record[field])) {
    pushIssue(issues, {
      field,
      code: "MISSING_REQUIRED_FIELD",
      message: `${field} is required.`,
      severity: "error",
    });
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateOptionalText(
  delta: Record<string, unknown>,
  field: string,
  issues: LearnedDeltaValidationIssue[],
): void {
  if (delta.unit !== undefined && typeof delta.unit !== "string") {
    pushIssue(issues, {
      field: `${field}.unit`,
      code: "INVALID_DELTA_VALUE",
      message: `${field}.unit must be a string when present.`,
      severity: "error",
    });
  }
  if (delta.rationale !== undefined && typeof delta.rationale !== "string") {
    pushIssue(issues, {
      field: `${field}.rationale`,
      code: "INVALID_DELTA_VALUE",
      message: `${field}.rationale must be a string when present.`,
      severity: "error",
    });
  }
}

function validateNumericDelta(
  value: unknown,
  field: string,
  issues: LearnedDeltaValidationIssue[],
): value is NumericDelta {
  if (!isRecord(value)) {
    pushIssue(issues, {
      field,
      code: "INVALID_DELTA_VALUE",
      message: `${field} must be a numeric delta object.`,
      severity: "error",
    });
    return false;
  }
  let ok = true;
  if (!isFiniteNumber(value.before)) {
    pushIssue(issues, {
      field: `${field}.before`,
      code: "INVALID_DELTA_VALUE",
      message: `${field}.before must be a finite number.`,
      severity: "error",
    });
    ok = false;
  }
  if (!isFiniteNumber(value.after)) {
    pushIssue(issues, {
      field: `${field}.after`,
      code: "INVALID_DELTA_VALUE",
      message: `${field}.after must be a finite number.`,
      severity: "error",
    });
    ok = false;
  }
  validateOptionalText(value, field, issues);
  return ok;
}

function isFiniteBound(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    value[0] <= value[1]
  );
}

function validateBoundDelta(value: unknown, field: string, issues: LearnedDeltaValidationIssue[]): value is BoundDelta {
  if (!isRecord(value)) {
    pushIssue(issues, {
      field,
      code: "INVALID_DELTA_VALUE",
      message: `${field} must be a bound delta object.`,
      severity: "error",
    });
    return false;
  }
  let ok = true;
  if (!isFiniteBound(value.before)) {
    pushIssue(issues, {
      field: `${field}.before`,
      code: "INVALID_DELTA_VALUE",
      message: `${field}.before must be a finite [lower, upper] tuple with lower <= upper.`,
      severity: "error",
    });
    ok = false;
  }
  if (!isFiniteBound(value.after)) {
    pushIssue(issues, {
      field: `${field}.after`,
      code: "INVALID_DELTA_VALUE",
      message: `${field}.after must be a finite [lower, upper] tuple with lower <= upper.`,
      severity: "error",
    });
    ok = false;
  }
  validateOptionalText(value, field, issues);
  return ok;
}

function validateDeltaMap(
  value: unknown,
  field: "changedBounds" | "changedPriors" | "changedWeights",
  issues: LearnedDeltaValidationIssue[],
): void {
  if (!isRecord(value)) {
    pushIssue(issues, {
      field,
      code: "MISSING_REQUIRED_FIELD",
      message: `${field} must be an object.`,
      severity: "error",
    });
    return;
  }

  for (const [key, delta] of Object.entries(value)) {
    if (field === "changedBounds") {
      validateBoundDelta(delta, `${field}.${key}`, issues);
    } else {
      validateNumericDelta(delta, `${field}.${key}`, issues);
    }
  }
}

function validateLearnedMetrics(value: unknown, issues: LearnedDeltaValidationIssue[]): void {
  if (!isRecord(value)) {
    pushIssue(issues, {
      field: "learnedMetrics",
      code: "MISSING_REQUIRED_FIELD",
      message: "learnedMetrics must be an object.",
      severity: "error",
    });
    return;
  }

  for (const key of METRIC_KEYS) {
    const metric = value[key];
    if (metric !== undefined && !isFiniteNumber(metric)) {
      pushIssue(issues, {
        field: `learnedMetrics.${key}`,
        code: "INVALID_DELTA_VALUE",
        message: `learnedMetrics.${key} must be a finite number when present.`,
        severity: "error",
      });
    }
  }
}

export function validateLearnedDeltaPack(value: unknown): LearnedDeltaValidationResult {
  const issues: LearnedDeltaValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [
        {
          field: "$",
          code: "MISSING_REQUIRED_FIELD",
          message: "LearnedDeltaPack must be an object.",
          severity: "error",
        },
      ],
    };
  }

  if (value.schemaVersion !== "learned-delta-pack-v1") {
    pushIssue(issues, {
      field: "schemaVersion",
      code: "MISSING_REQUIRED_FIELD",
      message: "schemaVersion must be learned-delta-pack-v1.",
      severity: "error",
    });
  }

  validateRequiredString(value, "deltaPackId", issues);
  validateRequiredString(value, "sourceDbtlRunId", issues);

  if (!isFiniteNumber(value.iteration) || value.iteration < 0) {
    pushIssue(issues, {
      field: "iteration",
      code: "MISSING_REQUIRED_FIELD",
      message: "iteration must be a non-negative finite number.",
      severity: "error",
    });
  }

  if (!hasNonEmptyStrings(value.sourceExperimentRecordIds)) {
    pushIssue(issues, {
      field: "sourceExperimentRecordIds",
      code: "MISSING_EXPERIMENT_SOURCE",
      message: "sourceExperimentRecordIds must contain at least one experiment record id.",
      severity: "error",
    });
  }

  if (!isStringArray(value.sourceProvenanceIds)) {
    pushIssue(issues, {
      field: "sourceProvenanceIds",
      code: "EMPTY_SOURCE",
      message: "sourceProvenanceIds must be an array of strings.",
      severity: "error",
    });
  } else if (value.sourceProvenanceIds.length === 0) {
    pushIssue(issues, {
      field: "sourceProvenanceIds",
      code: "EMPTY_SOURCE",
      message: "No source provenance ids are attached to this delta pack.",
      severity: "warning",
    });
  }

  if (!hasNonEmptyStrings(value.targetToolIds)) {
    pushIssue(issues, {
      field: "targetToolIds",
      code: "EMPTY_TARGET_TOOLS",
      message: "targetToolIds must contain at least one target tool id.",
      severity: "error",
    });
  }

  validateDeltaMap(value.changedBounds, "changedBounds", issues);
  validateDeltaMap(value.changedPriors, "changedPriors", issues);
  validateDeltaMap(value.changedWeights, "changedWeights", issues);
  validateLearnedMetrics(value.learnedMetrics, issues);

  if (!isClassification(value.classification)) {
    pushIssue(issues, {
      field: "classification",
      code: "MISSING_REQUIRED_FIELD",
      message: "classification must be restorative, conservative, exploratory, or aggressive.",
      severity: "error",
    });
  }

  if (!isHumanGateStatus(value.humanGateStatus)) {
    pushIssue(issues, {
      field: "humanGateStatus",
      code: "MISSING_REQUIRED_FIELD",
      message: "humanGateStatus must be pending, approved, or rejected.",
      severity: "error",
    });
  } else if (value.humanGateStatus !== "approved") {
    pushIssue(issues, {
      field: "humanGateStatus",
      code: "UNAPPROVED_DELTA",
      message: `humanGateStatus is ${value.humanGateStatus}; this delta pack is not applicable.`,
      severity: "warning",
    });
  }

  if (!isNonEmptyString(value.createdAt) || Number.isNaN(Date.parse(value.createdAt))) {
    pushIssue(issues, {
      field: "createdAt",
      code: "INVALID_DATE",
      message: "createdAt must be a valid date string.",
      severity: "error",
    });
  }

  if (value.createdBy !== undefined && typeof value.createdBy !== "string") {
    pushIssue(issues, {
      field: "createdBy",
      code: "MISSING_REQUIRED_FIELD",
      message: "createdBy must be a string when present.",
      severity: "error",
    });
  }
  if (value.notes !== undefined && typeof value.notes !== "string") {
    pushIssue(issues, {
      field: "notes",
      code: "MISSING_REQUIRED_FIELD",
      message: "notes must be a string when present.",
      severity: "error",
    });
  }

  const hasMissingDbtlSource = issues.some((issue) => issue.field === "sourceDbtlRunId" && issue.severity === "error");
  if (hasMissingDbtlSource) {
    for (const issue of issues) {
      if (issue.field === "sourceDbtlRunId") {
        issue.code = "MISSING_DBTL_SOURCE";
        issue.message = "sourceDbtlRunId is required.";
      }
    }
  }

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}

export function isLearnedDeltaPack(value: unknown): value is LearnedDeltaPack {
  return validateLearnedDeltaPack(value).ok;
}
