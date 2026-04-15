/**
 * ProtocolGenerator — Opentrons Python API v2.15 protocol generation
 *
 * Converts DBTL iteration parameters and Gibson Assembly plans into
 * machine-actionable liquid-handling protocols. Every emitted Python
 * script is deterministic: the same input produces the same output,
 * labware/pipette/well references resolve against a validated role
 * map, and any unresolved reference throws before emit rather than
 * producing a script that would NameError on the robot.
 *
 * Validation rules enforced before emit:
 *   - every source/destination is <role>:<well> with known role
 *   - every well fits the labware's row/column geometry
 *   - every step volume fits the pipette's 1–20 or 20–300 µL range
 *   - every pipette key in a step refers to a loaded instrument
 *   - Gibson fragment count ≤ 15 (tube rack physical limit)
 */

import type {
  GeneratedProtocol,
  LabwareSlot,
  PipettingStep,
  IncubationStep,
  DBTLIteration,
  GibsonAssemblyPlan,
  ProvenanceRecord,
} from '../types';

// ── Labware catalog ───────────────────────────────────────────────────────────
const LABWARE = {
  tipRack20:    'opentrons_96_tiprack_20ul',
  tipRack300:   'opentrons_96_tiprack_300ul',
  plate96:      'corning_96_wellplate_360ul_flat',
  tubeRack15:   'opentrons_15_tuberack_falcon_15ml_conical',
  reservoir12:  'usascientific_12_reservoir_22ml',
  deepWell96:   'nest_96_wellplate_2ml_deep',
  pcrPlate:     'nest_96_wellplate_100ul_pcr_full_skirt',
  tempMod96:    'opentrons_96_aluminumblock_nest_wellplate_100ul',
} as const;

type LabwareId = typeof LABWARE[keyof typeof LABWARE];

// Geometry: rows × columns and per-well capacity (µL)
interface LabwareGeometry {
  rows: number;            // 'A'..'A'+rows-1
  cols: number;            // 1..cols
  wellCapacityUl: number;  // conservative upper bound
  roleBase: string;        // role prefix used in step source/destination strings
}

const GEOMETRY: Record<LabwareId, LabwareGeometry> = {
  [LABWARE.tipRack20]:   { rows: 8, cols: 12, wellCapacityUl: 0,     roleBase: 'tiprack20' },
  [LABWARE.tipRack300]:  { rows: 8, cols: 12, wellCapacityUl: 0,     roleBase: 'tiprack300' },
  [LABWARE.plate96]:     { rows: 8, cols: 12, wellCapacityUl: 360,   roleBase: 'plate' },
  [LABWARE.tubeRack15]:  { rows: 3, cols: 5,  wellCapacityUl: 15000, roleBase: 'tuberack' },
  [LABWARE.reservoir12]: { rows: 1, cols: 12, wellCapacityUl: 22000, roleBase: 'reservoir' },
  [LABWARE.deepWell96]:  { rows: 8, cols: 12, wellCapacityUl: 2000,  roleBase: 'deepwell' },
  [LABWARE.pcrPlate]:    { rows: 8, cols: 12, wellCapacityUl: 100,   roleBase: 'pcrplate' },
  [LABWARE.tempMod96]:   { rows: 8, cols: 12, wellCapacityUl: 100,   roleBase: 'tempplate' },
};

// Pipette volume ranges (GEN2, Opentrons published specs)
const PIPETTES = {
  p20:  { instrument: 'p20_single_gen2',  minUl: 1,  maxUl: 20,  tipRack: LABWARE.tipRack20 },
  p300: { instrument: 'p300_single_gen2', minUl: 20, maxUl: 300, tipRack: LABWARE.tipRack300 },
} as const;

type PipetteKey = keyof typeof PIPETTES;

// ── Role resolution ───────────────────────────────────────────────────────────
interface ResolvedLabware {
  role: string;            // e.g. 'tuberack_1', 'reservoir_1', 'tiprack20'
  varName: string;         // Python variable, same as role (sanitized)
  slot: number;
  labware: LabwareId;
  label: string;
  geometry: LabwareGeometry;
}

