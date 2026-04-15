/**
 * proevol.campaign.v1 — normalized JSON-friendly contract for a directed-evolution campaign.
 *
 * Shape rules:
 *   - Every count is a non-negative integer (sequencing read count per replicate per round).
 *   - All variants reference rounds and parent variants by id, never by index.
 *   - `validity` and `provenance` are the honesty boundary the UI relies on to
 *     gate "real" claims vs simulated/decision-support output.
 *   - This is the single contract the analysis engine and UI consume. The legacy
 *     `ProteinEvolutionCampaign` engine output is mapped into this shape via
 *     `campaignToArtifact()`; future CSV/h5ad ingestion produces the same shape.
 */

export const PROEVOL_ARTIFACT_VERSION = 'proevol.campaign.v1' as const;

export type ProEvolValidity = 'real' | 'partial' | 'demo';

export type ProEvolProvenanceKind =
  | 'simulated'
  | 'inferred'
  | 'literature-backed'
  | 'user-supplied';

export interface ProEvolProvenance {
  kind: ProEvolProvenanceKind;
  validity: ProEvolValidity;
  source: string;
  replicateCount: number;
  sequencingDepthPerSample?: number;
  statisticalNotes: string[];
  generatedAt: number;
  notes?: string;
}

export interface ProEvolMutation {
  position: number;
  from: string;
  to: string;
}

export interface ProEvolReplicateCounts {
  replicateId: string;
  reads: number;
}

export interface ProEvolVariantRoundObservation {
  roundId: string;
  /** Per-replicate raw read counts. May contain a single replicate when only one screen exists. */
  replicates: ProEvolReplicateCounts[];
  /** Pre-computed total reads across replicates (sum of `replicates[].reads`). Cached for convenience. */
  totalReads: number;
}

export interface ProEvolPhenotype {
  predictedActivity?: number;
  predictedStability?: number;
  predictedExpression?: number;
  predictedSpecificity?: number;
  measuredActivity?: number;
  measuredStability?: number;
  confidence?: number;
}

export interface ProEvolVariant {
  id: string;
  label: string;
  parentId: string | null;
  /** Family / lineage label used to color Muller / fish plots. */
  familyId: string;
  familyLabel: string;
  mutations: ProEvolMutation[];
  /** Pre-rendered "F123Y / S88A" string for tables. */
  mutationString: string;
  mutationBurden: number;
  /** Per-round read observations; missing rounds = variant absent (count 0). */
  observations: ProEvolVariantRoundObservation[];
  phenotype: ProEvolPhenotype;
  /** Optional engine-provided composite. Surfaced separately from frequency-derived selection. */
  compositeScore?: number;
  /** Provenance-aware selection status reported by the campaign source. */
  selectionStatus: 'selected' | 'rejected' | 'wild-type' | 'unknown';
  riskFlags: string[];
}

export interface ProEvolRound {
  id: string;
  number: number;
  label: string;
  selectionPressure: string;
  /** Number of survivors carried forward, as reported by the campaign source. */
  reportedSurvivorCount: number;
  /** Sample-level totals so frequencies stay reproducible without re-summing observations. */
  totalReadsPerReplicate: ProEvolReplicateCounts[];
}

export interface ProEvolCampaignMeta {
  id: string;
  name: string;
  targetProtein: string;
  targetProduct: string;
  wildTypeId: string;
  wildTypeLabel: string;
  startingSequence: string;
  hostSystem: string;
  screeningSystem: string;
  assayCondition: string;
  selectionPressure: string;
  objective: string;
  totalRounds: number;
  librarySizePerRound: number;
  selectionStringency: number;
}

export interface ProEvolArtifact {
  version: typeof PROEVOL_ARTIFACT_VERSION;
  meta: ProEvolCampaignMeta;
  rounds: ProEvolRound[];
  variants: ProEvolVariant[];
  provenance: ProEvolProvenance;
}

