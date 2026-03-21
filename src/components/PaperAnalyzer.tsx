import { useState, useEffect, useRef } from 'react';
import {
  ArrowUp, Upload, Camera, Globe, Image as ImageIcon,
  X, ChevronUp, Plus, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import { PathwayNode, PathwayEdge, isValidNode, isValidEdge, sanitizeNodeId } from '../types';

interface PaperAnalyzerProps {
  onPathwayGenerated: (nodes: PathwayNode[], edges: PathwayEdge[]) => void;
}

const COLORS = [
  '#e5e5e5','#d4d4d4','#a3a3a3','#737373',
  '#525252','#404040','#f5f5f5','#d4d4d4',
  '#c4c4c4','#b0b0b0',
];

type InputMode = 'text' | 'pdf' | 'image' | 'camera' | 'web';
type AnalysisState = 'idle' | 'analyzing' | 'success' | 'error';

// ── Evidence-first prompt — traceability is mandatory ──
const buildPrompt = (content: string) => `You are a computational biology expert. Extract a metabolic pathway from the research text below.

CRITICAL RULE: Every node's evidenceSnippet must be an EXACT QUOTE copied verbatim from the text below. Do not paraphrase. If you cannot find a direct quote, use the closest sentence from the text.

Return ONLY this exact JSON, nothing else:

{
  "nodes": [
    {
      "id": "lowercase_underscore_id",
      "label": "Standard biochemical name (1-4 words)",
      "nodeType": "metabolite",
      "summary": "One sentence explaining the role of this entity in the pathway.",
      "evidenceSnippet": "EXACT QUOTE from the source text that mentions this entity.",
      "citation": "Author et al., Year, Journal",
      "confidenceScore": 0.85
    }
  ],
  "edges": [
    {
      "start": "source_id",
      "end": "target_id",
      "relationshipType": "converts",
      "direction": "forward",
      "evidence": "EXACT QUOTE from source text describing this reaction."
    }
  ]
}

Rules:
- 4 to 7 nodes maximum
- Extract ONLY molecular entities: metabolites, enzymes, genes, proteins, cofactors
- Do NOT include cells, tissues, organisms, physiological processes, or anatomical structures as nodes (e.g. no "embryo", "endometrium", "cell", "tissue")
- nodeType: metabolite, enzyme, gene, complex, cofactor, or unknown
- relationshipType: catalyzes, produces, consumes, activates, inhibits, converts, transports, regulates, or unknown
- IDs: lowercase letters and underscores only, no spaces
- evidenceSnippet: must be copied word-for-word from the source text
- No markdown, no explanation, no text outside the JSON

Source text:
${content.slice(0, 2500)}`;

// ── Multi-strategy JSON parser ──
function extractJSON(raw: string): unknown | null {
  // Strategy 1: Direct parse
  try { return JSON.parse(raw); } catch {}

  // Strategy 2: Strip markdown fences
  const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(stripped); } catch {}

  // Strategy 3: Find outermost { }
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)); } catch {}
  }

  // Strategy 4: Fix common issues — trailing commas, single quotes
  try {
    const fixed = raw
      .replace(/,\s*([}\]])/g, '$1')  // trailing commas
      .replace(/'/g, '"')              // single to double quotes
      .trim();
    const f = fixed.indexOf('{');
    const l = fixed.lastIndexOf('}');
    if (f !== -1 && l > f) return JSON.parse(fixed.slice(f, l + 1));
  } catch {}

  return null;
}

