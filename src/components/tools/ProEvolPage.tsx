'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ExportButton from '../ide/shared/ExportButton';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { THEME } from '../../theme';
import { buildProEvolCampaignInput } from '../../data/proevolMockCampaign';
import { buildProEvolCampaign } from '../../services/ProEvolCampaignEngine';
import {
  campaignToArtifact,
  PROEVOL_ARTIFACT_VERSION,
} from '../../domain/proevolArtifact';
import type {
  ProEvolArtifact,
  ProEvolVariantRoundObservation,
  ProEvolVariant,
  ProEvolRound,
} from '../../domain/proevolArtifact';
import { buildProEvolResearchSummary } from '../../services/proevolAnalysis';

import EvolutionCampaignContextCard from './proevol/EvolutionCampaignContextCard';
import NextRoundRecommendationCard from './proevol/NextRoundRecommendationCard';
import SelectionDecisionCard from './proevol/SelectionDecisionCard';
import VariantLibraryTable from './proevol/VariantLibraryTable';
import LineageTracePanel from './proevol/LineageTracePanel';
import ActivityLandscapePanel from './proevol/ActivityLandscapePanel';
import ToolShell from './shared/ToolShell';
import type { ToolTab } from './shared/ToolTabBar';
import ToolTabPanel from './shared/ToolTabPanel';
import { PROEVOL_THEME, formatSigned, StatusPill } from './proevol/shared';

import TruthHeader from './proevol/research/TruthHeader';
import EvidenceStatRail from './proevol/research/EvidenceStatRail';
import VariantTrajectoryChart from './proevol/research/VariantTrajectoryChart';
import MullerPlot from './proevol/research/MullerPlot';
import EnrichmentBurdenScatter from './proevol/research/EnrichmentBurdenScatter';
import DiversityConvergenceCurve from './proevol/research/DiversityConvergenceCurve';
import VariantEvidenceTable from './proevol/research/VariantEvidenceTable';

const PANEL_BG = PROEVOL_THEME.pageBg;

// ── CSV parsing & artifact construction ─────────────────────────────────────

interface CSVRow {
  variant_id: string;
  round: number;
  replicate: number;
  read_count: number;
}

interface ParsedCSV {
  rows: CSVRow[];
  variantIds: string[];
  rounds: number[];
  replicates: number[];
}

function parseCSV(text: string): ParsedCSV {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const colIndex = {
    variant_id: header.indexOf('variant_id'),
    round: header.indexOf('round'),
    replicate: header.indexOf('replicate'),
    read_count: header.indexOf('read_count'),
  };
  for (const [key, idx] of Object.entries(colIndex)) {
    if (idx === -1) throw new Error(`Missing required column: "${key}"`);
  }

  const rows: CSVRow[] = [];
  const variantSet = new Set<string>();
  const roundSet = new Set<number>();
  const replicateSet = new Set<number>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map((c) => c.trim());
    const variant_id = cols[colIndex.variant_id];
    const round = Number(cols[colIndex.round]);
    const replicate = Number(cols[colIndex.replicate]);
    const read_count = Number(cols[colIndex.read_count]);

    if (!variant_id) throw new Error(`Row ${i + 1}: empty variant_id`);
    if (!Number.isFinite(round) || round < 1) throw new Error(`Row ${i + 1}: invalid round "${cols[colIndex.round]}"`);
    if (!Number.isFinite(replicate) || replicate < 1) throw new Error(`Row ${i + 1}: invalid replicate "${cols[colIndex.replicate]}"`);
    if (!Number.isFinite(read_count) || read_count < 0) throw new Error(`Row ${i + 1}: invalid read_count "${cols[colIndex.read_count]}"`);

    rows.push({ variant_id, round, replicate, read_count });
    variantSet.add(variant_id);
    roundSet.add(round);
    replicateSet.add(replicate);
  }

  if (rows.length === 0) throw new Error('CSV contains no data rows.');

  return {
    rows,
    variantIds: [...variantSet],
    rounds: [...roundSet].sort((a, b) => a - b),
    replicates: [...replicateSet].sort((a, b) => a - b),
  };
}

/** Derive a family grouping from variant_id prefix (e.g. "M1-A12V" → family "M1"). */
function deriveFamily(variantId: string): { familyId: string; familyLabel: string } {
  const dashIdx = variantId.indexOf('-');
  if (dashIdx > 0) {
    const prefix = variantId.substring(0, dashIdx);
    return { familyId: prefix, familyLabel: `Family ${prefix}` };
  }
  if (variantId === 'WT' || variantId.toLowerCase().startsWith('wt')) {
    return { familyId: 'wt', familyLabel: 'Wild Type' };
  }
  return { familyId: variantId, familyLabel: `Family ${variantId}` };
}

