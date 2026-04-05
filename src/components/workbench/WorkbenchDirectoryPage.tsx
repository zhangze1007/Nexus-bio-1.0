'use client';

import Link from 'next/link';
import { ArrowUpRight, Beaker, Layers3, Microscope } from 'lucide-react';
import { T } from '../ide/tokens';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { CROSS_STAGE_TOOL_IDS, WORKBENCH_STAGES } from '../tools/shared/workbenchConfig';
import { useWorkbenchStore } from '../../store/workbenchStore';
import WorkbenchAuditTimeline from './WorkbenchAuditTimeline';
import WorkbenchDecisionTracePanel from './WorkbenchDecisionTracePanel';
import WorkbenchEvidenceTracePanel from './WorkbenchEvidenceTracePanel';
import WorkbenchExperimentLedger from './WorkbenchExperimentLedger';
import WorkbenchProjectTimeline from './WorkbenchProjectTimeline';
import WorkbenchRunCompare from './WorkbenchRunCompare';
import { getFreshnessMap } from './workbenchTrust';

const BORDER = 'rgba(255,255,255,0.08)';
const LABEL = 'rgba(255,255,255,0.45)';
const VALUE = 'rgba(255,255,255,0.9)';

export default function WorkbenchDirectoryPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const checkpoints = useWorkbenchStore((s) => s.checkpoints);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const backendMeta = useWorkbenchStore((s) => s.backendMeta);
  const collaborators = useWorkbenchStore((s) => s.collaborators);
  const experimentRecords = useWorkbenchStore((s) => s.experimentRecords);
  const syncStatus = useWorkbenchStore((s) => s.syncStatus);
  const lastServerSyncAt = useWorkbenchStore((s) => s.lastServerSyncAt);
  const freshnessByTool = getFreshnessMap(
    runArtifacts,
    WORKBENCH_STAGES.flatMap((stage) => stage.toolIds).concat(...CROSS_STAGE_TOOL_IDS),
    { project, analyzeArtifact },
  );

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#05070b', color: VALUE }}>
      <main style={{ padding: '32px 18px 40px' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'grid', gap: '20px' }}>
          <section
            style={{
              borderRadius: '28px',
              border: `1px solid ${BORDER}`,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
              padding: '24px',
              display: 'grid',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: '6px' }}>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  Synthetic Biology Workbench
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '34px', fontWeight: 700, letterSpacing: '-0.04em', color: VALUE }}>
                  Four-stage scientific workflow
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '14px', color: LABEL, maxWidth: '72ch', lineHeight: 1.7 }}>
                  Nexus-Bio now treats Research, Analyze, and Tools as a continuous project system. Start with evidence, generate a structured pathway object, then move through simulation, control, and iterative validation without resetting context.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <Link
                  href="/research"
                  style={{
                    minHeight: '38px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    textDecoration: 'none',
                    border: `1px solid ${BORDER}`,
                    background: 'rgba(255,255,255,0.04)',
                    color: VALUE,
                    fontFamily: T.SANS,
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <Microscope size={14} />
                  Research Intake
                </Link>
                <Link
                  href="/analyze"
                  style={{
                    minHeight: '38px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    textDecoration: 'none',
                    border: `1px solid ${BORDER}`,
                    background: 'rgba(255,255,255,0.04)',
                    color: VALUE,
                    fontFamily: T.SANS,
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <Beaker size={14} />
                  Analyze Artifact
                </Link>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '12px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              {[
                {
                  label: 'Current Project',
                  value: project?.title ?? 'No project context yet',
                  detail: project?.isDemo ? 'Demo fallback is active' : project?.summary ?? 'Save evidence in Research to seed a project.',
                },
                {
                  label: 'Evidence Bundle',
                  value: `${selectedEvidenceIds.length} selected`,
                  detail: selectedEvidenceIds.length ? 'Selected evidence is ready for Analyze.' : 'Nothing selected yet.',
                },
                {
                  label: 'Analyze Artifact',
                  value: analyzeArtifact ? analyzeArtifact.targetProduct : 'Pending',
                  detail: analyzeArtifact
                    ? `${analyzeArtifact.nodes.length} nodes · ${analyzeArtifact.bottleneckAssumptions.length} bottleneck assumptions`
                    : 'Run Analyze to create a structured handoff package.',
                },
                {
                  label: 'Stage Progress',
                  value: `${checkpoints.filter((item) => item.status !== 'pending').length}/4 active`,
                  detail: checkpoints.map((item) => `${item.id.replace('stage-', 'S')}:${item.status}`).join(' · '),
                },
                {
                  label: 'Canonical State',
                  value: syncStatus === 'saving' ? 'Syncing' : syncStatus === 'error' ? 'Attention' : 'Tracked',
                  detail: lastServerSyncAt
                    ? `${backendMeta?.runArtifactCount ?? runArtifacts.length} immutable runs · ${backendMeta?.experimentCount ?? experimentRecords.length} experiment records · synced ${new Date(lastServerSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : `${backendMeta?.runArtifactCount ?? runArtifacts.length} immutable runs · ${backendMeta?.memberCount ?? collaborators.length} collaborators tracked in canonical DB.`,
                },
                {
                  label: 'Collaboration Scope',
                  value: `${collaborators.length} actor(s)`,
                  detail: collaborators.length
                    ? collaborators.slice(0, 3).map((entry) => `${entry.displayName} (${entry.role})`).join(' · ')
                    : 'Project scope is ready for multiple actors; new sessions auto-register into the canonical project ledger.',
                },
                {
                  label: 'Experiment Ledger',
                  value: `${experimentRecords.length} records`,
                  detail: experimentRecords.length
                    ? `${experimentRecords[0].toolId.toUpperCase()} · ${experimentRecords[0].authorityTier} · ${experimentRecords[0].status}`
                    : 'Stage 4 records will appear here as immutable experiment and analysis entries.',
                },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    borderRadius: '18px',
                    border: `1px solid ${BORDER}`,
                    background: 'rgba(255,255,255,0.03)',
                    padding: '14px 16px',
                    display: 'grid',
                    gap: '6px',
                  }}
                >
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {card.label}
                  </div>
                  <div style={{ fontFamily: T.SANS, fontSize: '16px', fontWeight: 700, color: VALUE }}>
                    {card.value}
                  </div>
                  <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.55 }}>
                    {card.detail}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div style={{ display: 'grid', gap: '14px' }}>
            {WORKBENCH_STAGES.map((stage) => (
              <section
                key={stage.id}
                style={{
                  borderRadius: '24px',
                  border: `1px solid ${stage.accent}30`,
                  background: `linear-gradient(135deg, ${stage.accent}10, rgba(255,255,255,0.02))`,
                  padding: '18px',
                  display: 'grid',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '4px 9px',
                        borderRadius: '999px',
                        border: `1px solid ${stage.accent}55`,
                        background: `${stage.accent}18`,
                        color: VALUE,
                        fontFamily: T.MONO,
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {stage.shortLabel}
                    </span>
                    <span style={{ fontFamily: T.SANS, fontSize: '20px', fontWeight: 700, color: VALUE, letterSpacing: '-0.02em' }}>
                      {stage.label}
                    </span>
                    <span
                      style={{
                        padding: '4px 9px',
                        borderRadius: '999px',
                        border: `1px solid ${BORDER}`,
                        background: 'rgba(255,255,255,0.05)',
                        color: LABEL,
                        fontFamily: T.MONO,
                        fontSize: '10px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {runArtifacts.filter((artifact) => artifact.stageId === stage.id).length} recorded runs
                    </span>
                    <span
                      style={{
                        padding: '4px 9px',
                        borderRadius: '999px',
                        border: `1px solid ${BORDER}`,
                        background: 'rgba(255,255,255,0.05)',
                        color: LABEL,
                        fontFamily: T.MONO,
                        fontSize: '10px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {stage.toolIds.filter((toolId) => freshnessByTool[toolId]?.status === 'fresh').length} fresh · {stage.toolIds.filter((toolId) => freshnessByTool[toolId]?.status === 'stale').length} stale
                    </span>
                  </div>
                  <div style={{ fontFamily: T.SANS, fontSize: '13px', color: LABEL, maxWidth: '80ch', lineHeight: 1.65 }}>
                    {stage.description}
                  </div>
                </div>

                {stage.entryRoutes && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {stage.entryRoutes.map((entry) => (
                      <Link
                        key={entry.href}
                        href={entry.href}
                        style={{
                          minHeight: '34px',
                          padding: '0 12px',
                          borderRadius: '999px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          textDecoration: 'none',
                          border: `1px solid ${BORDER}`,
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(255,255,255,0.78)',
                          fontFamily: T.SANS,
                          fontSize: '12px',
                        }}
                      >
                        {entry.label}
                        <ArrowUpRight size={12} />
                      </Link>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gap: '12px',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  }}
                >
                  {stage.toolIds.map((toolId) => {
                    const tool = TOOL_BY_ID[toolId];
                    if (!tool) return null;
                    return (
                      <Link
                        key={tool.id}
                        href={tool.href}
                        style={{
                          borderRadius: '18px',
                          border: `1px solid ${BORDER}`,
                          background: 'rgba(255,255,255,0.04)',
                          padding: '14px 15px',
                          display: 'grid',
                          gap: '8px',
                          textDecoration: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {tool.shortLabel}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                padding: '3px 7px',
                                borderRadius: '999px',
                                border: `1px solid ${
                                  freshnessByTool[tool.id]?.status === 'fresh'
                                    ? 'rgba(158,215,199,0.24)'
                                    : freshnessByTool[tool.id]?.status === 'stale'
                                      ? 'rgba(255,192,128,0.28)'
                                      : BORDER
                                }`,
                                background:
                                  freshnessByTool[tool.id]?.status === 'fresh'
                                    ? 'rgba(158,215,199,0.10)'
                                    : freshnessByTool[tool.id]?.status === 'stale'
                                      ? 'rgba(255,192,128,0.12)'
                                      : 'rgba(255,255,255,0.04)',
                                color:
                                  freshnessByTool[tool.id]?.status === 'fresh'
                                    ? 'rgba(224,244,238,0.92)'
                                    : freshnessByTool[tool.id]?.status === 'stale'
                                      ? 'rgba(255,226,186,0.92)'
                                      : 'rgba(255,255,255,0.62)',
                                fontFamily: T.MONO,
                                fontSize: '10px',
                                textTransform: 'uppercase',
                              }}
                            >
                              {freshnessByTool[tool.id]?.status ?? 'not-run'}
                            </span>
                            <ArrowUpRight size={13} color="rgba(255,255,255,0.5)" />
                          </div>
                        </div>
                        <div style={{ fontFamily: T.SANS, fontSize: '14px', fontWeight: 700, color: VALUE }}>
                          {tool.name}
                        </div>
                        <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
                          {tool.focus}
                        </div>
                        <div style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.55 }}>
                          {freshnessByTool[tool.id]?.summary ?? 'No execution integrity signal yet.'}
                        </div>
                        <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                          {tool.outputs.slice(0, 2).join(' · ')}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <section
            style={{
              borderRadius: '24px',
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.03)',
              padding: '18px',
              display: 'grid',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers3 size={16} color="rgba(255,255,255,0.7)" />
              <div style={{ fontFamily: T.SANS, fontSize: '18px', fontWeight: 700, color: VALUE }}>
                Cross-stage intelligence
              </div>
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '13px', color: LABEL, lineHeight: 1.7 }}>
              The AI agent remains available as a cross-workbench layer for synthesis, routing, and evidence interpretation.
            </div>
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {CROSS_STAGE_TOOL_IDS.map((toolId) => {
                const tool = TOOL_BY_ID[toolId];
                if (!tool) return null;
                return (
                  <Link
                    key={tool.id}
                    href={tool.href}
                    style={{
                      borderRadius: '18px',
                      border: `1px solid ${BORDER}`,
                      background: 'rgba(255,255,255,0.04)',
                      padding: '14px 15px',
                      display: 'grid',
                      gap: '8px',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {tool.shortLabel}
                    </div>
                    <div style={{ fontFamily: T.SANS, fontSize: '14px', fontWeight: 700, color: VALUE }}>
                      {tool.name}
                    </div>
                    <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
                      {tool.summary}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section
            style={{
              borderRadius: '24px',
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.03)',
              padding: '18px',
              display: 'grid',
              gap: '16px',
            }}
          >
            <div style={{ display: 'grid', gap: '6px' }}>
              <div style={{ fontFamily: T.SANS, fontSize: '18px', fontWeight: 700, color: VALUE }}>
                Trust & Audit Layer
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '13px', color: LABEL, lineHeight: 1.7 }}>
                Canonical database sync, evidence traceability, and immutable run history now sit inside the workbench itself instead of remaining hidden in implementation details.
              </div>
            </div>

            <WorkbenchEvidenceTracePanel />
            <WorkbenchDecisionTracePanel title="Cross-Stage Decision Trace" limit={4} />
            <WorkbenchProjectTimeline title="Canonical Project Timeline" limit={6} />
            <WorkbenchRunCompare stageId="stage-4" title="Iteration Compare" />
            <WorkbenchExperimentLedger title="Experimental Ledger" limit={6} />
            <WorkbenchAuditTimeline title="Global Audit Timeline" limit={8} />
          </section>
        </div>
      </main>
    </div>
  );
}
