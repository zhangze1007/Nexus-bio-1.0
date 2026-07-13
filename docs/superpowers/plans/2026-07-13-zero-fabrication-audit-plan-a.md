# Zero-Fabrication Audit — Plan A (Phase 0–1: Triage → Ranked Report) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small, unit-tested fabrication scanner and run it to produce a ranked `NEXUS_BIO_INTEGRITY_AUDIT_V2.md` of suspected fabrication / decoy / non-reproducibility across the platform.

**Architecture:** Pure detector functions (string in → hits out, no I/O) so they are trivially unit-testable and cannot themselves be fabricated; a thin runner does the file I/O, calls the detectors, ranks the hits, and writes the report. Detectors are recall-oriented — they flag *suspects*; human/LLM confirmation is Phase 2 (a later plan).

**Tech Stack:** TypeScript, Jest (ts-jest) for tests, `tsx` for running the script, Node `fs`/`glob` for file access.

## Global Constraints

- **Defect classes in scope:** fabrication/misrepresentation, decoys (params ignored), non-reproducibility (unseeded randomness on a reported-result path). Copy verbatim from spec §3.
- **OUT of scope:** physical/biological accuracy (deferred to wet-lab). Never flag "the number looks biologically wrong." Spec §1.
- **DO-NOT-TOUCH (flagging as a bug would be a NEW error):** Knuth Poisson sampler (`digitalCellEngine`), ID generators (`Math.random().toString(36)`), legit seeded samplers / design-diversity RNG. Spec §4.
- **FORBIDDEN files (audit-only, never modify):** `IDEShell`, `IDETopBar`, `IDESidebar`, `DBTLflowPage`, `GECAIRPage`, `ProEvolPage`.
- **Verification rule:** no self-report — every task proves itself by a Jest run whose output is pasted, never "✅ done".
- **Detectors are pure functions** (no `fs`, no `Date`, deterministic) so tests are hermetic.
- Frequent commits: one per task.

---

### Task 1: Scanner config + target filtering

**Files:**
- Create: `scripts/audit/config.ts`
- Create: `scripts/audit/targets.ts`
- Test: `__tests__/audit/targets.test.ts`

**Interfaces:**
- Produces: `filterTargets(paths: string[]): { audit: string[]; forbidden: string[] }`; constants `AUDIT_GLOBS`, `EXCLUDE_SUBSTRINGS`, `FORBIDDEN`, `ACKNOWLEDGED: Acknowledged[]`, `SCORE_NAMES: RegExp`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/audit/targets.test.ts
import { filterTargets } from '../../scripts/audit/targets';

