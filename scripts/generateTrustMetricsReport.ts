#!/usr/bin/env tsx
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTrustMetricsReport,
  parseBenchmarkCaseFile,
  parseExpectedLabelsCsv,
  toTrustMetricsHistoryEntry,
} from '../src/services/trustMetricsReport';
import type {
  TrustBenchmarkMetricCase,
  TrustMetricsHistoryEntry,
} from '../src/types/trustMetrics';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const caseDir = path.join(repoRoot, 'benchmarks', 'trust-runtime-cases');
const labelsPath = path.join(repoRoot, 'benchmarks', 'expected_labels.csv');
const reportDir = path.join(repoRoot, 'reports', 'trust-metrics');
const latestPath = path.join(reportDir, 'latest.json');
const historyPath = path.join(reportDir, 'history.json');

interface LoadedCorpus {
  cases: TrustBenchmarkMetricCase[];
  labelsCsv: string;
  caseContents: string[];
}

function loadCorpus(): LoadedCorpus {
  const caseFiles = fs.readdirSync(caseDir)
    .filter((file) => file.endsWith('.json'))
    .sort();
  const cases: TrustBenchmarkMetricCase[] = [];
  const caseContents: string[] = [];

  for (const file of caseFiles) {
    const fullPath = path.join(caseDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    caseContents.push(content);
    const parsed: unknown = JSON.parse(content);
    cases.push(...parseBenchmarkCaseFile(parsed, path.relative(repoRoot, fullPath)).cases);
  }

  return {
    cases,
    labelsCsv: fs.readFileSync(labelsPath, 'utf8'),
    caseContents,
  };
}

function corpusVersion(caseContents: string[], labelsCsv: string): string {
  const hash = crypto.createHash('sha256');
  for (const content of caseContents) hash.update(content);
  hash.update(labelsCsv);
  return `sha256:${hash.digest('hex').slice(0, 16)}`;
}

function isHistoryEntry(value: unknown): value is TrustMetricsHistoryEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.generatedAt === 'string'
    && typeof record.runLabel === 'string'
    && typeof record.totalCases === 'number'
    && typeof record.blockRate === 'number'
    && typeof record.falseBlockRate === 'number'
    && typeof record.unsafeExportPreventionRate === 'number'
    && typeof record.demoLeakageRate === 'number'
    && typeof record.missingProvenanceRate === 'number'
    && typeof record.mismatchCount === 'number'
    && (
      record.corpusVersion === undefined
      || typeof record.corpusVersion === 'string'
    )
  );
}

function loadHistory(): TrustMetricsHistoryEntry[] {
  if (!fs.existsSync(historyPath)) return [];
  const parsed: unknown = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  if (!Array.isArray(parsed) || !parsed.every(isHistoryEntry)) {
    throw new Error('reports/trust-metrics/history.json is not a trust metrics history array');
  }
  return parsed;
}

function upsertHistoryEntry(
  history: TrustMetricsHistoryEntry[],
  entry: TrustMetricsHistoryEntry,
): TrustMetricsHistoryEntry[] {
  const existingIndex = history.findIndex((item) => (
    item.runLabel === entry.runLabel
    && item.corpusVersion === entry.corpusVersion
  ));
  if (existingIndex === -1) return [...history, entry];

  return history.map((item, index) => (index === existingIndex ? entry : item));
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main(): void {
  const loaded = loadCorpus();
  const report = buildTrustMetricsReport({
    cases: loaded.cases,
    expectedLabels: parseExpectedLabelsCsv(loaded.labelsCsv),
    generatedAt: new Date().toISOString(),
    runLabel: 'local-dev',
    corpusVersion: corpusVersion(loaded.caseContents, loaded.labelsCsv),
  });

  fs.mkdirSync(reportDir, { recursive: true });
  writeJson(latestPath, report);
  writeJson(
    historyPath,
    upsertHistoryEntry(loadHistory(), toTrustMetricsHistoryEntry(report)),
  );

  console.log(`trust metrics report written: ${path.relative(repoRoot, latestPath)}`);
  console.log(`trust metrics history updated: ${path.relative(repoRoot, historyPath)}`);
  console.log(JSON.stringify({
    totalCases: report.totalCases,
    blockRate: report.blockRate,
    falseBlockRate: report.falseBlockRate,
    unsafeExportPreventionRate: report.unsafeExportPreventionRate,
    demoLeakageRate: report.demoLeakageRate,
    mismatchCount: report.mismatches.length,
  }, null, 2));
}

main();
