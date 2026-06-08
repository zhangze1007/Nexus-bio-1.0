'use client';

import Link from 'next/link';
import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Compass, ShieldCheck, WandSparkles, Workflow } from 'lucide-react';
import { getProvenanceChainDiagnostics } from '../../services/provenanceMiddleware';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { getFreshnessMap, getAuthoritySummary, getAuthorityTier, getToolFreshness } from './workbenchTrust';
import { workflowStatusLabel } from './workflowExperience';
import {
  glassPanel,
  glassPanelInset,
  typography,
  iconContainer,
  statusChip,
  cardVariants,
  staggerContainer,
  chipVariants,
  sectionHeaderRow,
  accentLeftBorder,
  statusAccent,
} from './workbenchDesignSystem';
import { THEME } from '../../theme';

interface WorkbenchDecisionTracePanelProps {
  toolId?: string | null;
  title?: string;
  limit?: number;
}

function statusColor(status: string): string {
  switch (status) {
    case 'complete': return THEME.MINT;
    case 'ready': return THEME.SKY;
    case 'blocked': return THEME.CORAL;
    case 'gated': return THEME.APRICOT;
    case 'demoOnly': return THEME.APRICOT;
    case 'idle':
    default: return THEME.LABEL;
  }
}

export default function WorkbenchDecisionTracePanel({
  toolId = null,
  title = 'Decision Trace',
  limit = 3,
}: WorkbenchDecisionTracePanelProps) {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const nextRecommendations = useWorkbenchStore((s) => s.nextRecommendations);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const workflowDecision = useWorkbenchStore((s) => s.workflowControl);

  const activeRun = useMemo(
    () => (toolId ? runArtifacts.find((artifact) => artifact.toolId === toolId) : runArtifacts[0] ?? null),
    [runArtifacts, toolId],
  );
  const freshness = useMemo(
    () => getToolFreshness(runArtifacts, toolId, { project, analyzeArtifact }),
    [analyzeArtifact, project, runArtifacts, toolId],
  );

  const recommendations = useMemo(() => nextRecommendations.slice(0, limit), [limit, nextRecommendations]);
  const ledgerRuns = useMemo(() => runArtifacts.slice(0, limit), [limit, runArtifacts]);
  const recommendationFreshness = useMemo(
    () => getFreshnessMap(runArtifacts, recommendations.map((item) => item.toolId), { project, analyzeArtifact }),
    [analyzeArtifact, project, recommendations, runArtifacts],
  );

  const rationale = useMemo(() => {
    const lines: string[] = [];
    if (analyzeArtifact?.bottleneckAssumptions[0]) {
      lines.push(`Analyze flagged ${analyzeArtifact.bottleneckAssumptions[0].label} as the leading bottleneck`);
    }
    if (activeRun) {
      lines.push(activeRun.summary);
      lines.push(getAuthoritySummary(getAuthorityTier(activeRun)));
    }
    if (dbtlPayload?.feedbackSource === 'committed') {
      lines.push(`Committed DBTL feedback is active: ${dbtlPayload.result.passRate.toFixed(0)}% pass rate at ${dbtlPayload.result.latestPhase}`);
    }
    if (!lines.length && project) {
      lines.push(`Project context is active for ${project.targetProduct}`);
    }
    return lines.slice(0, 4);
  }, [activeRun, analyzeArtifact?.bottleneckAssumptions, dbtlPayload, project]);

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      style={{ display: 'grid', gap: '12px' }}
    >
      {/* Section Header */}
      <motion.div variants={cardVariants} style={sectionHeaderRow}>
        <span style={iconContainer(THEME.SKY, 20)}>
          <Compass size={11} color={THEME.SKY} />
        </span>
        <span style={typography.sectionTitle}>{title}</span>
      </motion.div>

      {/* Workflow State Card */}
      <WorkflowStateCard decision={workflowDecision} />

      {/* Decision Basis Card */}
      <DecisionBasisCard rationale={rationale} toolId={toolId} freshness={freshness} />

      {/* DBTL Decision Ledger Card */}
      <DBTLLedgerCard runs={ledgerRuns} decision={workflowDecision} />

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'grid', gap: '12px' }}>
          {recommendations.map((recommendation) => {
            const tool = TOOL_BY_ID[recommendation.toolId];
            if (!tool) return null;
            const targetFreshness = recommendationFreshness[recommendation.toolId];
            return (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                tool={tool}
                freshness={targetFreshness}
              />
            );
          })}
        </motion.div>
      )}

      {!recommendations.length && (
        <motion.div variants={cardVariants} style={{ ...typography.body, padding: '4px 0' }}>
          No downstream decision trace yet. Run Analyze or a stage tool to generate explicit next-step logic.
        </motion.div>
      )}
    </motion.section>
  );
}

