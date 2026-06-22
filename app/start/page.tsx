// app/start/page.tsx
'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseSmartInput, getSmartSuggestions, type ParseResult } from '../../src/lib/smart-parser';
import { buildGoalContext, saveGoalContext } from '../../src/lib/goal-context';
import { THEME } from '../../src/theme';

const EXAMPLES = [
  { label: 'Artemisinin', type: 'MOLECULE' },
  { label: 'E. coli K-12', type: 'STRAIN' },
  { label: '10.1038/nature05113', type: 'DOI' },
  { label: '50% yield improvement', type: 'METRIC' },
];

const TYPE_LABELS: Record<string, string> = {
  MOLECULE: 'Molecule',
  STRAIN: 'Strain',
  DOI: 'Paper',
  METRIC: 'Production target',
  FREEFORM: 'Free query',
};

function StartContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q');
  const [input, setInput] = useState(q ?? '');
  const [liveResult, setLiveResult] = useState<ParseResult | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Parse the q param for recognition card
  let parseResult: ParseResult | null = null;
  let parseError: string | null = null;
  if (q) {
    try {
      parseResult = parseSmartInput(q);
    } catch (err) {
      parseError = err instanceof Error ? err.message : 'Parse failed';
    }
  }

  // Live classification as user types
  useEffect(() => {
    const t = input.trim();
    if (t.length < 2) { setLiveResult(null); setSuggestions([]); return; }
    try {
      const parsed = parseSmartInput(t);
      setLiveResult(parsed);
    } catch { setLiveResult(null); }
    setSuggestions(getSmartSuggestions(t));
  }, [input]);

  const handleSubmit = (val: string) => {
    if (val.trim()) {
      router.push(`/start?q=${encodeURIComponent(val.trim())}`);
    }
  };

  const showInput = !q;
  const showCard = q && parseResult;
  const showError = q && parseError;

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      background: '#0a0b0f',
      color: '#e8e4df',
      fontFamily: THEME.SANS,
    }}>
      {/* ── Top bar ── */}
      <header style={{
        display: 'flex', alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none',
            color: '#6b6560', fontSize: '13px', cursor: 'pointer',
            fontFamily: THEME.SANS,
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>←</span>
          Home
        </button>
        <span style={{
          marginLeft: 'auto',
          fontFamily: THEME.MONO, fontSize: '11px',
          color: 'rgba(255,255,255,0.15)', letterSpacing: '0.06em',
        }}>
          SMART ENTRY
        </span>
      </header>

      {/* ── Content ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: showInput ? 'center' : 'flex-start',
        padding: showInput ? '24px' : '80px 24px 24px',
        transition: 'justify-content 0.3s ease',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: showInput ? '48px' : '32px' }}>
          <h1 style={{
            fontSize: showInput ? '2.5rem' : '1.75rem',
            fontWeight: 700, fontFamily: THEME.BRAND,
            letterSpacing: '-0.03em', lineHeight: 1.1,
            transition: 'font-size 0.3s ease',
          }}>
            {showInput ? 'Where do you want to go?' : parseResult?.displayLabel ?? 'Smart Entry'}
          </h1>
          <p style={{
            color: '#6b6560', fontSize: '14px', marginTop: '12px',
            maxWidth: '400px', lineHeight: 1.6,
          }}>
            {showInput
              ? 'Type a molecule, strain, DOI, or production goal. We route you to the right tools.'
              : parseResult?.toolChainDescription ?? ''
            }
          </p>
        </div>

        {/* ── Input state (no q param) ── */}
        {showInput && (
          <div style={{ width: '100%', maxWidth: '520px' }}>
            {/* Live classification pill */}
            <div style={{
              height: '28px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: '12px',
            }}>
              {liveResult && liveResult.type !== 'FREEFORM' && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '4px 12px', borderRadius: '9999px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontFamily: THEME.MONO, fontSize: '11px',
                  color: '#c4b8a8', letterSpacing: '0.04em',
                  animation: 'fadeIn 0.2s ease',
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#c4b8a8',
                  }} />
                  {TYPE_LABELS[liveResult.type] ?? liveResult.type}
                  <span style={{ color: '#6b6560' }}>·</span>
                  <span style={{ color: '#6b6560' }}>{liveResult.confidence}</span>
                </span>
              )}
            </div>

            {/* Input field */}
            <div style={{
              display: 'flex', gap: '8px',
              padding: '4px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(input); }}
                placeholder="artemisinin, E. coli, 10.1038/..., 50% yield..."
                autoFocus
                style={{
                  flex: 1, padding: '14px 16px',
                  background: 'transparent', border: 'none',
                  color: '#e8e4df', fontSize: '15px',
                  outline: 'none', fontFamily: THEME.SANS,
                }}
              />
              <button
                onClick={() => handleSubmit(input)}
                disabled={!input.trim()}
                style={{
                  padding: '10px 20px',
                  background: input.trim() ? '#c4b8a8' : 'rgba(255,255,255,0.05)',
                  border: 'none', borderRadius: '8px',
                  color: input.trim() ? '#0a0b0f' : 'rgba(255,255,255,0.2)',
                  fontSize: '13px', fontWeight: 600, fontFamily: THEME.SANS,
                  cursor: input.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease',
                }}
              >
                Go
              </button>
            </div>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div style={{
                marginTop: '8px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                overflow: 'hidden',
              }}>
                {suggestions.slice(0, 5).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); handleSubmit(s); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 16px', background: 'transparent',
                      border: 'none', color: '#e8e4df', fontSize: '13px',
                      fontFamily: THEME.SANS, cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Example chips */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '8px',
              justifyContent: 'center', marginTop: '24px',
            }}>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => { setInput(ex.label); handleSubmit(ex.label); }}
                  style={{
                    padding: '6px 14px', borderRadius: '9999px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#6b6560', fontSize: '12px',
                    fontFamily: THEME.MONO, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                    e.currentTarget.style.color = '#e8e4df';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.color = '#6b6560';
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {showError && (
          <div style={{
            maxWidth: '520px', width: '100%',
            padding: '20px 24px', borderRadius: '12px',
            background: 'rgba(250,128,114,0.06)',
            border: '1px solid rgba(250,128,114,0.15)',
          }}>
            <p style={{ color: '#FA8072', fontSize: '14px', marginBottom: '12px' }}>
              Could not recognize input: {parseError}
            </p>
            <button
              onClick={() => router.push('/start')}
              style={{
                padding: '8px 16px', borderRadius: '6px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#e8e4df', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Recognition card ── */}
        {showCard && (
          <div style={{
            maxWidth: '520px', width: '100%',
            padding: '28px', borderRadius: '16px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            {/* Type badge */}
            <div style={{ marginBottom: '20px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', borderRadius: '9999px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                fontFamily: THEME.MONO, fontSize: '11px',
                color: '#c4b8a8', letterSpacing: '0.04em',
              }}>
                {TYPE_LABELS[parseResult!.type] ?? parseResult!.type}
                <span style={{ color: '#6b6560' }}>·</span>
                <span style={{ color: '#6b6560' }}>{parseResult!.confidence}</span>
              </span>
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
              <DetailRow label="Input" value={parseResult!.rawInput} />
              <DetailRow label="Type" value={TYPE_LABELS[parseResult!.type] ?? parseResult!.type} />
              <DetailRow label="Confidence" value={parseResult!.confidence} />
            </div>

            {/* Tool chain */}
            <div style={{
              padding: '16px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.015)',
              border: '1px solid rgba(255,255,255,0.04)',
              marginBottom: '24px',
            }}>
              <span style={{
                display: 'block', marginBottom: '8px',
                fontFamily: THEME.MONO, fontSize: '10px',
                color: '#6b6560', textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                Tool chain
              </span>
              <p style={{ fontSize: '14px', color: '#e8e4df', lineHeight: 1.6 }}>
                {parseResult!.toolChainDescription}
              </p>
            </div>

            {/* Validity */}
            <div style={{ marginBottom: '24px' }}>
              {parseResult!.validityClass === 'COMPUTATIONAL' ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '4px 12px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontFamily: THEME.MONO, fontSize: '11px', color: '#c4b8a8',
                }}>
                  ✓ Computational engine
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '4px 12px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontFamily: THEME.MONO, fontSize: '11px', color: '#6b6560',
                }}>
                  ⚠ AI-assisted · for reference only
                </span>
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
                  flex: 1, padding: '14px 20px',
                  background: '#c4b8a8', border: 'none', borderRadius: '10px',
                  color: '#0a0b0f', fontWeight: 600, fontSize: '14px',
                  cursor: 'pointer', fontFamily: THEME.SANS,
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                Confirm — go to tool chain
              </button>
              <button
                onClick={() => router.push('/start')}
                style={{
                  padding: '14px 20px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  color: '#6b6560', fontSize: '14px',
                  cursor: 'pointer', fontFamily: THEME.SANS,
                }}
              >
                Start over
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
      <span style={{ color: '#6b6560' }}>{label}</span>
      <span style={{ fontFamily: THEME.MONO, color: '#e8e4df' }}>{value}</span>
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0b0f' }} />}>
      <StartContent />
    </Suspense>
  );
}
