'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BookMarked, FlaskConical, ShieldAlert, Workflow } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { getDependencyTrace } from '../../config/workbenchGraph';
import { getAuthorityTier } from './workbenchTrust';
import { PATHD_THEME } from './workbenchTheme';
import { tryGetToolContract } from '../../services/workflowRegistry';
import {
  GOLDEN_PATH_TOOL_IDS,
  type ToolId,
} from '../../domain/workflowContract';
import { evaluateToolContract } from '../../services/workflowContractEvaluator';
import type { WorkbenchToolPayloadMap } from '../../store/workbenchPayloads';
import { workflowStatusLabel } from './workflowExperience';
import {
  glassPanel,
  typography,
  iconContainer,
  statusChip,
  cardVariants,
  staggerContainer,
  chipVariants,
  sectionHeaderRow,
  chipRow,
  twoColumnGrid,
  accentLeftBorder,
} from './workbenchDesignSystem';

interface WorkbenchEvidenceTracePanelProps {
  toolId?: string | null;
  title?: string;
}

export default function WorkbenchEvidenceTracePanel({
  toolId = null,
  title = 'Evidence to Result Trace',
}: WorkbenchEvidenceTracePanelProps) {
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const project = useWorkbenchStore((s) => s.project);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const toolPayloads = useWorkbenchStore((s) => s.toolPayloads);
  const workflowControl = useWorkbenchStore((s) => s.workflowControl);

  const gateRow = useMemo(() => {
    if (
      workflowControl.status === 'blocked' ||
      workflowControl.status === 'gated' ||
      workflowControl.status === 'demoOnly'
    ) {
      const tool = workflowControl.nextRecommendedNode ?? workflowControl.currentToolId;
      if (tool) {
        return {
          toolId: tool as ToolId,
          missingPayload: workflowControl.status === 'blocked',
          missingOutputPaths: [] as string[],
          validityShort: workflowControl.validity,
          floor: null,
          simulated: workflowControl.isDemoOnly,
          reason: workflowControl.explanation,
          evidenceShort: workflowControl.missingEvidence.minRequired > workflowControl.missingEvidence.have,
          missingKinds: workflowControl.missingEvidence.kinds,
          minItems: workflowControl.missingEvidence.minRequired,
          haveItems: workflowControl.missingEvidence.have,
        };
      }
    }
    for (const tool of GOLDEN_PATH_TOOL_IDS) {
      const contract = tryGetToolContract(tool);
      if (!contract) continue;
      const payload = toolPayloads[tool as keyof WorkbenchToolPayloadMap];
      const evaluation = evaluateToolContract(contract, payload, {
        evidence: evidenceItems.map((item) => ({ sourceKind: item.sourceKind })),
        projectIsDemo: Boolean(project?.isDemo),
      });
      if (
        !evaluation.status.hasRequiredOutputs ||
        !evaluation.validityOk ||
        !evaluation.confidenceOk ||
        !evaluation.uncertaintyOk ||
        evaluation.isSimulated
      ) {
        const evidenceShort =
          contract.evidenceRequired.minItems > evidenceItems.length;
        const haveKinds = new Set(evidenceItems.map((e) => e.sourceKind));
        const missingKinds = contract.evidenceRequired.kinds.filter((k) => !haveKinds.has(k));
        return {
          toolId: tool as ToolId,
          missingPayload: !evaluation.status.hasRequiredOutputs,
          missingOutputPaths: evaluation.missingOutputPaths,
          validityShort: evaluation.status.hasRequiredOutputs && !evaluation.validityOk ? evaluation.status.validity : null,
          floor: contract.validityBaseline.floor,
          simulated: evaluation.isSimulated,
          reason: evaluation.reason,
          evidenceShort,
          missingKinds,
          minItems: contract.evidenceRequired.minItems,
          haveItems: evidenceItems.length,
        };
      }
    }
    return null;
  }, [evidenceItems, project?.isDemo, toolPayloads, workflowControl]);

  const evidenceTrace = useMemo(() => {
    const traceIds = analyzeArtifact?.evidenceTraceIds?.length ? analyzeArtifact.evidenceTraceIds : selectedEvidenceIds;
    return evidenceItems.filter((item) => traceIds.includes(item.id)).slice(0, 3);
  }, [analyzeArtifact?.evidenceTraceIds, evidenceItems, selectedEvidenceIds]);

  const executionTrace = useMemo(() => {
    const traceToolIds = toolId ? getDependencyTrace(toolId) : analyzeArtifact?.recommendedNextTools ?? [];
    const orderedToolIds = traceToolIds.length
      ? traceToolIds
      : runArtifacts.slice(0, 4).map((artifact) => artifact.toolId);
    const uniqueToolIds = Array.from(new Set(orderedToolIds));

    return uniqueToolIds.slice(0, 5).map((id) => ({
      toolId: id,
      tool: TOOL_BY_ID[id],
      run: runArtifacts.find((artifact) => artifact.toolId === id),
    }));
  }, [analyzeArtifact?.recommendedNextTools, runArtifacts, toolId]);
  const latestRun = runArtifacts[0] ?? null;

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      style={{ display: 'grid', gap: '12px' }}
    >
      {/* Section Header */}
      <motion.div variants={cardVariants} style={sectionHeaderRow}>
        <span style={iconContainer(PATHD_THEME.lilac, 20)}>
          <BookMarked size={11} color={PATHD_THEME.lilac} />
        </span>
        <span style={typography.sectionTitle}>{title}</span>
      </motion.div>

      {/* Gate Row */}
      {gateRow && <GateRowCard gateRow={gateRow} />}

      {/* Decision Ledger Fields */}
      <DecisionLedgerFieldsCard
        workflowControl={workflowControl}
        latestRun={latestRun}
        evidenceTrace={evidenceTrace}
      />

      {/* Three-column layout */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={twoColumnGrid}>
        <EvidenceBundleCard evidenceTrace={evidenceTrace} />
        <AnalyzeArtifactCard artifact={analyzeArtifact} />
        <ExecutionTraceCard trace={executionTrace} />
      </motion.div>
    </motion.section>
  );
}

