'use client';

import { useEffect, useMemo, useState } from 'react';
import ExportButton from '../ide/shared/ExportButton';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import { buildProEvolCampaignInput } from '../../data/proevolMockCampaign';
import { buildProEvolCampaign } from '../../services/ProEvolCampaignEngine';
import { campaignToArtifact } from '../../domain/proevolArtifact';
import { buildProEvolResearchSummary } from '../../services/proevolAnalysis';

import EvolutionCampaignContextCard from './proevol/EvolutionCampaignContextCard';
import NextRoundRecommendationCard from './proevol/NextRoundRecommendationCard';
import SelectionDecisionCard from './proevol/SelectionDecisionCard';
import VariantLibraryTable from './proevol/VariantLibraryTable';
import LineageTracePanel from './proevol/LineageTracePanel';
import ActivityLandscapePanel from './proevol/ActivityLandscapePanel';
import { PROEVOL_THEME, formatSigned, StatusPill } from './proevol/shared';

import TruthHeader from './proevol/research/TruthHeader';
import EvidenceStatRail from './proevol/research/EvidenceStatRail';
import VariantTrajectoryChart from './proevol/research/VariantTrajectoryChart';
import MullerPlot from './proevol/research/MullerPlot';
import EnrichmentBurdenScatter from './proevol/research/EnrichmentBurdenScatter';
import DiversityConvergenceCurve from './proevol/research/DiversityConvergenceCurve';
import VariantEvidenceTable from './proevol/research/VariantEvidenceTable';

const PANEL_BG = PROEVOL_THEME.pageBg;

