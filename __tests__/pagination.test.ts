import { buildPageRange } from '../src/utils/pagination';

describe('buildPageRange', () => {
  it('returns all pages when totalPages <= 7', () => {
    expect(buildPageRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPageRange(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(buildPageRange(1, 1)).toEqual([1]);
  });

  it('shows left pages with right ellipsis when near start', () => {
    expect(buildPageRange(2, 20)).toEqual([1, 2, 3, 4, 5, 'ellipsis-right', 20]);
  });

  it('shows right pages with left ellipsis when near end', () => {
    expect(buildPageRange(18, 20)).toEqual([1, 'ellipsis-left', 16, 17, 18, 19, 20]);
  });

  it('shows both ellipses when in middle', () => {
    expect(buildPageRange(10, 20)).toEqual([1, 'ellipsis-left', 9, 10, 11, 'ellipsis-right', 20]);
  });

  it('handles page 4 boundary', () => {
    expect(buildPageRange(4, 20)).toEqual([1, 2, 3, 4, 5, 'ellipsis-right', 20]);
  });

  it('handles page 5 (middle mode)', () => {
    expect(buildPageRange(5, 20)).toEqual([1, 'ellipsis-left', 4, 5, 6, 'ellipsis-right', 20]);
  });

  it('always includes first and last page', () => {
    for (let p = 1; p <= 50; p++) {
      const range = buildPageRange(p, 50);
      expect(range[0]).toBe(1);
      expect(range[range.length - 1]).toBe(50);
    }
  });

  it('always includes current page', () => {
    for (let p = 1; p <= 50; p++) {
      const range = buildPageRange(p, 50);
      expect(range).toContain(p);
    }
  });
});