/**
 * Build a deterministic role → labware map from the slot list. Tipracks get
 * the unsuffixed role because we never load two of the same tiprack in one
 * protocol. Other labware types get a `_1`, `_2`, … suffix in load order so
 * steps can reference multiple plates without ambiguity.
 */
function resolveLabware(slots: LabwareSlot[]): Map<string, ResolvedLabware> {
  const resolved = new Map<string, ResolvedLabware>();
  const counts: Record<string, number> = {};

  for (const slot of slots) {
    const geometry = GEOMETRY[slot.labware as LabwareId];
    if (!geometry) {
      throw new Error(
        `protocol-generator: unknown labware '${slot.labware}' in slot ${slot.slot}. `
        + `Known labware: ${Object.values(LABWARE).join(', ')}.`,
      );
    }
    const base = geometry.roleBase;
    const isTipRack = base === 'tiprack20' || base === 'tiprack300';
    let role: string;
    if (isTipRack) {
      if (resolved.has(base)) {
        throw new Error(
          `protocol-generator: duplicate tip rack '${base}' at slots `
          + `${resolved.get(base)!.slot} and ${slot.slot}. One per pipette.`,
        );
      }
      role = base;
    } else {
      counts[base] = (counts[base] ?? 0) + 1;
      role = `${base}_${counts[base]}`;
    }
    resolved.set(role, {
      role,
      varName: role,
      slot: slot.slot,
      labware: slot.labware as LabwareId,
      label: slot.label,
      geometry,
    });
  }
  return resolved;
}

/**
 * Parse and validate a step reference of the form `<role>:<well>`. Throws with
 * a specific diagnostic if either half is malformed or the well doesn't fit
 * the labware's geometry.
 */
function parseReference(
  ref: string,
  roles: Map<string, ResolvedLabware>,
  context: string,
): { role: ResolvedLabware; well: string } {
  const parts = ref.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `protocol-generator: ${context} reference '${ref}' is not '<role>:<well>'.`,
    );
  }
  const role = roles.get(parts[0]);
  if (!role) {
    throw new Error(
      `protocol-generator: ${context} role '${parts[0]}' is not loaded. `
      + `Loaded roles: ${[...roles.keys()].join(', ') || '(none)'}.`,
    );
  }
  const well = parts[1];
  const match = /^([A-Z])([1-9][0-9]?)$/.exec(well);
  if (!match) {
    throw new Error(
      `protocol-generator: ${context} well '${well}' is not in A1-style form.`,
    );
  }
  const rowIdx = match[1].charCodeAt(0) - 'A'.charCodeAt(0);
  const colIdx = parseInt(match[2], 10);
  const geom = role.geometry;
  if (rowIdx < 0 || rowIdx >= geom.rows || colIdx < 1 || colIdx > geom.cols) {
    throw new Error(
      `protocol-generator: ${context} well '${well}' is outside `
      + `${role.labware} geometry (rows A–${String.fromCharCode(64 + geom.rows)}, `
      + `cols 1–${geom.cols}).`,
    );
  }
  return { role, well };
}

function indexToWell(index: number, rows: number, cols: number): string {
  if (index < 0 || index >= rows * cols) {
    throw new Error(
      `protocol-generator: index ${index} exceeds ${rows}×${cols} labware capacity.`,
    );
  }
  const row = String.fromCharCode('A'.charCodeAt(0) + (index % rows));
  const col = Math.floor(index / rows) + 1;
  return `${row}${col}`;
}

// ── Protocol strategies by DBTL phase ─────────────────────────────────────────
interface ProtocolStrategy {
  labware: LabwareSlot[];
  pipettes: { mount: 'left' | 'right'; pipette: string }[];
  steps: PipettingStep[];
  incubation: IncubationStep[];
}

