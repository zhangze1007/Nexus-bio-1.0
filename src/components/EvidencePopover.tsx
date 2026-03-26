'use client';

import React from 'react';
import { X, ExternalLink, ShieldCheck } from 'lucide-react';
import type { EvidenceAnchor } from '../types';

interface EvidencePopoverProps {
  anchor: EvidenceAnchor;
  onClose: () => void;
}

export default function EvidencePopover({ anchor, onClose }: EvidencePopoverProps) {
  const pubmedUrl = anchor.pubmed_id
    ? `https://pubmed.ncbi.nlm.nih.gov/${anchor.pubmed_id}/`
    : null;

  const confidenceColor =
    anchor.confidence_score >= 0.9 ? '#4ade80' :
    anchor.confidence_score >= 0.7 ? '#facc15' :
    '#f87171';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        maxWidth: '520px',
        width: 'calc(100% - 32px)',
        padding: '16px 20px',
        borderRadius: '16px',
        background: 'rgba(10,10,14,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        fontFamily: "'Public Sans', -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={14} style={{ color: confidenceColor }} />
          <span style={{
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)',
            fontFeatureSettings: "'tnum' 1",
          }}>
            Evidence Anchor · Residue {anchor.residue_id}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)', padding: '2px',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Snippet */}
      <p style={{
        fontSize: '13px', lineHeight: 1.7,
        color: 'rgba(255,255,255,0.75)', margin: '0 0 12px',
        borderLeft: `2px solid ${confidenceColor}`,
        paddingLeft: '12px',
      }}>
        &ldquo;{anchor.snippet}&rdquo;
      </p>

      {/* Metadata row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {pubmedUrl && (
          <a
            href={pubmedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: 'rgba(255,255,255,0.4)',
              textDecoration: 'none', fontFeatureSettings: "'tnum' 1",
            }}
          >
            <ExternalLink size={10} />
            PubMed {anchor.pubmed_id}
          </a>
        )}
        <span style={{
          fontSize: '11px', color: confidenceColor,
          fontFeatureSettings: "'tnum' 1",
        }}>
          pLDDT {(anchor.confidence_score * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
