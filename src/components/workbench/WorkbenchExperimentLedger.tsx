'use client';

import { useMemo } from 'react';
import { ClipboardList, FlaskConical, Microscope } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import { buildExperimentLedger, getAuthorityTier } from './workbenchTrust';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { PATHD_THEME } from './workbenchTheme';

interface WorkbenchExperimentLedgerProps {
  title?: string;
  limit?: number;
}

const BORDER = PATHD_THEME.panelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;

function getStatusStyle(status: 'recorded' | 'committed' | 'attention' | 'draft') {
  if (status === 'committed') {
    return {
      border: PATHD_THEME.chipBorder,
      background: PATHD_THEME.chipCool,
      color: PATHD_THEME.chipText,
    };
  }
  if (status === 'attention') {
    return {
      border: PATHD_THEME.chipBorderWarm,
      background: PATHD_THEME.chipWarm,
      color: 'rgba(255,228,194,0.94)',
    };
  }
  if (status === 'draft') {
    return {
      border: PATHD_THEME.chipBorderWarm,
      background: PATHD_THEME.panelGradientSoft,
      color: PATHD_THEME.value,
    };
  }
  return {
    border: 'rgba(255,255,255,0.12)',
    background: PATHD_THEME.chipNeutral,
    color: VALUE,
  };
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WorkbenchExperimentLedger({
  title = 'Experiment Ledger',
  limit = 5,
}: WorkbenchExperimentLedgerProps) {
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const entries = useMemo(() => buildExperimentLedger(runArtifacts, limit), [limit, runArtifacts]);
  const artifactById = useMemo(
    () => new Map(runArtifacts.map((artifact) => [artifact.id, artifact])),
    [runArtifacts],
  );

  return (
    <section style={{ display: 'grid', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ClipboardList size={14} color={PATHD_THEME.orange} />
        <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </div>
      </div>

      {entries.length ? entries.map((entry) => {
        const tool = TOOL_BY_ID[entry.toolId];
        const style = getStatusStyle(entry.status);
        const Icon = entry.toolId === 'cellfree' || entry.toolId === 'dbtlflow' ? FlaskConical : Microscope;
        const artifact = artifactById.get(entry.id);
        return (
          <div
            key={entry.id}
            style={{
              borderRadius: '16px',
              border: `1px solid ${BORDER}`,
              background: PATHD_THEME.panelGradientSoft,
              padding: '12px 14px',
              display: 'grid',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '999px',
                    border: `1px solid ${style.border}`,
                    background: style.background,
                    color: style.color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={12} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.SANS, fontSize: '13px', color: VALUE, fontWeight: 700 }}>
                    {entry.title}
                  </div>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                    {tool?.shortLabel ?? entry.toolId.toUpperCase()} · {formatTime(entry.createdAt)}
                  </div>
                </div>
              </div>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '999px',
                  border: `1px solid ${style.border}`,
                  background: style.background,
                  color: style.color,
                  fontFamily: T.MONO,
                  fontSize: '10px',
                  textTransform: 'uppercase',
                }}
              >
                {entry.status}
              </span>
              <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                {artifact ? getAuthorityTier(artifact) : 'unknown'}
              </span>
            </div>

            <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
              {entry.summary}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {entry.metrics.map((metric) => (
                <span
                  key={metric}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '999px',
                    border: `1px solid ${BORDER}`,
                    background: PATHD_THEME.chipNeutral,
                    color: 'rgba(255,255,255,0.76)',
                    fontFamily: T.MONO,
                    fontSize: '10px',
                  }}
                >
                  {metric}
                </span>
              ))}
            </div>
          </div>
        );
      }) : (
        <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
          No experimental ledger entries yet. Execute Cell-free, DBTL, or downstream omics tools to populate the recorded test trail.
        </div>
      )}
    </section>
  );
}
