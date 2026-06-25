/**
 * Report Collector
 *
 * Reads tool payloads from the workbench store and converts them into
 * structured report sections with tables, figures, and provenance metadata.
 *
 * @module src/services/report/reportCollector
 */

import type {
  CatalystWorkbenchPayload,
  CETHXWorkbenchPayload,
  CellFreeWorkbenchPayload,
  DBTLWorkbenchPayload,
  DynConWorkbenchPayload,
  FBAWorkbenchPayload,
  GECAIRWorkbenchPayload,
  GenMIMWorkbenchPayload,
  MultiOWorkbenchPayload,
  NEXAIWorkbenchPayload,
  PathDWorkbenchPayload,
  ProEvolWorkbenchPayload,
  ScSpatialWorkbenchPayload,
  WorkbenchPayloadBase,
} from "../../store/workbenchPayloads";

// ── Interfaces ──────────────────────────────────────────────────

export interface ReportTable {
  headers: string[];
  rows: string[][];
  caption: string;
}

export interface ReportFigure {
  title: string;
  svgContent: string;
  caption: string;
}

export interface ReportSection {
  toolId: string;
  title: string;
  content: string;
  tables: ReportTable[];
  figures: ReportFigure[];
  provenance: { source: string; validityTier: string; assumptions: string[] };
}

export interface ReportData {
  metadata: {
    generatedAt: string;
    projectTitle: string;
    targetProduct: string;
  };
  sections: ReportSection[];
  summary: string;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Format a number to a fixed number of decimal places,
 * falling back to 'N/A' for non-finite values.
 */
function fmt(value: number, decimals = 2): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : "N/A";
}

/**
 * Capitalize the first letter of a string.
 */
function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Derive a human-readable project title from the target product.
 */
function deriveProjectTitle(targetProduct: string): string {
  if (!targetProduct || targetProduct === "Unknown") return "Untitled Project";
  return `${capitalize(targetProduct)} Biosynthesis Report`;
}

/**
 * Extract provenance info from a workbench payload.
 */
function extractProvenance(payload: WorkbenchPayloadBase): {
  source: string;
  validityTier: string;
  assumptions: string[];
} {
  const tier = payload.runProvenance?.validityTier ?? payload.validity ?? "demo";
  const assumptions = [
    ...(payload.runProvenance?.inputAssumptions ?? []),
    ...(payload.runProvenance?.outputAssumptions ?? []),
  ];
  return {
    source: payload.runProvenance?.toolId ?? "unknown",
    validityTier: tier,
    assumptions,
  };
}

// ── Section Templates ───────────────────────────────────────────

type AnyPayload = WorkbenchPayloadBase & {
  toolId: string;
  targetProduct: string;
  result: Record<string, unknown>;
  updatedAt: number;
};

