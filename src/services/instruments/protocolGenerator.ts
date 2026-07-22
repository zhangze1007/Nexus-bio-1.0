/**
 * protocolGenerator.ts
 *
 * Pure TypeScript module for generating lab protocols in two formats:
 *  - Opentrons OT-2 Python scripts (API level 2.15)
 *  - Human-readable manual bench protocol text
 *
 * Also includes a validation pass that catches missing fields, physically
 * implausible values, and ordering issues before a protocol is run.
 */

import type { ProtocolManifest, WellAssignment } from "../../types/protocolManifest";
import { type DeckLayout, validateDeck, validatePipetteVolumes } from "./deckModel";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/** One atomic step in a wet-lab protocol. */
export interface ProtocolStep {
  /**
   * Step category.  Common values: 'transfer', 'pipette', 'mix', 'incubate',
   * 'centrifuge', 'wait', 'heat', 'cool', 'vortex', 'plate', 'dilute'.
   * The type drives both the Python code emitted and the manual formatting.
   */
  type: string;
  /** Free-text description shown in the manual protocol. */
  description: string;
  /** Reagent or sample name (e.g. "LB broth", "DNA template", "dH2O"). */
  reagent: string;
  /** Volume in microlitres (uL).  0 means "not applicable" (e.g. incubation). */
  volume: number;
  /** Duration in seconds.  0 means "not applicable" (e.g. a simple transfer). */
  duration: number;
  /** Temperature in degrees Celsius.  NaN or 0 means "room temperature / not set". */
  temperature: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/*  Opentrons Protocol Generation                                             */
/* -------------------------------------------------------------------------- */

/**
 * Map a user-facing step type to the Opentrons API call(s) that implement it.
 * Returns an array of Python code lines (indented at the function body level).
 */
function emitOpentronsStep(
  step: ProtocolStep,
  index: number,
  labwareMap: Map<string, string>,
  pipetteVar: string,
  plateMap?: WellAssignment[],
): string[] {
  const lines: string[] = [];
  const vol = step.volume > 0 ? step.volume : 10;
  const lc = liquidClass(step.reagent);
  const touch = lc.touchTip ? ", touch_tip=True" : "";

  // With a manifest plate map, wells come from the manifest and the labware var
  // from labwareMap (no hard-coded A1/B1); otherwise use the default plates.
  let srcVar = "source_plate";
  let srcWell = wellId(index);
  let destVar = "dest_plate";
  let destWell = wellId(index + 1);
  if (plateMap && plateMap.length > 0) {
    const src = plateMap[index % plateMap.length];
    const dest = plateMap[(index + 1) % plateMap.length];
    srcVar = labwareMap.get(src.labwareId) ?? srcVar;
    srcWell = src.well;
    destVar = labwareMap.get(dest.labwareId) ?? destVar;
    destWell = dest.well;
  }
  const flowLines = [
    `    ${pipetteVar}.flow_rate.aspirate = ${lc.flowRate}`,
    `    ${pipetteVar}.flow_rate.dispense = ${lc.flowRate}`,
  ];

  switch (step.type.toLowerCase()) {
    case "transfer":
    case "pipette":
    case "dilute":
    case "plate": {
      lines.push(
        `    # Step ${index + 1}: ${step.description} [${lc.name}]`,
        ...flowLines,
        `    ${pipetteVar}.transfer(${vol}, ${srcVar}['${srcWell}'], ${destVar}['${destWell}'], new_tip='always'${touch})`,
      );
      break;
    }

    case "mix": {
      const cycles = Math.max(3, Math.round(step.duration / 5));
      lines.push(
        `    # Step ${index + 1}: ${step.description} [${lc.name}]`,
        ...flowLines,
        `    ${pipetteVar}.mix(${cycles}, ${vol}, ${srcVar}['${srcWell}'])`,
      );
      break;
    }

    case "incubate":
    case "heat":
    case "cool": {
      const temp = step.temperature > 0 ? step.temperature : 37;
      const minutes = step.duration > 0 ? Math.ceil(step.duration / 60) : 5;
      lines.push(
        `    # Step ${index + 1}: ${step.description}`,
        `    temp_mod = protocol.load_module('temperature module gen2', 10)`,
        `    temp_mod.set_temperature(${temp})`,
        `    protocol.delay(minutes=${minutes})`,
        `    temp_mod.deactivate()`,
      );
      break;
    }

    case "wait": {
      const minutes = step.duration > 0 ? Math.ceil(step.duration / 60) : 1;
      lines.push(`    # Step ${index + 1}: ${step.description}`, `    protocol.delay(minutes=${minutes})`);
      break;
    }

    case "centrifuge": {
      const minutes = step.duration > 0 ? Math.ceil(step.duration / 60) : 5;
      lines.push(
        `    # Step ${index + 1}: ${step.description}`,
        `    # NOTE: Centrifugation requires manual intervention on OT-2.`,
        `    protocol.delay(minutes=${minutes})  # simulate centrifuge step`,
      );
      break;
    }

    case "vortex": {
      const seconds = step.duration > 0 ? step.duration : 10;
      lines.push(
        `    # Step ${index + 1}: ${step.description}`,
        `    protocol.delay(seconds=${seconds})  # vortex step — manual on OT-2`,
      );
      break;
    }

    default: {
      // Generic liquid-handling fallback
      lines.push(
        `    # Step ${index + 1}: ${step.description} [${lc.name}]`,
        ...flowLines,
        `    ${pipetteVar}.transfer(${vol}, ${srcVar}['${srcWell}'], ${destVar}['${destWell}'], new_tip='always'${touch})`,
      );
      break;
    }
  }

  // If the step has a non-zero, non-room-temp temperature and we didn't
  // already emit a temperature module block, attach a comment.
  if (step.temperature > 0 && !["incubate", "heat", "cool"].includes(step.type.toLowerCase())) {
    lines.push(`    # Temperature target: ${step.temperature} °C`);
  }

  return lines;
}

/**
 * Convert a 0-based step index to a microplate well id (A1, B1, ... H12).
 * Wraps after H12 back to A1.
 */
function wellId(index: number): string {
  const row = "ABCDEFGH";
  const r = index % 8;
  const c = (Math.floor(index / 8) % 12) + 1;
  return `${row[r]}${c}`;
}

/**
 * Deterministic liquid-class heuristic → aspirate/dispense flow rate (µL/s) and
 * whether to touch-tip. Addresses the prior "no liquid class" limitation; no
 * randomness (compute path).
 */
function liquidClass(reagent: string): { name: string; flowRate: number; touchTip: boolean } {
  const r = (reagent ?? "").toLowerCase();
  if (/glycerol|dmso|peg|viscous|polyethylene/.test(r)) return { name: "viscous", flowRate: 30, touchTip: true };
  if (/ethanol|isopropanol|methanol|acetone|volatile/.test(r)) return { name: "volatile", flowRate: 60, touchTip: false };
  if (/cell|culture|competent|bacter|coli|yeast/.test(r)) return { name: "cell-suspension", flowRate: 50, touchTip: true };
  return { name: "aqueous", flowRate: 100, touchTip: false };
}

/** Sanitize a labware/pipette id into a valid python identifier. */
function pyVar(id: string): string {
  const s = id
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^([0-9])/, "_$1")
    .toLowerCase();
  return s.length > 0 ? s : "labware";
}

