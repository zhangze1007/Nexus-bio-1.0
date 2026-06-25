import {
  ASSAY_TYPES,
  type AssayType,
  EXPERIMENT_RECORD_QC_FLAGS,
  EXPERIMENT_RECORD_SOURCE_TYPES,
  type ExperimentRecordQcFlag,
  type ExperimentRecordSourceType,
  type ExperimentRecordV1,
} from "../types/experimentRecord";

export type ExperimentRecordValidationCode =
  | "MISSING_REQUIRED_FIELD"
  | "EMPTY_STRING"
  | "INVALID_TIMEPOINT"
  | "MISSING_UNIT"
  | "UNIT_MISMATCH"
  | "INVALID_DATE"
  | "NO_TIMEPOINTS"
  | "QC_REVIEW_REQUIRED";

export interface ExperimentRecordValidationIssue {
  field: string;
  code: ExperimentRecordValidationCode;
  message: string;
  severity: "error" | "warning";
}

export interface ExperimentRecordValidationResult {
  ok: boolean;
  issues: ExperimentRecordValidationIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAssayType(value: unknown): value is AssayType {
  return typeof value === "string" && (ASSAY_TYPES as readonly string[]).includes(value);
}

function isSourceType(value: unknown): value is ExperimentRecordSourceType {
  return typeof value === "string" && (EXPERIMENT_RECORD_SOURCE_TYPES as readonly string[]).includes(value);
}

function isQcFlag(value: unknown): value is ExperimentRecordQcFlag {
  return typeof value === "string" && (EXPERIMENT_RECORD_QC_FLAGS as readonly string[]).includes(value);
}

function parseDate(value: string): number {
  return Date.parse(value);
}

function pushIssue(issues: ExperimentRecordValidationIssue[], issue: ExperimentRecordValidationIssue): void {
  issues.push(issue);
}

function validateRequiredString(
  record: Record<string, unknown>,
  field: string,
  issues: ExperimentRecordValidationIssue[],
): void {
  if (!(field in record)) {
    pushIssue(issues, {
      field,
      code: "MISSING_REQUIRED_FIELD",
      message: `${field} is required.`,
      severity: "error",
    });
    return;
  }
  if (typeof record[field] !== "string") {
    pushIssue(issues, {
      field,
      code: "MISSING_REQUIRED_FIELD",
      message: `${field} must be a string.`,
      severity: "error",
    });
    return;
  }
  if (!isNonEmptyString(record[field])) {
    pushIssue(issues, {
      field,
      code: "EMPTY_STRING",
      message: `${field} must not be empty.`,
      severity: "error",
    });
  }
}

function validateQcFlags(value: unknown, field: string, issues: ExperimentRecordValidationIssue[]): void {
  if (!Array.isArray(value)) {
    pushIssue(issues, {
      field,
      code: "MISSING_REQUIRED_FIELD",
      message: `${field} must be an array of QC flags.`,
      severity: "error",
    });
    return;
  }

  for (const [index, flag] of value.entries()) {
    if (!isQcFlag(flag)) {
      pushIssue(issues, {
        field: `${field}[${index}]`,
        code: "MISSING_REQUIRED_FIELD",
        message: `${field}[${index}] is not a known QC flag.`,
        severity: "error",
      });
      continue;
    }
    if (flag === "manual-review-required") {
      pushIssue(issues, {
        field,
        code: "QC_REVIEW_REQUIRED",
        message: `${field} includes manual-review-required.`,
        severity: "warning",
      });
    }
  }
}

export function validateExperimentRecordV1(record: unknown): ExperimentRecordValidationResult {
  const issues: ExperimentRecordValidationIssue[] = [];
  if (!isRecord(record)) {
    return {
      ok: false,
      issues: [
        {
          field: "$",
          code: "MISSING_REQUIRED_FIELD",
          message: "Experiment record must be an object.",
          severity: "error",
        },
      ],
    };
  }

  if (record.schemaVersion !== "experiment-record-v1") {
    pushIssue(issues, {
      field: "schemaVersion",
      code: "MISSING_REQUIRED_FIELD",
      message: "schemaVersion must be experiment-record-v1.",
      severity: "error",
    });
  }

  for (const field of [
    "recordId",
    "batchId",
    "sampleId",
    "constructId",
    "measurementUnit",
    "instrument",
    "operator",
    "startedAt",
  ]) {
    validateRequiredString(record, field, issues);
  }

  if (!isAssayType(record.assayType)) {
    pushIssue(issues, {
      field: "assayType",
      code: "MISSING_REQUIRED_FIELD",
      message: "assayType must be a supported assay type.",
      severity: "error",
    });
  }

  if (!isSourceType(record.sourceType)) {
    pushIssue(issues, {
      field: "sourceType",
      code: "MISSING_REQUIRED_FIELD",
      message: "sourceType must be a supported experiment source type.",
      severity: "error",
    });
  }

  if (isNonEmptyString(record.startedAt) && Number.isNaN(parseDate(record.startedAt))) {
    pushIssue(issues, {
      field: "startedAt",
      code: "INVALID_DATE",
      message: "startedAt must be a valid date string.",
      severity: "error",
    });
  }

  if (record.completedAt !== undefined) {
    if (!isNonEmptyString(record.completedAt) || Number.isNaN(parseDate(record.completedAt))) {
      pushIssue(issues, {
        field: "completedAt",
        code: "INVALID_DATE",
        message: "completedAt must be a valid date string when present.",
        severity: "error",
      });
    } else if (isNonEmptyString(record.startedAt) && !Number.isNaN(parseDate(record.startedAt))) {
      if (parseDate(record.completedAt) < parseDate(record.startedAt)) {
        pushIssue(issues, {
          field: "completedAt",
          code: "INVALID_DATE",
          message: "completedAt occurs before startedAt.",
          severity: "warning",
        });
      }
    }
  }

  validateQcFlags(record.qcFlags, "qcFlags", issues);

  if (record.provenanceIds !== undefined && !isStringArray(record.provenanceIds)) {
    pushIssue(issues, {
      field: "provenanceIds",
      code: "MISSING_REQUIRED_FIELD",
      message: "provenanceIds must be an array of strings when present.",
      severity: "error",
    });
  }

  if (!Array.isArray(record.timepoints)) {
    pushIssue(issues, {
      field: "timepoints",
      code: "NO_TIMEPOINTS",
      message: "timepoints must be a non-empty array.",
      severity: "error",
    });
  } else if (record.timepoints.length === 0) {
    pushIssue(issues, {
      field: "timepoints",
      code: "NO_TIMEPOINTS",
      message: "At least one timepoint is required.",
      severity: "error",
    });
  } else {
    for (const [index, timepoint] of record.timepoints.entries()) {
      const prefix = `timepoints[${index}]`;
      if (!isRecord(timepoint)) {
        pushIssue(issues, {
          field: prefix,
          code: "INVALID_TIMEPOINT",
          message: "Timepoint must be an object.",
          severity: "error",
        });
        continue;
      }
      if (typeof timepoint.timeHours !== "number" || !Number.isFinite(timepoint.timeHours)) {
        pushIssue(issues, {
          field: `${prefix}.timeHours`,
          code: "INVALID_TIMEPOINT",
          message: "timeHours must be a finite number.",
          severity: "error",
        });
      } else if (timepoint.timeHours < 0) {
        pushIssue(issues, {
          field: `${prefix}.timeHours`,
          code: "INVALID_TIMEPOINT",
          message: "timeHours must be non-negative.",
          severity: "error",
        });
      }

      if (typeof timepoint.value !== "number" || !Number.isFinite(timepoint.value)) {
        pushIssue(issues, {
          field: `${prefix}.value`,
          code: "INVALID_TIMEPOINT",
          message: "value must be a finite number.",
          severity: "error",
        });
      }

      if (!isNonEmptyString(timepoint.unit)) {
        pushIssue(issues, {
          field: `${prefix}.unit`,
          code: "MISSING_UNIT",
          message: "Each timepoint requires a measurement unit.",
          severity: "error",
        });
      } else if (isNonEmptyString(record.measurementUnit) && timepoint.unit !== record.measurementUnit) {
        pushIssue(issues, {
          field: `${prefix}.unit`,
          code: "UNIT_MISMATCH",
          message: "Timepoint unit must match measurementUnit.",
          severity: "error",
        });
      }

      if (timepoint.qcFlags !== undefined) {
        validateQcFlags(timepoint.qcFlags, `${prefix}.qcFlags`, issues);
      }

      if (timepoint.replicateId !== undefined && typeof timepoint.replicateId !== "string") {
        pushIssue(issues, {
          field: `${prefix}.replicateId`,
          code: "INVALID_TIMEPOINT",
          message: "replicateId must be a string when present.",
          severity: "error",
        });
      }
    }
  }

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}

export function isExperimentRecordV1(record: unknown): record is ExperimentRecordV1 {
  return validateExperimentRecordV1(record).ok;
}