function buildFBASection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as FBAWorkbenchPayload;
  const r = p.result;

  const content = [
    `Flux Balance Analysis for ${p.targetProduct}.`,
    `Growth rate: ${fmt(r.growthRate)} h⁻¹.`,
    `ATP yield: ${fmt(r.atpYield)} mmol/gDW/h.`,
    `NADH production: ${fmt(r.nadhProduction)} mmol/gDW/h.`,
    `Carbon efficiency: ${fmt(r.carbonEfficiency * 100, 1)}%.`,
    `Feasibility: ${r.feasible ? "feasible" : "infeasible"}.`,
  ].join(" ");

  const fluxTable: ReportTable = {
    headers: ["Reaction", "Flux (mmol/gDW/h)"],
    rows: r.topFluxes.map((f) => [f.reactionId, fmt(f.flux)]),
    caption: "Top metabolic fluxes from FBA solution",
  };

  const sensitivityTable: ReportTable = {
    headers: ["Parameter", "Sensitivity Coefficient"],
    rows: [
      ["Glucose uptake", fmt(r.sensitivityCoefficients.glc)],
      ["Oxygen uptake", fmt(r.sensitivityCoefficients.o2)],
      ["ATP maintenance", fmt(r.sensitivityCoefficients.atp)],
    ],
    caption: "Sensitivity coefficients for key parameters",
  };

  return {
    toolId: p.toolId,
    title: "Flux Balance Analysis",
    content,
    tables: [fluxTable, sensitivityTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildCETHXSection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as CETHXWorkbenchPayload;
  const r = p.result;

  const feasibilityLabel = r.gibbsFreeEnergy < 0 ? "thermodynamically favorable" : "thermodynamically unfavorable";

  const content = [
    `Cell Thermodynamics analysis for ${p.targetProduct} at ${p.tempC}°C, pH ${p.pH}.`,
    `Gibbs free energy (ΔG): ${fmt(r.gibbsFreeEnergy)} kJ/mol — ${feasibilityLabel}.`,
    `Feasibility: ${feasibilityLabel}.`,
    `ATP yield: ${fmt(r.atpYield)} mol/mol.`,
    `NADH yield: ${fmt(r.nadhYield)} mol/mol.`,
    `Entropy production: ${fmt(r.entropyProduction)} J/(mol·K).`,
    `Thermodynamic efficiency: ${fmt(r.efficiency * 100, 1)}%.`,
    r.limitingStep ? `Limiting step: ${r.limitingStep}.` : "No single limiting step identified.",
  ].join(" ");

  const thermoTable: ReportTable = {
    headers: ["Metric", "Value", "Unit"],
    rows: [
      ["ΔG", fmt(r.gibbsFreeEnergy), "kJ/mol"],
      ["ATP yield", fmt(r.atpYield), "mol/mol"],
      ["NADH yield", fmt(r.nadhYield), "mol/mol"],
      ["Entropy production", fmt(r.entropyProduction), "J/(mol·K)"],
      ["Efficiency", fmt(r.efficiency * 100, 1), "%"],
    ],
    caption: "Thermodynamic summary",
  };

  return {
    toolId: p.toolId,
    title: "Cell Thermodynamics",
    content,
    tables: [thermoTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildCatDesSection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as CatalystWorkbenchPayload;
  const r = p.result;

  const content = [
    `Catalyst Designer results for ${p.selectedEnzymeName} (${p.selectedEnzymeId}).`,
    `Overall binding affinity: ${fmt(r.overallBinding)}.`,
    `Best sequence score: ${fmt(r.bestSequenceScore)}.`,
    `Codon Adaptation Index (CAI): ${fmt(r.bestCAI)}.`,
    `Total metabolic drain: ${fmt(r.totalMetabolicDrain * 100, 1)}%.`,
    `Growth penalty: ${fmt(r.growthPenalty * 100, 1)}%.`,
    `Viability: ${r.isViable ? "Viable" : "Not viable"}.`,
    `Top mutation sites: ${r.topMutationSites}.`,
    `Recommendation: ${r.recommendation}.`,
  ].join(" ");

  const designTable: ReportTable = {
    headers: ["Metric", "Value"],
    rows: [
      ["Binding Kd", fmt(r.bindingKd) + " µM"],
      ["Overall binding", fmt(r.overallBinding)],
      ["Best sequence score", fmt(r.bestSequenceScore)],
      ["Best CAI", fmt(r.bestCAI)],
      ["Metabolic drain", fmt(r.totalMetabolicDrain * 100, 1) + "%"],
      ["Growth penalty", fmt(r.growthPenalty * 100, 1) + "%"],
      ["Viable", r.isViable ? "Yes" : "No"],
      ["Best pathway", r.bestPathway],
      ["Mutation sites", String(r.topMutationSites)],
    ],
    caption: "Enzyme design summary",
  };

  return {
    toolId: p.toolId,
    title: "Catalyst Designer",
    content,
    tables: [designTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildCellFreeSection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as CellFreeWorkbenchPayload;
  const r = p.result;

  const content = [
    `Cell-Free simulation for ${p.targetProduct} (construct: ${p.targetConstruct}).`,
    `Total protein yield: ${fmt(r.totalProteinYield)} mg/mL.`,
    `Energy depletion time: ${fmt(r.energyDepletionTime)} min.`,
    `Resource-limited: ${r.isResourceLimited ? "yes" : "no"}.`,
    `In vitro max protein: ${fmt(r.invitroMaxProtein)} mg/mL.`,
    r.invivoExpression !== null
      ? `In vivo expression: ${fmt(r.invivoExpression)} mg/mL.`
      : "In vivo expression: not available.",
    r.confidence !== null ? `Confidence: ${fmt(r.confidence * 100, 1)}%.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const summaryTable: ReportTable = {
    headers: ["Metric", "Value", "Unit"],
    rows: [
      ["Total protein yield", fmt(r.totalProteinYield), "mg/mL"],
      ["Energy depletion time", fmt(r.energyDepletionTime), "min"],
      ["In vitro max protein", fmt(r.invitroMaxProtein), "mg/mL"],
      ["In vivo expression", r.invivoExpression !== null ? fmt(r.invivoExpression) : "N/A", "mg/mL"],
      ["Resource limited", r.isResourceLimited ? "Yes" : "No", ""],
      ["Constructs tested", String(p.constructCount), ""],
    ],
    caption: "Cell-free simulation summary",
  };

  return {
    toolId: p.toolId,
    title: "Cell-Free Simulation",
    content,
    tables: [summaryTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildDynConSection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as DynConWorkbenchPayload;
  const r = p.result;
  const c = p.controller;
  const h = p.hill;

  const content = [
    `Dynamic Control simulation for ${p.targetProduct}.`,
    `Product titer: ${fmt(r.productTiter)} g/L.`,
    `Productivity: ${fmt(r.productivity)} g/L/h.`,
    `DO RMSE: ${fmt(r.doRmse)}.`,
    `Stability: ${r.stable ? "stable" : "unstable"}.`,
    `Burden index: ${fmt(r.burdenIndex)}.`,
  ].join(" ");

  const controlTable: ReportTable = {
    headers: ["Parameter", "Value"],
    rows: [
      ["Product titer", fmt(r.productTiter) + " g/L"],
      ["Productivity", fmt(r.productivity) + " g/L/h"],
      ["DO RMSE", fmt(r.doRmse)],
      ["Stable", r.stable ? "Yes" : "No"],
      ["Burden index", fmt(r.burdenIndex)],
      ["Kp", fmt(c.kp)],
      ["Ki", fmt(c.ki)],
      ["Kd", fmt(c.kd)],
      ["Setpoint", fmt(c.setpoint)],
      ["Hill Vmax", fmt(h.vmax)],
      ["Hill Kd", fmt(h.kd)],
      ["Hill n", fmt(h.n)],
    ],
    caption: "Dynamic control parameters and results",
  };

  return {
    toolId: p.toolId,
    title: "Dynamic Control",
    content,
    tables: [controlTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildMultiOSection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as MultiOWorkbenchPayload;
  const r = p.result;

  const content = [
    `Multi-Omics analysis for ${p.targetProduct}.`,
    `Significant features: ${r.significantCount}.`,
    `Dominant layer: ${r.dominantLayer}.`,
    `Bottleneck gene: ${r.bottleneckGene} (confidence ${fmt(r.bottleneckConfidence * 100, 1)}%).`,
    `MOFA variance explained: ${fmt(r.mofaVarianceExplained * 100, 1)}%.`,
    `Top efficiency gene: ${r.topEfficiencyGene} (score ${fmt(r.topEfficiencyScore)}).`,
    `VAE ELBO: ${fmt(r.vaeElbo)}.`,
  ].join(" ");

  const omicsTable: ReportTable = {
    headers: ["Metric", "Value"],
    rows: [
      ["Significant features", String(r.significantCount)],
      ["Dominant layer", r.dominantLayer],
      ["Bottleneck gene", r.bottleneckGene],
      ["Bottleneck confidence", fmt(r.bottleneckConfidence * 100, 1) + "%"],
      ["MOFA variance explained", fmt(r.mofaVarianceExplained * 100, 1) + "%"],
      ["Top efficiency gene", r.topEfficiencyGene],
      ["Top efficiency score", fmt(r.topEfficiencyScore)],
      ["VAE ELBO", fmt(r.vaeElbo)],
    ],
    caption: "Multi-omics integration summary",
  };

  return {
    toolId: p.toolId,
    title: "Multi-Omics Integration",
    content,
    tables: [omicsTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildScSpatialSection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as ScSpatialWorkbenchPayload;
  const r = p.result;

  const content = [
    `Single-Cell Spatial analysis for ${p.targetProduct} (${r.totalCells} cells, ${r.passedCells} passed QC).`,
    `Top spatially variable gene: ${r.topSpatialGene} (Moran's I = ${fmt(r.topMoranI)}).`,
    `Highest-yield cluster: ${r.highestYieldCluster}.`,
    `Hotspots detected: ${r.hotspotCount}.`,
    `Dataset source: ${p.source}.`,
  ].join(" ");

  const spatialTable: ReportTable = {
    headers: ["Metric", "Value"],
    rows: [
      ["Total cells", String(r.totalCells)],
      ["Passed QC cells", String(r.passedCells)],
      ["Top spatial gene", r.topSpatialGene],
      ["Moran's I", fmt(r.topMoranI)],
      ["Highest-yield cluster", r.highestYieldCluster],
      ["Hotspot count", String(r.hotspotCount)],
      ["Source", p.source],
    ],
    caption: "Spatial transcriptomics summary",
  };

  const clusterRows = r.clusterSummaries.map((cs) => [
    String(cs.clusterId),
    cs.clusterLabel,
    String(cs.cellCount),
    fmt(cs.meanExpression),
    cs.fate,
    cs.topGenes.join(", "),
  ]);

  const clusterTable: ReportTable = {
    headers: ["Cluster ID", "Label", "Cells", "Mean Expression", "Fate", "Top Genes"],
    rows: clusterRows,
    caption: "Cluster summaries",
  };

  return {
    toolId: p.toolId,
    title: "Single-Cell Spatial",
    content,
    tables: [spatialTable, clusterTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildGenMIMSection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as GenMIMWorkbenchPayload;
  const r = p.result;

  const content = [
    `Gene Minimization for ${p.targetProduct}.`,
    `Selected targets: ${r.selectedTargets} (max allowed: ${p.maxTargets}).`,
    `Growth impact: ${fmt(r.growthImpact * 100, 1)}%.`,
    `Average knockdown efficiency: ${fmt(r.avgEfficiency * 100, 1)}%.`,
    `Off-target risk: ${fmt(r.offTargetRisk * 100, 1)}%.`,
    `Essential gene protection: ${p.protectEssential ? "enabled" : "disabled"}.`,
    `Top target genes: ${r.topGenes.join(", ")}.`,
  ].join(" ");

  const minimTable: ReportTable = {
    headers: ["Metric", "Value"],
    rows: [
      ["Selected targets", String(r.selectedTargets)],
      ["Max targets allowed", String(p.maxTargets)],
      ["Growth impact", fmt(r.growthImpact * 100, 1) + "%"],
      ["Avg knockdown efficiency", fmt(r.avgEfficiency * 100, 1) + "%"],
      ["Off-target risk", fmt(r.offTargetRisk * 100, 1) + "%"],
      ["Essential gene protection", p.protectEssential ? "Yes" : "No"],
      ["Top genes", r.topGenes.join(", ")],
    ],
    caption: "Genome minimization summary",
  };

  return {
    toolId: p.toolId,
    title: "Gene Minimization",
    content,
    tables: [minimTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildProEvolSection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as ProEvolWorkbenchPayload;
  const r = p.result;

  const content = [
    `Protein Evolution campaign "${p.campaignName}" for ${p.targetProduct} (${p.targetProtein}, WT: ${p.wildTypeLabel}).`,
    `Round ${p.currentRound} of ${p.totalRounds}.`,
    `Lead variant: ${r.leadVariantName} (score ${fmt(r.leadVariantScore)}).`,
    `Mutations: ${r.leadMutationString}.`,
    `Selected this round: ${r.selectedThisRound}, rejected: ${r.rejectedThisRound}.`,
    `Diversity index: ${fmt(r.diversityIndex)}.`,
    `Convergence: ${r.convergenceState}.`,
    `Recommendation: ${r.recommendation}.`,
  ].join(" ");

  const evoTable: ReportTable = {
    headers: ["Metric", "Value"],
    rows: [
      ["Campaign", p.campaignName],
      ["Current round", `${p.currentRound} / ${p.totalRounds}`],
      ["Library size", String(p.librarySize)],
      ["Lead variant", r.leadVariantName],
      ["Lead score", fmt(r.leadVariantScore)],
      ["Mutations", r.leadMutationString],
      ["Selected / rejected", `${r.selectedThisRound} / ${r.rejectedThisRound}`],
      ["Diversity index", fmt(r.diversityIndex)],
      ["Convergence", r.convergenceState],
    ],
    caption: "Protein evolution summary",
  };

  return {
    toolId: p.toolId,
    title: "Protein Evolution",
    content,
    tables: [evoTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildGECAIRSection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as GECAIRWorkbenchPayload;
  const r = p.result;

  const content = [
    `Gene Circuit analysis for ${p.targetProduct} (${p.gateType} gate).`,
    `Output level: ${fmt(r.outputLevel)}.`,
    `Node A output: ${fmt(r.nodeAOutput)}, Node B output: ${fmt(r.nodeBOutput)}.`,
    `Noise score: ${fmt(r.noiseScore)}.`,
    `Circuit complexity: ${r.circuitComplexity}.`,
  ].join(" ");

  const circuitTable: ReportTable = {
    headers: ["Metric", "Value"],
    rows: [
      ["Gate type", p.gateType],
      ["Input A", fmt(p.inputA)],
      ["Input B", fmt(p.inputB)],
      ["Output level", fmt(r.outputLevel)],
      ["Node A output", fmt(r.nodeAOutput)],
      ["Node B output", fmt(r.nodeBOutput)],
      ["Noise score", fmt(r.noiseScore)],
      ["Circuit complexity", String(r.circuitComplexity)],
    ],
    caption: "Gene circuit summary",
  };

  return {
    toolId: p.toolId,
    title: "Gene Circuit Reasoner",
    content,
    tables: [circuitTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildPathDSection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as PathDWorkbenchPayload;
  const r = p.result;

  const content = [
    `Pathway Design for ${p.targetProduct} (route: ${p.activeRouteLabel}).`,
    `Network: ${p.nodeCount} nodes, ${p.edgeCount} edges.`,
    `Pathway candidates: ${r.pathwayCandidates}.`,
    `Bottlenecks: ${r.bottleneckCount}.`,
    `Enzyme candidates: ${r.enzymeCandidates}.`,
    `Thermodynamic concerns: ${r.thermodynamicConcerns}.`,
    `Recommended next tool: ${r.recommendedNextTool}.`,
    `Evidence linked: ${r.evidenceLinked ? "yes" : "no"}.`,
  ].join(" ");

  const pathwayTable: ReportTable = {
    headers: ["Metric", "Value"],
    rows: [
      ["Nodes", String(p.nodeCount)],
      ["Edges", String(p.edgeCount)],
      ["Pathway candidates", String(r.pathwayCandidates)],
      ["Bottlenecks", String(r.bottleneckCount)],
      ["Enzyme candidates", String(r.enzymeCandidates)],
      ["Thermodynamic concerns", String(r.thermodynamicConcerns)],
      ["Recommended next tool", r.recommendedNextTool],
      ["Evidence linked", r.evidenceLinked ? "Yes" : "No"],
    ],
    caption: "Pathway design summary",
  };

  return {
    toolId: p.toolId,
    title: "Pathway Designer",
    content,
    tables: [pathwayTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildDBTLSection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as DBTLWorkbenchPayload;
  const r = p.result;

  const content = [
    `DBTL Cycle for ${p.targetProduct}.`,
    `Current phase: ${r.latestPhase}.`,
    `Best iteration: ${r.bestIteration}.`,
    `Pass rate: ${fmt(r.passRate * 100, 1)}%.`,
    `Improvement rate: ${fmt(r.improvementRate * 100, 1)}%.`,
    `Hypothesis: ${p.draftHypothesis}.`,
    `Latest measurement: ${fmt(p.measuredResult)} ${p.unit} — ${p.passed ? "passed" : "failed"}.`,
  ].join(" ");

  const dbtlTable: ReportTable = {
    headers: ["Metric", "Value"],
    rows: [
      ["Current phase", r.latestPhase],
      ["Best iteration", String(r.bestIteration)],
      ["Pass rate", fmt(r.passRate * 100, 1) + "%"],
      ["Improvement rate", fmt(r.improvementRate * 100, 1) + "%"],
      ["Proposed phase", p.proposedPhase],
      ["Latest result", fmt(p.measuredResult) + " " + p.unit],
      ["Passed", p.passed ? "Yes" : "No"],
      ["Feedback source", p.feedbackSource],
    ],
    caption: "DBTL cycle summary",
  };

  return {
    toolId: p.toolId,
    title: "DBTL Cycle",
    content,
    tables: [dbtlTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

function buildNEXAISection(payload: AnyPayload): ReportSection {
  const p = payload as unknown as NEXAIWorkbenchPayload;
  const r = p.result;

  const content = [
    `NEXAI research agent for ${p.targetProduct}.`,
    `Query: "${p.query}".`,
    `Mode: ${r.mode}.`,
    `Citations found: ${r.citations}.`,
    `Confidence: ${fmt(r.confidence * 100, 1)}%.`,
    `Preview: ${r.answerPreview.slice(0, 200)}${r.answerPreview.length > 200 ? "..." : ""}`,
  ].join(" ");

  const nexaiTable: ReportTable = {
    headers: ["Metric", "Value"],
    rows: [
      ["Query", p.query],
      ["Mode", r.mode],
      ["Citations", String(r.citations)],
      ["Confidence", fmt(r.confidence * 100, 1) + "%"],
    ],
    caption: "NEXAI research summary",
  };

  return {
    toolId: p.toolId,
    title: "NEXAI Research Agent",
    content,
    tables: [nexaiTable],
    figures: [],
    provenance: extractProvenance(p),
  };
}

// ── Template Registry ───────────────────────────────────────────

export const SECTION_TEMPLATES: Record<string, (payload: AnyPayload) => ReportSection> = {
  fbasim: buildFBASection,
  cethx: buildCETHXSection,
  catdes: buildCatDesSection,
  cellfree: buildCellFreeSection,
  dyncon: buildDynConSection,
  multio: buildMultiOSection,
  scspatial: buildScSpatialSection,
  genmim: buildGenMIMSection,
  proevol: buildProEvolSection,
  gecair: buildGECAIRSection,
  pathd: buildPathDSection,
  dbtlflow: buildDBTLSection,
  nexai: buildNEXAISection,
};

/**
 * Build a generic section for tools that do not have a dedicated template.
 */
function buildGenericSection(payload: AnyPayload): ReportSection {
  return {
    toolId: payload.toolId,
    title: payload.toolId,
    content: `Results from ${payload.toolId} for ${payload.targetProduct}.`,
    tables: [],
    figures: [],
    provenance: extractProvenance(payload),
  };
}

// ── Main Collector ──────────────────────────────────────────────

/**
 * Collect report data from the workbench store's tool payloads.
 *
 * Iterates over every key in `store.toolPayloads`, applies the matching
 * section template (or a generic fallback), and assembles the final
 * `ReportData` object.
 */
export function collectReportData(store: { toolPayloads: Record<string, unknown> }): ReportData {
  const payloads = store.toolPayloads ?? {};
  const sections: ReportSection[] = [];

  let targetProduct = "Unknown";

  for (const key of Object.keys(payloads)) {
    const payload = payloads[key] as AnyPayload | undefined;
    if (!payload || !payload.result || typeof payload.result !== "object") continue;

    // Derive targetProduct from the first valid payload
    if (targetProduct === "Unknown" && payload.targetProduct) {
      targetProduct = payload.targetProduct;
    }

    const template = SECTION_TEMPLATES[payload.toolId] ?? buildGenericSection;
    sections.push(template(payload));
  }

  const summary =
    sections.length > 0
      ? `Report generated from ${sections.length} tool${sections.length === 1 ? "" : "s"}: ${sections.map((s) => s.title).join(", ")}.`
      : "";

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      projectTitle: deriveProjectTitle(targetProduct),
      targetProduct,
    },
    sections,
    summary,
  };
}