function designPhaseProtocol(): ProtocolStrategy {
  return {
    labware: [
      { slot: 1, labware: LABWARE.tipRack20,   label: 'P20 Tip Rack' },
      { slot: 2, labware: LABWARE.plate96,     label: 'DNA Assembly Plate' },
      { slot: 4, labware: LABWARE.tubeRack15,  label: 'DNA Parts Rack' },
      { slot: 7, labware: LABWARE.tipRack300,  label: 'P300 Tip Rack' },
      { slot: 8, labware: LABWARE.reservoir12, label: 'Master Mix Reservoir' },
    ],
    pipettes: [
      { mount: 'left',  pipette: PIPETTES.p20.instrument },
      { mount: 'right', pipette: PIPETTES.p300.instrument },
    ],
    steps: [
      { action: 'transfer', pipette: 'p300', volume_ul: 25, source: 'reservoir_1:A1', destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'aspirate', pipette: 'p20',  volume_ul: 2,  source: 'tuberack_1:A1',  destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'aspirate', pipette: 'p20',  volume_ul: 2,  source: 'tuberack_1:A2',  destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'aspirate', pipette: 'p20',  volume_ul: 1,  source: 'tuberack_1:B1',  destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'mix',      pipette: 'p20',  volume_ul: 15, source: 'plate_1:A1',     destination: 'plate_1:A1', mix_cycles: 5, volumeTracking: true },
    ],
    incubation: [
      { temperature_c: 37, duration_min: 60, label: 'Golden Gate assembly' },
      { temperature_c: 50, duration_min: 5,  label: 'Heat inactivation' },
      { temperature_c: 4,  duration_min: 0,  label: 'Hold at 4°C' },
    ],
  };
}

