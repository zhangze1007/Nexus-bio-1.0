/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import {
  isPolicyDslDocument,
  validatePolicyDslDocument,
} from '../src/services/policyDslValidator';

const policyPath = path.resolve(__dirname, '..', 'policy', 'trust-policy-v1.json');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadPolicyRecord(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!isRecord(parsed)) throw new Error('policy fixture must be an object');
  return parsed;
}

function policyRules(policy: Record<string, unknown>): unknown[] {
  if (!Array.isArray(policy.rules)) throw new Error('policy fixture rules must be an array');
  return policy.rules;
}

describe('validatePolicyDslDocument', () => {
  it('accepts the committed policy document', () => {
    const policy = loadPolicyRecord();
    const result = validatePolicyDslDocument(policy);

    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(isPolicyDslDocument(policy)).toBe(true);
  });

  it('rejects a missing schemaVersion', () => {
    const policy = loadPolicyRecord();
    delete policy.schemaVersion;

    const result = validatePolicyDslDocument(policy);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'schemaVersion',
          code: 'MISSING_REQUIRED_FIELD',
          severity: 'error',
        }),
      ]),
    );
  });

  it('rejects duplicate ruleId values', () => {
    const policy = loadPolicyRecord();
    const rules = policyRules(policy);
    const firstRule = rules[0];
    if (!isRecord(firstRule)) throw new Error('first rule must be an object');

    policy.rules = [...rules, { ...firstRule, priority: 999 }];

    const result = validatePolicyDslDocument(policy);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DUPLICATE_RULE_ID',
          severity: 'error',
        }),
      ]),
    );
  });

  it('rejects invalid condition operators', () => {
    const policy = loadPolicyRecord();
    const rules = policyRules(policy);
    const firstRule = rules[0];
    if (!isRecord(firstRule) || !Array.isArray(firstRule.when) || !isRecord(firstRule.when[0])) {
      throw new Error('first rule condition must be an object');
    }

    firstRule.when[0] = {
      ...firstRule.when[0],
      operator: 'contains',
    };

    const result = validatePolicyDslDocument(policy);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_OPERATOR',
          severity: 'error',
        }),
      ]),
    );
  });

  it('rejects block and gate rules without blockCode', () => {
    const policy = loadPolicyRecord();
    const rules = policyRules(policy);
    const firstRule = rules[0];
    if (!isRecord(firstRule)) throw new Error('first rule must be an object');

    delete firstRule.blockCode;

    const result = validatePolicyDslDocument(policy);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_BLOCK_CODE',
          severity: 'error',
        }),
      ]),
    );
  });

  it('rejects rules without reasons', () => {
    const policy = loadPolicyRecord();
    const rules = policyRules(policy);
    const firstRule = rules[0];
    if (!isRecord(firstRule)) throw new Error('first rule must be an object');

    firstRule.reason = '';

    const result = validatePolicyDslDocument(policy);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_REASON',
          severity: 'error',
        }),
      ]),
    );
  });
});
