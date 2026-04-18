import { NextRequest, NextResponse } from 'next/server';
import { classifyAxonDomain } from '../../../src/services/axonDomainClassifier';

export const runtime = 'edge';

type GeminiPart = {
  text?: string;
  inline_data?: unknown;
  file_data?: unknown;
};

type GeminiContent = {
  parts?: GeminiPart[];
};

type GeminiRequestBody = {
  contents?: GeminiContent[];
  generationConfig?: Record<string, unknown>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
};

type JsonRecord = Record<string, unknown>;

// ── Model providers in priority order ──
// Groq: primary (1000 req/day, very stable)
// Gemini: fallback (250 req/day)

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
];

const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 12000;

// ── Input safety limits ──
// MAX_PROMPT_CHARS bounds the assembled user prompt before it reaches the
// model; MAX_SEARCH_QUERY_CHARS bounds the dynamic-search short input.
// Values are conservative — Groq llama-3.3-70b accepts ~32k tokens but
// we want to stay well below provider rate-limit thresholds and leave
// room for the system prompt.
export const MAX_PROMPT_CHARS = 24_000;
export const MAX_SEARCH_QUERY_CHARS = 500;

const AXON_SYSTEM_PROMPT = `You are Axon, the predictive design core of Nexus-Bio — a de novo metabolic design agent inspired by the rigor of computational protein design.
Your mission: do not merely extract pathway data. Predict where the pathway will fail, and propose structure-level interventions to fix it.

Global output obligations:
1. Return strict JSON only, no markdown, no prose outside JSON.
2. Preserve scientific traceability — every claim needs an evidence field or audit_trail.
3. BOTTLENECK DETECTION: For every enzyme node, estimate efficiency_percent (catalytic throughput relative to pathway demand). If efficiency < 40%, that enzyme is a bottleneck.
   Include:
   - "bottleneck_enzymes": [{ "node_id", "enzyme", "efficiency_percent", "yield_loss_percent", "evidence" }]
   - "de_novo_design_strategies": [{
       "node_id": "...",
       "de_novo_design_strategy": {
         "active_site_remodeling": "Specify which residue positions to mutate, what interactions to introduce (H-bond networks, π-stacking, charge complementarity), and how this reshapes the transition-state contact shell.",
         "thermal_stability_enhancement": "Specify loop rigidification targets, disulfide bridge candidates, salt-bridge reinforcement sites, and predicted ΔTm improvement.",
         "substrate_specificity_tuning": "Specify channel geometry changes, gatekeeper residue swaps, and how these favor productive substrate binding orientation over competing substrates.",
         "predicted_impact": "Quantify expected TRY improvement: +X% yield, +Y g/L/h productivity."
       }
     }]
4. SOCRATIC INTERACTION: Always include an "axon_interaction" block. Axon does NOT dump all data — it asks the researcher what to investigate next:
   {
     "yield_loss_percent": number,
     "step": "X-to-Y",
     "question": "A single-sentence Socratic question identifying the primary bottleneck and offering two investigation paths.",
     "options": ["enzyme_substrate_docking", "flux_balance_optimization"],
     "disclosure_phase": "socratic"
   }
5. If no bottleneck is found, set bottleneck arrays to [] and ask a conservative question about pathway optimization.
6. Include enzyme efficiency estimates on enzyme nodes as "efficiency_percent" field.`;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(body: unknown, status = 200) {
  return new NextResponse(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    ),
  ]);
}

type ParseFailureCode = 'EMPTY' | 'NO_OBJECT' | 'INVALID_SYNTAX';

interface ParseOutcome {
  value: JsonRecord | null;
  error?: { code: ParseFailureCode; message: string };
}