/**
 * Generate an Opentrons OT-2 Python protocol script.
 *
 * The output is a self-contained Python file that can be uploaded directly to
 * the Opentrons App.  It declares metadata, loads standard labware (96-well
 * flat plate, 20 uL tip rack), and translates each {@link ProtocolStep} into
 * the corresponding API call.
 */
export function generateOpentronsProtocol(
  steps: ProtocolStep[],
  manifest?: ProtocolManifest,
  layout?: DeckLayout,
): string {
  if (steps.length === 0) {
    return [
      "# Empty protocol — no steps provided.",
      "from opentrons import protocol_api",
      "",
      "metadata = {'protocolName': 'Empty Protocol', 'apiLevel': '2.15'}",
      "",
      "def run(protocol: protocol_api.ProtocolContext):",
      "    pass",
    ].join("\n");
  }

  const labwareMap = new Map<string, string>();
  const plateMap = manifest?.plateMap;
  let pipetteVar = "pipette";
  let header: string[];

  if (manifest && layout && layout.labware.length > 0) {
    // Deck-driven header: load real labware/pipettes from the layout and build
    // labwareMap (labwareId → python var) consumed by emitOpentronsStep.
    const h: string[] = [
      "from opentrons import protocol_api",
      "",
      "metadata = {",
      "    'protocolName': 'Nexus-Bio Generated Protocol',",
      "    'author': 'Nexus-Bio Protocol Generator',",
      `    'description': 'Auto-generated Opentrons protocol (manifest ${manifest.manifestId})',`,
      "    'apiLevel': '2.15'",
      "}",
      "",
      "",
      "def run(protocol: protocol_api.ProtocolContext):",
      "    # ---- Labware (from deck layout) ----",
    ];
    const tipracks: string[] = [];
    for (const lw of layout.labware) {
      const v = pyVar(lw.id);
      labwareMap.set(lw.id, v);
      h.push(`    ${v} = protocol.load_labware('${lw.loadName}', '${lw.slot}')`);
      if (/tiprack/i.test(lw.loadName)) tipracks.push(v);
    }
    const tipArg = tipracks.length > 0 ? `, tip_racks=[${tipracks.join(", ")}]` : "";
    h.push("    # ---- Pipettes ----");
    layout.pipettes.forEach((p, i) => {
      const v = pyVar(p.id);
      if (i === 0) pipetteVar = v;
      h.push(`    ${v} = protocol.load_instrument('${p.model}', '${p.mount}'${tipArg})`);
    });
    h.push("", "    # ---- Steps ----");
    header = h;
  } else {
    header = [
      "from opentrons import protocol_api",
      "",
      "metadata = {",
      "    'protocolName': 'Nexus-Bio Generated Protocol',",
      "    'author': 'Nexus-Bio Protocol Generator',",
      "    'description': 'Auto-generated Opentrons protocol',",
      "    'apiLevel': '2.15'",
      "}",
      "",
      "",
      "def run(protocol: protocol_api.ProtocolContext):",
      "    # ---- Labware ----",
      "    source_plate = protocol.load_labware('corning_96_wellplate_360ul_flat', '1')",
      "    dest_plate   = protocol.load_labware('corning_96_wellplate_360ul_flat', '2')",
      "    tiprack_20   = protocol.load_labware('opentrons_96_tiprack_20ul', '3')",
      "    pipette      = protocol.load_instrument('p20_single_gen2', 'left', tip_racks=[tiprack_20])",
      "",
      "    # ---- Steps ----",
    ];
  }

  const bodyLines: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const stepLines = emitOpentronsStep(steps[i], i, labwareMap, pipetteVar, plateMap);
    bodyLines.push(...stepLines, "");
  }

  // Remove trailing blank line
  if (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") {
    bodyLines.pop();
  }

  return [...header, ...bodyLines].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Manual Protocol Generation                                                */
