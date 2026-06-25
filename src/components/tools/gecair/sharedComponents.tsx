"use client";
import type { GateType } from "../../../data/mockGECAIR";
import { hillInhibition } from "../../../data/mockGECAIR";
import { THEME } from "../../../theme";

/** mRNA/protein degradation rate (1/min) — Alon, An Introduction to Systems Biology (2007) */
export const PROTEIN_DEGRADATION_RATE = 0.0075;

/** PRNG seed offset for Gillespie ensemble runs — ensures reproducible stochastic trajectories */
export const GILLESPIE_SEED_OFFSET = 42;

export const PART_COLORS: Record<string, string> = {
  promoter: THEME.lilac,
  rbs: THEME.sky,
  cds: THEME.apricot,
  terminator: THEME.coral,
};

export const TRUTH_TABLE = [
  { A: 0, B: 0 },
  { A: 0, B: 1 },
  { A: 1, B: 0 },
  { A: 1, B: 1 },
];

export function viridisColor(t: number): string {
  // Canonical matplotlib viridis palette (5 stops)
  const stops: [number, number, number][] = [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 98],
    [253, 231, 37],
  ];
  const scaled = Math.max(0, Math.min(1, t)) * 4;
  const lo = Math.floor(scaled),
    hi = Math.min(4, lo + 1),
    f = scaled - lo;
  const [r1, g1, b1] = stops[lo],
    [r2, g2, b2] = stops[hi];
  return `rgb(${Math.round(r1 + (r2 - r1) * f)},${Math.round(g1 + (g2 - g1) * f)},${Math.round(b1 + (b2 - b1) * f)})`;
}

/**
 * resolveGateOutput — combinatorial promoter gate model.
 *
 * Inputs a, b are repressor-inhibited expression levels (0–1, from hillInhibition).
 * These are ALREADY transformed — do NOT apply Hill functions again (double-Hill
 * transformation collapses the dynamic range to ~0.2–0.3, losing discriminability).
 *
 * AND:  a · b       (joint probability; both expression channels must be high)
 * OR:   a + b − a·b (union probability; at least one channel sufficient)
 * NAND: 1 − a·b     (complement of AND)
 * NOT:  hillInhibition(a) applied to raw input (single repressor)
 *
 * Reference: Buchler et al. (2003) PNAS — combinatorial gene regulation
 */
export function resolveGateOutput(a: number, b: number, gateType: GateType) {
  if (gateType === "AND") return a * b;
  if (gateType === "OR") return a + b - a * b;
  if (gateType === "NAND") return 1 - a * b;
  return hillInhibition(a); // NOT: re-apply Hill repression to raw signal
}