function GateRowCard({
  gateRow,
}: {
  gateRow: {
    toolId: string;
    missingPayload: boolean;
    validityShort: string | null;
    floor: string | null;
    simulated: boolean;
    reason: string;
    evidenceShort: boolean;
    missingKinds: string[];
    minItems: number;
    haveItems: number;
  };
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...glassPanel,
        ...accentLeftBorder(PATHD_THEME.apricot, 3),
        borderColor: hovered ? 'rgba(255, 255, 255, 0.12)' : glassPanel.borderColor,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={iconContainer(PATHD_THEME.apricot, 20)}>
          <ShieldAlert size={11} color={PATHD_THEME.apricot} />
        </span>
        <span style={typography.label}>Next step needs:</span>
        <span style={{ ...typography.caption, color: PATHD_THEME.sky }}>
          {gateRow.toolId.toUpperCase()}
        </span>
      </div>
      <div style={typography.body}>
        {gateRow.missingPayload && `Run ${gateRow.toolId.toUpperCase()} to publish required outputs.`}
        {!gateRow.missingPayload && gateRow.validityShort && gateRow.floor && (
          <>Upgrade {gateRow.toolId.toUpperCase()} validity from {gateRow.validityShort} to {gateRow.floor}.</>
        )}
        {!gateRow.missingPayload && (!gateRow.validityShort || !gateRow.floor) && gateRow.simulated && (
          <>Demo/simulated output cannot satisfy closed-loop execution.</>
        )}
        {!gateRow.missingPayload && (!gateRow.validityShort || !gateRow.floor) && !gateRow.simulated && gateRow.reason}
      </div>
      {gateRow.evidenceShort && (
        <div style={typography.caption}>
          evidence · {gateRow.haveItems}/{gateRow.minItems}
          {gateRow.missingKinds.length > 0 && ` · missing ${gateRow.missingKinds.join(', ')}`}
        </div>
      )}
    </motion.div>
  );
}

function DecisionLedgerFieldsCard({
  workflowControl,
  latestRun,
  evidenceTrace,
}: {
  workflowControl: {
    status: string;
    confidence: number | null;
    uncertainty: number | null;
    humanGateRequired: boolean;
    nextRecommendedNode: string | null;
    isDemoOnly: boolean;
  };
  latestRun: { toolId: string; status?: string | null; isSimulated: boolean } | null;
  evidenceTrace: { title: string }[];
}) {
  return (
    <motion.div variants={cardVariants} style={glassPanel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={iconContainer(PATHD_THEME.mint, 20)}>
          <Workflow size={11} color={PATHD_THEME.mint} />
        </span>
        <span style={typography.label}>Decision ledger fields</span>
        <span style={typography.caption}>{workflowStatusLabel(workflowControl.status)}</span>
      </div>
      <div style={{ display: 'grid', gap: '3px' }}>
        <LedgerFieldRow
          label="artifact"
          value={latestRun ? `${latestRun.toolId.toUpperCase()} ${workflowStatusLabel(latestRun.status ?? (latestRun.isSimulated ? 'demoOnly' : 'ok'))}` : 'none'}
        />
        <LedgerFieldRow
          label="evidence used"
          value={evidenceTrace.length ? evidenceTrace.map((item) => item.title).join(' / ') : 'none selected'}
        />
        <LedgerFieldRow
          label="confidence"
          value={workflowControl.confidence === null ? 'unknown' : workflowControl.confidence.toFixed(2)}
        />
        <LedgerFieldRow
          label="uncertainty"
          value={workflowControl.uncertainty === null ? 'unknown' : workflowControl.uncertainty.toFixed(2)}
        />
        <LedgerFieldRow
          label="human gate"
          value={workflowControl.humanGateRequired ? 'required' : 'not required'}
        />
        <LedgerFieldRow
          label="next recommended"
          value={workflowControl.nextRecommendedNode?.toUpperCase() ?? 'none'}
        />
        <LedgerFieldRow
          label="demo/simulated"
          value={workflowControl.isDemoOnly ? 'yes' : 'no'}
        />
      </div>
    </motion.div>
  );
}

function LedgerFieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
      <span style={{ ...typography.caption, minWidth: '100px', flexShrink: 0, opacity: 0.7 }}>
        {label}
      </span>
      <span style={{ ...typography.caption, color: PATHD_THEME.value }}>
        {value}
      </span>
    </div>
  );
}

