import { CLAIM_SURFACE_BLOCK_CODES } from "../domain/claimSurfacePolicy";
import {
  POLICY_DSL_CONDITION_FIELDS,
  POLICY_DSL_EFFECTS,
  POLICY_DSL_OPERATORS,
  POLICY_DSL_SCHEMA_VERSION,
  type PolicyDslDocument,
  type PolicyDslEffect,
  type PolicyDslOperator,
} from "../types/policyDsl";

export interface PolicyDslValidationIssue {
  field: string;
  code:
    | "MISSING_REQUIRED_FIELD"
    | "INVALID_SCHEMA_VERSION"
    | "INVALID_EFFECT"
    | "INVALID_OPERATOR"
    | "INVALID_FIELD"
    | "DUPLICATE_RULE_ID"
    | "INVALID_PRIORITY"
    | "MISSING_REASON"
    | "MISSING_BLOCK_CODE";
  message: string;
  severity: "error" | "warning";
}

export interface PolicyDslValidationResult {
  ok: boolean;
  issues: PolicyDslValidationIssue[];
}

const OVERRIDE_PATHS = ["human-review", "not-allowed"] as const;
const VALUE_OPERATORS: readonly PolicyDslOperator[] = ["equals", "notEquals", "in", "notIn"];
const SET_OPERATORS: readonly PolicyDslOperator[] = ["in", "notIn"];
const BLOCKING_EFFECTS: readonly PolicyDslEffect[] = ["block", "gate"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPolicyDslEffect(value: unknown): value is PolicyDslEffect {
  return typeof value === "string" && (POLICY_DSL_EFFECTS as readonly string[]).includes(value);
}

function isPolicyDslOperator(value: unknown): value is PolicyDslOperator {
  return typeof value === "string" && (POLICY_DSL_OPERATORS as readonly string[]).includes(value);
}

function pushIssue(
  issues: PolicyDslValidationIssue[],
  field: string,
  code: PolicyDslValidationIssue["code"],
  message: string,
  severity: PolicyDslValidationIssue["severity"] = "error",
): void {
  issues.push({ field, code, message, severity });
}

function validateConditionValue(
  condition: Record<string, unknown>,
  fieldPath: string,
  operator: PolicyDslOperator,
  issues: PolicyDslValidationIssue[],
): void {
  const hasValue = Object.hasOwn(condition, "value");
  const value = condition.value;

  if (VALUE_OPERATORS.includes(operator) && !hasValue) {
    pushIssue(
      issues,
      `${fieldPath}.value`,
      "MISSING_REQUIRED_FIELD",
      `${fieldPath}.value is required for ${operator}.`,
    );
    return;
  }

  if (!VALUE_OPERATORS.includes(operator)) return;

  if (SET_OPERATORS.includes(operator)) {
    if (!isStringArray(value) || value.length === 0) {
      pushIssue(
        issues,
        `${fieldPath}.value`,
        "INVALID_FIELD",
        `${fieldPath}.value must be a non-empty string array for ${operator}.`,
      );
    }
    return;
  }

  if (typeof value !== "string" && typeof value !== "boolean") {
    pushIssue(
      issues,
      `${fieldPath}.value`,
      "INVALID_FIELD",
      `${fieldPath}.value must be a string or boolean for ${operator}.`,
    );
  }
}

function validateCondition(value: unknown, fieldPath: string, issues: PolicyDslValidationIssue[]): void {
  if (!isRecord(value)) {
    pushIssue(issues, fieldPath, "MISSING_REQUIRED_FIELD", `${fieldPath} must be an object.`);
    return;
  }

  if (typeof value.field !== "string" || !(POLICY_DSL_CONDITION_FIELDS as readonly string[]).includes(value.field)) {
    pushIssue(
      issues,
      `${fieldPath}.field`,
      "INVALID_FIELD",
      `${fieldPath}.field must be a supported Policy DSL condition field.`,
    );
  }

  if (!isPolicyDslOperator(value.operator)) {
    pushIssue(
      issues,
      `${fieldPath}.operator`,
      "INVALID_OPERATOR",
      `${fieldPath}.operator must be a supported Policy DSL operator.`,
    );
    return;
  }

  validateConditionValue(value, fieldPath, value.operator, issues);
}

function validateRule(
  value: unknown,
  index: number,
  seenRuleIds: Set<string>,
  issues: PolicyDslValidationIssue[],
): void {
  const fieldPath = `rules.${index}`;
  if (!isRecord(value)) {
    pushIssue(issues, fieldPath, "MISSING_REQUIRED_FIELD", `${fieldPath} must be an object.`);
    return;
  }

  if (!isNonEmptyString(value.ruleId)) {
    pushIssue(issues, `${fieldPath}.ruleId`, "MISSING_REQUIRED_FIELD", "ruleId is required.");
  } else if (seenRuleIds.has(value.ruleId)) {
    pushIssue(issues, `${fieldPath}.ruleId`, "DUPLICATE_RULE_ID", `Duplicate ruleId '${value.ruleId}'.`);
  } else {
    seenRuleIds.add(value.ruleId);
  }

  if (!isNonEmptyString(value.description)) {
    pushIssue(issues, `${fieldPath}.description`, "MISSING_REQUIRED_FIELD", "description is required.");
  }

  if (typeof value.priority !== "number" || !Number.isFinite(value.priority) || !Number.isInteger(value.priority)) {
    pushIssue(issues, `${fieldPath}.priority`, "INVALID_PRIORITY", "priority must be a finite integer.");
  }

  if (!Array.isArray(value.when) || value.when.length === 0) {
    pushIssue(issues, `${fieldPath}.when`, "MISSING_REQUIRED_FIELD", "when must be a non-empty array.");
  } else {
    value.when.forEach((condition, conditionIndex) => {
      validateCondition(condition, `${fieldPath}.when.${conditionIndex}`, issues);
    });
  }

  if (!isPolicyDslEffect(value.effect)) {
    pushIssue(issues, `${fieldPath}.effect`, "INVALID_EFFECT", "effect must be a supported Policy DSL effect.");
  }

  if (!isNonEmptyString(value.reason)) {
    pushIssue(issues, `${fieldPath}.reason`, "MISSING_REASON", "reason is required.");
  }

  if (
    isPolicyDslEffect(value.effect) &&
    BLOCKING_EFFECTS.includes(value.effect) &&
    (!isNonEmptyString(value.blockCode) || !(CLAIM_SURFACE_BLOCK_CODES as readonly string[]).includes(value.blockCode))
  ) {
    pushIssue(
      issues,
      `${fieldPath}.blockCode`,
      "MISSING_BLOCK_CODE",
      "block and gate rules must carry an existing claim-surface blockCode.",
    );
  }

  if (
    value.overridePath !== undefined &&
    (typeof value.overridePath !== "string" || !(OVERRIDE_PATHS as readonly string[]).includes(value.overridePath))
  ) {
    pushIssue(
      issues,
      `${fieldPath}.overridePath`,
      "INVALID_FIELD",
      "overridePath must be human-review or not-allowed when present.",
    );
  }
}

function validateDefaultDecision(value: unknown, issues: PolicyDslValidationIssue[]): void {
  if (!isRecord(value)) {
    pushIssue(issues, "defaultDecision", "MISSING_REQUIRED_FIELD", "defaultDecision must be an object.");
    return;
  }

  if (value.effect !== "block") {
    pushIssue(issues, "defaultDecision.effect", "INVALID_EFFECT", "defaultDecision.effect must be block.");
  }

  if (
    !isNonEmptyString(value.blockCode) ||
    !(CLAIM_SURFACE_BLOCK_CODES as readonly string[]).includes(value.blockCode)
  ) {
    pushIssue(
      issues,
      "defaultDecision.blockCode",
      "MISSING_BLOCK_CODE",
      "defaultDecision.blockCode must be an existing claim-surface blockCode.",
    );
  }

  if (!isNonEmptyString(value.reason)) {
    pushIssue(issues, "defaultDecision.reason", "MISSING_REASON", "defaultDecision.reason is required.");
  }
}

export function validatePolicyDslDocument(value: unknown): PolicyDslValidationResult {
  const issues: PolicyDslValidationIssue[] = [];

  if (!isRecord(value)) {
    pushIssue(issues, "$", "MISSING_REQUIRED_FIELD", "Policy DSL document must be an object.");
    return { ok: false, issues };
  }

  if (value.schemaVersion === undefined) {
    pushIssue(issues, "schemaVersion", "MISSING_REQUIRED_FIELD", "schemaVersion is required.");
  } else if (value.schemaVersion !== POLICY_DSL_SCHEMA_VERSION) {
    pushIssue(issues, "schemaVersion", "INVALID_SCHEMA_VERSION", `schemaVersion must be ${POLICY_DSL_SCHEMA_VERSION}.`);
  }

  if (!isNonEmptyString(value.policyId)) {
    pushIssue(issues, "policyId", "MISSING_REQUIRED_FIELD", "policyId is required.");
  }

  if (!isNonEmptyString(value.description)) {
    pushIssue(issues, "description", "MISSING_REQUIRED_FIELD", "description is required.");
  }

  if (!Array.isArray(value.rules)) {
    pushIssue(issues, "rules", "MISSING_REQUIRED_FIELD", "rules must be an array.");
  } else {
    const seenRuleIds = new Set<string>();
    value.rules.forEach((rule, index) => validateRule(rule, index, seenRuleIds, issues));
  }

  validateDefaultDecision(value.defaultDecision, issues);

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
}

export function isPolicyDslDocument(value: unknown): value is PolicyDslDocument {
  return validatePolicyDslDocument(value).ok;
}
