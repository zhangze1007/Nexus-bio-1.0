'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, ExternalLink } from 'lucide-react';
import { THEME } from '../../theme';

interface AlgorithmPanelProps {
  name: string;
  version?: string;
  description: string;
  assumptions: string[];
  citation?: { authors: string; title: string; journal: string; year: number; doi: string };
  limitations?: string[];
}

export default function AlgorithmPanel({ name, version, description, assumptions, citation, limitations }: AlgorithmPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      borderRadius: THEME.R_MD,
      border: `1px solid ${THEME.BORDER}`,
      background: THEME.PANEL_INSET,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: THEME.VALUE,
        }}
      >
        <BookOpen size={14} color={THEME.SKY} />
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>{name}</span>
        {version && <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.DIM }}>v{version}</span>}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div style={{ padding: '0 12px 12px', display: 'grid', gap: '10px' }}>
          <p style={{ margin: 0, fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: THEME.LABEL, lineHeight: 1.6 }}>
            {description}
          </p>

          <div>
            <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.DIM, marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Assumptions
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px' }}>
              {assumptions.map((a, i) => (
                <li key={i} style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: THEME.LABEL, lineHeight: 1.5, marginBottom: '2px' }}>
                  {a}
                </li>
              ))}
            </ul>
          </div>

          {limitations && limitations.length > 0 && (
            <div>
              <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.APRICOT, marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Limitations
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                {limitations.map((l, i) => (
                  <li key={i} style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: THEME.LABEL, lineHeight: 1.5, marginBottom: '2px' }}>
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {citation && (
            <div style={{ padding: '8px 10px', borderRadius: THEME.R_SM, background: 'rgba(175,195,214,0.08)', border: `1px solid rgba(175,195,214,0.15)` }}>
              <div style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: THEME.VALUE, lineHeight: 1.5 }}>
                {citation.authors} ({citation.year}). {citation.title}. <em>{citation.journal}</em>.
              </div>
              {citation.doi && (
                <a href={`https://doi.org/${citation.doi}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.SKY, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  DOI: {citation.doi} <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