/* -------------------------------------------------------------------------- */

/**
 * Format a duration (in seconds) into a human-readable string.
 */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs} sec`;
}

/**
 * Generate a human-readable manual bench protocol.
 *
 * Each step is numbered and includes all relevant parameters.  The output is
 * plain text suitable for printing or pasting into an electronic lab notebook.
 */
export function generateManualProtocol(steps: ProtocolStep[]): string {
  if (steps.length === 0) {
    return "Manual Protocol\n===============\n\n(No steps defined.)";
  }

  const lines: string[] = [
    "Manual Protocol",
    "===============",
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Total steps: ${steps.length}`,
    "",
  ];

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    lines.push(`Step ${i + 1}  [${s.type.toUpperCase()}]`);
    lines.push(`  Description : ${s.description}`);
    if (s.reagent) lines.push(`  Reagent     : ${s.reagent}`);
    if (s.volume > 0) lines.push(`  Volume      : ${s.volume} uL`);
    if (s.duration > 0) lines.push(`  Duration    : ${formatDuration(s.duration)}`);
    if (s.temperature > 0) lines.push(`  Temperature : ${s.temperature} °C`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const VALID_STEP_TYPES = new Set([
  "transfer",
  "pipette",
  "mix",
  "incubate",
  "centrifuge",
  "wait",
  "heat",
  "cool",
  "vortex",
  "plate",
  "dilute",
]);

/**
 * Validate a sequence of protocol steps.
 *
 * Checks:
 *  - Steps array is non-empty
 *  - Every step has a non-empty type, description, and reagent
 *  - type is one of the recognised categories
 *  - volume is non-negative and within the pipette range (0–1000 uL)
 *  - duration is non-negative
 *  - temperature is in the range -20 to 150 °C (or 0 for "not set")
 *  - No duplicate consecutive steps with identical reagent and volume
 */
export function validateProtocol(steps: ProtocolStep[]): ValidationResult {
  const errors: string[] = [];

  if (steps.length === 0) {
    errors.push("Protocol must contain at least one step.");
    return { valid: false, errors };
  }

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const prefix = `Step ${i + 1}`;

    if (!s.type || s.type.trim().length === 0) {
      errors.push(`${prefix}: "type" is required.`);
    } else if (!VALID_STEP_TYPES.has(s.type.toLowerCase())) {
      errors.push(
        `${prefix}: Unrecognised type "${s.type}". Valid types: ${Array.from(VALID_STEP_TYPES).sort().join(", ")}.`,
      );
    }

    if (!s.description || s.description.trim().length === 0) {
      errors.push(`${prefix}: "description" is required.`);
    }

    if (!s.reagent || s.reagent.trim().length === 0) {
      errors.push(`${prefix}: "reagent" is required.`);
    }

    if (typeof s.volume !== "number" || Number.isNaN(s.volume)) {
      errors.push(`${prefix}: "volume" must be a number.`);
    } else if (s.volume < 0) {
      errors.push(`${prefix}: "volume" must be non-negative (got ${s.volume}).`);
    } else if (s.volume > 1000) {
      errors.push(`${prefix}: "volume" exceeds maximum pipette capacity of 1000 uL (got ${s.volume}).`);
    }

    if (typeof s.duration !== "number" || Number.isNaN(s.duration)) {
      errors.push(`${prefix}: "duration" must be a number.`);
    } else if (s.duration < 0) {
      errors.push(`${prefix}: "duration" must be non-negative (got ${s.duration}).`);
    }

    if (typeof s.temperature !== "number" || Number.isNaN(s.temperature)) {
      errors.push(`${prefix}: "temperature" must be a number.`);
    } else if (s.temperature !== 0 && (s.temperature < -20 || s.temperature > 150)) {
      errors.push(
        `${prefix}: "temperature" must be between -20 and 150 °C, or 0 for room temp (got ${s.temperature}).`,
      );
    }

    // Warn about consecutive duplicate steps
    if (i > 0) {
      const prev = steps[i - 1];
      if (prev.reagent === s.reagent && prev.volume === s.volume && prev.type === s.type) {
        errors.push(`${prefix}: Consecutive duplicate of step ${i} (same type, reagent, and volume).`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a protocol for EXECUTABILITY against a concrete deck + manifest:
 * base step validation, deck structure (slot/mount conflicts, control/blank
 * placeholders, well capacity, labware references), and volume↔pipette-range
 * consistency. Errors are aggregated (empty = executable).
 */
export function validateExecutableProtocol(
  steps: ProtocolStep[],
  layout: DeckLayout,
  manifest: ProtocolManifest,
): ValidationResult {
  const errors = [...validateProtocol(steps).errors];
  errors.push(...validateDeck(layout, manifest));
  errors.push(...validatePipetteVolumes(layout.pipettes, steps.map((s) => s.volume)));
  return { valid: errors.length === 0, errors };
}
