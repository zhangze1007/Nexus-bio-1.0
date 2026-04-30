import type {
  GateOverridePath,
} from '../protocol/nexusTrustRuntime';

export const POLICY_DSL_SCHEMA_VERSION = 'policy-dsl-v1' as const;

export type PolicyDslVersion = typeof POLICY_DSL_SCHEMA_VERSION;

export const POLICY_DSL_EFFECTS = [
  'allow',
  'block',
  'gate',
  'demoOnly',
] as const;

export type PolicyDslEffect = (typeof POLICY_DSL_EFFECTS)[number];

export const POLICY_DSL_OPERATORS = [
  'equals',
  'notEquals',
  'in',
  'notIn',
  'exists',
  'empty',
  'notEmpty',
] as const;

export type PolicyDslOperator = (typeof POLICY_DSL_OPERATORS)[number];

export const POLICY_DSL_CONDITION_FIELDS = [
  'toolId',
  'surface',
  'validityTier',
  'isDraft',
  'provenanceIds',
  'evidenceIds',
  'assumptionIds',
  'requiresHumanGate',
  'humanGateStatus',
] as const;

export type PolicyDslConditionField = (typeof POLICY_DSL_CONDITION_FIELDS)[number];

export type PolicyDslConditionValue = string | boolean | string[];

export interface PolicyDslCondition {
  field: PolicyDslConditionField;
  operator: PolicyDslOperator;
  value?: PolicyDslConditionValue;
}

export interface PolicyDslRule {
  ruleId: string;
  description: string;
  priority: number;
  when: PolicyDslCondition[];
  effect: PolicyDslEffect;
  blockCode?: string;
  reason: string;
  overridePath?: GateOverridePath;
}

export interface PolicyDslDocument {
  schemaVersion: PolicyDslVersion;
  policyId: string;
  description: string;
  rules: PolicyDslRule[];
  defaultDecision: {
    effect: 'block';
    blockCode: 'MISSING_POLICY' | string;
    reason: string;
  };
}
