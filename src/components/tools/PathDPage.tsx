'use client';
import React, { useState, useCallback, useEffect } from 'react';
import MetabolicEngPage from './MetabolicEngPage';
import { searchKEGGPathway } from '../../services/database/keggClient';
import type { KEGGPathwayResult } from '../../services/database/keggClient';
import type { FallbackResult } from '../../services/database/fetchWithFallback';
import DataSourceBadge from '../ide/shared/DataSourceBadge';
import { useUIStore } from '../../store/uiStore';
import { keggToPathway } from '../../utils/keggToPathway';
import { findPathways } from '../../server/retrosynthesis';
import type { RetrosynthesisResult } from '../../server/retrosynthesis';
import { THEME } from '../../theme';

export default React.memo(function PathDPage() {
  const [activeTab, setActiveTab] = useState<'kegg' | 'retro'>('kegg');
  const [keggQuery, setKeggQuery] = useState('');
  const [keggResult, setKeggResult] = useState<FallbackResult<KEGGPathwayResult> | null>(null);
  const [keggLoading, setKeggLoading] = useState(false);

  // Retrosynthesis state
  const [retroTarget, setRetroTarget] = useState('');
  const [retroResult, setRetroResult] = useState<RetrosynthesisResult | null>(null);
  const [retroLoading, setRetroLoading] = useState(false);

  const setAiPathway = useUIStore(s => s.setAiPathway);
  const resetPathway = useUIStore(s => s.resetPathway);

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

  const handleClear = useCallback(() => {
    setKeggQuery('');
    setKeggResult(null);
    resetPathway();
  }, [resetPathway]);

  const handleRetrosynthesis = useCallback(() => {
    if (!retroTarget.trim()) return;
    setRetroLoading(true);
    try {
      const result = findPathways({
        targetSmiles: retroTarget,
        maxSteps: 5,
        maxPathways: 10,
      });
      setRetroResult(result);
    } finally {
      setRetroLoading(false);
    }
  }, [retroTarget]);

  // Inject KEGG pathway into uiStore when live data arrives.
  // MetabolicEngPage picks it up via tier 4 (uiGraph) of its resolution cascade.
  useEffect(() => {
    if (keggResult && keggResult.data.compounds.length > 0) {
      const { nodes, edges } = keggToPathway(keggResult.data);
      if (nodes.length > 0) {
        setAiPathway(nodes, edges);
      }
    }
    // Reset on unmount so MetabolicEngPage falls back to demo
    return () => { resetPathway(); };
  }, [keggResult, setAiPathway, resetPathway]);

  return (
    <>
      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex',
        gap: '2px',
        padding: '0 16px',
        borderBottom: `1px solid rgba(255,255,255,0.06)`,
        background: 'rgba(10,12,16,0.72)',
      }}>
        <button
          role="tab"
          aria-selected={activeTab === 'kegg'}
          onClick={() => setActiveTab('kegg')}
          style={{
            position: 'relative',
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: THEME.SANS,
            fontSize: 'var(--nb-fs-sm)',
            fontWeight: activeTab === 'kegg' ? 600 : 400,
            color: activeTab === 'kegg' ? THEME.SKY : 'rgba(255,255,255,0.45)',
            borderRadius: '6px 6px 0 0',
            transition: 'color 0.2s ease, background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'kegg') {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'kegg') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
            }
          }}
        >
          KEGG Search
          {activeTab === 'kegg' && (
            <div style={{
              position: 'absolute',
              bottom: '-1px',
              left: 0,
              right: 0,
              height: '2px',
              background: THEME.SKY,
              borderRadius: '2px 2px 0 0',
            }} />
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'retro'}
          onClick={() => setActiveTab('retro')}
          style={{
            position: 'relative',
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: THEME.SANS,
            fontSize: 'var(--nb-fs-sm)',
            fontWeight: activeTab === 'retro' ? 600 : 400,
            color: activeTab === 'retro' ? THEME.MINT : 'rgba(255,255,255,0.45)',
            borderRadius: '6px 6px 0 0',
            transition: 'color 0.2s ease, background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'retro') {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'retro') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
            }
          }}
        >
          Retrosynthesis
          {activeTab === 'retro' && (
            <div style={{
              position: 'absolute',
              bottom: '-1px',
              left: 0,
              right: 0,
              height: '2px',
              background: THEME.MINT,
              borderRadius: '2px 2px 0 0',
            }} />
          )}
        </button>
      </div>

      {/* ── KEGG Pathway Search ── */}
      {activeTab === 'kegg' && (
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
            <button
              onClick={handleClear}
              className="nb-tool-toggle"
              style={{
                padding: '4px 8px',
                fontSize: 'var(--nb-fs-xs)',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              Clear
            </button>
          )}
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
      )}

      {/* ── Retrosynthesis ── */}
      {activeTab === 'retro' && (
        <div style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(10,12,16,0.72)',
        }}>
          {/* Search bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: retroResult ? '16px' : 0,
          }}>
            <span style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
            }}>
              Target SMILES
            </span>
            <input
              type="text"
              value={retroTarget}
              onChange={(e) => setRetroTarget(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRetrosynthesis(); }}
              placeholder="e.g. CC(=O)SC(=O)O  (acetyl-CoA)"
              style={{
                flex: 1,
                maxWidth: '360px',
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--nb-radius-sm)',
                color: 'rgba(255,255,255,0.85)',
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
                outline: 'none',
              }}
            />
            <button
              onClick={handleRetrosynthesis}
              disabled={retroLoading || !retroTarget.trim()}
              className="nb-tool-toggle"
              style={{
                padding: '6px 14px',
                fontSize: THEME.FS_SM,
                opacity: retroLoading || !retroTarget.trim() ? 0.4 : 1,
              }}
            >
              {retroLoading ? 'Searching...' : 'Find Pathways'}
            </button>
            {retroResult && (
              <button
                onClick={() => { setRetroTarget(''); setRetroResult(null); }}
                className="nb-tool-toggle"
                style={{
                  padding: '6px 10px',
                  fontSize: THEME.FS_SM,
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                Clear
              </button>
            )}
            {retroResult && (
              <span style={{
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                color: 'rgba(255,255,255,0.4)',
                whiteSpace: 'nowrap',
              }}>
                {retroResult.pathways.length} pathway{retroResult.pathways.length !== 1 ? 's' : ''} in {retroResult.totalTime}ms
              </span>
            )}
          </div>

          {/* Results */}
          {retroResult && retroResult.pathways.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '240px',
              overflowY: 'auto',
            }}>
              {retroResult.pathways.map((pathway, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 'var(--nb-radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {/* Pathway header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontFamily: THEME.SANS,
                    fontSize: THEME.FS_SM,
                  }}>
                    <span style={{
                      color: THEME.MINT,
                      fontWeight: 600,
                    }}>
                      Route {idx + 1}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {pathway.length} step{pathway.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{
                      color: 'rgba(255,255,255,0.35)',
                      fontFamily: THEME.MONO,
                      fontSize: THEME.FS_XS,
                    }}>
                      score {(pathway.score * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Steps */}
                  {pathway.steps.length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px',
                      alignItems: 'center',
                    }}>
                      {pathway.steps.map((step, si) => (
                        <React.Fragment key={si}>
                          <span style={{
                            padding: '2px 6px',
                            background: 'rgba(191,220,205,0.08)',
                            border: '1px solid rgba(191,220,205,0.15)',
                            borderRadius: '3px',
                            fontFamily: THEME.MONO,
                            fontSize: THEME.FS_XS,
                            color: 'rgba(255,255,255,0.7)',
                            whiteSpace: 'nowrap',
                          }}>
                            {step.ruleName}
                            <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: '4px' }}>
                              [{step.enzymeClass}]
                            </span>
                          </span>
                          {si < pathway.steps.length - 1 && (
                            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: THEME.FS_XS }}>
                              →
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* Cofactors */}
                  {pathway.steps.some(s => s.cofactors.length > 0) && (
                    <div style={{
                      fontFamily: THEME.MONO,
                      fontSize: THEME.FS_XS,
                      color: 'rgba(255,255,255,0.3)',
                    }}>
                      Cofactors: {Array.from(new Set(pathway.steps.flatMap(s => s.cofactors))).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {retroResult && retroResult.pathways.length === 0 && (
            <div style={{
              padding: '12px',
              textAlign: 'center',
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              color: 'rgba(255,255,255,0.4)',
            }}>
              No retrosynthetic pathways found for this target. Try a different SMILES or a simpler molecule.
            </div>
          )}
        </div>
      )}

      {activeTab === 'kegg' && <MetabolicEngPage embedded />}
    </>
  );
});
