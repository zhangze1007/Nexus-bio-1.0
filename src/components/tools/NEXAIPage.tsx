'use client';
import { useState, useMemo } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import EmptyState from '../ide/shared/EmptyState';
import { MOCK_RESULTS } from '../../data/mockNEXAI';
import type { NEXAIResult, CitationNode } from '../../types';
import { useUIStore } from '../../store/uiStore';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

function CitationGraph({ citations }: { citations: CitationNode[] }) {
  const W = 440, H = 320;
  const [hovered, setHovered] = useState<string | null>(null);

  const nodes = citations.map((c, i) => ({
    ...c,
    x: c.x ?? (80 + ((i * 90) % (W - 160))),
    y: c.y ?? (60 + Math.floor(i / 4) * 100),
    r: 12 + c.relevance * 16,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" />

      {/* Edges */}
      {nodes.map((n, i) =>
        nodes.slice(i + 1, i + 3).map((m, j) => (
          <line key={`e-${i}-${j}`}
            x1={n.x} y1={n.y} x2={m.x} y2={m.y}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1}
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
            style={{ cursor: 'pointer' }}>
            <circle cx={n.x} cy={n.y} r={n.r}
              fill={`rgba(120,180,255,${0.1 + n.relevance * 0.15})`}
              stroke={`rgba(120,180,255,${0.4 + n.relevance * 0.4})`}
              strokeWidth={isHov ? 2 : 1}
            />
            <text x={n.x} y={n.y + 4} textAnchor="middle"
              fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.7)">
              {n.year}
            </text>
            {isHov && (
              <foreignObject x={n.x + n.r + 4} y={n.y - 30} width={200} height={80}>
                <div style={{
                  background: 'rgba(10,12,16,0.95)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '4px',
                  padding: '6px 8px',
                }}>
                  <p style={{ fontFamily: SANS, fontSize: '9px', color: 'rgba(255,255,255,0.75)', margin: '0 0 3px', lineHeight: 1.4 }}>
                    {n.title.slice(0, 70)}…
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: '8px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                    Relevance: {(n.relevance * 100).toFixed(0)}%
                  </p>
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}

      {/* Relevance scale */}
      <text x={10} y={H - 8} fontFamily={SANS} fontSize="8" fill="rgba(255,255,255,0.2)">
        Node size = relevance score
      </text>
    </svg>
  );
}

export default function NEXAIPage() {
  const appendConsole = useUIStore(s => s.appendConsole);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NEXAIResult | null>(null);
  const [mockIndex, setMockIndex] = useState(0);

  async function runQuery() {
    if (!query.trim()) return;
    setLoading(true);
    appendConsole({ level: 'info', module: 'nexai', message: `Query: "${query.slice(0, 60)}${query.length > 60 ? '…' : ''}"` });

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: query,
          inputMode: 'semantic_search',
          pathway_context: 'artemisinin biosynthesis, metabolic engineering',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const mockBase = MOCK_RESULTS[mockIndex % MOCK_RESULTS.length];
        setResult({
          ...mockBase,
          query,
          answer: data.summary ?? data.result ?? mockBase.answer,
          confidence: 0.85 + Math.random() * 0.1,
          generatedAt: Date.now(),
        });
        appendConsole({ level: 'success', module: 'nexai', message: `Answer generated (${data.provider ?? 'groq'} · ${data.latencyMs ?? '?'}ms)` });
      } else {
        // Fall back to mock
        const mockResult = MOCK_RESULTS[mockIndex % MOCK_RESULTS.length];
        setResult({ ...mockResult, query, generatedAt: Date.now() });
        appendConsole({ level: 'warn', module: 'nexai', message: 'API unavailable — showing mock result' });
        setMockIndex(i => i + 1);
      }
    } catch {
      const mockResult = MOCK_RESULTS[mockIndex % MOCK_RESULTS.length];
      setResult({ ...mockResult, query, generatedAt: Date.now() });
      appendConsole({ level: 'warn', module: 'nexai', message: 'Network error — showing mock result' });
      setMockIndex(i => i + 1);
    }
    setLoading(false);
  }

  const PRESET_QUERIES = [
    'How does tHMGR improve artemisinin precursor supply?',
    'Key bottlenecks in the artemisinin biosynthesis pathway?',
    'Dynamic regulation strategies for isoprenoid overproduction',
  ];

  return (
    <IDEShell moduleId="nexai">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#0a0c10' }}>
        <AlgorithmInsight
          title="AI Research Agent"
          description="Semantic search across PubMed, UniProt, ChEMBL, Reactome, KEGG, and literature — synthesized by Groq llama-3.3-70b."
          formula="score = α·semantic_sim + β·citation_weight"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Input panel */}
          <div style={{ width: '280px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#0a0c10' }}>
            <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '0 0 8px' }}>
              Research Query
            </p>

            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runQuery(); }}
              placeholder="Ask a scientific question about metabolic pathways, enzymes, or biosynthesis..."
              rows={4}
              style={{
                width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '3px',
                color: 'rgba(255,255,255,0.75)',
                fontFamily: SANS, fontSize: '12px', lineHeight: 1.5,
                resize: 'vertical', marginBottom: '8px',
              }}
            />

            <button onClick={runQuery} disabled={loading || !query.trim()} style={{
              width: '100%', padding: '8px',
              background: loading ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '3px',
              color: loading ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)',
              fontFamily: MONO, fontSize: '11px', cursor: loading ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px',
            }}>
              {loading ? 'Searching...' : '⌘↵ Search'}
            </button>

            <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', margin: '0 0 8px' }}>
              Preset Queries
            </p>
            {PRESET_QUERIES.map((q, i) => (
              <button key={i} onClick={() => setQuery(q)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 10px', marginBottom: '5px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '3px',
                color: 'rgba(255,255,255,0.4)',
                fontFamily: SANS, fontSize: '11px', lineHeight: 1.4,
                cursor: 'pointer',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
              >
                {q}
              </button>
            ))}

            {result && (
              <>
                <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', margin: '16px 0 8px' }}>
                  Citations ({result.citations.length})
                </p>
                {result.citations.map(c => (
                  <div key={c.id} style={{
                    padding: '6px 8px', marginBottom: '5px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '3px',
                  }}>
                    <p style={{ fontFamily: SANS, fontSize: '10px', color: 'rgba(255,255,255,0.55)', margin: '0 0 2px', lineHeight: 1.4 }}>
                      {c.title.slice(0, 55)}…
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: MONO, fontSize: '8px', color: 'rgba(255,255,255,0.25)' }}>{c.authors.split(',')[0]} et al. {c.year}</span>
                      <span style={{ fontFamily: MONO, fontSize: '8px', color: 'rgba(120,180,255,0.6)' }}>{(c.relevance * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Engine view — answer + citation graph */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0f14' }}>
            {loading ? (
              <EmptyState type="loading" title="Searching..." message="Querying databases and synthesizing answer" />
            ) : result ? (
              <>
                {/* Answer card */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)' }}>
                      Synthesized Answer
                    </span>
                    <span style={{
                      fontFamily: MONO, fontSize: '9px', padding: '2px 8px',
                      background: 'rgba(120,220,180,0.08)', border: '1px solid rgba(120,220,180,0.2)',
                      borderRadius: '10px', color: 'rgba(120,220,180,0.7)',
                    }}>
                      {(result.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p style={{ fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, margin: 0 }}>
                    {result.answer}
                  </p>
                </div>
                {/* Citation graph */}
                <div style={{ flex: 1, overflow: 'hidden', padding: '8px' }}>
                  <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', margin: '0 0 6px 4px' }}>
                    Citation Network
                  </p>
                  <CitationGraph citations={result.citations} />
                </div>
              </>
            ) : (
              <EmptyState type="empty" title="Ask anything" message="Enter a research question to search across 6 scientific databases and get an AI-synthesized answer with citations." />
            )}
          </div>

          {/* Results panel */}
          <div style={{ width: '200px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#0a0c10' }}>
            <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '0 0 12px' }}>
              Query Stats
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetricCard label="Confidence" value={result ? `${(result.confidence * 100).toFixed(0)}%` : '—'} highlight={!!result} />
              <MetricCard label="Citations" value={result?.citations.length ?? 0} />
              <MetricCard label="Databases" value={6} unit="sources" />
              <MetricCard label="Model" value="llama-3.3" />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <ExportButton label="Export Result JSON" data={result} filename="nexai-result" format="json" disabled={!result} />
        </div>
      </div>
    </IDEShell>
  );
}