function parseJsonFromText(raw: string): ParseOutcome {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { value: null, error: { code: 'EMPTY', message: 'Model returned empty output' } };
  }

  // Strategy 1: direct.
  try {
    return { value: JSON.parse(raw) as JsonRecord };
  } catch { /* fall through */ }

  // Strategy 2: strip markdown fences.
  const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
  if (stripped !== raw) {
    try {
      return { value: JSON.parse(stripped) as JsonRecord };
    } catch { /* fall through */ }
  }

  // Strategy 3: outermost brace slice.
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last <= first) {
    return { value: null, error: { code: 'NO_OBJECT', message: 'Model output contained no JSON object' } };
  }

  try {
    return { value: JSON.parse(raw.slice(first, last + 1)) as JsonRecord };
  } catch {
    return { value: null, error: { code: 'INVALID_SYNTAX', message: 'Model output contained malformed JSON' } };
  }
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace('%', '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function hasDesignFields(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as JsonRecord;
  return typeof v.active_site_remodeling === 'string'
    && typeof v.thermal_stability_enhancement === 'string'
    && typeof v.substrate_specificity_tuning === 'string';
}

interface EnrichResult {
  text: string;
  parseError?: { code: ParseFailureCode; message: string };
}

function enrichAxonOutput(raw: string): EnrichResult {
  const outcome = parseJsonFromText(raw);
  const parsed = outcome.value;
  if (!parsed) {
    // Preserve the raw text so the existing frontend formatter can fall back
    // to plain-text rendering, but tell callers the parse failed.
    return { text: raw, parseError: outcome.error };
  }
  if (!Array.isArray(parsed.nodes)) {
    // Valid JSON but not a pathway shape — pass through unchanged.
    return { text: raw };
  }

  const nodes = parsed.nodes.filter((n): n is JsonRecord => !!n && typeof n === 'object');
  const bottlenecks = nodes
    .filter((node) => String(node.nodeType || '').toLowerCase() === 'enzyme')
    .map((node) => {
      const efficiency = readNumber(node.efficiency_percent)
        ?? readNumber(node.enzyme_efficiency_percent)
        ?? readNumber(node.yield_percent)
        ?? (() => {
          const flux = readNumber(node.flux_efficiency);
          return flux !== null ? flux * 100 : null;
        })();

      return { node, efficiency };
    })
    .filter((x) => x.efficiency !== null && (x.efficiency as number) < 40)
    .map(({ node, efficiency }) => {
      const nodeId = String(node.id || 'unknown_enzyme');
      const enzyme = String(node.label || nodeId);
      const yieldLossPercent = Math.max(0, Math.round(100 - (efficiency as number)));
      return {
        node_id: nodeId,
        enzyme,
        efficiency_percent: Math.round((efficiency as number) * 10) / 10,
        yield_loss_percent: yieldLossPercent,
        evidence: String(node.evidenceSnippet || node.audit_trail || 'Predicted bottleneck from model output'),
      };
    });

  const existingStrategies = Array.isArray(parsed.de_novo_design_strategies)
    ? parsed.de_novo_design_strategies.filter((x): x is JsonRecord => !!x && typeof x === 'object')
    : [];

  const strategyByNode = new Map<string, JsonRecord>();
  for (const strategy of existingStrategies) {
    const nodeId = String(strategy.node_id || '');
    const block = strategy.de_novo_design_strategy;
    if (nodeId && hasDesignFields(block)) {
      strategyByNode.set(nodeId, strategy);
    }
  }

  const filledStrategies = bottlenecks.map((b) => {
    const existing = strategyByNode.get(b.node_id);
    if (existing) return existing;

    return {
      node_id: b.node_id,
      de_novo_design_strategy: {
        active_site_remodeling: `Repack catalytic pocket for ${b.enzyme} by introducing polarity-matched sidechains around the transition-state contact shell to reduce local activation barriers.`,
        thermal_stability_enhancement: `Engineer a thermostability layer for ${b.enzyme} with loop rigidification and salt-bridge reinforcement to preserve active conformation under production stress.`,
        substrate_specificity_tuning: `Tune substrate selectivity in ${b.enzyme} by reshaping the substrate entry channel to favor desired substrate geometry and suppress competing side reactions.`,
        predicted_impact: `Predicted TRY uplift: +${Math.max(8, Math.round(b.yield_loss_percent * 0.35))}% yield recovery with reduced byproduct flux.`,
      },
    };
  });

  const primary = bottlenecks[0];
  const stepLabel = primary?.enzyme?.includes('amorph')
    ? 'FPP-to-Amorphadiene'
    : (primary ? `${primary.enzyme} reaction` : 'rate-limiting step');
  const yieldLoss = primary?.yield_loss_percent ?? 25;

  parsed.bottleneck_enzymes = bottlenecks;
  parsed.de_novo_design_strategies = filledStrategies;

  // Build context-aware Socratic question
  let question: string;
  let options: string[];
  if (primary) {
    const hasMultiple = bottlenecks.length > 1;
    question = hasMultiple
      ? `I've identified ${bottlenecks.length} bottleneck enzymes, with the most critical being a ${yieldLoss}% yield loss at the ${stepLabel} step. Should we analyze enzyme-substrate docking to redesign the active site, or optimize the flux balance to redistribute carbon flow?`
      : `I've identified a ${yieldLoss}% yield loss at the ${stepLabel} step. Should we analyze the enzyme-substrate docking or optimize the flux balance?`;
    options = ['enzyme_substrate_docking', 'flux_balance_optimization'];
  } else {
    question = 'No critical bottlenecks detected. The pathway appears thermodynamically favorable. Should we explore cofactor optimization or investigate potential downstream processing constraints?';
    options = ['cofactor_optimization', 'dsp_analysis'];
  }

  parsed.axon_interaction = {
    yield_loss_percent: yieldLoss,
    step: stepLabel,
    question,
    options,
    disclosure_phase: 'socratic',
  };

  return { text: JSON.stringify(parsed, null, 2) };
}