/** Lightweight runtime guard. Does not validate every nested invariant — it catches the common shape mistakes. */
export function isProEvolArtifact(value: unknown): value is ProEvolArtifact {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProEvolArtifact>;
  return (
    candidate.version === PROEVOL_ARTIFACT_VERSION
    && Array.isArray(candidate.rounds)
    && Array.isArray(candidate.variants)
    && candidate.meta != null
    && candidate.provenance != null
  );
}

/** Best-known validity for a given provenance kind when none is explicitly provided. */
export function defaultValidityForProvenance(kind: ProEvolProvenanceKind): ProEvolValidity {
  if (kind === 'user-supplied') return 'real';
  if (kind === 'literature-backed') return 'partial';
  if (kind === 'inferred') return 'partial';
  return 'demo';
}

/**
 * Adapter: take the existing engine output and synthesize a normalized artifact with
 * deterministic per-replicate read counts. Counts are derived from composite scores so
 * that downstream frequency math (Shannon, enrichment, selection coefficient) is
 * stable and reproducible — they are *not* claims about real sequencing depth.
 */
export interface CampaignToArtifactInput {
  campaign: import('../services/ProEvolCampaignEngine').ProteinEvolutionCampaign;
  targetProduct: string;
  replicateCount?: number;
  sequencingDepthPerSample?: number;
}

