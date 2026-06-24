'use client';
import React, { useState, useCallback } from 'react';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { CIRCUIT_NODES } from '../../data/mockGECAIR';
import type { GateType } from '../../data/mockGECAIR';
import { THEME } from '../../theme';
import WorkbenchRangeSlider from './shared/WorkbenchRangeSlider';
import ScientificHero from './shared/ScientificHero';
import ToolShell from './shared/ToolShell';
import type { ToolTab } from './shared/ToolTabBar';
import ToolTabPanel from './shared/ToolTabPanel';
import NextStepButton from '../NextStepButton';
import DataSourceBadge from '../ide/shared/DataSourceBadge';

import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import { PAPER_THEME } from '../charts/chartTheme';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { useGECAIRState } from './gecair/useGECAIRState';
import { CircuitSVG } from './gecair/LogicGateDesigner';
import { TRUTH_TABLE } from './gecair/sharedComponents';
import { PhaseSpacePanel, TransferPanel } from './gecair/HillCurveModeler';
import { ODEMiniDynamics, DynamicsTabPanel } from './gecair/CircuitDynamics';

/* ── Circuit Compiler Panel ── */
function CircuitCompilerPanel() {
  const [inputs, setInputs] = useState('A,B');
  const [output, setOutput] = useState('Y');
  const [truthTableRows, setTruthTableRows] = useState('0,0,0\n0,1,1\n1,0,1\n1,1,1');
  const [result, setResult] = useState<import('../../server/circuitCompilerEngine').GeneticCircuit | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCompile = useCallback(async () => {
    setLoading(true);
    try {
      const { compileCircuit } = await import('../../server/circuitCompilerEngine');
      const inputNames = inputs.split(',').map(s => s.trim());
      const rows = truthTableRows.split('\n').filter(r => r.trim()).map(row => {
        const vals = row.split(',').map(v => v.trim());
        const inputValues: Record<string, boolean> = {};
        inputNames.forEach((name, i) => { inputValues[name] = vals[i] === '1'; });
        return { inputValues, outputValue: vals[inputNames.length] === '1' };
      });
      const tt = { inputs: inputNames, output, rows };
      const res = compileCircuit('User Circuit', tt);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [inputs, output, truthTableRows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={{
        background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 16,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        border: `1px solid ${THEME.BORDER}`,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Inputs</span>
        <input value={inputs} onChange={(e) => setInputs(e.target.value)} placeholder="A,B"
          style={{ width: 100, padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', outline: 'none' }}
        />
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Output</span>
        <input value={output} onChange={(e) => setOutput(e.target.value)} placeholder="Y"
          style={{ width: 50, padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', outline: 'none' }}
        />
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Truth Table</span>
        <textarea value={truthTableRows} onChange={(e) => setTruthTableRows(e.target.value)}
          rows={4} cols={20}
          style={{ padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', outline: 'none', resize: 'vertical' }}
        />
        <button onClick={handleCompile} disabled={loading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? 'Compiling...' : 'Compile Circuit'}
        </button>
      </div>

      {result && (
        <>
          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 6 }}>Gates</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {result.gates.map((g, i) => (
                <span key={i} style={{
                  padding: '3px 8px',
                  background: g.source === 'cello_characterized' ? 'rgba(147,203,82,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${g.source === 'cello_characterized' ? 'rgba(147,203,82,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '3px',
                  fontFamily: THEME.MONO,
                  fontSize: 'var(--nb-fs-xs)',
                  color: 'rgba(255,255,255,0.7)',
                }}>
                  {g.type} → {g.output}
                  <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>[{g.source}]</span>
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, border: `1px solid ${THEME.BORDER}` }}>
            {[
              { label: 'Dynamic Range', value: result.metrics.dynamicRange.toFixed(1), color: THEME.MINT },
              { label: 'Signal/Noise', value: result.metrics.signalToNoise.toFixed(1), color: THEME.SKY },
              { label: 'Orthogonality', value: result.metrics.orthogonality.toFixed(2), color: THEME.LILAC },
              { label: 'Burden', value: (result.burden * 100).toFixed(0) + '%', color: result.burden > 0.3 ? 'rgba(250,128,114,0.7)' : 'rgba(147,203,82,0.7)' },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL }}>{m.label}</div>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: m.color, fontWeight: 600 }}>{m.value}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function GECAIRPage() {
  const catalystPayload = useWorkbenchStore((s) => s.toolPayloads.catdes);
  const dynconPayload = useWorkbenchStore((s) => s.toolPayloads.dyncon);
  const state = useGECAIRState();
  const {
    inputA, setInputA, inputB, setInputB,
    gateType, setGateType, circuitType, setCircuitType,
    togglePerturbation, setTogglePerturbation,
    activeTab, setActiveTab,
    stochasticMode, setStochasticMode, ensembleRuns, setEnsembleRuns,
    pipelineResult, setPipelineResult, pipelineLoading, setPipelineLoading, pipelineError, setPipelineError,
    recommendedGate, outA, outB, finalOutput, noiseScore,
    exportData, figureMeta, stochasticEnsemble,
  } = state;
  const tabs: ToolTab[] = [
    { id: 'circuit', label: 'Circuit' }, { id: 'phasespace', label: 'Phase Space' },
    { id: 'transfer', label: 'Transfer' }, { id: 'dynamics', label: 'Dynamics' },
    { id: 'truth', label: 'Truth Table' }, { id: 'compiler', label: 'Compiler' },
  ];

  return (
    <ToolShell
      moduleId="gecair"
      title="Gene Circuit AI Reasoner"
      description="Hill-function kinetics model promoter activity with logic gate design"
      formula="f(x) = Kⁿ/(Kⁿ+xⁿ)"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['phasespace', 'transfer', 'dynamics']}
    >
      {/* ═══════ CIRCUIT TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="circuit">
        <div style={{ padding: '0 16px 10px' }}>
          <ScientificHero
            eyebrow="Stage 3 · Gene Circuit Programming"
            title={`${gateType} logic for the current chassis objective`}
            summary="GECAIR now reads as a control-design page rather than a circuit toy. The important question is whether the selected logic stabilizes the current pathway and burden context, not just whether the gate truth table looks correct."
            aside={
              <>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Recommended logic
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.value, fontWeight: 700 }}>
                  {recommendedGate} gate from current burden and control context
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.label, lineHeight: 1.55 }}>
                  Catalyst burden and controller stability are already being used here to bias the circuit topology instead of leaving logic selection arbitrary.
                </div>
              </>
            }
            signals={[
              {
                label: 'Output Expression',
                value: `${(finalOutput * 100).toFixed(1)}%`,
                detail: `Node A ${(outA * 100).toFixed(0)}% · Node B ${(outB * 100).toFixed(0)}% through the present gate sequence`,
                tone: finalOutput > 0.5 ? 'cool' : 'warm',
              },
              {
                label: 'Noise Sensitivity',
                value: noiseScore.toFixed(4),
                detail: noiseScore > 0.05 ? 'Circuit is sensitive to small input perturbations and may need insulation.' : 'Noise remains in a manageable range for this design.',
                tone: noiseScore > 0.05 ? 'alert' : 'cool',
              },
              {
                label: 'Input Envelope',
                value: `A ${(inputA * 100).toFixed(0)} · B ${(inputB * 100).toFixed(0)}`,
                detail: 'These inputs are seeded from the current control and catalyst state, not manually invented defaults.',
                tone: 'neutral',
              },
              {
                label: 'Circuit Complexity',
                value: `${CIRCUIT_NODES.reduce((sum, node) => sum + node.parts.length, 0)} parts`,
                detail: 'Part count remains visible so logic ambition stays grounded in buildability.',
                tone: 'neutral',
              },
            ]}
          />
        </div>

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificMethodStrip
            label="Circuit design bench"
            items={[
              {
                title: 'Input envelope',
                detail: 'The controller and catalyst state seed the gate inputs so circuit design starts from system pressure instead of abstract binary examples.',
                accent: THEME.sky,
                note: `A ${(inputA * 100).toFixed(0)}% · B ${(inputB * 100).toFixed(0)}%`,
              },
              {
                title: 'Logic architecture',
                detail: 'Promoter, RBS, CDS, terminator, and phase-space response are grouped into one publication-style figure rather than split across dashboard cards.',
                accent: THEME.lilac,
                note: `${gateType} gate`,
              },
              {
                title: 'Stability readout',
                detail: 'Noise sensitivity and output level remain visible next to the figure so buildability and control quality stay attached to the same decision.',
                accent: THEME.mint,
                note: `noise ${noiseScore.toFixed(4)}`,
              },
            ]}
          />
        </div>

        <div className="nb-tool-panels" style={{ flex: 1 }}>
          {/* Input panel */}
          <div className="nb-tool-sidebar" style={{ width: '240px', borderRight: `1px solid ${THEME.paperBorder}`, background: THEME.sepiaPanelMuted }}>
            <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.paperLabel, margin: '0 0 12px' }}>
              Input Signals
            </p>

            <WorkbenchRangeSlider label="Input A strength" value={inputA} min={0} max={1} step={0.05} formatValue={v => `${(v * 100).toFixed(0)}%`} onChange={setInputA} />
            <WorkbenchRangeSlider label="Input B strength" value={inputB} min={0} max={1} step={0.05} formatValue={v => `${(v * 100).toFixed(0)}%`} onChange={setInputB} />

            <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.paperLabel, margin: '16px 0 8px' }}>
              Output Gate Type
            </p>
            {(['NOT', 'AND', 'OR', 'NAND'] as GateType[]).map(gate => (
              <button aria-label={`Select ${gate} gate type`} key={gate} onClick={() => setGateType(gate)} className={`nb-tool-toggle ${gateType === gate ? 'nb-tool-toggle--active' : ''}`}>
                {gate} Gate
              </button>
            ))}

            <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.paperLabel, margin: '16px 0 8px' }}>
              Truth Table
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['A', 'B', 'OUT'].map(h => (
                    <th key={h} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, padding: '3px 6px', textAlign: 'center', borderBottom: `1px solid ${THEME.paperBorder}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRUTH_TABLE.map((row, i) => {
                  const a = row.A > 0.5 ? 1 : 0;
                  const b = row.B > 0.5 ? 1 : 0;
                  const out = gateType === 'AND' ? a && b
                    : gateType === 'OR' ? a || b
                    : gateType === 'NAND' ? (!(a && b)) ? 1 : 0
                    : 1 - a;
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : THEME.paperSurfaceMuted }}>
                      {[row.A, row.B, out].map((v, j) => (
                        <td key={j} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textAlign: 'center', padding: '4px', color: v ? THEME.mint : THEME.paperLabel }}>
                          {v ? '1' : '0'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Engine view */}
          <div className="nb-tool-center" style={{ flex: 1, background: THEME.sepiaPanelMuted, padding: '12px', minWidth: 0 }}>
            <ScientificFigureFrame
              eyebrow={figureMeta.eyebrow}
              title={figureMeta.title}
              caption={figureMeta.caption}
              legend={[
                { label: 'Gate', value: gateType, accent: THEME.lilac },
                { label: 'Input A', value: `${(inputA * 100).toFixed(0)}%`, accent: THEME.coral },
                { label: 'Input B', value: `${(inputB * 100).toFixed(0)}%`, accent: THEME.apricot },
                { label: 'Output', value: `${(finalOutput * 100).toFixed(1)}%`, accent: THEME.mint },
              ]}
              footer={
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, lineHeight: 1.55 }}>
                    The page now treats the circuit as a scientific control object: architecture, phase space, transfer response, and node state are presented as one figure so logic choice can be defended from first principles.
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
                    recommended gate {recommendedGate} · node outputs {(outA * 100).toFixed(0)} / {(outB * 100).toFixed(0)} · noise {noiseScore.toFixed(4)}
                  </div>
                </div>
              }
              minHeight="100%"
            >
              <div style={{ minHeight: '500px' }}>
                <CircuitSVG inputA={inputA} inputB={inputB} gateType={gateType} />
              </div>
            </ScientificFigureFrame>
          </div>

          {/* Results panel */}
          <div className="nb-tool-right" style={{ width: '240px', borderLeft: `1px solid ${THEME.paperBorder}`, background: THEME.sepiaPanelMuted }}>
            <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.paperLabel, margin: '0 0 12px' }}>
              Circuit Readouts
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetricCard label="Output Level (GFP)" value={(finalOutput * 100).toFixed(1)} unit="%" highlight />
              <MetricCard label="Node A Output" value={(outA * 100).toFixed(1)} unit="%" />
              <MetricCard label="Node B Output" value={(outB * 100).toFixed(1)} unit="%" />
              <MetricCard label="Noise Sensitivity" value={noiseScore.toFixed(4)} warning={noiseScore > 0.05 ? 'High noise sensitivity — consider insulator parts' : undefined} />
              <MetricCard label="Circuit Complexity" value={CIRCUIT_NODES.reduce((a, n) => a + n.parts.length, 0)} unit="parts" />
            </div>

            {/* Circuit Type Selector */}
            <div style={{ marginTop: '12px', padding: '12px', borderRadius: 'var(--nb-radius-md)', border: `1px solid ${THEME.paperBorder}`, background: THEME.paperSurfaceStrong }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                ODE Circuit Model
              </div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {(['repressilator', 'toggle_switch', 'logic_cascade'] as const).map(ct => (
                  <button
                    key={ct}
                    aria-label={`Select ${ct === 'repressilator' ? 'Repressilator' : ct === 'toggle_switch' ? 'Toggle Switch' : 'Logic Cascade'} circuit`}
                    onClick={() => setCircuitType(ct)}
                    className={`nb-tool-toggle ${circuitType === ct ? 'nb-tool-toggle--active' : ''}`}
                  >
                    {ct === 'repressilator' ? 'Repressilator' : ct === 'toggle_switch' ? 'Toggle Switch' : 'Logic Cascade'}
                  </button>
                ))}
              </div>
              {circuitType === 'toggle_switch' && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: '11px', color: THEME.paperLabel, alignSelf: 'center' }}>Perturbation:</span>
                  {(['A', 'B'] as const).map(p => (
                    <button
                      key={p}
                      aria-label={`Toggle switch perturbation ${p}`}
                      onClick={() => setTogglePerturbation(p)}
                      className={`nb-tool-toggle ${togglePerturbation === p ? 'nb-tool-toggle--active' : ''}`}
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                      State {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ODE Dynamics — Real RK4 simulation */}
            <ODEMiniDynamics circuitType={circuitType} togglePerturbation={togglePerturbation} />

            <div style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: 'var(--nb-radius-md)',
              border: `1px solid ${THEME.paperBorder}`,
              background: THEME.paperSurfaceStrong,
              display: 'grid',
              gap: '6px',
            }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Recommendation
              </div>
              <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, lineHeight: 1.55 }}>
                {recommendedGate === gateType
                  ? 'The active gate agrees with the system-derived recommendation, so the control story is internally coherent.'
                  : 'The active gate differs from the system-derived recommendation, which is useful when stress-testing alternative logic before build.'}
              </div>
            </div>

            {/* ── Pipeline Section ── */}
            <div style={{
              marginTop: '12px', padding: '12px',
              borderRadius: 'var(--nb-radius-md)',
              border: `1px solid ${THEME.paperBorder}`,
              background: THEME.paperSurfaceStrong,
            }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Circuit Pipeline
              </div>
              <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: '0 0 8px' }}>
                Optimize circuit topology for current metabolic context.
              </p>
              <button
                onClick={async () => {
                  setPipelineLoading(true);
                  setPipelineError(null);
                  try {
                    const res = await fetch('/api/pipeline/gecair', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ gateType, inputA, inputB, output: finalOutput, noiseScore }),
                    });
                    if (!res.ok) throw new Error(`Pipeline failed (${res.status})`);
                    const data = await res.json();
                    setPipelineResult(data.result);
                  } catch (err) {
                    setPipelineError(err instanceof Error ? err.message : 'Pipeline failed');
                  } finally {
                    setPipelineLoading(false);
                  }
                }}
                disabled={pipelineLoading}
                style={{
                  width: '100%', padding: '6px 14px', borderRadius: 'var(--nb-radius-sm)',
                  background: pipelineLoading ? 'rgba(255,255,255,0.04)' : 'rgba(191,220,205,0.14)',
                  border: `1px solid ${pipelineLoading ? 'rgba(255,255,255,0.08)' : 'rgba(191,220,205,0.3)'}`,
                  color: pipelineLoading ? 'rgba(255,255,255,0.35)' : 'rgba(191,220,205,0.9)',
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                  cursor: pipelineLoading ? 'wait' : 'pointer',
                }}
              >
                {pipelineLoading ? 'Running Pipeline...' : 'Run Pipeline'}
              </button>
              {pipelineError && (
                <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.CORAL, margin: '6px 0 0' }}>
                  {pipelineError}
                </p>
              )}
              {pipelineResult && (
                <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(191,220,205,0.08)', border: '1px solid rgba(191,220,205,0.15)', borderRadius: 'var(--nb-radius-sm)' }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue }}>
                    Gate: {pipelineResult.recommendedGate} | Out: {(pipelineResult.outputLevel * 100).toFixed(1)}% | Noise: {pipelineResult.noiseScore.toFixed(4)}
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.paperLabel, marginTop: 2 }}>
                    {pipelineResult.stability} | {pipelineResult.optimizationSteps} steps
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ToolTabPanel>
      {/* ═══════ PHASE SPACE TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="phasespace">
        <PhaseSpacePanel inputA={inputA} inputB={inputB} gateType={gateType} finalOutput={finalOutput} noiseScore={noiseScore} />
      </ToolTabPanel>
      {/* ═══════ TRANSFER TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="transfer">
        <TransferPanel inputA={inputA} inputB={inputB} gateType={gateType} finalOutput={finalOutput} outA={outA} outB={outB} />
      </ToolTabPanel>
      {/* ═══════ DYNAMICS TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="dynamics">
        <DynamicsTabPanel circuitType={circuitType} setCircuitType={setCircuitType} stochasticMode={stochasticMode} setStochasticMode={setStochasticMode} ensembleRuns={ensembleRuns} setEnsembleRuns={setEnsembleRuns} togglePerturbation={togglePerturbation} setTogglePerturbation={setTogglePerturbation} stochasticEnsemble={stochasticEnsemble} />
      </ToolTabPanel>
      {/* ═══════ TRUTH TABLE TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="truth">
        <div style={{ padding: '16px', maxWidth: '400px' }}>
          <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
            {gateType} Gate Truth Table
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: 'var(--nb-radius-md)', overflow: 'hidden', border: `1px solid ${THEME.BORDER}` }}>
            <thead>
              <tr>
                {['A', 'B', 'OUT'].map(h => (
                  <th key={h} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL, padding: '8px 12px', textAlign: 'center', background: THEME.PANEL_INSET, borderBottom: `1px solid ${THEME.BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRUTH_TABLE.map((row, i) => {
                const a = row.A > 0.5 ? 1 : 0;
                const b = row.B > 0.5 ? 1 : 0;
                const out = gateType === 'AND' ? a && b : gateType === 'OR' ? a || b : gateType === 'NAND' ? !(a && b) ? 1 : 0 : 1 - a;
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : PAPER_THEME.bgAlt }}>
                    {[row.A, row.B, out].map((v, j) => (
                      <td key={j} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', textAlign: 'center', padding: '8px 12px', color: v ? THEME.MINT : THEME.LABEL, fontWeight: v ? 600 : 400 }}>
                        {v ? '1' : '0'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ToolTabPanel>
      {/* ── Circuit Compiler Tab ── */}
      <ToolTabPanel activeId={activeTab} tabId="compiler">
        <CircuitCompilerPanel />
      </ToolTabPanel>
      {/* ═══════ Footer ═══════ */}
      <div style={{ borderTop: `1px solid ${THEME.BORDER}`, padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, background: THEME.PANEL_MUTED }}>
        <DataSourceBadge source={catalystPayload || dynconPayload ? 'live' : 'mock'} label={catalystPayload || dynconPayload ? 'Upstream Data' : 'Default Inputs'} />
        <ExportButton label="Export JSON" data={exportData} filename="gecair-circuit" format="json" />
      </div>
      <NextStepButton currentStepId="gecair" />
    </ToolShell>
  );
}
