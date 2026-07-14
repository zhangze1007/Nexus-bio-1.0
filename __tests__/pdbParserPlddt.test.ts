import { perResiduePlddt } from '../src/utils/pdbParser';

// Build a column-correct PDB ATOM line (bFactor lands at cols 61-66 / index 60-65).
function caLine(resSeq: number, bfac: string, name = ' CA '): string {
  let l = 'ATOM  ';                    // 0-5
  l += String(resSeq).padStart(5);     // 6-10 serial
  l += ' ';                            // 11
  l += name;                           // 12-15 atom name
  l += ' ';                            // 16 altLoc
  l += 'ALA';                          // 17-19 resName
  l += ' ';                            // 20
  l += 'A';                            // 21 chain
  l += String(resSeq).padStart(4);     // 22-25 resSeq
  l += '    ';                         // 26-29
  l += '  11.111';                     // 30-37 x
  l += '  22.222';                     // 38-45 y
  l += '  33.333';                     // 46-53 z
  l += '  1.00';                       // 54-59 occupancy
  l += bfac.padStart(6);               // 60-65 bFactor
  l += '           C';                  // 66-77: element col (parser needs len > 66)
  return l;
}

describe('perResiduePlddt', () => {
  it('extracts per-residue pLDDT from CA-atom B-factors, normalized to [0,1]', () => {
    const pdb = [caLine(1, '85.34'), caLine(2, '42.10')].join('\n');
    expect(perResiduePlddt(pdb)).toEqual([0.85, 0.42]);
  });

  it('reads one value per residue (CA only); ignores backbone N/C and HETATM', () => {
    const pdb = [
      caLine(1, '90.00', ' N  '), // not CA
      caLine(1, '80.00', ' CA '), // residue 1 CA
      'HETATM 1000  O   HOH A 101      50.000  50.000  50.000  1.00 99.00           O',
    ].join('\n');
    expect(perResiduePlddt(pdb)).toEqual([0.8]);
  });

  it('returns [] when there are no CA atoms (no fabricated fallback)', () => {
    expect(perResiduePlddt('HEADER    test\nEND')).toEqual([]);
  });

  it('is deterministic — same PDB in, same values out (not random)', () => {
    const pdb = [caLine(1, '77.00'), caLine(2, '55.00')].join('\n');
    expect(perResiduePlddt(pdb)).toEqual(perResiduePlddt(pdb));
  });
});
