import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, FlaskConical, AlertCircle, Loader2,
  Upload, Camera, Globe, FileText, X, Image as ImageIcon
} from 'lucide-react';
import { PathwayNode } from '../types';

interface PaperAnalyzerProps {
  onPathwayGenerated: (nodes: PathwayNode[], edges: { start: string; end: string }[]) => void;
}

const COLORS = [
  '#4ade80', '#facc15', '#60a5fa', '#f87171',
  '#fb923c', '#c084fc', '#34d399', '#f472b6',
  '#38bdf8', '#a78bfa',
];

type InputMode = 'text' | 'pdf' | 'image' | 'camera' | 'web';

export default function PaperAnalyzer({ onPathwayGenerated }: PaperAnalyzerProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<InputMode>('text');
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
    setError(null);
    setSuccess(false);
    setFileName(null);
    setImagePreview(null);
    setImageBase64(null);
    setText('');
    setWebUrl('');
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setImageBase64(base64);
      setText(`PDF loaded: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result.split(',')[1]);
      setText(`Image loaded: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const buildGeminiRequest = (apiKey: string) => {
    const systemPrompt = `You are a synthetic biology and metabolic engineering expert.
Analyze the provided research content and extract the metabolic pathway information.

Return ONLY a valid JSON object with this exact structure, no markdown, no explanation:
{
  "nodes": [
    {
      "id": "unique_id_no_spaces",
      "label": "Compound Name",
      "summary": "One sentence describing this compound's role in the pathway",
      "citation": "Extract author, year, journal if mentioned, otherwise write 'Extracted from provided content'"
    }
  ],
  "edges": [
    {
      "start": "source_node_id",
      "end": "target_node_id"
    }
  ]
}

Rules:
- Extract 4 to 8 key metabolic nodes (compounds, enzymes, or metabolites)
- Edges represent metabolic reactions or conversions between nodes
- IDs must be lowercase with underscores only, no spaces
- Keep labels short (1-3 words max)
- Only include nodes and edges clearly mentioned in the content`;

    if ((mode === 'image' || mode === 'camera') && imageBase64) {
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        body: {
          contents: [{
            parts: [
              { text: systemPrompt },
              { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
            ]
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
        }
      };
    }

    if (mode === 'pdf' && imageBase64) {
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        body: {
          contents: [{
            parts: [
              { text: systemPrompt },
              { inline_data: { mime_type: 'application/pdf', data: imageBase64 } }
            ]
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
        }
      };
    }

    if (mode === 'web' && webUrl) {
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        body: {
          contents: [{
            parts: [{ text: `${systemPrompt}\n\nAnalyze this research paper URL and extract metabolic pathway information: ${webUrl}\n\nIf you cannot access the URL, analyze based on the topic in the URL.` }]
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
        }
      };
    }

    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      body: {
        contents: [{
          parts: [{ text: `${systemPrompt}\n\nResearch content:\n${text.slice(0, 3000)}` }]
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
      }
    };
  };

  const handleAnalyze = async () => {
    const hasContent =
      (mode === 'text' && text.trim().length >= 50) ||
      ((mode === 'image' || mode === 'camera' || mode === 'pdf') && imageBase64) ||
      (mode === 'web' && webUrl.trim());

    if (!hasContent) {
      setError(mode === 'text' ? 'Please paste at least a paragraph of text.'
        : mode === 'web' ? 'Please enter a valid URL.'
        : 'Please upload a file first.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setSuccess(false);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError('Gemini API key not found. Please check your environment variables.');
      setIsAnalyzing(false);
      return;
    }

    try {
      const { url, body } = buildGeminiRequest(apiKey);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('No response from Gemini');

      const cleaned = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed.nodes || !parsed.edges) throw new Error('Invalid response structure from AI');

      const nodeCount = parsed.nodes.length;
      const nodesWithMeta: PathwayNode[] = parsed.nodes.map((node: any, i: number) => {
        const angle = (i / nodeCount) * Math.PI * 2;
        const radius = nodeCount <= 4 ? 2.5 : 3.5;
        const x = i === 0 ? -radius : Math.cos(angle) * radius;
        const y = i === 0 ? 0 : Math.sin(angle) * radius * 0.6;
        return {
          id: node.id,
          label: node.label,
          position: [parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2)), 0] as [number, number, number],
          summary: node.summary,
          citation: node.citation,
          color: COLORS[i % COLORS.length],
        };
      });

      onPathwayGenerated(nodesWithMeta, parsed.edges);
      setSuccess(true);
      resetState();
    } catch (err: any) {
      setError(err.message.includes('JSON')
        ? 'AI returned an unexpected format. Please try again.'
        : err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const modes: { id: InputMode; icon: React.ReactNode; label: string; sublabel: string }[] = [
    { id: 'text', icon: <FileText size={18} />, label: 'Paste Text', sublabel: 'Abstract / Methods' },
    { id: 'pdf', icon: <Upload size={18} />, label: 'Upload PDF', sublabel: 'Research paper' },
    { id: 'image', icon: <ImageIcon size={18} />, label: 'Image', sublabel: 'Figure / Screenshot' },
    { id: 'camera', icon: <Camera size={18} />, label: 'Camera', sublabel: 'Take a photo' },
    { id: 'web', icon: <Globe size={18} />, label: 'Web URL', sublabel: 'DOI / PubMed' },
  ];

  const canAnalyze =
    (mode === 'text' && text.trim().length >= 50) ||
    ((mode === 'image' || mode === 'camera' || mode === 'pdf') && !!imageBase64) ||
    (mode === 'web' && webUrl.trim().length > 0);

  return (
    <section className="py-24 px-4 bg-zinc-900 border-t border-zinc-800" id="analyzer">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-mono mb-6">
            <Sparkles size={14} />
            AI-Powered · Gemini 1.5 Flash
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Paper → Pathway Generator
          </h2>
          <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">
            论文代谢通路自动生成
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 md:p-8">

          {/* Mode Selector */}
          <div className="grid grid-cols-5 gap-2 mb-8">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); resetState(); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center ${
                  mode === m.id
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {m.icon}
                <span className="text-xs font-semibold leading-tight">{m.label}</span>
                <span className="text-xs opacity-60 leading-tight hidden sm:block">{m.sublabel}</span>
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="mb-6">

            {mode === 'text' && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <FlaskConical size={16} className="text-emerald-400" />
                  <span className="text-white text-sm font-semibold">Paste Abstract or Methods Section</span>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => { setText(e.target.value); setError(null); setSuccess(false); }}
                  placeholder="Paste your research paper abstract or methods section here...

Example: 'We engineered E. coli to produce succinic acid via the reductive TCA cycle. Glucose is first converted to phosphoenolpyruvate (PEP) and oxaloacetate (OAA) by PEP carboxylase...'"
                  className="w-full h-48 bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-zinc-300 placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none transition-all"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-zinc-600 text-xs font-mono">{text.length} / 3000 chars</span>
                  {text.length > 2800 && <span className="text-yellow-500 text-xs">First 3000 chars analyzed</span>}
                </div>
              </>
            )}

            {mode === 'pdf' && (
              <>
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handlePdfUpload} className="hidden" />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    fileName ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {fileName ? (
                    <div className="flex flex-col items-center gap-3">
                      <FileText size={40} className="text-emerald-400" />
                      <p className="text-emerald-400 font-semibold">{fileName}</p>
                      <p className="text-zinc-500 text-sm">PDF ready · Click to change</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Upload size={40} className="text-zinc-500" />
                      <p className="text-white font-semibold">Click to upload PDF</p>
                      <p className="text-zinc-500 text-sm">Research paper · Max 10MB</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {mode === 'image' && (
              <>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all ${
                    imagePreview ? 'border-emerald-500/50' : 'border-zinc-700 hover:border-zinc-500 p-10'
                  }`}
                >
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain bg-zinc-900" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <p className="text-white font-semibold">Click to change</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <ImageIcon size={40} className="text-zinc-500" />
                      <p className="text-white font-semibold">Click to upload image</p>
                      <p className="text-zinc-500 text-sm">Pathway figure, paper screenshot, diagram</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {mode === 'camera' && (
              <>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
                <div
                  onClick={() => cameraInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all ${
                    imagePreview ? 'border-emerald-500/50' : 'border-zinc-700 hover:border-zinc-500 p-10'
                  }`}
                >
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Camera" className="w-full max-h-64 object-contain bg-zinc-900" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <p className="text-white font-semibold">Tap to retake</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Camera size={40} className="text-zinc-500" />
                      <p className="text-white font-semibold">Tap to open camera</p>
                      <p className="text-zinc-500 text-sm">Point at a paper, textbook, or pathway diagram</p>
                      <p className="text-emerald-400/60 text-xs font-mono mt-1">Works great on mobile!</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {mode === 'web' && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={16} className="text-emerald-400" />
                  <span className="text-white text-sm font-semibold">Enter DOI or PubMed URL</span>
                </div>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => { setWebUrl(e.target.value); setError(null); }}
                    placeholder="https://pubmed.ncbi.nlm.nih.gov/... or https://doi.org/..."
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-300 placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  {webUrl && (
                    <button onClick={() => setWebUrl('')} className="p-3 text-zinc-500 hover:text-white border border-zinc-700 rounded-xl transition-colors">
                      <X size={16} />
                    </button>
                  )}
                </div>
                <p className="text-zinc-600 text-xs mt-2 font-mono">
                  Gemini will analyze the paper topic from this URL.
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-4">
              <Sparkles size={16} className="text-emerald-400" />
              <p className="text-emerald-400 text-sm font-semibold">
                Pathway generated! Scroll up to see your interactive visualization ↑
              </p>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !canAnalyze}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-xl transition-colors flex items-center justify-center gap-3 text-lg"
          >
            {isAnalyzing ? (
              <><Loader2 size={22} className="animate-spin" />Analyzing with Gemini AI...</>
            ) : (
              <><Sparkles size={22} />Generate Pathway</>
            )}
          </button>

          <p className="text-center text-zinc-600 text-xs mt-4 font-mono">
            Powered by Google Gemini 1.5 Flash · Text · PDF · Image · Camera · URL
          </p>
        </div>
      </div>
    </section>
  );
}