// ── Validate and normalize parsed pathway ──
function normalizePathway(parsed: unknown): { nodes: PathwayNode[]; edges: PathwayEdge[] } | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;

  if (!Array.isArray(p.nodes)) return null;

  const validNodes = p.nodes.filter(isValidNode);
  if (validNodes.length === 0) return null;

  const nodes: PathwayNode[] = validNodes.map((node: any, i: number) => {
    const n = node as Record<string, unknown>;
    const count = validNodes.length;
    const angle = (i / count) * Math.PI * 2;
    const r = count <= 4 ? 2.5 : 3.5;

    return {
      id: sanitizeNodeId(String(n.id)),
      label: String(n.label).slice(0, 32),
      canonicalLabel: n.canonicalLabel ? String(n.canonicalLabel) : undefined,
      nodeType: (['metabolite','enzyme','gene','complex','cofactor','unknown'].includes(n.nodeType as string)
        ? n.nodeType : 'unknown') as any,
      summary: n.summary ? String(n.summary) : 'No summary available.',
      evidenceSnippet: n.evidenceSnippet ? String(n.evidenceSnippet) : undefined,
      citation: n.citation ? String(n.citation) : 'Extracted from provided text',
      confidenceScore: typeof n.confidenceScore === 'number'
        ? Math.min(1, Math.max(0, n.confidenceScore)) : undefined,
      color: COLORS[i % COLORS.length],
      position: [
        i === 0 ? -r : parseFloat((Math.cos(angle) * r).toFixed(2)),
        i === 0 ? 0 : parseFloat((Math.sin(angle) * r * 0.6).toFixed(2)),
        0,
      ] as [number, number, number],
    };
  });

  // Build sanitized node ID set for edge validation
  const sanitizedIds = new Set(nodes.map(n => n.id));
  const validEdgeTypes = ['catalyzes','produces','consumes','activates','inhibits','converts','transports','regulates','unknown'];

  const edges: PathwayEdge[] = (!Array.isArray(p.edges) ? [] : p.edges)
    .filter(isValidEdge)
    .map((e: any) => ({
      start: sanitizeNodeId(String(e.start)),
      end: sanitizeNodeId(String(e.end)),
      relationshipType: validEdgeTypes.includes(e.relationshipType) ? e.relationshipType : 'unknown',
      direction: (['forward','reverse','bidirectional'].includes(e.direction) ? e.direction : 'forward') as any,
      evidence: e.evidence ? String(e.evidence) : undefined,
      confidenceScore: typeof e.confidenceScore === 'number'
        ? Math.min(1, Math.max(0, e.confidenceScore)) : undefined,
    }))
    // Only filter edges where BOTH sanitized IDs exist — more permissive
    .filter((e: any) => sanitizedIds.has(e.start) && sanitizedIds.has(e.end));

  // Return even if no valid edges — nodes alone are still useful
  return { nodes, edges };
}

// ── Error classifier — merged best of both versions ──
function classifyError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes('429') || msg.includes('rate limit')) {
    return 'Rate limit reached. Please wait 1–2 minutes and try again.';
  }
  if (msg.includes('503') || msg.includes('overloaded') || msg.includes('unavailable')) {
    return 'AI model is temporarily overloaded. Please retry in a moment.';
  }
  if (msg.includes('timeout')) {
    return 'Request timed out. Try pasting just the abstract or methods section — shorter text works better.';
  }
  if (msg.includes('no_valid_json') || msg.includes('malformed') || msg.includes('parse')) {
    return 'Could not extract a valid pathway structure. Try pasting just the abstract or methods section of the paper.';
  }
  if (msg.includes('no usable content') || msg.includes('empty')) {
    return 'The AI returned an empty response. Please retry.';
  }
  if (msg.includes('no pathway nodes')) {
    return 'No metabolic pathway found in this text. Make sure the text describes a biochemical process or reaction.';
  }
  if (msg.includes('400')) {
    return 'Input too short or malformed. Please paste at least a full paragraph of research text.';
  }
  if (msg.includes('500')) {
    return 'Internal server error. Please try again in a moment.';
  }
  return message || 'Something went wrong. Please try again.';
}

