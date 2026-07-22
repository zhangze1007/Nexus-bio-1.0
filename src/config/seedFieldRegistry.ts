/**
 * Seed-field registry — the SINGLE source of truth for which tool seeds are
 * learnable (re-seedable from approved learned deltas), their clamp bounds, and
 * their Bayesian prior variance.
 *
 * Both the P0-2 falsification mapping (`toLearnedDelta`) and the P2-1 application
 * layer (`workbenchDataflow`) read keys from here, so the two can never drift
 * apart again (the P2-1.0 reconciliation).
 */

export interface SeedField {
  key: string;
  toolId: string;
  kind: "prior" | "bound" | "weight";
  /** Clamp lower bound. */
  min: number;
  /** Clamp upper bound. */
  max: number;
  /** Bayesian prior variance for posterior updates (P2-1). */
  priorVariance?: number;
}

export const SEED_FIELDS: SeedField[] = [
  // fbasim
  { key: "fbasim.glucoseUptake", toolId: "fbasim", kind: "prior", min: 4, max: 20, priorVariance: 4 },
  { key: "fbasim.oxygenUptake", toolId: "fbasim", kind: "prior", min: 2, max: 20, priorVariance: 4 },
  // catdes
  { key: "catdes.requiredFlux", toolId: "catdes", kind: "prior", min: 0.15, max: 3.2, priorVariance: 0.2 },
  { key: "catdes.designCount", toolId: "catdes", kind: "prior", min: 6, max: 14, priorVariance: 2 },
  // dyncon controller + hill
  { key: "dyncon.controller.kp", toolId: "dyncon", kind: "prior", min: 0.5, max: 8, priorVariance: 1 },
  { key: "dyncon.controller.ki", toolId: "dyncon", kind: "prior", min: 0.05, max: 2.5, priorVariance: 0.3 },
  { key: "dyncon.controller.kd", toolId: "dyncon", kind: "prior", min: 0.02, max: 1.5, priorVariance: 0.2 },
  { key: "dyncon.controller.setpoint", toolId: "dyncon", kind: "prior", min: 0.2, max: 0.9, priorVariance: 0.1 },
  { key: "dyncon.hill.vmax", toolId: "dyncon", kind: "prior", min: 0.2, max: 2, priorVariance: 0.3 },
  { key: "dyncon.hill.kd", toolId: "dyncon", kind: "prior", min: 5, max: 200, priorVariance: 30 },
  { key: "dyncon.hill.n", toolId: "dyncon", kind: "prior", min: 1, max: 4, priorVariance: 0.5 },
  // cellfree
  { key: "cellfree.params.temperature", toolId: "cellfree", kind: "prior", min: 20, max: 42, priorVariance: 4 },
  { key: "cellfree.params.simulationTime", toolId: "cellfree", kind: "prior", min: 180, max: 420, priorVariance: 40 },
  { key: "cellfree.params.ribosomeTotal", toolId: "cellfree", kind: "prior", min: 300, max: 900, priorVariance: 100 },
  // First bound/weight application paths (P2-1).
  { key: "fbasim.fluxBounds.glucose", toolId: "fbasim", kind: "bound", min: 0, max: 25 },
  { key: "dyncon.weights.tracking", toolId: "dyncon", kind: "weight", min: 0, max: 5, priorVariance: 0.5 },
];

const BY_KEY = new Map(SEED_FIELDS.map((f) => [f.key, f] as const));

export function seedField(key: string): SeedField | undefined {
  return BY_KEY.get(key);
}

export function seedFieldsFor(toolId: string, kind?: SeedField["kind"]): SeedField[] {
  return SEED_FIELDS.filter((f) => f.toolId === toolId && (kind === undefined || f.kind === kind));
}

export function isRegisteredSeedField(key: string): boolean {
  return BY_KEY.has(key);
}

/**
 * The canonical learnable prior a falsification nudge targets, per source tool.
 * `toLearnedDelta` reads keys from here so its proposals always land on a real,
 * whitelisted seed field (fixing the P2-1.0 silent no-op).
 */
export const PRIMARY_PRIOR_KEY: Record<string, string> = {
  cellfree: "cellfree.params.ribosomeTotal",
  fbasim: "fbasim.glucoseUptake",
  dyncon: "dyncon.controller.kp",
};
