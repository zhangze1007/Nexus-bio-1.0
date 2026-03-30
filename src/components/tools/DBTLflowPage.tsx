'use client';
import { useState } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { INITIAL_ITERATIONS, appendIteration } from '../../data/mockDBTL';
import type { DBTLIteration } from '../../types';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

const PHASE_COLORS: Record<string, string> = {
  Design: 'rgba(120,180,255,0.8)',
  Build:  'rgba(255,200,80,0.8)',
  Test:   'rgba(120,255,180,0.8)',
  Learn:  'rgba(200,120,255,0.8)',
};

function Timeline({ iterations }: { iterations: DBTLIteration[] }) {
  const maxResult = Math.max(...iterations.map(i => i.result));

  return (
    <svg viewBox={`0 0 520 ${Math.max(360, iterations.length * 60 + 40)}`}
      style={{ width: '100%', height: '100%' }}>
      <rect width="520" height={Math.max(360, iterations.length * 60 + 40)} fill="#0d0f14" />
      {iterations.length > 1 && (
        <polyline
          points={iterations.map((it, i) => `${160 + (it.result / maxResult) * 280},${30 + i * 60 + 20}`).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="4 3"
        />
      )}
      <line x1={160} y1={20} x2={160} y2={30 + iterations.length * 60} stroke="rgba(255,255,255,0.08)" />
      {iterations.map((it, i) => {
        const y = 30 + i * 60;
        const barW = (it.result / maxResult) * 280;
        const phaseColor = PHASE_COLORS[it.phase] ?? 'rgba(255,255,255,0.4)';
        return (
          <g key={it.id}>
            <rect x={4} y={y + 8} width={60} height={18} rx="3"
              fill={phaseColor} fillOpacity={0.15} stroke={phaseColor} strokeWidth={1} />
            <text x={34} y={y + 20} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={phaseColor}>
              {it.phase.toUpperCase()}
            </text>
            <text x={80} y={y + 20} fontFamily={MONO} fontSize="9" fill="rgba(255,255,255,0.3)">
              #{it.id}
            </text>
            <text x={100} y={y + 20} fontFamily={SANS} fontSize="9" fill="rgba(255,255,255,0.5)">
              {it.hypothesis.slice(0, 40)}{it.hypothesis.length > 40 ? '…' : ''}
            </text>
            <rect x={160} y={y + 28} width={barW} height={10} rx="2"
              fill={it.passed ? 'rgba(120,220,180,0.4)' : 'rgba(255,80,80,0.3)'}
              stroke={it.passed ? 'rgba(120,220,180,0.7)' : 'rgba(255,80,80,0.5)'}
              strokeWidth={1}
            />
            <text x={160 + barW + 6} y={y + 38} fontFamily={MONO} fontSize="9"
              fill={it.passed ? 'rgba(120,220,180,0.8)' : 'rgba(255,100,80,0.7)'}>
              {it.result} {it.unit}
            </text>
            <circle cx={440} cy={y + 22} r={5}
              fill={it.passed ? 'rgba(120,220,180,0.7)' : 'rgba(255,80,80,0.6)'} />
            <line x1={4} y1={y + 52} x2={480} y2={y + 52} stroke="rgba(255,255,255,0.04)" />
          </g>
        );
      })}
      <text x={160} y={30 + iterations.length * 60 + 16} fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.2)">0</text>
      <text x={440} y={30 + iterations.length * 60 + 16} fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.2)">
        {maxResult.toFixed(0)} {iterations[0]?.unit}
      </text>
    </svg>
  );
}

