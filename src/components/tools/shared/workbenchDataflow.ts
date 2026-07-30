import { findBenchmarkByTarget } from "../../../data/experimentalBenchmarks";
import { ENZYME_STRUCTURES, RATE_LIMITING_ENZYME } from "../../../data/mockCatalystDesigner";
import type { PathwayKey } from "../../../data/mockCETHX";
import { REACTION_DEFS } from "../../../data/mockFBA";
import type { EnzymeStructure } from "../../../services/CatalystDesignerEngine";
import type { CFSParameters, GeneConstruct } from "../../../services/CellFreeEngine";
import { generateDefaultConstructs, generateDefaultParameters } from "../../../services/CellFreeEngine";
import { filterApprovedLearnedDeltaPacks } from "../../../services/learnedDeltaApplication";
import type {
  CatalystWorkbenchPayload,
  CETHXWorkbenchPayload,
  CellFreeWorkbenchPayload,
  DBTLWorkbenchPayload,
  DynConWorkbenchPayload,
  FBAWorkbenchPayload,
  PathDWorkbenchPayload,
} from "../../../store/workbenchPayloads";
import type { DBTLPhase } from "../../../types";
import type { ProvenanceEntry } from "../../../types/assumptions";
import type { DBTLLearnedFeedback, DBTLLearnedMetrics, DBTLMetricSource } from "../../../types/dbtlFeedback";
import { seedField } from "../../../config/seedFieldRegistry";
import { updateBelief } from "../../../services/learning/bayesianUpdate";
import type { LearnedDeltaPack, NumericDelta } from "../../../types/learnedDelta";

type AnalyzeArtifactLike = {
  id?: string;
  targetProduct?: string;
  summary?: string;
  bottleneckAssumptions?: Array<{ label: string; detail: string }>;
  enzymeCandidates?: Array<{ label: string; rationale: string }>;
  thermodynamicConcerns?: string[];
  pathwayCandidates?: Array<{ label: string; description: string }>;
  nodes?: Array<{ label: string; nodeType?: string }>;
};

type ProjectLike = {
  title?: string;
  targetProduct?: string;
  summary?: string;
};

interface FBASeed {
  targetProduct: string;
  pathwayFocus: string;
  mode: "single" | "community";
  objective: "biomass" | "atp" | "product";
  glucoseUptake: number;
  oxygenUptake: number;
  /** Learnable flux bound for glucose uptake (applied from approved changedBounds). */
  glucoseUptakeBounds: [number, number];
  knockouts: string[];
}

interface CETHXSeed {
  pathway: PathwayKey;
  tempC: number;
  pH: number;
}

interface CatalystSeed {
  enzymeIndex: number;
  requiredFlux: number;
  designCount: number;
  /** Thermodynamic temperature (deg C) from CETHX or benchmark default. */
  tempC: number;
  /** pH from CETHX or benchmark default. */
  pH: number;
}

interface DynConSeed {
  controller: {
    kp: number;
    ki: number;
    kd: number;
    setpoint: number;
  };
  hill: {
    vmax: number;
    kd: number;
    n: number;
  };
  /** Learnable objective weight (applied from approved changedWeights). */
  weights: { tracking: number };
}

interface CellFreeSeed {
  constructs: GeneConstruct[];
  params: CFSParameters;
}

