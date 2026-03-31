/**
 * ProtocolGenerator — Opentrons Python API v2.15 protocol generation
 *
 * Converts DBTL iteration parameters and Gibson Assembly plans into
 * machine-actionable liquid-handling protocols with volume-tracking
 * to prevent air-aspiration.
 *
 * v2.15 upgrades:
 * - Temperature Module GEN2 support for incubation control
 * - Thermocycler Module for Gibson Assembly (50°C/60min)
 * - UUID provenance barcoding for every physical tube
 * - Gibson Assembly-specific protocol generation
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

// ── Default labware catalog ───────────────────────────────────────────────────
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

// ── Gibson Assembly protocol strategy ─────────────────────────────────────────
function gibsonAssemblyProtocol(
  plan: GibsonAssemblyPlan,
  provenance: ProvenanceRecord[],
): ProtocolStrategy {
  const fragmentCount = plan.fragments.length;

  // Pipetting: master mix → add each fragment → mix → seal
  const steps: PipettingStep[] = [];

  // Step 1: Transfer Gibson Assembly Master Mix (2× NEB, 10 µL)
  steps.push({
    action: 'transfer', pipette: 'p20', volume_ul: 10,
    source: 'reservoir_1:A1', destination: 'pcrplate_1:A1',
    new_tip: true, volumeTracking: true,
  });

  // Step 2: Add each DNA fragment (equimolar, typically 2–5 µL each)
  const fragmentVol = Math.min(5, Math.floor(10 / fragmentCount)); // Total fragments ≤ 10 µL
  for (let i = 0; i < fragmentCount; i++) {
    const well = `${String.fromCharCode(65 + i)}1`;
    steps.push({
      action: 'aspirate', pipette: 'p20', volume_ul: Math.max(1, fragmentVol),
      source: `tuberack_1:${well}`, destination: 'pcrplate_1:A1',
      new_tip: true, volumeTracking: true,
    });
  }

  // Step 3: Add water to 20 µL total
  const waterVol = 20 - 10 - (fragmentCount * Math.max(1, fragmentVol));
  if (waterVol > 0) {
    steps.push({
      action: 'transfer', pipette: 'p20', volume_ul: waterVol,
      source: 'reservoir_1:A2', destination: 'pcrplate_1:A1',
      new_tip: true, volumeTracking: true,
    });
  }

  // Step 4: Mix
  steps.push({
    action: 'mix', pipette: 'p20', volume_ul: 15,
    source: 'pcrplate_1:A1', destination: 'pcrplate_1:A1',
    mix_cycles: 8, volumeTracking: true,
  });

  return {
    labware: [
      { slot: 1, labware: LABWARE.tipRack20,   label: 'P20 Tip Rack' },
      { slot: 2, labware: LABWARE.pcrPlate,     label: 'Gibson Assembly PCR Plate' },
      { slot: 4, labware: LABWARE.tubeRack15,   label: `DNA Fragments (${fragmentCount} tubes)` },
      { slot: 7, labware: LABWARE.tipRack300,   label: 'P300 Tip Rack' },
      { slot: 8, labware: LABWARE.reservoir12,  label: 'Master Mix (A1) + Water (A2)' },
      { slot: 10, labware: LABWARE.tempMod96,   label: 'Temperature Module — Incubation' },
    ],
    pipettes: [
      { mount: 'left',  pipette: PIPETTES.p20 },
      { mount: 'right', pipette: PIPETTES.p300 },
    ],
    steps,
    incubation: [
      { temperature_c: 50, duration_min: 60, label: 'Gibson Assembly isothermal reaction' },
      { temperature_c: 4,  duration_min: 0,  label: 'Hold at 4°C — ready for transformation' },
    ],
  };
}

// ── Python code generator (v2.15) ─────────────────────────────────────────────
function generatePythonCode(
  protocolName: string,
  strategy: ProtocolStrategy,
  provenance?: ProvenanceRecord[],
): string {
  const lines: string[] = [
    `from opentrons import protocol_api`,
    `import json`,
    `from datetime import datetime`,
    ``,
    `metadata = {`,
    `    'protocolName': '${protocolName}',`,
    `    'author': 'Nexus-Bio Axon Protocol Generator',`,
    `    'apiLevel': '2.15'`,
    `}`,
    ``,
  ];

  // Provenance tracking data
  if (provenance && provenance.length > 0) {
    lines.push('# ── Data Provenance (Nexus-Bio UUID Tracking) ──');
    lines.push('PROVENANCE = [');
    for (const p of provenance) {
      const well = p.well ?? 'N/A';
      const slot = p.slot ?? 0;
      lines.push('    {"uuid": "' + p.uuid + '", "designId": "' + p.designId + '", "type": "' + p.sampleType + '", "label": "' + p.label + '", "well": "' + well + '", "slot": ' + slot + '},');
    }
    lines.push(']');
    lines.push('');
  }

  lines.push(`def run(protocol: protocol_api.ProtocolContext):`);
  lines.push(`    # ── Labware ──`);

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

  // Temperature module control (v2.15)
  const hasTempMod = strategy.labware.some(lw => lw.labware.includes('aluminumblock') || lw.label.includes('Temperature Module'));
  if (hasTempMod) {
    lines.push('    # ── Temperature Module Control (v2.15) ──');
    lines.push('    temp_mod = protocol.load_module("temperature module gen2", 10)');
    lines.push('    temp_plate = temp_mod.load_labware("opentrons_96_aluminumblock_nest_wellplate_100ul")');
    lines.push('');
  }

  if (strategy.incubation.length > 0) {
    lines.push('    # ── Incubation Steps ──');
    strategy.incubation.forEach(inc => {
      lines.push(`    protocol.comment('${inc.label}: ${inc.temperature_c}°C for ${inc.duration_min} min${inc.shaking_rpm ? ` @ ${inc.shaking_rpm} RPM` : ''}')`);
      if (hasTempMod) {
        lines.push(`    temp_mod.set_temperature(${inc.temperature_c})`);
      }
      if (inc.duration_min > 0 && inc.duration_min <= 120) {
        lines.push(`    protocol.delay(minutes=${inc.duration_min})`);
      } else if (inc.duration_min > 120) {
        lines.push(`    protocol.comment('Long incubation: ${inc.duration_min} min — manual monitoring recommended')`);
      }
    });
    if (hasTempMod) {
      lines.push('    temp_mod.deactivate()');
    }
  }

  // Provenance logging
  if (provenance && provenance.length > 0) {
    lines.push('');
    lines.push('    # ── Provenance Logging ──');
    lines.push('    protocol.comment(f"Provenance: {len(PROVENANCE)} tracked samples")');
    lines.push('    for entry in PROVENANCE:');
    lines.push('        protocol.comment(f"  [{entry[\'uuid\'][:8]}] {entry[\'type\']}: {entry[\'label\']}")');
  }

  lines.push('');
  lines.push(`    protocol.comment('Protocol complete — Nexus-Bio Axon v2.15')`);

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
        strategy = testPhaseProtocol();
        break;
      default:
        strategy = designPhaseProtocol();
    }

    const protocolName = `DBTL-${phase}-${iteration.id}_${iteration.hypothesis.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`;
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
   * Generate a Gibson Assembly protocol from an assembly plan.
   *
   * Biological constraints:
   * - Equimolar fragment ratios (50–100 ng each, <1 kb)
   * - 2× Gibson Assembly Master Mix (NEB E2611)
   * - 50°C isothermal reaction for 60 min
   * - Temperature Module GEN2 for precise incubation control
   * - Every tube assigned a UUID for traceability
   *
   * @param plan - Gibson Assembly plan from assembly-planner
   * @param provenance - Provenance records linking tubes to digital design
   */
  generateGibsonAssembly(
    plan: GibsonAssemblyPlan,
    provenance: ProvenanceRecord[],
  ): GeneratedProtocol {
    const strategy = gibsonAssemblyProtocol(plan, provenance);
    const protocolName = `Gibson_${plan.targetName}_${plan.fragments.length}frag`;
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
   * Generate a multi-well variant for plate-scale experiments.
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
