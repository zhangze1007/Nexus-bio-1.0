'use client';
import React, { useState } from 'react';
import ConfidenceBadge from '../shared/ConfidenceBadge';
import ParameterPanel from '../shared/ParameterPanel';
import ResultSummaryPanel from '../shared/ResultSummaryPanel';
import { THEME } from '../../../theme';

const DEFAULT_ANNOTATIONS = [
  { geneId: 'b2388', ecNumber: '2.7.1.1', geneName: 'glk', organism: 'E. coli K-12' },
  { geneId: 'b4025', ecNumber: '5.3.1.9', geneName: 'pgi', organism: 'E. coli K-12' },
  { geneId: 'b3916', ecNumber: '2.7.1.11', geneName: 'pfkA', organism: 'E. coli K-12' },
  { geneId: 'b2925', ecNumber: '4.1.2.13', geneName: 'fbaA', organism: 'E. coli K-12' },
  { geneId: 'b3919', ecNumber: '5.3.1.1', geneName: 'tpiA', organism: 'E. coli K-12' },
  { geneId: 'b1779', ecNumber: '1.2.1.12', geneName: 'gapA', organism: 'E. coli K-12' },
  { geneId: 'b2926', ecNumber: '2.7.2.3', geneName: 'pgk', organism: 'E. coli K-12' },
  { geneId: 'b3612', ecNumber: '5.4.2.12', geneName: 'gpmA', organism: 'E. coli K-12' },
  { geneId: 'b2779', ecNumber: '4.2.1.11', geneName: 'eno', organism: 'E. coli K-12' },
  { geneId: 'b1854', ecNumber: '2.7.1.40', geneName: 'pykF', organism: 'E. coli K-12' },
  { geneId: 'b0720', ecNumber: '2.3.3.1', geneName: 'gltA', organism: 'E. coli K-12' },
  { geneId: 'b0118', ecNumber: '4.2.1.3', geneName: 'acnA', organism: 'E. coli K-12' },
  { geneId: 'b1136', ecNumber: '1.1.1.41', geneName: 'icd', organism: 'E. coli K-12' },
  { geneId: 'b0116', ecNumber: '1.2.4.2', geneName: 'sucA', organism: 'E. coli K-12' },
  { geneId: 'b0729', ecNumber: '6.2.1.5', geneName: 'sucC', organism: 'E. coli K-12' },
  { geneId: 'b4154', ecNumber: '1.3.5.1', geneName: 'sdhA', organism: 'E. coli K-12' },
  { geneId: 'b1612', ecNumber: '4.2.1.2', geneName: 'fumA', organism: 'E. coli K-12' },
  { geneId: 'b3236', ecNumber: '1.1.1.37', geneName: 'mdh', organism: 'E. coli K-12' },
  { geneId: 'b1852', ecNumber: '1.1.1.49', geneName: 'zwf', organism: 'E. coli K-12' },
  { geneId: 'b0767', ecNumber: '3.1.1.31', geneName: 'pgl', organism: 'E. coli K-12' },
  { geneId: 'b2029', ecNumber: '1.1.1.44', geneName: 'gnd', organism: 'E. coli K-12' },
  { geneId: 'b3386', ecNumber: '5.1.3.1', geneName: 'rpe', organism: 'E. coli K-12' },
  { geneId: 'b2914', ecNumber: '5.3.1.6', geneName: 'rpiA', organism: 'E. coli K-12' },
  { geneId: 'b2465', ecNumber: '2.2.1.1', geneName: 'tktA', organism: 'E. coli K-12' },
  { geneId: 'b2464', ecNumber: '2.2.1.2', geneName: 'talB', organism: 'E. coli K-12' },
  { geneId: 'b4053', ecNumber: '2.6.1.2', geneName: 'avtA', organism: 'E. coli K-12' },
  { geneId: 'b3744', ecNumber: '6.3.5.4', geneName: 'asnB', organism: 'E. coli K-12' },
  { geneId: 'b3213', ecNumber: '6.3.1.2', geneName: 'glnA', organism: 'E. coli K-12' },
  { geneId: 'b2551', ecNumber: '2.7.1.39', geneName: 'thrB', organism: 'E. coli K-12' },
  { geneId: 'b0002', ecNumber: '4.2.3.1', geneName: 'thrC', organism: 'E. coli K-12' },
  { geneId: 'b1260', ecNumber: '2.7.2.4', geneName: 'lysC', organism: 'E. coli K-12' },
  { geneId: 'b3433', ecNumber: '1.2.1.11', geneName: 'asd', organism: 'E. coli K-12' },
  { geneId: 'b1131', ecNumber: '6.3.4.13', geneName: 'purD', organism: 'E. coli K-12' },
  { geneId: 'b2508', ecNumber: '6.3.5.2', geneName: 'guaA', organism: 'E. coli K-12' },
  { geneId: 'b0523', ecNumber: '2.7.4.6', geneName: 'ndk', organism: 'E. coli K-12' },
  { geneId: 'b1064', ecNumber: '6.3.4.2', geneName: 'pyrG', organism: 'E. coli K-12' },
  { geneId: 'b1740', ecNumber: '6.3.1.5', geneName: 'nadE', organism: 'E. coli K-12' },
  { geneId: 'b1147', ecNumber: '2.7.7.3', geneName: 'coaD', organism: 'E. coli K-12' },
  { geneId: 'b3256', ecNumber: '6.4.1.2', geneName: 'accC', organism: 'E. coli K-12' },
  { geneId: 'b1093', ecNumber: '2.3.1.39', geneName: 'fabD', organism: 'E. coli K-12' },
  { geneId: 'b1101', ecNumber: '2.7.1.69', geneName: 'ptsG', organism: 'E. coli K-12' },
  { geneId: 'b3540', ecNumber: '7.5.2.1', geneName: 'malK', organism: 'E. coli K-12' },
];

