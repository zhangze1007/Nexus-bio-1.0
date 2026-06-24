'use client';

import { THEME } from '../../../theme';
import ExportButton from '../../ide/shared/ExportButton';
import { PROEVOL_THEME, formatSigned, StatusPill } from './shared';
import {
  kicker,
  SectionKicker,
  CompactMetric,
  InfoField,
  ChartShell,
} from './sharedComponents';
import TruthHeader from './research/TruthHeader';
import EvidenceStatRail from './research/EvidenceStatRail';
import VariantTrajectoryChart from './research/VariantTrajectoryChart';
import MullerPlot from './research/MullerPlot';
import EnrichmentBurdenScatter from './research/EnrichmentBurdenScatter';
import DiversityConvergenceCurve from './research/DiversityConvergenceCurve';
import VariantEvidenceTable from './research/VariantEvidenceTable';
import EvolutionCampaignContextCard from './EvolutionCampaignContextCard';
import NextRoundRecommendationCard from './NextRoundRecommendationCard';
import SelectionDecisionCard from './SelectionDecisionCard';
import VariantLibraryTable from './VariantLibraryTable';
import LineageTracePanel from './LineageTracePanel';
import ActivityLandscapePanel from './ActivityLandscapePanel';
import type { ProEvolState } from './useProEvolState';

