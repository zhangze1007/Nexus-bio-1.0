'use client';
import React from 'react';
import MetricCard from '../../ide/shared/MetricCard';
import { CIRCUIT_NODES } from '../../../data/mockGECAIR';
import type { GateType } from '../../../data/mockGECAIR';
import { THEME } from '../../../theme';
import ScientificFigureFrame from '../shared/ScientificFigureFrame';
import { CircuitSVG } from './LogicGateDesigner';

export function PhaseSpacePanel({ inputA, inputB, gateType, finalOutput, noiseScore }: {
  inputA: number; inputB: number; gateType: GateType; finalOutput: number; noiseScore: number;
}) {
  return (
    <div style={{ padding: '16px' }}>
      <ScientificFigureFrame
        eyebrow="Phase Space Analysis"
        title={`${gateType} Gate — 2D Phase Space`}
        caption="Viridis heatmap showing gate output as a function of both inputs. Axes: Input A (x) vs Input B (y). Color: output level."
      >
        <CircuitSVG inputA={inputA} inputB={inputB} gateType={gateType} view="phasespace" />
      </ScientificFigureFrame>
      <div style={{ marginTop: '16px', display: 'grid', gap: '8px' }}>
        <MetricCard label="Operating Point" value={`A=${(inputA*100).toFixed(0)}% B=${(inputB*100).toFixed(0)}%`} />
        <MetricCard label="Gate Output" value={(finalOutput * 100).toFixed(1)} unit="%" highlight />
        <MetricCard label="Noise Sensitivity" value={noiseScore.toFixed(4)} warning={noiseScore > 0.05 ? 'High noise' : undefined} />
      </div>
    </div>
  );
}

export function TransferPanel({ inputA, inputB, gateType, finalOutput, outA, outB }: {
  inputA: number; inputB: number; gateType: GateType; finalOutput: number; outA: number; outB: number;
}) {
  return (
    <div style={{ padding: '16px' }}>
      <ScientificFigureFrame
        eyebrow="Transfer Function"
        title={`${gateType} Gate — Hill Response Curves`}
        caption={`Operating point: A=${(inputA*100).toFixed(0)}% B=${(inputB*100).toFixed(0)}% → ${(finalOutput*100).toFixed(1)}% output`}
      >
        <CircuitSVG inputA={inputA} inputB={inputB} gateType={gateType} view="transfer" />
      </ScientificFigureFrame>
      <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <MetricCard label="Sensor A" value={(outA * 100).toFixed(1)} unit="%" />
        <MetricCard label="Sensor B" value={(outB * 100).toFixed(1)} unit="%" />
        <MetricCard label="Combined Output" value={(finalOutput * 100).toFixed(1)} unit="%" highlight />
        <MetricCard label="Circuit Complexity" value={CIRCUIT_NODES.reduce((a, n) => a + n.parts.length, 0)} unit="parts" />
      </div>
    </div>
  );
}