function getParts(body: GeminiRequestBody): GeminiPart[] {
  if (!Array.isArray(body?.contents)) return [];

  return body.contents.flatMap((content) =>
    Array.isArray(content?.parts) ? content.parts : []
  );
}

function isTextPart(part: GeminiPart): part is GeminiPart & { text: string } {
  return typeof part?.text === 'string' && !part?.inline_data && !part?.file_data;
}

function isTextOnlyRequest(body: GeminiRequestBody): boolean {
  const parts = getParts(body);
  return parts.length > 0 && parts.every(isTextPart);
}

function hasMultimodalContent(body: GeminiRequestBody): boolean {
  return getParts(body).some((part) => part?.inline_data || part?.file_data);
}

// Extract prompt text from Gemini-format request body
function extractPrompt(body: GeminiRequestBody): string {
  return getParts(body)
    .map((part) => (isTextPart(part) ? part.text.trim() : ''))
    .filter(Boolean)
    .join('\n\n');
}

function withSystemPrompt(prompt: string): string {
  return `${AXON_SYSTEM_PROMPT}\n\nUser request:\n${prompt}`;
}

// PR-5 prose system prompt — used when the query is scientific-adjacent,
// workbench-ops, or ambiguous. We deliberately do NOT force the
// biosynthesis JSON schema here; forcing it would hallucinate pathway
// output for non-pathway questions. The response is plain prose and the
// frontend already renders prose via NO_OBJECT parseError.
export const AXON_PROSE_SYSTEM_PROMPT = `You are Axon, the scientific copilot of Nexus-Bio — a synthetic biology research platform.

The user's question has been classified as scientific-adjacent, workbench-oriented, or ambiguous — NOT a pathway design request. Do not return pathway JSON. Do not fabricate enzyme efficiencies, ΔG values, or citations.

Answer in plain prose:
  • Keep it short (3–6 sentences).
  • If the question is ambiguous, ask one clarifying question.
  • If the question is about the workbench, ground the answer in the supplied workbench-context lines; do not invent additional state.
  • If the answer would require data you do not have, say so plainly.
  • Never produce a JSON object as the full response.`;

