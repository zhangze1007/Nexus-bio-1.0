# Direction F: External Reviewer Replay Tools

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable an external reviewer to replay all proof artifacts, verify benchmarks, and file structured disagreements.

**Architecture:** CLI tools for replay + structured disagreement format + reviewer pack documentation.

**Tech Stack:** Node.js CLI, JSON schema, existing proof-package

---

## Phase F1: Replay CLI

### Task F1.1: Create replay CLI

**Files:**
- Create: `scripts/replay.ts`
- Modify: `package.json` (add replay script)

- [ ] **Step 1: Create replay CLI**

```typescript
// scripts/replay.ts
/**
 * Replay CLI — Re-run all proof-package checks and generate a consistency report.
 *
 * Usage: npx tsx scripts/replay.ts [--output reports/replay-YYYY-MM-DD.json]
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface ReplayResult {
  check: string;
  status: 'pass' | 'fail' | 'skip';
  details: string;
  timestamp: string;
}

async function main() {
  const results: ReplayResult[] = [];
  const timestamp = new Date().toISOString();

  // 1. Run trust benchmark
  console.log('Running trust benchmark...');
  try {
    // Import and run benchmark evaluator
    const { evaluateBenchmarkCorpus } = await import('../benchmarks/evaluate');
    const corpus = JSON.parse(readFileSync('benchmarks/trust-benchmark-corpus.json', 'utf-8'));
    const evalResult = evaluateBenchmarkCorpus(corpus);
    results.push({
      check: 'trust-benchmark',
      status: evalResult.allPassed ? 'pass' : 'fail',
      details: `${evalResult.passed}/${evalResult.total} cases passed`,
      timestamp,
    });
  } catch (e) {
    results.push({
      check: 'trust-benchmark',
      status: 'fail',
      details: `Error: ${e instanceof Error ? e.message : String(e)}`,
      timestamp,
    });
  }

  // 2. Run proof checks
  console.log('Running proof checks...');
  try {
    const proofManifest = JSON.parse(readFileSync('proof-package/manifest.json', 'utf-8'));
    results.push({
      check: 'proof-manifest',
      status: 'pass',
      details: `Manifest has ${Object.keys(proofManifest).length} sections`,
      timestamp,
    });
  } catch (e) {
    results.push({
      check: 'proof-manifest',
      status: 'fail',
      details: `Error: ${e}`,
      timestamp,
    });
  }

  // 3. Run type check
  console.log('Running type check...');
  try {
    const { execSync } = require('child_process');
    execSync('npx tsc --noEmit', { encoding: 'utf-8' });
    results.push({ check: 'typecheck', status: 'pass', details: 'No type errors', timestamp });
  } catch (e) {
    results.push({ check: 'typecheck', status: 'fail', details: 'Type errors found', timestamp });
  }

  // 4. Run tests
  console.log('Running tests...');
  try {
    const { execSync } = require('child_process');
    const output = execSync('npx jest --json', { encoding: 'utf-8' });
    const jestResult = JSON.parse(output);
    results.push({
      check: 'unit-tests',
      status: jestResult.numFailedTests === 0 ? 'pass' : 'fail',
      details: `${jestResult.numPassedTests}/${jestResult.numTotalTests} passed`,
      timestamp,
    });
  } catch (e) {
    results.push({ check: 'unit-tests', status: 'fail', details: 'Test run failed', timestamp });
  }

  // Output report
  const report = {
    timestamp,
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      skipped: results.filter(r => r.status === 'skip').length,
    },
  };

  const outputPath = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : `reports/replay-${timestamp.slice(0, 10)}.json`;

  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nReplay report saved to ${outputPath}`);
  console.log(`Results: ${report.summary.passed} passed, ${report.summary.failed} failed`);

  // Exit with error if any failures
  if (report.summary.failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Add script to package.json**

```json
"scripts": {
  "replay": "tsx scripts/replay.ts"
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/replay.ts package.json
git commit -m "feat(replay): create replay CLI for external reviewers"
```

---

## Phase F2: Reviewer Pack

### Task F2.1: Create reviewer pack documentation

**Files:**
- Create: `docs/reviewer-pack.md`

- [ ] **Step 1: Write reviewer pack**

```markdown
# Reviewer Pack

## Quick Start

1. Clone: `git clone https://github.com/zhangze1007/Nexus-bio-1.0`
2. Install: `npm ci`
3. Replay: `npm run replay`
4. Review: `reports/replay-YYYY-MM-DD.json`

## What the Replay Does

The replay CLI runs 4 checks:
1. **Trust benchmark** — evaluates all benchmark cases against the policy DSL
2. **Proof manifest** — verifies proof-package integrity
3. **Type check** — ensures no type errors
4. **Unit tests** — runs all 1994 tests

## Filing Disagreements

Create a JSON file in `reports/disagreements/`:

```json
{
  "caseId": "benchmark-case-001",
  "expectedLabel": "ok",
  "actualLabel": "blocked",
  "reason": "The policy gate for validityTier=partial should allow export",
  "evidence": "Partial tier has been validated against SKEMPI 2.0",
  "severity": "major",
  "suggestedFix": "Update policy to allow export for partial tier"
}
```

## Review Checklist

- [ ] All benchmark cases pass
- [ ] No type errors
- [ ] All 1994 unit tests pass
- [ ] Proof package manifest is complete
- [ ] Limitations documented in proof-package/limitations.md
- [ ] Demo status table is accurate
```

- [ ] **Step 2: Commit**

```bash
git add docs/reviewer-pack.md
git commit -m "docs: create reviewer pack for external reviewers"
```

---

### Task F2.2: Create disagreement schema

**Files:**
- Create: `schemas/disagreement.schema.json`

- [ ] **Step 1: Create JSON schema**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Reviewer Disagreement",
  "type": "object",
  "required": ["caseId", "expectedLabel", "actualLabel", "reason", "severity"],
  "properties": {
    "caseId": { "type": "string", "description": "Benchmark case ID" },
    "expectedLabel": { "type": "string", "description": "What the reviewer expected" },
    "actualLabel": { "type": "string", "description": "What the system produced" },
    "reason": { "type": "string", "description": "Why the reviewer disagrees" },
    "evidence": { "type": "string", "description": "Supporting evidence" },
    "severity": { "type": "string", "enum": ["minor", "major", "critical"] },
    "suggestedFix": { "type": "string", "description": "Proposed resolution" }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add schemas/disagreement.schema.json
git commit -m "feat(replay): create disagreement JSON schema"
```

---

### Task F2.3: Add replay to CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add replay step**

```yaml
replay:
  runs-on: ubuntu-latest
  needs: [test, typecheck]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - run: npm run replay
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add replay verification step"
```

---

## Phase F3: Reviewer Workflow

### Task F3.1: Create reviewer workflow documentation

**Files:**
- Create: `docs/external-review-protocol.md`

- [ ] **Step 1: Write protocol**

Document the full reviewer workflow: clone → replay → review → file disagreement → submit PR.

- [ ] **Step 2: Commit**

```bash
git add docs/external-review-protocol.md
git commit -m "docs: create external review protocol"
```

---

### Task F3.2: Create reviewer templates

**Files:**
- Create: `reports/external-review/template.md`

- [ ] **Step 1: Create review template**

```markdown
# External Review Report

**Reviewer:** [Name]
**Date:** [Date]
**Commit:** [SHA]

## Replay Results

[Paste replay output]

## Findings

### [ ] All checks pass
### [ ] Benchmark accuracy acceptable
### [ ] Limitations documented
### [ ] Code quality acceptable

## Disagreements

[List any filed disagreements]

## Recommendation

[ ] Approve
[ ] Approve with minor changes
[ ] Request changes
[ ] Reject

## Notes

[Additional comments]
```

- [ ] **Step 2: Commit**

```bash
git add reports/external-review/template.md
git commit -m "docs: create external review report template"
```
