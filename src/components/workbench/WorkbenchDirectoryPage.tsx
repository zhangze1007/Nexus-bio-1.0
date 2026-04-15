'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Beaker, Layers3, Microscope } from 'lucide-react';
import { T } from '../ide/tokens';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { CROSS_STAGE_TOOL_IDS, WORKBENCH_STAGES } from '../tools/shared/workbenchConfig';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { getFreshnessMap } from './workbenchTrust';
import { PATHD_THEME } from './workbenchTheme';

const BORDER = PATHD_THEME.sepiaPanelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;
const SURFACE = PATHD_THEME.panelGlassStrong;
const SURFACE_SOFT = PATHD_THEME.panelSurface;

type ControlVarsStyle = CSSProperties & Record<`--${string}`, string>;
type LauncherSignal = 'dormant' | 'live' | 'revisit';

function dedupeToolIds(ids: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  ids.forEach((id) => {
    if (!id || seen.has(id) || !TOOL_BY_ID[id]) return;
    seen.add(id);
    ordered.push(id);
  });

  return ordered;
}

function getLauncherSignal(status?: string | null): LauncherSignal {
  if (status === 'fresh') return 'live';
  if (status === 'stale' || status === 'awaiting-upstream') return 'revisit';
  return 'dormant';
}

function getLauncherSignalLabel(signal: LauncherSignal) {
  if (signal === 'live') return 'Live context';
  if (signal === 'revisit') return 'Needs revisit';
  return 'Not opened';
}

interface LauncherToolCardProps {
  toolId: string;
  signal: LauncherSignal;
  compact?: boolean;
  surface?: string;
  outputs?: string[];
}

