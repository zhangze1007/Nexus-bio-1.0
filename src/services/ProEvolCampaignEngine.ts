export type CampaignProvenance = 'simulated' | 'inferred' | 'literature-backed' | 'user-supplied';
export type VariantSelectionStatus = 'selected' | 'rejected' | 'wild-type';
export type ConvergenceState =
  | 'broadening'
  | 'productive-convergence'
  | 'premature-collapse'
  | 'plateau';
export type RecommendationAction =
  | 'continue-another-round'
  | 'narrow-library'
  | 'broaden-exploration'
  | 'rescue-stability'
  | 'freeze-and-transfer'
  | 'stop-campaign';
export type LandscapeMode = 'activity' | 'diversity' | 'convergence' | 'confidence' | 'selection-density';

export interface SelectionObjective {
  label: string;
  summary: string;
  primaryMetric: string;
  balancingMetrics: string[];
}

export interface VariantMutation {
  position: number;
  from: string;
  to: string;
}

export interface VariantScore {
  composite: number;
  deltaFromWildType: number;
  activityTerm: number;
  stabilityTerm: number;
  expressionTerm: number;
  specificityTerm: number;
  burdenPenalty: number;
  riskPenalty: number;
}

export interface VariantCandidate {
  id: string;
  name: string;
  parentId: string | null;
  round: number;
  libraryRank: number;
  familyId: string;
  familyLabel: string;
  mutationString: string;
  mutatedPositions: number[];
  mutations: VariantMutation[];
  predictedActivity: number;
  predictedStability: number;
  predictedExpression: number;
  predictedSpecificity: number;
  mutationBurden: number;
  developability: number;
  confidence: number;
  riskFlags: string[];
  rationale: string;
  selectionReason: string;
  rejectionReason: string;
  status: VariantSelectionStatus;
  score: VariantScore;
  embedding: { x: number; y: number };
  lineageDepth: number;
  branchState: 'active' | 'persisting' | 'dead' | 'lead' | 'rejected' | 'wild-type';
  selectionDensity: number;
}

export interface VariantLibrary {
  roundNumber: number;
  candidates: VariantCandidate[];
  selectedSurvivors: VariantCandidate[];
  rejectedVariants: VariantCandidate[];
}

export interface DiversitySummary {
  index: number;
  familyCount: number;
  dominantFamily: string;
  dominantFamilyShare: number;
  mutationSpread: number;
  classification:
    | 'broadly exploring'
    | 'balanced exploration'
    | 'converging around one family'
    | 'over-collapsing early';
  narrative: string;
}

export interface ConvergenceSignal {
  state: ConvergenceState;
  score: number;
  improvementSlope: number;
  familyConcentration: number;
  persistenceSignals: string[];
  narrative: string;
}

export interface SelectionDecision {
  recommendedAction: RecommendationAction;
  summary: string;
  researchBrief: string;
  confidence: number;
  evidence: string[];
}

export interface NextRoundRecommendation {
  action: RecommendationAction;
  title: string;
  summary: string;
  rationale: string;
  directives: string[];
  stopSuggested: boolean;
  downstreamTransfer: boolean;
}

export interface LineageNode {
  variantId: string;
  parentId: string | null;
  name: string;
  round: number;
  familyLabel: string;
  mutationString: string;
  score: number;
  status: 'lead' | 'survivor' | 'dead' | 'rejected' | 'wild-type';
  x: number;
  y: number;
}

export interface RoundResult {
  roundNumber: number;
  librarySize: number;
  selectedSurvivors: VariantCandidate[];
  rejectedVariants: VariantCandidate[];
  averageScore: number;
  diversitySummary: DiversitySummary;
  convergenceSummary: ConvergenceSignal;
  bestLeadDelta: number;
  scoreDeltaVsPrevious: number;
  leadVariantId: string;
  persistentMutations: string[];
  variantLibrary: VariantLibrary;
}

export interface LandscapePoint {
  variantId: string;
  label: string;
  familyLabel: string;
  round: number;
  x: number;
  y: number;
  z: number;
  activity: number;
  diversity: number;
  convergence: number;
  confidence: number;
  selectionDensity: number;
  selected: boolean;
  lead: boolean;
  selectionStatus: VariantSelectionStatus;
}

export interface LandscapeEdge {
  fromId: string;
  toId: string;
  active: boolean;
  intensity: number;
}

export interface LandscapeHotspot {
  id: string;
  label: string;
  round: number;
  x: number;
  y: number;
  activity: number;
  diversity: number;
  convergence: number;
  confidence: number;
  selectionDensity: number;
  leadVariantId: string | null;
  leadScore: number;
  status: 'selected' | 'rejected' | 'mixed';
}

export interface LandscapeMap {
  points: LandscapePoint[];
  edges: LandscapeEdge[];
  hotspots: LandscapeHotspot[];
}

export interface ProEvolCampaignWeights {
  activity: number;
  stability: number;
  expression: number;
  specificity: number;
  burden: number;
  risk: number;
}

export interface ProEvolCampaignInput {
  campaignName: string;
  targetProtein: string;
  enzymeName: string;
  wildTypeLabel: string;
  startingSequence: string;
  optimizationObjective: SelectionObjective;
  assayCondition: string;
  selectionPressure: string;
  hostSystem: string;
  screeningSystem: string;
  provenance: CampaignProvenance;
  totalRounds: number;
  librarySize: number;
  survivorCount: number;
  selectionStringency: number;
  sitePool: number[];
  upstreamSignals: {
    pathwayPressure: number;
    catalystConfidence: number;
    thermodynamicStress: number;
    expressionHeadroom: number;
    literatureSupport: number;
  };
  scoreWeights?: Partial<ProEvolCampaignWeights>;
  seed?: number;
}

export interface ProteinEvolutionCampaign {
  id: string;
  name: string;
  targetProtein: string;
  enzymeName: string;
  wildTypeLabel: string;
  startingSequence: string;
  optimizationObjective: SelectionObjective;
  assayCondition: string;
  selectionPressure: string;
  hostSystem: string;
  screeningSystem: string;
  provenance: CampaignProvenance;
  currentRound: number;
  totalRounds: number;
  librarySize: number;
  survivorCount: number;
  selectionStringency: number;
  scoreWeights: ProEvolCampaignWeights;
  wildType: VariantCandidate;
  leadVariant: VariantCandidate;
  leadNarrative: string;
  rounds: RoundResult[];
  currentRoundResult: RoundResult;
  diversitySummary: DiversitySummary;
  convergenceSignal: ConvergenceSignal;
  persistentMutations: string[];
  selectionDecision: SelectionDecision;
  nextRoundRecommendation: NextRoundRecommendation;
  lineage: LineageNode[];
  variantIndex: Record<string, VariantCandidate>;
  landscape: LandscapeMap;
}

