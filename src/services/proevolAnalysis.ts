/**
 * proevolAnalysis — frequency-first analysis over a `proevol.campaign.v1` artifact.
 *
 * All inputs are normalized read counts on the artifact. The functions here are pure
 * and deterministic so the UI can memoize them and reproduce numerical outputs in
 * exports. They are the *real* statistical layer that the page renders against —
 * the legacy `ProEvolCampaignEngine` heuristic outputs (composite score, lineage
 * narrative, recommendation prose) are still used for narrative cards but no longer
 * drive scientific charts.
 */

import type {
  ProEvolArtifact,
  ProEvolRound,
  ProEvolVariant,
  ProEvolVariantRoundObservation,
} from '../domain/proevolArtifact';

const PSEUDOCOUNT = 1;

// ── Numerics ────────────────────────────────────────────────────────────────

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdev(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squared = values.reduce((sum, value) => sum + (value - avg) ** 2, 0);
  return Math.sqrt(squared / (values.length - 1));
}

/** Two-sided 95% interval using the t-distribution critical value for small n.
 * Approximation table is sufficient for replicate counts in directed-evolution range (2–10). */
const T_CRIT_95: Record<number, number> = {
  1: 12.706,
  2: 4.303,
  3: 3.182,
  4: 2.776,
  5: 2.571,
  6: 2.447,
  7: 2.365,
  8: 2.306,
  9: 2.262,
};

function tCrit95(degreesOfFreedom: number) {
  if (degreesOfFreedom <= 0) return 0;
  return T_CRIT_95[degreesOfFreedom] ?? 1.96;
}

export interface ConfidenceInterval {
  mean: number;
  lower: number;
  upper: number;
  /** Standard error of the mean across replicates. */
  sem: number;
  replicateCount: number;
}

export function ciFromReplicates(values: number[]): ConfidenceInterval {
  const n = values.length;
  const avg = mean(values);
  if (n < 2) {
    return { mean: avg, lower: avg, upper: avg, sem: 0, replicateCount: n };
  }
  const sd = stdev(values);
  const sem = sd / Math.sqrt(n);
  const tCritical = tCrit95(n - 1);
  return {
    mean: avg,
    lower: Math.max(0, avg - tCritical * sem),
    upper: avg + tCritical * sem,
    sem,
    replicateCount: n,
  };
}

// ── Frequency tables ────────────────────────────────────────────────────────

export interface VariantRoundFrequency {
  variantId: string;
  roundId: string;
  /** Per-replicate frequency = (reads + pseudocount) / (totalReadsForReplicate + pseudocount * variantCountForRound). */
  perReplicate: number[];
  /** CI summary across replicates. */
  frequency: ConfidenceInterval;
  totalReads: number;
}

interface FrequencyTableContext {
  artifact: ProEvolArtifact;
  /** Variant ids active in each round (used for pseudocount denominator). */
  variantsByRound: Map<string, string[]>;
}

function buildFrequencyContext(artifact: ProEvolArtifact): FrequencyTableContext {
  const variantsByRound = new Map<string, string[]>();
  artifact.rounds.forEach((round) => variantsByRound.set(round.id, []));
  artifact.variants.forEach((variant) => {
    variant.observations.forEach((observation) => {
      const list = variantsByRound.get(observation.roundId);
      if (list) list.push(variant.id);
    });
  });
  return { artifact, variantsByRound };
}

function findObservation(variant: ProEvolVariant, roundId: string): ProEvolVariantRoundObservation | undefined {
  return variant.observations.find((observation) => observation.roundId === roundId);
}

function replicateTotals(round: ProEvolRound) {
  const map = new Map<string, number>();
  round.totalReadsPerReplicate.forEach((entry) => map.set(entry.replicateId, entry.reads));
  return map;
}

