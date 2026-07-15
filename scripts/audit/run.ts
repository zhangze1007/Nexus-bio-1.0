import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';
import { AUDIT_GLOBS } from './config';
import { filterTargets } from './targets';
import { scanRandomness, type RandomnessHit } from './detectors/randomness';
import { scanDecoys, type DecoyHit } from './detectors/decoy';
import { extractClaims, type ClaimInfo } from './detectors/claims';
import { scanCannedReturns, type CannedHit } from './detectors/canned';
import { buildFindings, toMarkdown, type Finding } from './rank';

export function runAudit(root: string): { markdown: string; json: Finding[] } {
  const raw = AUDIT_GLOBS.flatMap((g) => globSync(g, { cwd: root, nodir: true }));
  const { audit } = filterTargets(raw);
  const random: RandomnessHit[] = [];
  const decoy: DecoyHit[] = [];
  const claims: ClaimInfo[] = [];
  const canned: CannedHit[] = [];
  for (const rel of audit) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    random.push(...scanRandomness(src, rel));
    decoy.push(...scanDecoys(src, rel));
    claims.push(extractClaims(src, rel));
    canned.push(...scanCannedReturns(src, rel));
  }
  const findings = buildFindings({ random, decoy, claims, canned });
  return { markdown: toMarkdown(findings), json: findings };
}
