import { useState, useEffect, useRef } from 'react';
import { Sparkles, AlertCircle, Loader2, Plus, Upload, Camera, Globe, FileText, X, Image as ImageIcon, ChevronUp } from 'lucide-react';
import { PathwayNode } from '../types';

interface PaperAnalyzerProps {
  onPathwayGenerated: (nodes: PathwayNode[], edges: { start: string; end: string }[]) => void;
}

const COLORS = ['#4ade80','#facc15','#60a5fa','#f87171','#fb923c','#c084fc','#34d399','#f472b6','#38bdf8','#a78bfa'];
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
      const base64 = result.split(',')[1];
      setImageBase64(base64);
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

    const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const config = { temperature: 0.2, maxOutputTokens: 1500 };

    if ((mode === 'image' || mode === 'camera') && imageBase64) {
      return { url: baseUrl, body: { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }] }], generationConfig: config } };
    }
    if (mode === 'pdf' && imageBase64) {
      return { url: baseUrl, body: { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'application/pdf', data: imageBase64 } }] }], generationConfig: config } };
    }
    if (mode === 'web' && webUrl) {
      return { url: baseUrl, body: { contents: [{ parts: [{ text: `${prompt}\n\nAnalyze this URL: ${webUrl}` }] }], generationConfig: config } };
    }
    return { url: baseUrl, body: { contents: [{ parts: [{ text: `${prompt}\n\nContent:\n${text.slice(0, 3000)}` }] }], generationConfig: config } };
  };

  const handleAnalyze = async () => {
    const hasContent = (mode === 'text' && text.trim().length >= 50) ||
      ((mode === 'image' || mode === 'camera' || mode === 'pdf') && imageBase64) ||
      (mode === 'web' && webUrl.trim());
    if (!hasContent) { setError(mode === 'text' ? 'Paste at least a paragraph of text.' : mode === 'web' ? 'Enter a valid URL.' : 'Upload a file first.'); return; }

    const apiKey = import.meta.env['VITE_GEMINI_API_KEY'];
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

  const canAnalyze = (mode === 'text' && text.trim().length >= 10) ||
    ((mode === 'image' || mode === 'camera' || mode === 'pdf') && !!imageBase64) ||
    (mode === 'web' && webUrl.trim().length > 0);

  const extraModes = [
    { id: 'pdf' as InputMode, icon: <Upload size={15} />, label: 'PDF' },
    { id: 'image' as InputMode, icon: <ImageIcon size={15} />, label: 'Image' },
    { id: 'camera' as InputMode, icon: <Camera size={15} />, label: 'Camera' },
    { id: 'web' as InputMode, icon: <Globe size={15} />, label: 'URL' },
  ];

  return (
    <section className="py-20 px-4 bg-zinc-900 border-t border-zinc-800" id="analyzer">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-mono mb-4">
            <Sparkles size={12} />
            AI-Powered
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Paper → Pathway</h2>
          <p className="text-zinc-500 text-sm font-mono">论文代谢通路自动生成</p>
        </div>

        {/* Main Card */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">

          {/* Text Input — always visible */}
          <div className="p-4">
            {mode === 'text' && (
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setError(null); setSuccess(false); }}
                placeholder="Paste abstract or methods section from any metabolic engineering paper..."
                className="w-full h-16 bg-transparent text-zinc-300 placeholder-zinc-600 text-sm focus:outline-none resize-none"
              />
            )}
            {(mode === 'pdf' || mode === 'image' || mode === 'camera') && (
              <div className="flex items-center gap-3 py-2">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-zinc-700" />
                ) : (
                  <div className="h-16 w-10 rounded-lg border border-dashed border-zinc-700 flex items-center justify-center text-zinc-600">
                    {mode === 'pdf' ? <FileText size={20} /> : <ImageIcon size={20} />}
                  </div>
                )}
                <div className="flex-1">
                  {fileName ? (
                    <p className="text-emerald-400 text-sm font-medium truncate">{fileName}</p>
                  ) : (
                    <button
                      onClick={() => mode === 'pdf' ? fileInputRef.current?.click() : mode === 'camera' ? cameraInputRef.current?.click() : imageInputRef.current?.click()}
                      className="text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                      {mode === 'camera' ? 'Tap to take photo →' : `Click to upload ${mode === 'pdf' ? 'PDF' : 'image'} →`}
                    </button>
                  )}
                  {fileName && (
                    <button onClick={() => { resetState(); }} className="text-xs text-zinc-600 hover:text-zinc-400 mt-1 flex items-center gap-1">
                      <X size={10} /> remove
                    </button>
                  )}
                </div>
              </div>
            )}
            {mode === 'web' && (
              <input
                type="url"
                value={webUrl}
                onChange={(e) => { setWebUrl(e.target.value); setError(null); }}
                placeholder="https://pubmed.ncbi.nlm.nih.gov/... or https://doi.org/..."
                className="w-full bg-transparent text-zinc-300 placeholder-zinc-600 text-sm focus:outline-none py-2"
              />
            )}
          </div>

          {/* Divider + toolbar */}
          <div className="border-t border-zinc-800 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Active mode indicator */}
              {mode !== 'text' && (
                <button
                  onClick={() => { setMode('text'); resetState(); setExpanded(false); }}
                  className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white text-xs transition-colors mr-2"
                >
                  <FileText size={12} />
                  Text
                </button>
              )}

              {/* + expand button */}
              <button
                onClick={() => setExpanded(!expanded)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  expanded
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {expanded ? <ChevronUp size={13} /> : <Plus size={13} />}
                {expanded ? 'Less' : 'Add file or URL'}
              </button>

              {/* Expanded extra modes */}
              {expanded && (
                <div className="flex items-center gap-1 ml-1">
                  {extraModes.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setMode(m.id);
                        resetState();
                        if (m.id === 'pdf') setTimeout(() => fileInputRef.current?.click(), 100);
                        if (m.id === 'image') setTimeout(() => imageInputRef.current?.click(), 100);
                        if (m.id === 'camera') setTimeout(() => cameraInputRef.current?.click(), 100);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all ${
                        mode === m.id
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !canAnalyze}
              className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-950 font-semibold rounded-xl text-sm transition-colors"
            >
              {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isAnalyzing ? 'Analyzing...' : 'Generate'}
            </button>
          </div>

          {/* Error / Success */}
          {(error || success) && (
            <div className={`px-4 py-3 border-t text-sm flex items-center gap-2 ${
              error ? 'border-red-500/20 bg-red-500/5 text-red-400' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
            }`}>
              {error ? <AlertCircle size={14} /> : <Sparkles size={14} />}
              {error || 'Pathway generated! Scroll up to see your visualization ↑'}
            </div>
          )}
        </div>

        <p className="text-center text-zinc-700 text-xs mt-3 font-mono">
          Gemini 1.5 Flash · Text · PDF · Image · Camera · URL
        </p>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={(e) => handleFileUpload(e, 'pdf')} className="hidden" />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} className="hidden" />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFileUpload(e, 'image')} className="hidden" />
    </section>
  );
}
