/**
 * Lab Automation Bridge
 *
 * Exports experiment protocols in robot-compatible formats for automated
 * biofoundry execution. Supports:
 *   1. OT-2 JSON protocol format (Opentrons)
 *   2. Antha experiment format (Synthace)
 *   3. SBOL-DBTL integration
 *
 * Reference:
 *   - Opentrons OT-2 API: https://docs.opentrons.com
 *   - Antha: https://www.synthace.com
 *   - SBOL: https://sbolstandard.org
 *
 * @scientific_provenance
 *   ALGORITHM: Protocol translation from DBTL experiment spec to robot formats
 *   KNOWN_LIMITATIONS:
 *     - OT-2 protocol assumes specific labware (Opentrons tips, plates)
 *     - Liquid class is a coarse heuristic (viscous / volatile / cell / aqueous)
 *       driving flow rate + touch-tip — not a calibrated per-reagent model
 *     - Antha format is a simplified representation
 */

import { type ProtocolManifest, buildManifest, buildPlateMap } from "../types/protocolManifest";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExperimentStep {
  /** Step identifier */
  id: string;
  /** Step type */
  type: "pipette" | "incubate" | "mix" | "centrifuge" | "transfer" | "thermocycle" | "plate_read";
  /** Source well/labware */
  source?: string;
  /** Destination well/labware */
  destination?: string;
  /** Volume in µL */
  volume?: number;
  /** Duration in seconds */
  duration?: number;
  /** Temperature in °C */
  temperature?: number;
  /** Description */
  description: string;
  /** Parameters */
  params?: Record<string, unknown>;
}

export interface ExperimentProtocol {
  /** Protocol name */
  name: string;
  /** Protocol description */
  description: string;
  /** Protocol author */
  author: string;
  /** Protocol version */
  version: string;
  /** Labware definitions */
  labware: Record<string, string>;
  /** Pipette definitions */
  pipettes: Record<string, string>;
  /** Experiment steps */
  steps: ExperimentStep[];
  /** Metadata */
  metadata: {
    createdAt: string;
    organism?: string;
    targetProduct?: string;
    dbtlStage: "design" | "build" | "test" | "learn";
  };
}

export interface OT2Protocol {
  /** OT-2 protocol JSON */
  protocol: object;
  /** Protocol file name */
  fileName: string;
  /** Estimated run time (seconds) */
  estimatedRunTime: number;
  /** Design notes */
  designNotes: string[];
  /** Plate-map manifest (read-back keys) — present when a manifest spec is supplied. */
  manifest?: ProtocolManifest;
}

export interface AnthaExperiment {
  /** Antha experiment JSON */
  experiment: object;
  /** Experiment file name */
  fileName: string;
  /** Design notes */
  designNotes: string[];
}

// ── OT-2 Protocol Export ─────────────────────────────────────────────────

/**
 * Experiment-role → real OT-2 labware/module load name. Every value is a
 * verified identifier from the `opentrons_shared_data` library (labware or
 * module definitions). Validated against a frozen fixture emitted from the
 * `opentrons` package by `__tests__/labwareGroundTruth.test.ts` (L1 ground
 * truth) — do not add a value the external toolchain does not accept.
 */
export const LABWARE_MAP: Record<string, string> = {
  plate_96: "nest_96_wellplate_200ul_flat",
  // opentrons_shared_data has NO `..._flat` variant for this plate; the real
  // load name is `nest_24_wellplate_10.4ml`. The `_flat` form raised at OT-2 load.
  plate_24: "nest_24_wellplate_10.4ml",
  reservoir: "nest_12_reservoir_15ml",
  tiprack_20: "opentrons_96_tiprack_20ul",
  tiprack_300: "opentrons_96_tiprack_300ul",
  tiprack_1000: "opentrons_96_tiprack_1000ul",
  tube_rack: "opentrons_24_tuberack_eppendorf_1.5ml_safelock_snapcap",
  thermocycler: "thermocyclerModuleV2",
  temperature: "temperatureModuleV2",
  magnetic: "magneticModuleV2",
  heater_shaker: "heaterShakerModuleV1",
};

