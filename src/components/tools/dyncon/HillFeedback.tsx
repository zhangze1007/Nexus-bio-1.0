'use client';
import React from 'react';
import { THEME } from '../../../theme';
import { DEFAULT_PARAMS, DEFAULT_HILL } from '../../../data/mockDynCon';
import FloatingControlRail from '../shared/FloatingControlRail';
import InlineMetricOverlay from '../shared/InlineMetricOverlay';
import ScientificFigureFrame from '../shared/ScientificFigureFrame';
import ParameterPanel from '../shared/ParameterPanel';
import type { DynConStateReturn } from './useDynConState';
import { HillCurveSVG, ParamSlider } from './sharedComponents';

/* ── Hill Curve Panel (hill tab content) ───────────────────────────────────── */

export function HillCurvePanel({ state }: { state: DynConStateReturn }) {
  const {
    vmax, setVmax, hillKd, setHillKd, hillN, setHillN,
    hill, currentFPP,
  } = state;

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <FloatingControlRail label="Hill Parameters" defaultCollapsed={false} width={260}>
        <ParameterPanel title="Hill Feedback" onReset={() => { setVmax(DEFAULT_HILL.Vmax); setHillKd(DEFAULT_HILL.Kd); setHillN(DEFAULT_HILL.n); }}>
          <ParamSlider label="Vmax" value={vmax} min={0.1} max={2.0} step={0.05} onChange={setVmax} />
          <ParamSlider label="Kd" value={hillKd} min={5} max={200} step={5} onChange={setHillKd} unit="μM" />
          <ParamSlider label="n" value={hillN} min={1} max={4} step={0.5} onChange={setHillN} />
        </ParameterPanel>
      </FloatingControlRail>

      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ScientificFigureFrame
          eyebrow="Hill repression"
          title="Hill feedback curve with operating point"
          caption="f(FPP) = Vmax·Kd^n / (Kd^n + FPP^n). The operating point shows current repression level."
          legend={[
            { label: 'Vmax', value: vmax.toFixed(2), accent: THEME.SKY },
            { label: 'Kd', value: `${hillKd.toFixed(0)} μM`, accent: THEME.LILAC },
            { label: 'n', value: hillN.toFixed(1), accent: THEME.APRICOT },
            { label: 'Operating Pt', value: `${currentFPP.toFixed(1)} μM`, accent: THEME.MINT },
          ]}
          minHeight="100%"
        >
          <HillCurveSVG hill={hill} currentFPP={currentFPP} />
        </ScientificFigureFrame>

        <InlineMetricOverlay
          position="top-right"
          metrics={[
            { label: 'Vmax', value: vmax.toFixed(2), accent: THEME.SKY },
            { label: 'Kd', value: `${hillKd.toFixed(0)} μM`, accent: THEME.LILAC },
            { label: 'Hill coeff', value: hillN.toFixed(1), accent: THEME.APRICOT },
            { label: 'Current FPP', value: `${currentFPP.toFixed(1)} μM`, accent: currentFPP > DEFAULT_PARAMS.fppToxicThreshold ? THEME.CORAL : THEME.MINT },
          ]}
        />
      </div>
    </div>
  );
}