describe('filterTargets', () => {
  it('keeps engine/data/route source, drops tests/node_modules/decls', () => {
    const { audit } = filterTargets([
      'src/server/fbaEngine.ts',
      'src/server/fbaEngine.test.ts',
      '__tests__/audit/x.test.ts',
      'node_modules/foo/index.ts',
      'src/types/x.d.ts',
    ]);
    expect(audit).toEqual(['src/server/fbaEngine.ts']);
  });

  it('routes FORBIDDEN files to the forbidden bucket, not audit', () => {
    const { audit, forbidden } = filterTargets([
      'src/components/tools/ProEvolPage.tsx',
      'src/server/crisprEditingEngine.ts',
    ]);
    expect(forbidden).toContain('src/components/tools/ProEvolPage.tsx');
    expect(audit).toEqual(['src/server/crisprEditingEngine.ts']);
  });

  it('normalizes Windows backslashes', () => {
    const { audit } = filterTargets(['src\\server\\fbaEngine.ts']);
    expect(audit).toEqual(['src/server/fbaEngine.ts']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/audit/targets.test.ts`
Expected: FAIL — "Cannot find module '../../scripts/audit/targets'".

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/audit/config.ts
export const AUDIT_GLOBS = [
  'src/server/**/*.ts',
  'src/services/**/*.ts',
  'src/modules/**/*.ts',
  'src/data/**/*.ts',
  'app/api/**/*.ts',
];

export const EXCLUDE_SUBSTRINGS = ['/__tests__/', '__tests__/', '.test.ts', '.test.tsx', '.d.ts', 'node_modules/', '/.next/'];

// Audit-only; never auto-modify (CLAUDE.md FORBIDDEN list).
export const FORBIDDEN = [
  'components/ide/IDEShell', 'components/ide/IDETopBar', 'components/ide/IDESidebar',
  'components/tools/DBTLflowPage', 'components/tools/GECAIRPage', 'components/tools/ProEvolPage',
];

// Legitimate randomness the integrity audit verified — downgraded to 'excluded'.
export interface Acknowledged { fileIncludes: string; snippetIncludes: string; reason: string; }
export const ACKNOWLEDGED: Acknowledged[] = [
  { fileIncludes: 'digitalCellEngine', snippetIncludes: 'p *= Math.random()', reason: 'Knuth Poisson sampler (textbook-correct)' },
  { fileIncludes: 'ProEvolCampaignEngine', snippetIncludes: 'Math.random()', reason: 'design-diversity injection (legit, seed optional)' },
];

// Identifier fragments that mean "this value is a REPORTED result" → random-derived = fabrication.
export const SCORE_NAMES = /(confidence|score|fitness|efficienc|yield|affinity|probabilit|foldabilit|strength|expression|activity|effect|bystander|sensitiv)/i;
```

```ts
// scripts/audit/targets.ts
import { EXCLUDE_SUBSTRINGS, FORBIDDEN } from './config';

export function filterTargets(paths: string[]): { audit: string[]; forbidden: string[] } {
  const audit: string[] = [];
  const forbidden: string[] = [];
  for (const raw of paths) {
    const p = raw.replace(/\\/g, '/');
    if (EXCLUDE_SUBSTRINGS.some((s) => p.includes(s))) continue;
    if (FORBIDDEN.some((f) => p.includes(f))) { forbidden.push(p); continue; }
    audit.push(p);
  }
  return { audit, forbidden };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/audit/targets.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/audit/config.ts scripts/audit/targets.ts __tests__/audit/targets.test.ts
git commit -m "feat(audit): scanner config + target filtering"
```

---

### Task 2: Randomness detector (fabrication vs reproducibility)

**Files:**
- Create: `scripts/audit/detectors/randomness.ts`
- Test: `__tests__/audit/randomness.test.ts`

**Interfaces:**
- Consumes: `ACKNOWLEDGED`, `SCORE_NAMES` from `config`.
- Produces: `scanRandomness(source: string, file: string): RandomnessHit[]` where `RandomnessHit = { file: string; line: number; snippet: string; klass: 'fabrication' | 'reproducibility' | 'excluded'; reason: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/audit/randomness.test.ts
import { scanRandomness } from '../../scripts/audit/detectors/randomness';

describe('scanRandomness', () => {
  it('flags random-derived returned SCORE as fabrication', () => {
    const src = `const confidence = 0.4 + 0.3 * Math.random();\nreturn confidence;`;
    const hits = scanRandomness(src, 'x.ts').filter((h) => h.klass === 'fabrication');
    expect(hits.length).toBe(1);
  });

  it('classifies unseeded sampling as reproducibility (not fabrication)', () => {
    const src = `let vec = arr.map(() => Math.random()); // power-iteration init`;
    const hits = scanRandomness(src, 'x.ts');
    expect(hits[0].klass).toBe('reproducibility');
  });

  it('excludes id generators', () => {
    const src = `const id = Math.random().toString(36).slice(2);`;
    expect(scanRandomness(src, 'x.ts')[0].klass).toBe('excluded');
  });

  it('excludes ACKNOWLEDGED legit randomness by file+snippet', () => {
    const src = `      p *= Math.random(); // Knuth`;
    expect(scanRandomness(src, 'src/server/digitalCellEngine.ts')[0].klass).toBe('excluded');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/audit/randomness.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/audit/detectors/randomness.ts
import { ACKNOWLEDGED, SCORE_NAMES } from '../config';

export interface RandomnessHit {
  file: string;
  line: number;
  snippet: string;
  klass: 'fabrication' | 'reproducibility' | 'excluded';
  reason: string;
}

const RANDOM_RE = /Math\.random\s*\(\)|Date\.now\s*\(\)/;

export function scanRandomness(source: string, file: string): RandomnessHit[] {
  const lines = source.split('\n');
  const hits: RandomnessHit[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!RANDOM_RE.test(line)) continue;
    const base = { file, line: i + 1, snippet: line.trim() };

    if (/toString\(\s*36\s*\)/.test(line)) {
      hits.push({ ...base, klass: 'excluded', reason: 'id generator (toString(36))' });
      continue;
    }
    const ack = ACKNOWLEDGED.find((a) => file.includes(a.fileIncludes) && line.includes(a.snippetIncludes));
    if (ack) {
      hits.push({ ...base, klass: 'excluded', reason: `acknowledged: ${ack.reason}` });
      continue;
    }
    const window = lines.slice(Math.max(0, i - 2), i + 1).join(' ');
    if (SCORE_NAMES.test(window) || /\breturn\b/.test(line)) {
      hits.push({ ...base, klass: 'fabrication', reason: 'random-derived value flows into a reported score/return' });
    } else {
      hits.push({ ...base, klass: 'reproducibility', reason: 'unseeded randomness on a compute path' });
    }
  }
  return hits;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/audit/randomness.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/audit/detectors/randomness.ts __tests__/audit/randomness.test.ts
git commit -m "feat(audit): randomness detector (fabrication vs reproducibility)"
```

---

### Task 3: Decoy detector (parameters ignored)

**Files:**
- Create: `scripts/audit/detectors/decoy.ts`
- Test: `__tests__/audit/decoy.test.ts`

**Interfaces:**
- Produces: `scanDecoys(source: string, file: string): DecoyHit[]` where `DecoyHit = { file: string; line: number; fn: string; param: string }`. Covers named `function` declarations; a param used only in its own declaration (0 uses in the body) is flagged. Params prefixed `_` or `...` are ignored (conventionally unused).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/audit/decoy.test.ts
import { scanDecoys } from '../../scripts/audit/detectors/decoy';

describe('scanDecoys', () => {
  it('flags a function that ignores a parameter', () => {
    const src = `function findAB(minDist, spread) {\n  const a = 1.929;\n  return [a, 0.79];\n}`;
    const hits = scanDecoys(src, 'x.ts');
    expect(hits.map((h) => h.param).sort()).toEqual(['minDist', 'spread']);
  });

  it('does NOT flag a function that uses its parameters', () => {
    const src = `function scale(x, k) {\n  return x * k;\n}`;
    expect(scanDecoys(src, 'x.ts')).toEqual([]);
  });

  it('ignores underscore-prefixed params', () => {
    const src = `function f(_ctx, v) {\n  return v + 1;\n}`;
    expect(scanDecoys(src, 'x.ts')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/audit/decoy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/audit/detectors/decoy.ts
export interface DecoyHit { file: string; line: number; fn: string; param: string; }

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Return the substring of `source` for the {...} block whose opening brace is at `open`.
function extractBlock(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) return source.slice(open + 1, i); }
  }
  return source.slice(open + 1);
}

export function scanDecoys(source: string, file: string): DecoyHit[] {
  const hits: DecoyHit[] = [];
  const re = /function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const fn = m[1];
    const params = m[2]
      .split(',')
      .map((p) => p.trim().split(/[:=]/)[0].trim())
      .filter((p) => p && !p.startsWith('_') && !p.startsWith('...'));
    if (params.length === 0) continue;
    const braceStart = source.indexOf('{', re.lastIndex);
    if (braceStart === -1) continue;
    const body = extractBlock(source, braceStart);
    const line = source.slice(0, m.index).split('\n').length;
    for (const p of params) {
      const uses = (body.match(new RegExp(`\\b${escapeRe(p)}\\b`, 'g')) || []).length;
      if (uses === 0) hits.push({ file, line, fn, param: p });
    }
  }
  return hits;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/audit/decoy.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/audit/detectors/decoy.ts __tests__/audit/decoy.test.ts
git commit -m "feat(audit): decoy detector (ignored parameters)"
```

---

### Task 4: Claim extractor (provenance / citations)

**Files:**
- Create: `scripts/audit/detectors/claims.ts`
- Test: `__tests__/audit/claims.test.ts`

**Interfaces:**
- Produces: `extractClaims(source: string, file: string): ClaimInfo` where `ClaimInfo = { file: string; hasProvenance: boolean; citations: string[] }`. Used by the ranker to boost severity when a fabrication/decoy hit sits in a file that *claims* real science.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/audit/claims.test.ts
import { extractClaims } from '../../scripts/audit/detectors/claims';

describe('extractClaims', () => {
  it('detects @scientific_provenance and a journal citation', () => {
    const src = `/**\n * @scientific_provenance\n * Watson JL et al., Nature 2023;620:1089-1100.\n */`;
    const c = extractClaims(src, 'x.ts');
    expect(c.hasProvenance).toBe(true);
    expect(c.citations.length).toBeGreaterThan(0);
  });

  it('returns no claims for a plain util', () => {
    const src = `export function add(a: number, b: number) { return a + b; }`;
    const c = extractClaims(src, 'x.ts');
    expect(c.hasProvenance).toBe(false);
    expect(c.citations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/audit/claims.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/audit/detectors/claims.ts
export interface ClaimInfo { file: string; hasProvenance: boolean; citations: string[]; }

export function extractClaims(source: string, file: string): ClaimInfo {
  const hasProvenance = /@scientific_provenance/i.test(source);
  const citations: string[] = [];
  for (const line of source.split('\n')) {
    const yearish = /(19|20)\d{2}/.test(line);
    const journalish = /(et al\.|\bdoi\b|\bDOI\b|Nature|Science|Cell|PLOS|Bioinformatics|Biotechnol)/.test(line);
    if (yearish && journalish) citations.push(line.replace(/^[\s*/]+/, '').trim().slice(0, 140));
  }
  return { file, hasProvenance, citations };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/audit/claims.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/audit/detectors/claims.ts __tests__/audit/claims.test.ts
git commit -m "feat(audit): claim extractor (provenance + citations)"
```

---

### Task 5: Ranker + Markdown report generator

**Files:**
- Create: `scripts/audit/rank.ts`
- Test: `__tests__/audit/rank.test.ts`

**Interfaces:**
- Consumes: `RandomnessHit` (Task 2), `DecoyHit` (Task 3), `ClaimInfo` (Task 4).
- Produces: `buildFindings(input: { random: RandomnessHit[]; decoy: DecoyHit[]; claims: ClaimInfo[] }): Finding[]` and `toMarkdown(findings: Finding[]): string`. `Finding = { file: string; line: number; klass: 'fabrication' | 'decoy' | 'reproducibility'; reason: string; severity: number }`. Severity: fabrication-in-a-claiming-file = 5 (credibility bomb); fabrication = 4; decoy = 3; reproducibility = 2. `'excluded'` randomness hits are dropped. Sorted severity desc, then file.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/audit/rank.test.ts
import { buildFindings, toMarkdown } from '../../scripts/audit/rank';

const claims = [{ file: 'a.ts', hasProvenance: true, citations: ['Watson 2023 Nature'] }];

describe('buildFindings', () => {
  it('drops excluded randomness and ranks a claim-backed fabrication highest', () => {
    const findings = buildFindings({
      random: [
        { file: 'a.ts', line: 10, snippet: '', klass: 'fabrication', reason: 'r' },
        { file: 'b.ts', line: 5, snippet: '', klass: 'reproducibility', reason: 'r' },
        { file: 'c.ts', line: 1, snippet: '', klass: 'excluded', reason: 'id' },
      ],
      decoy: [{ file: 'd.ts', line: 3, fn: 'findAB', param: 'minDist' }],
      claims,
    });
    expect(findings.map((f) => f.file)).toEqual(['a.ts', 'd.ts', 'b.ts']); // 5,3,2
    expect(findings.find((f) => f.file === 'a.ts')!.severity).toBe(5);
    expect(findings.some((f) => f.klass === 'reproducibility' && f.file === 'c.ts')).toBe(false);
  });

  it('renders a markdown table with a header row', () => {
    const md = toMarkdown(buildFindings({ random: [], decoy: [], claims: [] }));
    expect(md).toContain('| Severity | Class | File:Line |');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/audit/rank.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/audit/rank.ts
import type { RandomnessHit } from './detectors/randomness';
import type { DecoyHit } from './detectors/decoy';
import type { ClaimInfo } from './detectors/claims';

export interface Finding {
  file: string;
  line: number;
  klass: 'fabrication' | 'decoy' | 'reproducibility';
  reason: string;
  severity: number;
}

export function buildFindings(input: { random: RandomnessHit[]; decoy: DecoyHit[]; claims: ClaimInfo[] }): Finding[] {
  const claiming = new Set(input.claims.filter((c) => c.hasProvenance || c.citations.length > 0).map((c) => c.file));
  const findings: Finding[] = [];
  for (const h of input.random) {
    if (h.klass === 'excluded') continue;
    if (h.klass === 'fabrication') {
      findings.push({ file: h.file, line: h.line, klass: 'fabrication', reason: h.reason, severity: claiming.has(h.file) ? 5 : 4 });
    } else {
      findings.push({ file: h.file, line: h.line, klass: 'reproducibility', reason: h.reason, severity: 2 });
    }
  }
  for (const d of input.decoy) {
    findings.push({ file: d.file, line: d.line, klass: 'decoy', reason: `param '${d.param}' ignored in ${d.fn}()`, severity: 3 });
  }
  return findings.sort((a, b) => b.severity - a.severity || a.file.localeCompare(b.file) || a.line - b.line);
}

export function toMarkdown(findings: Finding[]): string {
  const rows = findings
    .map((f) => `| ${f.severity} | ${f.klass} | ${f.file}:${f.line} | ${f.reason} | suspected |`)
    .join('\n');
  return [
    '# NEXUS_BIO_INTEGRITY_AUDIT_V2 — suspected fabrication (auto-triage)',
    '',
    `Generated ${findings.length} suspects. Status starts at "suspected"; Phase 2 confirms each with a code-level test.`,
    '',
    '| Severity | Class | File:Line | Reason | Status |',
    '|---|---|---|---|---|',
    rows,
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/audit/rank.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/audit/rank.ts __tests__/audit/rank.test.ts
git commit -m "feat(audit): ranker + markdown report generator"
```

---

### Task 6: Runner + npm script

**Files:**
- Create: `scripts/audit/run.ts` (pure: reads files, returns results — no writes)
- Create: `scripts/audit/cli.ts` (thin I/O wrapper that writes the report files)
- Modify: `package.json` (add `"audit:scan"` script + `tsx`/`glob` devDependencies)
- Test: `__tests__/audit/run.smoke.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `runAudit(root: string): { markdown: string; json: Finding[] }` (takes a root, reads files, returns results without writing — so the smoke test has no side effects). `cli.ts` calls it and writes `NEXUS_BIO_INTEGRITY_AUDIT_V2.md` + `audit-findings.json`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/audit/run.smoke.test.ts
import { runAudit } from '../../scripts/audit/run';
import * as path from 'path';

it('runs the audit over the repo and returns findings + markdown', () => {
  const { markdown, json } = runAudit(path.resolve(__dirname, '../..'));
  expect(markdown).toContain('NEXUS_BIO_INTEGRITY_AUDIT_V2');
  expect(Array.isArray(json)).toBe(true);
  // The scanner must find the module it lives among without crashing.
  expect(markdown).toContain('| Severity | Class | File:Line |');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/audit/run.smoke.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/audit/run.ts
import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';
import { AUDIT_GLOBS } from './config';
import { filterTargets } from './targets';
import { scanRandomness, type RandomnessHit } from './detectors/randomness';
import { scanDecoys, type DecoyHit } from './detectors/decoy';
import { extractClaims, type ClaimInfo } from './detectors/claims';
import { buildFindings, toMarkdown, type Finding } from './rank';

export function runAudit(root: string): { markdown: string; json: Finding[] } {
  const raw = AUDIT_GLOBS.flatMap((g) => globSync(g, { cwd: root, nodir: true }));
  const { audit } = filterTargets(raw);
  const random: RandomnessHit[] = [];
  const decoy: DecoyHit[] = [];
  const claims: ClaimInfo[] = [];
  for (const rel of audit) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    random.push(...scanRandomness(src, rel));
    decoy.push(...scanDecoys(src, rel));
    claims.push(extractClaims(src, rel));
  }
  const findings = buildFindings({ random, decoy, claims });
  return { markdown: toMarkdown(findings), json: findings };
}
```

```ts
// scripts/audit/cli.ts
import * as fs from 'fs';
import * as path from 'path';
import { runAudit } from './run';

const root = process.cwd();
const { markdown, json } = runAudit(root);
fs.writeFileSync(path.join(root, 'NEXUS_BIO_INTEGRITY_AUDIT_V2.md'), markdown);
fs.writeFileSync(path.join(root, 'scripts/audit/audit-findings.json'), JSON.stringify(json, null, 2));
console.log(`Audit complete: ${json.length} suspects → NEXUS_BIO_INTEGRITY_AUDIT_V2.md`);
```

- [ ] **Step 4: Add the npm script + deps**

Run: `npm install -D tsx glob`
Then add to `package.json` `"scripts"`: `"audit:scan": "tsx scripts/audit/cli.ts"`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/audit/run.smoke.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add scripts/audit/run.ts scripts/audit/cli.ts __tests__/audit/run.smoke.test.ts package.json package-lock.json
git commit -m "feat(audit): runner + cli + audit:scan npm script"
```

---

### Task 7: Generate the real report + reusable fix-workflow doc

**Files:**
- Create: `NEXUS_BIO_INTEGRITY_AUDIT_V2.md` (generated, then committed)
- Create: `scripts/audit/audit-findings.json` (generated)
- Create: `docs/superpowers/FIX_WORKFLOW.md` (reusable Phase 2–3 procedure)

**Interfaces:** none (execution + docs).

- [ ] **Step 1: Run the scanner over the real codebase**

Run: `npm run audit:scan`
Expected: console prints `Audit complete: N suspects → NEXUS_BIO_INTEGRITY_AUDIT_V2.md`, and the two files appear.

- [ ] **Step 2: Sanity-check the output**

Run: `npx jest __tests__/audit/ && head -40 NEXUS_BIO_INTEGRITY_AUDIT_V2.md`
Expected: all audit unit tests PASS; the report shows a severity-sorted table with real `file:line` rows. Confirm the known DO-NOT-TOUCH items (Poisson sampler, id generators) are **absent** from the fabrication rows.

- [ ] **Step 3: Write the reusable fix-workflow doc**

```markdown
<!-- docs/superpowers/FIX_WORKFLOW.md -->
# Phase 2–3 Fix Workflow (per finding)

For each suspect in NEXUS_BIO_INTEGRITY_AUDIT_V2.md, in severity order:

1. **Confirm (Phase 2)** — write a code-level test that a fake fix cannot pass:
   - decoy → change an input, assert the output changes;
   - reproducibility → run twice, assert equal after seeding / differs by seed;
   - fabrication → assert the returned value is input-independent / noise.
   Run it; if it does not demonstrate the defect, mark the row `false-positive` and move on.
2. **Fix (Phase 3), failing-test-first**:
   - reproducibility → thread `SeededRNG` (src/utils/seededRng);
   - decoy → implement the real computation;
   - fabrication → Path B (make it real) if tractable from available code/data, else
     Path A (strip false citation, relabel UI/provenance honestly, set validity tier to
     demo/partial). Never chase physical accuracy — defer that class.
3. **Verify** — the confirm-test now passes; `npx tsc --noEmit` clean; full `npx jest` green.
4. **Record** — flip the row to `fixed`; keep the confirm-test as the standing regression guard.

Respect DO-NOT-TOUCH (Knuth Poisson, id generators, legit seeded/diversity RNG) and
FORBIDDEN files (audit-only).
```

- [ ] **Step 4: Commit**

```bash
git add NEXUS_BIO_INTEGRITY_AUDIT_V2.md scripts/audit/audit-findings.json docs/superpowers/FIX_WORKFLOW.md
git commit -m "chore(audit): generate ranked fabrication report + fix workflow"
```

---

## Definition of Done (Plan A)

- `npm run audit:scan` regenerates `NEXUS_BIO_INTEGRITY_AUDIT_V2.md` deterministically.
- All `__tests__/audit/*` unit tests pass; detectors are pure and hermetic.
- The ranked report lists real suspects with `file:line`, severity-sorted, DO-NOT-TOUCH items excluded from fabrication rows, FORBIDDEN files not audited.
- `FIX_WORKFLOW.md` gives the per-finding confirm→fix→verify loop for Plan B+.
- Next: Plan B drills the ranked list top-down, confirming and fixing each finding until the confirmed-fabrication count is 0.
