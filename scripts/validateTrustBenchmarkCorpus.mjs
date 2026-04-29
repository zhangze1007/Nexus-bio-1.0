#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const caseDir = path.join(repoRoot, 'benchmarks', 'trust-runtime-cases');
const labelsPath = path.join(repoRoot, 'benchmarks', 'expected_labels.csv');

export const CATEGORIES = [
  'truthful-partial',
  'unsafe-demo',
  'missing-evidence',
  'uncertainty-unresolved',
  'human-gate-required',
  'known-bad-case',
  'draft-output',
];

export const REQUIRED_CATEGORY_MINIMUMS = {
  'truthful-partial': 8,
  'unsafe-demo': 8,
  'missing-evidence': 8,
  'uncertainty-unresolved': 8,
  'human-gate-required': 6,
  'known-bad-case': 6,
  'draft-output': 6,
};

export const SURFACES = [
  'payload',
  'export',
  'recommendation',
  'protocol',
  'external-handoff',
];

export const STATUSES = ['ok', 'blocked', 'gated', 'demoOnly'];

export const TOOL_IDS = [
  'pathd',
  'metabolic-eng',
  'fbasim',
  'cethx',
  'catdes',
  'proevol',
  'dyncon',
  'gecair',
  'genmim',
  'cellfree',
  'dbtlflow',
  'multio',
  'scspatial',
  'nexai',
];

export const BLOCK_CODES = [
  'MISSING_POLICY',
  'TIER_NOT_ALLOWED_FOR_SURFACE',
  'PROVENANCE_REQUIRED',
  'HUMAN_GATE_REQUIRED',
  'DRAFT_OUTPUT_NOT_EXPORTABLE',
  'DEMO_OUTPUT_PROTOCOL_BLOCKED',
  'EXTERNAL_HANDOFF_BLOCKED',
];

export const REQUIRED_KNOWN_BAD_TAGS = [
  'community-fba-fake-exchange',
  'cethx-fake-dg-real-feasibility',
  'stringly-dbtl-loopback',
  'draft-dbtl-protocol-export',
  'demo-multio-external-handoff',
  'missing-provenance-export',
  'demo-cellfree-protocol-artifact',
  'nexai-missing-evidence-recommendation',
];

const CASE_KEYS = [
  'caseId',
  'title',
  'category',
  'toolId',
  'surface',
  'claim',
  'input',
  'expected',
  'riskTags',
  'knownBad',
];

const INPUT_KEYS = [
  'validityTier',
  'hasProvenance',
  'evidenceState',
  'uncertaintyState',
  'isDraft',
  'humanGateRequired',
  'humanGateSatisfied',
  'notes',
];

const EXPECTED_KEYS = ['status', 'blockCode', 'rationale'];
const CSV_HEADER = 'caseId,expectedStatus,expectedBlockCode,category,toolId,surface,knownBad';

function hasOnlyKeys(value, allowedKeys, context, errors) {
  const keys = Object.keys(value).sort();
  const expected = [...allowedKeys].sort();
  const unexpected = keys.filter((key) => !expected.includes(key));
  const missing = expected.filter((key) => !keys.includes(key));
  for (const key of unexpected) errors.push(`${context}: unexpected field '${key}'`);
  for (const key of missing) errors.push(`${context}: missing required field '${key}'`);
}