/** Derive mutation string from variant_id (e.g. "M1-A12V" → "A12V", "WT" → ""). */
function deriveMutations(variantId: string): { mutationString: string; mutationBurden: number; mutations: Array<{ position: number; from: string; to: string }> } {
  if (variantId === 'WT' || variantId.toLowerCase().startsWith('wt')) {
    return { mutationString: '', mutationBurden: 0, mutations: [] };
  }
  const dashIdx = variantId.indexOf('-');
  const mutPart = dashIdx > 0 ? variantId.substring(dashIdx + 1) : variantId;
  // Support comma-separated multi-mutations like "A12V,S88A"
  const parts = mutPart.split(',').map((s) => s.trim()).filter(Boolean);
  const mutations: Array<{ position: number; from: string; to: string }> = [];
  const mutationStrings: string[] = [];
  for (const part of parts) {
    const m = part.match(/^([A-Z])(\d+)([A-Z])$/i);
    if (m) {
      mutations.push({ from: m[1].toUpperCase(), position: Number(m[2]), to: m[3].toUpperCase() });
      mutationStrings.push(part);
    } else {
      // If we can't parse it, use the raw string as-is
      mutationStrings.push(part);
    }
  }
  return { mutationString: mutationStrings.join(' / '), mutationBurden: mutations.length || Math.max(parts.length, 1), mutations };
}

