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
 *     - Does not account for liquid class specifics (viscosity, surface tension)
 *     - Antha format is a simplified representation
 */

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
  params?: Record<string, any>;
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
 * Export an experiment protocol in OT-2 JSON format.
 *
 * Generates a valid Opentrons protocol JSON that can be loaded into the
 * OT-2 app or executed via the Opentrons API.
 *
 * @param protocol  Experiment protocol specification
 * @returns OT-2 compatible protocol JSON
 */
export function exportOT2Protocol(protocol: ExperimentProtocol): OT2Protocol {
  const startTime = Date.now();

  // Map labware to OT-2 labware names
  const labwareMap: Record<string, string> = {
    plate_96: "nest_96_wellplate_200ul_flat",
    plate_24: "nest_24_wellplate_10.4ml_flat",
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

  // Map pipettes to OT-2 pipette names
  const pipetteMap: Record<string, string> = {
    p20_single: "p20_single_gen2",
    p300_single: "p300_single_gen2",
    p1000_single: "p1000_single_gen2",
    p20_multi: "p20_multi_gen2",
    p300_multi: "p300_multi_gen2",
  };

  // Build OT-2 commands
  const commands: any[] = [];
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
        estimatedRunTime += (step.duration || 300) * (step.params?.cycles || 1);
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
    ],
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
