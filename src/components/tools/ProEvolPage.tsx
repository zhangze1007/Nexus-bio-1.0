'use client';

import { useEffect, useMemo, useState } from 'react';
import ExportButton from '../ide/shared/ExportButton';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import { T } from '../ide/tokens';
import { buildProEvolCampaignInput } from '../../data/proevolMockCampaign';
import { buildProEvolCampaign } from '../../services/ProEvolCampaignEngine';
import { campaignToArtifact } from '../../domain/proevolArtifact';
import { buildProEvolResearchSummary } from '../../services/proevolAnalysis';

import EvolutionCampaignContextCard from './proevol/EvolutionCampaignContextCard';
import LeadVariantCard from './proevol/LeadVariantCard';
import NextRoundRecommendationCard from './proevol/NextRoundRecommendationCard';
import SelectionDecisionCard from './proevol/SelectionDecisionCard';
import VariantLibraryTable from './proevol/VariantLibraryTable';
import LineageTracePanel from './proevol/LineageTracePanel';
import ActivityLandscapePanel from './proevol/ActivityLandscapePanel';
import { PROEVOL_THEME } from './proevol/shared';

import SectionShell from './proevol/research/SectionShell';
import TruthHeader from './proevol/research/TruthHeader';
import EvidenceStatRail from './proevol/research/EvidenceStatRail';
import ProvenanceCard from './proevol/research/ProvenanceCard';
import VariantTrajectoryChart from './proevol/research/VariantTrajectoryChart';
import MullerPlot from './proevol/research/MullerPlot';
import EnrichmentBurdenScatter from './proevol/research/EnrichmentBurdenScatter';
import DiversityConvergenceCurve from './proevol/research/DiversityConvergenceCurve';
import VariantEvidenceTable from './proevol/research/VariantEvidenceTable';