function countBy(items, pick) {
  const counts = {};
  for (const item of items) {
    const key = pick(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function parseCaseFile(filePath, errors) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${path.relative(repoRoot, filePath)}: invalid JSON (${error.message})`);
    return [];
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push(`${path.relative(repoRoot, filePath)}: root must be an object`);
    return [];
  }

  hasOnlyKeys(data, ['$schema', 'cases'], path.relative(repoRoot, filePath), errors);
  if (typeof data.$schema !== 'string') {
    errors.push(`${path.relative(repoRoot, filePath)}: $schema must be a string`);
  }
  if (!Array.isArray(data.cases)) {
    errors.push(`${path.relative(repoRoot, filePath)}: cases must be an array`);
    return [];
  }

  return data.cases;
}

function validateCase(testCase, errors) {
  const context = typeof testCase?.caseId === 'string' ? testCase.caseId : 'case-without-id';
  if (!testCase || typeof testCase !== 'object' || Array.isArray(testCase)) {
    errors.push(`${context}: case must be an object`);
    return;
  }

  hasOnlyKeys(testCase, CASE_KEYS, context, errors);

  if (typeof testCase.caseId !== 'string' || !/^TRB-[0-9]{3}$/.test(testCase.caseId)) {
    errors.push(`${context}: caseId must match TRB-###`);
  }
  if (typeof testCase.title !== 'string' || testCase.title.length < 8) {
    errors.push(`${context}: title must be a descriptive string`);
  }
  if (!CATEGORIES.includes(testCase.category)) {
    errors.push(`${context}: category '${testCase.category}' is not allowed`);
  }
  if (!TOOL_IDS.includes(testCase.toolId)) {
    errors.push(`${context}: toolId '${testCase.toolId}' is not allowed`);
  }
  if (!SURFACES.includes(testCase.surface)) {
    errors.push(`${context}: surface '${testCase.surface}' is not allowed`);
  }
  if (typeof testCase.claim !== 'string' || testCase.claim.length < 12) {
    errors.push(`${context}: claim must be a descriptive string`);
  }
  if (typeof testCase.knownBad !== 'boolean') {
    errors.push(`${context}: knownBad must be boolean`);
  }
  if (!Array.isArray(testCase.riskTags) || testCase.riskTags.length === 0) {
    errors.push(`${context}: riskTags must be a non-empty array`);
  } else {
    const seenTags = new Set();
    for (const tag of testCase.riskTags) {
      if (typeof tag !== 'string' || !/^[a-z0-9-]+$/.test(tag)) {
        errors.push(`${context}: riskTag '${tag}' is not kebab-case`);
      }
      if (seenTags.has(tag)) {
        errors.push(`${context}: duplicate riskTag '${tag}'`);
      }
      seenTags.add(tag);
    }
  }

  if (!testCase.input || typeof testCase.input !== 'object' || Array.isArray(testCase.input)) {
    errors.push(`${context}: input must be an object`);
  } else {
    hasOnlyKeys(testCase.input, INPUT_KEYS, `${context}.input`, errors);
    if (!['real', 'partial', 'demo'].includes(testCase.input.validityTier)) {
      errors.push(`${context}: input.validityTier is not allowed`);
    }
    for (const key of ['hasProvenance', 'isDraft', 'humanGateRequired', 'humanGateSatisfied']) {
      if (typeof testCase.input[key] !== 'boolean') {
        errors.push(`${context}: input.${key} must be boolean`);
      }
    }
    if (!['present', 'missing', 'not-required'].includes(testCase.input.evidenceState)) {
      errors.push(`${context}: input.evidenceState is not allowed`);
    }
    if (!['bounded', 'unresolved', 'not-applicable'].includes(testCase.input.uncertaintyState)) {
      errors.push(`${context}: input.uncertaintyState is not allowed`);
    }
    if (typeof testCase.input.notes !== 'string' || testCase.input.notes.length < 8) {
      errors.push(`${context}: input.notes must be descriptive`);
    }
  }

  if (!testCase.expected || typeof testCase.expected !== 'object' || Array.isArray(testCase.expected)) {
    errors.push(`${context}: expected must be an object`);
  } else {
    hasOnlyKeys(testCase.expected, EXPECTED_KEYS, `${context}.expected`, errors);
    if (!STATUSES.includes(testCase.expected.status)) {
      errors.push(`${context}: expected.status is not allowed`);
    }
    if (testCase.expected.blockCode !== null && !BLOCK_CODES.includes(testCase.expected.blockCode)) {
      errors.push(`${context}: expected.blockCode is not allowed`);
    }
    if (typeof testCase.expected.rationale !== 'string' || testCase.expected.rationale.length < 12) {
      errors.push(`${context}: expected.rationale must be descriptive`);
    }
  }
}

export function loadCases(baseDir = caseDir) {
  const errors = [];
  if (!fs.existsSync(baseDir)) {
    return { cases: [], errors: [`Missing case directory: ${path.relative(repoRoot, baseDir)}`] };
  }

  const files = fs.readdirSync(baseDir)
    .filter((file) => file.endsWith('.json'))
    .sort();
  const cases = files.flatMap((file) => parseCaseFile(path.join(baseDir, file), errors));
  for (const testCase of cases) validateCase(testCase, errors);

  const ids = new Set();
  for (const testCase of cases) {
    if (ids.has(testCase.caseId)) errors.push(`${testCase.caseId}: duplicate caseId`);
    ids.add(testCase.caseId);
  }

  return { cases, errors };
}

export function loadLabels(filePath = labelsPath) {
  const errors = [];
  if (!fs.existsSync(filePath)) {
    return { labels: [], errors: [`Missing labels file: ${path.relative(repoRoot, filePath)}`] };
  }

  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  const header = lines.shift();
  if (header !== CSV_HEADER) {
    errors.push(`expected_labels.csv: header must be '${CSV_HEADER}'`);
  }

  const labels = lines.filter(Boolean).map((line, index) => {
    const parts = line.split(',');
    if (parts.length !== 7) {
      errors.push(`expected_labels.csv:${index + 2}: expected 7 columns`);
    }
    const [
      caseId,
      expectedStatus,
      expectedBlockCode,
      category,
      toolId,
      surface,
      knownBad,
    ] = parts;
    return {
      caseId,
      expectedStatus,
      expectedBlockCode: expectedBlockCode || null,
      category,
      toolId,
      surface,
      knownBad,
    };
  });

  const ids = new Set();
  for (const label of labels) {
    if (ids.has(label.caseId)) errors.push(`${label.caseId}: duplicate expected label row`);
    ids.add(label.caseId);
    if (!STATUSES.includes(label.expectedStatus)) {
      errors.push(`${label.caseId}: expectedStatus '${label.expectedStatus}' is not allowed`);
    }
    if (label.expectedBlockCode !== null && !BLOCK_CODES.includes(label.expectedBlockCode)) {
      errors.push(`${label.caseId}: expectedBlockCode '${label.expectedBlockCode}' is not allowed`);
    }
    if (!CATEGORIES.includes(label.category)) errors.push(`${label.caseId}: category '${label.category}' is not allowed`);
    if (!TOOL_IDS.includes(label.toolId)) errors.push(`${label.caseId}: toolId '${label.toolId}' is not allowed`);
    if (!SURFACES.includes(label.surface)) errors.push(`${label.caseId}: surface '${label.surface}' is not allowed`);
    if (!['true', 'false'].includes(label.knownBad)) errors.push(`${label.caseId}: knownBad must be true or false`);
  }

  return { labels, errors };
}

export function validateCorpus() {
  const caseLoad = loadCases();
  const labelLoad = loadLabels();
  const errors = [...caseLoad.errors, ...labelLoad.errors];
  const cases = caseLoad.cases;
  const labels = labelLoad.labels;
  const casesById = new Map(cases.map((testCase) => [testCase.caseId, testCase]));
  const labelsById = new Map(labels.map((label) => [label.caseId, label]));

  const missingLabels = cases
    .filter((testCase) => !labelsById.has(testCase.caseId))
    .map((testCase) => testCase.caseId);
  const orphanLabels = labels
    .filter((label) => !casesById.has(label.caseId))
    .map((label) => label.caseId);

  for (const id of missingLabels) errors.push(`${id}: missing expected label row`);
  for (const id of orphanLabels) errors.push(`${id}: expected label row has no matching case`);

  for (const testCase of cases) {
    const label = labelsById.get(testCase.caseId);
    if (!label) continue;
    if (label.expectedStatus !== testCase.expected.status) {
      errors.push(`${testCase.caseId}: CSV expectedStatus does not match JSON expected.status`);
    }
    if (label.expectedBlockCode !== testCase.expected.blockCode) {
      errors.push(`${testCase.caseId}: CSV expectedBlockCode does not match JSON expected.blockCode`);
    }
    if (label.category !== testCase.category) errors.push(`${testCase.caseId}: CSV category does not match JSON category`);
    if (label.toolId !== testCase.toolId) errors.push(`${testCase.caseId}: CSV toolId does not match JSON toolId`);
    if (label.surface !== testCase.surface) errors.push(`${testCase.caseId}: CSV surface does not match JSON surface`);
    if ((label.knownBad === 'true') !== testCase.knownBad) {
      errors.push(`${testCase.caseId}: CSV knownBad does not match JSON knownBad`);
    }
  }

  const categoryCoverage = countBy(cases, (testCase) => testCase.category);
  const surfaceCoverage = countBy(cases, (testCase) => testCase.surface);
  const statusCoverage = countBy(cases, (testCase) => testCase.expected.status);
  const toolCoverage = countBy(cases, (testCase) => testCase.toolId);

  if (cases.length < 50) errors.push(`totalCases: expected at least 50, found ${cases.length}`);
  for (const [category, minimum] of Object.entries(REQUIRED_CATEGORY_MINIMUMS)) {
    if ((categoryCoverage[category] ?? 0) < minimum) {
      errors.push(`categoryCoverage.${category}: expected at least ${minimum}, found ${categoryCoverage[category] ?? 0}`);
    }
  }
  for (const surface of SURFACES) {
    if (!surfaceCoverage[surface]) errors.push(`surfaceCoverage.${surface}: missing`);
  }
  for (const status of STATUSES) {
    if (!statusCoverage[status]) errors.push(`statusCoverage.${status}: missing`);
  }

  const knownBadTags = new Set(
    cases
      .filter((testCase) => testCase.knownBad)
      .flatMap((testCase) => testCase.riskTags),
  );
  const knownBadCoverage = Object.fromEntries(
    REQUIRED_KNOWN_BAD_TAGS.map((tag) => [tag, knownBadTags.has(tag)]),
  );
  for (const [tag, present] of Object.entries(knownBadCoverage)) {
    if (!present) errors.push(`knownBadCoverage.${tag}: missing`);
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      totalCases: cases.length,
      categoryCoverage,
      surfaceCoverage,
      statusCoverage,
      toolCoverage,
      knownBadCoverage,
      missingLabels,
      orphanLabels,
    },
  };
}

function main() {
  const result = validateCorpus();
  console.log('trustBenchmarkCorpus validation');
  console.log(JSON.stringify(result.summary, null, 2));
  if (!result.ok) {
    console.error(`integrity: fail (${result.errors.length} issue${result.errors.length === 1 ? '' : 's'})`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('integrity: ok');
}

if (process.argv[1] === __filename) {
  main();
}
