'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ArrowUp, Upload, Camera, Globe, Image as ImageIcon,
  X, ChevronUp, Plus, AlertCircle, CheckCircle2, Loader2,
  FlaskConical, Zap, ChevronDown
} from 'lucide-react';
import {
  PathwayNode, PathwayEdge, isValidNode, isValidEdge, sanitizeNodeId,
  AxonInteraction, BottleneckEnzyme, DeNovoDesignStrategy,
} from '../types';
import { BIO_THEME_COLORS } from './ThreeScene';

interface PaperAnalyzerProps {
  onPathwayGenerated: (nodes: PathwayNode[], edges: PathwayEdge[]) => void;
}

/** Assign a semantic color from BIO_THEME_COLORS based on nodeType and risk. */
function getSemanticColor(nodeType: string, riskScore?: number): string {
  if (nodeType === 'impurity' || (riskScore !== undefined && riskScore > 0.7)) return BIO_THEME_COLORS.RED;
  if (nodeType === 'enzyme')        return BIO_THEME_COLORS.AMBER;
  if (nodeType === 'intermediate')  return BIO_THEME_COLORS.PURPLE;
  if (nodeType === 'cofactor')      return BIO_THEME_COLORS.PINK;
  if (nodeType === 'gene')          return BIO_THEME_COLORS.GREEN;
  if (nodeType === 'complex')       return BIO_THEME_COLORS.PURPLE;
  return BIO_THEME_COLORS.CYAN; // metabolite / unknown / default
}

type InputMode = 'text' | 'pdf' | 'image' | 'camera' | 'web';
type AnalysisState = 'idle' | 'analyzing' | 'success' | 'error';

