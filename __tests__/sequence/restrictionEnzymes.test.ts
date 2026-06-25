/**
 * Restriction Enzyme Finder — Tests
 *
 * TDD: These tests are written BEFORE the implementation.
 * They should FAIL until restrictionEnzymes.ts is complete.
 */

import {
  findRestrictionSites,
  COMMON_ENZYMES,
  type RestrictionEnzyme,
} from '../../src/components/sequence/restrictionEnzymes';

describe('COMMON_ENZYMES database', () => {
  it('should contain at least 15 common enzymes', () => {
    expect(COMMON_ENZYMES.length).toBeGreaterThanOrEqual(15);
  });

  it('each enzyme should have name, sequence, cutSite, overhang', () => {
    for (const enz of COMMON_ENZYMES) {
      expect(enz.name).toBeTruthy();
      expect(enz.sequence).toBeTruthy();
      expect(typeof enz.cutSite).toBe('number');
      expect(['5prime', '3prime', 'blunt']).toContain(enz.overhang);
    }
  });

  it('should include EcoRI, BamHI, HindIII', () => {
    const names = COMMON_ENZYMES.map((e) => e.name);
    expect(names).toContain('EcoRI');
    expect(names).toContain('BamHI');
    expect(names).toContain('HindIII');
  });
});

describe('findRestrictionSites', () => {
  it('should find EcoRI site (GAATTC) in a known sequence', () => {
    const seq = 'AAGAATTCAAGAATTCAA';
    // GAATTC at positions 2 and 10
    const sites = findRestrictionSites(seq);
    const ecoriSites = sites.filter((s) => s.enzyme === 'EcoRI');
    expect(ecoriSites.length).toBe(2);
    expect(ecoriSites[0].position).toBe(2);
    expect(ecoriSites[1].position).toBe(10);
  });

  it('should find BamHI site (GGATCC)', () => {
    const seq = 'TTAGGATCCTT';
    const sites = findRestrictionSites(seq);
    const bamhiSites = sites.filter((s) => s.enzyme === 'BamHI');
    expect(bamhiSites.length).toBe(1);
    expect(bamhiSites[0].position).toBe(3);
  });

  it('should find HindIII site (AAGCTT)', () => {
    const seq = 'GCAAGCTTGCAAGCTTGC';
    //         012345678901234567
    // AAGCTT at positions 2 and 10
    const sites = findRestrictionSites(seq);
    const hindSites = sites.filter((s) => s.enzyme === 'HindIII');
    expect(hindSites.length).toBe(2);
    expect(hindSites[0].position).toBe(2);
    expect(hindSites[1].position).toBe(10);
  });

  it('should find SmaI (CCCGGG, blunt cut)', () => {
    const seq = 'AACCCCGGGAA';
    //         01234567890
    // CCCGGG at position 3
    const sites = findRestrictionSites(seq);
    const smaiSites = sites.filter((s) => s.enzyme === 'SmaI');
    expect(smaiSites.length).toBe(1);
    expect(smaiSites[0].position).toBe(3);
  });

  it('should find NotI (GCGGCCGC, 8-cutter)', () => {
    const seq = 'AAGCGGCCGCAA';
    const sites = findRestrictionSites(seq);
    const notiSites = sites.filter((s) => s.enzyme === 'NotI');
    expect(notiSites.length).toBe(1);
    expect(notiSites[0].position).toBe(2);
  });

  it('should return empty array for sequence with no sites', () => {
    const seq = 'AAAAAAAAAAAAAAAAAAAA';
    const sites = findRestrictionSites(seq);
    expect(sites.length).toBe(0);
  });

  it('should be case-insensitive', () => {
    const seq = 'aaGAATTCaa';
    const sites = findRestrictionSites(seq);
    const ecoriSites = sites.filter((s) => s.enzyme === 'EcoRI');
    expect(ecoriSites.length).toBe(1);
    expect(ecoriSites[0].position).toBe(2);
  });

  it('should filter to specific enzymes when provided', () => {
    const seq = 'AGAATTCAAGGATCCTTAAGCTT';
    const sites = findRestrictionSites(seq, COMMON_ENZYMES.filter((e) => e.name === 'EcoRI'));
    expect(sites.every((s) => s.enzyme === 'EcoRI')).toBe(true);
  });

  it('should handle overlapping sites', () => {
    // GAATTC contains AATT — but no standard enzyme recognition is a substring overlap issue
    // Let's test two sites close together
    const seq = 'GAATTCGGATCC';
    const sites = findRestrictionSites(seq);
    expect(sites.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle empty sequence', () => {
    const sites = findRestrictionSites('');
    expect(sites).toEqual([]);
  });

  it('should find PstI (CTGCAG, 3prime overhang)', () => {
    const seq = 'AACTGCAGAA';
    const sites = findRestrictionSites(seq);
    const pstSites = sites.filter((s) => s.enzyme === 'PstI');
    expect(pstSites.length).toBe(1);
    expect(pstSites[0].position).toBe(2);
  });

  it('should find XbaI (TCTAGA)', () => {
    const seq = 'AATCTAGAAA';
    const sites = findRestrictionSites(seq);
    const xbaSites = sites.filter((s) => s.enzyme === 'XbaI');
    expect(xbaSites.length).toBe(1);
    expect(xbaSites[0].position).toBe(2);
  });

  it('should assign correct strand for Watson strand hits', () => {
    const seq = 'AAGAATTCAA';
    const sites = findRestrictionSites(seq);
    const ecori = sites.find((s) => s.enzyme === 'EcoRI');
    expect(ecori).toBeDefined();
    expect(ecori!.strand).toBe(1);
  });

  it('should find reverse complement sites on Crick strand', () => {
    // AAGCTT reverse complement is AAGCTT (palindrome for HindIII)
    // GAATTC reverse complement is GAATTC (palindrome for EcoRI)
    // These are palindromic, so same on both strands
    // Let's test a non-palindromic: GCGGCCGC reverse complement is GCGGCCGC (NotI is palindromic too)
    // Most common enzymes are palindromic. Test that it at least doesn't double-count.
    const seq = 'AAGAATTCAA';
    const sites = findRestrictionSites(seq);
    const ecoriSites = sites.filter((s) => s.enzyme === 'EcoRI');
    // Should find exactly 1, not 2 (palindromic = same on both strands)
    expect(ecoriSites.length).toBe(1);
  });
});
