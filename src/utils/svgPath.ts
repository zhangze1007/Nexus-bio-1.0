/**
 * SVG path utilities — shared across tool pages.
 */

/**
 * Generate an SVG path string using Catmull-Rom spline interpolation.
 * Converts a series of points into a smooth cubic Bezier curve.
 *
 * @param pts - Array of [x, y] coordinate pairs
 * @returns SVG path data string (M + C commands)
 */
export function catmullRomPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M ${p[1][0].toFixed(1)} ${p[1][1].toFixed(1)}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[i + 2];
    const cp1x = x1 + (x2 - x0) / 6, cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6, cp2y = y2 - (y3 - y1) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}
