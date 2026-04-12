'use client';

import { useEffect, useMemo, useState } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import ExportButton from '../ide/shared/ExportButton';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import { T } from '../ide/tokens';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import HybridWorkbenchPanels from './shared/HybridWorkbenchPanels';
import { buildProEvolCampaignInput } from '../../data/proevolMockCampaign';
import { buildProEvolCampaign } from '../../services/ProEvolCampaignEngine';
import ActivityLandscapePanel from './proevol/ActivityLandscapePanel';
import DiversityConvergencePanel from './proevol/DiversityConvergencePanel';
import EvolutionCampaignContextCard from './proevol/EvolutionCampaignContextCard';
import LeadVariantCard from './proevol/LeadVariantCard';
import LineageTracePanel from './proevol/LineageTracePanel';
import NextRoundRecommendationCard from './proevol/NextRoundRecommendationCard';
import RoundResultsPanel from './proevol/RoundResultsPanel';
import SelectionDecisionCard from './proevol/SelectionDecisionCard';
import VariantLibraryTable from './proevol/VariantLibraryTable';

const PANEL_BG = PATHD_THEME.sepiaPanelMuted;
const BORDER = PATHD_THEME.paperBorder;

function heroSignal(label: string, value: string, detail: string, accent: string) {
  return (
    <div
      key={label}
      style={{
        minWidth: 0,
        padding: '12px 14px',
        borderRadius: '16px',
        border: `1px solid ${PATHD_THEME.paperBorder}`,
        background: 'rgba(255,255,255,0.03)',
        display: 'grid',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: accent, flexShrink: 0 }} />
        <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: T.SANS, fontSize: '18px', fontWeight: 700, color: PATHD_THEME.value, letterSpacing: '-0.03em' }}>
        {value}
      </div>
      <div style={{ fontFamily: T.SANS, fontSize: '10px', color: PATHD_THEME.paperMuted, lineHeight: 1.55 }}>
        {detail}
      </div>
    </div>
  );
}

