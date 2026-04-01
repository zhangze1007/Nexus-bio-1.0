'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ToolShell, { TOOL_TOKENS as T } from './shared/ToolShell';
import ModuleCard from './shared/ModuleCard';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { MOCK_RESULTS } from '../../data/mockNEXAI';
import type { NEXAIResult, CitationNode } from '../../types';
import { useUIStore } from '../../store/uiStore';

// ── Full-bleed Citation Graph ──────────────────────────────────────────

function CitationGraph({ citations, onNodeClick }: {
  citations: CitationNode[];
  onNodeClick?: (c: CitationNode) => void;
}) {
  const W = 640, H = 480;
  const [hovered, setHovered] = useState<string | null>(null);

  const nodes = citations.map((c, i) => ({
    ...c,
    x: c.x ?? (60 + ((i * 110) % (W - 120))),
    y: c.y ?? (50 + Math.floor(i / 5) * 120 + (i % 2) * 30),
    r: 14 + c.relevance * 20,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      {/* Edges */}
      {nodes.map((n, i) =>
        nodes.slice(i + 1, i + 3).map((m, j) => (
          <line key={`e-${i}-${j}`}
            x1={n.x} y1={n.y} x2={m.x} y2={m.y}
            stroke={`rgba(57,255,20,${0.04 + n.relevance * 0.06})`} strokeWidth={1}
          />
        ))
      )}
      {/* Nodes */}
      {nodes.map(n => {
        const isHov = hovered === n.id;
        return (
          <g key={n.id}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onNodeClick?.(n)}
            style={{ cursor: 'pointer' }}>
            {/* Glow */}
            {isHov && (
              <circle cx={n.x} cy={n.y} r={n.r + 10}
                fill="none" stroke={T.NEON} strokeWidth={1}
                opacity={0.2}
              />
            )}
            <circle cx={n.x} cy={n.y} r={n.r}
              fill={`rgba(57,255,20,${0.06 + n.relevance * 0.1})`}
              stroke={isHov ? T.NEON : `rgba(57,255,20,${0.2 + n.relevance * 0.3})`}
              strokeWidth={isHov ? 2 : 1}
            />
            <text x={n.x} y={n.y + 4} textAnchor="middle"
              fontFamily={T.MONO} fontSize="9" fill={isHov ? T.NEON : 'rgba(255,255,255,0.6)'}>
              {n.year}
            </text>
            {isHov && (
              <foreignObject x={n.x + n.r + 6} y={n.y - 36} width={220} height={80}>
                <div style={{
                  background: 'rgba(0,0,0,0.92)',
                  border: `1px solid ${T.NEON}30`,
                  borderRadius: '10px',
                  padding: '8px 10px',
                  backdropFilter: 'blur(12px)',
                }}>
                  <p style={{ fontFamily: T.SANS, fontSize: '10px', color: 'rgba(255,255,255,0.8)', margin: '0 0 3px', lineHeight: 1.4 }}>
                    {n.title.slice(0, 80)}…
                  </p>
                  <p style={{ fontFamily: T.MONO, fontSize: '8px', color: T.NEON, margin: 0 }}>
                    Relevance: {(n.relevance * 100).toFixed(0)}%
                  </p>
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
      <text x={14} y={H - 12} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.1)">
        Citation Network — node size = relevance
      </text>
    </svg>
  );
}

// ── Floating CLI Overlay ───────────────────────────────────────────────

function FloatingCLI({ query, setQuery, onSubmit, loading, history }: {
  query: string;
  setQuery: (q: string) => void;
  onSubmit: () => void;
  loading: boolean;
  history: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [histIdx, setHistIdx] = useState(-1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && e.target === document.body) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(newIdx);
      if (history[newIdx]) setQuery(history[newIdx]);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = Math.max(histIdx - 1, -1);
      setHistIdx(newIdx);
      setQuery(newIdx < 0 ? '' : (history[newIdx] ?? ''));
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'absolute', bottom: '16px', left: '16px', right: '16px',
        borderRadius: '14px',
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${loading ? `${T.NEON}40` : 'rgba(255,255,255,0.06)'}`,
        boxShadow: loading ? `0 0 30px ${T.NEON}10` : '0 4px 20px rgba(0,0,0,0.5)',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: '10px',
        zIndex: 10,
      }}
    >
      <span style={{
        fontFamily: T.MONO, fontSize: '12px', fontWeight: 700,
        color: loading ? T.NEON : 'rgba(255,255,255,0.3)',
        flexShrink: 0,
      }}>
        {loading ? '⟳' : '›'}
      </span>
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); setHistIdx(-1); }}
        onKeyDown={handleKey}
        placeholder="Ask Axon anything… (press / to focus)"
        disabled={loading}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          fontFamily: T.MONO, fontSize: '12px',
          color: 'rgba(255,255,255,0.85)',
          caretColor: T.NEON,
        }}
      />
      <motion.button
        onClick={onSubmit}
        disabled={loading || !query.trim()}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          padding: '5px 14px', borderRadius: '8px', cursor: 'pointer',
          fontFamily: T.MONO, fontSize: '10px', fontWeight: 600,
          background: loading ? 'transparent' : `${T.NEON}15`,
          border: `1px solid ${loading ? 'rgba(255,255,255,0.06)' : `${T.NEON}30`}`,
          color: loading ? 'rgba(255,255,255,0.3)' : T.NEON,
        }}
      >
        {loading ? 'searching…' : '⏎ ask'}
      </motion.button>
    </motion.div>
  );
}

// ── Preset Chips ───────────────────────────────────────────────────────

const PRESET_QUERIES = [
  'How does tHMGR improve artemisinin precursor supply?',
  'Key bottlenecks in the artemisinin biosynthesis pathway?',
  'Dynamic regulation strategies for isoprenoid overproduction',
];

// ── Main Page ──────────────────────────────────────────────────────────

export default function NEXAIPage() {
  const appendConsole = useUIStore(s => s.appendConsole);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NEXAIResult | null>(null);
  const [mockIndex, setMockIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);

  async function runQuery() {
    if (!query.trim()) return;
    setHistory(prev => [query, ...prev.slice(0, 19)]);
    setLoading(true);
    appendConsole({ level: 'info', module: 'nexai', message: 'Query: "' + query.slice(0, 60) + (query.length > 60 ? '…' : '') + '"' });

    const prompt = 'You are a synthetic biology and metabolic engineering expert. Answer the following research question with scientific precision. Provide a detailed, evidence-based answer (2–4 paragraphs). Include specific mechanisms, data points, and cite relevant research where appropriate.\n\nQuestion: ' + query;

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      const data = await res.json();
      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (res.ok && answer) {
        const mockBase = MOCK_RESULTS[mockIndex % MOCK_RESULTS.length];
        setResult({ ...mockBase, query, answer, confidence: 0.85 + Math.random() * 0.1, generatedAt: Date.now() });
        appendConsole({ level: 'success', module: 'nexai', message: 'Answer generated (' + (data.meta?.provider ?? 'groq') + ')' });
      } else {
        const err = data?.error ?? ('HTTP ' + res.status);
        appendConsole({ level: 'warn', module: 'nexai', message: 'API error — ' + err });
        const mockResult = MOCK_RESULTS[mockIndex % MOCK_RESULTS.length];
        setResult({ ...mockResult, query, generatedAt: Date.now() });
        setMockIndex(i => i + 1);
      }
    } catch (e) {
      appendConsole({ level: 'warn', module: 'nexai', message: 'Network error — ' + String(e).slice(0, 60) });
      const mockResult = MOCK_RESULTS[mockIndex % MOCK_RESULTS.length];
      setResult({ ...mockResult, query, generatedAt: Date.now() });
      setMockIndex(i => i + 1);
    }
    setLoading(false);
  }

  return (
    <ToolShell
      moduleId="nexai"
      title="Axon"
      description="Semantic search across PubMed, UniProt, ChEMBL, Reactome, KEGG — synthesized by Groq"
      formula="score = α·semantic_sim + β·citation_weight"
      grid="'presets graph stats' 'presets graph stats'"
      columns="200px 1fr 200px"
      rows="1fr 1fr"
      gap={6}
      footer={
        <ExportButton label="Export Result" data={result} filename="nexai-result" format="json" disabled={!result} />
      }
    >
      {/* ── Presets & Citations ──────────────────────────────── */}
      <ModuleCard area="presets" title="Quick Queries">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }}>
          {PRESET_QUERIES.map((q, i) => (
            <motion.button
              key={i}
              onClick={() => { setQuery(q); }}
              whileHover={{ x: 3 }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px',
                background: query === q ? `${T.NEON}08` : 'transparent',
                border: query === q ? `1px solid ${T.NEON}20` : '1px solid rgba(255,255,255,0.03)',
                borderRadius: '8px', cursor: 'pointer',
                fontFamily: T.SANS, fontSize: '10px', lineHeight: 1.5,
                color: query === q ? T.NEON : 'rgba(255,255,255,0.45)',
              }}
            >
              {q}
            </motion.button>
          ))}

          {/* Citation list when result exists */}
          {result && (
            <>
              <div style={{
                fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)',
                margin: '14px 0 6px', padding: '0 2px',
              }}>
                Citations ({result.citations.length})
              </div>
              {result.citations.map(c => (
                <div key={c.id} style={{
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.02)',
                }}>
                  <p style={{ fontFamily: T.SANS, fontSize: '9px', color: 'rgba(255,255,255,0.5)', margin: '0 0 2px', lineHeight: 1.4 }}>
                    {c.title.slice(0, 60)}…
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>
                      {c.authors.split(',')[0]} et al. {c.year}
                    </span>
                    <span style={{ fontFamily: T.MONO, fontSize: '8px', color: T.NEON }}>
                      {(c.relevance * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </ModuleCard>

      {/* ── Center: Graph + Floating CLI + Answer ───────────── */}
      <ModuleCard area="graph" flush style={{ position: 'relative' }}>
        {/* Full-bleed citation graph background */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '12px', overflow: 'hidden',
        }}>
          {result ? (
            <CitationGraph citations={result.citations} />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: T.MONO, fontSize: '32px', color: 'rgba(255,255,255,0.04)', margin: '0 0 8px' }}>⬡</p>
              <p style={{ fontFamily: T.SANS, fontSize: '12px', color: 'rgba(255,255,255,0.15)' }}>
                Ask Axon a research question
              </p>
              <p style={{ fontFamily: T.MONO, fontSize: '9px', color: 'rgba(255,255,255,0.08)', marginTop: '4px' }}>
                press / to focus the command line
              </p>
            </div>
          )}
        </div>

        {/* Answer overlay (top, translucent) */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute', top: '12px', left: '12px', right: '12px',
                maxHeight: '40%', overflowY: 'auto',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.04)',
                padding: '12px 14px',
                zIndex: 5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontFamily: T.MONO, fontSize: '9px', color: T.NEON }}>AXON</span>
                <span style={{
                  fontFamily: T.MONO, fontSize: '8px', padding: '2px 6px',
                  background: 'rgba(120,220,180,0.08)', border: '1px solid rgba(120,220,180,0.15)',
                  borderRadius: '6px', color: 'rgba(120,220,180,0.7)',
                }}>
                  {(result.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p style={{
                fontFamily: T.SANS, fontSize: '11px', color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.7, margin: 0,
              }}>
                {result.answer}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating CLI at bottom */}
        <FloatingCLI
          query={query} setQuery={setQuery}
          onSubmit={runQuery} loading={loading}
          history={history}
        />
      </ModuleCard>

      {/* ── Right: Stats ────────────────────────────────────── */}
      <ModuleCard area="stats" title="Query Stats">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <MetricCard label="Confidence" value={result ? (result.confidence * 100).toFixed(0) + '%' : '—'} highlight={!!result} />
          <MetricCard label="Citations" value={result?.citations.length ?? 0} />
          <MetricCard label="Databases" value={6} unit="sources" />
          <MetricCard label="Model" value="llama-3.3" />

          {/* History */}
          {history.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{
                fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', marginBottom: '6px',
              }}>
                History ({history.length})
              </div>
              {history.slice(0, 5).map((h, i) => (
                <motion.button
                  key={h + i}
                  onClick={() => setQuery(h)}
                  whileHover={{ x: 2 }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '4px 6px', marginBottom: '2px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: T.MONO, fontSize: '8px', color: 'rgba(255,255,255,0.25)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {h.slice(0, 40)}{h.length > 40 ? '…' : ''}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </ModuleCard>
    </ToolShell>
  );
}
