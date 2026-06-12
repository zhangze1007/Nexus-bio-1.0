'use client';
import React, { useState, useCallback } from 'react';
import MetabolicEngPage from './MetabolicEngPage';
import { searchKEGGPathway } from '../../services/database/keggClient';
import type { KEGGPathwayResult } from '../../services/database/keggClient';
import type { FallbackResult } from '../../services/database/fetchWithFallback';
import DataSourceBadge from '../ide/shared/DataSourceBadge';

export default React.memo(function PathDPage() {
  const [keggQuery, setKeggQuery] = useState('');
  const [keggResult, setKeggResult] = useState<FallbackResult<KEGGPathwayResult> | null>(null);
  const [keggLoading, setKeggLoading] = useState(false);

  const handleKeggSearch = useCallback(async () => {
    if (!keggQuery.trim()) return;
    setKeggLoading(true);
    try {
      const result = await searchKEGGPathway(keggQuery.trim());
      setKeggResult(result);
    } finally {
      setKeggLoading(false);
    }
  }, [keggQuery]);

  return (
    <>
      {/* ── KEGG Pathway Search ── */}
      <div style={{
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          fontFamily: 'var(--nb-mono)',
          fontSize: 'var(--nb-fs-xxs)',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          whiteSpace: 'nowrap',
        }}>
          KEGG Search
        </span>
        <input
          type="text"
          value={keggQuery}
          onChange={(e) => setKeggQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleKeggSearch(); }}
          placeholder="e.g. glycolysis, tca, mevalonate"
          style={{
            flex: 1,
            maxWidth: '280px',
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--nb-radius-sm)',
            color: 'rgba(255,255,255,0.85)',
            fontFamily: 'var(--nb-mono)',
            fontSize: 'var(--nb-fs-xs)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleKeggSearch}
          disabled={keggLoading || !keggQuery.trim()}
          className="nb-tool-toggle"
          style={{
            padding: '4px 12px',
            fontSize: 'var(--nb-fs-xs)',
            opacity: keggLoading || !keggQuery.trim() ? 0.4 : 1,
          }}
        >
          {keggLoading ? 'Searching...' : 'Search'}
        </button>
        {keggResult && (
          <DataSourceBadge source={keggResult.source} label={keggResult.source === 'live' ? 'KEGG Live' : 'KEGG Demo'} />
        )}
        {keggResult && (
          <span style={{
            fontFamily: 'var(--nb-mono)',
            fontSize: 'var(--nb-fs-xxs)',
            color: 'rgba(255,255,255,0.5)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '240px',
          }}>
            {keggResult.data.name} ({keggResult.data.reactions.length} rxns, {keggResult.data.compounds.length} cpds)
          </span>
        )}
      </div>
      <MetabolicEngPage embedded />
    </>
  );
});
