#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const policyPath = path.join(repoRoot, 'policy', 'trust-policy-v1.json');
const caseDir = path.join(repoRoot, 'benchmarks', 'trust-runtime-cases');

function displayPath(filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  return relativePath.startsWith('..') ? filePath : relativePath;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadBenchmarkCases() {
  return fs.readdirSync(caseDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const fullPath = path.join(caseDir, file);
      const parsed = loadJson(fullPath);
      if (!isRecord(parsed) || !Array.isArray(parsed.cases)) {
        throw new Error(`${displayPath(fullPath)} is not a trust benchmark case file`);
      }
      return parsed.cases;
    });
}

const policyDslValidator = await tsImport(
  '../src/services/policyDslValidator.ts',
  import.meta.url,
);
const policyDslParity = await tsImport(
  '../src/services/policyDslParity.ts',
  import.meta.url,
);

const policy = loadJson(policyPath);
const validation = policyDslValidator.validatePolicyDslDocument(policy);

if (!validation.ok) {
  console.error(`Policy DSL validation failed for ${displayPath(policyPath)}`);
  for (const issue of validation.issues) {
    console.error(`${issue.severity.toUpperCase()} ${issue.field} ${issue.code}: ${issue.message}`);
  }
  process.exit(1);
}

console.log(`Policy DSL validation passed: ${displayPath(policyPath)}`);
console.log(`Rules checked: ${Array.isArray(policy.rules) ? policy.rules.length : 0}`);

const cases = loadBenchmarkCases();
const parityResults = policyDslParity.comparePolicyDslWithRuntimeEngine(cases, policy);
const mismatches = parityResults.filter((result) => !result.matches);

if (mismatches.length > 0) {
  console.error(`Policy DSL/runtime parity mismatches: ${mismatches.length}/${parityResults.length}`);
  for (const mismatch of mismatches.slice(0, 20)) {
    console.error(JSON.stringify(mismatch));
  }
  process.exit(1);
}

console.log(`Policy DSL/runtime parity passed: ${parityResults.length}/${parityResults.length} cases`);