function csvToArtifact(parsed: ParsedCSV, targetProduct: string): ProEvolArtifact {
  const { rows, variantIds, rounds, replicates } = parsed;
  const wildTypeId = variantIds.find((id) => id === 'WT' || id.toLowerCase().startsWith('wt')) ?? variantIds[0];

  // Build round structures
  const roundObjs: ProEvolRound[] = rounds.map((roundNum) => {
    const roundLabel = `r${roundNum}`;
    // Sum reads per replicate across all variants for this round
    const totalReadsPerReplicate = replicates.map((repNum) => {
      const replicateId = `rep${repNum}`;
      const total = rows
        .filter((r) => r.round === roundNum && r.replicate === repNum)
        .reduce((sum, r) => sum + r.read_count, 0);
      return { replicateId, reads: total };
    });
    return {
      id: roundLabel,
      number: roundNum,
      label: `Round ${roundNum}`,
      selectionPressure: 'user-supplied',
      reportedSurvivorCount: variantIds.length,
      totalReadsPerReplicate,
    };
  });

  // Build variant structures
  const variants: ProEvolVariant[] = variantIds.map((variantId) => {
    const { familyId, familyLabel } = deriveFamily(variantId);
    const { mutationString, mutationBurden, mutations } = deriveMutations(variantId);

    const observations: ProEvolVariantRoundObservation[] = rounds.map((roundNum) => {
      const replicateIdMap = replicates.map((repNum) => `rep${repNum}`);
      const replicatesData = replicateIdMap.map((replicateId, idx) => {
        const repNum = replicates[idx];
        const matching = rows.find((r) => r.variant_id === variantId && r.round === roundNum && r.replicate === repNum);
        return { replicateId, reads: matching?.read_count ?? 0 };
      });
      const totalReads = replicatesData.reduce((sum, r) => sum + r.reads, 0);
      return { roundId: `r${roundNum}`, replicates: replicatesData, totalReads };
    });

    const isWildType = variantId === wildTypeId;

    return {
      id: variantId,
      label: variantId,
      parentId: isWildType ? null : wildTypeId,
      familyId,
      familyLabel,
      mutations,
      mutationString,
      mutationBurden,
      observations,
      phenotype: {},
      selectionStatus: isWildType ? 'wild-type' : 'unknown',
      riskFlags: [],
    };
  });

  return {
    version: PROEVOL_ARTIFACT_VERSION,
    meta: {
      id: `csv-upload-${Date.now()}`,
      name: 'User CSV Upload',
      targetProtein: targetProduct,
      targetProduct,
      wildTypeId,
      wildTypeLabel: wildTypeId,
      startingSequence: '',
      hostSystem: 'User-supplied',
      screeningSystem: 'User-supplied',
      assayCondition: 'User-supplied',
      selectionPressure: 'User-supplied',
      objective: 'Analyze user-supplied directed evolution data',
      totalRounds: rounds.length,
      librarySizePerRound: variantIds.length,
      selectionStringency: 0.5,
    },
    rounds: roundObjs,
    variants,
    provenance: {
      kind: 'user-supplied',
      validity: 'real',
      bandSemantic: 'measurement',
      isModeled: false,
      source: 'User CSV upload',
      replicateCount: replicates.length,
      statisticalNotes: [
        'Per-replicate read counts supplied by user.',
        'Uncertainty bands represent 95% CIs across biological replicates.',
        'Frequencies use Laplace pseudocount (+1) before normalization.',
      ],
      generatedAt: Date.now(),
    },
  };
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
  const [showParams, setShowParams] = useState(false);

  // ── CSV upload state ────────────────────────────────────────────────────
  const [csvArtifact, setCsvArtifact] = useState<ProEvolArtifact | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('landscape');

  // ── CSV upload handler ──────────────────────────────────────────────────
  const handleCSVUpload = useCallback((file: File) => {
    setIsParsing(true);
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('Failed to read file.');
        const parsed = parseCSV(text);
        const targetProduct = analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product';
        const artifact = csvToArtifact(parsed, targetProduct);
        setCsvArtifact(artifact);
        setUploadFileName(file.name);
        setUploadError(null);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Unknown error parsing CSV.');
        setCsvArtifact(null);
        setUploadFileName(null);
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read file.');
      setIsParsing(false);
    };
    reader.readAsText(file);
  }, [analyzeArtifact?.targetProduct, project?.targetProduct, project?.title]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCSVUpload(file);
    // Reset input so re-uploading the same file triggers onChange
    e.target.value = '';
  }, [handleCSVUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setUploadError('Please upload a .csv file.');
        return;
      }
      handleCSVUpload(file);
    }
  }, [handleCSVUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const clearCSV = useCallback(() => {
    setCsvArtifact(null);
    setUploadError(null);
    setUploadFileName(null);
  }, []);

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

  // Real analysis from CSV data (overrides synthetic when CSV is uploaded)
  const csvResearch = useMemo(
    () => (csvArtifact ? buildProEvolResearchSummary(csvArtifact) : null),
    [csvArtifact],
  );

  // When CSV is present, use real analysis; otherwise use synthetic
  const activeResearch = csvResearch ?? research;
  const activeArtifact = csvArtifact ?? artifact;
  const bandSemantic = activeArtifact.provenance.bandSemantic;

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
        diversityIndex: activeResearch.lastRoundShannon?.mean ?? 0,
        convergenceState: campaign.convergenceSignal.state,
        recommendation: campaign.nextRoundRecommendation.summary,
      },
      updatedAt: Date.now(),
    });
  }, [activeResearch.lastRoundShannon, analyzeArtifact?.id, artifact.provenance.validity, campaign, setToolPayload, targetProduct]);

  // ── Exports ────────────────────────────────────────────────────────────
  const trajectoryExport = useMemo(
    () => activeResearch.trajectories.flatMap((t) => t.points.map((p) => ({
      variantId: t.variantId, variant: t.label, family: t.familyLabel,
      round: p.roundNumber, frequency: p.frequency, bandLower: p.lower, bandUpper: p.upper,
      bandSemantic, totalReads: p.totalReads,
    }))),
    [bandSemantic, activeResearch.trajectories],
  );
  const enrichmentExport = useMemo(
    () => activeResearch.enrichment.map((e) => ({
      variantId: e.variantId, variant: e.label, family: e.familyLabel, mutations: e.mutationString,
      mutationBurden: e.mutationBurden, finalFrequency: e.finalFrequency,
      bandLower: e.finalFrequencyCi.lower, bandUpper: e.finalFrequencyCi.upper, bandSemantic,
      log2EnrichmentVsWildType: e.log2EnrichmentVsWildType,
      log2EnrichmentAcrossRounds: e.log2EnrichmentAcrossRounds,
      meanSelectionCoefficient: e.meanSelectionCoefficient, totalReadsLastRound: e.totalReadsLastRound,
    })),
    [bandSemantic, activeResearch.enrichment],
  );
  const diversityExport = useMemo(
    () => activeResearch.diversity.map((d) => ({
      round: d.roundNumber, shannonBits: d.shannonBits.mean,
      shannonBandLower: d.shannonBits.lower, shannonBandUpper: d.shannonBits.upper,
      topShare: d.topShare.mean, topShareBandLower: d.topShare.lower, topShareBandUpper: d.topShare.upper,
      bandSemantic, effectiveVariantCount: d.effectiveVariantCount, observedVariantCount: d.observedVariantCount,
    })),
    [bandSemantic, activeResearch.diversity],
  );

  const exportSuffix = bandSemantic === 'modeled' ? '-modeled' : '-experiment';
  const lead = campaign.leadVariant;
  const wt = campaign.wildType;

  const tabs: ToolTab[] = [
    { id: 'landscape', label: 'Landscape' },
    { id: 'trajectory', label: 'Trajectory' },
    { id: 'library', label: 'Library' },
    { id: 'lineage', label: 'Lineage' },
    { id: 'campaign', label: 'Campaign' },
  ];

  return (
    <ToolShell
      moduleId="proevol"
      title="Protein Evolution"
      description="Directed evolution campaign management with fitness landscape analysis"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['lineage', 'campaign']}
    >
      {/* ═══════ LANDSCAPE TAB (default) ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="landscape">
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

        <ActivityLandscapePanel campaign={campaign} selectedVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />

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
      </ToolTabPanel>

      {/* ═══════ TRAJECTORY TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="trajectory">
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gap: '12px' }}>
            <ChartShell title="Variant trajectory · top 6" footnote={`Frequencies use Laplace pseudocount (+1). Hover for ${bandSemantic === 'modeled' ? 'model spread' : '95% CI'} range.`}>
              <VariantTrajectoryChart trajectories={activeResearch.topVariants} bandSemantic={bandSemantic} highlightVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />
            </ChartShell>
            <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
              <ChartShell title="Family share · Muller stack">
                <MullerPlot data={activeResearch.familyShares} />
              </ChartShell>
              <ChartShell title="Diversity & convergence">
                <DiversityConvergenceCurve data={activeResearch.diversity} bandSemantic={bandSemantic} />
              </ChartShell>
            </div>
            <ChartShell title="Enrichment vs mutation burden">
              <EnrichmentBurdenScatter entries={activeResearch.enrichment} highlightVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />
            </ChartShell>
          </div>
        </div>
      </ToolTabPanel>

      {/* ═══════ LIBRARY TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="library">
        <div style={{ padding: '16px' }}>
          <VariantLibraryTable roundResult={campaign.currentRoundResult} selectedVariantId={focusedVariant?.id ?? null} onSelectVariant={setSelectedVariantId} />
        </div>
      </ToolTabPanel>

      {/* ═══════ LINEAGE TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="lineage">
        <div style={{ padding: '16px' }}>
          <LineageTracePanel campaign={campaign} selectedVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />
        </div>
      </ToolTabPanel>

      {/* ═══════ CAMPAIGN TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="campaign">
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gap: '12px' }}>
            <EvolutionCampaignContextCard campaign={campaign} totalRounds={totalRounds} librarySize={librarySize} survivorCount={survivorCount} selectionStringency={selectionStringency} onTotalRoundsChange={setTotalRounds} onLibrarySizeChange={setLibrarySize} onSurvivorCountChange={setSurvivorCount} onSelectionStringencyChange={setSelectionStringency} />
            <NextRoundRecommendationCard campaign={campaign} />
          </div>
        </div>
      </ToolTabPanel>
    </ToolShell>
  );
}

/* ── Shared sub-components ──────────────────────────────────────────── */

const kicker: React.CSSProperties = {
  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.label,
  letterSpacing: '0.12em', textTransform: 'uppercase',
};

function SectionKicker({ index, label }: { index: number; label: string }) {
  return (
    <div style={{
      fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.label,
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
      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.label, letterSpacing: '0.08em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: PROEVOL_THEME.value, letterSpacing: '-0.03em' }}>{value}</span>
      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: accent, fontFeatureSettings: "'tnum' 1" }}>{delta}</span>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '5px 8px', borderRadius: 'var(--nb-radius-sm)', border: `1px solid ${PROEVOL_THEME.border}`, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.label, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: PROEVOL_THEME.value, lineHeight: 1.4, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function ChartShell({ title, children, footnote }: { title: string; children: React.ReactNode; footnote?: string }) {
  return (
    <div style={{
      display: 'grid', gap: '8px', padding: '10px 12px', borderRadius: 'var(--nb-radius-md)',
      border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface, minWidth: 0,
    }}>
      <div style={kicker}>{title}</div>
      <div>{children}</div>
      {footnote ? (
        <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.muted, lineHeight: 1.5, paddingTop: '4px', borderTop: `1px dashed ${PROEVOL_THEME.border}` }}>
          {footnote}
        </div>
      ) : null}
    </div>
  );
}