/**
 * Experiment-role → real OT-2 pipette load name (opentrons_shared_data
 * `pipetteNameSpecs`). Validated by the same L1 ground-truth test.
 */
export const PIPETTE_MAP: Record<string, string> = {
  p20_single: "p20_single_gen2",
  p300_single: "p300_single_gen2",
  p1000_single: "p1000_single_gen2",
  p20_multi: "p20_multi_gen2",
  p300_multi: "p300_multi_gen2",
};

/** Coarse liquid-class heuristic from a reagent/step description (deterministic, no RNG). */
function liquidClassFor(hint: string): { liquidClass: string; flowRate: number; touchTip: boolean } {
  const h = (hint ?? "").toLowerCase();
  if (/glycerol|dmso|peg|viscous/.test(h)) return { liquidClass: "viscous", flowRate: 30, touchTip: true };
  if (/ethanol|isopropanol|soc|media|volatile/.test(h))
    return { liquidClass: "volatile", flowRate: 60, touchTip: false };
  if (/cell|competent|culture|bacter/.test(h)) return { liquidClass: "cell-suspension", flowRate: 50, touchTip: true };
  return { liquidClass: "aqueous", flowRate: 100, touchTip: false };
}

/**
 * Export an experiment protocol in OT-2 JSON format.
 *
 * Emits a protocol JSON whose labware/module/pipette load names are verified
 * against the real `opentrons_shared_data` library (see LABWARE_MAP / PIPETTE_MAP
 * and __tests__/labwareGroundTruth.test.ts). NOTE: schema conformance and an
 * `opentrons_simulate` dry-run are NOT yet verified (see L4/L5), so this is not
 * yet a claim that the OT-2 app will execute the protocol end-to-end.
 *
 * @param protocol  Experiment protocol specification
 * @returns OT-2 protocol JSON with verified load names
 */
