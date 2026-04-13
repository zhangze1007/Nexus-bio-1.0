'use client';

import type { WorkflowArtifact } from '../../domain/workflowArtifact';

const MONO = "'IBM Plex Mono', 'JetBrains Mono', monospace";
const SANS = "'Public Sans', 'Inter', sans-serif";

type GraphSource = 'persisted' | 'in-memory' | 'compatibility-projection' | 'ui-graph' | 'demo' | 'none';

interface WorkflowArtifactDebugPanelProps {
  artifact: WorkflowArtifact | null;
  graphSource: GraphSource;
  compatibilityProjectionActive: boolean;
  title?: string;
}

function formatTimestamp(timestamp?: number | null) {
  if (!timestamp) return 'n/a';
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return 'n/a';
  }
}

export default function WorkflowArtifactDebugPanel({
  artifact,
  graphSource,
  compatibilityProjectionActive,
  title = 'Workflow debug',
}: WorkflowArtifactDebugPanelProps) {
  const nodeCount = artifact?.atomicPathwayGraph?.nodes.length ?? 0;
  const edgeCount = artifact?.atomicPathwayGraph?.edges.length ?? 0;
  const evidencePacketCount = artifact?.evidencePackets.length ?? 0;

  return (
    <div
      style={{
        borderRadius: '18px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        padding: '14px 15px',
        display: 'grid',
        gap: '10px',
      }}
    >
      <p
        style={{
          fontFamily: MONO,
          fontSize: '10px',
          color: 'rgba(255,255,255,0.34)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          margin: 0,
        }}
      >
        {title}
      </p>

      <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          ['Artifact ID', artifact?.id || 'n/a'],
          ['Status', artifact?.status || 'n/a'],
          ['Node Count', `${nodeCount}`],
          ['Edge Count', `${edgeCount}`],
          ['Evidence Packets', `${evidencePacketCount}`],
          ['Version', artifact ? `${artifact.version}` : 'n/a'],
          ['Updated', formatTimestamp(artifact?.updatedAt)],
          ['Graph Source', graphSource],
          ['Compat Projection', compatibilityProjectionActive ? 'true' : 'false'],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.025)',
              padding: '10px 11px',
              display: 'grid',
              gap: '4px',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '9px',
                color: 'rgba(255,255,255,0.28)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: '12px',
                color: '#ffffff',
                lineHeight: 1.45,
                overflowWrap: 'anywhere',
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
