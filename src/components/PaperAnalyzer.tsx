import { useState, useEffect, useRef } from 'react';
import { ArrowUp, Upload, Camera, Globe, Image as ImageIcon, X, ChevronUp, Plus, AlertCircle, Sparkles } from 'lucide-react';
import { PathwayNode } from '../types';

interface PaperAnalyzerProps {
  onPathwayGenerated: (nodes: PathwayNode[], edges: { start: string; end: string }[]) => void;
}

const COLORS = ['#a3a3a3','#d4d4d4','#737373','#e5e5e5','#525252','#f5f5f5','#404040','#d4d4d4','#262626','#a3a3a3'];
type InputMode = 'text' | 'pdf' | 'image' | 'camera' | 'web';

export default function PaperAnalyzer({ onPathwayGenerated }: PaperAnalyzerProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<InputMode>('text');
  const [expanded, setExpanded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [webUrl, setWebUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setText(e.detail.text);
      setMode('text');
      setError(null);
      setSuccess(false);
    };
    window.addEventListener('autoFillAnalyzer', handler as EventListener);
    return () => window.removeEventListener('autoFillAnalyzer', handler as EventListener);
  }, []);

  const resetState = () => {
    setError(null); setSuccess(false); setFileName(null);
    setImagePreview(null); setImageBase64(null); setText(''); setWebUrl('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'pdf' | 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageBase64(result.split(',')[1]);
      if (type === 'image') setImagePreview(result);
      setText(`${type === 'pdf' ? 'PDF' : 'Image'} loaded: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const buildRequest = (apiKey: string) => {
    const prompt = `You are a synthetic biology and metabolic engineering expert.
Analyze the provided research content and extract metabolic pathway information.
Return ONLY valid JSON, no markdown, no explanation:
{
  "nodes": [{"id":"unique_id","label":"Short Name","summary":"One sentence role","citation":"Author, year or 'Extracted from content'"}],
  "edges": [{"start":"source_id","end":"target_id"}]
}
Rules: 4-8 nodes, IDs lowercase with underscores, labels 1-3 words max.`;

    const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const config = { temperature: 0.2, maxOutputTokens: 1500 };

    if ((mode === 'image' || mode === 'camera') && imageBase64)
      return { url: baseUrl, body: { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }] }], generationConfig: config } };
    if (mode === 'pdf' && imageBase64)
      return { url: baseUrl, body: { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'application/pdf', data: imageBase64 } }] }], generationConfig: config } };
    if (mode === 'web' && webUrl)
      return { url: baseUrl, body: { contents: [{ parts: [{ text: `${prompt}\n\nAnalyze this URL: ${webUrl}` }] }], generationConfig: config } };
    return { url: baseUrl, body: { contents: [{ parts: [{ text: `${prompt}\n\nContent:\n${text.slice(0, 3000)}` }] }], generationConfig: config } };
  };

  const handleAnalyze = async () => {
    const hasContent =
      (mode === 'text' && text.trim().length >= 10) ||
      ((mode === 'image' || mode === 'camera' || mode === 'pdf') && imageBase64) ||
      (mode === 'web' && webUrl.trim());
    if (!hasContent) { setError(mode === 'text' ? 'Paste at least a sentence of text.' : mode === 'web' ? 'Enter a valid URL.' : 'Upload a file first.'); return; }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) { setError('API key not found.'); return; }

    setIsAnalyzing(true); setError(null); setSuccess(false);

    try {
      const { url, body } = buildRequest(apiKey);
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) throw new Error('No response from Gemini');
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (!parsed.nodes || !parsed.edges) throw new Error('Invalid response structure');

      const n = parsed.nodes.length;
      const nodes: PathwayNode[] = parsed.nodes.map((node: any, i: number) => {
        const angle = (i / n) * Math.PI * 2;
        const r = n <= 4 ? 2.5 : 3.5;
        return {
          id: node.id, label: node.label, summary: node.summary, citation: node.citation,
          color: COLORS[i % COLORS.length],
          position: [i === 0 ? -r : parseFloat((Math.cos(angle) * r).toFixed(2)), i === 0 ? 0 : parseFloat((Math.sin(angle) * r * 0.6).toFixed(2)), 0] as [number, number, number],
        };
      });

      onPathwayGenerated(nodes, parsed.edges);
      setSuccess(true);
      resetState();
      setExpanded(false);
    } catch (err: any) {
      setError(err.message.includes('JSON') ? 'Unexpected AI format. Try again.' : err.message || 'Something went wrong.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  const canAnalyze =
    (mode === 'text' && text.trim().length >= 10) ||
    ((mode === 'image' || mode === 'camera' || mode === 'pdf') && !!imageBase64) ||
    (mode === 'web' && webUrl.trim().length > 0);

  const extraModes = [
    { id: 'pdf' as InputMode, icon: <Upload size={14} />, label: 'PDF' },
    { id: 'image' as InputMode, icon: <ImageIcon size={14} />, label: 'Image' },
    { id: 'camera' as InputMode, icon: <Camera size={14} />, label: 'Camera' },
    { id: 'web' as InputMode, icon: <Globe size={14} />, label: 'URL' },
  ];

  return (
    <section className="px-4 py-24" id="analyzer"
      style={{ borderTop: 'none' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10 text-center">
          <p className="text-xs font-mono uppercase tracking-widest mb-3"
            style={{ color: 'rgba(255,255,255,0.2)' }}>
            02 · Analysis
          </p>
          {/* Main title - refined copy */}
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-3"
            style={{ letterSpacing: '-0.02em' }}>
            Decode any pathway.
          </h2>
          {/* Subtitle - replacing 论文代谢通路自动生成 */}
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Paste a paper, upload a PDF, or point your camera —{' '}
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>AI extracts the metabolic architecture instantly.</span>
          </p>
        </div>

        {/* GPT/Gemini-style input card */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>

          {/* File/Image preview inside box */}
          {(mode === 'pdf' || mode === 'image' || mode === 'camera') && (
            <div className="px-4 pt-4 pb-2 flex items-center gap-3">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="h-12 w-12 object-cover rounded-lg"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
              ) : (
                <div className="h-12 w-12 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {mode === 'pdf' ? <Upload size={16} style={{ color: 'rgba(255,255,255,0.35)' }} />
                    : <ImageIcon size={16} style={{ color: 'rgba(255,255,255,0.35)' }} />}
                </div>
              )}
              <div className="flex-1">
                {fileName
                  ? <p className="text-sm text-white truncate">{fileName}</p>
                  : <button
                      onClick={() => mode === 'pdf' ? fileInputRef.current?.click() : mode === 'camera' ? cameraInputRef.current?.click() : imageInputRef.current?.click()}
                      className="text-sm transition-colors"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
                      {mode === 'camera' ? 'Tap to take photo' : `Click to upload ${mode === 'pdf' ? 'PDF' : 'image'}`} →
                    </button>
                }
                {fileName && (
                  <button onClick={resetState} className="flex items-center gap-1 text-xs mt-0.5 transition-colors"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                    <X size={10} /> remove
                  </button>
                )}
              </div>
            </div>
          )}

          {/* URL input */}
          {mode === 'web' && (
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <Globe size={14} style={{ color: 'rgba(255,255,255,0.25)' }} className="shrink-0" />
              <input
                type="url"
                value={webUrl}
                onChange={(e) => { setWebUrl(e.target.value); setError(null); }}
                placeholder="https://pubmed.ncbi.nlm.nih.gov/... or https://doi.org/..."
                className="flex-1 bg-transparent text-sm text-white placeholder-neutral-600 focus:outline-none"
              />
              {webUrl && (
                <button onClick={() => setWebUrl('')} style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Main textarea — always visible for text mode */}
          {mode === 'text' && (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null); setSuccess(false); }}
              onKeyDown={handleKeyDown}
              placeholder="Paste an abstract, methods section, or any research text here..."
              rows={4}
              className="w-full bg-transparent px-4 pt-4 pb-2 text-sm text-white placeholder-neutral-600 focus:outline-none resize-none"
              style={{ lineHeight: 1.7 }}
            />
          )}

          {/* Bottom toolbar — GPT style */}
          <div className="px-3 py-3 flex items-center justify-between">

            <div className="flex items-center gap-1">
              {/* Back to text button */}
              {mode !== 'text' && (
                <button
                  onClick={() => { setMode('text'); resetState(); setExpanded(false); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  Text
                </button>
              )}

              {/* + button */}
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                style={{ color: expanded ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = expanded ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                {expanded ? <ChevronUp size={14} /> : <Plus size={14} />}
                <span>{expanded ? 'Less' : 'Add file or URL'}</span>
              </button>

              {/* Extra mode buttons when expanded */}
              {expanded && (
                <div className="flex items-center gap-1">
                  {extraModes.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setMode(m.id); resetState();
                        if (m.id === 'pdf') setTimeout(() => fileInputRef.current?.click(), 100);
                        if (m.id === 'image') setTimeout(() => imageInputRef.current?.click(), 100);
                        if (m.id === 'camera') setTimeout(() => cameraInputRef.current?.click(), 100);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                      style={{
                        color: mode === m.id ? '#ffffff' : 'rgba(255,255,255,0.3)',
                        background: mode === m.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (mode !== m.id) { (e.currentTarget as HTMLElement).style.color = '#ffffff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; } }}
                      onMouseLeave={e => { if (mode !== m.id) { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}>
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send / Analyze button — arrow up icon, GPT style */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !canAnalyze}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: isAnalyzing
                  ? 'rgba(255,255,255,0.06)'
                  : canAnalyze
                    ? '#ffffff'
                    : 'rgba(255,255,255,0.08)',
                color: isAnalyzing || !canAnalyze ? 'rgba(255,255,255,0.2)' : '#0a0a0a',
                cursor: isAnalyzing || !canAnalyze ? 'not-allowed' : 'pointer',
              }}
              title="Generate pathway (or press Enter)"
            >
              {isAnalyzing
                ? <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                : <ArrowUp size={15} strokeWidth={2.5} />
              }
            </button>
          </div>
        </div>

        {/* Hint text below */}
        <p className="text-center text-xs font-mono mt-3"
          style={{ color: 'rgba(255,255,255,0.15)' }}>
          Press Enter to analyze · Shift+Enter for new line · Gemini 1.5 Flash
        </p>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.12)', color: 'rgba(255,150,150,0.8)' }}>
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
            <Sparkles size={14} className="shrink-0" />
            Pathway extracted. Scroll up to explore your visualization ↑
          </div>
        )}
      </div>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={(e) => handleFileUpload(e, 'pdf')} className="hidden" />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} className="hidden" />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFileUpload(e, 'image')} className="hidden" />
    </section>
  );
}