function variantRoundFrequency(
  context: FrequencyTableContext,
  variant: ProEvolVariant,
  round: ProEvolRound,
): VariantRoundFrequency {
  const observation = findObservation(variant, round.id);
  const totals = replicateTotals(round);
  const variantCountForRound = (context.variantsByRound.get(round.id) ?? []).length || 1;
  const perReplicate: number[] = [];

  round.totalReadsPerReplicate.forEach((entry) => {
    const reads = observation?.replicates.find((replicate) => replicate.replicateId === entry.replicateId)?.reads ?? 0;
    const totalForReplicate = totals.get(entry.replicateId) ?? 0;
    const numerator = reads + PSEUDOCOUNT;
    const denominator = totalForReplicate + PSEUDOCOUNT * variantCountForRound;
    perReplicate.push(denominator > 0 ? numerator / denominator : 0);
  });

  return {
    variantId: variant.id,
    roundId: round.id,
    perReplicate,
    frequency: ciFromReplicates(perReplicate),
    totalReads: observation?.totalReads ?? 0,
  };
}

export interface VariantTrajectoryPoint {
  roundId: string;
  roundNumber: number;
  frequency: number;
  lower: number;
  upper: number;
  totalReads: number;
}

export interface VariantTrajectory {
  variantId: string;
  label: string;
  familyId: string;
  familyLabel: string;
  mutationString: string;
  points: VariantTrajectoryPoint[];
  /** Peak frequency across all rounds, used for top-K ranking. */
  peakFrequency: number;
}

export function variantTrajectories(artifact: ProEvolArtifact): VariantTrajectory[] {
  const context = buildFrequencyContext(artifact);
  return artifact.variants.map((variant) => {
    const points: VariantTrajectoryPoint[] = artifact.rounds.map((round) => {
      const frequency = variantRoundFrequency(context, variant, round);
      return {
        roundId: round.id,
        roundNumber: round.number,
        frequency: frequency.frequency.mean,
        lower: frequency.frequency.lower,
        upper: frequency.frequency.upper,
        totalReads: frequency.totalReads,
      };
    });
    const peak = points.reduce((max, point) => (point.frequency > max ? point.frequency : max), 0);
    return {
      variantId: variant.id,
      label: variant.label,
      familyId: variant.familyId,
      familyLabel: variant.familyLabel,
      mutationString: variant.mutationString,
      points,
      peakFrequency: peak,
    };
  });
}

export function topKVariantTrajectories(artifact: ProEvolArtifact, k = 6): VariantTrajectory[] {
  const trajectories = variantTrajectories(artifact);
  return [...trajectories]
    .filter((trajectory) => trajectory.variantId !== artifact.meta.wildTypeId)
    .sort((left, right) => right.peakFrequency - left.peakFrequency)
    .slice(0, k);
}

// ── Diversity ───────────────────────────────────────────────────────────────

export interface DiversityRoundPoint {
  roundId: string;
  roundNumber: number;
  /** Shannon entropy in bits across all variants present in the round. */
  shannonBits: ConfidenceInterval;
  /** Top-1 variant frequency (winner share). */
  topShare: ConfidenceInterval;
  /** Effective number of variants = 2^Shannon. */
  effectiveVariantCount: number;
  /** Number of distinct variants with > 0 reads. */
  observedVariantCount: number;
}

function shannonForReplicate(frequencies: number[]) {
  return frequencies.reduce((sum, frequency) => {
    if (frequency <= 0) return sum;
    return sum - frequency * Math.log2(frequency);
  }, 0);
}