export default function ProEvolPage() {
  const project = useWorkbenchStore((state) => state.project);
  const analyzeArtifact = useWorkbenchStore((state) => state.analyzeArtifact);
  const catalystPayload = useWorkbenchStore((state) => state.toolPayloads.catdes);
  const cethxPayload = useWorkbenchStore((state) => state.toolPayloads.cethx);
  const fbaPayload = useWorkbenchStore((state) => state.toolPayloads.fbasim);
  const setToolPayload = useWorkbenchStore((state) => state.setToolPayload);

  const [totalRounds, setTotalRounds] = useState(3);
  const [librarySize, setLibrarySize] = useState(16);
  const [survivorCount, setSurvivorCount] = useState(5);
  const [selectionStringency, setSelectionStringency] = useState(0.65);
  const [focusedRoundNumber, setFocusedRoundNumber] = useState(3);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const campaignInput = useMemo(
    () => buildProEvolCampaignInput({
      project,
      analyzeArtifact,
      catalyst: catalystPayload,
      fba: fbaPayload,
      cethx: cethxPayload,
      totalRounds,
      librarySize,
      survivorCount,
      selectionStringency,
    }),
    [
      analyzeArtifact,
      catalystPayload,
      cethxPayload,
      fbaPayload,
      librarySize,
      project,
      selectionStringency,
      survivorCount,
      totalRounds,
    ],
  );

  const campaign = useMemo(() => buildProEvolCampaign(campaignInput), [campaignInput]);
  const focusedRound =
    campaign.rounds.find((roundResult) => roundResult.roundNumber === focusedRoundNumber)
    ?? campaign.currentRoundResult;
  const selectedVariant =
    (selectedVariantId ? campaign.variantIndex[selectedVariantId] : undefined)
    ?? focusedRound.selectedSurvivors[0]
    ?? campaign.leadVariant;

  useEffect(() => {
    setFocusedRoundNumber(campaign.currentRound);
  }, [campaign.currentRound]);

  useEffect(() => {
    if (!selectedVariantId || !campaign.variantIndex[selectedVariantId]) {
      setSelectedVariantId(campaign.leadVariant.id);
      return;
    }
    if (!focusedRound.variantLibrary.candidates.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId(focusedRound.selectedSurvivors[0]?.id ?? campaign.leadVariant.id);
    }
  }, [campaign.leadVariant.id, campaign.variantIndex, focusedRound, selectedVariantId]);

  useEffect(() => {
    setToolPayload('proevol', {
      toolId: 'proevol',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      campaignName: campaign.name,
      targetProtein: campaign.targetProtein,
      wildTypeLabel: campaign.wildTypeLabel,
      currentRound: campaign.currentRound,
      totalRounds: campaign.totalRounds,
      librarySize: campaign.librarySize,
      survivorCount: campaign.survivorCount,
      selectionStringency: campaign.selectionStringency,
      provenance: campaign.provenance,
      validity: campaign.provenance === 'simulated' ? 'demo' : 'partial',
      result: {
        leadVariantName: campaign.leadVariant.name,
        leadVariantScore: campaign.leadVariant.score.composite,
        leadMutationString: campaign.leadVariant.mutationString,
        selectedThisRound: campaign.currentRoundResult.selectedSurvivors.length,
        rejectedThisRound: campaign.currentRoundResult.rejectedVariants.length,
        diversityIndex: campaign.diversitySummary.index,
        convergenceState: campaign.convergenceSignal.state,
        recommendation: campaign.nextRoundRecommendation.summary,
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    campaign,
    project?.targetProduct,
    project?.title,
    setToolPayload,
  ]);

  const variantTableExport = useMemo(
    () => campaign.currentRoundResult.variantLibrary.candidates.map((variant) => ({
      variant: variant.name,
      parent: variant.parentId ?? 'WT',
      round: variant.round,
      family: variant.familyLabel,
      mutationString: variant.mutationString,
      score: variant.score.composite,
      deltaFromWildType: variant.score.deltaFromWildType,
      predictedActivity: variant.predictedActivity,
      predictedStability: variant.predictedStability,
      predictedExpression: variant.predictedExpression,
      predictedSpecificity: variant.predictedSpecificity,
      mutationBurden: variant.mutationBurden,
      confidence: variant.confidence,
      status: variant.status,
      decisionReason: variant.status === 'selected' ? variant.selectionReason : variant.rejectionReason,
    })),
    [campaign.currentRoundResult.variantLibrary.candidates],
  );
  const roundSummaryExport = useMemo(
    () => campaign.rounds.map((roundResult) => ({
      round: roundResult.roundNumber,
      librarySize: roundResult.librarySize,
      selectedSurvivors: roundResult.selectedSurvivors.length,
      rejectedVariants: roundResult.rejectedVariants.length,
      averageScore: roundResult.averageScore,
      bestLeadDelta: roundResult.bestLeadDelta,
      diversityIndex: roundResult.diversitySummary.index,
      diversityClassification: roundResult.diversitySummary.classification,
      convergenceState: roundResult.convergenceSummary.state,
      persistentMutations: roundResult.persistentMutations.join('; '),
    })),
    [campaign.rounds],
  );
  const lineageSummaryExport = useMemo(
    () => campaign.lineage.map((node) => ({
      variantId: node.variantId,
      parentId: node.parentId ?? 'WT',
      round: node.round,
      family: node.familyLabel,
      mutationString: node.mutationString,
      status: node.status,
      score: node.score,
    })),
    [campaign.lineage],
  );
  const recommendationSummaryExport = useMemo(
    () => ({
      campaign: campaign.name,
      provenance: campaign.provenance,
      leadVariant: {
        name: campaign.leadVariant.name,
        mutationString: campaign.leadVariant.mutationString,
        score: campaign.leadVariant.score.composite,
      },
      selectionDecision: campaign.selectionDecision,
      nextRoundRecommendation: campaign.nextRoundRecommendation,
      modeledBoundary: 'Campaign scores, lineage decisions, and recommendations are simulated or inferred decision-support outputs. They are not wet-lab measurements.',
    }),
    [campaign],
  );

  return (
    <div className="nb-tool-page" style={{ background: PANEL_BG }}>
      <AlgorithmInsight
        title="Protein Evolution Campaign Engine"
        description="Deterministic campaign simulation combining predicted activity, stability, expression, specificity, mutation burden, survivor selection, lineage persistence, diversity tracking, and next-round recommendation logic."
        formula="variant_score = wA·activity + wS·stability + wE·expression + wSp·specificity - wB·burden - wR·risk"
      />

      <div style={{ padding: '0 16px 10px' }}>
        <WorkbenchInlineContext
          toolId="proevol"
          title="Protein Evolution Campaign Workbench"
          summary="Manage directed-evolution campaigns as variant populations across rounds of mutation, selection, lineage persistence, convergence monitoring, and next-round strategy rather than as an abstract search simulator."
          compact
          isSimulated={campaign.provenance === 'simulated'}
        />
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <section
          style={{
            display: 'grid',
            gap: '16px',
            padding: '18px 20px',
            borderRadius: '24px',
            border: `1px solid ${PATHD_THEME.paperBorderStrong}`,
            background: 'linear-gradient(135deg, rgba(9,12,17,0.86) 0%, rgba(17,22,29,0.82) 100%)',
            boxShadow: '0 24px 56px rgba(0,0,0,0.34)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at top right, rgba(175,195,214,0.14), transparent 28%), radial-gradient(circle at bottom left, rgba(191,220,205,0.12), transparent 34%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gap: '14px',
              gridTemplateColumns: 'minmax(0, 1.3fr) minmax(280px, 0.7fr)',
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Stage 2 · Directed Evolution Campaign
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '30px', fontWeight: 700, color: PATHD_THEME.value, letterSpacing: '-0.05em', lineHeight: 1.05 }}>
                Protein evolution is framed as a selection campaign, not a generic search surface.
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.paperMuted, lineHeight: 1.7, maxWidth: '840px' }}>
                PROEVOL now centers variant libraries, survivor sets, lineage persistence, diversity maintenance, and next-round strategy. The landscape remains supportive, while the main workbench story is about how protein families evolve across selection rounds and whether another cycle is still justified.
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '8px',
                padding: '14px',
                borderRadius: '18px',
                border: `1px solid ${PATHD_THEME.paperBorder}`,
                background: 'rgba(255,255,255,0.04)',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Honest modeling boundary
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '12px', color: PATHD_THEME.value, fontWeight: 600, lineHeight: 1.5 }}>
                {campaign.provenance === 'simulated'
                  ? 'This campaign is a simulated decision-support workbench seeded from Nexus-Bio defaults.'
                  : 'This campaign is inferred from current workbench context and remains a modeled research aid rather than a wet-lab truth source.'}
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.paperMuted, lineHeight: 1.6 }}>
                Scores, selection reasons, lineage traces, and next-round recommendations are transparent model outputs designed to support campaign planning.
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '12px',
            }}
          >
            {[
              heroSignal(
                'Current lead',
                campaign.leadVariant.name,
                `${campaign.leadVariant.mutationString} · score ${campaign.leadVariant.score.composite.toFixed(1)}`,
                PATHD_THEME.mint,
              ),
              heroSignal(
                'Survivors this round',
                String(campaign.currentRoundResult.selectedSurvivors.length),
                `${campaign.currentRoundResult.rejectedVariants.length} rejected variants remain inspectable`,
                PATHD_THEME.sky,
              ),
              heroSignal(
                'Diversity state',
                campaign.diversitySummary.classification,
                `Index ${campaign.diversitySummary.index.toFixed(2)} · dominant family ${campaign.diversitySummary.dominantFamily}`,
                PATHD_THEME.apricot,
              ),
              heroSignal(
                'Next action',
                campaign.nextRoundRecommendation.action,
                campaign.nextRoundRecommendation.summary,
                PATHD_THEME.lilac,
              ),
            ]}
          </div>
        </section>
      </div>

      <HybridWorkbenchPanels
        leftLabel="Campaign"
        rightLabel="Decision"
        auxiliaryLabel="PROEVOL auxiliary panels"
        leftPanel={(
          <div
            className="nb-tool-sidebar"
            style={{
              width: '300px',
              flexShrink: 0,
              padding: '16px',
              borderRight: `1px solid ${BORDER}`,
              background: PANEL_BG,
            }}
          >
            <EvolutionCampaignContextCard
              campaign={campaign}
              totalRounds={totalRounds}
              librarySize={librarySize}
              survivorCount={survivorCount}
              selectionStringency={selectionStringency}
              onTotalRoundsChange={setTotalRounds}
              onLibrarySizeChange={setLibrarySize}
              onSurvivorCountChange={setSurvivorCount}
              onSelectionStringencyChange={setSelectionStringency}
            />
          </div>
        )}
        centerPanel={(
          <div
            className="nb-tool-center"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px',
              minWidth: 0,
              background: PANEL_BG,
              overflow: 'auto',
            }}
          >
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.08fr) minmax(360px, 0.92fr)', gap: '12px' }}>
                <LeadVariantCard campaign={campaign} />
                <ActivityLandscapePanel
                  campaign={campaign}
                  selectedVariantId={selectedVariantId}
                  onSelectVariant={setSelectedVariantId}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 0.85fr) minmax(0, 1.15fr)', gap: '12px' }}>
                <RoundResultsPanel
                  campaign={campaign}
                  focusedRoundNumber={focusedRoundNumber}
                  onFocusRoundChange={setFocusedRoundNumber}
                />
                <VariantLibraryTable
                  roundResult={focusedRound}
                  selectedVariantId={selectedVariant?.id ?? null}
                  onSelectVariant={setSelectedVariantId}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.08fr) minmax(320px, 0.92fr)', gap: '12px' }}>
                <LineageTracePanel
                  campaign={campaign}
                  selectedVariantId={selectedVariant?.id ?? null}
                  onSelectVariant={setSelectedVariantId}
                />
                <DiversityConvergencePanel campaign={campaign} />
              </div>

              <NextRoundRecommendationCard campaign={campaign} />
            </div>
          </div>
        )}
        rightPanel={(
          <div
            className="nb-tool-right"
            style={{
              width: '320px',
              flexShrink: 0,
              padding: '16px',
              borderLeft: `1px solid ${BORDER}`,
              background: PANEL_BG,
            }}
          >
            <SelectionDecisionCard campaign={campaign} focusedVariant={selectedVariant} />
          </div>
        )}
      />

      <div
        style={{
          borderTop: `1px solid ${BORDER}`,
          padding: '10px 16px 14px',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          background: PANEL_BG,
        }}
      >
        <ExportButton label="Export Variant Table CSV" data={variantTableExport} filename="proevol-variant-table" format="csv" />
        <ExportButton label="Export Round Summary JSON" data={roundSummaryExport} filename="proevol-round-summary" format="json" />
        <ExportButton label="Export Lineage Summary JSON" data={lineageSummaryExport} filename="proevol-lineage-summary" format="json" />
        <ExportButton label="Export Recommendation JSON" data={recommendationSummaryExport} filename="proevol-recommendation-summary" format="json" />
      </div>
    </div>
  );
}