function LauncherToolCard({
  toolId,
  signal,
  compact = false,
  surface = SURFACE,
  outputs,
}: LauncherToolCardProps) {
  const tool = TOOL_BY_ID[toolId];
  if (!tool) return null;

  const signalLabel = getLauncherSignalLabel(signal);
  const cardOutputs = outputs ?? tool.outputs.slice(0, 2);

  return (
    <Link
      href={tool.href}
      className="nb-workbench-launch-card"
      data-signal={signal}
      aria-label={`${tool.name} · ${signalLabel}`}
      style={{
        borderRadius: compact ? '16px' : '18px',
        border: `1px solid ${BORDER}`,
        background: surface,
        padding: compact ? '13px 14px' : '15px 16px',
        display: 'grid',
        gap: compact ? '7px' : '8px',
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {tool.shortLabel}
        </span>
        <span
          title={signalLabel}
          aria-label={signalLabel}
          style={{
            width: compact ? '20px' : '22px',
            height: compact ? '20px' : '22px',
            borderRadius: '999px',
            border: `1px solid ${BORDER}`,
            background: SURFACE_SOFT,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span className="nb-workbench-launch-card__signal" data-signal={signal} aria-hidden="true" />
        </span>
      </div>

      <div style={{ fontFamily: T.SANS, fontSize: compact ? '14px' : '15px', fontWeight: 700, color: VALUE, letterSpacing: '-0.01em' }}>
        {tool.name}
      </div>

      <div style={{ fontFamily: T.SANS, fontSize: compact ? '11px' : '12px', color: VALUE, lineHeight: 1.55 }}>
        {tool.focus}
      </div>

      <div style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.6 }}>
        {tool.summary}
      </div>

      <div style={{ marginTop: 'auto', fontFamily: T.MONO, fontSize: '10px', color: LABEL, minWidth: 0, lineHeight: 1.5 }}>
        {cardOutputs.join(' · ')}
      </div>
    </Link>
  );
}

export default function WorkbenchDirectoryPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const nextRecommendations = useWorkbenchStore((s) => s.nextRecommendations);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const toolRuns = useWorkbenchStore((s) => s.toolRuns);
  const currentToolId = useWorkbenchStore((s) => s.currentToolId);

  const freshnessByTool = getFreshnessMap(
    runArtifacts,
    WORKBENCH_STAGES.flatMap((stage) => stage.toolIds).concat(...CROSS_STAGE_TOOL_IDS),
    { project, analyzeArtifact },
  );

  const recommendedToolIds = dedupeToolIds(
    analyzeArtifact?.recommendedNextTools?.length
      ? analyzeArtifact.recommendedNextTools
      : nextRecommendations.map((recommendation) => recommendation.toolId),
  ).slice(0, 3);

  const recentToolIds = dedupeToolIds([
    currentToolId,
    ...toolRuns.map((run) => run.toolId),
  ])
    .filter((toolId) => !recommendedToolIds.includes(toolId))
    .slice(0, 3);

  const quickGroups = [
    recommendedToolIds.length > 0
      ? {
          key: 'recommended',
          title: 'Recommended',
          detail: analyzeArtifact
            ? 'Suggested from the current Analyze artifact.'
            : 'Suggested from the current workbench flow.',
          toolIds: recommendedToolIds,
        }
      : null,
    recentToolIds.length > 0
      ? {
          key: 'recent',
          title: 'Recent',
          detail: 'Continue where you left off without rescanning the whole launcher.',
          toolIds: recentToolIds,
        }
      : null,
  ].filter((group): group is { key: string; title: string; detail: string; toolIds: string[] } => Boolean(group));

  const contextItems = [
    {
      label: 'Project',
      value: project?.title ?? 'No active project',
      detail: project
        ? (project.targetProduct ? `Target · ${project.targetProduct}` : 'Project context is ready')
        : 'Start from Research or Analyze to seed context',
    },
    {
      label: 'Evidence',
      value: `${selectedEvidenceIds.length} selected`,
      detail: selectedEvidenceIds.length
        ? 'Evidence bundle is ready to carry into a tool'
        : 'No evidence selected yet',
    },
    {
      label: 'Analyze Artifact',
      value: analyzeArtifact?.targetProduct ?? 'Pending',
      detail: analyzeArtifact
        ? `${analyzeArtifact.recommendedNextTools.length} next-step signal(s) ready`
        : 'Run Analyze to unlock recommendations',
    },
  ];

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100%',
        background: `linear-gradient(180deg, ${PATHD_THEME.sepiaPanelMuted} 0%, ${PATHD_THEME.sepiaPanel} 100%)`,
        color: VALUE,
        flex: 1,
      }}
    >
      <main style={{ padding: '28px 18px 40px' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'grid', gap: '18px' }}>
          <section
            style={{
              borderRadius: '26px',
              border: `1px solid ${BORDER}`,
              background: `linear-gradient(180deg, ${PATHD_THEME.sepiaPanelMuted} 0%, ${PATHD_THEME.sepiaPanel} 100%)`,
              padding: '22px',
              display: 'grid',
              gap: '14px',
              boxShadow: '0 16px 38px rgba(0,0,0,0.24)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: '6px' }}>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  Workbench Launcher
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '32px', fontWeight: 700, letterSpacing: '-0.04em', color: VALUE, lineHeight: 1.02 }}>
                  Enter a tool and continue the project
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '14px', color: LABEL, maxWidth: '66ch', lineHeight: 1.65 }}>
                  Nexus-Bio keeps project, evidence, and Analyze context attached so you can move into the next workbench without reorienting first.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <Link
                  href="/research"
                  className="nb-ui-control"
                  style={{
                    minHeight: '36px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    textDecoration: 'none',
                    border: '1px solid var(--nb-control-border)',
                    background: 'var(--nb-control-bg)',
                    color: 'var(--nb-control-color)',
                    fontFamily: T.SANS,
                    fontSize: '13px',
                    fontWeight: 600,
                    ['--nb-control-bg' as const]: SURFACE_SOFT,
                    ['--nb-control-border' as const]: BORDER,
                    ['--nb-control-color' as const]: VALUE,
                    ['--nb-control-hover-bg' as const]: '#ffffff',
                    ['--nb-control-hover-border' as const]: '#ffffff',
                    ['--nb-control-hover-color' as const]: PATHD_THEME.ink,
                    ['--nb-control-active-bg' as const]: '#ffffff',
                    ['--nb-control-active-border' as const]: '#ffffff',
                    ['--nb-control-active-color' as const]: PATHD_THEME.ink,
                  } as ControlVarsStyle}
                >
                  <Microscope size={14} />
                  Research Intake
                </Link>
                <Link
                  href="/analyze"
                  className="nb-ui-control"
                  style={{
                    minHeight: '36px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    textDecoration: 'none',
                    border: '1px solid var(--nb-control-border)',
                    background: 'var(--nb-control-bg)',
                    color: 'var(--nb-control-color)',
                    fontFamily: T.SANS,
                    fontSize: '13px',
                    fontWeight: 600,
                    ['--nb-control-bg' as const]: SURFACE_SOFT,
                    ['--nb-control-border' as const]: BORDER,
                    ['--nb-control-color' as const]: VALUE,
                    ['--nb-control-hover-bg' as const]: '#ffffff',
                    ['--nb-control-hover-border' as const]: '#ffffff',
                    ['--nb-control-hover-color' as const]: PATHD_THEME.ink,
                    ['--nb-control-active-bg' as const]: '#ffffff',
                    ['--nb-control-active-border' as const]: '#ffffff',
                    ['--nb-control-active-color' as const]: PATHD_THEME.ink,
                  } as ControlVarsStyle}
                >
                  <Beaker size={14} />
                  Analyze Artifact
                </Link>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '10px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              }}
            >
              {contextItems.map((item) => (
                <div
                  key={item.label}
                  style={{
                    borderRadius: '16px',
                    border: `1px solid ${BORDER}`,
                    background: SURFACE,
                    padding: '12px 14px',
                    display: 'grid',
                    gap: '4px',
                  }}
                >
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: T.SANS, fontSize: '15px', fontWeight: 700, color: VALUE }}>
                    {item.value}
                  </div>
                  <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.55 }}>
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: T.MONO,
                  fontSize: '10px',
                  color: LABEL,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Launch signals
              </span>
              {[
                { signal: 'dormant' as LauncherSignal, label: 'Not opened' },
                { signal: 'live' as LauncherSignal, label: 'Live context' },
                { signal: 'revisit' as LauncherSignal, label: 'Needs revisit' },
              ].map((item) => (
                <span
                  key={item.signal}
                  style={{
                    minHeight: '28px',
                    padding: '0 10px',
                    borderRadius: '999px',
                    border: `1px solid ${BORDER}`,
                    background: SURFACE_SOFT,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: LABEL,
                    fontFamily: T.SANS,
                    fontSize: '12px',
                  }}
                >
                  <span className="nb-workbench-launch-card__signal" data-signal={item.signal} aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </div>
          </section>

          {quickGroups.length > 0 && (
            <section
              style={{
                borderRadius: '24px',
                border: `1px solid ${BORDER}`,
                background: SURFACE,
                padding: '18px',
                display: 'grid',
                gap: '16px',
                boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
              }}
            >
              <div style={{ display: 'grid', gap: '4px' }}>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Quick Entry
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '18px', fontWeight: 700, color: VALUE, letterSpacing: '-0.02em' }}>
                  Recommended and recent tools
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: LABEL, lineHeight: 1.6 }}>
                  Start from the most relevant next step, or jump straight back into the workbench you just used.
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: '14px',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                }}
              >
                {quickGroups.map((group) => (
                  <div
                    key={group.key}
                    style={{
                      borderRadius: '18px',
                      border: `1px solid ${BORDER}`,
                      background: SURFACE_SOFT,
                      padding: '14px',
                      display: 'grid',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {group.title}
                      </div>
                      <div style={{ fontFamily: T.SANS, fontSize: '13px', color: LABEL, lineHeight: 1.55 }}>
                        {group.detail}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gap: '10px',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      }}
                    >
                      {group.toolIds.map((toolId) => (
                        <LauncherToolCard
                          key={`${group.key}-${toolId}`}
                          toolId={toolId}
                          signal={getLauncherSignal(freshnessByTool[toolId]?.status)}
                          compact
                          surface={SURFACE}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div style={{ display: 'grid', gap: '14px' }}>
            {WORKBENCH_STAGES.map((stage) => (
              <section
                key={stage.id}
                style={{
                  borderRadius: '22px',
                  border: `1px solid ${BORDER}`,
                  background: `linear-gradient(135deg, ${PATHD_THEME.sepiaPanelMuted} 0%, ${stage.accent}18 48%, ${PATHD_THEME.sepiaPanel} 100%)`,
                  padding: '16px',
                  display: 'grid',
                  gap: '14px',
                  boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
                }}
              >
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '4px 9px',
                        borderRadius: '999px',
                        border: `1px solid ${stage.accent}66`,
                        background: `${stage.accent}28`,
                        color: VALUE,
                        fontFamily: T.MONO,
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {stage.shortLabel}
                    </span>
                    <span style={{ fontFamily: T.SANS, fontSize: '18px', fontWeight: 700, color: VALUE, letterSpacing: '-0.02em' }}>
                      {stage.label}
                    </span>
                  </div>
                  <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, maxWidth: '72ch', lineHeight: 1.6 }}>
                    {stage.description}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '12px',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  }}
                >
                  {stage.toolIds.map((toolId) => (
                    <LauncherToolCard
                      key={toolId}
                      toolId={toolId}
                      signal={getLauncherSignal(freshnessByTool[toolId]?.status)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {CROSS_STAGE_TOOL_IDS.length > 0 && (
            <section
              style={{
                borderRadius: '22px',
                border: `1px solid ${BORDER}`,
                background: SURFACE,
                padding: '16px',
                display: 'grid',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers3 size={16} color={LABEL} />
                <div style={{ fontFamily: T.SANS, fontSize: '17px', fontWeight: 700, color: VALUE }}>
                  Cross-stage intelligence
                </div>
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6, maxWidth: '68ch' }}>
                Keep Axon close as a supporting synthesis layer, but let the stage tools remain the main path through the launcher.
              </div>
              <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                {CROSS_STAGE_TOOL_IDS.map((toolId) => (
                  <LauncherToolCard
                    key={toolId}
                    toolId={toolId}
                    signal={getLauncherSignal(freshnessByTool[toolId]?.status)}
                    surface={SURFACE_SOFT}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
