import { makeRng } from "../../utils/rng";

/** One axis of the experiment design space. */
export interface DesignDimension {
  name: string;
  min: number;
  max: number;
  kind: "continuous" | "categorical";
  /** Allowed values when kind === "categorical". */
  choices?: string[];
}

export interface DesignPoint {
  values: Record<string, number | string>;
}

export interface DesignSpace {
  dimensions: DesignDimension[];
}

/**
 * Draw `n` candidate points uniformly at random over the design space. Fully
 * deterministic for a fixed `seed` (routes through makeRng — no bare Math.random).
 */
export function sampleCandidates(space: DesignSpace, n: number, seed: number): DesignPoint[] {
  const rng = makeRng(seed);
  const out: DesignPoint[] = [];
  for (let i = 0; i < n; i++) {
    const values: Record<string, number | string> = {};
    for (const dim of space.dimensions) {
      if (dim.kind === "categorical" && dim.choices && dim.choices.length > 0) {
        values[dim.name] = dim.choices[Math.floor(rng() * dim.choices.length)];
      } else {
        values[dim.name] = dim.min + rng() * (dim.max - dim.min);
      }
    }
    out.push({ values });
  }
  return out;
}

/**
 * Encode a design point to a numeric feature vector in [0, 1] per dimension, so
 * a general GP surrogate can operate on mixed continuous/categorical designs.
 */
export function encodePoint(space: DesignSpace, point: DesignPoint): number[] {
  return space.dimensions.map((dim) => {
    const raw = point.values[dim.name];
    if (dim.kind === "categorical") {
      const choices = dim.choices ?? [];
      const idx = choices.indexOf(String(raw));
      return choices.length > 1 ? Math.max(0, idx) / (choices.length - 1) : 0;
    }
    const v = typeof raw === "number" ? raw : Number(raw);
    const span = dim.max - dim.min;
    return span > 0 ? (v - dim.min) / span : 0;
  });
}
