import type { ProtocolManifest } from "../../types/protocolManifest";

/** One labware instance placed on a deck slot. */
export interface LabwareDef {
  id: string;
  /** opentrons_shared_data load name, e.g. "nest_96_wellplate_200ul_flat". */
  loadName: string;
  /** OT-2 deck slot (1–11; 12 is the fixed trash). */
  slot: number;
  /** Number of addressable wells. */
  wells: number;
}

export interface PipetteDef {
  id: string;
  model: string;
  mount: "left" | "right";
  /** Minimum reliable aspirate volume (µL). */
  minUl: number;
  /** Maximum aspirate volume (µL). */
  maxUl: number;
}

export interface DeckLayout {
  labware: LabwareDef[];
  pipettes: PipetteDef[];
}

/** Accepts A–P rows and 1–24 columns (covers 24/96/384-well plates & racks). */
const WELL_RE = /^[A-P](?:[1-9]|1[0-9]|2[0-4])$/;

/**
 * Structural deck validation: slot/mount conflicts and range, at least one
 * pipette, every plate-map labware present on the deck, valid well coordinates
 * within capacity, and the required control/blank placeholders. Returns a list
 * of human-readable errors (empty = valid).
 */
export function validateDeck(layout: DeckLayout, manifest: ProtocolManifest): string[] {
  const errors: string[] = [];

  const slotOwner = new Map<number, string>();
  for (const lw of layout.labware) {
    if (lw.slot < 1 || lw.slot > 11) {
      errors.push(`Labware "${lw.id}" is on slot ${lw.slot}, outside the OT-2 deck range (1–11).`);
    }
    const owner = slotOwner.get(lw.slot);
    if (owner) {
      errors.push(`Deck slot ${lw.slot} conflict: "${owner}" and "${lw.id}" occupy the same slot.`);
    } else {
      slotOwner.set(lw.slot, lw.id);
    }
  }

  if (layout.pipettes.length === 0) {
    errors.push("Deck has no pipette mounted.");
  }
  const mountOwner = new Map<string, string>();
  for (const p of layout.pipettes) {
    const owner = mountOwner.get(p.mount);
    if (owner) {
      errors.push(`Pipette mount "${p.mount}" conflict: "${owner}" and "${p.id}" share a mount.`);
    } else {
      mountOwner.set(p.mount, p.id);
    }
  }

  const capacityById = new Map(layout.labware.map((l) => [l.id, l.wells] as const));
  for (const wa of manifest.plateMap) {
    if (!capacityById.has(wa.labwareId)) {
      errors.push(`Well ${wa.well}: labware "${wa.labwareId}" is not present on the deck.`);
      continue;
    }
    if (!WELL_RE.test(wa.well)) {
      errors.push(`Well "${wa.well}" (labware "${wa.labwareId}") is not a valid plate coordinate.`);
      continue;
    }
    const cap = capacityById.get(wa.labwareId) ?? 0;
    if (wellSequentialIndex(wa.well) >= cap) {
      errors.push(`Well "${wa.well}" exceeds labware "${wa.labwareId}" capacity (${cap} wells).`);
    }
  }

  const roles = new Set(manifest.plateMap.map((w) => w.role));
  if (!roles.has("control-neg")) {
    errors.push("Plate map has no negative control (a control-neg well is required).");
  }
  if (!roles.has("blank")) {
    errors.push("Plate map has no blank well (a blank well is required).");
  }

  return errors;
}

/**
 * Volume ↔ pipette-range consistency for a set of transfer volumes (µL):
 * a volume above the largest pipette's capacity, or a non-zero volume below the
 * smallest pipette's minimum, cannot be executed on this deck.
 */
export function validatePipetteVolumes(pipettes: PipetteDef[], volumes: number[]): string[] {
  const errors: string[] = [];
  if (pipettes.length === 0) {
    if (volumes.some((v) => v > 0)) errors.push("No pipette available to perform liquid transfers.");
    return errors;
  }
  const maxCap = Math.max(...pipettes.map((p) => p.maxUl));
  const minCap = Math.min(...pipettes.map((p) => p.minUl));
  volumes.forEach((v, i) => {
    if (v > maxCap) {
      errors.push(`Step ${i + 1}: volume ${v} µL exceeds the largest pipette capacity (${maxCap} µL).`);
    } else if (v > 0 && v < minCap) {
      errors.push(`Step ${i + 1}: volume ${v} µL is below the smallest pipette minimum (${minCap} µL).`);
    }
  });
  return errors;
}

/** Column-major sequential index of a well coordinate assuming 8 rows (A–H). */
function wellSequentialIndex(well: string): number {
  const row = well.charCodeAt(0) - 65; // A→0
  const col = Number.parseInt(well.slice(1), 10) - 1;
  if (Number.isNaN(col) || row < 0) return Number.POSITIVE_INFINITY;
  return col * 8 + row;
}
