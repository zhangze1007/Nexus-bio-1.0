/**
 * Token Counter — Lightweight token estimation and cost calculation.
 *
 * Uses word-based estimation (1 token ~ 0.75 words for English text).
 * Pricing is per-million-tokens for both input and output, matching
 * the provider rates used by the Groq and Gemini fallback chain.
 *
 * Pure TypeScript — no runtime dependencies.
 */

// ── Model pricing (USD per 1 000 000 tokens) ──

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Groq models
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama3-70b-8192':         { input: 0.59, output: 0.79 },
  'llama3-8b-8192':          { input: 0.05, output: 0.08 },
  'mixtral-8x7b-32768':      { input: 0.24, output: 0.24 },

  // Gemini models
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash':      { input: 0.075, output: 0.30 },
  'gemini-1.5-pro':        { input: 1.25,  output: 5.00 },
  'gemini-2.0-flash':      { input: 0.10,  output: 0.40 },

  // OpenAI-compatible reference pricing
  'gpt-4o':       { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':  { input: 0.15,  output: 0.60 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
};

const DEFAULT_PRICING = { input: 0.50, output: 0.50 };

/**
 * Count tokens in a string using word-based estimation.
 *
 * Approximation: 1 token ~ 0.75 words for English text,
 * which is equivalent to dividing word count by 0.75,
 * i.e. wordCount / 0.75 = wordCount * 1.333.
 *
 * Handles edge cases:
 * - Empty / whitespace-only strings return 0.
 * - Punctuation-only segments are grouped with adjacent words.
 * - CJK characters count as ~1 token each (they are not word-delimited).
 */
export function countTokens(text: string): number {
  if (!text || text.trim().length === 0) return 0;

  // Count CJK characters (each is roughly 1 token)
  const cjkMatches = text.match(/[一-鿿㐀-䶿豈-﫿　-〿぀-ゟ゠-ヿ]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Strip CJK characters for word-based counting
  const withoutCjk = text.replace(/[一-鿿㐀-䶿豈-﫿　-〿぀-ゟ゠-ヿ]/g, ' ');

  // Split on whitespace, filter empty segments
  const words = withoutCjk.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Estimate: ~1.33 tokens per word (i.e. 1 token ~ 0.75 words)
  const estimatedTokens = Math.ceil(wordCount * (1 / 0.75));

  return estimatedTokens + cjkCount;
}

/**
 * Estimate cost in USD for a given token count and model.
 *
 * @param tokens - Number of tokens
 * @param model  - Model identifier (e.g. 'llama-3.3-70b-versatile')
 * @param role   - Whether these are input or output tokens (default: 'input')
 * @returns Cost in USD (not cents)
 */
export function estimateCost(
  tokens: number,
  model: string,
  role: 'input' | 'output' = 'input',
): number {
  if (tokens <= 0) return 0;

  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const ratePerMillion = role === 'output' ? pricing.output : pricing.input;

  return (tokens / 1_000_000) * ratePerMillion;
}

/**
 * Format a cost value (in USD cents) as a human-readable string.
 *
 * @param cents - Cost in US cents
 * @returns Formatted string, e.g. '$0.0042' or '$1.23'
 */
export function formatCost(cents: number): string {
  if (cents <= 0) return '$0.00';
  const dollars = cents / 100;

  if (dollars < 0.01) {
    // Show up to 4 decimal places for sub-cent amounts
    return `$${dollars.toFixed(4)}`;
  }

  return `$${dollars.toFixed(2)}`;
}

/**
 * Convenience: estimate the total cost for a request (input + output).
 *
 * @param inputTokens  - Number of input/prompt tokens
 * @param outputTokens - Number of output/completion tokens
 * @param model        - Model identifier
 * @returns Total cost in USD
 */
export function estimateRequestCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  return estimateCost(inputTokens, model, 'input')
       + estimateCost(outputTokens, model, 'output');
}
