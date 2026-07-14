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
    const scoreWindow = lines.slice(Math.max(0, i - 2), i + 1).join(' ');
    const returnWindow = lines.slice(i, Math.min(lines.length, i + 3)).join(' ');
    if (SCORE_NAMES.test(scoreWindow) || /\breturn\b/.test(returnWindow)) {
      hits.push({ ...base, klass: 'fabrication', reason: 'random-derived value flows into a reported score/return' });
    } else {
      hits.push({ ...base, klass: 'reproducibility', reason: 'unseeded randomness on a compute path' });
    }
  }
  return hits;
}
