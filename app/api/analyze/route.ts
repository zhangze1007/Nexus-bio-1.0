import { NextRequest, NextResponse } from 'next/server';

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
};

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

// ── Try Groq first (OpenAI-compatible format) ──
async function tryGroq(prompt: string, apiKey: string): Promise<string | null> {
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
            messages: [{ role: 'user', content: prompt }],
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
async function tryGemini(body: GeminiRequestBody, apiKey: string): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const geminiBody = {
        ...body,
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
  ]
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
  const searchQuery = typeof rawBody.searchQuery === 'string' ? rawBody.searchQuery.trim() : '';

  let body: GeminiRequestBody;
  let prompt: string;

  if (searchQuery) {
    prompt = buildDynamicPrompt(searchQuery);
    body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    };
  } else {
    // Legacy mode: Gemini-format request body with contents array
    body = rawBody as GeminiRequestBody;

    if (!body?.contents || !Array.isArray(body.contents) || body.contents.length === 0) {
      return jsonResponse({ error: 'Missing contents array or searchQuery' }, 400);
    }

    prompt = extractPrompt(body);
    if (!prompt) {
      return jsonResponse({ error: 'No prompt text found' }, 400);
    }
  }

  const textOnlyRequest = searchQuery ? true : isTextOnlyRequest(body);

  if (!searchQuery && hasMultimodalContent(body) && !geminiKey) {
    return jsonResponse({
      error: 'This request includes non-text content such as an image or file and requires GEMINI_API_KEY. Please configure it in your environment variables.',
    }, 503);
  }

  // ── Try Groq first ──
  if (groqKey && textOnlyRequest) {
    const groqResult = await tryGroq(prompt, groqKey);
    if (groqResult) {
      // Return in Gemini-compatible format so frontend doesn't need to change
      return jsonResponse({
        candidates: [{
          content: {
            parts: [{ text: groqResult }]
          }
        }],
        meta: { provider: 'groq', searchQuery: searchQuery || undefined }
      });
    }
  }

  // ── Fallback to Gemini ──
  if (geminiKey) {
    const geminiResult = await tryGemini(body, geminiKey);
    if (geminiResult) {
      return jsonResponse({
        candidates: [{
          content: {
            parts: [{ text: geminiResult }]
          }
        }],
        meta: { provider: 'gemini', searchQuery: searchQuery || undefined }
      });
    }
  }

  // ── All providers failed ──
  return jsonResponse({
    error: 'All AI providers are currently unavailable. Please try again in a moment.',
  }, 503);
}
