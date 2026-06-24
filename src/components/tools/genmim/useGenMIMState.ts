'use client';
import { useState, useMemo, useEffect } from 'react';
import { useWorkbenchStore } from '../../../store/workbenchStore';
import { CRISPRI_TARGETS, greedyKnockdownSchedule, computeOffTargetScore } from '../../../data/mockGenMIM';
import { designgRNAs } from '../../../server/grnaDesigner';
import type { CRISPRiTarget } from '../../../types';
import { REACTION_TO_GENES, generatePseudoSequence } from './sharedComponents';

export function useGenMIMState() {
  // Workbench store selectors
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const dynconPayload = useWorkbenchStore((s) => s.toolPayloads.dyncon);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  // Local state
  const [efficiency, setEfficiency] = useState(0.8);
  const [maxTargets, setMaxTargets] = useState(5);
  const [protectEssential, setProtectEssential] = useState(true);

  // Custom gene targets upload
  const [customTargets, setCustomTargets] = useState<Array<{ geneId: string; geneName: string; essentiality: number; flux: number }> | null>(null);
  const [customTargetHeaders, setCustomTargetHeaders] = useState<string[]>([]);
  const [customTargetRows, setCustomTargetRows] = useState<Record<string, string>[]>([]);
  const [customTargetError, setCustomTargetError] = useState<string | null>(null);

  const recommendedEfficiency = useMemo(() => {
    const value = 0.72
      + (fbaPayload?.result.feasible ? 0.08 : 0)
      + (dynconPayload?.result.stable ? 0.04 : -0.03);
    return Math.min(1, Math.max(0.5, Math.round(value * 100) / 100));
  }, [dynconPayload?.result.stable, fbaPayload?.result.feasible]);

  const recommendedTargets = useMemo(() => {
    const count = 3
      + (analyzeArtifact?.bottleneckAssumptions.length ?? 0)
      + ((fbaPayload?.result.carbonEfficiency ?? 0) > 60 ? 1 : 0);
    return Math.min(15, Math.max(1, count));
  }, [analyzeArtifact?.bottleneckAssumptions.length, fbaPayload?.result.carbonEfficiency]);

  useEffect(() => {
    setEfficiency(recommendedEfficiency);
    setMaxTargets(recommendedTargets);
    setProtectEssential((dynconPayload?.result.doRmse ?? 0.05) <= 0.08);
  }, [dynconPayload?.result.doRmse, recommendedEfficiency, recommendedTargets]);

  // Flux-boosted CRISPRi targets: boost knockdown_efficiency for genes
  // whose corresponding FBA reactions carry high flux (bottleneck candidates)
  // Merges custom uploaded targets with default CRISPRI_TARGETS
  const fluxBoostedTargets = useMemo(() => {
    // Build base targets: merge custom + default
    let baseTargets: CRISPRiTarget[] = [...CRISPRI_TARGETS];
    if (customTargets && customTargets.length > 0) {
      const defaultGeneIds = new Set(CRISPRI_TARGETS.map(t => t.gene));
      const customAsTargets: CRISPRiTarget[] = customTargets.map(ct => ({
        gene: ct.geneId,
        position: 0,
        essential: ct.essentiality > 0.5,
        knockdown_efficiency: 0.8,
        phenotype: ct.geneName || ct.geneId,
        growth_impact: -0.05,
      }));
      // Add custom targets that don't already exist in defaults
      const newCustom = customAsTargets.filter(t => !defaultGeneIds.has(t.gene));
      baseTargets = [...CRISPRI_TARGETS, ...newCustom];
    }

    if (!fbaPayload?.result.topFluxes?.length) return baseTargets;
    const geneFluxBoost = new Map<string, number>();
    for (const { reactionId, flux } of fbaPayload.result.topFluxes) {
      const genes = REACTION_TO_GENES[reactionId];
      if (genes) {
        for (const gene of genes) {
          geneFluxBoost.set(gene, (geneFluxBoost.get(gene) ?? 0) + Math.abs(flux));
        }
      }
    }
    if (geneFluxBoost.size === 0) return baseTargets;
    const maxFlux = Math.max(...geneFluxBoost.values(), 1);
    return baseTargets.map((t) => {
      const boost = geneFluxBoost.get(t.gene);
      if (boost === undefined) return t;
      // Boost knockdown_efficiency by up to 0.08 for high-flux genes
      const normalizedBoost = (boost / maxFlux) * 0.08;
      return { ...t, knockdown_efficiency: Math.min(1, t.knockdown_efficiency + normalizedBoost) };
    });
  }, [fbaPayload?.result.topFluxes, customTargets]);

  const { data: schedule, error: simError } = useMemo(() => {
    try {
      return { data: greedyKnockdownSchedule(fluxBoostedTargets, maxTargets, efficiency, protectEssential), error: null as string | null };
    } catch (e) {
      return { data: [] as ReturnType<typeof greedyKnockdownSchedule>, error: e instanceof Error ? e.message : 'Knockdown scheduling failed' };
    }
  }, [fluxBoostedTargets, efficiency, maxTargets, protectEssential]);

  const growthImpact = schedule.reduce((a, t) => a + (t.growth_impact ?? 0), 0);
  const avgEfficiency = schedule.length > 0
    ? schedule.reduce((a, t) => a + t.knockdown_efficiency, 0) / schedule.length : 0;

  // sgRNA sequences computed from gene coding sequences using designgRNAs()
  // Uses Rule Set 2 (Doench 2016) on-target scoring + CFD off-target scoring.
  // For genes without a provided coding sequence, we use the gene name as a seed
  // and generate a deterministic pseudo-sequence for demonstration purposes.
  const sgRNASequences: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of schedule) {
      const seed = t.gene.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const pseudoSeq = generatePseudoSequence(seed, 60);
      const result = designgRNAs(pseudoSeq, 'SpCas9', 1, t.gene);
      map[t.gene] = result.candidates[0]?.spacer ?? t.gene.toUpperCase().padEnd(20, 'A').slice(0, 20);
    }
    return map;
  }, [schedule]);

  const offTargetRisk = schedule.length > 0
    ? Math.round(schedule.reduce((sum, t) => sum + computeOffTargetScore(sgRNASequences[t.gene] ?? ''), 0) / schedule.length * 100) / 100
    : 0;

  return {
    // Store selectors
    project,
    analyzeArtifact,
    fbaPayload,
    dynconPayload,
    setToolPayload,
    // Local state
    efficiency,
    setEfficiency,
    maxTargets,
    setMaxTargets,
    protectEssential,
    setProtectEssential,
    // Custom targets
    customTargets,
    setCustomTargets,
    customTargetHeaders,
    setCustomTargetHeaders,
    customTargetRows,
    setCustomTargetRows,
    customTargetError,
    setCustomTargetError,
    // Derived
    recommendedEfficiency,
    recommendedTargets,
    fluxBoostedTargets,
    schedule,
    simError,
    growthImpact,
    avgEfficiency,
    sgRNASequences,
    offTargetRisk,
  };
}
