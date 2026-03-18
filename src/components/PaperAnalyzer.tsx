import { useState } from 'react';
import { Sparkles, FlaskConical, AlertCircle, Loader2 } from 'lucide-react';
import { PathwayNode } from '../types';

interface PaperAnalyzerProps {
  onPathwayGenerated: (nodes: PathwayNode[], edges: { start: string; end: string }[]) => void;
}

const COLORS = [
  '#4ade80', '#facc15', '#60a5fa', '#f87171',
  '#fb923c', '#c084fc', '#34d399', '#f472b6',
  '#38bdf8', '#a78bfa',
];

export default function PaperAnalyzer({ onPathwayGenerated }: PaperAnalyzerProps) {
  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAnalyze = async () => {
    if (!text.trim() || text.trim().length < 50) {
      setError('Please paste at least a paragraph of text from a research paper.');
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

    const prompt = `You are a synthetic biology and metabolic engineering expert. 
Analyze the following research paper text and extract the metabolic pathway information.

Return ONLY a valid JSON object with this exact structure, no markdown, no explanation:
{
  "nodes": [
    {
      "id": "unique_id_no_spaces",
      "label": "Compound Name",
      "summary": "One sentence describing this compound's role in the pathway",
      "citation": "Extract author, year, journal if mentioned, otherwise write 'Extracted from provided text'"
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
- Only include nodes and edges clearly mentioned in the text

Research paper text:
${text.slice(0, 3000)}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) throw new Error('No response from Gemini');

      // Clean and parse JSON
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.nodes || !parsed.edges) {
        throw new Error('Invalid response structure from AI');
      }

      // Assign positions and colors to nodes
      const nodeCount = parsed.nodes.length;
      const nodesWithMeta: PathwayNode[] = parsed.nodes.map((node: any, i: number) => {
        // Arrange nodes in a circular/branching layout
        const angle = (i / nodeCount) * Math.PI * 2;
        const radius = nodeCount <= 4 ? 2.5 : 3.5;
        const x = i === 0 ? -radius : Math.cos(angle) * radius;
        const y = i === 0 ? 0 : Math.sin(angle) * radius * 0.6;
        const z = 0;

        return {
          id: node.id,
          label: node.label,
          position: [parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2)), z] as [number, number, number],
          summary: node.summary,
          citation: node.citation,
          color: COLORS[i % COLORS.length],
        };
      });

      onPathwayGenerated(nodesWithMeta, parsed.edges);
      setSuccess(true);
      setText('');
    } catch (err: any) {
      if (err.message.includes('JSON')) {
        setError('AI returned an unexpected format. Please try again.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="py-24 px-4 bg-zinc-900 border-t border-zinc-800" id="analyzer">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-mono mb-6">
            <Sparkles size={14} />
            AI-Powered
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Paper → Pathway Generator
          </h2>
          <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">
            论文代谢通路自动生成
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <FlaskConical size={20} className="text-emerald-400" />
            <h3 className="text-white font-semibold">Paste Research Paper Text</h3>
          </div>

          <p className="text-zinc-500 text-sm mb-4">
            Copy and paste the abstract or methods section from any metabolic engineering paper. 
            Our AI will extract the key pathway nodes and generate an interactive visualization.
          </p>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
              setSuccess(false);
            }}
            placeholder="Paste your research paper abstract or methods section here...

Example: 'We engineered E. coli to produce succinic acid via the reductive TCA cycle. Glucose is first converted to phosphoenolpyruvate (PEP) and oxaloacetate (OAA) by PEP carboxylase. OAA is then reduced to malate, fumarate, and finally succinic acid...'"
            className="w-full h-48 bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-zinc-300 placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none transition-all"
          />

          <div className="flex items-center justify-between mt-2 mb-6">
            <span className="text-zinc-600 text-xs font-mono">
              {text.length} / 3000 characters
            </span>
            {text.length > 2800 && (
              <span className="text-yellow-500 text-xs">Only first 3000 chars will be analyzed</span>
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
                Pathway generated! Scroll up to see your interactive visualization.
              </p>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !text.trim()}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-bold rounded-xl transition-colors flex items-center justify-center gap-3"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Analyzing with Gemini AI...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Generate Pathway
              </>
            )}
          </button>

          <p className="text-center text-zinc-600 text-xs mt-4 font-mono">
            Powered by Google Gemini 2.0 Flash · Results may vary based on paper quality
          </p>
        </div>
      </div>
    </section>
  );
}
