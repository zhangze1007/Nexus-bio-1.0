import { ASSAY_TYPES, type AssayType } from "../types/experimentRecord";
import { PREDICTION_METHODS, type PredictionMethod, type PredictionRecordV1 } from "../types/predictionRecord";

export type PredictionValidationCode =
  | "schema-version"
  | "missing-construct"
  | "missing-unit"
  | "empty-timepoints"
  | "interval-inverted" // lower > upper
  | "interval-missing-level"
  | "non-finite-value";

export interface PredictionValidationIssue {
  code: PredictionValidationCode;
  severity: "error" | "warning";
  message: string;
  path?: string;
}
export interface PredictionValidationResult {
  ok: boolean;
  issues: PredictionValidationIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isAssayType(value: unknown): value is AssayType {
  return typeof value === "string" && (ASSAY_TYPES as readonly string[]).includes(value);
}
function isPredictionMethod(value: unknown): value is PredictionMethod {
  return typeof value === "string" && (PREDICTION_METHODS as readonly string[]).includes(value);
}
function push(
  issues: PredictionValidationIssue[],
  code: PredictionValidationCode,
  severity: "error" | "warning",
  message: string,
  path?: string,
): void {
  issues.push({ code, severity, message, ...(path ? { path } : {}) });
}

export function validatePredictionRecordV1(value: unknown): PredictionValidationResult {
  const issues: PredictionValidationIssue[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [
        { code: "schema-version", severity: "error", message: "Prediction record must be an object.", path: "$" },
      ],
    };
  }

  if (value.schemaVersion !== "prediction-record-v1") {
    push(issues, "schema-version", "error", "schemaVersion must be prediction-record-v1.", "schemaVersion");
  }

  if (!isNonEmptyString(value.constructId)) {
    push(issues, "missing-construct", "error", "constructId is required and must be non-empty.", "constructId");
  }

  if (!isNonEmptyString(value.measurementUnit)) {
    push(issues, "missing-unit", "error", "measurementUnit is required and must be non-empty.", "measurementUnit");
  }

  if (!isAssayType(value.assayType)) {
    push(issues, "schema-version", "error", "assayType must be a supported assay type.", "assayType");
  }
  if (!isPredictionMethod(value.method)) {
    push(issues, "schema-version", "error", "method must be a supported prediction method.", "method");
  }
  for (const field of ["predictionId", "sourceToolId", "sourceRunId", "modelVersion"] as const) {
    if (!isNonEmptyString(value[field])) {
      push(issues, "schema-version", "error", `${field} is required and must be non-empty.`, field);
    }
  }

  if (!Array.isArray(value.timepoints) || value.timepoints.length === 0) {
    push(issues, "empty-timepoints", "error", "timepoints must be a non-empty array.", "timepoints");
  } else {
    for (const [index, tp] of value.timepoints.entries()) {
      const p = `timepoints[${index}]`;
      if (!isRecord(tp)) {
        push(issues, "non-finite-value", "error", "Timepoint must be an object.", p);
        continue;
      }
      if (!isFiniteNumber(tp.timeHours)) {
        push(issues, "non-finite-value", "error", "timeHours must be a finite number.", `${p}.timeHours`);
      }
      if (!isFiniteNumber(tp.value)) {
        push(issues, "non-finite-value", "error", "value must be a finite number.", `${p}.value`);
      }
      if (!isNonEmptyString(tp.unit)) {
        push(issues, "missing-unit", "error", "Each timepoint requires a measurement unit.", `${p}.unit`);
      }
      const hasLower = tp.lower !== undefined;
      const hasUpper = tp.upper !== undefined;
      if (hasLower && !isFiniteNumber(tp.lower)) {
        push(issues, "non-finite-value", "error", "lower must be a finite number when present.", `${p}.lower`);
      }
      if (hasUpper && !isFiniteNumber(tp.upper)) {
        push(issues, "non-finite-value", "error", "upper must be a finite number when present.", `${p}.upper`);
      }
      if (isFiniteNumber(tp.lower) && isFiniteNumber(tp.upper) && tp.lower > tp.upper) {
        push(issues, "interval-inverted", "error", "Interval lower bound exceeds upper bound.", p);
      }
      if ((hasLower || hasUpper) && !isFiniteNumber(tp.intervalLevel)) {
        push(issues, "interval-missing-level", "warning", "Interval present but intervalLevel is missing.", p);
      }
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

export function isPredictionRecordV1(value: unknown): value is PredictionRecordV1 {
  return validatePredictionRecordV1(value).ok;
}
