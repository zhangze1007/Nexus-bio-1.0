/**
 * Shared bioinformatics visualization utilities.
 * Used by ScSpatialPage (UMAP), MultiOPage (embedding), etc.
 */

/** Convex hull using monotone chain (Andrew's algorithm). O(n log n). */
export function computeConvexHull(
  pts: Array<{ sx: number; sy: number }>,
): Array<{ sx: number; sy: number }> {
  if (pts.length <= 2) return pts.slice();

  const sorted = [...pts].sort((a, b) => a.sx !== b.sx ? a.sx - b.sx : a.sy - b.sy);

  const cross = (
    o: { sx: number; sy: number },
    a: { sx: number; sy: number },
    b: { sx: number; sy: number },
  ) => (a.sx - o.sx) * (b.sy - o.sy) - (a.sy - o.sy) * (b.sx - o.sx);

  const lower: typeof pts = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: typeof pts = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** Expand a convex hull outward from its centroid by `padding` pixels. */
export function expandHull(
  hull: Array<{ sx: number; sy: number }>,
  padding: number,
): Array<{ sx: number; sy: number }> {
  if (hull.length === 0) return hull;
  const cx = hull.reduce((s, p) => s + p.sx, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.sy, 0) / hull.length;
  return hull.map((p) => {
    const dx = p.sx - cx;
    const dy = p.sy - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { sx: p.sx + (dx / len) * padding, sy: p.sy + (dy / len) * padding };
  });
}
