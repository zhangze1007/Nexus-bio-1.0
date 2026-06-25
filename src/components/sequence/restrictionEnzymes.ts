/**
 * Restriction Enzyme Finder
 *
 * Database of common restriction enzymes and a finder that scans
 * both Watson and Crick strands for recognition sites.
 */

export interface RestrictionEnzyme {
  name: string;
  sequence: string; // IUPAC
  cutSite: number; // offset from start of recognition sequence (5' cut position)
  overhang: '5prime' | '3prime' | 'blunt';
}

/**
 * 15 common Type II restriction enzymes.
 * Recognition sequences are given 5'->3' on the Watson strand.
 */
export const COMMON_ENZYMES: RestrictionEnzyme[] = [
  { name: 'EcoRI',  sequence: 'GAATTC',   cutSite: 1, overhang: '5prime' },
  { name: 'BamHI',  sequence: 'GGATCC',   cutSite: 1, overhang: '5prime' },
  { name: 'HindIII', sequence: 'AAGCTT',  cutSite: 1, overhang: '5prime' },
  { name: 'XhoI',   sequence: 'CTCGAG',   cutSite: 1, overhang: '5prime' },
  { name: 'NcoI',   sequence: 'CCATGG',   cutSite: 1, overhang: '5prime' },
  { name: 'XbaI',   sequence: 'TCTAGA',   cutSite: 1, overhang: '5prime' },
  { name: 'SpeI',   sequence: 'ACTAGT',   cutSite: 1, overhang: '5prime' },
  { name: 'PstI',   sequence: 'CTGCAG',   cutSite: 5, overhang: '3prime' },
  { name: 'SalI',   sequence: 'GTCGAC',   cutSite: 1, overhang: '5prime' },
  { name: 'KpnI',   sequence: 'GGTACC',   cutSite: 5, overhang: '3prime' },
  { name: 'SmaI',   sequence: 'CCCGGG',   cutSite: 3, overhang: 'blunt' },
  { name: 'EcoRV',  sequence: 'GATATC',   cutSite: 3, overhang: 'blunt' },
  { name: 'NotI',   sequence: 'GCGGCCGC', cutSite: 2, overhang: '5prime' },
  { name: 'SacI',   sequence: 'GAGCTC',   cutSite: 5, overhang: '3prime' },
  { name: 'BglII',  sequence: 'AGATCT',   cutSite: 1, overhang: '5prime' },
];

import type { RestrictionSite } from './types';

/**
 * Compute the reverse complement of a DNA string (uppercase).
 */
function revComp(seq: string): string {
  const comp: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };
  return seq
    .split('')
    .reverse()
    .map((b) => comp[b] ?? b)
    .join('');
}

/**
 * Find all restriction sites in a DNA sequence.
 *
 * Scans both strands. For palindromic enzymes (self-complementary recognition
 * sequences), each position is reported only once (strand=1) since the cut
 * on the Crick strand is at the same phosphodiester bond.
 *
 * @param sequence - DNA sequence (case-insensitive)
 * @param enzymes  - enzyme set to scan (defaults to COMMON_ENZYMES)
 * @returns sorted array of RestrictionSite
 */
export function findRestrictionSites(
  sequence: string,
  enzymes?: RestrictionEnzyme[]
): RestrictionSite[] {
  if (!sequence) return [];

  const upper = sequence.toUpperCase();
  const enzymeSet = enzymes ?? COMMON_ENZYMES;
  const sites: RestrictionSite[] = [];

  for (const enz of enzymeSet) {
    const recog = enz.sequence.toUpperCase();
    const rcRecog = revComp(recog);
    const isPalindromic = recog === rcRecog;

    // Scan Watson strand (5'->3')
    let fromIndex = 0;
    while (true) {
      const pos = upper.indexOf(recog, fromIndex);
      if (pos === -1) break;
      sites.push({
        enzyme: enz.name,
        sequence: recog,
        position: pos,
        strand: 1,
      });
      fromIndex = pos + 1;
    }

    // Scan Crick strand (also 5'->3' on the reverse complement)
    if (!isPalindromic) {
      fromIndex = 0;
      while (true) {
        const pos = upper.indexOf(rcRecog, fromIndex);
        if (pos === -1) break;
        sites.push({
          enzyme: enz.name,
          sequence: rcRecog,
          position: pos,
          strand: -1,
        });
        fromIndex = pos + 1;
      }
    }
  }

  // Sort by position then enzyme name
  sites.sort((a, b) => a.position - b.position || a.enzyme.localeCompare(b.enzyme));
  return sites;
}
