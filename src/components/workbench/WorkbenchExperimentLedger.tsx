'use client';

import { useMemo } from 'react';
import { ClipboardList, FlaskConical, Microscope } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import { buildExperimentLedger, getAuthorityTier } from './workbenchTrust';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';

interface WorkbenchExperimentLedgerProps {
  title?: string;
  limit?: number;
}

const BORDER = 'rgba(255,255,255,0.08)';
const LABEL = 'rgba(255,255,255,0.42)';
const VALUE = 'rgba(255,255,255,0.88)';

function getStatusStyle(status: 'recorded' | 'committed' | 'attention' | 'draft') {
  if (status === 'committed') {
    return {
      border: 'rgba(158,215,199,0.26)',
      background: 'rgba(158,215,199,0.12)',
      color: 'rgba(224,244,238,0.92)',
    };
  }
  if (status === 'attention') {
    return {
      border: 'rgba(255,192,128,0.28)',
      background: 'rgba(255,192,128,0.12)',
      color: 'rgba(255,226,186,0.92)',
    };
  }
  if (status === 'draft') {
    return {
      border: 'rgba(242,214,162,0.24)',
      background: 'rgba(242,214,162,0.12)',
      color: 'rgba(255,236,198,0.9)',
    };
  }
  return {
    border: 'rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
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
        <ClipboardList size={14} color="rgba(255,255,255,0.72)" />
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
              background: 'rgba(255,255,255,0.03)',
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
                    background: 'rgba(255,255,255,0.04)',
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
