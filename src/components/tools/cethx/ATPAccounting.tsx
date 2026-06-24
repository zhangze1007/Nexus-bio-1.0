'use client';
/**
 * ATPAccounting — ATP Ledger tab panel for CETHX.
 * Extracted from CETHXPage.tsx for modularity.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { THEME } from '../../../theme';
import MetricCard from '../../ide/shared/MetricCard';
import type { CETHXThermoResult } from './useCETHXState';

interface ATPAccountingProps {
  thermo: CETHXThermoResult;
}

export default function ATPAccounting({ thermo }: ATPAccountingProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
        <MetricCard label="Net ATP Yield" value={thermo.atp_yield} unit="mol/mol" highlight />
        <MetricCard label="NADH Yield" value={thermo.nadh_yield} unit="mol/mol" />
        <MetricCard label="Reference ΔG Total" value={thermo.gibbs_free_energy} unit="kJ/mol" />
        <MetricCard label="Entropy" value={thermo.entropy_production.toFixed(3)} unit="kJ/mol/K" />
      </div>

      <div style={{ padding: '12px', borderRadius: 'var(--nb-radius-md)', background: THEME.PANEL_INSET, marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Efficiency</span>
          <motion.span
            key={thermo.efficiency}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', fontWeight: 700, color: thermo.efficiency > 50 ? THEME.VALUE : THEME.CORAL }}
          >
            {thermo.efficiency.toFixed(1)}%
          </motion.span>
        </div>
        <div style={{ width: '100%', height: `${THEME.PROGRESS_HEIGHT}px`, borderRadius: `${THEME.PROGRESS_RADIUS}px`, background: THEME.PROGRESS_TRACK }}>
          <motion.div
            animate={{ width: `${Math.min(100, thermo.efficiency)}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              height: '100%', borderRadius: `${THEME.PROGRESS_RADIUS}px`,
              background: thermo.efficiency > 50 ? THEME.PROGRESS_GRADIENT : `linear-gradient(90deg, ${THEME.CORAL}73, ${THEME.CORAL}F2)`,
              boxShadow: thermo.efficiency > 50 ? THEME.PROGRESS_GLOW : `0 0 8px ${THEME.CORAL}52`,
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.LABEL, marginBottom: '10px' }}>
          Step Breakdown
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {thermo.steps.map((s, i) => (
            <motion.div
              key={s.step + i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 0', borderBottom: `1px solid ${THEME.BORDER}`,
              }}
            >
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.step}
              </span>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 600, textAlign: 'right', color: s.deltaG < 0 ? THEME.MINT : THEME.CORAL }}>
                {s.deltaG > 0 ? '+' : ''}{s.deltaG.toFixed(1)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