function EvidenceBundleCard({
  evidenceTrace,
}: {
  evidenceTrace: { title: string }[];
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...glassPanel,
        borderColor: hovered ? 'rgba(255, 255, 255, 0.12)' : glassPanel.borderColor,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={iconContainer(PATHD_THEME.sky, 20)}>
          <BookMarked size={11} color={PATHD_THEME.sky} />
        </span>
        <span style={typography.label}>Evidence Bundle</span>
      </div>
      <div style={typography.body}>
        {evidenceTrace.length
          ? evidenceTrace.map((item) => item.title).join(' · ')
          : 'No evidence bundle has been attached yet.'}
      </div>
    </motion.div>
  );
}

function AnalyzeArtifactCard({
  artifact,
}: {
  artifact: {
    targetProduct?: string;
    bottleneckAssumptions: { label: string }[];
    pathwayCandidates: unknown[];
  } | null;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...glassPanel,
        borderColor: hovered ? 'rgba(255, 255, 255, 0.12)' : glassPanel.borderColor,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={iconContainer(PATHD_THEME.lilac, 20)}>
          <FlaskConical size={11} color={PATHD_THEME.lilac} />
        </span>
        <span style={typography.label}>Analyze Artifact</span>
      </div>
      <div style={{ ...typography.cardTitle }}>
        {artifact?.targetProduct ?? 'Pending'}
      </div>
      <div style={typography.body}>
        {artifact
          ? `${artifact.bottleneckAssumptions[0]?.label ?? 'No leading bottleneck'} · ${artifact.pathwayCandidates.length || 1} route(s)`
          : 'Run Analyze to create a structured handoff object.'}
      </div>
    </motion.div>
  );
}

function ExecutionTraceCard({
  trace,
}: {
  trace: {
    toolId: string;
    tool: { shortLabel?: string; name?: string } | undefined;
    run: { isSimulated: boolean; summary?: string } | undefined;
  }[];
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...glassPanel,
        borderColor: hovered ? 'rgba(255, 255, 255, 0.12)' : glassPanel.borderColor,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={iconContainer(PATHD_THEME.apricot, 20)}>
          <Workflow size={11} color={PATHD_THEME.apricot} />
        </span>
        <span style={typography.label}>Execution Trace</span>
      </div>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        style={chipRow}
      >
        {trace.length ? trace.map((entry, index) => (
          <span key={`${entry.toolId}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <motion.span
              variants={chipVariants}
              style={{
                ...statusChip.base,
                border: `1px solid ${entry.run ? PATHD_THEME.chipBorder : 'rgba(255, 255, 255, 0.08)'}`,
                background: entry.run ? PATHD_THEME.chipCool : PATHD_THEME.chipNeutral,
                color: PATHD_THEME.value,
              }}
            >
              {entry.tool?.shortLabel ?? entry.toolId.toUpperCase()}
            </motion.span>
            {entry.run && (
              <motion.span
                variants={chipVariants}
                style={statusChip.neutral}
              >
                {getAuthorityTier(entry.run as Parameters<typeof getAuthorityTier>[0])}
              </motion.span>
            )}
            {index < trace.length - 1 && <ArrowRight size={12} color={PATHD_THEME.apricot} />}
          </span>
        )) : (
          <div style={typography.body}>No execution trace has been formed yet.</div>
        )}
      </motion.div>
      <div style={typography.body}>
        {trace.find((entry) => entry.run)?.run?.summary ?? 'Execute a tool to create a result trace.'}
      </div>
    </motion.div>
  );
}
