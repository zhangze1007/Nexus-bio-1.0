'use client';
/**
 * CatDes Expression Tab -- Gene expression prediction with
 * promoter/RBS/terminator parameter editing.
 */
import React from 'react';
import { THEME } from '../../../theme';
import { GLASS, BORDER, LABEL, VALUE, INPUT_BG, INPUT_BORDER, INPUT_TEXT, tn } from './catdesShared';
import MetricCard from '../../ide/shared/MetricCard';
import ParameterPanel from '../shared/ParameterPanel';

interface ExpressionBottleneck {
  stage: string;
  description: string;
  severity: number;
}

interface ExpressionSuggestion {
  component: string;
  action: string;
  expectedImprovement: number;
}

interface ExpressionPrediction {
  relativeExpression: number;
  confidence: number;
  contributions: {
    promoter: number;
    rbs: number;
    cds: number;
    terminator: number;
    host: number;
  };
  bottlenecks: ExpressionBottleneck[];
  suggestions: ExpressionSuggestion[];
}

interface CatDesExpressionTabProps {
  exprResult: ExpressionPrediction | null;
  exprLoading: boolean;
  exprPromoter: string;
  setExprPromoter: (s: string) => void;
  exprRbs: string;
  setExprRbs: (s: string) => void;
  exprTerminator: string;
  setExprTerminator: (s: string) => void;
  handleExpressionPrediction: () => void;
}

export default function CatDesExpressionTab({
  exprResult, exprLoading, exprPromoter, setExprPromoter,
  exprRbs, setExprRbs, exprTerminator, setExprTerminator,
  handleExpressionPrediction,
}: CatDesExpressionTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Editable expression parameters */}
      <ParameterPanel
        title="Expression Parameters"
        defaultCollapsed={false}
        onReset={() => {
          setExprPromoter('TTGACATATACATTAAGAATTCGATATCAATGACA');
          setExprRbs('AAGAAGGAGATATACAT');
          setExprTerminator('GCAAAAAACCCCTCAAGACCCGTTTAGAG');
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: 'block', marginBottom: 2 }}>Promoter Sequence</span>
            <input
              type="text"
              value={exprPromoter}
              onChange={e => setExprPromoter(e.target.value)}
              style={{ width: '100%', fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: INPUT_TEXT, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, padding: '5px 8px', outline: 'none' }}
            />
          </div>
          <div>
            <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: 'block', marginBottom: 2 }}>RBS Sequence</span>
            <input
              type="text"
              value={exprRbs}
              onChange={e => setExprRbs(e.target.value)}
              style={{ width: '100%', fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: INPUT_TEXT, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, padding: '5px 8px', outline: 'none' }}
            />
          </div>
          <div>
            <span style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: 'block', marginBottom: 2 }}>Terminator Sequence</span>
            <input
              type="text"
              value={exprTerminator}
              onChange={e => setExprTerminator(e.target.value)}
              style={{ width: '100%', fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: INPUT_TEXT, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, padding: '5px 8px', outline: 'none' }}
            />
          </div>
        </div>
      </ParameterPanel>

      <div style={{
        ...GLASS,
        padding: 16,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Gene Expression Predictor
        </span>
        <button onClick={handleExpressionPrediction} disabled={exprLoading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: THEME.FS_SM, opacity: exprLoading ? 0.4 : 1 }}
        >
          {exprLoading ? 'Predicting...' : 'Predict Expression'}
        </button>
        {exprResult && (
          <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: 'rgba(255,255,255,0.4)' }}>
            Expression: {exprResult.relativeExpression.toFixed(3)} | Confidence: {(exprResult.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {exprResult && (
        <>
          {/* Contribution breakdown */}
          <div style={{ ...GLASS, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {[
              { label: 'Promoter', value: exprResult.contributions.promoter, color: THEME.CORAL },
              { label: 'RBS', value: exprResult.contributions.rbs, color: THEME.MINT },
              { label: 'CDS', value: exprResult.contributions.cds, color: THEME.SKY },
              { label: 'Terminator', value: exprResult.contributions.terminator, color: THEME.LILAC },
              { label: 'Host', value: exprResult.contributions.host, color: THEME.APRICOT },
            ].map(c => (
              <div key={c.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL }}>{c.label}</div>
                <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_SM, color: c.color, fontWeight: 600 }}>
                  {(c.value * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>

          {/* Bottlenecks */}
          {exprResult.bottlenecks.length > 0 && (
            <div style={{ ...GLASS, padding: 12 }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 6 }}>Bottlenecks</div>
              {exprResult.bottlenecks.map((b, i) => (
                <div key={i} style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                  <span style={{ color: b.severity > 0.7 ? THEME.RISK_HIGH : b.severity > 0.4 ? THEME.RISK_MEDIUM : THEME.SUCCESS_MEDIUM }}>
                    [{b.stage}]
                  </span> {b.description}
                </div>
              ))}
            </div>
          )}

          {/* Optimization suggestions */}
          {exprResult.suggestions.length > 0 && (
            <div style={{ ...GLASS, padding: 12 }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 6 }}>Optimization Suggestions</div>
              {exprResult.suggestions.map((s, i) => (
                <div key={i} style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                  <span style={{ color: THEME.SKY }}>[{s.component}]</span> {s.action}
                  <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                    (Δ={s.expectedImprovement.toFixed(3)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
