import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, Hash, Link2, ShieldCheck, Atom } from 'lucide-react';
import { PathwayNode, PathwayEdge, NodeType, EdgeRelationshipType } from '../types';
import MoleculeViewer from './MoleculeViewer';

interface NodePanelProps {
  node: PathwayNode | null;
  onClose: () => void;
  allNodes?: PathwayNode[];
  allEdges?: PathwayEdge[];
}

// ── Visual helpers ──

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  metabolite: 'Metabolite',
  enzyme: 'Enzyme',
  gene: 'Gene',
  complex: 'Protein Complex',
  cofactor: 'Cofactor',
  unknown: 'Unknown',
};

const EDGE_TYPE_LABELS: Record<EdgeRelationshipType, string> = {
  catalyzes: 'catalyzes',
  produces: 'produces',
  consumes: 'consumes',
  activates: 'activates',
  inhibits: 'inhibits',
  converts: 'converts',
  transports: 'transports',
  regulates: 'regulates',
  unknown: 'connects to',
};

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? '#65CBF3' : score >= 0.6 ? '#FFDB13' : '#FF7D45';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span
          style={{
            color: 'rgba(255,255,255,0.25)',
            fontSize: '10px',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          AI Confidence
        </span>
        <span style={{ color, fontSize: '10px', fontFamily: 'monospace', fontWeight: 700 }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: '2px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      style={{
        color: 'rgba(255,255,255,0.2)',
        fontSize: '10px',
        fontFamily: 'monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '0 0 8px',
      }}
    >
      {label}
    </p>
  );
}

function Divider() {
  return <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />;
}

export default function NodePanel({ node, onClose, allNodes, allEdges }: NodePanelProps) {
  const nodeMap = useMemo(() => {
    const map = new Map<string, PathwayNode>();
    allNodes?.forEach((n) => map.set(n.id, n));
    return map;
  }, [allNodes]);

  const connections = useMemo(() => {
    if (!node || !allEdges) return [];
    return allEdges.filter((e) => e.start === node.id || e.end === node.id);
  }, [node, allEdges]);

  const handleDownload = () => {
    if (!node) return;

    const blob = new Blob([JSON.stringify(node, null, 2)], {
      type: 'application/json;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${node.id}_node.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const confidence = node?.confidenceScore;

  return (
    <AnimatePresence>
      {node && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              zIndex: 40,
            }}
          />

          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              height: '100%',
              width: '100%',
              maxWidth: '420px',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(180deg, #0f0f0f 0%, #0b0b0b 100%)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: node.color,
                    boxShadow: `0 0 8px ${node.color}60`,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <h2
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 600,
                      margin: 0,
                      letterSpacing: '-0.01em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {node.label}
                  </h2>
                  {node.canonicalLabel && node.canonicalLabel !== node.label && (
                    <p
                      style={{
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: '11px',
                        margin: '2px 0 0',
                        fontStyle: 'italic',
                      }}
                    >
                      {node.canonicalLabel}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  color: 'rgba(255,255,255,0.3)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  flexShrink: 0,
                  display: 'flex',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)';
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <Hash size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'monospace' }}>
                    {node.id}
                  </span>
                </div>

                {node.nodeType && node.nodeType !== 'unknown' && (
                  <div
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <span
                      style={{
                        color: 'rgba(255,255,255,0.45)',
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {NODE_TYPE_LABELS[node.nodeType]}
                    </span>
                  </div>
                )}
              </div>

              {node.confidenceScore !== undefined && <ConfidenceBar score={node.confidenceScore} />}

              <Divider />

              <div>
                <SectionLabel label="Biological Role" />
                <p
                  style={{
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: '13px',
                    lineHeight: 1.75,
                    margin: 0,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {node.summary}
                </p>
              </div>

              {node.evidenceSnippet && (
                <>
                  <Divider />
                  <div>
                    <SectionLabel label="Evidence from Literature" />
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderLeft: '2px solid rgba(255,255,255,0.15)',
                      }}
                    >
                      <p
                        style={{
                          color: 'rgba(255,255,255,0.5)',
                          fontSize: '12px',
                          lineHeight: 1.7,
                          margin: 0,
                          fontStyle: 'italic',
                        }}
                      >
                        “{node.evidenceSnippet}”
                      </p>
                    </div>
                  </div>
                </>