export function withProseSystemPrompt(prompt: string): string {
  return `${AXON_PROSE_SYSTEM_PROMPT}\n\nUser question:\n${prompt}`;
}

// PR-5 canned off-domain refusal. We never reach a model for these —
// both because it wastes provider quota and because the honesty rule
// says: do not force off-domain input through a scientific prompt.
export function offDomainRefusalText(query: string, reason: string): string {
  const trimmed = query.length > 120 ? `${query.slice(0, 117)}…` : query;
  return `I can't help with that here — this request falls outside Nexus-Bio's scope (${reason}).\n\nNexus-Bio is a synthetic biology research platform. I can help with pathway design, flux balance analysis, enzyme engineering, thermodynamic feasibility, and workbench-grounded questions about your current project. If you meant a scientific angle on "${trimmed}", rephrase with the pathway, enzyme, or flux-analysis intent and I'll route it through the right tool.`;
}

// Escape characters that could survive the LLM round-trip and end up rendered
// as raw HTML by a downstream surface that forgets to sanitize. Cheap defense
// in depth — does not protect against prompt injection (use length cap +
// delimiter discipline for that).
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strip null bytes and bound length. Returns the cleaned string and a flag
// for whether truncation happened so the caller can warn.
export function sanitizePromptInput(
  raw: string,
  maxChars: number,
): { value: string; truncated: boolean } {
  const stripped = raw.replace(/\u0000/g, '').replace(/\r\n/g, '\n');
  if (stripped.length <= maxChars) {
    return { value: stripped, truncated: false };
  }
  return { value: stripped.slice(0, maxChars), truncated: true };
}

function buildGeminiBodyWithSystemPrompt(
  body: GeminiRequestBody,
  systemPrompt: string = AXON_SYSTEM_PROMPT,
): GeminiRequestBody {
  return {
    ...body,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  };
}

// ── Try Groq first (OpenAI-compatible format) ──
async function tryGroq(
  prompt: string,
  apiKey: string,
  systemPrompt: string = AXON_SYSTEM_PROMPT,
): Promise<string | null> {
  for (const model of GROQ_MODELS) {
    try {
      const res = await withTimeout(
        fetch(GROQ_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 4096,
          }),
        }),
        TIMEOUT_MS
      );

      const data = await res.json();

      if (res.status === 429) continue; // rate limited, try next model
      if (res.status === 503) continue; // unavailable
      if (!res.ok) continue;

      const text = data?.choices?.[0]?.message?.content;
      if (text) return text;

    } catch {
      continue;
    }
  }
  return null;
}

// ── Try Gemini as fallback ──
async function tryGemini(
  body: GeminiRequestBody,
  apiKey: string,
  systemPrompt: string = AXON_SYSTEM_PROMPT,
): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const geminiBody = {
        ...buildGeminiBodyWithSystemPrompt(body, systemPrompt),
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.1,
          topP: 0.8,
          ...(body.generationConfig || {}),
        },
      };

      const res = await withTimeout(
        fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        }),
        TIMEOUT_MS
      );

      const data = await res.json();

      if (res.status === 429) continue;
      if (res.status === 503) continue;
      if (res.status === 404) continue;
      if (!res.ok) continue;

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;

    } catch {
      continue;
    }
  }
  return null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