const PANEL_BG = PATHD_THEME.sepiaPanelMuted;

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
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [auxOpen, setAuxOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

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
  const targetProduct =
    analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product';

  const artifact = useMemo(
    () => campaignToArtifact({ campaign, targetProduct }),
    [campaign, targetProduct],
  );
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
  }, [
    analyzeArtifact?.id,
    artifact.provenance.validity,
    campaign,
    research.lastRoundShannon,
    setToolPayload,
    targetProduct,
  ]);

  // ── Exports ────────────────────────────────────────────────────────────
  const trajectoryExport = useMemo(
    () => research.trajectories.flatMap((trajectory) =>
      trajectory.points.map((point) => ({
        variantId: trajectory.variantId,
        variant: trajectory.label,
        family: trajectory.familyLabel,
        round: point.roundNumber,
        frequency: point.frequency,
        bandLower: point.lower,
        bandUpper: point.upper,
        bandSemantic,
        totalReads: point.totalReads,
      })),
    ),
    [bandSemantic, research.trajectories],
  );
  const enrichmentExport = useMemo(
    () => research.enrichment.map((entry) => ({
      variantId: entry.variantId,
      variant: entry.label,
      family: entry.familyLabel,
      mutations: entry.mutationString,
      mutationBurden: entry.mutationBurden,
      finalFrequency: entry.finalFrequency,
      bandLower: entry.finalFrequencyCi.lower,
      bandUpper: entry.finalFrequencyCi.upper,
      bandSemantic,
      log2EnrichmentVsWildType: entry.log2EnrichmentVsWildType,
      log2EnrichmentAcrossRounds: entry.log2EnrichmentAcrossRounds,
      meanSelectionCoefficient: entry.meanSelectionCoefficient,
      totalReadsLastRound: entry.totalReadsLastRound,
    })),
    [bandSemantic, research.enrichment],
  );
  const diversityExport = useMemo(
    () => research.diversity.map((point) => ({
      round: point.roundNumber,
      shannonBits: point.shannonBits.mean,
      shannonBandLower: point.shannonBits.lower,
      shannonBandUpper: point.shannonBits.upper,
      topShare: point.topShare.mean,
      topShareBandLower: point.topShare.lower,
      topShareBandUpper: point.topShare.upper,
      bandSemantic,
      effectiveVariantCount: point.effectiveVariantCount,
      observedVariantCount: point.observedVariantCount,
    })),
    [bandSemantic, research.diversity],
  );
  const artifactExport = useMemo(() => artifact, [artifact]);

  const exportSuffix = bandSemantic === 'modeled' ? '-modeled' : '-experiment';

  return (
    <div className="nb-tool-page" style={{ background: PANEL_BG, minHeight: '100%' }}>
      <div
        style={{
          display: 'grid',
          gap: '18px',
          padding: '16px 16px 18px',
        }}
      >
        {/* ─────────────────  TRUTH HEADER  ───────────────── */}
        <TruthHeader
          campaignName={campaign.name}
          targetProduct={targetProduct}
          provenance={artifact.provenance}
          actions={
            <ExportButton
              label="Artifact JSON"
              data={artifactExport}
              filename={`proevol-artifact${exportSuffix}`}
              format="json"
            />
          }
        />

        {/* ─────────────────  SECTION 01 · BRIEF (compact)  ───────────────── */}
        <details
          open={briefOpen}
          onToggle={(event) => setBriefOpen((event.currentTarget as HTMLDetailsElement).open)}
          style={{
            border: `1px solid ${PROEVOL_THEME.border}`,
            borderRadius: '14px',
            background: 'rgba(10,12,16,0.55)',
            padding: '12px 16px',
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              listStyle: 'none',
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto',
              gap: '14px',
              alignItems: 'center',
            }}
          >
            <span style={kickerStyle}>01 · Campaign brief</span>
            <span
              style={{
                fontFamily: T.SANS,
                fontSize: '12px',
                color: PROEVOL_THEME.muted,
                lineHeight: 1.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {campaign.targetProtein} · WT {campaign.wildTypeLabel} · {campaign.hostSystem} · {campaign.screeningSystem} · stringency {campaign.selectionStringency.toFixed(2)} · {campaign.currentRound}/{campaign.totalRounds} rounds
            </span>
            <span
              style={{
                fontFamily: T.MONO,
                fontSize: '10px',
                color: PROEVOL_THEME.muted,
              }}
            >
              {briefOpen ? 'collapse ▴' : 'expand ▾'}
            </span>
          </summary>
          <div
            style={{
              marginTop: '12px',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.95fr)',
              gap: '14px',
            }}
          >
            <div style={{ display: 'grid', gap: '12px', minWidth: 0 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '8px',
                }}
              >
                <BriefField label="Target protein" value={campaign.targetProtein} />
                <BriefField label="Wild type" value={campaign.wildTypeLabel} />
                <BriefField label="Host system" value={campaign.hostSystem} />
                <BriefField label="Screening assay" value={campaign.screeningSystem} />
                <BriefField label="Selection pressure" value={campaign.selectionPressure} />
                <BriefField label="Objective" value={campaign.optimizationObjective.summary} />
              </div>
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
            <ProvenanceCard provenance={artifact.provenance} />
          </div>
        </details>

        {/* ─────────────────  SECTION 02 · EVIDENCE CENTER (DOMINANT)  ───────────────── */}
        <SectionShell
          index={2}
          kicker="Scientific evidence layer"
          title="Variant trajectories, family dynamics, statistical signal"
          description="Every panel below is computed from the artifact's per-round read counts using frequency-first statistics. Bands carry the same semantic as the Truth Header above. Engine composite scores are intentionally absent from this section — they appear only in the demoted decision strip."
        >
          {/* 02A — Trajectory hero with stat rail */}
          <div
            style={{
              display: 'grid',
              gap: '14px',
              gridTemplateColumns: 'minmax(0, 2.4fr) minmax(220px, 0.9fr)',
            }}
          >
            <ChartShell
              title="Variant trajectory · top 6"
              subtitle="Per-round variant frequency for the six variants with highest peak share. Click a chip or evidence-table row to focus the trajectory across all panels."
              footnote={`Frequencies use Laplace pseudocount (+1) before normalization. Hover for ${
                bandSemantic === 'modeled' ? 'model spread' : '95% CI'
              } range.`}
              isHero
            >
              <VariantTrajectoryChart
                trajectories={research.topVariants}
                bandSemantic={bandSemantic}
                highlightVariantId={selectedVariantId}
                onSelectVariant={setSelectedVariantId}
              />
            </ChartShell>
            <EvidenceStatRail research={research} bandSemantic={bandSemantic} />
          </div>

          {/* 02B — Family share + diversity */}
          <div
            style={{
              display: 'grid',
              gap: '14px',
              gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
              marginTop: '16px',
            }}
          >
            <ChartShell
              title="Family share · Muller-style stack"
              subtitle="Stacked, normalized share per family across rounds. Reveals lineage extinction, fixation, or the emergence of a dominant clone."
              footnote="Family share is the mean across model draws over variant frequencies, then renormalized to 100%."
            >
              <MullerPlot data={research.familyShares} />
            </ChartShell>
            <ChartShell
              title="Diversity & convergence"
              subtitle="Left axis: Shannon entropy across all variants. Right axis: top-1 frequency. A widening gap signals premature collapse."
              footnote={
                research.shannonDelta < -0.15
                  ? 'Shannon dropped sharply between the last two rounds — broadening exploration is the conservative next move.'
                  : research.shannonDelta > 0.15
                    ? 'Shannon increased between the last two rounds — exploration is still active.'
                    : 'Shannon is stable across the last two rounds.'
              }
            >
              <DiversityConvergenceCurve data={research.diversity} bandSemantic={bandSemantic} />
            </ChartShell>
          </div>

          {/* 02C — Enrichment scatter (full width) */}
          <div style={{ marginTop: '16px' }}>
            <ChartShell
              title="Enrichment vs. mutation burden"
              subtitle="Each circle is a variant. Above the dashed line = enriched relative to wild type at the final round. Bubble area scales with final frequency."
              footnote="Variants with high burden but negative enrichment are candidates for stability rescue or rejection from the next library."
            >
              <EnrichmentBurdenScatter
                entries={research.enrichment}
                highlightVariantId={selectedVariantId}
                onSelectVariant={setSelectedVariantId}
              />
            </ChartShell>
          </div>

          {/* 02D — Variant evidence table */}
          <div
            style={{
              marginTop: '16px',
              padding: '16px 18px',
              borderRadius: '16px',
              border: `1px solid ${PROEVOL_THEME.border}`,
              background: 'rgba(255,255,255,0.015)',
              display: 'grid',
              gap: '12px',
            }}
          >
            <div style={{ display: 'grid', gap: '4px' }}>
              <div style={kickerStyle}>Variant evidence table · top 12 by log₂ enrichment vs WT</div>
              <div
                style={{
                  fontFamily: T.SANS,
                  fontSize: '12px',
                  color: PROEVOL_THEME.muted,
                  lineHeight: 1.55,
                }}
              >
                Click a row to focus the variant across the trajectory chart, the scatter, and the demoted decision strip.
              </div>
            </div>
            <VariantEvidenceTable
              entries={research.enrichment}
              highlightVariantId={selectedVariantId}
              onSelectVariant={setSelectedVariantId}
            />
          </div>
        </SectionShell>

        {/* ─────────────────  SECTION 03 · DECISION (DEMOTED, COLLAPSED)  ───────────────── */}
        <SectionShell
          index={3}
          kicker="Decision support · downstream of evidence"
          title="What should the campaign do next?"
          tone="demoted"
          description="Heuristic recommendations from the campaign engine. They are not derived from the evidence layer above — they should be audited against it. Open to read the full rationale."
          actions={
            <span
              style={{
                fontFamily: T.MONO,
                fontSize: 9,
                letterSpacing: '0.1em',
                color: PROEVOL_THEME.label,
                textTransform: 'uppercase',
                padding: '6px 10px',
                borderRadius: '999px',
                border: `1px solid ${PROEVOL_THEME.border}`,
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              heuristic · {artifact.provenance.validity}
            </span>
          }
        >
          {/* Always-visible one-line digest */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: '14px',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: '12px',
              border: `1px solid ${PROEVOL_THEME.border}`,
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
              <div style={kickerStyle}>recommendation · {campaign.nextRoundRecommendation.action}</div>
              <div
                style={{
                  fontFamily: T.SANS,
                  fontSize: '13px',
                  color: PROEVOL_THEME.value,
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
              >
                {campaign.nextRoundRecommendation.title} · {campaign.nextRoundRecommendation.summary}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDecisionOpen((value) => !value)}
              style={{
                cursor: 'pointer',
                fontFamily: T.MONO,
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1px solid ${PROEVOL_THEME.border}`,
                background: 'rgba(255,255,255,0.04)',
                color: PROEVOL_THEME.value,
              }}
            >
              {decisionOpen ? 'collapse ▴' : 'rationale ▾'}
            </button>
          </div>

          {decisionOpen ? (
            <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
                  gap: '12px',
                }}
              >
                <NextRoundRecommendationCard campaign={campaign} />
                <SelectionDecisionCard campaign={campaign} focusedVariant={focusedVariant} />
              </div>
              <LeadVariantCard campaign={campaign} />
            </div>
          ) : null}
        </SectionShell>

        {/* ─────────────────  AUXILIARY  ───────────────── */}
        <details
          open={auxOpen}
          onToggle={(event) => setAuxOpen((event.currentTarget as HTMLDetailsElement).open)}
          style={{
            border: `1px solid ${PROEVOL_THEME.border}`,
            borderRadius: '14px',
            background: 'rgba(10,12,16,0.45)',
            padding: '12px 16px',
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              listStyle: 'none',
              fontFamily: T.MONO,
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: PROEVOL_THEME.label,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>Auxiliary detail · lineage trace, library table, engine landscape</span>
            <span style={{ color: PROEVOL_THEME.muted }}>{auxOpen ? '▾' : '▸'}</span>
          </summary>
          <div style={{ display: 'grid', gap: '14px', paddingTop: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px' }}>
              <LineageTracePanel
                campaign={campaign}
                selectedVariantId={focusedVariant?.id ?? null}
                onSelectVariant={setSelectedVariantId}
              />
              <VariantLibraryTable
                roundResult={campaign.currentRoundResult}
                selectedVariantId={focusedVariant?.id ?? null}
                onSelectVariant={setSelectedVariantId}
              />
            </div>
            <ActivityLandscapePanel
              campaign={campaign}
              selectedVariantId={selectedVariantId}
              onSelectVariant={setSelectedVariantId}
            />
          </div>
        </details>

        {/* ─────────────────  EXPORTS  ───────────────── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
            padding: '12px 14px',
            borderRadius: '12px',
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: 'rgba(10,12,16,0.4)',
          }}
        >
          <span style={{ ...kickerStyle, marginRight: '4px' }}>Exports · band semantic = {bandSemantic}</span>
          <ExportButton
            label="Trajectory CSV"
            data={trajectoryExport}
            filename={`proevol-trajectories${exportSuffix}`}
            format="csv"
          />
          <ExportButton
            label="Enrichment CSV"
            data={enrichmentExport}
            filename={`proevol-enrichment${exportSuffix}`}
            format="csv"
          />
          <ExportButton
            label="Diversity CSV"
            data={diversityExport}
            filename={`proevol-diversity${exportSuffix}`}
            format="csv"
          />
          <ExportButton
            label="Artifact JSON"
            data={artifactExport}
            filename={`proevol-artifact${exportSuffix}`}
            format="json"
          />
        </div>
      </div>
    </div>
  );
}

const kickerStyle = {
  fontFamily: T.MONO,
  fontSize: '9px',
  color: PROEVOL_THEME.label,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
};

function ChartShell({
  title,
  subtitle,
  children,
  footnote,
  isHero = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footnote?: string;
  isHero?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '12px',
        padding: isHero ? '18px 20px' : '16px 18px',
        borderRadius: '16px',
        border: `1px solid ${PROEVOL_THEME.border}`,
        background: isHero ? 'rgba(8,11,16,0.62)' : 'rgba(8,11,16,0.5)',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'grid', gap: '4px' }}>
        <div style={kickerStyle}>{title}</div>
        <div
          style={{
            fontFamily: T.SANS,
            fontSize: 12.5,
            color: PROEVOL_THEME.muted,
            lineHeight: 1.55,
            maxWidth: '760px',
          }}
        >
          {subtitle}
        </div>
      </div>
      <div>{children}</div>
      {footnote ? (
        <div
          style={{
            fontFamily: T.SANS,
            fontSize: 10.5,
            color: PROEVOL_THEME.muted,
            lineHeight: 1.55,
            paddingTop: 6,
            borderTop: `1px dashed ${PROEVOL_THEME.border}`,
          }}
        >
          {footnote}
        </div>
      ) : null}
    </div>
  );
}

function BriefField({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '3px',
        padding: '8px 10px',
        borderRadius: '10px',
        border: `1px solid ${PROEVOL_THEME.border}`,
        background: 'rgba(255,255,255,0.02)',
        minWidth: 0,
      }}
    >
      <div style={kickerStyle}>{label}</div>
      <div
        style={{
          fontFamily: T.SANS,
          fontSize: 12,
          color: PROEVOL_THEME.value,
          lineHeight: 1.5,
        }}
      >
        {value}
      </div>
    </div>
  );
}
