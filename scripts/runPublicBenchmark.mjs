#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const caseDir = path.join(repoRoot, 'benchmarks', 'trust-runtime-cases');
const labelsPath = path.join(repoRoot, 'benchmarks', 'expected_labels.csv');
const defaultReportDir = path.join(repoRoot, 'reports', 'public-benchmark');
const reportDir = process.env.PUBLIC_BENCHMARK_OUTPUT_DIR
  ? path.resolve(process.env.PUBLIC_BENCHMARK_OUTPUT_DIR)
  : defaultReportDir;

const rawCsvPath = path.join(reportDir, 'raw-results.csv');
const rawJsonPath = path.join(reportDir, 'raw-results.json');
const summaryCsvPath = path.join(reportDir, 'summary.csv');
const summaryJsonPath = path.join(reportDir, 'summary.json');
const reportJsonPath = path.join(reportDir, 'report.json');

const methodsNotePath = path.join(repoRoot, 'docs', 'public-benchmark-methods.md');

function displayPath(filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  return relativePath.startsWith('..') ? filePath : relativePath;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function corpusVersion(caseContents, labelsCsv) {
  const hash = crypto.createHash('sha256');
  for (const content of caseContents) hash.update(content);
  hash.update(labelsCsv);
  return `sha256:${hash.digest('hex').slice(0, 16)}`;
}

const trustMetricsReport = await tsImport('../src/services/trustMetricsReport.ts', import.meta.url);
const publicBenchmarkEvaluator = await tsImport(
  '../src/services/publicBenchmarkEvaluator.ts',
  import.meta.url,
);
const publicBenchmarkMetrics = await tsImport(
  '../src/services/publicBenchmarkMetrics.ts',
  import.meta.url,
);

const caseFiles = fs.readdirSync(caseDir)
  .filter((file) => file.endsWith('.json'))
  .sort();
const caseContents = [];
const benchmarkCases = [];

for (const file of caseFiles) {
  const fullPath = path.join(caseDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  caseContents.push(content);
  const parsed = JSON.parse(content);
  const caseFile = trustMetricsReport.parseBenchmarkCaseFile(
    parsed,
    displayPath(fullPath),
  );
  benchmarkCases.push(...caseFile.cases);
}

const labelsCsv = fs.readFileSync(labelsPath, 'utf8');
const expectedLabels = trustMetricsReport.parseExpectedLabelsCsv(labelsCsv);
const rawResults = publicBenchmarkEvaluator.evaluateBenchmarkCasesForModes(
  benchmarkCases,
  expectedLabels,
);

const generatedAt = process.env.PUBLIC_BENCHMARK_GENERATED_AT ?? new Date().toISOString();
const runLabel = process.env.PUBLIC_BENCHMARK_RUN_LABEL ?? 'local-dev';
const report = publicBenchmarkMetrics.computePublicBenchmarkReport(rawResults, {
  generatedAt,
  runLabel,
  rawResultsPath: displayPath(rawJsonPath),
  summaryPath: displayPath(summaryJsonPath),
  methodsNotePath: displayPath(methodsNotePath),
});

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(
  rawCsvPath,
  publicBenchmarkMetrics.publicBenchmarkResultsToCsv(rawResults),
  'utf8',
);
writeJson(rawJsonPath, rawResults);
fs.writeFileSync(
  summaryCsvPath,
  publicBenchmarkMetrics.publicBenchmarkSummariesToCsv(report.modes),
  'utf8',
);
writeJson(summaryJsonPath, report.modes);
writeJson(reportJsonPath, report);

console.log(`public benchmark raw CSV written: ${displayPath(rawCsvPath)}`);
console.log(`public benchmark raw JSON written: ${displayPath(rawJsonPath)}`);
console.log(`public benchmark summary CSV written: ${displayPath(summaryCsvPath)}`);
console.log(`public benchmark summary JSON written: ${displayPath(summaryJsonPath)}`);
console.log(`public benchmark report written: ${displayPath(reportJsonPath)}`);
console.log(JSON.stringify({
  runLabel: report.runLabel,
  corpusVersion: corpusVersion(caseContents, labelsCsv),
  totalCases: report.totalCases,
  modes: report.modes.map((modeSummary) => ({
    mode: modeSummary.mode,
    unsafePropagationRate: modeSummary.unsafePropagationRate,
    falseTrustRate: modeSummary.falseTrustRate,
    unsafeExportPreventionRate: modeSummary.unsafeExportPreventionRate,
    knownBadPreventionRate: modeSummary.knownBadPreventionRate,
  })),
}, null, 2));
