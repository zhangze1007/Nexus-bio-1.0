import type { RandomnessHit } from './detectors/randomness';
import type { DecoyHit } from './detectors/decoy';
import type { ClaimInfo } from './detectors/claims';
import type { CannedHit } from './detectors/canned';

export interface Finding {
  file: string;
  line: number;
  klass: 'fabrication' | 'canned' | 'decoy' | 'reproducibility';
  reason: string;
  severity: number;
}

export function buildFindings(input: {
  random: RandomnessHit[];
  decoy: DecoyHit[];
  claims: ClaimInfo[];
  canned?: CannedHit[];
}): Finding[] {
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
  // Canned = function uses NONE of its params → input-independent output. In a file
  // that claims real science this is a top-severity fabrication (fixed data under a
  // citation); elsewhere it is a likely stub/default (severity 3).
  for (const c of input.canned ?? []) {
    findings.push({
      file: c.file,
      line: c.line,
      klass: 'canned',
      reason: `${c.fn}() uses NONE of its parameters — returns input-independent (canned) output`,
      severity: claiming.has(c.file) ? 5 : 3,
    });
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