// ── Evidence-first prompt — traceability is mandatory ──
const buildPrompt = (content: string) => `Act as a Senior Metabolic Engineer and Lead Data Scientist. Deeply analyze the provided fermentation dataset or metabolic pathway literature. Evaluate carbon flux efficiency using strictly TRY (Titer, Rate, Yield) metrics.

Conduct a rigorous risk analysis focusing on industrial bottlenecks:
1. Cellular Fitness & Toxicity: Identify exact thresholds for product-induced toxicity (IC50) where host strain growth inhibition occurs.
2. Downstream Processing (DSP) & Separation Cost: Pinpoint structural analogs sharing similar polarity/boiling points that exponentially inflate separation costs.
3. Cofactor Ledger: Compute the net Cofactor Balance (ATP/NADH consumption).
4. Carbon ROI: Assess the overall Carbon Efficiency (Atom Economy %).
5. Genetic Strategy: Suggest exactly 1-2 native host genes for Knockout (KO) or Overexpression (OE) to redirect carbon flux.

Output STRICTLY as a JSON array matching our PathwayNode schema.
- For thermodynamic energy sinks (ΔG > 0) or high toxicity: set color_mapping: "Red", risk_score > 0.7.
- For optimal high-yield intermediates: set color_mapping: "Green".
- Generate a highly professional summary and a verifiable audit_trail referencing specific predictive models (e.g., 'Flux Balance Analysis anomaly detected').

CRITICAL RULES:
1. Every node's evidenceSnippet must be an EXACT QUOTE copied verbatim from the text. Do not paraphrase.
2. Include ALL pathway intermediates, branch-point byproducts, and competing impurities mentioned in the text.
3. For each reaction edge, estimate thermodynamic favorability when the text provides clues (e.g. spontaneous, rate-limiting, high yield).
4. For nodes with risk_score > 0.7, you MUST assess toxicity_impact and ic50_toxicity (identify the exact concentration threshold where host strain growth inhibition occurs) and separation_cost_index to meet Nexus-Bio commercial compliance standards.
5. If the text does not explicitly mention impurities, use your metabolic engineering knowledge to identify likely side reactions and byproducts. Pinpoint structural analogs that would inflate DSP separation costs and set dsp_bottleneck accordingly.
6. Evaluate carbon flux efficiency using TRY metrics: estimate volumetric productivity (g/L/h) when data is available, assess metabolic burden on the host strain.
7. For each node summary, use advanced data science and synthetic biology terminology (e.g. flux balance analysis, proteome allocation, metabolic burden coefficient).
8. For each audit_trail, reference specific predictive models or literature data (e.g. "Flux Balance Analysis anomaly detected — carbon diversion at Node X", "BRENDA Km = 0.3 mM, suggesting substrate limitation").
9. Compute the net Cofactor Balance for each reaction step — specify ATP/NADH/NADPH consumption or generation (e.g. "Consumes 1 ATP + 1 NADPH per cycle", "Net: −2 ATP, +1 NADH").
10. Assess the overall Carbon Efficiency (Atom Economy %) for each node — calculate the fraction of substrate carbon atoms retained in the product vs. lost as CO2 or waste (0-100%).
11. For pathway-critical intermediates and branch points, suggest 1-2 native host genes for Knockout (KO) or Overexpression (OE) to redirect carbon flux towards the target product (e.g. "KO: ERG9 — blocks squalene synthase to prevent FPP diversion to sterol pathway"). Provide both genetic_intervention (concise, e.g. "KO: ERG9") and gene_recommendation (detailed explanation).

Return ONLY this exact JSON, nothing else:

{
  "nodes": [
    {
      "id": "lowercase_underscore_id",
      "label": "Standard biochemical name (1-4 words)",
      "nodeType": "metabolite",
      "summary": "TRY-informed analysis: role in pathway, flux contribution, and metabolic burden assessment.",
      "evidenceSnippet": "EXACT QUOTE from the source text that mentions this entity.",
      "citation": "Author et al., Year, Journal",
      "confidenceScore": 0.85,
      "thermodynamic_stability": "High",
      "color_mapping": "Green",
      "risk_score": 0.0,
      "toxicity_impact": "None — desired pathway product with no host cytotoxicity below 50 mM",
      "ic50_toxicity": "No growth inhibition below 50 mM",
      "separation_cost_index": 0.0,
      "dsp_bottleneck": "None — product easily separated from fermentation broth",
      "cofactor_balance": "Consumes 1 ATP + 2 NADPH per mevalonate cycle",
      "carbon_efficiency": 85.0,
      "atom_economy": 85.0,
      "genetic_intervention": "OE: tHMGR",
      "gene_recommendation": "OE: tHMGR — rate-limiting enzyme overexpression increases flux 3-fold",
      "audit_trail": "FBA model: optimal flux node — carbon partitioning coefficient 0.92"
    }
  ],
  "edges": [
    {
      "start": "source_id",
      "end": "target_id",
      "relationshipType": "converts",
      "direction": "forward",
      "evidence": "EXACT QUOTE from source text describing this reaction.",
      "predicted_delta_G_kJ_mol": -50.0,
      "spontaneity": "Spontaneous",
      "yield_prediction": "High",
      "thickness_mapping": "Thick",
      "audit_trail": "Thermodynamic assessment: ΔG << 0, irreversible under physiological conditions"
    }
  ]
}

Rules:
- 4 to 15 nodes (include the most significant intermediates, impurities, and pathway entities)
- Extract molecular entities: metabolites, enzymes, genes, proteins, cofactors, impurities, intermediates
- Do NOT include cells, tissues, organisms, physiological processes, or anatomical structures as nodes
- nodeType: metabolite | enzyme | gene | complex | cofactor | impurity | intermediate | unknown
- relationshipType: catalyzes | produces | consumes | activates | inhibits | converts | transports | regulates | unknown
- IDs: lowercase letters and underscores only, no spaces
- evidenceSnippet: must be copied word-for-word from the source text
- thermodynamic_stability: "High" | "Moderate" | "Low" (stability of the compound)
- color_mapping: "Green" (thermodynamically favorable, high-yield, minimal competitive inhibition) | "Yellow" (moderate yield) | "Orange" (unstable/low yield) | "Red" (impurity/risk, ΔG > 0, or exceeds cytotoxicity thresholds) | "Purple" (dual-role intermediate/precursor at metabolic crossroads) | "Blue" (cofactor/auxiliary)
- risk_score: 0.0 to 1.0 (0 = no risk, 1 = major impurity/competitor; use 0 for desired pathway metabolites). Set > 0.7 for high-risk impurities, thermodynamic energy sinks (ΔG > 0), or nodes exceeding cytotoxicity thresholds
- toxicity_impact: describe potential toxicity to host cells with specific thresholds when possible
- ic50_toxicity: specific IC50 or growth inhibition threshold (e.g. "< 10 μM growth inhibition", "IC50 ~8 mM in S. cerevisiae", "No toxicity below 50 mM")
- separation_cost_index: 0.0 to 1.0 — physicochemical similarity to the target product (higher = harder to separate)
- dsp_bottleneck: detailed reason for high separation cost if any (e.g. "Similar logP to target — co-elutes on C18 reverse phase", "Near-identical boiling point inflates distillation cost")
- For impurity nodes: typically set risk_score > 0.5, color_mapping "Red", nodeType "impurity". Nodes with risk_score > 0.7 MUST have toxicity_impact, ic50_toxicity, and separation_cost_index > 0.5
- cofactor_balance: net ATP/NAD(P)H consumption or generation at this step (e.g. "Consumes 1 ATP + 1 NADPH", "Generates 1 NADH", "Cofactor-neutral")
- carbon_efficiency: 0.0 to 100.0 — atom economy percentage (fraction of substrate carbon atoms retained in the product; 100 = no carbon loss)
- atom_economy: 0.0 to 100.0 — same as carbon_efficiency, overall atom economy percentage
- genetic_intervention: concise KO/OE label (e.g. "KO: ERG9", "OE: tHMGR"). Use "N/A" when not applicable
- gene_recommendation: detailed explanation of gene engineering target for KO or OE to improve flux towards target. Use "N/A" for terminal products or impurities where no engineering target applies
- predicted_delta_G_kJ_mol: estimated Gibbs free energy change (negative = spontaneous)
- spontaneity: "Highly Spontaneous" | "Spontaneous" | "Non-spontaneous" | "Spontaneous (condition dependent)"
- yield_prediction: brief yield assessment with TRY context (e.g. "High — titer >10 g/L achievable", "Moderate — rate-limiting step", "Low — thermodynamic sink")
- thickness_mapping: "Thick" (high flux) | "Medium" (moderate) | "Thin" (low flux/side reaction)
- audit_trail: reference specific predictive models, FBA results, BRENDA kinetics, or literature data
- No markdown, no explanation, no text outside the JSON

Source text:
${content.slice(0, 6000)}`;

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

  const VALID_NODE_TYPES = ['metabolite','enzyme','gene','complex','cofactor','impurity','intermediate','unknown'];
  const VALID_COLOR_MAPPINGS = ['Green','Yellow','Orange','Red','Purple','Blue'];

  const nodes: PathwayNode[] = validNodes.map((node: any, i: number) => {
    const n = node as Record<string, unknown>;
    const count = validNodes.length;
    const angle = (i / count) * Math.PI * 2;
    const r = count <= 4 ? 2.5 : count <= 8 ? 3.5 : 4.5;

    return {
      id: sanitizeNodeId(String(n.id)),
      label: String(n.label).slice(0, 32),
      canonicalLabel: n.canonicalLabel ? String(n.canonicalLabel) : undefined,
      nodeType: (VALID_NODE_TYPES.includes(n.nodeType as string)
        ? n.nodeType : 'unknown') as any,
      summary: n.summary ? String(n.summary) : 'No summary available.',
      evidenceSnippet: n.evidenceSnippet ? String(n.evidenceSnippet) : undefined,
      citation: n.citation ? String(n.citation) : 'Extracted from provided text',
      confidenceScore: typeof n.confidenceScore === 'number'
        ? Math.min(1, Math.max(0, n.confidenceScore)) : undefined,
      // v1.1: Risk & Compliance fields
      risk_score: typeof n.risk_score === 'number'
        ? Math.min(1, Math.max(0, n.risk_score)) : undefined,
      thermodynamic_stability: typeof n.thermodynamic_stability === 'string'
        ? n.thermodynamic_stability : undefined,
      color_mapping: (VALID_COLOR_MAPPINGS.includes(n.color_mapping as string)
        ? n.color_mapping : undefined) as any,
      audit_trail: typeof n.audit_trail === 'string' ? n.audit_trail : undefined,
      toxicity_impact: typeof n.toxicity_impact === 'string' ? n.toxicity_impact : undefined,
      separation_cost_index: typeof n.separation_cost_index === 'number'
        ? Math.min(1, Math.max(0, n.separation_cost_index)) : undefined,
      // v1.2: Metabolic Engineering Intelligence fields
      cofactor_balance: typeof n.cofactor_balance === 'string' ? n.cofactor_balance : undefined,
      carbon_efficiency: typeof n.carbon_efficiency === 'number'
        ? Math.min(100, Math.max(0, n.carbon_efficiency)) : undefined,
      gene_recommendation: typeof n.gene_recommendation === 'string' ? n.gene_recommendation : undefined,
      // v1.3: Industrial Metrics & DSP Intelligence fields
      genetic_intervention: typeof n.genetic_intervention === 'string' ? n.genetic_intervention : undefined,
      atom_economy: typeof n.atom_economy === 'number'
        ? Math.min(100, Math.max(0, n.atom_economy)) : undefined,
      dsp_bottleneck: typeof n.dsp_bottleneck === 'string' ? n.dsp_bottleneck : undefined,
      ic50_toxicity: typeof n.ic50_toxicity === 'string' ? n.ic50_toxicity : undefined,
      color: getSemanticColor(
        VALID_NODE_TYPES.includes(n.nodeType as string) ? String(n.nodeType) : 'unknown',
        typeof n.risk_score === 'number' ? n.risk_score : undefined,
      ),
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
      // v1.1: Thermodynamic edge fields
      predicted_delta_G_kJ_mol: typeof e.predicted_delta_G_kJ_mol === 'number'
        ? e.predicted_delta_G_kJ_mol : undefined,
      spontaneity: typeof e.spontaneity === 'string' ? e.spontaneity : undefined,
      yield_prediction: typeof e.yield_prediction === 'string' ? e.yield_prediction : undefined,
      thickness_mapping: (['Thick','Medium','Thin'].includes(e.thickness_mapping)
        ? e.thickness_mapping : undefined) as any,
      audit_trail: typeof e.audit_trail === 'string' ? e.audit_trail : undefined,
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

  // Axon progressive disclosure state
  const [axonInteraction, setAxonInteraction] = useState<AxonInteraction | null>(null);
  const [bottleneckEnzymes, setBottleneckEnzymes] = useState<BottleneckEnzyme[]>([]);
  const [designStrategies, setDesignStrategies] = useState<DeNovoDesignStrategy[]>([]);
  const [pendingPathway, setPendingPathway] = useState<{ nodes: PathwayNode[]; edges: PathwayEdge[] } | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [designExpanded, setDesignExpanded] = useState(false);

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
    const config = { temperature: 0.1, maxOutputTokens: 4096 };

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

      // Extract Axon predictive design fields
      const p = parsed as Record<string, unknown>;
      const interaction = p.axon_interaction as AxonInteraction | undefined;
      const bottlenecks = Array.isArray(p.bottleneck_enzymes) ? p.bottleneck_enzymes as BottleneckEnzyme[] : [];
      const strategies = Array.isArray(p.de_novo_design_strategies) ? p.de_novo_design_strategies as DeNovoDesignStrategy[] : [];

      // Progressive disclosure: if Axon has a Socratic question, show it first
      if (interaction?.question) {
        setAxonInteraction({ ...interaction, disclosure_phase: 'socratic' });
        setBottleneckEnzymes(bottlenecks);
        setDesignStrategies(strategies);
        setPendingPathway(pathway);
        setSelectedOption(null);
        setDesignExpanded(false);
        setAnalysisState('success');
      } else {
        // No interaction block — reveal immediately
        onPathwayGenerated(pathway.nodes, pathway.edges);
        setAnalysisState('success');
        resetState();
        setExpanded(false);
      }

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

  // Axon progressive disclosure: user selects an investigation path → reveal pathway
  const handleAxonOptionSelect = (option: string) => {
    setSelectedOption(option);
    if (axonInteraction) {
      setAxonInteraction({ ...axonInteraction, disclosure_phase: 'revealed' });
    }
    if (pendingPathway) {
      onPathwayGenerated(pendingPathway.nodes, pendingPathway.edges);
    }
  };

  // Dismiss Axon dialogue and clean up
  const dismissAxonDialogue = () => {
    setAxonInteraction(null);
    setBottleneckEnzymes([]);
    setDesignStrategies([]);
    setPendingPathway(null);
    setSelectedOption(null);
    setDesignExpanded(false);
    resetState();
    setExpanded(false);
  };

  // Option label mapping for display
  const optionLabels: Record<string, string> = {
    enzyme_substrate_docking: 'Analyze Enzyme-Substrate Docking',
    flux_balance_optimization: 'Optimize Flux Balance',
    cofactor_optimization: 'Explore Cofactor Optimization',
    dsp_analysis: 'Investigate DSP Constraints',
  };

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
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            Analysis
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
                ? <img src={imagePreview} alt="Preview" style={{ height: '48px', width: '48px', objectFit: 'cover', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }} />
                : <div style={{ height: '48px', width: '48px', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
                  Text
                </button>
              )}

              <button onClick={() => setExpanded(!expanded)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '16px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '12px', cursor: 'pointer' }}
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
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '16px', background: mode === m.id ? 'rgba(255,255,255,0.1)' : 'none', border: 'none', color: mode === m.id ? '#ffffff' : 'rgba(255,255,255,0.35)', fontSize: '12px', cursor: 'pointer' }}>
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
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textAlign: 'center' }}>
              Extracting pathway structure from literature...
            </p>
          )}
          {analysisState === 'error' && errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '20px', background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.12)' }}>
              <AlertCircle size={13} style={{ color: 'rgba(255,120,120,0.8)', flexShrink: 0 }} />
              <p style={{ color: 'rgba(255,140,140,0.8)', fontSize: '12px', margin: 0 }}>{errorMsg}</p>
            </div>
          )}
          {analysisState === 'success' && !axonInteraction && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <CheckCircle2 size={13} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: 0 }}>
                Pathway extracted. Scroll up to explore the visualization ↑
              </p>
            </div>
          )}
          {analysisState === 'idle' && (
            <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textAlign: 'center' }}>
              Press Enter to analyze · Shift+Enter for new line · Gemini 2.0 Flash
            </p>
          )}
        </div>

        {/* ── Axon Socratic Dialogue ── */}
        {axonInteraction && (
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Axon thought bubble — Glassmorphism 2.0 */}
            <div style={{
              borderRadius: '16px',
              padding: '18px 20px',
              background: 'linear-gradient(135deg, rgba(201,228,222,0.10) 0%, rgba(201,228,222,0.04) 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(201,228,222,0.18)',
              boxShadow: '0 4px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(201,228,222,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #C9E4DE 0%, #95C8BC 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, color: '#1a2f2a',
                }}>A</div>
                <span style={{ fontSize: '11px', color: 'rgba(201,228,222,0.6)', fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Axon · Predictive Design
                </span>
              </div>
              <p style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: '13.5px',
                lineHeight: 1.7,
                margin: 0,
                fontFamily: "var(--font-sans, 'Inter', sans-serif)",
              }}>
                {axonInteraction.question}
              </p>

              {/* Option buttons — Socratic phase */}
              {axonInteraction.disclosure_phase === 'socratic' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                  {axonInteraction.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleAxonOptionSelect(opt)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '20px',
                        border: '1px solid rgba(201,228,222,0.22)',
                        background: 'rgba(201,228,222,0.06)',
                        color: 'rgba(201,228,222,0.85)',
                        fontSize: '12px',
                        fontFamily: "var(--font-sans, 'Inter', sans-serif)",
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(201,228,222,0.15)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,228,222,0.35)';
                        (e.currentTarget as HTMLElement).style.color = '#C9E4DE';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(201,228,222,0.06)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,228,222,0.22)';
                        (e.currentTarget as HTMLElement).style.color = 'rgba(201,228,222,0.85)';
                      }}
                    >
                      {optionLabels[opt] || opt.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              )}

              {/* Revealed phase indicator */}
              {axonInteraction.disclosure_phase === 'revealed' && selectedOption && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={12} style={{ color: '#95C8BC' }} />
                  <span style={{ fontSize: '11px', color: 'rgba(201,228,222,0.55)', fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>
                    Selected: {optionLabels[selectedOption] || selectedOption}
                  </span>
                </div>
              )}
            </div>

            {/* Bottleneck enzymes — kinetic warning cards */}
            {axonInteraction.disclosure_phase === 'revealed' && bottleneckEnzymes.length > 0 && (
              <div style={{
                borderRadius: '14px',
                padding: '16px 18px',
                background: 'linear-gradient(135deg, rgba(250,237,203,0.08) 0%, rgba(250,237,203,0.03) 100%)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(250,237,203,0.15)',
                boxShadow: '0 2px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(250,237,203,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <Zap size={13} style={{ color: '#FAEDCB' }} />
                  <span style={{ fontSize: '11px', color: 'rgba(250,237,203,0.7)', fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Bottleneck Enzymes
                  </span>
                </div>
                {bottleneckEnzymes.map((b, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 16px',
                    padding: i > 0 ? '10px 0 0' : '0',
                    borderTop: i > 0 ? '1px solid rgba(250,237,203,0.08)' : 'none',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12.5px' }}>{b.enzyme}</span>
                    <span style={{
                      color: '#FAEDCB', fontSize: '12px', textAlign: 'right',
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      fontFeatureSettings: "'tnum' 1",
                    }}>
                      {b.efficiency_percent}% eff
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', gridColumn: '1 / -1' }}>{b.evidence}</span>
                    <span style={{
                      color: 'rgba(250,237,203,0.6)', fontSize: '11px', textAlign: 'right', gridColumn: '2',
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      fontFeatureSettings: "'tnum' 1",
                    }}>
                      −{b.yield_loss_percent}% yield
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* De Novo Design Strategies — collapsible */}
            {axonInteraction.disclosure_phase === 'revealed' && designStrategies.length > 0 && (
              <div style={{
                borderRadius: '14px',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(201,228,222,0.06) 0%, rgba(201,228,222,0.02) 100%)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(201,228,222,0.12)',
                boxShadow: '0 2px 20px rgba(0,0,0,0.15)',
              }}>
                <button
                  onClick={() => setDesignExpanded(!designExpanded)}
                  style={{
                    width: '100%', padding: '14px 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FlaskConical size={13} style={{ color: '#95C8BC' }} />
                    <span style={{ fontSize: '11px', color: 'rgba(201,228,222,0.7)', fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      De Novo Design Strategies ({designStrategies.length})
                    </span>
                  </div>
                  <ChevronDown size={13} style={{
                    color: 'rgba(201,228,222,0.4)',
                    transform: designExpanded ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s',
                  }} />
                </button>

                {designExpanded && designStrategies.map((s, i) => (
                  <div key={i} style={{
                    padding: '0 18px 16px',
                    borderTop: '1px solid rgba(201,228,222,0.06)',
                  }}>
                    <p style={{
                      fontSize: '11px', color: 'rgba(201,228,222,0.5)', marginBottom: '10px', marginTop: '12px',
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      Target: {s.node_id.replace(/_/g, ' ')}
                    </p>
                    {[
                      { label: 'Active Site', value: s.de_novo_design_strategy.active_site_remodeling },
                      { label: 'Thermal Stability', value: s.de_novo_design_strategy.thermal_stability_enhancement },
                      { label: 'Substrate Specificity', value: s.de_novo_design_strategy.substrate_specificity_tuning },
                      { label: 'Predicted Impact', value: s.de_novo_design_strategy.predicted_impact },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '10.5px', color: 'rgba(201,228,222,0.45)',
                          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                          fontFeatureSettings: "'tnum' 1",
                        }}>
                          {label}
                        </span>
                        <p style={{
                          fontSize: '12px', color: 'rgba(255,255,255,0.65)',
                          lineHeight: 1.6, margin: '2px 0 0',
                        }}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Pathway revealed confirmation + dismiss */}
            {axonInteraction.disclosure_phase === 'revealed' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                    Pathway visualized above ↑
                  </span>
                </div>
                <button
                  onClick={dismissAxonDialogue}
                  style={{
                    padding: '5px 12px', borderRadius: '14px', fontSize: '11px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={e => handleFileUpload(e, 'pdf')} className="hidden" />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={e => handleFileUpload(e, 'image')} className="hidden" />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={e => handleFileUpload(e, 'image')} className="hidden" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