export default function ProEvolPage() {
  const project = useWorkbenchStore((state) => state.project);
  const analyzeArtifact = useWorkbenchStore((state) => state.analyzeArtifact);
  const catalystPayload = useWorkbenchStore((state) => state.toolPayloads.catdes);
  const cethxPayload = useWorkbenchStore((state) => state.toolPayloads.cethx);
  const fbaPayload = useWorkbenchStore((state) => state.toolPayloads.fbasim);
  const setToolPayload = useWorkbenchStore((state) => state.setToolPayload);

  const [totalRounds, setTotalRounds] = useState(4);
  const [librarySize, setLibrarySize] = useState(16);
  const [survivorCount, setSurvivorCount] = useState(5);
  const [selectionStringency, setSelectionStringency] = useState(0.65);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [showParams, setShowParams] = useState(false);

  const campaignInput = useMemo(
    () => buildProEvolCampaignInput({
      project, analyzeArtifact, catalyst: catalystPayload, fba: fbaPayload, cethx: cethxPayload,
      totalRounds, librarySize, survivorCount, selectionStringency,
    }),
    [analyzeArtifact, catalystPayload, cethxPayload, fbaPayload, librarySize, project, selectionStringency, survivorCount, totalRounds],
  );

  const campaign = useMemo(() => buildProEvolCampaign(campaignInput), [campaignInput]);
  const targetProduct = analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product';
  const artifact = useMemo(() => campaignToArtifact({ campaign, targetProduct }), [campaign, targetProduct]);
  const research = useMemo(() => buildProEvolResearchSummary(artifact), [artifact]);
  const bandSemantic = artifact.provenance.bandSemantic;

  const focusedVariant =
    (selectedVariantId ? campaign.variantIndex[selectedVariantId] : undefined)
    ?? campaign.currentRoundResult.selectedSurvivors[0]
    ?? campaign.leadVariant;

  useEffect(() => {
    if (!selectedVariantId || !campaign.variantIndex[selectedVariantId]) {
      setSelectedVariantId(campaign.leadVariant.id);
    }
  }, [campaign.leadVariant.id, campaign.variantIndex, selectedVariantId]);

  useEffect(() => {
    setToolPayload('proevol', {
      toolId: 'proevol',
      targetProduct,
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
      validity: artifact.provenance.validity,
      result: {
        leadVariantName: campaign.leadVariant.name,
        leadVariantScore: campaign.leadVariant.score.composite,
        leadMutationString: campaign.leadVariant.mutationString,
        selectedThisRound: campaign.currentRoundResult.selectedSurvivors.length,
        rejectedThisRound: campaign.currentRoundResult.rejectedVariants.length,
        diversityIndex: research.lastRoundShannon?.mean ?? 0,
        convergenceState: campaign.convergenceSignal.state,
        recommendation: campaign.nextRoundRecommendation.summary,
      },
      updatedAt: Date.now(),
    });
  }, [analyzeArtifact?.id, artifact.provenance.validity, campaign, research.lastRoundShannon, setToolPayload, targetProduct]);

  // ── Exports ────────────────────────────────────────────────────────────
  const trajectoryExport = useMemo(
    () => research.trajectories.flatMap((t) => t.points.map((p) => ({
      variantId: t.variantId, variant: t.label, family: t.familyLabel,
      round: p.roundNumber, frequency: p.frequency, bandLower: p.lower, bandUpper: p.upper,
      bandSemantic, totalReads: p.totalReads,
    }))),
    [bandSemantic, research.trajectories],
  );
  const enrichmentExport = useMemo(
    () => research.enrichment.map((e) => ({
      variantId: e.variantId, variant: e.label, family: e.familyLabel, mutations: e.mutationString,
      mutationBurden: e.mutationBurden, finalFrequency: e.finalFrequency,
      bandLower: e.finalFrequencyCi.lower, bandUpper: e.finalFrequencyCi.upper, bandSemantic,
      log2EnrichmentVsWildType: e.log2EnrichmentVsWildType,
      log2EnrichmentAcrossRounds: e.log2EnrichmentAcrossRounds,
      meanSelectionCoefficient: e.meanSelectionCoefficient, totalReadsLastRound: e.totalReadsLastRound,
    })),
    [bandSemantic, research.enrichment],
  );
  const diversityExport = useMemo(
    () => research.diversity.map((d) => ({
      round: d.roundNumber, shannonBits: d.shannonBits.mean,
      shannonBandLower: d.shannonBits.lower, shannonBandUpper: d.shannonBits.upper,
      topShare: d.topShare.mean, topShareBandLower: d.topShare.lower, topShareBandUpper: d.topShare.upper,
      bandSemantic, effectiveVariantCount: d.effectiveVariantCount, observedVariantCount: d.observedVariantCount,
    })),
    [bandSemantic, research.diversity],
  );

  const exportSuffix = bandSemantic === 'modeled' ? '-modeled' : '-experiment';
  const lead = campaign.leadVariant;
  const wt = campaign.wildType;

  return (
    <div className="nb-tool-page" style={{ background: PANEL_BG, minHeight: '100%' }}>
      <div style={{ display: 'grid', gap: '10px', padding: '10px 12px 14px' }}>

        {/* ═══ 1. TRUTH HEADER ═══ */}
        <TruthHeader
          campaignName={campaign.name}
          targetProduct={targetProduct}
          provenance={artifact.provenance}
          actions={<ExportButton label="Artifact JSON" data={artifact} filename={`proevol-artifact${exportSuffix}`} format="json" />}
        />

        {/* ═══ 2. METRIC BAR — responsive auto-fit ═══ */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '6px',
          padding: '10px 12px', borderRadius: '12px',
          border: `1px solid ${PROEVOL_THEME.borderStrong}`,
          background: PROEVOL_THEME.surface,
        }}>
          <CompactMetric label="Lead score" value={lead.score.composite.toFixed(1)} delta={formatSigned(lead.score.deltaFromWildType, 1)} accent={PROEVOL_THEME.mint} />
          <CompactMetric label="Activity" value={lead.predictedActivity.toFixed(1)} delta={formatSigned(lead.predictedActivity - wt.predictedActivity, 1)} accent={PROEVOL_THEME.mint} />
          <CompactMetric label="Stability" value={lead.predictedStability.toFixed(1)} delta={formatSigned(lead.predictedStability - wt.predictedStability, 1)} accent={PROEVOL_THEME.sky} />
          <CompactMetric label="Expression" value={lead.predictedExpression.toFixed(1)} delta={formatSigned(lead.predictedExpression - wt.predictedExpression, 1)} accent={PROEVOL_THEME.apricot} />
          <CompactMetric label="Specificity" value={lead.predictedSpecificity.toFixed(1)} delta={formatSigned(lead.predictedSpecificity - wt.predictedSpecificity, 1)} accent={PROEVOL_THEME.lilac} />
          <CompactMetric label="Confidence" value={`${lead.confidence.toFixed(0)}%`} delta={`R${lead.round}`} accent={PROEVOL_THEME.lilac} />
        </div>

        {/* ═══ 3. DECISION — immediately visible ═══ */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '10px', alignItems: 'center',
          padding: '8px 12px', borderRadius: '10px',
          border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface,
        }}>
          <StatusPill tone="cool">{campaign.nextRoundRecommendation.action}</StatusPill>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PROEVOL_THEME.value, fontWeight: 600, lineHeight: 1.4 }}>
              {campaign.nextRoundRecommendation.title}
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PROEVOL_THEME.muted, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {campaign.nextRoundRecommendation.summary}
            </div>
          </div>
          <StatusPill tone={campaign.nextRoundRecommendation.stopSuggested ? 'warm' : 'neutral'}>
            conf {(campaign.selectionDecision.confidence * 100).toFixed(0)}%
          </StatusPill>
        </div>

        {/* ═══ 4. DECISION DETAIL — 2-col cards ═══ */}
        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
          <NextRoundRecommendationCard campaign={campaign} />
          <SelectionDecisionCard campaign={campaign} focusedVariant={focusedVariant} />
        </div>

        {/* ═══ 5. CAMPAIGN INFO + PARAMS (collapsible) ═══ */}
        <div style={{
          padding: '10px 12px', borderRadius: '12px',
          border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface,
          display: 'grid', gap: '8px', alignContent: 'start',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={kicker}>Campaign parameters</span>
            <StatusPill tone="cool">{campaign.convergenceSignal.state}</StatusPill>
            <StatusPill tone={lead.riskFlags.length ? 'warm' : 'neutral'}>
              burden {lead.mutationBurden}
            </StatusPill>
            <StatusPill tone={lead.predictedStability < 55 ? 'warm' : 'cool'}>
              stab {lead.predictedStability.toFixed(0)}
            </StatusPill>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.muted, marginLeft: 'auto' }}>
              dev {lead.developability.toFixed(0)} · {campaign.diversitySummary.classification}
            </span>
            <button
              type="button"
              onClick={() => setShowParams(!showParams)}
              style={{
                minHeight: '22px', padding: '0 8px', borderRadius: '999px',
                border: `1px solid ${PROEVOL_THEME.border}`,
                background: showParams ? 'rgba(191,220,205,0.12)' : 'transparent',
                color: showParams ? PROEVOL_THEME.value : PROEVOL_THEME.label,
                fontFamily: T.MONO, fontSize: '10px', textTransform: 'uppercase',
                letterSpacing: '0.06em', cursor: 'pointer',
              }}
            >
              {showParams ? 'Hide' : 'Edit'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '5px' }}>
            <InfoField label="Target" value={campaign.targetProtein} />
            <InfoField label="Wild type" value={campaign.wildTypeLabel} />
            <InfoField label="Host" value={campaign.hostSystem} />
            <InfoField label="Screening" value={campaign.screeningSystem} />
            <InfoField label="Pressure" value={campaign.selectionPressure} />
            <InfoField label="Rounds" value={`${campaign.currentRound}/${campaign.totalRounds}`} />
          </div>
          {showParams ? (
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
          ) : null}
        </div>

        {/* ═══ 6. EVIDENCE: trajectory + stat rail ═══ */}
        <SectionKicker index={1} label="Variant trajectories & statistical signal" />
        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'minmax(0, 2.4fr) minmax(200px, 0.8fr)' }}>
          <ChartShell title="Variant trajectory · top 6" footnote={`Frequencies use Laplace pseudocount (+1). Hover for ${bandSemantic === 'modeled' ? 'model spread' : '95% CI'} range.`}>
            <VariantTrajectoryChart
              trajectories={research.topVariants}
              bandSemantic={bandSemantic}
              highlightVariantId={selectedVariantId}
              onSelectVariant={setSelectedVariantId}
            />
          </ChartShell>
          <EvidenceStatRail research={research} bandSemantic={bandSemantic} />
        </div>

        {/* ═══ 7. EVIDENCE: Muller + Diversity ═══ */}
        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)' }}>
          <ChartShell title="Family share · Muller stack" footnote="Normalized share per family across rounds.">
            <MullerPlot data={research.familyShares} />
          </ChartShell>
          <ChartShell title="Diversity & convergence" footnote="Shannon entropy (left) vs top-1 frequency (right).">
            <DiversityConvergenceCurve data={research.diversity} bandSemantic={bandSemantic} />
          </ChartShell>
        </div>

        {/* ═══ 8. EVIDENCE: Enrichment scatter ═══ */}
        <ChartShell title="Enrichment vs mutation burden" footnote="Above dashed line = enriched vs WT. Bubble area = final frequency.">
          <EnrichmentBurdenScatter entries={research.enrichment} highlightVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />
        </ChartShell>

        {/* ═══ 9. EVIDENCE TABLE ═══ */}
        <div style={{
          padding: '10px 12px', borderRadius: '12px',
          border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface,
        }}>
          <div style={kicker}>Variant evidence · top 12 by log₂ enrichment vs WT</div>
          <div style={{ marginTop: '6px' }}>
            <VariantEvidenceTable entries={research.enrichment} highlightVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />
          </div>
        </div>

        {/* ═══ 10. AUXILIARY: Lineage + Library + Landscape ═══ */}
        <SectionKicker index={2} label="Lineage trace, variant library & fitness landscape" />
        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
          <LineageTracePanel campaign={campaign} selectedVariantId={focusedVariant?.id ?? null} onSelectVariant={setSelectedVariantId} />
          <VariantLibraryTable roundResult={campaign.currentRoundResult} selectedVariantId={focusedVariant?.id ?? null} onSelectVariant={setSelectedVariantId} />
        </div>

        <ActivityLandscapePanel campaign={campaign} selectedVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />

        {/* ═══ 11. EXPORTS ═══ */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
          padding: '8px 12px', borderRadius: '10px',
          border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface,
        }}>
          <span style={{ ...kicker, marginRight: '4px' }}>Exports · {bandSemantic}</span>
          <ExportButton label="Trajectory CSV" data={trajectoryExport} filename={`proevol-trajectories${exportSuffix}`} format="csv" />
          <ExportButton label="Enrichment CSV" data={enrichmentExport} filename={`proevol-enrichment${exportSuffix}`} format="csv" />
          <ExportButton label="Diversity CSV" data={diversityExport} filename={`proevol-diversity${exportSuffix}`} format="csv" />
          <ExportButton label="Artifact JSON" data={artifact} filename={`proevol-artifact${exportSuffix}`} format="json" />
        </div>
      </div>
    </div>
  );
}

