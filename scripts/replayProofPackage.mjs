#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const commands = [
  ['npm', ['run', 'benchmark:trust:validate']],
  ['npm', ['run', 'benchmark:trust:evaluate']],
  ['npm', ['run', 'benchmark:trust:report']],
];

// Python comparison is optional — skip if python3 is not available
const pythonCheck = spawnSync('python3', ['--version'], { stdio: 'pipe', shell: process.platform === 'win32' });
if (pythonCheck.status === 0) {
  commands.push(['npm', ['run', 'reference:py:compare']]);
} else {
  console.log('⚠ python3 not available — skipping reference:py:compare');
}

const reportCopies = [
  ['reports/trust-metrics/latest.json', 'proof-package/reports/trust-metrics-latest.json'],
  ['reports/second-implementation-consistency.json', 'proof-package/reports/second-implementation-consistency.json'],
  ['reports/second-implementation-consistency.md', 'proof-package/reports/second-implementation-consistency.md'],
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const [command, args] of commands) run(command, args);

for (const [source, destination] of reportCopies) {
  const sourcePath = path.join(repoRoot, source);
  const destinationPath = path.join(repoRoot, destination);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

run('npm', ['run', 'proof:check']);

console.log('proof replay complete');
console.log('Reports are available in proof-package/reports/.');
console.log('Limitations are documented in proof-package/limitations.md.');
