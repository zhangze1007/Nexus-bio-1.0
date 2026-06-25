import type { ClaimSurface, GateDecision, GateStatus, ValidityTier } from "../protocol/nexusTrustRuntime";
import type {
  PolicyDslCondition,
  PolicyDslConditionField,
  PolicyDslDocument,
  PolicyDslEffect,
  PolicyDslRule,
} from "../types/policyDsl";
import { validatePolicyDslDocument } from "./policyDslValidator";

export interface PolicyDslEvaluationInput {
  toolId: string;
  surface: ClaimSurface;
  validityTier?: ValidityTier;
  isDraft?: boolean;
  provenanceIds?: string[];
  evidenceIds?: string[];
  assumptionIds?: string[];
  requiresHumanGate?: boolean;
  humanGateStatus?: "not-required" | "pending" | "approved" | "rejected";
}

function statusFromEffect(effect: PolicyDslEffect): GateStatus {
  if (effect === "allow") return "ok";
  if (effect === "block") return "blocked";
  if (effect === "gate") return "gated";
  return "demoOnly";
}

function decisionForStatus(args: {
  status: GateStatus;
  surface: ClaimSurface;
  reason: string;
  blockCode?: string;
  overridePath?: "human-review" | "not-allowed";
}): GateDecision {
  const allowed = args.status === "ok" || args.status === "demoOnly";

  return {
    status: args.status,
    ...(args.blockCode ? { blockCode: args.blockCode } : {}),
    reason: args.reason,
    allowedSurfaces: allowed ? [args.surface] : [],
    blockedSurfaces: allowed ? [] : [args.surface],
    ...(args.overridePath ? { overridePath: args.overridePath } : {}),
  };
}

function invalidPolicyDecision(input: PolicyDslEvaluationInput, validationSummary: string): GateDecision {
  return decisionForStatus({
    status: "blocked",
    surface: input.surface,
    blockCode: "MISSING_POLICY",
    reason: `Policy DSL document is invalid: ${validationSummary}`,
    overridePath: "not-allowed",
  });
}

function fieldValue(input: PolicyDslEvaluationInput, field: PolicyDslConditionField): unknown {
  switch (field) {
    case "toolId":
      return input.toolId;
    case "surface":
      return input.surface;
    case "validityTier":
      return input.validityTier;
    case "isDraft":
      return input.isDraft;
    case "provenanceIds":
      return input.provenanceIds;
    case "evidenceIds":
      return input.evidenceIds;
    case "assumptionIds":
      return input.assumptionIds;
    case "requiresHumanGate":
      return input.requiresHumanGate;
    case "humanGateStatus":
      return input.humanGateStatus;
  }
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function valueAsStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function conditionMatches(condition: PolicyDslCondition, input: PolicyDslEvaluationInput): boolean {
  const candidate = fieldValue(input, condition.field);

  switch (condition.operator) {
    case "equals":
      return candidate === condition.value;
    case "notEquals":
      return candidate !== condition.value;
    case "in":
      return (
        (typeof candidate === "string" || typeof candidate === "boolean") &&
        valueAsStringArray(condition.value).includes(String(candidate))
      );
    case "notIn":
      return !(
        (typeof candidate === "string" || typeof candidate === "boolean") &&
        valueAsStringArray(condition.value).includes(String(candidate))
      );
    case "exists":
      return candidate !== undefined && candidate !== null;
    case "empty":
      return isEmptyValue(candidate);
    case "notEmpty":
      return !isEmptyValue(candidate);
  }
}

function ruleMatches(rule: PolicyDslRule, input: PolicyDslEvaluationInput): boolean {
  return rule.when.every((condition) => conditionMatches(condition, input));
}

function sortedRules(document: PolicyDslDocument): PolicyDslRule[] {
  return document.rules
    .map((rule, index) => ({ rule, index }))
    .sort((left, right) => left.rule.priority - right.rule.priority || left.index - right.index)
    .map(({ rule }) => rule);
}

function decisionForRule(rule: PolicyDslRule, input: PolicyDslEvaluationInput): GateDecision {
  return decisionForStatus({
    status: statusFromEffect(rule.effect),
    surface: input.surface,
    reason: rule.reason,
    ...(rule.blockCode ? { blockCode: rule.blockCode } : {}),
    ...(rule.overridePath ? { overridePath: rule.overridePath } : {}),
  });
}

function defaultDecision(document: PolicyDslDocument, input: PolicyDslEvaluationInput): GateDecision {
  return decisionForStatus({
    status: "blocked",
    surface: input.surface,
    blockCode: document.defaultDecision.blockCode,
    reason: document.defaultDecision.reason,
  });
}

export function evaluatePolicyDsl(policy: unknown, input: PolicyDslEvaluationInput): GateDecision {
  const validation = validatePolicyDslDocument(policy);

  if (!validation.ok) {
    const summary = validation.issues
      .filter((issue) => issue.severity === "error")
      .slice(0, 3)
      .map((issue) => `${issue.field}:${issue.code}`)
      .join(", ");
    return invalidPolicyDecision(input, summary || "unknown validation failure");
  }

  const document = policy as PolicyDslDocument;
  const match = sortedRules(document).find((rule) => ruleMatches(rule, input));
  return match ? decisionForRule(match, input) : defaultDecision(document, input);
}
