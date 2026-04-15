'use client';

import { useEffect, useMemo, useState } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import ExportButton from '../ide/shared/ExportButton';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import { T } from '../ide/tokens';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
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
import ValidityIndicator from './proevol/research/ValidityIndicator';
import ProvenanceCard from './proevol/research/ProvenanceCard';
import VariantTrajectoryChart from './proevol/research/VariantTrajectoryChart';
import MullerPlot from './proevol/research/MullerPlot';
import EnrichmentBurdenScatter from './proevol/research/EnrichmentBurdenScatter';
import DiversityConvergenceCurve from './proevol/research/DiversityConvergenceCurve';
import VariantEvidenceTable from './proevol/research/VariantEvidenceTable';

const PANEL_BG = PATHD_THEME.sepiaPanelMuted;

function metricChip(label: string, value: string, detail: string, accent: string) {
  return (
    <div
      key={label}
      style={{
        minWidth: 0,
        padding: '10px 12px',
        borderRadius: '14px',
        border: `1px solid ${PROEVOL_THEME.border}`,
        background: 'rgba(255,255,255,0.03)',
        display: 'grid',
        gap: '4px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: accent }} />
        <span
          style={{
            fontFamily: T.MONO,
            fontSize: 9,
            color: PROEVOL_THEME.label,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: T.SANS,
          fontSize: 17,
          fontWeight: 700,
          color: PROEVOL_THEME.value,
          letterSpacing: '-0.03em',
        }}
      >
        {value}
      </div>
      <div style={{ fontFamily: T.SANS, fontSize: 10, color: PROEVOL_THEME.muted, lineHeight: 1.5 }}>
        {detail}
      </div>
    </div>
  );
}

function chartCard({ title, subtitle, children, footnote }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footnote?: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '12px',
        padding: '16px 18px',
        borderRadius: '18px',
        border: `1px solid ${PROEVOL_THEME.border}`,
        background: 'rgba(8,11,16,0.55)',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'grid', gap: '4px' }}>
        <div
          style={{
            fontFamily: T.MONO,
            fontSize: 9,
            color: PROEVOL_THEME.label,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: T.SANS,
            fontSize: 12,
            color: PROEVOL_THEME.muted,
            lineHeight: 1.55,
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
            fontSize: 10,
            color: PROEVOL_THEME.muted,
            lineHeight: 1.5,
            paddingTop: 4,
            borderTop: `1px dashed ${PROEVOL_THEME.border}`,
          }}
        >
          {footnote}
        </div>
      ) : null}
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

  const [totalRounds, setTotalRounds] = useState(4);
  const [librarySize, setLibrarySize] = useState(16);
  const [survivorCount, setSurvivorCount] = useState(5);
  const [selectionStringency, setSelectionStringency] = useState(0.65);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [auxOpen, setAuxOpen] = useState(false);

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
        ciLower: point.lower,
        ciUpper: point.upper,
        totalReads: point.totalReads,
      })),
    ),
    [research.trajectories],
  );
  const enrichmentExport = useMemo(
    () => research.enrichment.map((entry) => ({
      variantId: entry.variantId,
      variant: entry.label,
      family: entry.familyLabel,
      mutations: entry.mutationString,
      mutationBurden: entry.mutationBurden,
      finalFrequency: entry.finalFrequency,
      ciLower: entry.finalFrequencyCi.lower,
      ciUpper: entry.finalFrequencyCi.upper,
      log2EnrichmentVsWildType: entry.log2EnrichmentVsWildType,
      log2EnrichmentAcrossRounds: entry.log2EnrichmentAcrossRounds,
      meanSelectionCoefficient: entry.meanSelectionCoefficient,
      totalReadsLastRound: entry.totalReadsLastRound,
    })),
    [research.enrichment],
  );
  const diversityExport = useMemo(
    () => research.diversity.map((point) => ({
      round: point.roundNumber,
      shannonBits: point.shannonBits.mean,
      shannonLower: point.shannonBits.lower,
      shannonUpper: point.shannonBits.upper,
      topShare: point.topShare.mean,
      topShareLower: point.topShare.lower,
      topShareUpper: point.topShare.upper,
      effectiveVariantCount: point.effectiveVariantCount,
      observedVariantCount: point.observedVariantCount,
    })),
    [research.diversity],
  );
  const artifactExport = useMemo(() => artifact, [artifact]);

  // ── Section 01 ──────────────────────────────────────────────────────────
  const briefMetrics = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
      {metricChip(
        'Rounds',
        `${campaign.currentRound} / ${campaign.totalRounds}`,
        `${campaign.librarySize} variants × ${campaign.totalRounds} rounds`,
        PROEVOL_THEME.sky,
      )}
      {metricChip(
        'Replicates',
        `${artifact.provenance.replicateCount}`,
        artifact.provenance.sequencingDepthPerSample
          ? `${(artifact.provenance.sequencingDepthPerSample / 1000).toFixed(0)}k reads / sample`
          : 'No depth recorded',
        PROEVOL_THEME.lilac,
      )}
      {metricChip(
        'Last-round Shannon',
        research.lastRoundShannon ? `${research.lastRoundShannon.mean.toFixed(2)} bits` : '—',
        research.lastRoundShannon
          ? `[${research.lastRoundShannon.lower.toFixed(2)}–${research.lastRoundShannon.upper.toFixed(2)}]`
          : 'awaiting data',
        PROEVOL_THEME.mint,
      )}
      {metricChip(
        'Top-1 share',
        research.lastRoundTopShare
          ? `${(research.lastRoundTopShare.mean * 100).toFixed(1)}%`
          : '—',
        research.lastRoundTopShare
          ? `[${(research.lastRoundTopShare.lower * 100).toFixed(1)}–${(research.lastRoundTopShare.upper * 100).toFixed(1)}%]`
          : 'awaiting data',
        PROEVOL_THEME.coral,
      )}
      {metricChip(
        'Lead variant',
        campaign.leadVariant.name,
        campaign.leadVariant.mutationString,
        PROEVOL_THEME.apricot,
      )}
    </div>
  );

  return (
    <div className="nb-tool-page" style={{ background: PANEL_BG, minHeight: '100%' }}>
      <AlgorithmInsight
        title="PROEVOL Research Workbench"
        description="Variant frequencies are derived from per-replicate read counts on a normalized proevol.campaign.v1 artifact. Diversity (Shannon), top-1 share, log₂ enrichment vs wild type, and per-round selection coefficient drive the scientific evidence layer; engine-level composite scores remain visible only as decision-support context."
        formula="Shannon = −Σ pᵢ log₂ pᵢ   ·   sₜ ≈ ln(fₜ / fₜ₋₁)   ·   log₂ enrichmentᵥ = log₂(fᵥ,last / f_WT,last)"
      />

      <div style={{ padding: '0 16px 10px' }}>
        <WorkbenchInlineContext
          toolId="proevol"
          title="Protein Evolution Research Workbench"
          summary="PROEVOL now reads a normalized campaign artifact, surfaces real frequency-derived statistics with replicate confidence intervals, and gates every chart with explicit data-validity boundaries before presenting decision-support recommendations."
          compact
          isSimulated={artifact.provenance.validity !== 'real'}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gap: '16px',
          padding: '0 16px 16px',
        }}
      >
        {/* ─────────────────────────  SECTION 01  ───────────────────────── */}
        <SectionShell
          index={1}
          kicker="Stage 2 · Directed Evolution Campaign"
          title="Campaign brief & data readiness"
          description="Before any chart is interpreted, the page resolves what the campaign is, where the data came from, and what level of scientific claim the rest of the page is allowed to make."
          actions={(
            <ValidityIndicator
              validity={artifact.provenance.validity}
              source={artifact.provenance.source}
              replicateCount={artifact.provenance.replicateCount}
            />
          )}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.85fr)', gap: '14px' }}>
            <div style={{ display: 'grid', gap: '14px', minWidth: 0 }}>
              {briefMetrics}
              <div
                style={{
                  display: 'grid',
                  gap: '8px',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: `1px solid ${PROEVOL_THEME.border}`,
                  background: 'rgba(255,255,255,0.025)',
                }}
              >
                <div
                  style={{
                    fontFamily: T.MONO,
                    fontSize: 9,
                    color: PROEVOL_THEME.label,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  Campaign brief
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: 13, color: PROEVOL_THEME.value, fontWeight: 600, lineHeight: 1.5 }}>
                  {campaign.name}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                  <BriefField label="Target protein" value={campaign.targetProtein} />
                  <BriefField label="Wild type" value={campaign.wildTypeLabel} />
                  <BriefField label="Host system" value={campaign.hostSystem} />
                  <BriefField label="Screening assay" value={campaign.screeningSystem} />
                  <BriefField label="Selection pressure" value={campaign.selectionPressure} />
                  <BriefField label="Objective" value={campaign.optimizationObjective.summary} />
                </div>
              </div>
            </div>
            <ProvenanceCard provenance={artifact.provenance} />
          </div>

          <details
            style={{
              marginTop: '14px',
              border: `1px solid ${PROEVOL_THEME.border}`,
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                listStyle: 'none',
                padding: '10px 14px',
                fontFamily: T.MONO,
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: PROEVOL_THEME.label,
              }}
            >
              Campaign sliders & starting sequence
            </summary>
            <div style={{ padding: '0 14px 14px' }}>
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
          </details>
        </SectionShell>

        {/* ─────────────────────────  SECTION 02  ───────────────────────── */}
        <SectionShell
          index={2}
          kicker="Scientific Evidence Layer"
          title="Variant trajectories, family dynamics, and statistical signal"
          description="This is the page's primary evidence layer. Every panel is computed from the artifact's per-replicate read counts using frequency-first statistics. Engine composite scores are intentionally absent here — they appear only in the decision strip below."
        >
          <div
            style={{
              display: 'grid',
              gap: '14px',
              gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
            }}
          >
            {chartCard({
              title: 'Variant trajectory · top 6',
              subtitle:
                'Per-round variant frequency (mean ± 95% CI across replicates) for the six variants with highest peak share. Click a chip to focus.',
              children: (
                <VariantTrajectoryChart
                  trajectories={research.topVariants}
                  highlightVariantId={selectedVariantId}
                  onSelectVariant={setSelectedVariantId}
                />
              ),
              footnote: 'Frequencies use Laplace pseudocount (+1) before normalization to keep low-count variants traceable.',
            })}

            {chartCard({
              title: 'Family share · Muller-style stack',
              subtitle:
                'Stacked, normalized share per family across rounds. Reveals lineage extinction, fixation, or the emergence of a dominant clone.',
              children: <MullerPlot data={research.familyShares} />,
              footnote: 'Family share is the per-replicate mean over variant frequencies, then renormalized to 100%.',
            })}
          </div>

          <div
            style={{
              display: 'grid',
              gap: '14px',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              marginTop: '14px',
            }}
          >
            {chartCard({
              title: 'Enrichment vs. mutation burden',
              subtitle:
                'Each circle is a variant. Above the dashed line = enriched relative to wild type at the final round. Bubble area scales with final frequency.',
              children: (
                <EnrichmentBurdenScatter
                  entries={research.enrichment}
                  highlightVariantId={selectedVariantId}
                  onSelectVariant={setSelectedVariantId}
                />
              ),
              footnote: 'Variants with high burden but negative enrichment are candidates for stability rescue or rejection from the next library.',
            })}

            {chartCard({
              title: 'Diversity & convergence',
              subtitle:
                'Left axis: Shannon entropy across all variants (replicate CI band). Right axis: top-1 frequency. A widening gap signals premature collapse.',
              children: <DiversityConvergenceCurve data={research.diversity} />,
              footnote:
                research.shannonDelta < -0.15
                  ? 'Shannon dropped sharply between the last two rounds — the next-round panel should consider broadening exploration.'
                  : research.shannonDelta > 0.15
                    ? 'Shannon increased between the last two rounds — exploration is still active.'
                    : 'Shannon is stable across the last two rounds.',
            })}
          </div>

          <div
            style={{
              marginTop: '14px',
              padding: '14px 16px',
              borderRadius: '18px',
              border: `1px solid ${PROEVOL_THEME.border}`,
              background: 'rgba(8,11,16,0.55)',
              display: 'grid',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'grid', gap: '4px' }}>
                <div
                  style={{
                    fontFamily: T.MONO,
                    fontSize: 9,
                    color: PROEVOL_THEME.label,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  Variant evidence table
                </div>
                <div
                  style={{
                    fontFamily: T.SANS,
                    fontSize: 12,
                    color: PROEVOL_THEME.muted,
                    lineHeight: 1.5,
                  }}
                >
                  Click a row to focus the variant across the trajectory chart, scatter, and the decision strip.
                </div>
              </div>
              <ValidityIndicator
                validity={artifact.provenance.validity}
                source={artifact.provenance.source}
                replicateCount={artifact.provenance.replicateCount}
                compact
              />
            </div>
            <VariantEvidenceTable
              entries={research.enrichment}
              highlightVariantId={selectedVariantId}
              onSelectVariant={setSelectedVariantId}
            />
          </div>
        </SectionShell>

        {/* ─────────────────────────  SECTION 03  ───────────────────────── */}
        <SectionShell
          index={3}
          kicker="Decision & Next-Round Strategy"
          title="What should the campaign do next?"
          description="Selection-decision and next-round recommendations are decision-support outputs from the heuristic engine, gated by the validity badge. They are presented alongside the focused variant so the user can audit the recommendation against the underlying evidence."
          actions={(
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
              decision-support · {artifact.provenance.validity}
            </span>
          )}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)', gap: '14px' }}>
            <NextRoundRecommendationCard campaign={campaign} />
            <SelectionDecisionCard campaign={campaign} focusedVariant={focusedVariant} />
          </div>

          <div style={{ marginTop: '14px' }}>
            <LeadVariantCard campaign={campaign} />
          </div>
        </SectionShell>

        {/* ─────────────────────────  AUXILIARY  ───────────────────────── */}
        <details
          open={auxOpen}
          onToggle={(event) => setAuxOpen((event.currentTarget as HTMLDetailsElement).open)}
          style={{
            border: `1px solid ${PROEVOL_THEME.border}`,
            borderRadius: '18px',
            background: 'rgba(8,11,16,0.5)',
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
            <span style={{ color: PROEVOL_THEME.muted }}>
              {auxOpen ? '▾' : '▸'}
            </span>
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

        {/* ─────────────────────────  EXPORTS  ───────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '14px 16px',
            borderRadius: '14px',
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: 'rgba(8,11,16,0.45)',
          }}
        >
          <ExportButton
            label="Export trajectory CSV"
            data={trajectoryExport}
            filename="proevol-trajectories"
            format="csv"
          />
          <ExportButton
            label="Export enrichment table CSV"
            data={enrichmentExport}
            filename="proevol-enrichment"
            format="csv"
          />
          <ExportButton
            label="Export diversity curve CSV"
            data={diversityExport}
            filename="proevol-diversity"
            format="csv"
          />
          <ExportButton
            label="Export campaign artifact JSON"
            data={artifactExport}
            filename="proevol-campaign-artifact"
            format="json"
          />
        </div>
      </div>
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
      <div
        style={{
          fontFamily: T.MONO,
          fontSize: 9,
          color: PROEVOL_THEME.label,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
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