export default function PaperAnalyzer({ onPathwayGenerated }: PaperAnalyzerProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<InputMode>('text');
  const [expanded, setExpanded] = useState(false);
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [webUrl, setWebUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setText(e.detail.text);
      setMode('text');
      setAnalysisState('idle');
      setErrorMsg(null);
    };
    window.addEventListener('autoFillAnalyzer', handler as EventListener);
    return () => window.removeEventListener('autoFillAnalyzer', handler as EventListener);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const resetState = () => {
    setErrorMsg(null);
    setFileName(null);
    setImagePreview(null);
    setImageBase64(null);
    setText('');
    setWebUrl('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'pdf' | 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageBase64(result.split(',')[1]);
      if (type === 'image') setImagePreview(result);
      setText(`${type === 'pdf' ? 'PDF' : 'Image'} loaded: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const buildRequestBody = () => {
    const config = { temperature: 0.1, maxOutputTokens: 2048 };

    if ((mode === 'image' || mode === 'camera') && imageBase64) {
      return {
        contents: [{ parts: [
          { text: buildPrompt('Analyze the metabolic pathway visible in this image.') },
          { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
        ]}],
        generationConfig: config,
      };
    }
    if (mode === 'pdf' && imageBase64) {
      return {
        contents: [{ parts: [
          { text: buildPrompt('Analyze the metabolic pathway content in this PDF.') },
          { inline_data: { mime_type: 'application/pdf', data: imageBase64 } },
        ]}],
        generationConfig: config,
      };
    }
    if (mode === 'web' && webUrl) {
      return {
        contents: [{ parts: [{ text: buildPrompt(`Analyze this paper URL: ${webUrl}`) }] }],
        generationConfig: config,
      };
    }
    return {
      contents: [{ parts: [{ text: buildPrompt(text) }] }],
      generationConfig: config,
    };
  };

  const handleAnalyze = async () => {
    const hasContent =
      (mode === 'text' && text.trim().length >= 10) ||
      ((mode === 'image' || mode === 'camera' || mode === 'pdf') && imageBase64) ||
      (mode === 'web' && webUrl.trim());

    if (!hasContent) {
      setErrorMsg(mode === 'text' ? 'Please paste at least one sentence.' :
        mode === 'web' ? 'Please enter a valid URL.' : 'Please upload a file first.');
      return;
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setAnalysisState('analyzing');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody()),
        signal: abortRef.current.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw || typeof raw !== 'string') throw new Error('NO_VALID_JSON');

      // DEBUG — show raw in error so we can see it on tablet
      const parsed = extractJSON(raw);
      if (!parsed) throw new Error(`PARSE_FAIL: ${raw.slice(0, 300)}`);

      const pathway = normalizePathway(parsed);
      if (!pathway) throw new Error(`NORMALIZE_FAIL: ${JSON.stringify(parsed).slice(0, 300)}`);

      onPathwayGenerated(pathway.nodes, pathway.edges);
      setAnalysisState('success');
      resetState();
      setExpanded(false);

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setAnalysisState('error');
      // Show full message for debugging
      const msg = err.message || '';
      if (msg.startsWith('PARSE_FAIL:') || msg.startsWith('NORMALIZE_FAIL:')) {
        setErrorMsg(msg); // Show raw for debugging
      } else {
        setErrorMsg(classifyError(msg));
      }
    }
  };

  const canAnalyze =
    (mode === 'text' && text.trim().length >= 10) ||
    ((mode === 'image' || mode === 'camera' || mode === 'pdf') && !!imageBase64) ||
    (mode === 'web' && webUrl.trim().length > 0);

  const extraModes = [
    { id: 'pdf' as InputMode, icon: <Upload size={13} />, label: 'PDF' },
    { id: 'image' as InputMode, icon: <ImageIcon size={13} />, label: 'Image' },
    { id: 'camera' as InputMode, icon: <Camera size={13} />, label: 'Camera' },
    { id: 'web' as InputMode, icon: <Globe size={13} />, label: 'URL' },
  ];

  return (
    <section className="px-4 py-24" id="analyzer" style={{ background: '#0a0a0a' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            02 · Analysis
          </p>
          <h2 style={{ color: '#ffffff', fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Decode any pathway.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto' }}>
            Paste a paper, upload a PDF, or point your camera — AI extracts the metabolic architecture with evidence citations.
          </p>
        </div>

        {/* Input card */}
        <div style={{ borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>

          {/* File/image preview */}
          {(mode === 'pdf' || mode === 'image' || mode === 'camera') && (
            <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {imagePreview
                ? <img src={imagePreview} alt="Preview" style={{ height: '48px', width: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                : <div style={{ height: '48px', width: '48px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {mode === 'pdf' ? <Upload size={16} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ImageIcon size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                  </div>
              }
              <div>
                {fileName
                  ? <p style={{ color: '#ffffff', fontSize: '13px', margin: '0 0 3px', fontWeight: 500 }}>{fileName}</p>
                  : <button
                      onClick={() => mode === 'pdf' ? fileInputRef.current?.click() : mode === 'camera' ? cameraInputRef.current?.click() : imageInputRef.current?.click()}
                      style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
                      {mode === 'camera' ? 'Tap to take photo →' : `Click to upload ${mode} →`}
                    </button>
                }
                {fileName && (
                  <button onClick={resetState} style={{ color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <X size={9} /> remove
                  </button>
                )}
              </div>
            </div>
          )}

          {/* URL input */}
          {mode === 'web' && (
            <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Globe size={14} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
              <input type="url" value={webUrl} onChange={e => { setWebUrl(e.target.value); setErrorMsg(null); }}
                placeholder="https://pubmed.ncbi.nlm.nih.gov/... or https://doi.org/..."
                style={{ flex: 1, background: 'transparent', border: 'none', color: '#ffffff', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
              {webUrl && <button onClick={() => setWebUrl('')} style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={13} /></button>}
            </div>
          )}

          {/* Text textarea */}
          {mode === 'text' && (
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setErrorMsg(null); if (analysisState === 'error') setAnalysisState('idle'); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnalyze(); } }}
              placeholder="Paste an abstract, methods section, or any research text here..."
              rows={4}
              style={{ width: '100%', background: 'transparent', padding: '16px', color: '#ffffff', fontSize: '13px', lineHeight: 1.7, border: 'none', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          )}

          {/* Toolbar */}
          <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>

              {mode !== 'text' && (
                <button onClick={() => { setMode('text'); resetState(); setExpanded(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
                  Text
                </button>
              )}

              <button onClick={() => setExpanded(!expanded)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '12px', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.background = 'none'; }}>
                {expanded ? <ChevronUp size={13} /> : <Plus size={13} />}
                {expanded ? 'Less' : 'Add file or URL'}
              </button>

              {expanded && extraModes.map(m => (
                <button key={m.id}
                  onClick={() => {
                    setMode(m.id); resetState();
                    if (m.id === 'pdf') setTimeout(() => fileInputRef.current?.click(), 80);
                    if (m.id === 'image') setTimeout(() => imageInputRef.current?.click(), 80);
                    if (m.id === 'camera') setTimeout(() => cameraInputRef.current?.click(), 80);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', background: mode === m.id ? 'rgba(255,255,255,0.1)' : 'none', border: 'none', color: mode === m.id ? '#ffffff' : 'rgba(255,255,255,0.35)', fontSize: '12px', cursor: 'pointer' }}>
                  {m.icon}{m.label}
                </button>
              ))}
            </div>

            {/* Send button */}
            <button
              onClick={handleAnalyze}
              disabled={analysisState === 'analyzing' || !canAnalyze}
              title="Analyze pathway (Enter)"
              style={{
                width: '32px', height: '32px', borderRadius: '50%', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                background: analysisState === 'analyzing' ? 'rgba(255,255,255,0.06)' : canAnalyze ? '#ffffff' : 'rgba(255,255,255,0.07)',
                color: analysisState === 'analyzing' || !canAnalyze ? 'rgba(255,255,255,0.2)' : '#0a0a0a',
                transition: 'all 0.15s',
              }}>
              {analysisState === 'analyzing'
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <ArrowUp size={14} strokeWidth={2.5} />
              }
            </button>
          </div>
        </div>

        {/* Status messages */}
        <div style={{ marginTop: '10px', minHeight: '28px' }}>
          {analysisState === 'analyzing' && (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' }}>
              Extracting pathway structure from literature...
            </p>
          )}
          {analysisState === 'error' && errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.12)' }}>
              <AlertCircle size={13} style={{ color: 'rgba(255,120,120,0.8)', flexShrink: 0 }} />
              <p style={{ color: 'rgba(255,140,140,0.8)', fontSize: '12px', margin: 0 }}>{errorMsg}</p>
            </div>
          )}
          {analysisState === 'success' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <CheckCircle2 size={13} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: 0 }}>
                Pathway extracted. Scroll up to explore the visualization ↑
              </p>
            </div>
          )}
          {analysisState === 'idle' && (
            <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center' }}>
              Press Enter to analyze · Shift+Enter for new line · Gemini 2.0 Flash
            </p>
          )}
        </div>
      </div>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={e => handleFileUpload(e, 'pdf')} className="hidden" />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={e => handleFileUpload(e, 'image')} className="hidden" />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={e => handleFileUpload(e, 'image')} className="hidden" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