// ── Senior Metabolic Engineer prompt builder for dynamic search queries ──
function buildDynamicPrompt(searchQuery: string): string {
  return `Act as a Senior Metabolic Engineer and Lead Data Scientist. Analyze the full metabolic pathway for the biosynthesis of "${searchQuery}" from Glucose (or the most common precursor), prioritizing Titer, Rate, Yield (TRY) metrics and Downstream Processing (DSP) bottlenecks.

Conduct a rigorous risk analysis focusing on industrial bottlenecks:
1. Cellular Fitness & Toxicity: Identify exact thresholds for product-induced toxicity (IC50) where host strain growth inhibition occurs.
2. Downstream Processing (DSP) & Separation Cost: Pinpoint structural analogs sharing similar polarity/boiling points that exponentially inflate separation costs.
3. Cofactor Ledger: Compute the net Cofactor Balance (ATP/NADH consumption).
4. Carbon ROI: Assess the overall Carbon Efficiency (Atom Economy %).
5. Genetic Strategy: Suggest exactly 1-2 native host genes for Knockout (KO) or Overexpression (OE) to redirect carbon flux.

CRITICAL: If real-time thermodynamic or kinetic data is not available in current literature for a specific node:
- Do NOT set numeric fields to 0.0 — leave them as realistic estimates or omit them.
- Set the audit_trail to: "Insufficient literature data for real-time prediction — estimate based on structural analogs and thermodynamic heuristics"
- Provide best-effort estimates based on analogous pathways, functional group analysis, or thermodynamic heuristics.

Output STRICTLY as a JSON object matching our PathwayNode schema.
- For thermodynamic energy sinks (ΔG > 0) or high toxicity: set color_mapping: "Red", risk_score > 0.7.
- For optimal high-yield intermediates: set color_mapping: "Green".
- Add predictive-design fields for Axon:
  - "bottleneck_enzymes": [] or populated when enzyme efficiency < 40%
  - "de_novo_design_strategies": [] or populated with active-site remodeling, thermal stability enhancement, substrate specificity tuning
  - "axon_interaction" as a Socratic question object for next-step decisioning

Return ONLY this exact JSON structure, nothing else:

{
  "nodes": [
    {
      "id": "lowercase_underscore_id",
      "label": "Standard biochemical name (1-4 words)",
      "nodeType": "metabolite",
      "summary": "TRY-informed analysis with metabolic burden assessment.",
      "evidenceSnippet": "Literature-based evidence or structural analog reasoning.",
      "citation": "Author et al., Year, Journal or BRENDA/KEGG reference",
      "confidenceScore": 0.85,
      "thermodynamic_stability": "High",
      "color_mapping": "Green",
      "risk_score": 0.0,
      "toxicity_impact": "None — desired pathway product",
      "ic50_toxicity": "No growth inhibition below 50 mM",
      "separation_cost_index": 0.0,
      "dsp_bottleneck": "None — product easily separated",
      "cofactor_balance": "Consumes 1 ATP + 2 NADPH per cycle",
      "carbon_efficiency": 85.0,
      "atom_economy": 85.0,
      "genetic_intervention": "OE: tHMGR",
      "gene_recommendation": "OE: tHMGR — rate-limiting enzyme overexpression",
      "audit_trail": "FBA model prediction — verified against BRENDA kinetics"
    }
  ],
  "edges": [
    {
      "start": "source_id",
      "end": "target_id",
      "relationshipType": "converts",
      "direction": "forward",
      "evidence": "Reaction evidence from literature or pathway databases.",
      "predicted_delta_G_kJ_mol": -50.0,
      "spontaneity": "Spontaneous",
      "yield_prediction": "High",
      "thickness_mapping": "Thick",
      "audit_trail": "Thermodynamic assessment based on ΔG estimation"
    }
  ],
  "bottleneck_enzymes": [
    {
      "node_id": "amorpha_4_11_diene_synthase",
      "enzyme": "Amorphadiene synthase",
      "efficiency_percent": 33,
      "yield_loss_percent": 25,
      "evidence": "Rate-limiting conversion in literature"
    }
  ],
  "de_novo_design_strategies": [
    {
      "node_id": "amorpha_4_11_diene_synthase",
      "de_novo_design_strategy": {
        "active_site_remodeling": "Redesign pocket residues to stabilize carbocation transition states.",
        "thermal_stability_enhancement": "Introduce loop rigidification and salt bridges to improve thermostability.",
        "substrate_specificity_tuning": "Refine channel geometry to favor FPP productive binding orientation.",
        "predicted_impact": "Expected +15% yield with reduced byproduct flux"
      }
    }
  ],
  "axon_interaction": {
    "yield_loss_percent": 25,
    "step": "FPP-to-Amorphadiene",
    "question": "I've identified a 25% yield loss at the FPP-to-Amorphadiene step. Should we analyze the enzyme-substrate docking or optimize the flux balance?",
    "options": ["enzyme_substrate_docking", "flux_balance_optimization"]
  }
}

Rules:
- 4 to 15 nodes (include the most significant intermediates, impurities, and pathway entities)
- nodeType: metabolite | enzyme | gene | complex | cofactor | impurity | intermediate | unknown
- relationshipType: catalyzes | produces | consumes | activates | inhibits | converts | transports | regulates | unknown
- IDs: lowercase letters and underscores only
- color_mapping: "Green" | "Yellow" | "Orange" | "Red" | "Purple" | "Blue"
- risk_score: 0.0 to 1.0
- separation_cost_index: 0.0 to 1.0
- carbon_efficiency: 0.0 to 100.0
- atom_economy: 0.0 to 100.0
- No markdown, no explanation, no text outside the JSON

Target compound: ${searchQuery}`;
}