/* ── Shared sub-components ──────────────────────────────────────────── */

const kicker: React.CSSProperties = {
  fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.label,
  letterSpacing: '0.12em', textTransform: 'uppercase',
};

function SectionKicker({ index, label }: { index: number; label: string }) {
  return (
    <div style={{
      fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.label,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      paddingTop: '6px', borderTop: `1px solid ${PROEVOL_THEME.border}`,
      marginTop: '2px',
    }}>
      {String(index).padStart(2, '0')} · {label}
    </div>
  );
}

function CompactMetric({ label, value, delta, accent }: { label: string; value: string; delta: string; accent: string }) {
  return (
    <div style={{ display: 'grid', gap: '3px', textAlign: 'center', minWidth: 0 }}>
      <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.label, letterSpacing: '0.08em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontFamily: T.SANS, fontSize: '18px', fontWeight: 700, color: PROEVOL_THEME.value, letterSpacing: '-0.03em' }}>{value}</span>
      <span style={{ fontFamily: T.MONO, fontSize: '10px', color: accent, fontFeatureSettings: "'tnum' 1" }}>{delta}</span>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '5px 8px', borderRadius: '8px', border: `1px solid ${PROEVOL_THEME.border}`, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.label, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PROEVOL_THEME.value, lineHeight: 1.4, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function ChartShell({ title, children, footnote }: { title: string; children: React.ReactNode; footnote?: string }) {
  return (
    <div style={{
      display: 'grid', gap: '8px', padding: '10px 12px', borderRadius: '12px',
      border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface, minWidth: 0,
    }}>
      <div style={kicker}>{title}</div>
      <div>{children}</div>
      {footnote ? (
        <div style={{ fontFamily: T.SANS, fontSize: '10px', color: PROEVOL_THEME.muted, lineHeight: 1.5, paddingTop: '4px', borderTop: `1px dashed ${PROEVOL_THEME.border}` }}>
          {footnote}
        </div>
      ) : null}
    </div>
  );
}