export function campaignToArtifact({
  campaign,
  targetProduct,
  replicateCount = 3,
  sequencingDepthPerSample = 50_000,
}: CampaignToArtifactInput): ProEvolArtifact {
  const replicates = Array.from({ length: replicateCount }, (_, index) => `rep${index + 1}`);
  const wildTypeBaselineComposite = Math.max(campaign.wildType.score.composite, 1);

  // For each round, build a per-variant per-replicate read distribution proportional
  // to score^2 (sharper signal) so that selection coefficient and enrichment are
  // visibly different across rounds.
  const variantsByRound = new Map<number, import('../services/ProEvolCampaignEngine').VariantCandidate[]>();
  campaign.rounds.forEach((round) => {
    variantsByRound.set(round.roundNumber, [campaign.wildType, ...round.variantLibrary.candidates]);
  });

  const replicateNoise = (variantId: string, roundNumber: number, replicateIndex: number) => {
    let hash = 2166136261;
    const key = `${variantId}|${roundNumber}|${replicateIndex}`;
    for (let i = 0; i < key.length; i += 1) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const normalized = ((hash >>> 0) % 1000) / 1000;
    return 0.85 + normalized * 0.3;
  };

  // Compute round-wise replicate totals so per-variant frequencies sum correctly.
  const roundReplicateTotals = new Map<number, Map<string, number>>();

  // Build per-variant observations.
  const variantObservations = new Map<string, ProEvolVariantRoundObservation[]>();

  campaign.rounds.forEach((round) => {
    const candidates = variantsByRound.get(round.roundNumber) ?? [];
    const totalsByReplicate = new Map<string, number>();
    replicates.forEach((replicateId) => totalsByReplicate.set(replicateId, 0));

    const intermediate = candidates.map((candidate) => {
      const baseShare = Math.pow(Math.max(candidate.score.composite, 0.5), 2);
      return { candidate, baseShare };
    });

    const totalShare = intermediate.reduce((sum, entry) => sum + entry.baseShare, 0) || 1;

    intermediate.forEach(({ candidate, baseShare }) => {
      const observation: ProEvolVariantRoundObservation = {
        roundId: `r${round.roundNumber}`,
        replicates: replicates.map((replicateId, replicateIndex) => {
          const expected =
            (baseShare / totalShare) * sequencingDepthPerSample
            * replicateNoise(candidate.id, round.roundNumber, replicateIndex);
          const reads = Math.max(0, Math.round(expected));
          totalsByReplicate.set(replicateId, (totalsByReplicate.get(replicateId) ?? 0) + reads);
          return { replicateId, reads };
        }),
        totalReads: 0,
      };
      observation.totalReads = observation.replicates.reduce((sum, replicate) => sum + replicate.reads, 0);
      const existing = variantObservations.get(candidate.id) ?? [];
      existing.push(observation);
      variantObservations.set(candidate.id, existing);
    });

    roundReplicateTotals.set(round.roundNumber, totalsByReplicate);
  });

  const allCandidates = new Map<string, import('../services/ProEvolCampaignEngine').VariantCandidate>();
  allCandidates.set(campaign.wildType.id, campaign.wildType);
  campaign.rounds.forEach((round) => {
    round.variantLibrary.candidates.forEach((candidate) => {
      allCandidates.set(candidate.id, candidate);
    });
  });

  const variants: ProEvolVariant[] = [...allCandidates.values()].map((candidate) => ({
    id: candidate.id,
    label: candidate.name,
    parentId: candidate.parentId,
    familyId: candidate.familyId,
    familyLabel: candidate.familyLabel,
    mutations: candidate.mutations.map((mutation) => ({
      position: mutation.position,
      from: mutation.from,
      to: mutation.to,
    })),
    mutationString: candidate.mutationString,
    mutationBurden: candidate.mutationBurden,
    observations: variantObservations.get(candidate.id) ?? [],
    phenotype: {
      predictedActivity: candidate.predictedActivity,
      predictedStability: candidate.predictedStability,
      predictedExpression: candidate.predictedExpression,
      predictedSpecificity: candidate.predictedSpecificity,
      confidence: candidate.confidence,
    },
    compositeScore: candidate.score.composite,
    selectionStatus:
      candidate.status === 'wild-type'
        ? 'wild-type'
        : candidate.status === 'selected'
          ? 'selected'
          : candidate.status === 'rejected'
            ? 'rejected'
            : 'unknown',
    riskFlags: candidate.riskFlags,
  }));

  const rounds: ProEvolRound[] = campaign.rounds.map((round) => {
    const totals = roundReplicateTotals.get(round.roundNumber) ?? new Map<string, number>();
    return {
      id: `r${round.roundNumber}`,
      number: round.roundNumber,
      label: `Round ${round.roundNumber}`,
      selectionPressure: campaign.selectionPressure,
      reportedSurvivorCount: round.selectedSurvivors.length,
      totalReadsPerReplicate: replicates.map((replicateId) => ({
        replicateId,
        reads: totals.get(replicateId) ?? 0,
      })),
    };
  });

  const provenanceKind: ProEvolProvenanceKind = campaign.provenance;
  const validity = defaultValidityForProvenance(provenanceKind);

  return {
    version: PROEVOL_ARTIFACT_VERSION,
    meta: {
      id: campaign.id,
      name: campaign.name,
      targetProtein: campaign.targetProtein,
      targetProduct,
      wildTypeId: campaign.wildType.id,
      wildTypeLabel: campaign.wildTypeLabel,
      startingSequence: campaign.startingSequence,
      hostSystem: campaign.hostSystem,
      screeningSystem: campaign.screeningSystem,
      assayCondition: campaign.assayCondition,
      selectionPressure: campaign.selectionPressure,
      objective: campaign.optimizationObjective.summary,
      totalRounds: campaign.totalRounds,
      librarySizePerRound: campaign.librarySize,
      selectionStringency: campaign.selectionStringency,
    },
    rounds,
    variants,
    provenance: {
      kind: provenanceKind,
      validity,
      source:
        provenanceKind === 'simulated'
          ? 'Nexus-Bio internal campaign engine (deterministic seed)'
          : provenanceKind === 'inferred'
            ? 'Inferred from upstream Nexus-Bio workbench context'
            : provenanceKind === 'literature-backed'
              ? 'Inferred with literature-backed evidence trace'
              : 'User-supplied campaign artifact',
      replicateCount,
      sequencingDepthPerSample,
      statisticalNotes:
        validity === 'real'
          ? [
            'Frequencies derived from supplied per-replicate read counts.',
            'Confidence intervals computed via per-replicate variance, two-sided 95%.',
          ]
          : [
            'Read counts are deterministically synthesized from engine composite scores.',
            'Confidence intervals reflect synthesized replicate variance, not wet-lab measurement.',
          ],
      generatedAt: Date.now(),
      notes:
        validity === 'demo'
          ? 'No experimental upload detected. Counts and statistical bands reflect the campaign engine model only.'
          : undefined,
    },
  };
}