export function exportOT2Protocol(
  protocol: ExperimentProtocol,
  manifestSpec?: {
    batchId: string;
    dbtlRunId: string;
    samples: Array<{ sampleId: string; constructId: string; barcode?: string }>;
    sampleLabwareId?: string;
  },
): OT2Protocol {
  const startTime = Date.now();

  const labwareMap = LABWARE_MAP;
  const pipetteMap = PIPETTE_MAP;

  // Build OT-2 commands
  interface OT2Command {
    command: string;
    params: Record<string, unknown>;
  }
  const commands: OT2Command[] = [];
  let estimatedRunTime = 0;

  for (const step of protocol.steps) {
    switch (step.type) {
      case "pipette":
      case "transfer":
        commands.push({
          command: "transfer",
          params: {
            volume: step.volume || 10,
            source: step.source || "A1",
            destination: step.destination || "B1",
            pipette: Object.values(pipetteMap)[0],
            labware: Object.values(labwareMap)[0],
            ...liquidClassFor(step.description),
          },
        });
        estimatedRunTime += 5; // ~5 seconds per transfer
        break;

      case "mix":
        commands.push({
          command: "mix",
          params: {
            volume: step.volume || 50,
            repetitions: step.params?.repetitions || 3,
            well: step.source || "A1",
            pipette: Object.values(pipetteMap)[0],
            labware: Object.values(labwareMap)[0],
            ...liquidClassFor(step.description),
          },
        });
        estimatedRunTime += 10;
        break;

      case "incubate":
        commands.push({
          command: "delay",
          params: {
            seconds: step.duration || 60,
            message: step.description,
          },
        });
        estimatedRunTime += step.duration || 60;
        break;

      case "thermocycle":
        commands.push({
          command: "thermocycler",
          params: {
            cycles: step.params?.cycles || 1,
            steps: step.params?.steps || [
              { temperature: 98, hold_time: 30 },
              { temperature: 55, hold_time: 30 },
              { temperature: 72, hold_time: 60 },
            ],
          },
        });
        estimatedRunTime += (step.duration || 300) * (typeof step.params?.cycles === "number" ? step.params.cycles : 1);
        break;

      case "plate_read":
        commands.push({
          command: "absorbance",
          params: {
            wavelength: step.params?.wavelength || 600,
            labware: Object.values(labwareMap)[0],
            wells: step.params?.wells || ["A1", "A2", "A3"],
          },
        });
        estimatedRunTime += 30;
        break;
    }
  }

  // Build OT-2 protocol JSON
  const ot2Protocol = {
    schemaVersion: 8,
    metadata: {
      protocolName: protocol.name,
      author: protocol.author,
      description: protocol.description,
      created: protocol.metadata.createdAt,
      lastModified: new Date().toISOString(),
      category: "synthetic_biology",
      subcategory: protocol.metadata.dbtlStage,
      tags: [protocol.metadata.organism || "general", protocol.metadata.targetProduct || ""].filter(Boolean),
    },
    designApplication: {
      name: "Nexus-Bio",
      version: "1.0.0",
    },
    robot: {
      model: "OT-2",
      version: "4.0.0",
    },
    labware: Object.entries(protocol.labware).map(([name, type]) => ({
      name,
      type: labwareMap[type] || type,
      location: name.includes("deck") ? name : `deck_${name}`,
    })),
    pipettes: Object.entries(protocol.pipettes).map(([name, type]) => ({
      name,
      type: pipetteMap[type] || type,
      mount: name.includes("left") ? "left" : "right",
    })),
    commands,
    modules: [],
    liquids: [],
  };

  const manifest: ProtocolManifest | undefined = manifestSpec
    ? buildManifest({
        batchId: manifestSpec.batchId,
        dbtlRunId: manifestSpec.dbtlRunId,
        plateMap: buildPlateMap(manifestSpec.samples, manifestSpec.sampleLabwareId ?? "sample_plate"),
      })
    : undefined;

  return {
    protocol: ot2Protocol,
    fileName: `${protocol.name.replace(/\s+/g, "_")}_OT2.json`,
    estimatedRunTime,
    designNotes: [
      `OT-2 protocol: ${protocol.name}`,
      `Steps: ${protocol.steps.length}`,
      `Estimated run time: ${Math.ceil(estimatedRunTime / 60)} minutes`,
      `Labware: ${Object.keys(protocol.labware).join(", ")}`,
      `Pipettes: ${Object.keys(protocol.pipettes).join(", ")}`,
      `Format: Opentrons OT-2 JSON (schema v8)`,
      `Import: Load in OT-2 App or via opentrons_execute`,
      ...(manifest
        ? [`Manifest: ${manifest.manifestId} — ${manifest.plateMap.length} wells, batch ${manifest.batchId}`]
        : []),
    ],
    ...(manifest ? { manifest } : {}),
  };
}

// ── Antha Export ─────────────────────────────────────────────────────────

/**
 * Export an experiment protocol in Antha (Synthace) format.
 *
 * @param protocol  Experiment protocol specification
 * @returns Antha-compatible experiment JSON
 */
export function exportAnthaExperiment(protocol: ExperimentProtocol): AnthaExperiment {
  // Build Antha experiment structure
  const anthaExperiment = {
    schema: "antha/v1",
    metadata: {
      name: protocol.name,
      description: protocol.description,
      author: protocol.author,
      version: protocol.version,
      created: protocol.metadata.createdAt,
      tags: [protocol.metadata.organism || "", protocol.metadata.targetProduct || ""].filter(Boolean),
    },
    parameters: {
      organism: protocol.metadata.organism || "E. coli",
      targetProduct: protocol.metadata.targetProduct || "",
      dbtlStage: protocol.metadata.dbtlStage,
    },
    workflow: protocol.steps.map((step, i) => ({
      id: step.id,
      order: i,
      type: step.type,
      description: step.description,
      inputs: {
        source: step.source,
        destination: step.destination,
        volume_uL: step.volume,
        temperature_C: step.temperature,
        duration_s: step.duration,
      },
      outputs: {},
    })),
    labware: Object.entries(protocol.labware).map(([name, type]) => ({
      id: name,
      type,
      position: name,
    })),
    materials: [],
  };

  return {
    experiment: anthaExperiment,
    fileName: `${protocol.name.replace(/\s+/g, "_")}_antha.json`,
    designNotes: [
      `Antha experiment: ${protocol.name}`,
      `Steps: ${protocol.steps.length}`,
      `Format: Synthace Antha (v1)`,
      `Import: Load in Synthace platform`,
    ],
  };
}

