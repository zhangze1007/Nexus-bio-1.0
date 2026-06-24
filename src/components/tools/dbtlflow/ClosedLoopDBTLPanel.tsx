'use client';
import React, { useState, useCallback } from 'react';
import { THEME } from '../../../theme';

/* ── Closed-Loop DBTL Panel ─────────────────────────────────────────────── */

export default function ClosedLoopDBTLPanel() {
  const [acquisition, setAcquisition] = useState<'EI' | 'UCB' | 'PI'>('EI');
  const [result, setResult] = useState<import('../../../server/closedLoopDBTLEngine').DBTLResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = useCallback(async () => {
    setLoading(true);
    try {
      const { createCampaign, runClosedLoopDBTL } = await import('../../../server/closedLoopDBTLEngine');
      const campaign = createCampaign('DBTL Optimization', [
        { name: 'temperature', type: 'continuous', bounds: [30, 40] },
        { name: 'pH', type: 'continuous', bounds: [6.0, 8.0] },
        { name: 'inducer_conc', type: 'continuous', bounds: [0.01, 10] },
      ], 'maximize');
      const res = runClosedLoopDBTL(campaign, acquisition, 3);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [acquisition]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={{
        background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 16,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        border: `1px solid ${THEME.BORDER}`,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Acquisition Function
        </span>
        <select value={acquisition} onChange={(e) => setAcquisition(e.target.value as 'EI' | 'UCB' | 'PI')}
          style={{ padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)' }}
        >
          <option value="EI">Expected Improvement (Jones 1998)</option>
          <option value="UCB">Upper Confidence Bound (Srinivas 2012)</option>
          <option value="PI">Probability of Improvement</option>
        </select>
        <button onClick={handleRun} disabled={loading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? 'Optimizing...' : 'Run Closed-Loop DBTL'}
        </button>
        {result && (
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.4)' }}>
            Round {result.convergence.round} | Best: {result.convergence.bestValue} | Converged: {result.convergence.converged ? 'Yes' : 'No'}
          </span>
        )}
      </div>

      {result && (
        <>
          {/* Suggestions */}
          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 6 }}>Next Experiments</div>
            {result.suggestions.map((s, i) => (
              <div key={i} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: 'rgba(255,255,255,0.7)', marginBottom: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                <span style={{ color: THEME.SKY }}>#{i + 1}</span>
                {Object.entries(s.parameters).map(([k, v]) => (
                  <span key={k} style={{ marginLeft: 8 }}>
                    {k}=<span style={{ fontFamily: THEME.MONO }}>{(v as number).toFixed(2)}</span>
                  </span>
                ))}
                <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                  [{s.acquisitionType}={s.acquisitionValue.toFixed(4)}]
                </span>
              </div>
            ))}
          </div>

          {/* Convergence */}
          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 6 }}>Design Notes</div>
            {result.designNotes.map((n, i) => (
              <div key={i} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>• {n}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
