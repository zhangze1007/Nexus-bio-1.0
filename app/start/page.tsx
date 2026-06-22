// app/start/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseSmartInput, type ParseResult } from '../../src/lib/smart-parser';
import { buildGoalContext, saveGoalContext } from '../../src/lib/goal-context';
import { THEME } from '../../src/theme';

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
      fontFamily: THEME.SANS,
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px', fontFamily: THEME.BRAND }}>
          Smart Entry
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
          Enter your goal — the platform routes you to the right tool chain
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
              placeholder="Molecule, strain, DOI, or production target..."
              style={{
                flex: 1, padding: '12px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: input.trim() === '' && input.length > 0
                  ? '1px solid rgba(250,128,114,0.5)'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff', fontSize: '0.875rem',
                outline: 'none', fontFamily: THEME.SANS,
              }}
            />
            <button
              onClick={() => handleSubmit(input)}
              disabled={!input.trim()}
              style={{
                padding: '12px 24px',
                background: input.trim() ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.1)',
                border: 'none', borderRadius: '8px',
                color: input.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                fontSize: '0.875rem', fontWeight: 600,
                cursor: input.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Start →
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '8px', textAlign: 'center', fontFamily: THEME.MONO }}>
            molecule · strain · DOI · production target
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
          fontFamily: THEME.SANS,
        }}>
          Could not recognize input: {parseError}
          <button onClick={() => router.push('/start')} style={{ marginLeft: '16px', color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}>
            Try again
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
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: THEME.MONO }}>
              Recognized as
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '4px', fontFamily: THEME.BRAND }}>
              {parseResult.displayLabel}
            </h2>
          </div>

          {/* Details */}
          <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Input</span>
              <span style={{ fontFamily: THEME.MONO }}>{parseResult.rawInput}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Type</span>
              <span style={{
                padding: '2px 8px', borderRadius: '4px',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontFamily: THEME.MONO, fontSize: '0.75rem',
              }}>
                {parseResult.type}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Confidence</span>
              <span style={{
                padding: '2px 8px', borderRadius: '4px',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontFamily: THEME.MONO, fontSize: '0.75rem',
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
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: THEME.MONO }}>
              Tool chain
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
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '0.75rem', fontWeight: 600, fontFamily: THEME.MONO,
              }}>
                ✓ Computational engine
              </span>
            ) : (
              <div>
                <span style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: '4px',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.75rem', fontWeight: 600, fontFamily: THEME.MONO,
                }}>
                  ⚠ AI-assisted · for reference only
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                const ctx = buildGoalContext(parseResult!.rawInput, parseResult!.type);
                saveGoalContext(ctx);
                router.push(parseResult!.routeTo);
              }}
              style={{
                flex: 1, padding: '12px',
                background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '8px',
                color: '#000', fontWeight: 600, fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Confirm — Go to tool chain
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
              Start over
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