interface FamilyArchetype {
  id: string;
  label: string;
  centerX: number;
  centerY: number;
  activityBias: number;
  stabilityBias: number;
  expressionBias: number;
  specificityBias: number;
  preferredSiteIndexes: number[];
  substitutionPool: string[];
}

const FAMILY_ARCHETYPES: FamilyArchetype[] = [
  {
    id: 'activity-push',
    label: 'Activity push',
    centerX: 0.18,
    centerY: 0.76,
    activityBias: 10,
    stabilityBias: -4,
    expressionBias: 2,
    specificityBias: 2,
    preferredSiteIndexes: [1, 2, 4, 6],
    substitutionPool: ['V', 'I', 'L', 'F', 'Y'],
  },
  {
    id: 'stability-rescue',
    label: 'Stability rescue',
    centerX: 0.74,
    centerY: 0.22,
    activityBias: 2,
    stabilityBias: 12,
    expressionBias: 4,
    specificityBias: 1,
    preferredSiteIndexes: [0, 3, 5, 7],
    substitutionPool: ['A', 'T', 'S', 'N', 'Q'],
  },
  {
    id: 'specificity-balance',
    label: 'Specificity balance',
    centerX: 0.58,
    centerY: 0.64,
    activityBias: 6,
    stabilityBias: 4,
    expressionBias: 1,
    specificityBias: 9,
    preferredSiteIndexes: [2, 5, 6, 8],
    substitutionPool: ['Y', 'W', 'H', 'F', 'R'],
  },
  {
    id: 'expression-light',
    label: 'Expression light',
    centerX: 0.34,
    centerY: 0.34,
    activityBias: 4,
    stabilityBias: 6,
    expressionBias: 11,
    specificityBias: 0,
    preferredSiteIndexes: [0, 1, 4, 8],
    substitutionPool: ['A', 'G', 'S', 'T', 'N'],
  },
];