interface DBTLDraft {
  phase: DBTLPhase;
  hypothesis: string;
  result: number;
  unit: string;
  passed: boolean;
  notes: string;
  feedback: DBTLLearnedFeedback;
  /** @deprecated Use feedback.learnedMetrics and feedback.sources instead. */
  learnedParameters: string[];
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function provenanceEntryId(provenance?: ProvenanceEntry) {
  return provenance ? `${provenance.toolId}:${provenance.timestamp}` : undefined;
}

function sourceFromPayload(
  payload:
    | CatalystWorkbenchPayload
    | CETHXWorkbenchPayload
    | DynConWorkbenchPayload
    | CellFreeWorkbenchPayload
    | DBTLWorkbenchPayload
    | null
    | undefined,
  notes?: string,
): DBTLMetricSource | null {
  if (!payload) return null;
  return {
    derivedFromToolId: payload.toolId,
    derivedAt: new Date(payload.updatedAt).toISOString(),
    ...(provenanceEntryId(payload.runProvenance)
      ? { provenanceEntryId: provenanceEntryId(payload.runProvenance) }
      : {}),
    ...(notes ? { notes } : {}),
  };
}

function getApprovedDeltaPacksForTool(
  dbtl: DBTLWorkbenchPayload | null | undefined,
  targetToolId: string,
): LearnedDeltaPack[] {
  if (!dbtl || dbtl.feedbackSource !== "committed") return [];
  return filterApprovedLearnedDeltaPacks(dbtl.result.learnedDeltaPacks ?? []).filter((pack) =>
    pack.targetToolIds.includes(targetToolId),
  );
}

function changedPriorDelta(
  packs: LearnedDeltaPack[],
  key: string,
): { delta: NumericDelta; pack: LearnedDeltaPack } | undefined {
  for (const pack of packs) {
    const delta = pack.changedPriors[key];
    if (delta && Number.isFinite(delta.after)) return { delta, pack };
  }
  return undefined;
}

const DEFAULT_PRIOR_VARIANCE = 1;
const OBS_VARIANCE_FLOOR = 1e-6;

function applyChangedPrior(current: number, packs: LearnedDeltaPack[], key: string, min: number, max: number): number {
  const found = changedPriorDelta(packs, key);
  if (!found) return current;
  const { delta, pack } = found;
  // Relative-scale deltas (P0-2 falsification proposals) are a MULTIPLICATIVE
  // correction folded into a Bayesian posterior: prior = current seed (variance
  // from the registry), observation = current * scale (variance from the pack's
  // falsification confidence). Legacy absolute deltas keep single-point replace.
  if (delta.unit === "relative-scale") {
    const priorVariance = seedField(key)?.priorVariance ?? DEFAULT_PRIOR_VARIANCE;
    const target = current * delta.after;
    const confidence = clampNumber(pack.learnedMetrics.confidenceScore ?? 0.5, 0, 0.95);
    const obsVariance = priorVariance * (1 - confidence) + OBS_VARIANCE_FLOOR;
    const posterior = updateBelief(
      { mean: current, variance: priorVariance },
      { value: target, variance: obsVariance },
    );
    return clampNumber(posterior.mean, min, max);
  }
  return clampNumber(delta.after, min, max);
}

/** Apply the latest approved `changedBounds` tuple for `key` (else keep current). */
export function applyChangedBound(current: [number, number], packs: LearnedDeltaPack[], key: string): [number, number] {
  for (const pack of packs) {
    const delta = pack.changedBounds[key];
    if (
      delta &&
      Number.isFinite(delta.after[0]) &&
      Number.isFinite(delta.after[1]) &&
      delta.after[0] <= delta.after[1]
    ) {
      return [delta.after[0], delta.after[1]];
    }
  }
  return current;
}

/** Apply the latest approved `changedWeights` value for `key`, clamped (else keep current). */
export function applyChangedWeight(
  current: number,
  packs: LearnedDeltaPack[],
  key: string,
  min: number,
  max: number,
): number {
  for (const pack of packs) {
    const delta = pack.changedWeights[key];
    if (delta && Number.isFinite(delta.after)) return clampNumber(delta.after, min, max);
  }
  return current;
}

function getTargetProduct(project?: ProjectLike | null, artifact?: AnalyzeArtifactLike | null) {
  return artifact?.targetProduct || project?.targetProduct || project?.title || "Target Product";
}

function collectPathDText(pathd?: PathDWorkbenchPayload | null) {
  if (!pathd) return "";
  return normalize(
    [pathd.targetProduct, pathd.activeRouteLabel, pathd.result.highlightedNode, pathd.result.recommendedNextTool]
      .filter(Boolean)
      .join(" "),
  );
}

function collectContextText(project?: ProjectLike | null, artifact?: AnalyzeArtifactLike | null) {
  return normalize(
    [
      project?.title,
      project?.summary,
      artifact?.targetProduct,
      artifact?.summary,
      ...(artifact?.bottleneckAssumptions ?? []).flatMap((item) => [item.label, item.detail]),
      ...(artifact?.enzymeCandidates ?? []).flatMap((item) => [item.label, item.rationale]),
      ...(artifact?.thermodynamicConcerns ?? []),
      ...(artifact?.pathwayCandidates ?? []).flatMap((item) => [item.label, item.description]),
      ...(artifact?.nodes ?? []).map((node) => node.label),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function inferCommunityMode(contextText: string) {
  return /community|consortium|co culture|coculture|microbial community/.test(contextText);
}

// P1.3: flux-driven pathway inference. When an FBA payload with topFluxes is
// available we sum absolute flux by subsystem and pick the pathway whose
// corresponding subsystem carries more flux. Falls back to text-heuristic
// when no FBA result is present.
export function inferPathwayKeyFromContext(
  project?: ProjectLike | null,
  artifact?: AnalyzeArtifactLike | null,
  fba?: FBAWorkbenchPayload | null,
): PathwayKey {
  // 1. Flux-driven (data-based) — preferred when available
  if (fba?.result?.topFluxes?.length) {
    const reactionLookup = new Map(REACTION_DEFS.map((r) => [r.id, r.subsystem]));
    const subsystemFlux: Record<string, number> = { Glycolysis: 0, TCA: 0, PPP: 0 };
    for (const f of fba.result.topFluxes) {
      const sub = reactionLookup.get(f.reactionId);
      if (sub && sub in subsystemFlux) {
        subsystemFlux[sub] += Math.abs(f.flux);
      }
    }
    const best = Object.entries(subsystemFlux).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) {
      if (best[0] === "TCA") return "tca";
      if (best[0] === "PPP") return "ppp";
      return "glycolysis";
    }
  }

  // 2. Text-heuristic fallback (no FBA data yet)
  const target = normalize(getTargetProduct(project, artifact));
  const contextText = collectContextText(project, artifact);
  if (/nadph|ribose|pentose|ppp/.test(contextText)) return "ppp";
  if (/tca|citrate|acetyl|accoa|malate|oaa/.test(contextText)) return "tca";
  if (/mevalonate|hmg co a|hmgr/.test(contextText)) return "tca";
  if (/fpp|artemisinin|amorpha|diene/.test(target) || /fpp|artemisinin|amorpha|diene/.test(contextText))
    return "glycolysis";
  return "glycolysis";
}

export function buildFBASeed(
  project?: ProjectLike | null,
  artifact?: AnalyzeArtifactLike | null,
  dbtl?: DBTLWorkbenchPayload | null,
  pathd?: PathDWorkbenchPayload | null,
): FBASeed {
  const targetProduct = getTargetProduct(project, artifact);
  const contextText = normalize(
    [collectContextText(project, artifact), collectPathDText(pathd)].filter(Boolean).join(" "),
  );
  const benchmark = findBenchmarkByTarget(targetProduct);
  const pathwayFocus = inferPathwayKeyFromContext(project, artifact, null);
  const bottleneckCount = Math.max(artifact?.bottleneckAssumptions?.length ?? 0, pathd?.result.bottleneckCount ?? 0);
  const concernCount = Math.max(artifact?.thermodynamicConcerns?.length ?? 0, pathd?.result.thermodynamicConcerns ?? 0);
  const candidateCount = Math.max(artifact?.pathwayCandidates?.length ?? 0, pathd?.result.pathwayCandidates ?? 0);
  const approvedDeltas = getApprovedDeltaPacksForTool(dbtl, "fbasim");
  const mode = inferCommunityMode(contextText) ? "community" : "single";

  const objective: FBASeed["objective"] = /product|titer|biosynthesis|artemisinin|acid|diene/.test(contextText)
    ? "product"
    : concernCount > 2
      ? "atp"
      : "biomass";

  const pathwayBoost = pathwayFocus === "tca" ? 2.4 : pathwayFocus === "ppp" ? 1.2 : 0.8;
  let glucoseUptake = clampNumber(
    (benchmark?.glucoseUptake ?? 9) + candidateCount * 0.9 + bottleneckCount * 0.5 + pathwayBoost,
    4,
    20,
  );
  let oxygenUptake = clampNumber(
    (benchmark?.oxygenUptake ?? 8) + concernCount * 0.7 + (pathwayFocus === "tca" ? 2.5 : 1.4),
    2,
    20,
  );

  const knockoutHints: string[] = [];
  if (/redox|nadph/.test(contextText)) knockoutHints.push("PGI");
  if (/energy|atp/.test(contextText)) knockoutHints.push("PFK");
  if (/overflow|pyruvate|ferment/.test(contextText)) knockoutHints.push("ENO");

  const objectiveSeed = objective;
  glucoseUptake = applyChangedPrior(glucoseUptake, approvedDeltas, "fbasim.glucoseUptake", 4, 20);
  oxygenUptake = applyChangedPrior(oxygenUptake, approvedDeltas, "fbasim.oxygenUptake", 2, 20);
  const glucoseUptakeBounds = applyChangedBound(
    [0, clampNumber(glucoseUptake * 2, 0, 25)],
    approvedDeltas,
    "fbasim.fluxBounds.glucose",
  );

  const allowedKnockouts = new Set(
    REACTION_DEFS.map((reaction) => reaction.id).filter(
      (reactionId) => !["GLCpts", "GAPD", "PYK", "PDH", "BIOMASS"].includes(reactionId),
    ),
  );

  return {
    targetProduct,
    pathwayFocus,
    mode,
    objective: objectiveSeed,
    glucoseUptake: round(glucoseUptake, 1),
    oxygenUptake: round(oxygenUptake, 1),
    glucoseUptakeBounds: [round(glucoseUptakeBounds[0], 1), round(glucoseUptakeBounds[1], 1)],
    knockouts: unique(knockoutHints).filter((reactionId) => allowedKnockouts.has(reactionId)),
  };
}

export function buildCETHXSeed(
  project?: ProjectLike | null,
  artifact?: AnalyzeArtifactLike | null,
  fba?: FBAWorkbenchPayload | null,
  pathd?: PathDWorkbenchPayload | null,
): CETHXSeed {
  let pathway = inferPathwayKeyFromContext(project, artifact, fba);
  const benchmark = findBenchmarkByTarget(getTargetProduct(project, artifact));
  const pathwayText = collectPathDText(pathd);
  if (/pentose|nadph|ppp/.test(pathwayText)) pathway = "ppp";
  if (/tca|acetyl|mevalonate/.test(pathwayText)) pathway = "tca";
  if (/glycolysis|artemisinin|fpp|diene/.test(pathwayText)) pathway = "glycolysis";
  if (fba?.result.topFluxes.some((flux) => flux.reactionId === "PDH" && flux.flux > 6)) {
    pathway = "tca";
  }

  const concernCount = artifact?.thermodynamicConcerns?.length ?? 0;
  const baseTemp = benchmark?.optimalTempC ?? (pathway === "tca" ? 31 : pathway === "ppp" ? 29 : 33);
  const tempC = clampNumber(
    baseTemp + (fba?.result.growthRate ?? 0) * 14 + (fba?.result.carbonEfficiency ?? 0) / 100,
    20,
    60,
  );
  const pH = clampNumber(
    (benchmark?.optimalPH ?? 7.3) -
      concernCount * 0.08 +
      ((fba?.result.sensitivityCoefficients.o2 ?? 0) > 0.03 ? 0.12 : -0.06),
    5.5,
    9,
  );

  return {
    pathway,
    tempC: round(tempC, 1),
    pH: round(pH, 1),
  };
}

function scoreEnzymeMatch(enzyme: EnzymeStructure, contextText: string, target: string, pathway: PathwayKey) {
  const searchable = normalize([enzyme.id, enzyme.name, enzyme.substrate, enzyme.product, enzyme.ecNumber].join(" "));

  let score = 0;
  const tokens = unique(contextText.split(" ").filter(Boolean));
  tokens.forEach((token) => {
    if (token.length > 2 && searchable.includes(token)) score += 1;
  });

  if (/artemisinin|amorpha|diene/.test(target) && enzyme.id === "ads") score += 8;
  if (/artemisinic acid|acid/.test(target) && enzyme.id === "cyp71av1") score += 8;
  if (/aldehyde/.test(target) && enzyme.id === "aldh1") score += 7;
  if (/fpp|farnesyl/.test(target) && enzyme.id === "erg20") score += 7;
  if (/mevalonate|hmg|hmgr/.test(contextText) && enzyme.id === "hmgr") score += 7;
  if (pathway === "tca" && enzyme.id === "hmgr") score += 2;
  if (pathway === "ppp" && enzyme.id === "erg20") score += 1;
  if (enzyme.id === RATE_LIMITING_ENZYME.id) score += 1;

  return score;
}

export function buildCatalystSeed(
  project?: ProjectLike | null,
  artifact?: AnalyzeArtifactLike | null,
  fba?: FBAWorkbenchPayload | null,
  cethx?: CETHXWorkbenchPayload | null,
  dbtl?: DBTLWorkbenchPayload | null,
): CatalystSeed {
  const target = normalize(getTargetProduct(project, artifact));
  const contextText = collectContextText(project, artifact);
  const pathway = cethx?.pathway ?? inferPathwayKeyFromContext(project, artifact, fba);
  const approvedDeltas = getApprovedDeltaPacksForTool(dbtl, "catdes");
  const scored = ENZYME_STRUCTURES.map((enzyme, index) => ({
    index,
    score: scoreEnzymeMatch(enzyme, contextText, target, pathway),
  })).sort((left, right) => right.score - left.score);

  const enzymeIndex = scored[0]?.score
    ? scored[0].index
    : ENZYME_STRUCTURES.findIndex((enzyme) => enzyme.id === RATE_LIMITING_ENZYME.id);
  let requiredFlux = clampNumber(
    (fba?.result.growthRate ?? 0.2) * 2.2 +
      (fba?.result.carbonEfficiency ?? 0) / 140 +
      (cethx?.result.efficiency ?? 0) / 160 +
      (artifact?.bottleneckAssumptions?.length ?? 0) * 0.04,
    0.15,
    3.2,
  );
  let designCount = clampNumber(
    6 + (artifact?.enzymeCandidates?.length ?? 0) + (artifact?.thermodynamicConcerns?.length ?? 0),
    6,
    14,
  );

  requiredFlux = applyChangedPrior(requiredFlux, approvedDeltas, "catdes.requiredFlux", 0.15, 3.2);
  designCount = Math.round(applyChangedPrior(designCount, approvedDeltas, "catdes.designCount", 6, 14));

  // Thermodynamic environment from CETHX payload or benchmark defaults
  const benchmark = findBenchmarkByTarget(getTargetProduct(project, artifact));
  const tempC = cethx?.tempC ?? benchmark?.optimalTempC ?? (pathway === "tca" ? 31 : pathway === "ppp" ? 29 : 33);
  const pH = cethx?.pH ?? benchmark?.optimalPH ?? 7.0;

  return {
    enzymeIndex: enzymeIndex >= 0 ? enzymeIndex : 2,
    requiredFlux: round(requiredFlux, 2),
    designCount,
    tempC: round(tempC, 1),
    pH: round(pH, 1),
  };
}

export function buildDynConSeed(
  fba?: FBAWorkbenchPayload | null,
  cethx?: CETHXWorkbenchPayload | null,
  catalyst?: CatalystWorkbenchPayload | null,
  dbtl?: DBTLWorkbenchPayload | null,
): DynConSeed {
  const benchmark = findBenchmarkByTarget(catalyst?.targetProduct ?? fba?.targetProduct ?? cethx?.targetProduct);
  const approvedDeltas = getApprovedDeltaPacksForTool(dbtl, "dyncon");
  let kp = clampNumber(
    1.5 + (cethx?.result.efficiency ?? 0) / 55 + (catalyst?.result.overallBinding ?? 0) * 1.8,
    0.5,
    8,
  );
  let ki = clampNumber(
    0.2 + (fba?.result.sensitivityCoefficients.o2 ?? 0) * 6 + (fba?.result.feasible ? 0.1 : 0),
    0.05,
    2.5,
  );
  let kd = clampNumber(
    0.05 + (catalyst?.result.growthPenalty ?? 0) / 180 + ((cethx?.result.gibbsFreeEnergy ?? -10) > -10 ? 0.06 : 0),
    0.02,
    1.5,
  );
  let setpoint = clampNumber(
    (benchmark?.dissolvedO2Setpoint ?? 0.32) +
      (fba?.result.growthRate ?? 0) * 0.85 -
      (catalyst?.result.totalMetabolicDrain ?? 0) * 0.08,
    0.2,
    0.9,
  );
  let vmax = clampNumber(0.65 + (catalyst?.result.bestCAI ?? 0.6) * 0.7, 0.2, 2);
  let hillKd = clampNumber(35 + (catalyst?.result.totalMetabolicDrain ?? 0.2) * 80, 5, 200);
  let hillN = clampNumber(1.4 + (catalyst?.result.topMutationSites ?? 2) * 0.18, 1, 4);

  kp = applyChangedPrior(kp, approvedDeltas, "dyncon.controller.kp", 0.5, 8);
  ki = applyChangedPrior(ki, approvedDeltas, "dyncon.controller.ki", 0.05, 2.5);
  kd = applyChangedPrior(kd, approvedDeltas, "dyncon.controller.kd", 0.02, 1.5);
  setpoint = applyChangedPrior(setpoint, approvedDeltas, "dyncon.controller.setpoint", 0.2, 0.9);
  vmax = applyChangedPrior(vmax, approvedDeltas, "dyncon.hill.vmax", 0.2, 2);
  hillKd = applyChangedPrior(hillKd, approvedDeltas, "dyncon.hill.kd", 5, 200);
  hillN = applyChangedPrior(hillN, approvedDeltas, "dyncon.hill.n", 1, 4);
  const trackingWeight = applyChangedWeight(1, approvedDeltas, "dyncon.weights.tracking", 0, 5);

  return {
    controller: {
      kp: round(kp, 2),
      ki: round(ki, 2),
      kd: round(kd, 2),
      setpoint: round(setpoint, 2),
    },
    hill: {
      vmax: round(vmax, 2),
      kd: round(hillKd, 1),
      n: round(hillN, 2),
    },
    weights: { tracking: round(trackingWeight, 2) },
  };
}

export function buildCellFreeSeed(
  project?: ProjectLike | null,
  artifact?: AnalyzeArtifactLike | null,
  catalyst?: CatalystWorkbenchPayload | null,
  dyncon?: DynConWorkbenchPayload | null,
  cethx?: CETHXWorkbenchPayload | null,
  dbtl?: DBTLWorkbenchPayload | null,
): CellFreeSeed {
  const targetProduct = getTargetProduct(project, artifact);
  const benchmark = findBenchmarkByTarget(targetProduct);
  const constructs = generateDefaultConstructs().map((construct) => ({ ...construct }));
  const params = generateDefaultParameters();
  const approvedDeltas = getApprovedDeltaPacksForTool(dbtl, "cellfree");

  const primaryIndex = catalyst
    ? ENZYME_STRUCTURES.findIndex((enzyme) => enzyme.id === catalyst.selectedEnzymeId)
    : ENZYME_STRUCTURES.findIndex((enzyme) => enzyme.id === RATE_LIMITING_ENZYME.id);
  const primaryEnzyme = ENZYME_STRUCTURES[primaryIndex >= 0 ? primaryIndex : 2];
  const expressionBias = clampNumber(
    (dyncon?.result.adsExpression ?? 0.8) + (catalyst?.result.bestCAI ?? 0.6),
    0.6,
    2.4,
  );

  constructs[1] = {
    ...constructs[1],
    id: primaryEnzyme.id,
    name: primaryEnzyme.name,
    rbs: dyncon?.result.rbsPart ?? constructs[1].rbs,
    cds: primaryEnzyme.product,
    proteinLength: primaryEnzyme.length,
    dnaConcentration: round(
      clampNumber(10 + expressionBias * 4 - (catalyst?.result.totalMetabolicDrain ?? 0.2) * 5, 5, 28),
      1,
    ),
    k_tx: round(clampNumber(primaryEnzyme.kcat * 0.4 + expressionBias * 0.3, 0.4, 3.2), 2),
    k_tl: round(clampNumber((catalyst?.result.bestCAI ?? 0.7) * 3.5, 0.8, 6), 2),
    K_tl: round(clampNumber(110 - (catalyst?.result.bestCAI ?? 0.7) * 40, 30, 120), 1),
  };

  constructs[2] = {
    ...constructs[2],
    name: `${targetProduct} validation reporter`,
    dnaConcentration: round(clampNumber(8 + (dyncon?.result.productTiter ?? 0) * 0.25, 4, 24), 1),
    k_tx: round(clampNumber(0.7 + (dyncon?.result.stable ? 0.25 : 0.05), 0.4, 2.5), 2),
  };

  params.temperature = Math.round(cethx?.tempC ?? benchmark?.cellFreeTempC ?? params.temperature);
  params.pH = round(cethx?.pH ?? benchmark?.optimalPH ?? 7.0, 1);
  params.simulationTime = Math.round(
    clampNumber(220 + (dyncon?.result.stable ? 20 : 70) + (catalyst?.result.totalMetabolicDrain ?? 0.2) * 35, 180, 420),
  );
  params.ribosomeTotal = round(
    clampNumber(
      params.ribosomeTotal + (dyncon?.result.productivity ?? 0) * 70 + (catalyst?.result.bestCAI ?? 0.7) * 60,
      300,
      900,
    ),
  );
  params.initialEnergy.atp = round(
    clampNumber(params.initialEnergy.atp + (dyncon?.result.productTiter ?? 0) * 0.02, 1.2, 4),
    2,
  );
  params.initialEnergy.gtp = round(
    clampNumber(params.initialEnergy.gtp + (catalyst?.result.bestCAI ?? 0.7) * 0.25, 1.2, 4),
    2,
  );
  params.initialEnergy.pep = round(
    clampNumber(params.initialEnergy.pep + (dyncon?.result.currentFPP ?? 0) * 0.03, 20, 45),
    2,
  );

  params.temperature = Math.round(
    applyChangedPrior(params.temperature, approvedDeltas, "cellfree.params.temperature", 20, 42),
  );
  params.simulationTime = Math.round(
    applyChangedPrior(params.simulationTime, approvedDeltas, "cellfree.params.simulationTime", 180, 420),
  );
  params.ribosomeTotal = round(
    applyChangedPrior(params.ribosomeTotal, approvedDeltas, "cellfree.params.ribosomeTotal", 300, 900),
  );

  return { constructs, params };
}

export function buildDBTLDraft(
  project?: ProjectLike | null,
  artifact?: AnalyzeArtifactLike | null,
  catalyst?: CatalystWorkbenchPayload | null,
  dyncon?: DynConWorkbenchPayload | null,
  cellfree?: CellFreeWorkbenchPayload | null,
  cethx?: CETHXWorkbenchPayload | null,
): DBTLDraft {
  const targetProduct = getTargetProduct(project, artifact);
  const confidence = cellfree?.result.confidence ?? 0;
  const stable = dyncon?.result.stable ?? false;
  const viable = catalyst?.result.isViable ?? true;

  let phase: DBTLPhase = "Design";
  if (confidence >= 0.65 && stable && viable) phase = "Build";
  else if (confidence >= 0.5 || stable) phase = "Test";
  else if (!viable) phase = "Learn";

  const result = round(
    (cellfree?.result.invivoExpression ?? cellfree?.result.totalProteinYield ?? 0) * 0.08 +
      (dyncon?.result.productTiter ?? 0) * 1.4 +
      ((catalyst?.result.bestSequenceScore ?? 0) < 0 ? 18 : 8),
    1,
  );

  const hypothesis = [
    `Deploy ${catalyst?.selectedEnzymeName ?? RATE_LIMITING_ENZYME.name}`,
    dyncon?.result.rbsPart ? `with ${dyncon.result.rbsPart}` : "with dynamic control-aware expression",
    `${Math.round(cellfree?.temperature ?? 30)}°C cell-free validation`,
  ].join(" ");

  const learnedParameters = [
    `binding Kd ${round(catalyst?.result.bindingKd ?? 0, 2)} μM`,
    `drain ${round((catalyst?.result.totalMetabolicDrain ?? 0) * 100, 1)}%`,
    `DO RMSE ${round(dyncon?.result.doRmse ?? 0, 3)}`,
    `CFPS confidence ${round(confidence * 100, 0)}%`,
  ];
  if (cethx) {
    learnedParameters.push(
      `ΔG' ${round(cethx.result.gibbsFreeEnergy, 1)} kJ/mol`,
      `thermo eff ${round(cethx.result.efficiency * 100, 1)}%`,
    );
  }
  const learnedMetrics: DBTLLearnedMetrics = {};
  if (catalyst) {
    learnedMetrics.bindingKdUM = round(catalyst.result.bindingKd, 2);
    learnedMetrics.drainPercent = round(catalyst.result.totalMetabolicDrain * 100, 1);
    learnedMetrics.growthPenaltyPercent = round(catalyst.result.growthPenalty, 1);
  }
  if (dyncon) {
    learnedMetrics.doRmse = round(dyncon.result.doRmse, 3);
  }
  if (cellfree?.result.confidence !== null && cellfree?.result.confidence !== undefined) {
    learnedMetrics.cfpsConfidence = round(cellfree.result.confidence * 100, 0);
    learnedMetrics.confidenceScore = round(cellfree.result.confidence, 3);
  }
  if (cethx) {
    learnedMetrics.gibbsFreeEnergy = round(cethx.result.gibbsFreeEnergy, 1);
    learnedMetrics.thermoEfficiency = round(cethx.result.efficiency, 3);
    learnedMetrics.thermoTempC = round(cethx.tempC, 1);
  }
  const sources = [
    sourceFromPayload(catalyst, "Catalyst metrics moved into DBTL typed feedback."),
    sourceFromPayload(dyncon, "DynCon metrics moved into DBTL typed feedback."),
    sourceFromPayload(cellfree, "CellFree metrics moved into DBTL typed feedback."),
    sourceFromPayload(cethx, "CETHX thermodynamic metrics moved into DBTL typed feedback."),
  ].filter((source): source is DBTLMetricSource => source !== null);
  const feedback: DBTLLearnedFeedback = {
    learnedMetrics,
    sources,
    legacyText: learnedParameters,
    schemaVersion: "dbtl-feedback-v1",
  };

  // Derive unit from benchmark: mg/L for titer targets, U/mL for enzymatic, mM for metabolites
  const benchmark = findBenchmarkByTarget(targetProduct);
  const unit = benchmark ? "mg/L" : /ase$|enzyme|protein/.test(normalize(targetProduct)) ? "U/mL" : "mg/L";

  return {
    phase,
    hypothesis,
    result,
    unit,
    passed: confidence >= 0.6 && stable && viable,
    notes: `${targetProduct} draft generated from live Catalyst, DynCon, Cell-Free, and CETHX outputs.`,
    feedback,
    learnedParameters,
  };
}
