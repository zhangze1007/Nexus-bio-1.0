'use client';
/**
 * CatDes Inverse Folding Tab -- Protein sequence design via inverse folding.
 */
import React from 'react';
import { THEME } from '../../../theme';
import { GLASS, BORDER, LABEL, VALUE, INPUT_BG, INPUT_BORDER, INPUT_TEXT } from './catdesShared';

interface InverseFoldingSequence {
  sequence: string;
  score: number;
  metrics: {
    packingQuality: number;
    secondaryStructureMatch: number;
    hydrophobicCoreIntegrity: number;
  };
}

interface InverseFoldingMotif {
  type: string;
  start: number;
  end: number;
  confidence: number;
}

interface InverseFoldingResult {
  sequences: InverseFoldingSequence[];
  structuralMotifs: InverseFoldingMotif[];
  designNotes: string[];
}

interface CatDesInverseFoldingTabProps {
  invFoldSeqCount: number;
  setInvFoldSeqCount: (n: number) => void;
  invFoldTemp: number;
  setInvFoldTemp: (n: number) => void;
  invFoldLoading: boolean;
  invFoldResult: InverseFoldingResult | null;
  handleInverseFolding: () => void;
}

export default function CatDesInverseFoldingTab({
  invFoldSeqCount, setInvFoldSeqCount, invFoldTemp, setInvFoldTemp,
  invFoldLoading, invFoldResult, handleInverseFolding,
}: CatDesInverseFoldingTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        ...GLASS,
        padding: 16,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Sequences
        </span>
        <input type="number" min={1} max={32} value={invFoldSeqCount}
          onChange={(e) => setInvFoldSeqCount(Number(e.target.value))}
          style={{ width: 60, padding: '4px 8px', background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: INPUT_TEXT, fontFamily: THEME.MONO, fontSize: THEME.FS_SM, outline: 'none' }}
        />
        <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Temperature
        </span>
        <input type="range" min={0.1} max={1.5} step={0.1} value={invFoldTemp}
          onChange={(e) => setInvFoldTemp(Number(e.target.value))}
          style={{ width: 100 }}
        />
        <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: VALUE }}>{invFoldTemp.toFixed(1)}</span>
        <button onClick={handleInverseFolding} disabled={invFoldLoading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: THEME.FS_SM, opacity: invFoldLoading ? 0.4 : 1 }}
        >
          {invFoldLoading ? 'Designing...' : 'Design Sequences'}
        </button>
        {invFoldResult && (
          <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: 'rgba(255,255,255,0.4)' }}>
            {invFoldResult.sequences.length} sequences • {invFoldResult.structuralMotifs.length} motifs
          </span>
        )}
      </div>

      {/* Design notes */}
      {invFoldResult && (
        <div style={{
          ...GLASS, padding: 12,
          fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
        }}>
          {invFoldResult.designNotes.map((n, i) => <div key={i}>• {n}</div>)}
        </div>
      )}

      {/* Results table */}
      {invFoldResult && invFoldResult.sequences.length > 0 && (
        <div style={{ ...GLASS, padding: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: THEME.MONO, fontSize: THEME.FS_XS }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: LABEL }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: LABEL }}>Sequence</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: LABEL }}>Score</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: LABEL }}>Packing</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: LABEL }}>SS Match</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: LABEL }}>Core</th>
              </tr>
            </thead>
            <tbody>
              {invFoldResult.sequences.slice(0, 10).map((seq, i) => (
                <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.4)' }}>{i + 1}</td>
                  <td style={{ padding: '6px 8px', color: VALUE, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seq.sequence}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: seq.score > 0.7 ? THEME.SUCCESS_HIGH : seq.score > 0.5 ? THEME.SUCCESS_MEDIUM : THEME.RISK_LOW }}>
                    {seq.score.toFixed(3)}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: VALUE }}>{seq.metrics.packingQuality.toFixed(2)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: VALUE }}>{seq.metrics.secondaryStructureMatch.toFixed(2)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: VALUE }}>{seq.metrics.hydrophobicCoreIntegrity.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Structural motifs */}
      {invFoldResult && invFoldResult.structuralMotifs.length > 0 && (
        <div style={{ ...GLASS, padding: 12 }}>
          <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Structural Motifs
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {invFoldResult.structuralMotifs.map((motif, i) => (
              <span key={i} style={{
                padding: '3px 8px',
                background: motif.type === 'helix' ? 'rgba(200,216,232,0.1)' : motif.type === 'sheet' ? 'rgba(200,224,208,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${motif.type === 'helix' ? 'rgba(200,216,232,0.2)' : motif.type === 'sheet' ? 'rgba(200,224,208,0.2)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '3px',
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                color: motif.type === 'helix' ? THEME.SKY : motif.type === 'sheet' ? THEME.MINT : 'rgba(255,255,255,0.5)',
              }}>
                {motif.type} {motif.start}-{motif.end} ({(motif.confidence * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
