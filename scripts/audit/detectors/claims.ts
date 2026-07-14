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