export function GEMReconstructionPanel() {
  const [organism, setOrganism] = useState('E. coli K-12');
  const [gapFill, setGapFill] = useState(true);
  const [includeBiomass, setIncludeBiomass] = useState(true);
  const [result, setResult] = useState<import('../../../modules/gem-automation').GEMOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReconstruct = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { automateGEM } = await import('../../../modules/gem-automation');
      const res = automateGEM({ annotations: DEFAULT_ANNOTATIONS, organism, gapFill, includeBiomass });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GEM reconstruction failed');
    } finally {
      setLoading(false);
    }
  }, [organism, gapFill, includeBiomass]);

  const gapConfidence = result
    ? result.gapFilling.addedReactions.length > 0
      ? Math.max(0.5, 1 - result.gapFilling.addedReactions.length * 0.1)
      : 1
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px', overflowY: 'auto', flex: 1 }}>
      <ParameterPanel title="GEM Parameters">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Organism
            </label>
            <select value={organism} onChange={(e) => setOrganism(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)' }}
            >
              <option value="E. coli K-12">E. coli K-12</option>
              <option value="S. cerevisiae">S. cerevisiae</option>
              <option value="B. subtilis">B. subtilis</option>
              <option value="Corynebacterium glutamicum">C. glutamicum</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Biomass Formula
            </label>
            <div style={{ padding: '6px 10px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>
              Auto-derived from annotations
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Media Composition
            </label>
            <div style={{ padding: '6px 10px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>
              M9 minimal + exchange reactions
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setGapFill(!gapFill)}
            className={`nb-tool-toggle${gapFill ? ' nb-tool-toggle--active' : ''}`}
            aria-pressed={gapFill}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: 'var(--nb-radius-sm)', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)' }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: gapFill ? THEME.MINT : 'transparent', border: `1px solid ${THEME.MINT}`, flexShrink: 0 }} />
            Gap-filling
          </button>
          <button onClick={() => setIncludeBiomass(!includeBiomass)}
            className={`nb-tool-toggle${includeBiomass ? ' nb-tool-toggle--active' : ''}`}
            aria-pressed={includeBiomass}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: 'var(--nb-radius-sm)', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)' }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: includeBiomass ? THEME.MINT : 'transparent', border: `1px solid ${THEME.MINT}`, flexShrink: 0 }} />
            Biomass reaction
          </button>
          <button onClick={handleReconstruct} disabled={loading} className="nb-tool-toggle"
            style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
          >
            {loading ? 'Reconstructing...' : 'Reconstruct GEM'}
          </button>
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL }}>
            {DEFAULT_ANNOTATIONS.length} gene annotations loaded
          </span>
        </div>
      </ParameterPanel>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--nb-radius-md)', background: 'rgba(250,128,114,0.12)', border: '1px solid rgba(250,128,114,0.35)', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.CORAL }}>
          {error}
        </div>
      )}

      {result && (
        <>
          <ResultSummaryPanel
            metrics={[
              { label: 'Reactions', value: result.stats.nReactions, accent: THEME.SKY },
              { label: 'Metabolites', value: result.stats.nMetabolites, accent: THEME.LILAC },
              { label: 'Genes', value: result.stats.nGenes, accent: THEME.APRICOT },
              { label: 'Gaps Filled', value: result.stats.nGapFilled, accent: THEME.MINT },
              { label: 'Essential', value: result.stats.nEssential, accent: THEME.CORAL },
            ]}
            actions={<ConfidenceBadge value={gapConfidence} label="Gap confidence" />}
          />

          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Subsystem Breakdown
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {(() => {
                const subsystems = new Map<string, number>();
                for (const rxn of result.model.reactions) {
                  subsystems.set(rxn.subsystem, (subsystems.get(rxn.subsystem) ?? 0) + 1);
                }
                return Array.from(subsystems.entries()).sort((a, b) => b[1] - a[1]).map(([sub, count]) => (
                  <div key={sub} style={{
                    padding: '8px 10px', borderRadius: 'var(--nb-radius-sm)',
                    background: THEME.PANEL_INSET, border: `1px solid ${THEME.BORDER}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.MINT, fontWeight: 700, marginLeft: 8, flexShrink: 0 }}>{count}</span>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Gap-Filling Report
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE }}>
                {result.gapFilling.addedReactions.length} reactions added
              </span>
              <ConfidenceBadge value={gapConfidence} thresholds={{ high: 0.8, low: 0.5 }} />
            </div>
            {result.gapFilling.reason.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.gapFilling.reason.map((reason, i) => (
                  <div key={i} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, padding: '4px 8px', background: 'rgba(191,220,205,0.06)', borderRadius: '3px', borderLeft: `2px solid ${THEME.MINT}` }}>
                    {reason}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL }}>
                No gaps detected — model is complete.
              </div>
            )}
          </div>

          {result.essentialGenes.length > 0 && (
            <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14, border: `1px solid ${THEME.BORDER}` }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Essential Genes ({result.essentialGenes.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {result.essentialGenes.map((g, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 'var(--nb-radius-sm)', background: 'rgba(232,163,161,0.06)', border: '1px solid rgba(232,163,161,0.15)' }}>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.CORAL, fontWeight: 700, minWidth: 60 }}>{g.geneId}</span>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE, flex: 1 }}>{g.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Reconstruction Notes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.designNotes.map((note, i) => (
                <div key={i} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                  {note}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Model Reactions (top 20 of {result.model.reactions.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${THEME.BORDER_STRONG}` }}>
                    {['ID', 'Name', 'Subsystem', 'EC', 'Rev.'].map(h => (
                      <th key={h} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: THEME.LABEL, padding: '5px 8px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.model.reactions.slice(0, 20).map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? 'transparent' : THEME.PANEL_INSET }}>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.MINT }}>{r.id}</td>
                      <td style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.VALUE }}>{r.name}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.LABEL }}>{r.subsystem}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.LABEL }}>{r.ecNumber || '—'}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: r.reversible ? THEME.MINT : THEME.LABEL }}>{r.reversible ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!result && !loading && !error && (
        <div style={{ padding: '32px', textAlign: 'center', background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', border: `1px solid ${THEME.BORDER}` }}>
          <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL, marginBottom: 8 }}>
            Reconstruct a genome-scale metabolic model from gene annotations.
          </div>
          <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.DIM }}>
            {DEFAULT_ANNOTATIONS.length} E. coli K-12 annotations loaded across glycolysis, TCA, PPP, amino acid, nucleotide, cofactor, fatty acid, and transport subsystems.
          </div>
        </div>
      )}
    </div>
  );
}