function buildPhaseProtocol(): ProtocolStrategy {
  return {
    labware: [
      { slot: 1, labware: LABWARE.tipRack20,   label: 'P20 Tip Rack' },
      { slot: 2, labware: LABWARE.tipRack300,  label: 'P300 Tip Rack' },
      { slot: 3, labware: LABWARE.plate96,     label: 'Transformation Plate' },
      { slot: 5, labware: LABWARE.tubeRack15,  label: 'Competent Cells' },
      { slot: 8, labware: LABWARE.reservoir12, label: 'SOC / LB Media' },
    ],
    pipettes: [
      { mount: 'left',  pipette: PIPETTES.p20.instrument },
      { mount: 'right', pipette: PIPETTES.p300.instrument },
    ],
    steps: [
      { action: 'transfer', pipette: 'p300', volume_ul: 50,  source: 'tuberack_1:A1', destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'aspirate', pipette: 'p20',  volume_ul: 5,   source: 'tuberack_1:B1', destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'mix',      pipette: 'p20',  volume_ul: 15,  source: 'plate_1:A1',    destination: 'plate_1:A1', mix_cycles: 3, volumeTracking: true },
      { action: 'transfer', pipette: 'p300', volume_ul: 200, source: 'reservoir_1:A1', destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
    ],
    incubation: [
      { temperature_c: 42, duration_min: 1,   label: 'Heat shock' },
      { temperature_c: 4,  duration_min: 2,   label: 'Ice recovery' },
      { temperature_c: 37, duration_min: 60,  shaking_rpm: 220, label: 'SOC recovery' },
      { temperature_c: 37, duration_min: 960, label: 'Overnight colony growth' },
    ],
  };
}

function testPhaseProtocol(): ProtocolStrategy {
  return {
    labware: [
      { slot: 1, labware: LABWARE.tipRack300,  label: 'P300 Tip Rack' },
      { slot: 2, labware: LABWARE.deepWell96,  label: 'Culture Deep Well' },
      { slot: 3, labware: LABWARE.plate96,     label: 'Assay Plate (OD/Fluorescence)' },
      { slot: 7, labware: LABWARE.reservoir12, label: 'M9 + Glucose Media' },
    ],
    pipettes: [
      { mount: 'right', pipette: PIPETTES.p300.instrument },
    ],
    steps: [
      { action: 'transfer', pipette: 'p300', volume_ul: 180, source: 'reservoir_1:A1', destination: 'deepwell_1:A1', new_tip: true, volumeTracking: true },
      { action: 'transfer', pipette: 'p300', volume_ul: 20,  source: 'deepwell_1:A1',  destination: 'plate_1:A1',    new_tip: true, volumeTracking: true },
      { action: 'mix',      pipette: 'p300', volume_ul: 100, source: 'deepwell_1:A1',  destination: 'deepwell_1:A1', mix_cycles: 3, volumeTracking: true },
    ],
    incubation: [
      { temperature_c: 30, duration_min: 2880, shaking_rpm: 250, label: 'Production culture (48h)' },
      { temperature_c: 4,  duration_min: 0,    label: 'Harvest — hold at 4°C' },
    ],
  };
}

// ── Gibson Assembly strategy ──────────────────────────────────────────────────
function gibsonAssemblyProtocol(plan: GibsonAssemblyPlan): ProtocolStrategy {
  const fragmentCount = plan.fragments.length;
  const tuberack = GEOMETRY[LABWARE.tubeRack15];
  const tubeCapacity = tuberack.rows * tuberack.cols; // 15

  if (fragmentCount < 1) {
    throw new Error('protocol-generator: Gibson plan has zero fragments.');
  }
  if (fragmentCount > tubeCapacity) {
    throw new Error(
      `protocol-generator: ${fragmentCount} fragments exceeds 15-tube rack capacity. `
      + `Split into multiple assemblies or switch to a 96-well source plate.`,
    );
  }

  const steps: PipettingStep[] = [];

  // Gibson master mix: 10 µL of 2× NEB E2611
  steps.push({
    action: 'transfer', pipette: 'p20', volume_ul: 10,
    source: 'reservoir_1:A1', destination: 'pcrplate_1:A1',
    new_tip: true, volumeTracking: true,
  });

  // Per-fragment volume: equal split of a 10 µL pool, clamped to p20 range
  const perFragment = Math.max(1, Math.min(5, Math.floor(10 / fragmentCount)));
  for (let i = 0; i < fragmentCount; i++) {
    const well = indexToWell(i, tuberack.rows, tuberack.cols);
    steps.push({
      action: 'aspirate', pipette: 'p20', volume_ul: perFragment,
      source: `tuberack_1:${well}`, destination: 'pcrplate_1:A1',
      new_tip: true, volumeTracking: true,
    });
  }

  // Water top-up to 20 µL total; only emit if any nuclease-free water needed
  const waterVol = 20 - 10 - fragmentCount * perFragment;
  if (waterVol > 0) {
    steps.push({
      action: 'transfer', pipette: 'p20', volume_ul: waterVol,
      source: 'reservoir_1:A2', destination: 'pcrplate_1:A1',
      new_tip: true, volumeTracking: true,
    });
  }

  steps.push({
    action: 'mix', pipette: 'p20', volume_ul: 15,
    source: 'pcrplate_1:A1', destination: 'pcrplate_1:A1',
    mix_cycles: 8, volumeTracking: true,
  });

  return {
    labware: [
      { slot: 1,  labware: LABWARE.tipRack20,   label: 'P20 Tip Rack' },
      { slot: 2,  labware: LABWARE.pcrPlate,    label: 'Gibson Assembly PCR Plate' },
      { slot: 4,  labware: LABWARE.tubeRack15,  label: `DNA Fragments (${fragmentCount} tubes)` },
      { slot: 7,  labware: LABWARE.tipRack300,  label: 'P300 Tip Rack' },
      { slot: 8,  labware: LABWARE.reservoir12, label: 'Master Mix (A1) + Water (A2)' },
      { slot: 10, labware: LABWARE.tempMod96,   label: 'Temperature Module — Incubation' },
    ],
    pipettes: [
      { mount: 'left',  pipette: PIPETTES.p20.instrument },
      { mount: 'right', pipette: PIPETTES.p300.instrument },
    ],
    steps,
    incubation: [
      { temperature_c: 50, duration_min: 60, label: 'Gibson Assembly isothermal reaction' },
      { temperature_c: 4,  duration_min: 0,  label: 'Hold at 4°C — ready for transformation' },
    ],
  };
}

// ── Validator + Python emitter ────────────────────────────────────────────────
/**
 * Validate every step against the resolved labware/pipette maps and return
 * per-step resolved references. Throws on the first failure rather than
 * emitting a broken script.
 */
interface ResolvedStep {
  step: PipettingStep;
  pipetteKey: PipetteKey;
  pipetteVarName: string;
  tipRackRole: string;
  source: { role: ResolvedLabware; well: string };
  destination: { role: ResolvedLabware; well: string };
}

function validateStrategy(strategy: ProtocolStrategy): {
  roles: Map<string, ResolvedLabware>;
  resolvedSteps: ResolvedStep[];
  pipettesInUse: Map<PipetteKey, { mount: string; tipRackRole: string }>;
} {
  const roles = resolveLabware(strategy.labware);

  // Each loaded instrument must have its tip rack loaded too.
  const pipettesInUse = new Map<PipetteKey, { mount: string; tipRackRole: string }>();
  for (const pip of strategy.pipettes) {
    const key = (Object.keys(PIPETTES) as PipetteKey[]).find(
      (k) => PIPETTES[k].instrument === pip.pipette,
    );
    if (!key) {
      throw new Error(
        `protocol-generator: pipette '${pip.pipette}' is not supported. `
        + `Supported: ${Object.values(PIPETTES).map((p) => p.instrument).join(', ')}.`,
      );
    }
    const tipRoleBase = GEOMETRY[PIPETTES[key].tipRack].roleBase;
    if (!roles.has(tipRoleBase)) {
      throw new Error(
        `protocol-generator: pipette '${key}' on '${pip.mount}' requires `
        + `a '${PIPETTES[key].tipRack}' tip rack but none is loaded.`,
      );
    }
    pipettesInUse.set(key, { mount: pip.mount, tipRackRole: tipRoleBase });
  }

  const resolvedSteps: ResolvedStep[] = strategy.steps.map((step, stepIdx) => {
    const pipetteKey = step.pipette as PipetteKey;
    const pipSpec = PIPETTES[pipetteKey];
    if (!pipSpec) {
      throw new Error(
        `protocol-generator: step ${stepIdx + 1} uses unknown pipette key '${step.pipette}'. `
        + `Expected one of: ${Object.keys(PIPETTES).join(', ')}.`,
      );
    }
    const loaded = pipettesInUse.get(pipetteKey);
    if (!loaded) {
      throw new Error(
        `protocol-generator: step ${stepIdx + 1} uses pipette '${pipetteKey}' `
        + `but no matching instrument is loaded.`,
      );
    }
    if (step.volume_ul < pipSpec.minUl || step.volume_ul > pipSpec.maxUl) {
      throw new Error(
        `protocol-generator: step ${stepIdx + 1} volume ${step.volume_ul} µL `
        + `is outside ${pipetteKey} range (${pipSpec.minUl}–${pipSpec.maxUl} µL).`,
      );
    }
    return {
      step,
      pipetteKey,
      pipetteVarName: pipetteKey,
      tipRackRole: loaded.tipRackRole,
      source: parseReference(step.source, roles, `step ${stepIdx + 1} source`),
      destination: parseReference(step.destination, roles, `step ${stepIdx + 1} destination`),
    };
  });

  return { roles, resolvedSteps, pipettesInUse };
}

function generatePythonCode(
  protocolName: string,
  strategy: ProtocolStrategy,
  provenance?: ProvenanceRecord[],
): string {
  const { roles, resolvedSteps, pipettesInUse } = validateStrategy(strategy);
  const lines: string[] = [];

  lines.push('from opentrons import protocol_api');
  lines.push('');
  lines.push('metadata = {');
  lines.push(`    'protocolName': ${pyStr(protocolName)},`);
  lines.push(`    'author': 'Nexus-Bio Axon Protocol Generator',`);
  lines.push(`    'apiLevel': '2.15',`);
  lines.push('}');
  lines.push('');

  if (provenance && provenance.length > 0) {
    lines.push('# ── Data provenance (Nexus-Bio UUID tracking) ──');
    lines.push('PROVENANCE = [');
    // Deterministic order: by createdAt, then uuid
    const sorted = [...provenance].sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
      return a.uuid.localeCompare(b.uuid);
    });
    for (const p of sorted) {
      const entries: string[] = [
        `'uuid': ${pyStr(p.uuid)}`,
        `'designId': ${pyStr(p.designId)}`,
        `'type': ${pyStr(p.sampleType)}`,
        `'label': ${pyStr(p.label)}`,
      ];
      if (p.well) entries.push(`'well': ${pyStr(p.well)}`);
      if (p.slot != null) entries.push(`'slot': ${p.slot}`);
      lines.push(`    {${entries.join(', ')}},`);
    }
    lines.push(']');
    lines.push('');
  }

  // Initial source-well volumes: derived from labware capacity for every
  // well that ever appears as an aspirate source.
  const initialVolumes = collectInitialSourceVolumes(resolvedSteps);

  lines.push('def run(protocol: protocol_api.ProtocolContext):');
  lines.push('    # ── Labware ──');
  for (const role of roles.values()) {
    lines.push(
      `    ${role.varName} = protocol.load_labware(${pyStr(role.labware)}, ${role.slot}, ${pyStr(role.label)})`,
    );
  }

  lines.push('');
  lines.push('    # ── Pipettes ──');
  for (const [key, info] of pipettesInUse.entries()) {
    const pipSpec = PIPETTES[key];
    lines.push(
      `    ${key} = protocol.load_instrument(${pyStr(pipSpec.instrument)}, ${pyStr(info.mount)}, tip_racks=[${info.tipRackRole}])`,
    );
  }

  lines.push('');
  lines.push('    # ── Volume tracking ──');
  lines.push('    well_volumes = {');
  for (const [wellId, vol] of initialVolumes) {
    lines.push(`        ${pyStr(wellId)}: ${vol},`);
  }
  lines.push('    }');
  lines.push('');
  lines.push('    def track_aspirate(well_id, vol):');
  lines.push('        if well_id not in well_volumes:');
  lines.push('            protocol.comment(f"WARNING: aspirating from untracked well {well_id}")');
  lines.push('            well_volumes[well_id] = 0');
  lines.push('        if well_volumes[well_id] < vol:');
  lines.push('            protocol.comment(f"WARNING: {well_id} has {well_volumes[well_id]:.1f} uL left, step needs {vol} uL — risk of air aspiration")');
  lines.push('        well_volumes[well_id] = max(0, well_volumes[well_id] - vol)');
  lines.push('');
  lines.push('    def track_dispense(well_id, vol):');
  lines.push('        well_volumes[well_id] = well_volumes.get(well_id, 0) + vol');
  lines.push('');
  lines.push('    # ── Pipetting logic ──');

  resolvedSteps.forEach((rs, i) => {
    const { step, pipetteVarName, source, destination } = rs;
    lines.push(`    # Step ${i + 1}: ${step.action} (${step.volume_ul} µL)`);
    if (step.new_tip) lines.push(`    ${pipetteVarName}.pick_up_tip()`);
    const sourceExpr = `${source.role.varName}.wells_by_name()[${pyStr(source.well)}]`;
    const destExpr = `${destination.role.varName}.wells_by_name()[${pyStr(destination.well)}]`;

    if (step.action === 'aspirate' || step.action === 'transfer') {
      lines.push(`    track_aspirate(${pyStr(step.source)}, ${step.volume_ul})`);
      lines.push(`    ${pipetteVarName}.aspirate(${step.volume_ul}, ${sourceExpr})`);
      lines.push(`    track_dispense(${pyStr(step.destination)}, ${step.volume_ul})`);
      lines.push(`    ${pipetteVarName}.dispense(${step.volume_ul}, ${destExpr})`);
    } else if (step.action === 'dispense') {
      lines.push(`    track_dispense(${pyStr(step.destination)}, ${step.volume_ul})`);
      lines.push(`    ${pipetteVarName}.dispense(${step.volume_ul}, ${destExpr})`);
    } else if (step.action === 'mix') {
      lines.push(`    ${pipetteVarName}.mix(${step.mix_cycles ?? 3}, ${step.volume_ul}, ${destExpr})`);
    }
    if (step.new_tip) lines.push(`    ${pipetteVarName}.drop_tip()`);
    lines.push('');
  });

  // Temperature module — load only if a tempplate role was declared
  const hasTempPlate = [...roles.values()].some((r) => r.geometry.roleBase === 'tempplate');
  if (hasTempPlate) {
    const tempRole = [...roles.values()].find((r) => r.geometry.roleBase === 'tempplate')!;
    lines.push('    # ── Temperature module control ──');
    lines.push(`    temp_mod = protocol.load_module('temperature module gen2', ${tempRole.slot})`);
    lines.push('');
  }

  if (strategy.incubation.length > 0) {
    lines.push('    # ── Incubation ──');
    for (const inc of strategy.incubation) {
      const shake = inc.shaking_rpm ? ` @ ${inc.shaking_rpm} RPM` : '';
      lines.push(
        `    protocol.comment(${pyStr(`${inc.label}: ${inc.temperature_c}°C for ${inc.duration_min} min${shake}`)})`,
      );
      if (hasTempPlate) {
        lines.push(`    temp_mod.set_temperature(${inc.temperature_c})`);
      }
      if (inc.duration_min > 0 && inc.duration_min <= 120) {
        lines.push(`    protocol.delay(minutes=${inc.duration_min})`);
      } else if (inc.duration_min > 120) {
        lines.push(
          `    protocol.comment(${pyStr(`Long incubation: ${inc.duration_min} min — move off-deck or monitor manually`)})`,
        );
      }
    }
    if (hasTempPlate) lines.push('    temp_mod.deactivate()');
  }

  if (provenance && provenance.length > 0) {
    lines.push('');
    lines.push('    # ── Provenance logging ──');
    lines.push('    protocol.comment(f"Provenance: {len(PROVENANCE)} tracked samples")');
    lines.push('    for entry in PROVENANCE:');
    lines.push("        protocol.comment(f\"  [{entry['uuid'][:8]}] {entry['type']}: {entry['label']}\")");
  }

  lines.push('');
  lines.push("    protocol.comment('Protocol complete — Nexus-Bio Axon v2.15')");
  lines.push('');

  return lines.join('\n');
}

