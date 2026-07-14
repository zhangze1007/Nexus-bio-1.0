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
