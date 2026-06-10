import { KDTreeIndex, euclideanDistance } from '../src/utils/knnIndex';

describe('KNN Index (K-d Tree)', () => {
  // --- euclideanDistance ---
  describe('euclideanDistance', () => {
    it('returns 0 for identical points', () => {
      expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
    });

    it('computes correct distance for simple 2D points', () => {
      // 3-4-5 triangle
      expect(euclideanDistance([0, 0], [3, 4])).toBeCloseTo(5);
    });

    it('computes correct distance for higher dimensions', () => {
      expect(euclideanDistance([1, 0, 0], [0, 1, 0])).toBeCloseTo(Math.SQRT2);
    });
  });

  // --- build ---
  describe('build', () => {
    it('builds an index from a set of points', () => {
      const points: number[][] = [
        [2, 3],
        [5, 4],
        [9, 6],
        [4, 7],
        [8, 1],
        [7, 2],
      ];
      const index = new KDTreeIndex(points);
      expect(index.size()).toBe(6);
    });

    it('handles a single point', () => {
      const index = new KDTreeIndex([[42, 99]]);
      expect(index.size()).toBe(1);
    });

    it('handles empty point set', () => {
      const index = new KDTreeIndex([]);
      expect(index.size()).toBe(0);
    });
  });

  // --- query: nearest neighbor (k=1) ---
  describe('query k=1 (nearest neighbor)', () => {
    const points: number[][] = [
      [2, 3],
      [5, 4],
      [9, 6],
      [4, 7],
      [8, 1],
      [7, 2],
    ];
    const index = new KDTreeIndex(points);

    it('finds the single nearest neighbor', () => {
      const results = index.query([5, 5], 1);
      expect(results).toHaveLength(1);
      expect(results[0].point).toEqual([5, 4]);
      expect(results[0].distance).toBeCloseTo(1);
    });

    it('returns exact match with distance 0', () => {
      const results = index.query([2, 3], 1);
      expect(results).toHaveLength(1);
      expect(results[0].point).toEqual([2, 3]);
      expect(results[0].distance).toBe(0);
    });
  });

  // --- query: k nearest neighbors ---
  describe('query k=3 (multiple nearest neighbors)', () => {
    const points: number[][] = [
      [2, 3],
      [5, 4],
      [9, 6],
      [4, 7],
      [8, 1],
      [7, 2],
    ];
    const index = new KDTreeIndex(points);

    it('returns k results sorted by distance', () => {
      const results = index.query([5, 5], 3);
      expect(results).toHaveLength(3);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
      }
    });

    it('returns correct nearest 3 points for query [5,5]', () => {
      const results = index.query([5, 5], 3);
      const returnedPoints = results.map((r) => r.point);
      // [5,4] distance=1, [4,7] distance~=2.236
      // third-nearest: [2,3] and [7,2] are both at sqrt(13)~=3.606
      expect(returnedPoints).toContainEqual([5, 4]);
      expect(returnedPoints).toContainEqual([4, 7]);
      const third = returnedPoints[2];
      expect([[2, 3], [7, 2]]).toContainEqual(third);
    });
  });

  // --- edge cases ---
  describe('edge cases', () => {
    it('returns empty array when querying empty index', () => {
      const index = new KDTreeIndex([]);
      const results = index.query([0, 0], 5);
      expect(results).toEqual([]);
    });

    it('returns all points when k > n', () => {
      const points: number[][] = [[1, 1], [2, 2], [3, 3]];
      const index = new KDTreeIndex(points);
      const results = index.query([2, 2], 10);
      expect(results).toHaveLength(3);
      // sorted by distance
      expect(results[0].point).toEqual([2, 2]);
      expect(results[0].distance).toBe(0);
    });

    it('handles 1-dimensional points', () => {
      const points: number[][] = [[10], [20], [30], [25]];
      const index = new KDTreeIndex(points);
      const results = index.query([22], 2);
      expect(results).toHaveLength(2);
      expect(results[0].point).toEqual([20]);
      expect(results[0].distance).toBeCloseTo(2);
      expect(results[1].point).toEqual([25]);
      expect(results[1].distance).toBeCloseTo(3);
    });

    it('handles high-dimensional points', () => {
      const dim = 10;
      const points: number[][] = [];
      for (let i = 0; i < 50; i++) {
        points.push(Array.from({ length: dim }, () => Math.random()));
      }
      const index = new KDTreeIndex(points);
      const queryPoint = Array.from({ length: dim }, () => 0.5);
      const results = index.query(queryPoint, 5);
      expect(results).toHaveLength(5);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
      }
    });
  });
});
