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
): string[] {
  const lines: string[] = [];
  const well = wellId(index);
  const vol = step.volume > 0 ? step.volume : 10;

  switch (step.type.toLowerCase()) {
    case "transfer":
    case "pipette":
    case "dilute":
    case "plate": {
      const destWell = wellId(index + 1);
      lines.push(
        `    # Step ${index + 1}: ${step.description}`,
        `    ${pipetteVar}.transfer(${vol}, source_plate['${well}'], dest_plate['${destWell}'], new_tip='always')`,
      );
      break;
    }

    case "mix": {
      const cycles = Math.max(3, Math.round(step.duration / 5));
      lines.push(
        `    # Step ${index + 1}: ${step.description}`,
        `    ${pipetteVar}.mix(${cycles}, ${vol}, source_plate['${well}'])`,
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
        `    # Step ${index + 1}: ${step.description}`,
        `    ${pipetteVar}.transfer(${vol}, source_plate['${well}'], dest_plate['${well}'], new_tip='always')`,
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
 * Generate an Opentrons OT-2 Python protocol script.
 *
 * The output is a self-contained Python file that can be uploaded directly to
 * the Opentrons App.  It declares metadata, loads standard labware (96-well
 * flat plate, 20 uL tip rack), and translates each {@link ProtocolStep} into
 * the corresponding API call.
 */
export function generateOpentronsProtocol(steps: ProtocolStep[]): string {
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

  const header = [
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

  const labwareMap = new Map<string, string>();
  const bodyLines: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const stepLines = emitOpentronsStep(steps[i], i, labwareMap, "pipette");
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