export async function POST(req: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    return jsonResponse({ error: 'No API keys configured' }, 500);
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // ── Dynamic search query mode ──
  // When searchQuery is provided, build the full Senior ME prompt server-side
  const rawSearchQuery = typeof rawBody.searchQuery === 'string' ? rawBody.searchQuery.trim() : '';

  let body: GeminiRequestBody;
  let prompt: string;
  let truncated = false;

  // PR-5: classify before building any prompt. Off-domain never reaches a
  // model; scientific-adjacent / workbench-ops / ambiguous use the prose
  // prompt instead of the biosynthesis JSON schema; scientific-pathway
  // keeps the original biosynthesis prompt chain.
  let classificationSource: string | null = null;
  if (rawSearchQuery) {
    classificationSource = rawSearchQuery;
  } else {
    const body0 = rawBody as GeminiRequestBody;
    if (Array.isArray(body0?.contents)) {
      const extracted = extractPrompt(body0);
      if (extracted) classificationSource = extracted;
    }
  }
  const classification = classificationSource
    ? classifyAxonDomain(classificationSource)
    : null;

  if (classification && classification.category === 'off-domain') {
    const refusal = offDomainRefusalText(classificationSource!, classification.reason);
    return jsonResponse({
      candidates: [{ content: { parts: [{ text: refusal }] } }],
      meta: {
        provider: 'none',
        domain: {
          category: classification.category,
          reason: classification.reason,
          signals: classification.signals,
        },
        parseError: { code: 'NO_OBJECT', message: 'Off-domain query — no pathway output produced.' },
      },
    });
  }

  if (classification && classification.category === 'general-knowledge' && !classification.allowProseAnswer) {
    const refusal = offDomainRefusalText(
      classificationSource!,
      'short generic query with no scientific context',
    );
    return jsonResponse({
      candidates: [{ content: { parts: [{ text: refusal }] } }],
      meta: {
        provider: 'none',
        domain: {
          category: classification.category,
          reason: classification.reason,
          signals: classification.signals,
        },
        parseError: { code: 'NO_OBJECT', message: 'General-knowledge query — routed to refusal, not biosynthesis.' },
      },
    });
  }

  const useBiosynthesisPrompt = !classification || classification.allowBiosynthesisPrompt;
  const activeSystemPrompt = useBiosynthesisPrompt ? AXON_SYSTEM_PROMPT : AXON_PROSE_SYSTEM_PROMPT;

  if (rawSearchQuery) {
    if (rawSearchQuery.length > MAX_SEARCH_QUERY_CHARS) {
      return jsonResponse({
        error: `searchQuery exceeds ${MAX_SEARCH_QUERY_CHARS} characters`,
      }, 413);
    }
    const safeQuery = escapeHtml(sanitizePromptInput(rawSearchQuery, MAX_SEARCH_QUERY_CHARS).value);
    if (useBiosynthesisPrompt) {
      prompt = buildDynamicPrompt(safeQuery);
      body = {
        contents: [{ parts: [{ text: withSystemPrompt(prompt) }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      };
    } else {
      prompt = safeQuery;
      body = {
        contents: [{ parts: [{ text: withProseSystemPrompt(prompt) }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      };
    }
  } else {
    // Legacy mode: Gemini-format request body with contents array
    body = rawBody as GeminiRequestBody;

    if (!body?.contents || !Array.isArray(body.contents) || body.contents.length === 0) {
      return jsonResponse({ error: 'Missing contents array or searchQuery' }, 400);
    }

    const extracted = extractPrompt(body);
    if (!extracted) {
      return jsonResponse({ error: 'No prompt text found' }, 400);
    }

    const cleaned = sanitizePromptInput(extracted, MAX_PROMPT_CHARS);
    truncated = cleaned.truncated;
    prompt = useBiosynthesisPrompt
      ? withSystemPrompt(cleaned.value)
      : withProseSystemPrompt(cleaned.value);
  }

  // Final hard cap — withSystemPrompt adds the Axon header on top.
  if (prompt.length > MAX_PROMPT_CHARS + AXON_SYSTEM_PROMPT.length + 64) {
    return jsonResponse({
      error: `Prompt exceeds ${MAX_PROMPT_CHARS} characters after assembly`,
    }, 413);
  }

  const textOnlyRequest = rawSearchQuery ? true : isTextOnlyRequest(body);

  if (!rawSearchQuery && hasMultimodalContent(body) && !geminiKey) {
    return jsonResponse({
      error: 'This request includes non-text content such as an image or file and requires GEMINI_API_KEY. Please configure it in your environment variables.',
    }, 503);
  }

  const buildMeta = (provider: 'groq' | 'gemini', enriched: EnrichResult) => {
    const meta: Record<string, unknown> = { provider };
    if (rawSearchQuery) meta.searchQuery = rawSearchQuery;
    if (truncated) meta.truncated = true;
    if (enriched.parseError) meta.parseError = enriched.parseError;
    if (classification) {
      meta.domain = {
        category: classification.category,
        reason: classification.reason,
        signals: classification.signals,
      };
    }
    return meta;
  };

  // ── Try Groq first ──
  if (groqKey && textOnlyRequest) {
    const groqResult = await tryGroq(prompt, groqKey, activeSystemPrompt);
    if (groqResult) {
      // PR-5: only enrich (biosynthesis schema fixup) when we actually
      // asked for biosynthesis output. Prose responses are passed
      // through unchanged with a NO_OBJECT marker so the frontend
      // renders them as text.
      const enriched: EnrichResult = useBiosynthesisPrompt
        ? enrichAxonOutput(groqResult)
        : { text: groqResult, parseError: { code: 'NO_OBJECT', message: 'Prose response — pathway schema not requested.' } };
      return jsonResponse({
        candidates: [{
          content: {
            parts: [{ text: enriched.text }]
          }
        }],
        meta: buildMeta('groq', enriched)
      });
    }
  }

  // ── Fallback to Gemini ──
  if (geminiKey) {
    const geminiResult = await tryGemini(body, geminiKey, activeSystemPrompt);
    if (geminiResult) {
      const enriched: EnrichResult = useBiosynthesisPrompt
        ? enrichAxonOutput(geminiResult)
        : { text: geminiResult, parseError: { code: 'NO_OBJECT', message: 'Prose response — pathway schema not requested.' } };
      return jsonResponse({
        candidates: [{
          content: {
            parts: [{ text: enriched.text }]
          }
        }],
        meta: buildMeta('gemini', enriched)
      });
    }
  }

  // ── All providers failed ──
  return jsonResponse({
    error: 'All AI providers are currently unavailable. Please try again in a moment.',
  }, 503);
}