export function diversityCurve(artifact: ProEvolArtifact): DiversityRoundPoint[] {
  const context = buildFrequencyContext(artifact);
  return artifact.rounds.map((round) => {
    const replicateIds = round.totalReadsPerReplicate.map((entry) => entry.replicateId);
    const frequenciesPerReplicate: number[][] = replicateIds.map(() => []);
    let observed = 0;
    artifact.variants.forEach((variant) => {
      const frequency = variantRoundFrequency(context, variant, round);
      const observation = findObservation(variant, round.id);
      if ((observation?.totalReads ?? 0) > 0) observed += 1;
      frequency.perReplicate.forEach((value, index) => {
        frequenciesPerReplicate[index].push(value);
      });
    });

    const shannonPerReplicate = frequenciesPerReplicate.map((freqs) => {
      const total = freqs.reduce((sum, frequency) => sum + frequency, 0) || 1;
      const normalized = freqs.map((frequency) => frequency / total);
      return shannonForReplicate(normalized);
    });
    const topPerReplicate = frequenciesPerReplicate.map((freqs) => {
      const total = freqs.reduce((sum, frequency) => sum + frequency, 0) || 1;
      return Math.max(...freqs) / total;
    });

    const shannonCi = ciFromReplicates(shannonPerReplicate);
    return {
      roundId: round.id,
      roundNumber: round.number,
      shannonBits: shannonCi,
      topShare: ciFromReplicates(topPerReplicate),
      effectiveVariantCount: 2 ** shannonCi.mean,
      observedVariantCount: observed,
    };
  });
}

// ── Family / Muller-style stacked frequencies ───────────────────────────────

export interface FamilyShareRoundPoint {
  roundId: string;
  roundNumber: number;
  /** Map family id → mean frequency across replicates. */
  shareByFamily: Record<string, number>;
}

export function familyShareCurve(artifact: ProEvolArtifact): {
  families: Array<{ id: string; label: string }>;
  rounds: FamilyShareRoundPoint[];
} {
  const familyIndex = new Map<string, { id: string; label: string }>();
  artifact.variants.forEach((variant) => {
    if (!familyIndex.has(variant.familyId)) {
      familyIndex.set(variant.familyId, { id: variant.familyId, label: variant.familyLabel });
    }
  });

  const context = buildFrequencyContext(artifact);
  const rounds = artifact.rounds.map((round) => {
    const familyTotals = new Map<string, number[]>();
    artifact.variants.forEach((variant) => {
      const frequency = variantRoundFrequency(context, variant, round);
      const list = familyTotals.get(variant.familyId) ?? [];
      frequency.perReplicate.forEach((value, index) => {
        list[index] = (list[index] ?? 0) + value;
      });
      familyTotals.set(variant.familyId, list);
    });

    const shareByFamily: Record<string, number> = {};
    let totalAcrossFamilies = 0;
    familyTotals.forEach((perReplicateSums, familyId) => {
      const avg = mean(perReplicateSums);
      shareByFamily[familyId] = avg;
      totalAcrossFamilies += avg;
    });
    if (totalAcrossFamilies > 0) {
      Object.keys(shareByFamily).forEach((familyId) => {
        shareByFamily[familyId] = shareByFamily[familyId] / totalAcrossFamilies;
      });
    }
    return {
      roundId: round.id,
      roundNumber: round.number,
      shareByFamily,
    };
  });

  return { families: [...familyIndex.values()], rounds };
}

// ── Enrichment & selection coefficient ──────────────────────────────────────

export interface VariantEnrichmentEntry {
  variantId: string;
  label: string;
  familyId: string;
  familyLabel: string;
  mutationString: string;
  mutationBurden: number;
  /** log2(freqRound / freqWildTypeRound). Positive = enriched relative to WT. */
  log2EnrichmentVsWildType: number;
  /** log2(freqLastRound / freqFirstRound). Selection trajectory across the campaign. */
  log2EnrichmentAcrossRounds: number;
  /** Per-round selection coefficient s ≈ ln(freq_t / freq_{t-1}). Mean across consecutive rounds. */
  meanSelectionCoefficient: number;
  finalFrequency: number;
  finalFrequencyCi: { lower: number; upper: number };
  totalReadsLastRound: number;
}

function safeLog2(value: number) {
  if (value <= 0) return -10;
  return Math.log2(value);
}

