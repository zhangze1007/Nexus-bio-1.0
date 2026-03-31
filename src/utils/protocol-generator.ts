/**
 * ProtocolGenerator — Opentrons Python API v2.11+ protocol generation
 *
 * Converts DBTL iteration parameters into machine-actionable liquid-handling
 * protocols with volume-tracking to prevent air-aspiration.
 */

import type {
  GeneratedProtocol,
  LabwareSlot,
  PipettingStep,
  IncubationStep,
  DBTLIteration,
} from '../types';

// ── Default labware catalog ───────────────────────────────────────────────────
const LABWARE = {
  tipRack20:    'opentrons_96_tiprack_20ul',
  tipRack300:   'opentrons_96_tiprack_300ul',
  plate96:      'corning_96_wellplate_360ul_flat',
  tubeRack15:   'opentrons_15_tuberack_falcon_15ml_conical',
  reservoir12:  'usascientific_12_reservoir_22ml',
  deepWell96:   'nest_96_wellplate_2ml_deep',
} as const;

const PIPETTES = {
  p20:  'p20_single_gen2',
  p300: 'p300_single_gen2',
} as const;

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
      { slot: 2, labware: LABWARE.plate96,      label: 'DNA Assembly Plate' },
      { slot: 4, labware: LABWARE.tubeRack15,   label: 'DNA Parts Rack' },
      { slot: 7, labware: LABWARE.tipRack300,   label: 'P300 Tip Rack' },
      { slot: 8, labware: LABWARE.reservoir12,  label: 'Master Mix Reservoir' },
    ],
    pipettes: [
      { mount: 'left',  pipette: PIPETTES.p20 },
      { mount: 'right', pipette: PIPETTES.p300 },
    ],
    steps: [
      { action: 'transfer', pipette: 'p300', volume_ul: 25, source: 'reservoir_1:A1', destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'aspirate', pipette: 'p20', volume_ul: 2, source: 'tuberack_1:A1', destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'aspirate', pipette: 'p20', volume_ul: 2, source: 'tuberack_1:A2', destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'aspirate', pipette: 'p20', volume_ul: 1, source: 'tuberack_1:B1', destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'mix', pipette: 'p20', volume_ul: 15, source: 'plate_1:A1', destination: 'plate_1:A1', mix_cycles: 5, volumeTracking: true },
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
      { mount: 'left',  pipette: PIPETTES.p20 },
      { mount: 'right', pipette: PIPETTES.p300 },
    ],
    steps: [
      { action: 'transfer', pipette: 'p300', volume_ul: 50, source: 'tuberack_1:A1', destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'aspirate', pipette: 'p20', volume_ul: 5, source: 'tuberack_1:B1', destination: 'plate_1:A1', new_tip: true, volumeTracking: true },
      { action: 'mix', pipette: 'p20', volume_ul: 15, source: 'plate_1:A1', destination: 'plate_1:A1', mix_cycles: 3, volumeTracking: true },
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
      { slot: 2, labware: LABWARE.deepWell96,   label: 'Culture Deep Well' },
      { slot: 3, labware: LABWARE.plate96,      label: 'Assay Plate (OD/Fluorescence)' },
      { slot: 7, labware: LABWARE.reservoir12,  label: 'M9 + Glucose Media' },
    ],
    pipettes: [
      { mount: 'right', pipette: PIPETTES.p300 },
    ],
    steps: [
      { action: 'transfer', pipette: 'p300', volume_ul: 180, source: 'reservoir_1:A1', destination: 'deepwell_1:A1', new_tip: true, volumeTracking: true },
      { action: 'transfer', pipette: 'p300', volume_ul: 20,  source: 'deepwell_1:A1',  destination: 'plate_1:A1',    new_tip: true, volumeTracking: true },
      { action: 'mix', pipette: 'p300', volume_ul: 100, source: 'deepwell_1:A1', destination: 'deepwell_1:A1', mix_cycles: 3, volumeTracking: true },
    ],
    incubation: [
      { temperature_c: 30, duration_min: 2880, shaking_rpm: 250, label: 'Production culture (48h)' },
      { temperature_c: 4,  duration_min: 0,    label: 'Harvest — hold at 4°C' },
    ],
  };
}

