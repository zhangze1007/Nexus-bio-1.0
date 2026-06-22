// app/start/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseSmartInput, type ParseResult } from '../../src/lib/smart-parser';

function StartContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q');
  const [input, setInput] = useState('');

  let parseResult: ParseResult | null = null;
  let parseError: string | null = null;
  if (q) {
    try {
      parseResult = parseSmartInput(q);
    } catch (err) {
      parseError = err instanceof Error ? err.message : 'Parse failed';
    }
  }

  const handleSubmit = (val: string) => {
    if (val.trim()) {
      router.push(`/start?q=${encodeURIComponent(val.trim())}`);
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '32px', padding: '24px',
      background: '#050505',
      color: '#fff',
      fontFamily: "'Public Sans', -apple-system, sans-serif",
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>
          Smart Entry
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
          输入你的目标，平台自动路由到正确的工具链
        </p>
      </div>

      {/* Input box — shown when no q param */}
      {!q && (
        <div style={{ width: '100%', maxWidth: '560px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(input); }}
              placeholder="输入分子名、菌株、DOI 或生产指标..."
              style={{
                flex: 1, padding: '12px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: input.trim() === '' && input.length > 0
                  ? '1px solid rgba(250,128,114,0.5)'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff', fontSize: '0.875rem',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => handleSubmit(input)}
              disabled={!input.trim()}
              style={{
                padding: '12px 24px',
                background: input.trim() ? 'rgba(147,203,82,0.9)' : 'rgba(255,255,255,0.1)',
                border: 'none', borderRadius: '8px',
                color: input.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                fontSize: '0.875rem', fontWeight: 600,
                cursor: input.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              开始 →
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '8px', textAlign: 'center' }}>
            支持：分子名 · 菌株 · DOI · 生产指标
          </p>
        </div>
      )}

      {/* Parse error */}
      {parseError && (
        <div style={{
          padding: '16px 24px', borderRadius: '8px',
          background: 'rgba(250,128,114,0.1)',
          border: '1px solid rgba(250,128,114,0.3)',
          color: '#FA8072', maxWidth: '560px', width: '100%',
        }}>
          无法识别输入：{parseError}
          <button onClick={() => router.push('/start')} style={{ marginLeft: '16px', color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}>
            重新输入
          </button>
        </div>
      )}

      {/* Recognition card — shown when q param exists and parsed */}
      {parseResult && (
        <div style={{
          maxWidth: '560px', width: '100%',
          padding: '24px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          {/* Header */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              已识别为
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '4px' }}>
              {parseResult.displayLabel}
            </h2>
          </div>

          {/* Details */}
          <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>输入内容</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{parseResult.rawInput}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>识别类型</span>
              <span style={{
                padding: '2px 8px', borderRadius: '4px',
                background: 'rgba(147,203,82,0.15)', color: '#93CB52',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem',
              }}>
                {parseResult.type}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>置信度</span>
              <span style={{
                padding: '2px 8px', borderRadius: '4px',
                background: parseResult.confidence === 'HIGH' ? 'rgba(147,203,82,0.15)' : parseResult.confidence === 'MEDIUM' ? 'rgba(232,220,200,0.2)' : 'rgba(255,255,255,0.1)',
                color: parseResult.confidence === 'HIGH' ? '#93CB52' : parseResult.confidence === 'MEDIUM' ? '#E8DCC8' : 'rgba(255,255,255,0.5)',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem',
              }}>
                {parseResult.confidence}
              </span>
            </div>
          </div>

          {/* Tool chain */}
          <div style={{
            padding: '12px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              将触发工具链
            </span>
            <p style={{ fontSize: '0.875rem', marginTop: '4px', color: 'rgba(255,255,255,0.8)' }}>
              {parseResult.toolChainDescription}
            </p>
          </div>

          {/* Validity badge */}
          <div style={{ marginBottom: '20px' }}>
            {parseResult.validityClass === 'COMPUTATIONAL' ? (
              <span style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: '4px',
                background: 'rgba(147,203,82,0.15)', color: '#93CB52',
                fontSize: '0.75rem', fontWeight: 600,
              }}>
                ✓ 计算引擎验证
              </span>
            ) : (
              <div>
                <span style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: '4px',
                  background: 'rgba(232,220,200,0.2)', color: '#E8DCC8',
                  fontSize: '0.75rem', fontWeight: 600,
                }}>
                  ⚠ AI 辅助 · 仅供参考
                </span>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                  此路径基于 AI 分析，结果仅供参考
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => router.push(parseResult!.routeTo)}
              style={{
                flex: 1, padding: '12px',
                background: 'rgba(147,203,82,0.9)', border: 'none', borderRadius: '8px',
                color: '#000', fontWeight: 600, fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              确认，前往工具链
            </button>
            <button
              onClick={() => router.push('/start')}
              style={{
                padding: '12px 24px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              重新输入
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050505' }} />}>
      <StartContent />
    </Suspense>
  );
}