function WorkflowStateCard({
  decision,
}: {
  decision: { status: string; explanation: string; humanGateRequired: boolean; nextNodeIsContractOnly: boolean; currentToolId: string | null; nextRecommendedNode: string | null; confidence: number | null; validity: string | null; missingEvidence: { minRequired: number; have: number } };
}) {
  const accent = statusColor(decision.status);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...glassPanel,
        ...accentLeftBorder(accent, 3),
        borderColor: hovered ? 'rgba(255, 255, 255, 0.12)' : glassPanel.borderColor,
      }}
    >
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={iconContainer(accent, 22)}>
          <Workflow size={12} color={accent} />
        </span>
        <span style={typography.label}>Workflow state</span>
        <motion.span
          variants={chipVariants}
          style={{
            ...statusChip.base,
            border: `1px solid ${accent}44`,
            background: `${accent}18`,
            color: accent,
            fontSize: '11px',
            padding: '4px 12px',
          }}
        >
          {decision.status}
        </motion.span>
        {decision.humanGateRequired && (
          <span style={{ ...typography.caption, color: THEME.APRICOT }}>human gate required</span>
        )}
        {decision.nextNodeIsContractOnly && (
          <span style={typography.caption}>next: contract-only</span>
        )}
      </div>

      {/* Explanation */}
      <div style={typography.body}>{decision.explanation}</div>

      {/* Metrics row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        {decision.currentToolId && (
          <span style={typography.caption}>current · {decision.currentToolId.toUpperCase()}</span>
        )}
        {decision.nextRecommendedNode && (
          <span style={typography.caption}>next · {decision.nextRecommendedNode.toUpperCase()}</span>
        )}
        {decision.confidence !== null && (
          <span style={typography.caption}>conf · {decision.confidence.toFixed(2)}</span>
        )}
        {decision.validity && (
          <span style={typography.caption}>validity · {decision.validity}</span>
        )}
        {decision.missingEvidence.minRequired > 0 && (
          <span style={typography.caption}>
            evidence · {decision.missingEvidence.have}/{decision.missingEvidence.minRequired}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function DecisionBasisCard({
  rationale,
  toolId,
  freshness,
}: {
  rationale: string[];
  toolId: string | null;
  freshness: { status: string };
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...glassPanel,
        ...accentLeftBorder(THEME.APRICOT, 2),
        borderColor: hovered ? 'rgba(255, 255, 255, 0.12)' : glassPanel.borderColor,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={iconContainer(THEME.APRICOT, 20)}>
          <ShieldCheck size={11} color={THEME.APRICOT} />
        </span>
        <span style={typography.label}>Current decision basis</span>
        {toolId && (
          <span style={typography.caption}>{freshness.status}</span>
        )}
      </div>
      {rationale.length ? rationale.map((line) => (
        <div key={line} style={typography.body}>{line}</div>
      )) : (
        <div style={typography.body}>
          Analyze artifacts, run outputs, and DBTL feedback will accumulate here as an explicit decision chain.
        </div>
      )}
    </motion.div>
  );
}

function DBTLLedgerCard({
  runs,
  decision,
}: {
  runs: { id: string; toolId: string; summary: string; status?: string | null; isSimulated: boolean; confidence?: number | null; uncertainty?: number | null; validity?: string | null; humanGateRequired?: boolean; iteration?: number | null; payloadSnapshot: unknown; evidenceSnapshot?: { count?: number; status?: string; missingEvidence?: { minRequired?: number } } | null }[];
  decision: { missingEvidence: { have: number }; confidence: number | null; uncertainty: number | null; validity: string | null; humanGateRequired: boolean; nextRecommendedNode: string | null; latestRunToolId: string | null };
}) {
  return (
    <motion.div variants={cardVariants} style={glassPanel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={iconContainer(THEME.MINT, 20)}>
          <ShieldCheck size={11} color={THEME.MINT} />
        </span>
        <span style={typography.label}>DBTL decision ledger</span>
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {runs.length ? runs.map((run) => (
          <LedgerEntry key={run.id} run={run} decision={decision} />
        )) : (
          <div style={typography.body}>
            Run PATHD to create the first auditable DBTL decision artifact.
          </div>
        )}
      </div>
    </motion.div>
  );
}

function LedgerEntry({
  run,
  decision,
}: {
  run: { id: string; toolId: string; summary: string; status?: string | null; isSimulated: boolean; confidence?: number | null; uncertainty?: number | null; validity?: string | null; humanGateRequired?: boolean; iteration?: number | null; payloadSnapshot: unknown; evidenceSnapshot?: { count?: number; status?: string; missingEvidence?: { minRequired?: number } } | null };
  decision: { missingEvidence: { have: number }; confidence: number | null; uncertainty: number | null; validity: string | null; humanGateRequired: boolean; nextRecommendedNode: string | null; latestRunToolId: string | null };
}) {
  const provenanceDiagnostics = getProvenanceChainDiagnostics(run.payloadSnapshot);
  const statusLabel = workflowStatusLabel(run.status ?? (run.isSimulated ? 'demoOnly' : 'ok'));
  const accent = statusAccent(run.status ?? (run.isSimulated ? 'demoOnly' : 'ok'));

  return (
    <motion.div
      variants={cardVariants}
      style={{
        ...glassPanelInset,
        ...accentLeftBorder(accent, 2),
        padding: '10px 12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <span style={typography.cardTitle}>{run.toolId.toUpperCase()} artifact generated</span>
        <span style={{ ...typography.caption, color: accent }}>{statusLabel}</span>
      </div>
      <div style={typography.body}>{run.summary}</div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <span style={typography.caption}>
          evidence · {(() => {
            const ev = run.evidenceSnapshot;
            if (ev) {
              const count = ev.count ?? 0;
              const min = ev.missingEvidence?.minRequired ?? 0;
              const status = ev.status ?? '';
              return min > 0 ? `${count}/${min}${status ? ` · ${status}` : ''}` : `${count}`;
            }
            return decision.missingEvidence.have;
          })()}
        </span>
        <span style={typography.caption}>
          confidence · {run.confidence !== undefined && run.confidence !== null ? run.confidence.toFixed(2) : decision.latestRunToolId === run.toolId && decision.confidence !== null ? decision.confidence.toFixed(2) : 'n/a'}
        </span>
        <span style={typography.caption}>
          uncertainty · {run.uncertainty !== undefined && run.uncertainty !== null ? run.uncertainty.toFixed(2) : decision.latestRunToolId === run.toolId && decision.uncertainty !== null ? decision.uncertainty.toFixed(2) : 'unknown'}
        </span>
        <span style={typography.caption}>
          validity · {run.validity ?? (decision.latestRunToolId === run.toolId ? decision.validity ?? 'n/a' : 'n/a')}
        </span>
        <span style={typography.caption}>
          human gate · {run.humanGateRequired ?? (decision.latestRunToolId === run.toolId ? decision.humanGateRequired : false) ? 'yes' : 'no'}
        </span>
        <span style={typography.caption}>iteration · {run.iteration ?? 'n/a'}</span>
        <span style={typography.caption}>next · {decision.nextRecommendedNode?.toUpperCase() ?? 'none'}</span>
        <span style={typography.caption}>provenance · {provenanceDiagnostics.chainLength > 0 ? 'present' : 'missing'}</span>
        <span style={typography.caption}>chain · {provenanceDiagnostics.chainLength}</span>
        {provenanceDiagnostics.hasMissingUpstream && (
          <span style={typography.caption}>missing upstream · {provenanceDiagnostics.missingUpstreamProvenanceIds.length}</span>
        )}
      </div>
    </motion.div>
  );
}

function RecommendationCard({
  recommendation,
  tool,
  freshness,
}: {
  recommendation: { id: string; toolId: string; source: string; reason: string };
  tool: { name: string; href: string };
  freshness: { status: string; summary: string } | undefined;
}) {
  const [hovered, setHovered] = useState(false);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  return (
    <motion.div variants={cardVariants} whileHover="hover">
      <Link
        href={tool.href}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          ...glassPanel,
          textDecoration: 'none',
          borderColor: hovered ? 'rgba(255, 255, 255, 0.14)' : glassPanel.borderColor,
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          boxShadow: hovered
            ? '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)'
            : 'none',
          transition: 'border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={iconContainer(THEME.LILAC, 20)}>
              <WandSparkles size={11} color={THEME.LILAC} />
            </span>
            <span style={typography.label}>{tool.name}</span>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', ...typography.caption }}>
            {recommendation.source}
            <ArrowUpRight size={11} />
          </span>
        </div>
        <div style={typography.body}>{recommendation.reason}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <motion.span variants={chipVariants} style={statusChip.neutral}>
            {freshness?.status ?? 'not-run'}
          </motion.span>
          <span style={typography.body}>
            {freshness?.summary ?? 'No execution integrity signal yet.'}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
