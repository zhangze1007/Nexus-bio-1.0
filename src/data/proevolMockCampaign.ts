import { ENZYME_STRUCTURES, RATE_LIMITING_ENZYME } from './mockCatalystDesigner';
import type { WorkbenchAnalyzeArtifact, WorkbenchProjectBrief } from '../store/workbenchTypes';
import type {
  CatalystWorkbenchPayload,
  CETHXWorkbenchPayload,
  FBAWorkbenchPayload,
} from '../store/workbenchPayloads';
import type {
  CampaignProvenance,
  ProEvolCampaignInput,
  SelectionObjective,
} from '../services/ProEvolCampaignEngine';

interface BuildProEvolCampaignInputOptions {
  project?: WorkbenchProjectBrief | null;
  analyzeArtifact?: WorkbenchAnalyzeArtifact | null;
  catalyst?: CatalystWorkbenchPayload | null;
  fba?: FBAWorkbenchPayload | null;
  cethx?: CETHXWorkbenchPayload | null;
  totalRounds: number;
  librarySize: number;
  survivorCount: number;
  selectionStringency: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function deriveProvenance(
  project?: WorkbenchProjectBrief | null,
  analyzeArtifact?: WorkbenchAnalyzeArtifact | null,
  catalyst?: CatalystWorkbenchPayload | null,
) {
  if (analyzeArtifact && analyzeArtifact.evidenceTraceIds.length > 0 && !project?.isDemo) {
    return 'literature-backed' as CampaignProvenance;
  }
  if (analyzeArtifact || catalyst) {
    return 'inferred' as CampaignProvenance;
  }
  return 'simulated' as CampaignProvenance;
}

function deriveSelectionObjective(targetProduct: string, targetProtein: string): SelectionObjective {
  return {
    label: 'Directed evolution objective',
    summary: `Improve ${targetProtein} as a pathway-facing catalyst for ${targetProduct} while preserving stability, expression, and manageable mutation burden.`,
    primaryMetric: 'Composite campaign score',
    balancingMetrics: [
      'Predicted activity',
      'Predicted stability',
      'Predicted expression',
      'Predicted specificity',
      'Mutation burden risk',
    ],
  };
}

function buildSitePool(sequenceLength: number) {
  const fractions = [0.07, 0.11, 0.16, 0.22, 0.31, 0.4, 0.49, 0.58, 0.69, 0.81];
  const positions = fractions.map((fraction) => clamp(Math.round(sequenceLength * fraction), 6, Math.max(sequenceLength - 6, 6)));
  return Array.from(new Set(positions));
}

function pickEnzyme(catalyst?: CatalystWorkbenchPayload | null, analyzeArtifact?: WorkbenchAnalyzeArtifact | null) {
  if (catalyst?.selectedEnzymeId) {
    return ENZYME_STRUCTURES.find((enzyme) => enzyme.id === catalyst.selectedEnzymeId) ?? RATE_LIMITING_ENZYME;
  }

  const analyzeHint = analyzeArtifact?.enzymeCandidates[0]?.label?.toLowerCase() ?? '';
  const match = ENZYME_STRUCTURES.find((enzyme) => {
    const searchable = `${enzyme.id} ${enzyme.name} ${enzyme.substrate} ${enzyme.product}`.toLowerCase();
    return analyzeHint && searchable.includes(analyzeHint);
  });
  return match ?? RATE_LIMITING_ENZYME;
}

function deriveAssayCondition(
  targetProduct: string,
  fba?: FBAWorkbenchPayload | null,
  cethx?: CETHXWorkbenchPayload | null,
) {
  const objective = fba?.objective === 'product' ? 'product-coupled output screen' : 'growth-coupled enrichment';
  const thermo = cethx?.result.limitingStep ? ` with thermodynamic attention on ${cethx.result.limitingStep}` : '';
  return `${targetProduct} ${objective}${thermo}`;
}

function deriveSelectionPressure(
  fba?: FBAWorkbenchPayload | null,
  cethx?: CETHXWorkbenchPayload | null,
) {
  const carbon = fba?.result.carbonEfficiency;
  const thermodynamicStress = cethx?.result.efficiency != null ? 100 - cethx.result.efficiency : 28;
  if ((carbon ?? 0) < 45 || thermodynamicStress > 35) {
    return 'High pathway pressure with simultaneous activity and stability selection';
  }
  if ((carbon ?? 0) > 65) {
    return 'Moderate pressure favoring activity gain while preserving expression headroom';
  }
  return 'Balanced selection pressure across activity, stability, and developability';
}

function deriveHostSystem(targetProduct: string, project?: WorkbenchProjectBrief | null) {
  const text = `${project?.title ?? ''} ${project?.summary ?? ''} ${targetProduct}`.toLowerCase();
  if (/yeast|saccharomyces|artemisinin/.test(text)) return 'Saccharomyces cerevisiae microscale library screen';
  if (/e\.?coli|ecoli/.test(text)) return 'Escherichia coli plate-based variant screen';
  return 'Heterologous microbial expression screen';
}

function deriveScreeningSystem(targetProduct: string, catalyst?: CatalystWorkbenchPayload | null) {
  if (catalyst?.result.isViable === false) {
    return `${targetProduct} burden-aware plate assay with stability gate`;
  }
  return `${targetProduct} 96-well activity assay with expression-normalized ranking`;
}

export function buildProEvolCampaignInput({
  project,
  analyzeArtifact,
  catalyst,
  fba,
  cethx,
  totalRounds,
  librarySize,
  survivorCount,
  selectionStringency,
}: BuildProEvolCampaignInputOptions): ProEvolCampaignInput {
  const enzyme = pickEnzyme(catalyst, analyzeArtifact);
  const targetProduct = analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product';
  const targetProtein = catalyst?.selectedEnzymeName || enzyme.name;
  const provenance = deriveProvenance(project, analyzeArtifact, catalyst);
  const sequence = enzyme.sequence || RATE_LIMITING_ENZYME.sequence;

  const pathwayPressure = clamp(
    round(
      0.34
      + ((100 - (fba?.result.carbonEfficiency ?? 58)) / 100) * 0.34
      + (analyzeArtifact?.bottleneckAssumptions.length ?? 1) * 0.05,
      3,
    ),
    0.18,
    0.95,
  );
  const catalystConfidence = clamp(
    round(
      0.28
      + (catalyst?.result.overallBinding ?? 0.56) * 0.46
      + ((catalyst?.result.isViable ?? true) ? 0.08 : -0.1),
      3,
    ),
    0.15,
    0.96,
  );
  const thermodynamicStress = clamp(
    round(
      0.18
      + ((100 - (cethx?.result.efficiency ?? 72)) / 100) * 0.6
      + Math.max(0, -(cethx?.result.gibbsFreeEnergy ?? -18)) / 220,
      3,
    ),
    0.08,
    0.95,
  );
  const expressionHeadroom = clamp(
    round(
      0.58
      + (catalyst?.result.bestCAI ?? 0.62) * 0.18
      - (catalyst?.result.growthPenalty ?? 8) / 100 * 0.5,
      3,
    ),
    0.12,
    0.94,
  );
  const literatureSupport = clamp(
    round(
      0.2
      + Math.min((analyzeArtifact?.evidenceTraceIds.length ?? 0) / 8, 0.48)
      + (!project?.isDemo && analyzeArtifact ? 0.12 : 0),
      3,
    ),
    0.18,
    0.92,
  );

  const seed = hashString([
    targetProduct,
    targetProtein,
    totalRounds,
    librarySize,
    survivorCount,
    selectionStringency.toFixed(2),
  ].join('|'));

  return {
    campaignName: `${targetProduct} · ${targetProtein} evolution campaign`,
    targetProtein,
    enzymeName: targetProtein,
    wildTypeLabel: `${enzyme.id.toUpperCase()}-WT`,
    startingSequence: sequence,
    optimizationObjective: deriveSelectionObjective(targetProduct, targetProtein),
    assayCondition: deriveAssayCondition(targetProduct, fba, cethx),
    selectionPressure: deriveSelectionPressure(fba, cethx),
    hostSystem: deriveHostSystem(targetProduct, project),
    screeningSystem: deriveScreeningSystem(targetProduct, catalyst),
    provenance,
    totalRounds,
    librarySize,
    survivorCount,
    selectionStringency,
    sitePool: buildSitePool(sequence.length),
    upstreamSignals: {
      pathwayPressure,
      catalystConfidence,
      thermodynamicStress,
      expressionHeadroom,
      literatureSupport,
    },
    scoreWeights: {
      activity: 0.4,
      stability: 0.24,
      expression: 0.13,
      specificity: 0.11,
      burden: 3.8,
      risk: 4.4,
    },
    seed,
  };
}