export default function LandscapeTab({ state }: { state: ProEvolState }) {
  const {
    activeArtifact, activeResearch, bandSemantic,
    campaign, lead, wt, focusedVariant,
    csvArtifact, uploadFileName, isParsing, uploadError,
    handleDrop, handleDragOver, handleFileInputChange, clearCSV,
    fileInputRef,
    selectedVariantId, setSelectedVariantId,
    showParams, setShowParams,
    totalRounds, setTotalRounds, librarySize, setLibrarySize,
    survivorCount, setSurvivorCount, selectionStringency, setSelectionStringency,
    targetProduct,
    trajectoryExport, enrichmentExport, diversityExport, exportSuffix,
    artifact,
    gpPredictions,
  } = state;

  return (
    <div style={{ display: 'grid', gap: '10px', padding: '10px 12px 14px' }}>
      {/* ═══ 1. TRUTH HEADER ═══ */}
      <TruthHeader
        campaignName={csvArtifact ? 'User CSV Upload' : campaign.name}
        targetProduct={targetProduct}
        provenance={activeArtifact.provenance}
        actions={<ExportButton label="Artifact JSON" data={activeArtifact} filename={`proevol-artifact${exportSuffix}`} format="json" />}
      />

      {/* ═══ 1b. CSV UPLOAD ═══ */}
      <div
        style={{
          padding: '10px 12px', borderRadius: 'var(--nb-radius-md)',
          border: `1px dashed ${csvArtifact ? PROEVOL_THEME.mint : PROEVOL_THEME.border}`,
          background: csvArtifact ? 'rgba(191,220,205,0.06)' : PROEVOL_THEME.surface,
          display: 'grid', gap: '8px',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={kicker}>CSV Data Upload</span>
          {csvArtifact ? (
            <>
              <StatusPill tone="cool">Real data</StatusPill>
              <StatusPill tone="cool">{csvArtifact.variants.length} variants</StatusPill>
              <StatusPill tone="cool">{csvArtifact.rounds.length} rounds</StatusPill>
            </>
          ) : (
            <StatusPill tone="neutral">Synthetic mode</StatusPill>
          )}
        </div>
        {!csvArtifact ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              style={{
                fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: PROEVOL_THEME.muted,
                lineHeight: 1.5, flex: '1 1 260px',
              }}
            >
              Upload a CSV with columns: <code style={{ fontFamily: THEME.MONO, color: PROEVOL_THEME.sky, fontSize: 'var(--nb-fs-xs)' }}>variant_id, round, replicate, read_count</code>.
              Drop a file here or click to browse.
            </div>
            <label
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '999px',
                background: 'rgba(191,220,205,0.12)', color: PROEVOL_THEME.mint,
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer',
                border: `1px solid ${PROEVOL_THEME.mint}44`,
              }}
            >
              {isParsing ? 'Parsing...' : 'Choose CSV'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.value }}>
              {uploadFileName}
            </span>
            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.muted }}>
              {csvArtifact.provenance.replicateCount} replicates · {csvArtifact.provenance.bandSemantic === 'measurement' ? '95% CI bands' : 'model spread'}
            </span>
            <button
              type="button"
              onClick={clearCSV}
              style={{
                padding: '4px 10px', borderRadius: '999px',
                background: 'rgba(232,163,161,0.12)', color: PROEVOL_THEME.coral,
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer',
                border: `1px solid ${PROEVOL_THEME.coral}44`,
              }}
            >
              Clear
            </button>
            <label
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '999px',
                background: 'rgba(191,220,205,0.08)', color: PROEVOL_THEME.mint,
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer',
                border: `1px solid ${PROEVOL_THEME.mint}33`,
              }}
            >
              Replace
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}
        {uploadError ? (
          <div style={{
            fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: PROEVOL_THEME.coral,
            padding: '6px 10px', borderRadius: 'var(--nb-radius-sm)',
            background: 'rgba(232,163,161,0.08)', border: `1px solid ${PROEVOL_THEME.coral}33`,
            lineHeight: 1.5,
          }}>
            {uploadError}
          </div>
        ) : null}
      </div>

      {/* ═══ 2. METRIC BAR — responsive auto-fit ═══ */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '6px',
        padding: '10px 12px', borderRadius: 'var(--nb-radius-md)',
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
        padding: '8px 12px', borderRadius: 'var(--nb-radius-md)',
        border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface,
      }}>
        <StatusPill tone="cool">{campaign.nextRoundRecommendation.action}</StatusPill>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: PROEVOL_THEME.value, fontWeight: 600, lineHeight: 1.4 }}>
            {campaign.nextRoundRecommendation.title}
          </div>
          <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: PROEVOL_THEME.muted, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        padding: '10px 12px', borderRadius: 'var(--nb-radius-md)',
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
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.muted, marginLeft: 'auto' }}>
            dev {lead.developability.toFixed(0)} · {campaign.diversitySummary.classification}
          </span>
          <button
            type="button"
            className={`nb-tool-toggle ${showParams ? 'nb-tool-toggle--active' : ''}`}
            onClick={() => setShowParams(!showParams)}
            style={{
              minHeight: '22px', padding: '0 8px', borderRadius: '999px',
              background: showParams ? 'rgba(191,220,205,0.12)' : undefined,
              color: showParams ? PROEVOL_THEME.value : undefined,
              fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase',
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
            trajectories={activeResearch.topVariants}
            bandSemantic={bandSemantic}
            highlightVariantId={selectedVariantId}
            onSelectVariant={setSelectedVariantId}
          />
        </ChartShell>
        <EvidenceStatRail research={activeResearch} bandSemantic={bandSemantic} />
      </div>

      {/* ═══ 7. EVIDENCE: Muller + Diversity ═══ */}
      <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)' }}>
        <ChartShell title="Family share · Muller stack" footnote="Normalized share per family across rounds.">
          <MullerPlot data={activeResearch.familyShares} />
        </ChartShell>
        <ChartShell title="Diversity & convergence" footnote="Shannon entropy (left) vs top-1 frequency (right).">
          <DiversityConvergenceCurve data={activeResearch.diversity} bandSemantic={bandSemantic} />
        </ChartShell>
      </div>

      {/* ═══ 8. EVIDENCE: Enrichment scatter ═══ */}
      <ChartShell title="Enrichment vs mutation burden" footnote="Above dashed line = enriched vs WT. Bubble area = final frequency.">
        <EnrichmentBurdenScatter entries={activeResearch.enrichment} highlightVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />
      </ChartShell>

      {/* ═══ 9. EVIDENCE TABLE ═══ */}
      <div style={{
        padding: '10px 12px', borderRadius: 'var(--nb-radius-md)',
        border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface,
      }}>
        <div style={kicker}>Variant evidence · top 12 by log₂ enrichment vs WT</div>
        <div style={{ marginTop: '6px' }}>
          <VariantEvidenceTable entries={activeResearch.enrichment} highlightVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />
        </div>
      </div>

      {/* ═══ 10. AUXILIARY: Lineage + Library + Landscape ═══ */}
      <SectionKicker index={2} label="Lineage trace, variant library & fitness landscape" />
      <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <LineageTracePanel campaign={campaign} selectedVariantId={focusedVariant?.id ?? null} onSelectVariant={setSelectedVariantId} />
        <VariantLibraryTable roundResult={campaign.currentRoundResult} selectedVariantId={focusedVariant?.id ?? null} onSelectVariant={setSelectedVariantId} />
      </div>

      <ActivityLandscapePanel campaign={campaign} selectedVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} gpPredictions={gpPredictions} />

      {/* ═══ 11. EXPORTS ═══ */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
        padding: '8px 12px', borderRadius: 'var(--nb-radius-md)',
        border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface,
      }}>
        <span style={{ ...kicker, marginRight: '4px' }}>Exports · {bandSemantic}</span>
        <ExportButton label="Trajectory CSV" data={trajectoryExport} filename={`proevol-trajectories${exportSuffix}`} format="csv" />
        <ExportButton label="Enrichment CSV" data={enrichmentExport} filename={`proevol-enrichment${exportSuffix}`} format="csv" />
        <ExportButton label="Diversity CSV" data={diversityExport} filename={`proevol-diversity${exportSuffix}`} format="csv" />
        <ExportButton label="Artifact JSON" data={artifact} filename={`proevol-artifact${exportSuffix}`} format="json" />
      </div>
    </div>
  );
}