export function variantEnrichmentTable(artifact: ProEvolArtifact): VariantEnrichmentEntry[] {
  const context = buildFrequencyContext(artifact);
  if (artifact.rounds.length === 0) return [];
  const firstRound = artifact.rounds[0];
  const lastRound = artifact.rounds[artifact.rounds.length - 1];
  const wildType = artifact.variants.find((variant) => variant.id === artifact.meta.wildTypeId);

  return artifact.variants
    .filter((variant) => variant.id !== artifact.meta.wildTypeId)
    .map((variant) => {
      const firstFrequency = variantRoundFrequency(context, variant, firstRound).frequency.mean;
      const lastFrequencyData = variantRoundFrequency(context, variant, lastRound);
      const lastFrequency = lastFrequencyData.frequency.mean;

      const wildTypeLastFrequency = wildType
        ? variantRoundFrequency(context, wildType, lastRound).frequency.mean
        : 0;

      const selectionCoefficients: number[] = [];
      for (let index = 1; index < artifact.rounds.length; index += 1) {
        const previous = variantRoundFrequency(context, variant, artifact.rounds[index - 1]).frequency.mean;
        const current = variantRoundFrequency(context, variant, artifact.rounds[index]).frequency.mean;
        if (previous > 0 && current > 0) {
          selectionCoefficients.push(Math.log(current / previous));
        }
      }

      return {
        variantId: variant.id,
        label: variant.label,
        familyId: variant.familyId,
        familyLabel: variant.familyLabel,
        mutationString: variant.mutationString,
        mutationBurden: variant.mutationBurden,
        log2EnrichmentVsWildType:
          wildTypeLastFrequency > 0
            ? safeLog2(lastFrequency / wildTypeLastFrequency)
            : safeLog2(lastFrequency),
        log2EnrichmentAcrossRounds: safeLog2(lastFrequency / Math.max(firstFrequency, 1e-9)),
        meanSelectionCoefficient: mean(selectionCoefficients),
        finalFrequency: lastFrequency,
        finalFrequencyCi: {
          lower: lastFrequencyData.frequency.lower,
          upper: lastFrequencyData.frequency.upper,
        },
        totalReadsLastRound: lastFrequencyData.totalReads,
      };
    });
}

// ── Research summary ────────────────────────────────────────────────────────

export interface ProEvolResearchSummary {
  diversity: DiversityRoundPoint[];
  trajectories: VariantTrajectory[];
  topVariants: VariantTrajectory[];
  familyShares: ReturnType<typeof familyShareCurve>;
  enrichment: VariantEnrichmentEntry[];
  /** Pre-computed per-round flattening signal for the decision strip. */
  shannonDelta: number;
  /** Last-round Shannon (bits) for quick badge rendering. */
  lastRoundShannon: ConfidenceInterval | null;
  /** Last-round top-1 share for quick badge rendering. */
  lastRoundTopShare: ConfidenceInterval | null;
}

export function buildProEvolResearchSummary(artifact: ProEvolArtifact): ProEvolResearchSummary {
  const trajectories = variantTrajectories(artifact);
  const diversity = diversityCurve(artifact);
  const enrichment = variantEnrichmentTable(artifact);
  const lastRoundShannon = diversity.length ? diversity[diversity.length - 1].shannonBits : null;
  const previousRoundShannon = diversity.length > 1 ? diversity[diversity.length - 2].shannonBits : null;
  return {
    diversity,
    trajectories,
    topVariants: [...trajectories]
      .filter((trajectory) => trajectory.variantId !== artifact.meta.wildTypeId)
      .sort((left, right) => right.peakFrequency - left.peakFrequency)
      .slice(0, 6),
    familyShares: familyShareCurve(artifact),
    enrichment,
    shannonDelta:
      lastRoundShannon && previousRoundShannon
        ? lastRoundShannon.mean - previousRoundShannon.mean
        : 0,
    lastRoundShannon,
    lastRoundTopShare: diversity.length ? diversity[diversity.length - 1].topShare : null,
  };
}
