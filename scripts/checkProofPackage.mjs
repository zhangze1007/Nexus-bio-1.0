#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'proof-package', 'manifest.json');

const requiredNonClaims = [
  'No wet-lab validation is claimed.',
  'No scientific model validation is claimed.',
  'No external validation is claimed.',
  'No full SBOL compliance is claimed unless validated separately.',
  'No statistical significance is claimed.',
  'No completed human reviewer study is claimed.',
  'No regulatory approval is claimed.',
  'No production-grade safety certification is claimed.',
  'No user traction is claimed.',
];

const requiredPackageFiles = [
  'proof-package/README.md',
  'proof-package/manifest.json',
  'proof-package/replication-guide.md',
  'proof-package/limitations.md',
  'proof-package/demo-status-table.md',
  'proof-package/replay.md',
  'proof-package/specs/README.md',
  'proof-package/benchmark/README.md',
  'proof-package/benchmark/run.sh',
  'proof-package/benchmark/replay.mjs',
  'proof-package/reports/README.md',
  'proof-package/examples/README.md',
  'proof-package/provenance/README.md',
  'proof-package/checks/README.md',
];

const jsonFiles = [
  'proof-package/manifest.json',
  'proof-package/benchmark/trust-runtime-schema.json',
  'proof-package/benchmark/trust-runtime-cases/p0-step-6-cases.json',
  'proof-package/reports/trust-metrics-latest.json',
  'proof-package/reports/public-benchmark-report.json',
  'proof-package/reports/public-benchmark-summary.json',
  'proof-package/reports/public-benchmark-raw-results.json',
  'proof-package/examples/safe-pathway.json',
  'proof-package/examples/blocked-cethx-claim.json',
  'proof-package/provenance/example-provenance-bundle.json',
  'proof-package/provenance/example-sbol-artifact.json',
];

const csvFiles = [
  'proof-package/benchmark/expected_labels.csv',
  'proof-package/reports/public-benchmark-summary.csv',
  'proof-package/reports/public-benchmark-raw-results.csv',
];

function repoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(repoPath(relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(repoPath(relativePath), 'utf8'));
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function entriesFromManifest(manifest) {
  if (!isRecord(manifest.contents)) return [];
  return Object.values(manifest.contents).flatMap((items) => (
    Array.isArray(items) ? items.filter(isRecord) : []
  ));
}

function listFiles(relativeDir) {
  const fullDir = repoPath(relativeDir);
  return fs.readdirSync(fullDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) return listFiles(relativePath);
    if (entry.isFile()) return [relativePath];
    return [];
  });
}

function checkCsv(relativePath, errors) {
  const content = fs.readFileSync(repoPath(relativePath), 'utf8');
  const [header, ...rows] = content.trim().split(/\r?\n/);
  if (!header) errors.push(`${relativePath}: missing CSV header`);
  if (rows.length === 0) errors.push(`${relativePath}: missing CSV rows`);
}

function main() {
  const errors = [];

  if (!exists('proof-package/manifest.json')) {
    errors.push('proof-package/manifest.json is missing');
  }

  const manifest = exists('proof-package/manifest.json')
    ? readJson('proof-package/manifest.json')
    : null;

  if (!isRecord(manifest)) {
    errors.push('proof-package/manifest.json must parse as an object');
  } else {
    if (manifest.schemaVersion !== 'proof-package-v1') {
      errors.push('manifest schemaVersion must be proof-package-v1');
    }
    if (manifest.runLabel !== 'local-dev') {
      errors.push('manifest runLabel must be local-dev unless a real release tag exists');
    }
    if (!Array.isArray(manifest.nonClaims)) {
      errors.push('manifest nonClaims must be an array');
    } else {
      for (const nonClaim of requiredNonClaims) {
        if (!manifest.nonClaims.includes(nonClaim)) {
          errors.push(`manifest nonClaims missing: ${nonClaim}`);
        }
      }
    }

    const manifestEntries = entriesFromManifest(manifest);
    const listedPackagePaths = new Set();

    for (const entry of manifestEntries) {
      const packagePath = entry.packagePath;
      const sourcePath = entry.sourcePath;
      if (typeof packagePath === 'string' && !exists(packagePath)) {
        errors.push(`manifest packagePath missing: ${packagePath}`);
      }
      if (typeof packagePath === 'string') listedPackagePaths.add(packagePath);
      if (typeof sourcePath === 'string' && !exists(sourcePath)) {
        errors.push(`manifest sourcePath missing: ${sourcePath}`);
      }
    }

    for (const packageFile of listFiles('proof-package')) {
      if (!listedPackagePaths.has(packageFile)) {
        errors.push(`proof-package file not listed in manifest: ${packageFile}`);
      }
    }
  }

  for (const relativePath of requiredPackageFiles) {
    if (!exists(relativePath)) errors.push(`required package file missing: ${relativePath}`);
  }

  for (const relativePath of jsonFiles) {
    if (!exists(relativePath)) {
      errors.push(`JSON file missing: ${relativePath}`);
      continue;
    }
    try {
      readJson(relativePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${relativePath}: failed to parse JSON: ${message}`);
    }
  }

  for (const relativePath of csvFiles) {
    if (!exists(relativePath)) {
      errors.push(`CSV file missing: ${relativePath}`);
      continue;
    }
    checkCsv(relativePath, errors);
  }

  if (errors.length > 0) {
    console.error('proof package check failed');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('proof package check passed');
  console.log(JSON.stringify({
    manifest: path.relative(repoRoot, manifestPath),
    checkedPackageFiles: requiredPackageFiles.length,
    checkedJsonFiles: jsonFiles.length,
    checkedCsvFiles: csvFiles.length,
    nonClaims: requiredNonClaims.length,
  }, null, 2));
}

main();
