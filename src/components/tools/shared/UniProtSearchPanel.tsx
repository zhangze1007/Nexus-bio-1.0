'use client';
import React, { useState, useCallback } from 'react';
import { searchUniProt } from '../../../services/database/uniprotClient';
import type { UniProtEntry } from '../../../services/database/uniprotClient';
import DataSourceBadge from '../../ide/shared/DataSourceBadge';
import { THEME } from '../../../theme';
import { toolTokens } from '../../../hooks/useToolTheme';

const { border: BORDER, label: LABEL, value: VALUE, inputBg: INPUT_BG, inputBorder: INPUT_BORDER, inputText: INPUT_TEXT } = toolTokens;

interface UniProtSearchPanelProps {
  /** Pre-fill the search input */
  defaultQuery?: string;
  /** Called when an entry is selected/found */
  onSelect?: (entry: UniProtEntry) => void;
  /** Compact mode hides the full sequence display */
  compact?: boolean;
}

/**
 * Standalone UniProt search panel with DataSourceBadge.
 * Can be embedded in any tool page for protein lookups.
 *
 * Usage:
 *   <UniProtSearchPanel defaultQuery="P00044" onSelect={handleEntry} />
 */
export default function UniProtSearchPanel({ defaultQuery = '', onSelect, compact = false }: UniProtSearchPanelProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [entry, setEntry] = useState<UniProtEntry | null>(null);
  const [source, setSource] = useState<'live' | 'mock'>('mock');
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const result = await searchUniProt(query.trim());
      setEntry(result.data);
      setSource(result.source);
      onSelect?.(result.data);
    } finally {
      setLoading(false);
    }
  }, [query, onSelect]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          UniProt Search
        </span>
        <DataSourceBadge source={source} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          placeholder="Accession or gene name (e.g. P00044)"
          style={{
            flex: 1, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
            color: INPUT_TEXT, background: INPUT_BG,
            border: `1px solid ${INPUT_BORDER}`, borderRadius: 6,
            padding: '5px 8px', outline: 'none',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: VALUE,
            background: 'rgba(175,195,214,0.12)', border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 6, padding: '5px 10px',
            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '...' : 'Search'}
        </button>
      </div>
      {entry && (
        <div style={{
          padding: '8px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Accession</span>
            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{entry.accession}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Gene</span>
            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{entry.geneName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Organism</span>
            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{entry.organism}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Length</span>
            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{entry.length} aa</span>
          </div>
          {entry.function && (
            <div style={{ marginTop: 2 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Function</span>
              <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: VALUE, margin: '2px 0 0', lineHeight: 1.5 }}>
                {entry.function}
              </p>
            </div>
          )}
          {!compact && entry.sequence && (
            <div style={{ marginTop: 4 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Sequence (first 80 aa)</span>
              <p style={{
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: 'rgba(255,255,255,0.5)',
                margin: '2px 0 0', wordBreak: 'break-all', lineHeight: 1.6,
              }}>
                {entry.sequence.slice(0, 80)}{entry.sequence.length > 80 ? '...' : ''}
              </p>
            </div>
          )}
        </div>
      )}
      {!entry && (
        <p style={{
          margin: 0, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
          color: LABEL, opacity: 0.6,
        }}>
          Search by UniProt accession, gene name, or protein name.
        </p>
      )}
    </div>
  );
}
