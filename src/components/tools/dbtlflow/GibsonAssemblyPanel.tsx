'use client';
import React from 'react';
import SimErrorBanner from '../../ide/shared/SimErrorBanner';
import type { GibsonAssemblyPlan } from '../../../types';
import { THEME } from '../../../theme';
import ScientificFigureFrame from '../shared/ScientificFigureFrame';
import ActionButton from '../shared/ActionButton';

/* ── Props ── */
interface GibsonAssemblyPanelProps {
  assemblyPlan: GibsonAssemblyPlan | null;
  assemblyError: string | null;
  seqInput: string;
  setSeqInput: (v: string) => void;
  handlePlanAssembly: () => void;
}

export default function GibsonAssemblyPanel({
  assemblyPlan,
  assemblyError,
  seqInput,
  setSeqInput,
  handlePlanAssembly,
}: GibsonAssemblyPanelProps) {
  return (
    <div style={{ padding: '16px', maxWidth: '640px' }}>
      <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Gibson Assembly Planner</p>
      <textarea
        value={seqInput} onChange={e => setSeqInput(e.target.value)}
        placeholder="Paste target DNA (ATCG)… or leave empty for demo"
        rows={3}
        style={{ width: '100%', padding: '8px', borderRadius: 'var(--nb-radius-md)', border: `1px solid ${THEME.BORDER}`, background: THEME.PANEL_INSET, color: THEME.VALUE, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', resize: 'vertical', marginBottom: '8px' }}
      />
      {assemblyError && <div style={{ marginBottom: '8px' }}><SimErrorBanner message={assemblyError} /></div>}
      <ActionButton
        variant="secondary"
        size="md"
        onClick={handlePlanAssembly}
        style={{ background: 'rgba(191,220,205,0.2)', borderColor: 'rgba(191,220,205,0.34)', marginBottom: '16px' }}
      >
        🧬 Plan Assembly
      </ActionButton>
      {assemblyPlan && (
        <ScientificFigureFrame
          eyebrow="Assembly Plan"
          title={assemblyPlan.targetName}
          caption={`${assemblyPlan.targetLength} bp · ${assemblyPlan.fragments.length} fragments · ${assemblyPlan.primers.length} primers`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            {([['Overlap', assemblyPlan.overlapLength + ' bp'], ['Tm Range', assemblyPlan.expectedTmRange[0].toFixed(1) + '–' + assemblyPlan.expectedTmRange[1].toFixed(1) + ' °C'], ['Tm Spread', assemblyPlan.tmSpread.toFixed(1) + ' °C']] as const).map(([lbl, val]) => (
              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>{lbl}</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ height: '4px', borderRadius: '2px', marginBottom: '8px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '2px', width: Math.min(100, assemblyPlan.tmSpread * 20) + '%', background: assemblyPlan.tmSpread <= 3 ? 'rgba(120,220,160,0.7)' : assemblyPlan.tmSpread <= 5 ? 'rgba(231,199,169,0.78)' : 'rgba(232,163,161,0.78)' }} />
          </div>
          {assemblyPlan.warnings.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              {assemblyPlan.warnings.map((w, i) => <p key={i} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.APRICOT, margin: '0 0 3px' }}>⚠ {w}</p>)}
            </div>
          )}
          <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', margin: '0 0 6px' }}>Fragment Map</p>
          <div style={{ display: 'flex', gap: '2px' }}>
            {assemblyPlan.fragments.map((f, i) => {
              const colors = ['rgba(191,220,205,0.34)', 'rgba(207,196,227,0.34)', 'rgba(175,195,214,0.34)', 'rgba(232,163,161,0.34)'];
              return (
                <div key={f.id} style={{ flex: f.length / assemblyPlan.targetLength, height: '16px', borderRadius: '3px', background: colors[i % 4], border: '1px solid ' + colors[i % 4].replace('0.34', '0.58'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>{f.length}</span>
                </div>
              );
            })}
          </div>
        </ScientificFigureFrame>
      )}
    </div>
  );
}
