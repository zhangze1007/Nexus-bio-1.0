/**
 * Protocol manifest — pins design identity into physical wells so instrument
 * readings can be joined back to predictions/experiments (the read-back keys
 * for P0-2's prediction↔measurement matching). Exported alongside the robot
 * protocol; on read-back, `well → { sampleId, constructId, batchId }`.
 */

export type WellRole = "sample" | "blank" | "control-pos" | "control-neg";

export interface WellAssignment {
  /** Plate coordinate, e.g. "A1". */
  well: string;
  /** Labware instance on the deck (must match a DeckLayout labware id). */
  labwareId: string;
  /** → ExperimentRecordV1.sampleId */
  sampleId: string;
  /** → ExperimentRecordV1.constructId */
  constructId: string;
  role: WellRole;
  barcode?: string;
}

export interface ProtocolManifest {
  schemaVersion: "protocol-manifest-v1";
  manifestId: string;
  /** → ExperimentRecordV1.batchId */
  batchId: string;
  dbtlRunId: string;
  plateMap: WellAssignment[];
  createdAt: string;
}

const PLATE_ROWS = "ABCDEFGHIJKLMNOP";

/**
 * Column-major well name for a sequential index (A1, B1, … H1, A2, …),
 * matching protocolGenerator's default well ordering. `rows`/`cols` default
 * to a 96-well plate (8×12).
 */
export function wellName(index: number, rows = 8, cols = 12): string {
  const total = rows * cols;
  const i = ((index % total) + total) % total;
  const r = i % rows;
  const c = Math.floor(i / rows) % cols;
  return `${PLATE_ROWS[r]}${c + 1}`;
}

/** Reverse lookup: physical well → its assignment (the read-back primitive). */
export function lookupWell(manifest: ProtocolManifest, well: string): WellAssignment | undefined {
  return manifest.plateMap.find((w) => w.well === well);
}

/** Reverse lookup: physical well → constructId (undefined if the well is unassigned). */
export function constructIdForWell(manifest: ProtocolManifest, well: string): string | undefined {
  return lookupWell(manifest, well)?.constructId;
}

/**
 * Lay out samples column-major on one labware, then append a negative control
 * and a blank in the next free wells — guaranteeing the acceptance rule that a
 * plate map carries at least one control-neg and one blank.
 */
export function buildPlateMap(
  samples: Array<{ sampleId: string; constructId: string; barcode?: string }>,
  labwareId: string,
): WellAssignment[] {
  const plate: WellAssignment[] = samples.map((s, i) => ({
    well: wellName(i),
    labwareId,
    sampleId: s.sampleId,
    constructId: s.constructId,
    role: "sample" as const,
    ...(s.barcode ? { barcode: s.barcode } : {}),
  }));
  const n = samples.length;
  plate.push({ well: wellName(n), labwareId, sampleId: "ctrl-neg", constructId: "control-neg", role: "control-neg" });
  plate.push({ well: wellName(n + 1), labwareId, sampleId: "blank", constructId: "blank", role: "blank" });
  return plate;
}

/** Assemble a manifest with a deterministic id (no unseeded randomness). */
export function buildManifest(spec: {
  batchId: string;
  dbtlRunId: string;
  plateMap: WellAssignment[];
  manifestId?: string;
  createdAt?: string;
}): ProtocolManifest {
  return {
    schemaVersion: "protocol-manifest-v1",
    manifestId: spec.manifestId ?? `manifest-${spec.batchId}-${spec.dbtlRunId}`,
    batchId: spec.batchId,
    dbtlRunId: spec.dbtlRunId,
    plateMap: spec.plateMap,
    createdAt: spec.createdAt ?? new Date().toISOString(),
  };
}