const DEFAULT_WEIGHTS: ProEvolCampaignWeights = {
  activity: 0.38,
  stability: 0.24,
  expression: 0.14,
  specificity: 0.12,
  burden: 3.7,
  risk: 4.4,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

class SeededRNG {
  private state: number;

  constructor(seed = 42) {
    this.state = seed;
  }

  next() {
    this.state = (this.state * 1664525 + 1013904223) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }

  gaussian() {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  pick<T>(items: T[]) {
    return items[Math.floor(this.next() * items.length) % items.length];
  }
}

function mergeWeights(overrides?: Partial<ProEvolCampaignWeights>): ProEvolCampaignWeights {
  return {
    activity: overrides?.activity ?? DEFAULT_WEIGHTS.activity,
    stability: overrides?.stability ?? DEFAULT_WEIGHTS.stability,
    expression: overrides?.expression ?? DEFAULT_WEIGHTS.expression,
    specificity: overrides?.specificity ?? DEFAULT_WEIGHTS.specificity,
    burden: overrides?.burden ?? DEFAULT_WEIGHTS.burden,
    risk: overrides?.risk ?? DEFAULT_WEIGHTS.risk,
  };
}

function createMutationString(mutations: VariantMutation[]) {
  if (!mutations.length) return 'WT';
  return [...mutations]
    .sort((left, right) => left.position - right.position)
    .map((mutation) => `${mutation.from}${mutation.position}${mutation.to}`)
    .join(' / ');
}

function scoreVariantMetrics(
  metrics: {
    activity: number;
    stability: number;
    expression: number;
    specificity: number;
    mutationBurden: number;
    riskPenalty: number;
  },
  wildTypeComposite: number,
  weights: ProEvolCampaignWeights,
): VariantScore {
  const activityTerm = (metrics.activity / 100) * weights.activity * 100;
  const stabilityTerm = (metrics.stability / 100) * weights.stability * 100;
  const expressionTerm = (metrics.expression / 100) * weights.expression * 100;
  const specificityTerm = (metrics.specificity / 100) * weights.specificity * 100;
  const burdenPenalty = metrics.mutationBurden * weights.burden;
  const riskPenalty = metrics.riskPenalty * weights.risk;
  const composite = clamp(
    round(activityTerm + stabilityTerm + expressionTerm + specificityTerm - burdenPenalty - riskPenalty, 2),
    0,
    100,
  );
  return {
    composite,
    deltaFromWildType: round(composite - wildTypeComposite, 2),
    activityTerm: round(activityTerm, 2),
    stabilityTerm: round(stabilityTerm, 2),
    expressionTerm: round(expressionTerm, 2),
    specificityTerm: round(specificityTerm, 2),
    burdenPenalty: round(burdenPenalty, 2),
    riskPenalty: round(riskPenalty, 2),
  };
}

export function scoreVariant(
  metrics: {
    activity: number;
    stability: number;
    expression: number;
    specificity: number;
    mutationBurden: number;
    riskPenalty: number;
  },
  weights: ProEvolCampaignWeights = DEFAULT_WEIGHTS,
  wildTypeComposite = 55,
) {
  return scoreVariantMetrics(metrics, wildTypeComposite, weights);
}

function determineRiskFlags(stability: number, expression: number, mutationBurden: number) {
  const flags: string[] = [];
  if (stability < 46) flags.push('stability floor');
  if (expression < 48) flags.push('expression drag');
  if (mutationBurden >= 4) flags.push('mutation burden');
  if (stability < 42 && mutationBurden >= 3) flags.push('aggregation risk');
  return flags;
}

function describeCandidate(
  activity: number,
  stability: number,
  expression: number,
  specificity: number,
  burden: number,
) {
  const strongestMetric = [
    { label: 'activity', value: activity },
    { label: 'stability', value: stability },
    { label: 'expression', value: expression },
    { label: 'specificity', value: specificity },
  ].sort((left, right) => right.value - left.value)[0]?.label ?? 'activity';
  const burdenPhrase = burden >= 4 ? 'with a heavy substitution stack' : burden >= 3 ? 'while carrying a moderate burden' : 'without overloading the sequence';
  return `This branch leans on ${strongestMetric} improvement ${burdenPhrase}, which keeps it relevant as a directed-evolution family rather than a one-off mutation event.`;
}

function mutationPersistence(
  variants: VariantCandidate[],
  threshold: number,
) {
  const counts = new Map<string, number>();
  variants.forEach((variant) => {
    variant.mutations.forEach((mutation) => {
      const key = `${mutation.from}${mutation.position}${mutation.to}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });
  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((left, right) => right[1] - left[1])
    .map(([mutation]) => mutation);
}

function averagePairwiseDistance(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let index = 0; index < points.length; index += 1) {
    for (let inner = index + 1; inner < points.length; inner += 1) {
      total += Math.hypot(points[index].x - points[inner].x, points[index].y - points[inner].y);
      pairs += 1;
    }
  }
  return total / Math.max(pairs, 1);
}

function summarizeDiversity(selected: VariantCandidate[]): DiversitySummary {
  const familyCounts = new Map<string, number>();
  selected.forEach((variant) => {
    familyCounts.set(variant.familyLabel, (familyCounts.get(variant.familyLabel) ?? 0) + 1);
  });
  const counts = [...familyCounts.values()];
  const maxCount = Math.max(...counts, 1);
  const dominantFamily = [...familyCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'No family';
  const dominantFamilyShare = round(maxCount / Math.max(selected.length, 1), 2);
  const familyCount = familyCounts.size;
  const mutationSpread = round(averagePairwiseDistance(selected.map((variant) => variant.embedding)), 3);
  const shannon = counts.reduce((sum, count) => {
    const proportion = count / Math.max(selected.length, 1);
    return sum - proportion * Math.log2(Math.max(proportion, 1e-10));
  }, 0);
  const normalizedIndex = round(familyCount > 1 ? shannon / Math.log2(familyCount) : 0, 2);

  let classification: DiversitySummary['classification'] = 'balanced exploration';
  if (familyCount >= 3 && dominantFamilyShare <= 0.45) classification = 'broadly exploring';
  else if (dominantFamilyShare >= 0.75 || familyCount <= 1) classification = 'over-collapsing early';
  else if (dominantFamilyShare >= 0.58) classification = 'converging around one family';

  const narrative =
    classification === 'broadly exploring'
      ? 'Survivors are still distributed across several variant families, so the campaign has not collapsed into a single lineage yet.'
      : classification === 'converging around one family'
        ? 'Selection is now favoring one lineage family, but secondary branches are still present and worth tracking for stability rescue.'
        : classification === 'over-collapsing early'
          ? 'The survivor pool is collapsing around too little sequence space, which raises the risk of premature fixation before the objective is fully explored.'
          : 'The campaign is balancing exploration and exploitation, with enough family breadth to justify another selection cycle.';

  return {
    index: normalizedIndex,
    familyCount,
    dominantFamily,
    dominantFamilyShare,
    mutationSpread,
    classification,
    narrative,
  };
}

function summarizeConvergence(rounds: RoundResult[], currentSelected: VariantCandidate[]): ConvergenceSignal {
  const currentDiversity = summarizeDiversity(currentSelected);
  const familyConcentration = currentDiversity.dominantFamilyShare;
  const lastLead = rounds[rounds.length - 1]?.selectedSurvivors[0];
  const prevLead = rounds[rounds.length - 2]?.selectedSurvivors[0];
  const improvementSlope = round((lastLead?.score.composite ?? 0) - (prevLead?.score.composite ?? lastLead?.score.composite ?? 0), 2);
  const persistenceSignals = mutationPersistence(currentSelected, 2).slice(0, 4);

  let state: ConvergenceState = 'productive-convergence';
  if (improvementSlope < 1.1 && familyConcentration >= 0.68) state = 'plateau';
  else if (familyConcentration >= 0.78) state = 'premature-collapse';
  else if (familyConcentration <= 0.45 && currentDiversity.familyCount >= 3) state = 'broadening';

  const narrative =
    state === 'broadening'
      ? 'Variant families remain dispersed, so the campaign is still exploring multiple mutational directions without over-committing to one basin.'
      : state === 'premature-collapse'
        ? 'One family is taking over before the gain curve has clearly flattened, which suggests the current library is converging too early.'
        : state === 'plateau'
          ? 'Lead gains are flattening while survivor diversity is narrowing, so additional rounds should be justified carefully rather than assumed.'
          : 'The campaign is converging around a productive lineage while still preserving enough branch diversity to support another round.';

  return {
    state,
    score: round(clamp((1 - familyConcentration) * 50 + Math.max(improvementSlope, 0) * 6, 0, 100), 2),
    improvementSlope,
    familyConcentration,
    persistenceSignals,
    narrative,
  };
}

function recommendationFromCampaign(
  leadVariant: VariantCandidate,
  diversitySummary: DiversitySummary,
  convergenceSignal: ConvergenceSignal,
  currentRound: RoundResult,
) {
  const burdenRisk = leadVariant.mutationBurden >= 4 || leadVariant.riskFlags.includes('mutation burden');
  const lowStability = leadVariant.predictedStability < 52 || leadVariant.riskFlags.includes('stability floor');
  const flattening = currentRound.scoreDeltaVsPrevious < 1.2 || convergenceSignal.state === 'plateau';

  if (leadVariant.score.composite >= 72 && leadVariant.confidence >= 73 && !lowStability && !burdenRisk) {
    return {
      nextRoundRecommendation: {
        action: 'freeze-and-transfer' as RecommendationAction,
        title: 'Freeze the lead family and transfer it downstream',
        summary: 'The current lead has enough score, stability, and confidence to justify downstream validation instead of another expansive library.',
        rationale: 'Lead gains remain credible and the branch is no longer paying a destabilizing burden penalty, so downstream screening is the higher-value next step.',
        directives: [
          'Freeze the current lead family as the transfer candidate.',
          'Export the surviving family table and lineage summary for downstream validation.',
          'Use cell-free or DBTL validation before reopening broader evolution.',
        ],
        stopSuggested: false,
        downstreamTransfer: true,
      },
      selectionDecision: {
        recommendedAction: 'freeze-and-transfer' as RecommendationAction,
        summary: 'Transfer the lead family downstream rather than spending another round on marginal exploratory gain.',
        researchBrief: 'The lead branch is ahead on composite score while keeping stability above the campaign floor, so the research decision is to preserve that family and validate it in a downstream stage.',
        confidence: 0.83,
        evidence: [
          `Lead score ${leadVariant.score.composite.toFixed(1)}`,
          `Lead stability ${leadVariant.predictedStability.toFixed(1)}`,
          `Diversity index ${diversitySummary.index.toFixed(2)}`,
        ],
      },
    };
  }

  if (lowStability) {
    return {
      nextRoundRecommendation: {
        action: 'rescue-stability' as RecommendationAction,
        title: 'Rescue stability before pushing activity further',
        summary: 'The lead lineage is still improving, but stability is approaching the floor too quickly to justify a pure activity push.',
        rationale: 'Directed evolution should preserve a viable family. Stability rescue is warranted before another burden-adding round narrows the sequence window further.',
        directives: [
          'Keep the current lead family in play, but constrain the next library to lower-burden substitutions.',
          'Preserve the strongest persistent mutation and diversify only secondary positions around it.',
          'Treat stability floor failures as hard rejections in the next round.',
        ],
        stopSuggested: false,
        downstreamTransfer: false,
      },
      selectionDecision: {
        recommendedAction: 'rescue-stability' as RecommendationAction,
        summary: 'The campaign should rescue stability before attempting another aggressive activity expansion.',
        researchBrief: 'Activity gains are still present, but the survivor pool is paying for them with increasing stability risk. The correct next move is to stabilize the current family rather than push more burden into it.',
        confidence: 0.79,
        evidence: [
          `Lead stability ${leadVariant.predictedStability.toFixed(1)}`,
          `Mutation burden ${leadVariant.mutationBurden}`,
          `Risk flags ${leadVariant.riskFlags.join(', ') || 'none'}`,
        ],
      },
    };
  }

  if (convergenceSignal.state === 'premature-collapse' || diversitySummary.classification === 'over-collapsing early') {
    return {
      nextRoundRecommendation: {
        action: 'broaden-exploration' as RecommendationAction,
        title: 'Broaden the next library before fixation sets in',
        summary: 'The survivor pool is concentrating too quickly around one family, so the next round should restore exploratory breadth.',
        rationale: 'Premature fixation risks trapping the campaign in one lineage before secondary beneficial combinations are tested.',
        directives: [
          'Retain the lead family as an anchor but lower its relative oversampling.',
          'Increase family diversity in the next library design.',
          'Bias the next round toward alternative secondary-shell positions rather than reusing the same mutation stack.',
        ],
        stopSuggested: false,
        downstreamTransfer: false,
      },
      selectionDecision: {
        recommendedAction: 'broaden-exploration' as RecommendationAction,
        summary: 'The campaign is converging too early and should reopen sequence diversity.',
        researchBrief: 'Selection is rewarding one lineage faster than the evidence justifies. A broader next-round library is the safer research choice than doubling down on the same branch immediately.',
        confidence: 0.76,
        evidence: [
          `Dominant family share ${Math.round(diversitySummary.dominantFamilyShare * 100)}%`,
          `Convergence state ${convergenceSignal.state}`,
          `Persistent mutations ${convergenceSignal.persistenceSignals.join(', ') || 'none'}`,
        ],
      },
    };
  }

  if (flattening) {
    return {
      nextRoundRecommendation: {
        action: 'stop-campaign' as RecommendationAction,
        title: 'Stop the campaign because incremental gains are flattening',
        summary: 'Another round is unlikely to justify the experimental burden unless the objective or assay changes.',
        rationale: 'The gain curve is flattening and the campaign is no longer returning enough new improvement to warrant another selection cycle under the current rules.',
        directives: [
          'Freeze the current lead as the best modeled campaign output.',
          'Archive the round summary and lineage trace.',
          'Reopen evolution only if the objective or assay pressure changes.',
        ],
        stopSuggested: true,
        downstreamTransfer: true,
      },
      selectionDecision: {
        recommendedAction: 'stop-campaign' as RecommendationAction,
        summary: 'Current evidence suggests stopping the campaign rather than extending a flattening improvement curve.',
        researchBrief: 'The selected family is no longer separating meaningfully from the rest of the pool. Without a new objective or pressure shift, another round is more likely to consume time than create a stronger lead.',
        confidence: 0.72,
        evidence: [
          `Round delta ${currentRound.scoreDeltaVsPrevious.toFixed(2)}`,
          `Convergence ${convergenceSignal.state}`,
          `Diversity index ${diversitySummary.index.toFixed(2)}`,
        ],
      },
    };
  }

  if (leadVariant.mutationBurden >= 3) {
    return {
      nextRoundRecommendation: {
        action: 'narrow-library' as RecommendationAction,
        title: 'Preserve the lead family but narrow the next library',
        summary: 'The best path is now to keep the winning lineage while reducing the mutational search width around it.',
        rationale: 'The lead family is productive, but additional broad mutation stacking would add burden faster than it adds useful gain.',
        directives: [
          'Lock the strongest persistent mutation in the next round.',
          'Restrict diversification to one or two supporting positions.',
          'Reject high-burden variants unless they clear the stability floor comfortably.',
        ],
        stopSuggested: false,
        downstreamTransfer: false,
      },
      selectionDecision: {
        recommendedAction: 'narrow-library' as RecommendationAction,
        summary: 'The campaign should keep the lead lineage and narrow the mutational scope around it.',
        researchBrief: 'This is the stage where PROEVOL should stop exploring indiscriminately and start exploiting the strongest family with tighter, lower-burden libraries.',
        confidence: 0.8,
        evidence: [
          `Lead burden ${leadVariant.mutationBurden}`,
          `Lead score ${leadVariant.score.composite.toFixed(1)}`,
          `Convergence ${convergenceSignal.state}`,
        ],
      },
    };
  }

  return {
    nextRoundRecommendation: {
      action: 'continue-another-round' as RecommendationAction,
      title: 'Continue another round with the current family mix',
      summary: 'The campaign is still making productive gains without collapsing or violating the stability floor.',
      rationale: 'Survivor diversity remains healthy enough and the lead family is still separating from wild type, so one more round is justified.',
      directives: [
        'Carry the current survivor set forward as parents for the next library.',
        'Preserve persistent mutations while exploring one new supporting substitution per branch.',
        'Keep the same assay pressure and selection floor for one more cycle.',
      ],
      stopSuggested: false,
      downstreamTransfer: false,
    },
    selectionDecision: {
      recommendedAction: 'continue-another-round' as RecommendationAction,
      summary: 'The campaign is still productive enough to justify another round under the same selection regime.',
      researchBrief: 'Improvement, diversity, and stability remain aligned. The next scientific action is to continue the campaign rather than freeze the lead prematurely.',
      confidence: 0.74,
      evidence: [
        `Lead delta ${leadVariant.score.deltaFromWildType.toFixed(1)}`,
        `Diversity ${diversitySummary.classification}`,
        `Convergence ${convergenceSignal.state}`,
      ],
    },
  };
}

function deriveFamilySelectionDensity(selected: VariantCandidate[], familyLabel: string) {
  const total = Math.max(selected.length, 1);
  const familyTotal = selected.filter((variant) => variant.familyLabel === familyLabel).length;
  return round(familyTotal / total, 2);
}

function preferredSites(
  sitePool: number[],
  preferredSiteIndexes: number[],
) {
  return preferredSiteIndexes.map((index) => sitePool[index % sitePool.length]).filter(Boolean);
}

function pickMutationSite(
  rng: SeededRNG,
  sitePool: number[],
  family: FamilyArchetype,
  usedPositions: number[],
) {
  const preferred = preferredSites(sitePool, family.preferredSiteIndexes).filter((position) => !usedPositions.includes(position));
  const fallback = sitePool.filter((position) => !usedPositions.includes(position));
  const pool = preferred.length ? preferred : fallback;
  return pool[Math.floor(rng.next() * pool.length) % pool.length] ?? sitePool[0];
}

function chooseSubstitution(
  rng: SeededRNG,
  from: string,
  family: FamilyArchetype,
) {
  const pool = family.substitutionPool.filter((residue) => residue !== from);
  return pool[Math.floor(rng.next() * pool.length) % pool.length] ?? (from === 'A' ? 'V' : 'A');
}

function mutationBonus(position: number, toResidue: string, sequenceLength: number) {
  const normalized = position / Math.max(sequenceLength, 1);
  let activityBonus = 0;
  let stabilityBonus = 0;
  let specificityBonus = 0;
  let expressionBonus = 0;

  if (normalized > 0.15 && normalized < 0.35) activityBonus += 2.4;
  if (normalized > 0.45 && normalized < 0.7) stabilityBonus += 2.0;
  if (normalized > 0.68) expressionBonus += 1.6;
  if (['Y', 'W', 'H', 'R'].includes(toResidue)) specificityBonus += 1.8;
  if (['A', 'S', 'T', 'N'].includes(toResidue)) stabilityBonus += 1.2;

  return { activityBonus, stabilityBonus, expressionBonus, specificityBonus };
}

function buildCandidate(
  rng: SeededRNG,
  input: ProEvolCampaignInput,
  roundNumber: number,
  libraryRank: number,
  parent: VariantCandidate,
  family: FamilyArchetype,
  wildType: VariantCandidate,
  wildTypeComposite: number,
  weights: ProEvolCampaignWeights,
): VariantCandidate {
  const existingMutations = [...parent.mutations];
  const mutationSteps = roundNumber === 1 ? (rng.next() < 0.72 ? 1 : 2) : (rng.next() < 0.58 ? 1 : 2);
  const mutations = [...existingMutations];

  for (let step = 0; step < mutationSteps; step += 1) {
    const position = pickMutationSite(rng, input.sitePool, family, mutations.map((mutation) => mutation.position));
    const from = input.startingSequence[position - 1] ?? 'A';
    const to = chooseSubstitution(rng, from, family);
    if (!mutations.some((mutation) => mutation.position === position)) {
      mutations.push({ position, from, to });
    }
  }

  const mutationBurden = mutations.length;
  const mutationBonuses = mutations.reduce(
    (sum, mutation) => {
      const bonus = mutationBonus(mutation.position, mutation.to, input.startingSequence.length);
      return {
        activity: sum.activity + bonus.activityBonus,
        stability: sum.stability + bonus.stabilityBonus,
        expression: sum.expression + bonus.expressionBonus,
        specificity: sum.specificity + bonus.specificityBonus,
      };
    },
    { activity: 0, stability: 0, expression: 0, specificity: 0 },
  );

  const parentActivityCarry = (parent.predictedActivity - wildType.predictedActivity) * 0.74;
  const parentStabilityCarry = (parent.predictedStability - wildType.predictedStability) * 0.72;
  const parentExpressionCarry = (parent.predictedExpression - wildType.predictedExpression) * 0.7;
  const parentSpecificityCarry = (parent.predictedSpecificity - wildType.predictedSpecificity) * 0.68;
  const incrementalBurden = Math.max(mutationBurden - parent.mutationBurden, 1);
  const roundPressure = input.upstreamSignals.pathwayPressure * 10;
  const confidenceSupport = input.upstreamSignals.literatureSupport * 9;
  const catalystSupport = input.upstreamSignals.catalystConfidence * 8;
  const stressPenalty = input.upstreamSignals.thermodynamicStress * 6;
  const expressionSupport = input.upstreamSignals.expressionHeadroom * 7;

  const predictedActivity = clamp(
    round(
      wildType.predictedActivity
        + parentActivityCarry
        + family.activityBias * 0.75
        + mutationBonuses.activity * 1.15
        + roundPressure
        + roundNumber * 0.8
        - incrementalBurden * 1.1
        + rng.gaussian() * 3.4,
      2,
    ),
    30,
    97,
  );
  const predictedStability = clamp(
    round(
      wildType.predictedStability
        + parentStabilityCarry
        + family.stabilityBias * 0.75
        + mutationBonuses.stability
        + expressionSupport * 0.45
        - incrementalBurden * 1.7
        - stressPenalty
        + rng.gaussian() * 3.1,
      2,
    ),
    26,
    96,
  );
  const predictedExpression = clamp(
    round(
      wildType.predictedExpression
        + parentExpressionCarry
        + family.expressionBias * 0.72
        + mutationBonuses.expression
        + expressionSupport
        + catalystSupport * 0.3
        - incrementalBurden * 1.0
        + rng.gaussian() * 2.8,
      2,
    ),
    28,
    97,
  );
  const predictedSpecificity = clamp(
    round(
      wildType.predictedSpecificity
        + parentSpecificityCarry
        + family.specificityBias * 0.76
        + mutationBonuses.specificity * 1.1
        + catalystSupport * 0.4
        - incrementalBurden * 0.7
        + rng.gaussian() * 2.6,
      2,
    ),
    26,
    97,
  );
  const riskFlags = determineRiskFlags(predictedStability, predictedExpression, mutationBurden);
  const riskPenalty = riskFlags.length * 1.6 + Math.max(0, 52 - predictedStability) * 0.04;
  const developability = clamp(
    round((predictedStability + predictedExpression) / 2 - mutationBurden * 3.6 - riskFlags.length * 1.8, 2),
    10,
    94,
  );
  const confidence = clamp(
    round(
      42
        + roundNumber * 5
        + confidenceSupport
        + catalystSupport * 0.7
        - mutationBurden * 2.4
        - riskFlags.length * 2.3
        + rng.gaussian() * 2,
      2,
    ),
    28,
    94,
  );
  const score = scoreVariantMetrics(
    {
      activity: predictedActivity,
      stability: predictedStability,
      expression: predictedExpression,
      specificity: predictedSpecificity,
      mutationBurden,
      riskPenalty,
    },
    wildTypeComposite,
    weights,
  );
  const mutationString = createMutationString(mutations);
  const embedding = {
    x: clamp(round(family.centerX + rng.gaussian() * 0.06 + score.deltaFromWildType * 0.002, 3), 0.05, 0.95),
    y: clamp(round(family.centerY + rng.gaussian() * 0.06 - mutationBurden * 0.01, 3), 0.05, 0.95),
  };

  return {
    id: `proevol-r${roundNumber}-v${libraryRank + 1}`,
    name: `PV-R${roundNumber}-${String(libraryRank + 1).padStart(2, '0')}`,
    parentId: parent.id,
    round: roundNumber,
    libraryRank,
    familyId: family.id,
    familyLabel: family.label,
    mutationString,
    mutatedPositions: mutations.map((mutation) => mutation.position).sort((left, right) => left - right),
    mutations,
    predictedActivity,
    predictedStability,
    predictedExpression,
    predictedSpecificity,
    mutationBurden,
    developability,
    confidence,
    riskFlags,
    rationale: describeCandidate(
      predictedActivity,
      predictedStability,
      predictedExpression,
      predictedSpecificity,
      mutationBurden,
    ),
    selectionReason: '',
    rejectionReason: '',
    status: 'rejected',
    score,
    embedding,
    lineageDepth: parent.lineageDepth + 1,
    branchState: 'rejected',
    selectionDensity: 0,
  };
}

function selectSurvivors(
  candidates: VariantCandidate[],
  survivorCount: number,
  selectionStringency: number,
): { selected: VariantCandidate[]; rejected: VariantCandidate[]; stabilityFloor: number } {
  const sorted = [...candidates].sort((left, right) => {
    if (right.score.composite !== left.score.composite) return right.score.composite - left.score.composite;
    return right.predictedStability - left.predictedStability;
  });
  const stabilityFloor = round(47 + selectionStringency * 10, 1);
  const minFamilies = survivorCount >= 4 ? (selectionStringency < 0.62 ? 3 : 2) : 2;
  const selected: VariantCandidate[] = [];
  const selectedFamilies = new Set<string>();

  sorted.forEach((candidate) => {
    if (
      selected.length < minFamilies
      && !selectedFamilies.has(candidate.familyId)
      && candidate.predictedStability >= stabilityFloor - 3
    ) {
      selected.push(candidate);
      selectedFamilies.add(candidate.familyId);
    }
  });

  sorted.forEach((candidate) => {
    if (selected.length >= survivorCount) return;
    if (selected.some((item) => item.id === candidate.id)) return;
    if (candidate.predictedStability < stabilityFloor && candidate.score.composite < sorted[Math.min(survivorCount, sorted.length) - 1].score.composite + 2) return;
    selected.push(candidate);
    selectedFamilies.add(candidate.familyId);
  });

  const finalSelected = selected.slice(0, survivorCount).sort((left, right) => right.score.composite - left.score.composite);
  const finalRejected = sorted.filter((candidate) => !finalSelected.some((selectedCandidate) => selectedCandidate.id === candidate.id));
  return { selected: finalSelected, rejected: finalRejected, stabilityFloor };
}

function annotateSelectionReasons(
  selected: VariantCandidate[],
  rejected: VariantCandidate[],
  stabilityFloor: number,
) {
  const selectedFamilies = new Set(selected.map((variant) => variant.familyId));

  selected.forEach((variant, index) => {
    const reason =
      variant.predictedStability < stabilityFloor
        ? `Selected despite a marginal stability drop because the activity gain remained unusually strong for round ${variant.round}.`
        : index === 0
          ? 'This variant leads the current round because it combines the best composite score with a credible stability and expression profile.'
          : selectedFamilies.size > 1 && index < selectedFamilies.size
            ? 'Selected to preserve family diversity while still clearing the round score and stability thresholds.'
            : 'Selected as a survivor because it improved the composite campaign score without violating the round selection floor.';
    variant.status = 'selected';
    variant.selectionReason = reason;
    variant.branchState = 'persisting';
  });

  rejected.forEach((variant) => {
    let reason = 'Rejected because stronger sibling variants carried the same family direction with a better score profile.';
    if (variant.predictedStability < stabilityFloor) {
      reason = 'Rejected because predicted stability fell below the round floor before the activity gain justified the burden.';
    } else if (variant.riskFlags.includes('mutation burden')) {
      reason = 'Rejected because the mutation stack added burden faster than it improved the selection objective.';
    } else if (selected.some((selectedVariant) => selectedVariant.familyId === variant.familyId && selectedVariant.score.composite > variant.score.composite)) {
      reason = 'Rejected because this branch duplicated a stronger survivor from the same family without adding new diversity value.';
    }
    variant.status = 'rejected';
    variant.rejectionReason = reason;
    variant.branchState = 'rejected';
  });
}

function buildLineage(
  variants: VariantCandidate[],
  leadVariantId: string,
  currentRoundSurvivorIds: Set<string>,
  descendants: Map<string, number>,
): LineageNode[] {
  return variants.map((variant) => {
    const status =
      variant.status === 'wild-type'
        ? 'wild-type'
        : variant.id === leadVariantId
          ? 'lead'
          : currentRoundSurvivorIds.has(variant.id)
            ? 'survivor'
            : (descendants.get(variant.id) ?? 0) > 0
              ? 'dead'
              : 'rejected';
    return {
      variantId: variant.id,
      parentId: variant.parentId,
      name: variant.name,
      round: variant.round,
      familyLabel: variant.familyLabel,
      mutationString: variant.mutationString,
      score: variant.score.composite,
      status,
      x: variant.round,
      y: round(variant.embedding.y, 3),
    };
  });
}

export function buildLandscapeMap(
  campaign: Pick<ProteinEvolutionCampaign, 'rounds' | 'leadVariant' | 'currentRound'>,
): LandscapeMap {
  const points: LandscapePoint[] = [];
  const edges: LandscapeEdge[] = [];
  const familyGroups = new Map<string, VariantCandidate[]>();

  campaign.rounds.forEach((roundResult) => {
    roundResult.variantLibrary.candidates.forEach((variant) => {
      points.push({
        variantId: variant.id,
        label: variant.name,
        familyLabel: variant.familyLabel,
        round: variant.round,
        x: variant.embedding.x,
        y: variant.embedding.y,
        z: round(variant.score.composite / 100, 3),
        activity: round(variant.predictedActivity / 100, 3),
        diversity: round(roundResult.diversitySummary.index, 3),
        convergence: round(1 - roundResult.convergenceSummary.familyConcentration, 3),
        confidence: round(variant.confidence / 100, 3),
        selectionDensity: round(variant.selectionDensity, 3),
        selected: variant.status === 'selected',
        lead: variant.id === campaign.leadVariant.id,
        selectionStatus: variant.status,
      });
      if (variant.parentId) {
        edges.push({
          fromId: variant.parentId,
          toId: variant.id,
          active: variant.status === 'selected' || variant.id === campaign.leadVariant.id,
          intensity: round(variant.status === 'selected' ? 0.85 : 0.35, 2),
        });
      }
      const group = familyGroups.get(variant.familyLabel) ?? [];
      group.push(variant);
      familyGroups.set(variant.familyLabel, group);
    });
  });

  const hotspots: LandscapeHotspot[] = [...familyGroups.entries()].map(([familyLabel, variants]) => {
    const latestRound = Math.max(...variants.map((variant) => variant.round));
    const currentRoundVariants = variants.filter((variant) => variant.round === latestRound);
    const leadVariant = currentRoundVariants.find((variant) => variant.status === 'selected') ?? variants[0];
    const status =
      currentRoundVariants.every((variant) => variant.status === 'selected')
        ? 'selected'
        : currentRoundVariants.every((variant) => variant.status === 'rejected')
          ? 'rejected'
          : 'mixed';
    return {
      id: familyLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label: familyLabel,
      round: latestRound,
      x: round(average(variants.map((variant) => variant.embedding.x)), 3),
      y: round(average(variants.map((variant) => variant.embedding.y)), 3),
      activity: round(average(currentRoundVariants.map((variant) => variant.predictedActivity / 100)), 3),
      diversity: round(average(currentRoundVariants.map((variant) => variant.selectionDensity < 0.4 ? 0.75 : 0.3)), 3),
      convergence: round(average(currentRoundVariants.map((variant) => variant.selectionDensity)), 3),
      confidence: round(average(currentRoundVariants.map((variant) => variant.confidence / 100)), 3),
      selectionDensity: round(average(currentRoundVariants.map((variant) => variant.selectionDensity)), 3),
      leadVariantId: leadVariant?.id ?? null,
      leadScore: round(leadVariant?.score.composite ?? 0, 2),
      status,
    };
  });

  return { points, edges, hotspots };
}

export function buildProEvolCampaign(input: ProEvolCampaignInput): ProteinEvolutionCampaign {
  const weights = mergeWeights(input.scoreWeights);
  const seed =
    input.seed
    ?? hashString(
      [
        input.campaignName,
        input.targetProtein,
        input.startingSequence.length,
        input.totalRounds,
        input.librarySize,
        input.survivorCount,
      ].join('|'),
    );
  const rng = new SeededRNG(seed);
  const wildTypeMetrics = {
    activity: clamp(round(46 + input.upstreamSignals.pathwayPressure * 16 + input.upstreamSignals.catalystConfidence * 6, 2), 35, 70),
    stability: clamp(round(60 - input.upstreamSignals.thermodynamicStress * 9 + input.upstreamSignals.expressionHeadroom * 4, 2), 40, 82),
    expression: clamp(round(58 + input.upstreamSignals.expressionHeadroom * 12, 2), 42, 84),
    specificity: clamp(round(54 + input.upstreamSignals.catalystConfidence * 8, 2), 40, 82),
  };
  const wildTypeComposite = scoreVariantMetrics(
    {
      activity: wildTypeMetrics.activity,
      stability: wildTypeMetrics.stability,
      expression: wildTypeMetrics.expression,
      specificity: wildTypeMetrics.specificity,
      mutationBurden: 0,
      riskPenalty: 0,
    },
    0,
    weights,
  ).composite;
  const wildType: VariantCandidate = {
    id: 'wt',
    name: input.wildTypeLabel,
    parentId: null,
    round: 0,
    libraryRank: 0,
    familyId: 'wild-type',
    familyLabel: 'Wild type',
    mutationString: 'WT',
    mutatedPositions: [],
    mutations: [],
    predictedActivity: wildTypeMetrics.activity,
    predictedStability: wildTypeMetrics.stability,
    predictedExpression: wildTypeMetrics.expression,
    predictedSpecificity: wildTypeMetrics.specificity,
    mutationBurden: 0,
    developability: round((wildTypeMetrics.stability + wildTypeMetrics.expression) / 2, 2),
    confidence: clamp(round(58 + input.upstreamSignals.literatureSupport * 12, 2), 45, 82),
    riskFlags: [],
    rationale: 'Wild type remains the reference family against which all directed-evolution gains are judged.',
    selectionReason: 'Baseline starting sequence for the campaign.',
    rejectionReason: '',
    status: 'wild-type',
    score: {
      composite: wildTypeComposite,
      deltaFromWildType: 0,
      activityTerm: round((wildTypeMetrics.activity / 100) * weights.activity * 100, 2),
      stabilityTerm: round((wildTypeMetrics.stability / 100) * weights.stability * 100, 2),
      expressionTerm: round((wildTypeMetrics.expression / 100) * weights.expression * 100, 2),
      specificityTerm: round((wildTypeMetrics.specificity / 100) * weights.specificity * 100, 2),
      burdenPenalty: 0,
      riskPenalty: 0,
    },
    embedding: { x: 0.5, y: 0.5 },
    lineageDepth: 0,
    branchState: 'wild-type',
    selectionDensity: 0,
  };

  const rounds: RoundResult[] = [];
  const variantIndex = new Map<string, VariantCandidate>([['wt', wildType]]);
  const allVariants: VariantCandidate[] = [wildType];
  let parents = [wildType];

  for (let roundNumber = 1; roundNumber <= input.totalRounds; roundNumber += 1) {
    const candidates = Array.from({ length: input.librarySize }, (_, libraryRank) => {
      const parent = parents[Math.floor(rng.next() * parents.length) % parents.length] ?? wildType;
      const familyBias =
        parent.familyId !== 'wild-type' && rng.next() < 0.62
          ? FAMILY_ARCHETYPES.find((family) => family.id === parent.familyId) ?? rng.pick(FAMILY_ARCHETYPES)
          : rng.pick(FAMILY_ARCHETYPES);
      return buildCandidate(
        rng,
        input,
        roundNumber,
        libraryRank,
        parent,
        familyBias,
        wildType,
        wildTypeComposite,
        weights,
      );
    });

    const deduped = Array.from(new Map(candidates.map((candidate) => [candidate.mutationString, candidate])).values());
    while (deduped.length < input.librarySize) {
      const parent = parents[Math.floor(rng.next() * parents.length) % parents.length] ?? wildType;
      const family = rng.pick(FAMILY_ARCHETYPES);
      const candidate = buildCandidate(
        rng,
        input,
        roundNumber,
        deduped.length,
        parent,
        family,
        wildType,
        wildTypeComposite,
        weights,
      );
      if (!deduped.some((existing) => existing.mutationString === candidate.mutationString)) {
        deduped.push(candidate);
      }
    }

    const { selected, rejected, stabilityFloor } = selectSurvivors(deduped, input.survivorCount, input.selectionStringency);
    annotateSelectionReasons(selected, rejected, stabilityFloor);
    selected.forEach((variant) => {
      variant.selectionDensity = deriveFamilySelectionDensity(selected, variant.familyLabel);
    });
    rejected.forEach((variant) => {
      variant.selectionDensity = deriveFamilySelectionDensity(selected, variant.familyLabel);
    });

    const averageScore = round(average(deduped.map((variant) => variant.score.composite)), 2);
    const persistentMutations = mutationPersistence(selected, 2).slice(0, 5);
    const provisionalRound: RoundResult = {
      roundNumber,
      librarySize: deduped.length,
      selectedSurvivors: selected,
      rejectedVariants: rejected,
      averageScore,
      diversitySummary: summarizeDiversity(selected),
      convergenceSummary: {
        state: 'productive-convergence',
        score: 0,
        improvementSlope: 0,
        familyConcentration: 0,
        persistenceSignals: [],
        narrative: '',
      },
      bestLeadDelta: round(selected[0]?.score.deltaFromWildType ?? 0, 2),
      scoreDeltaVsPrevious: round((selected[0]?.score.composite ?? 0) - (rounds[rounds.length - 1]?.selectedSurvivors[0]?.score.composite ?? wildType.score.composite), 2),
      leadVariantId: selected[0]?.id ?? 'wt',
      persistentMutations,
      variantLibrary: {
        roundNumber,
        candidates: deduped,
        selectedSurvivors: selected,
        rejectedVariants: rejected,
      },
    };
    rounds.push(provisionalRound);
    provisionalRound.convergenceSummary = summarizeConvergence(rounds, selected);

    [...deduped].forEach((variant) => {
      variantIndex.set(variant.id, variant);
      allVariants.push(variant);
    });
    parents = selected.length ? selected : [wildType];
  }

  const leadVariant = [...allVariants]
    .filter((variant) => variant.status === 'selected' || variant.status === 'wild-type')
    .sort((left, right) => {
      if (right.score.composite !== left.score.composite) return right.score.composite - left.score.composite;
      return right.round - left.round;
    })[0] ?? wildType;

  const descendants = new Map<string, number>();
  allVariants.forEach((variant) => {
    if (!variant.parentId) return;
    descendants.set(variant.parentId, (descendants.get(variant.parentId) ?? 0) + 1);
  });
  const currentRoundResult = rounds[rounds.length - 1];
  currentRoundResult.selectedSurvivors.forEach((variant) => {
    if (variant.id === leadVariant.id) variant.branchState = 'lead';
  });
  const currentRoundSurvivorIds = new Set(currentRoundResult.selectedSurvivors.map((variant) => variant.id));
  allVariants.forEach((variant) => {
    if (variant.id === leadVariant.id) variant.branchState = 'lead';
    else if (currentRoundSurvivorIds.has(variant.id)) variant.branchState = 'persisting';
    else if (variant.status === 'selected' && (descendants.get(variant.id) ?? 0) === 0) variant.branchState = 'dead';
    else if (variant.status === 'selected') variant.branchState = 'active';
    else if (variant.status === 'rejected') variant.branchState = 'rejected';
  });

  const diversitySummary = currentRoundResult.diversitySummary;
  const convergenceSignal = currentRoundResult.convergenceSummary;
  const recommendationBundle = recommendationFromCampaign(
    leadVariant,
    diversitySummary,
    convergenceSignal,
    currentRoundResult,
  );

  const campaign: ProteinEvolutionCampaign = {
    id: `proevol-${seed}`,
    name: input.campaignName,
    targetProtein: input.targetProtein,
    enzymeName: input.enzymeName,
    wildTypeLabel: input.wildTypeLabel,
    startingSequence: input.startingSequence,
    optimizationObjective: input.optimizationObjective,
    assayCondition: input.assayCondition,
    selectionPressure: input.selectionPressure,
    hostSystem: input.hostSystem,
    screeningSystem: input.screeningSystem,
    provenance: input.provenance,
    currentRound: input.totalRounds,
    totalRounds: input.totalRounds,
    librarySize: input.librarySize,
    survivorCount: input.survivorCount,
    selectionStringency: input.selectionStringency,
    scoreWeights: weights,
    wildType,
    leadVariant,
    leadNarrative:
      `${leadVariant.name} leads because it combines a ${leadVariant.score.composite.toFixed(1)} composite score with `
      + `${leadVariant.predictedActivity.toFixed(1)} predicted activity, `
      + `${leadVariant.predictedStability.toFixed(1)} stability, and `
      + `${leadVariant.mutationBurden} accumulated substitution${leadVariant.mutationBurden === 1 ? '' : 's'} `
      + `without losing campaign viability.`,
    rounds,
    currentRoundResult,
    diversitySummary,
    convergenceSignal,
    persistentMutations: currentRoundResult.persistentMutations,
    selectionDecision: recommendationBundle.selectionDecision,
    nextRoundRecommendation: recommendationBundle.nextRoundRecommendation,
    lineage: buildLineage(allVariants, leadVariant.id, currentRoundSurvivorIds, descendants),
    variantIndex: Object.fromEntries([...variantIndex.entries()]),
    landscape: { points: [], edges: [], hotspots: [] },
  };
  campaign.landscape = buildLandscapeMap(campaign);
  return campaign;
}