// ── Python code generator ─────────────────────────────────────────────────────
function generatePythonCode(
  protocolName: string,
  strategy: ProtocolStrategy,
): string {
  const lines: string[] = [
    `from opentrons import protocol_api`,
    ``,
    `metadata = {`,
    `    'protocolName': '${protocolName}',`,
    `    'author': 'Nexus-Bio Axon Protocol Generator',`,
    `    'apiLevel': '2.11'`,
    `}`,
    ``,
    `def run(protocol: protocol_api.ProtocolContext):`,
    `    # ── Labware ──`,
  ];

  const labwareVars: Record<string, string> = {};
  strategy.labware.forEach((lw, i) => {
    const varName = `labware_${i}`;
    labwareVars[`slot_${lw.slot}`] = varName;
    lines.push(`    ${varName} = protocol.load_labware('${lw.labware}', ${lw.slot}, '${lw.label}')`);
  });

  lines.push('');
  lines.push('    # ── Pipettes ──');
  strategy.pipettes.forEach(p => {
    const tipRack = strategy.labware.find(lw => lw.labware.includes('tiprack'));
    const tipVar = tipRack ? labwareVars[`slot_${tipRack.slot}`] : 'None';
    lines.push(`    ${p.pipette} = protocol.load_instrument('${p.pipette}', '${p.mount}', tip_racks=[${tipVar}])`);
  });

  lines.push('');
  lines.push('    # ── Volume Tracking State ──');
  lines.push('    well_volumes = {}  # {well_id: current_volume_ul}');
  lines.push('');
  lines.push('    def track_aspirate(well, vol):');
  lines.push('        key = str(well)');
  lines.push('        current = well_volumes.get(key, 300)  # default assume 300 uL');
  lines.push('        if current < vol:');
  lines.push('            protocol.comment(f"WARNING: {key} may be empty ({current:.1f} uL left, need {vol} uL)")');
  lines.push('        well_volumes[key] = max(0, current - vol)');
  lines.push('');
  lines.push('    def track_dispense(well, vol):');
  lines.push('        key = str(well)');
  lines.push('        well_volumes[key] = well_volumes.get(key, 0) + vol');
  lines.push('');
  lines.push('    # ── Pipetting Logic ──');

  strategy.steps.forEach((step, i) => {
    lines.push(`    # Step ${i + 1}: ${step.action}`);
    const pipVar = step.pipette;
    if (step.new_tip) {
      lines.push(`    ${pipVar}.pick_up_tip()`);
    }
    if (step.action === 'aspirate' || step.action === 'transfer') {
      lines.push(`    track_aspirate('${step.source}', ${step.volume_ul})`);
      lines.push(`    ${pipVar}.aspirate(${step.volume_ul}, ${labwareVars[Object.keys(labwareVars)[0]]}.wells()[0])  # ${step.source}`);
      lines.push(`    track_dispense('${step.destination}', ${step.volume_ul})`);
      lines.push(`    ${pipVar}.dispense(${step.volume_ul}, ${labwareVars[Object.keys(labwareVars)[1]]}.wells()[0])  # ${step.destination}`);
    } else if (step.action === 'mix') {
      lines.push(`    ${pipVar}.mix(${step.mix_cycles ?? 3}, ${step.volume_ul}, ${labwareVars[Object.keys(labwareVars)[1]]}.wells()[0])  # ${step.source}`);
    }
    if (step.new_tip) {
      lines.push(`    ${pipVar}.drop_tip()`);
    }
    lines.push('');
  });

  if (strategy.incubation.length > 0) {
    lines.push('    # ── Incubation Steps (manual or thermocycler) ──');
    strategy.incubation.forEach(inc => {
      lines.push(`    protocol.comment('${inc.label}: ${inc.temperature_c}°C for ${inc.duration_min} min${inc.shaking_rpm ? ` @ ${inc.shaking_rpm} RPM` : ''}')`);
      if (inc.duration_min > 0 && inc.duration_min <= 60) {
        lines.push(`    protocol.delay(minutes=${inc.duration_min})`);
      }
    });
  }

  lines.push('');
  lines.push(`    protocol.comment('Protocol complete.')`);

  return lines.join('\n');
}

// ── Main ProtocolGenerator class ──────────────────────────────────────────────
export class ProtocolGenerator {
  /**
   * Generate an Opentrons-compatible protocol from a DBTL iteration.
   * The protocol type is determined by the iteration phase.
   */
  generate(iteration: DBTLIteration): GeneratedProtocol {
    const phase = iteration.phase;
    let strategy: ProtocolStrategy;

    switch (phase) {
      case 'Design':
        strategy = designPhaseProtocol();
        break;
      case 'Build':
        strategy = buildPhaseProtocol();
        break;
      case 'Test':
        strategy = testPhaseProtocol();
        break;
      case 'Learn':
        // Learn phase re-uses test protocol for validation runs
        strategy = testPhaseProtocol();
        break;
      default:
        strategy = designPhaseProtocol();
    }

    const protocolName = `DBTL-${phase}-${iteration.id}_${iteration.hypothesis.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`;
    const pythonCode = generatePythonCode(protocolName, strategy);

    return {
      api_version: '2.11',
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
   * Generate a multi-well variant for plate-scale experiments.
   * Replicates the base protocol across specified wells.
   */
  generatePlateScale(
    iteration: DBTLIteration,
    wellCount: number = 8,
  ): GeneratedProtocol {
    const base = this.generate(iteration);
    const scaledSteps = base.pipetting_logic.flatMap((step, i) =>
      Array.from({ length: wellCount }, (_, w) => ({
        ...step,
        destination: step.destination.replace(/:[A-H]\d+$/, `:${String.fromCharCode(65 + (w % 8))}${Math.floor(w / 8) + 1}`),
        new_tip: i === 0 || step.new_tip,
      }))
    );

    return {
      ...base,
      metadata: {
        ...base.metadata,
        protocolName: base.metadata.protocolName + `_${wellCount}well`,
        description: base.metadata.description + ` (${wellCount}-well scale)`,
      },
      pipetting_logic: scaledSteps,
      python_code: generatePythonCode(
        base.metadata.protocolName + `_${wellCount}well`,
        {
          labware: base.labware,
          pipettes: base.pipettes,
          steps: scaledSteps,
          incubation: base.incubation_steps,
        },
      ),
    };
  }
}