export default function DBTLflowPage() {
  const [iterations, setIterations] = useState<DBTLIteration[]>(INITIAL_ITERATIONS);
  const [hypothesis, setHypothesis] = useState('');
  const [result, setResult] = useState('');
  const [unit, setUnit] = useState('mg/L');
  const [passed, setPassed] = useState(true);

  const bestIteration = iterations.reduce((a, b) => b.result > a.result ? b : a, iterations[0]);
  const improvementRate = iterations.length > 1
    ? ((iterations[iterations.length - 1].result - iterations[0].result) / iterations.length).toFixed(2)
    : '0';
  const passRate = (iterations.filter(i => i.passed).length / iterations.length * 100).toFixed(0);

  function addIteration() {
    if (!hypothesis.trim() || !result.trim()) return;
    setIterations(prev => appendIteration(prev, hypothesis, parseFloat(result), unit, passed));
    setHypothesis('');
    setResult('');
  }

  return (
    <IDEShell moduleId="dbtlflow">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#F5F7FA' }}>
        <AlgorithmInsight
          title="Design-Build-Test-Learn Tracker"
          description="Iterative experimental optimization. Each cycle records a hypothesis, measured result, and learning for the next design."
          formula="Cycle: D→B→T→L→D'"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Input panel */}
          <div style={{ width: '260px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderRight: '1px solid rgba(0,0,0,0.07)', background: '#FFFFFF' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '0 0 12px' }}>
              Add Iteration
            </p>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(0,0,0,0.5)', display: 'block', marginBottom: '4px' }}>
                Hypothesis
              </label>
              <textarea value={hypothesis} onChange={e => setHypothesis(e.target.value)}
                placeholder="Describe the engineering hypothesis..."
                rows={3}
                style={{
                  width: '100%', padding: '6px 8px', boxSizing: 'border-box',
                  background: 'rgba(0,0,0,0.04)',
                  border: '1px solid rgba(0,0,0,0.10)',
                  borderRadius: '8px',
                  color: 'rgba(0,0,0,0.75)',
                  fontFamily: SANS, fontSize: '11px',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(0,0,0,0.5)', display: 'block', marginBottom: '4px' }}>
                  Result
                </label>
                <input type="number" value={result} onChange={e => setResult(e.target.value)}
                  placeholder="0.0"
                  style={{
                    width: '100%', padding: '5px 8px', boxSizing: 'border-box',
                    background: 'rgba(0,0,0,0.04)',
                    border: '1px solid rgba(0,0,0,0.10)',
                    borderRadius: '8px',
                    color: 'rgba(0,0,0,0.75)',
                    fontFamily: MONO, fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ width: '70px' }}>
                <label style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(0,0,0,0.5)', display: 'block', marginBottom: '4px' }}>
                  Unit
                </label>
                <input value={unit} onChange={e => setUnit(e.target.value)}
                  style={{
                    width: '100%', padding: '5px 6px', boxSizing: 'border-box',
                    background: 'rgba(0,0,0,0.04)',
                    border: '1px solid rgba(0,0,0,0.10)',
                    borderRadius: '8px',
                    color: 'rgba(0,0,0,0.75)',
                    fontFamily: MONO, fontSize: '11px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {[true, false].map(p => (
                <button key={String(p)} onClick={() => setPassed(p)} style={{
                  flex: 1, padding: '6px',
                  background: passed === p ? (p ? 'rgba(200,240,224,0.4)' : 'rgba(255,80,80,0.08)') : 'transparent',
                  border: `1px solid ${passed === p ? (p ? 'rgba(0,150,80,0.3)' : 'rgba(200,60,60,0.3)') : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: '8px',
                  color: passed === p ? (p ? 'rgba(0,120,60,0.9)' : 'rgba(180,40,40,0.9)') : 'rgba(0,0,0,0.35)',
                  fontFamily: SANS, fontSize: '11px', cursor: 'pointer',
                }}>
                  {p ? '✓ Pass' : '✗ Fail'}
                </button>
              ))}
            </div>

            <button onClick={addIteration} disabled={!hypothesis.trim() || !result.trim()} style={{
              width: '100%', padding: '8px',
              background: 'rgba(0,0,0,0.05)',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: '8px',
              color: 'rgba(0,0,0,0.65)',
              fontFamily: SANS, fontSize: '11px', cursor: 'pointer',
            }}>
              + Add Iteration
            </button>

            <div style={{ marginTop: '16px', padding: '10px', background: 'rgba(200,240,224,0.15)', borderRadius: '10px', border: '1px solid rgba(200,240,224,0.5)' }}>
              <p style={{ fontFamily: SANS, fontSize: '9px', color: 'rgba(0,0,0,0.35)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Best Result</p>
              <p style={{ fontFamily: MONO, fontSize: '14px', color: 'rgba(20,140,80,0.85)', margin: '0 0 4px' }}>
                {bestIteration?.result} {bestIteration?.unit}
              </p>
              <p style={{ fontFamily: SANS, fontSize: '10px', color: 'rgba(0,0,0,0.4)', margin: 0, lineHeight: 1.4 }}>
                {bestIteration?.hypothesis.slice(0, 60)}…
              </p>
            </div>
          </div>

          {/* Engine view — timeline */}
          <div style={{ flex: 1, overflow: 'auto', background: '#0d0f14', padding: '12px' }}>
            <Timeline iterations={iterations} />
          </div>

          {/* Results panel */}
          <div style={{ width: '220px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderLeft: '1px solid rgba(0,0,0,0.07)', background: '#FFFFFF' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '0 0 12px' }}>
              Campaign Summary
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetricCard label="Total Iterations" value={iterations.length} highlight />
              <MetricCard label="Best Titer" value={bestIteration?.result ?? 0} unit={bestIteration?.unit} />
              <MetricCard label="Avg Improvement" value={improvementRate} unit={bestIteration?.unit + '/cycle'} />
              <MetricCard label="Pass Rate" value={passRate} unit="%" />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: '#FFFFFF' }}>
          <ExportButton label="Export JSON" data={iterations} filename="dbtlflow-iterations" format="json" />
          <ExportButton label="Export CSV" data={iterations} filename="dbtlflow-iterations" format="csv" />
        </div>
      </div>
    </IDEShell>
  );
}