// ── Protocol Builder ────────────────────────────────────────────────────

/**
 * Build a basic transformation protocol from strain and DNA inputs.
 *
 * @param strainName    Name of the bacterial strain
 * @param dnaInputs     Array of DNA construct names
 * @param plateFormat   Well plate format (96 or 24)
 * @returns Experiment protocol for transformation
 */
export function buildTransformationProtocol(
  strainName: string,
  dnaInputs: string[],
  plateFormat: 96 | 24 = 96,
): ExperimentProtocol {
  const wellPrefix = plateFormat === 96 ? "" : "";
  const steps: ExperimentStep[] = [];

  // Step 1: Thaw competent cells
  steps.push({
    id: "thaw_cells",
    type: "incubate",
    source: "tube_rack:A1",
    description: `Thaw ${strainName} competent cells on ice (30 min)`,
    duration: 1800,
    temperature: 4,
  });

  // Step 2: Add DNA to cells
  for (let i = 0; i < dnaInputs.length; i++) {
    const well = `${String.fromCharCode(65 + Math.floor(i / 12))}${(i % 12) + 1}`;
    steps.push({
      id: `add_dna_${i}`,
      type: "pipette",
      source: `dna_rack:${well}`,
      destination: `tube_rack:${well}`,
      volume: 2,
      description: `Add ${dnaInputs[i]} (2 µL) to competent cells`,
    });
  }

  // Step 3: Heat shock
  steps.push({
    id: "heat_shock",
    type: "incubate",
    source: "tube_rack",
    description: "Heat shock at 42°C for 30 seconds",
    duration: 30,
    temperature: 42,
  });

  // Step 4: Recovery on ice
  steps.push({
    id: "recovery_ice",
    type: "incubate",
    source: "tube_rack",
    description: "Recovery on ice (2 min)",
    duration: 120,
    temperature: 4,
  });

  // Step 5: Add SOC media
  steps.push({
    id: "add_soc",
    type: "pipette",
    source: "reservoir:A1",
    destination: "tube_rack",
    volume: 950,
    description: "Add 950 µL SOC media",
  });

  // Step 6: Recovery at 37°C
  steps.push({
    id: "recovery_37",
    type: "incubate",
    source: "tube_rack",
    description: "Recovery at 37°C, 250 rpm (1 hour)",
    duration: 3600,
    temperature: 37,
  });

  // Step 7: Plate on selective media
  for (let i = 0; i < dnaInputs.length; i++) {
    const well = `${String.fromCharCode(65 + Math.floor(i / 12))}${(i % 12) + 1}`;
    steps.push({
      id: `plate_${i}`,
      type: "pipette",
      source: `tube_rack:${well}`,
      destination: `plate_${plateFormat}:${well}`,
      volume: 100,
      description: `Plate ${dnaInputs[i]} on selective media`,
    });
  }

  // Step 8: Incubate plates
  steps.push({
    id: "incubate_plates",
    type: "incubate",
    source: `plate_${plateFormat}`,
    description: "Incubate plates at 37°C overnight (16-18 hours)",
    duration: 57600,
    temperature: 37,
  });

  return {
    name: `Transformation: ${strainName}`,
    description: `Transform ${dnaInputs.length} DNA constructs into ${strainName}`,
    author: "Nexus-Bio Protocol Generator",
    version: "1.0.0",
    labware: {
      tube_rack: "tube_rack",
      [`plate_${plateFormat}`]: `plate_${plateFormat}`,
      reservoir: "reservoir",
      dna_rack: "dna_rack",
    },
    pipettes: {
      p20: "p20_single",
      p300: "p300_single",
    },
    steps,
    metadata: {
      createdAt: new Date().toISOString(),
      organism: strainName,
      targetProduct: dnaInputs.join(", "),
      dbtlStage: "build",
    },
  };
}