function collectInitialSourceVolumes(steps: ResolvedStep[]): [string, number][] {
  const volumes = new Map<string, number>();
  for (const rs of steps) {
    if (rs.step.action === 'aspirate' || rs.step.action === 'transfer' || rs.step.action === 'mix') {
      const key = rs.step.source;
      if (!volumes.has(key)) {
        volumes.set(key, rs.source.role.geometry.wellCapacityUl);
      }
    }
  }
  // Deterministic order: sorted by role+well string
  return [...volumes.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Emit a safely quoted Python string literal (handles apostrophes and backslashes). */
function pyStr(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${escaped}'`;
}

// ── Public API ────────────────────────────────────────────────────────────────
export class ProtocolGenerator {
  /**
   * Generate an Opentrons protocol for the given DBTL iteration phase.
   * Throws synchronously if the phase strategy has any invalid step.
   */
  generate(iteration: DBTLIteration): GeneratedProtocol {
    const phase = iteration.phase;
    let strategy: ProtocolStrategy;
    switch (phase) {
      case 'Design': strategy = designPhaseProtocol(); break;
      case 'Build':  strategy = buildPhaseProtocol();  break;
      case 'Test':   strategy = testPhaseProtocol();   break;
      case 'Learn':  strategy = testPhaseProtocol();   break;
      default:       strategy = designPhaseProtocol();
    }

    const safeHypothesis = iteration.hypothesis.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
    const protocolName = `DBTL-${phase}-${iteration.id}_${safeHypothesis}`;
    const pythonCode = generatePythonCode(protocolName, strategy);

    return {
      api_version: '2.15',
      metadata: {
        protocolName,
        author: 'Nexus-Bio Axon',
        description: `${phase} phase protocol for iteration #${iteration.id}: ${iteration.hypothesis}`,
      },
      labware: strategy.labware,
      pipettes: strategy.pipettes,
      pipetting_logic: strategy.steps,
      incubation_steps: strategy.incubation,
      python_code: pythonCode,
    };
  }

  /**
   * Generate a Gibson Assembly protocol. Throws if the plan exceeds 15
   * fragments or if any derived step fails validation.
   *
   * Biological constraints:
   *   - Equimolar fragment ratios (50–100 ng each, <1 kb)
   *   - 2× Gibson Master Mix (NEB E2611), 10 µL per reaction
   *   - 50 °C isothermal reaction for 60 min on temperature module
   *   - Every tube traced via ProvenanceRecord UUID
   */
  generateGibsonAssembly(
    plan: GibsonAssemblyPlan,
    provenance: ProvenanceRecord[],
  ): GeneratedProtocol {
    const strategy = gibsonAssemblyProtocol(plan);
    const protocolName = `Gibson_${plan.targetName.replace(/[^a-zA-Z0-9]/g, '_')}_${plan.fragments.length}frag`;
    const pythonCode = generatePythonCode(protocolName, strategy, provenance);

    return {
      api_version: '2.15',
      metadata: {
        protocolName,
        author: 'Nexus-Bio Axon',
        description: `Gibson Assembly of ${plan.targetName} (${plan.targetLength} bp) from ${plan.fragments.length} fragments. UUID-tracked.`,
      },
      labware: strategy.labware,
      pipettes: strategy.pipettes,
      pipetting_logic: strategy.steps,
      incubation_steps: strategy.incubation,
      python_code: pythonCode,
    };
  }

  /**
   * Scale a single-well protocol across N wells of the destination plate.
   * Wells advance in row-major order (A1, B1, …, H1, A2, …) and are clamped
   * to the destination labware's geometry.
   */
  generatePlateScale(iteration: DBTLIteration, wellCount: number = 8): GeneratedProtocol {
    if (!Number.isInteger(wellCount) || wellCount < 1) {
      throw new Error(`protocol-generator: wellCount must be a positive integer (got ${wellCount}).`);
    }
    const base = this.generate(iteration);

    // Detect the destination plate's geometry from the first destination role
    const firstDest = base.pipetting_logic[0]?.destination;
    if (!firstDest) {
      throw new Error('protocol-generator: base protocol has no steps to scale.');
    }
    const destRoleBase = firstDest.split(':')[0];
    const destLabware = base.labware.find((lw) => {
      const geom = GEOMETRY[lw.labware as LabwareId];
      return geom && `${geom.roleBase}_1` === destRoleBase;
    });
    if (!destLabware) {
      throw new Error(`protocol-generator: could not resolve destination role '${destRoleBase}'.`);
    }
    const geom = GEOMETRY[destLabware.labware as LabwareId];
    if (wellCount > geom.rows * geom.cols) {
      throw new Error(
        `protocol-generator: wellCount ${wellCount} exceeds ${destLabware.labware} capacity (${geom.rows * geom.cols}).`,
      );
    }

    const scaledSteps: PipettingStep[] = base.pipetting_logic.flatMap((step) =>
      Array.from({ length: wellCount }, (_, w) => {
        const newWell = indexToWell(w, geom.rows, geom.cols);
        const [destRole] = step.destination.split(':');
        return {
          ...step,
          destination: `${destRole}:${newWell}`,
          new_tip: true,
        };
      }),
    );

    const scaledName = `${base.metadata.protocolName}_${wellCount}well`;
    const strategy: ProtocolStrategy = {
      labware: base.labware,
      pipettes: base.pipettes,
      steps: scaledSteps,
      incubation: base.incubation_steps,
    };

    return {
      ...base,
      metadata: {
        ...base.metadata,
        protocolName: scaledName,
        description: `${base.metadata.description} (${wellCount}-well scale)`,
      },
      pipetting_logic: scaledSteps,
      python_code: generatePythonCode(scaledName, strategy),
    };
  }
}
