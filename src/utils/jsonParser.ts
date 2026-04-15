/**
 * Multi-strategy JSON parser for AI output.
 *
 * Two surfaces:
 *   - parseJson(raw): discriminated result so callers can distinguish
 *     empty input, "no JSON object found", and invalid syntax.
 *   - extractJSON(raw): legacy nullable wrapper kept for back-compat
 *     with PaperAnalyzer and researchAnswerFormatter.
 */

export type ParseStrategy = 'direct' | 'fenced' | 'sliced' | 'repaired';

export type ParseFailureReason =
  | 'empty'        // input was empty/whitespace
  | 'no-object'    // no `{...}` substring detected
  | 'invalid-syntax'; // braces found but every parse strategy failed

export type ParseResult<T = unknown> =
  | { ok: true; value: T; strategy: ParseStrategy }
  | { ok: false; reason: ParseFailureReason };

function trySliced(raw: string): unknown | undefined {
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last <= first) return undefined;
  try {
    return JSON.parse(raw.slice(first, last + 1));
  } catch {
    return undefined;
  }
}

function tryRepaired(raw: string): unknown | undefined {
  // Trailing-comma fix + single-quote → double-quote heuristic.
  // Intentionally conservative; we only run this as a last resort.
  const fixed = raw
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/'/g, '"')
    .trim();
  const first = fixed.indexOf('{');
  const last = fixed.lastIndexOf('}');
  if (first === -1 || last <= first) return undefined;
  try {
    return JSON.parse(fixed.slice(first, last + 1));
  } catch {
    return undefined;
  }
}

export function parseJson<T = unknown>(raw: string): ParseResult<T> {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, reason: 'empty' };
  }

  // Strategy 1: direct parse.
  try {
    return { ok: true, value: JSON.parse(raw) as T, strategy: 'direct' };
  } catch { /* fall through */ }

  // Strategy 2: strip markdown fences.
  const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
  if (stripped !== raw) {
    try {
      return { ok: true, value: JSON.parse(stripped) as T, strategy: 'fenced' };
    } catch { /* fall through */ }
  }

  // Strategy 3: slice to outermost { ... }.
  const sliced = trySliced(raw);
  if (sliced !== undefined) {
    return { ok: true, value: sliced as T, strategy: 'sliced' };
  }

  // Strategy 4: repair common LLM JSON mistakes.
  const repaired = tryRepaired(raw);
  if (repaired !== undefined) {
    return { ok: true, value: repaired as T, strategy: 'repaired' };
  }

  // Disambiguate failure mode for the caller.
  if (raw.indexOf('{') === -1 || raw.lastIndexOf('}') <= raw.indexOf('{')) {
    return { ok: false, reason: 'no-object' };
  }
  return { ok: false, reason: 'invalid-syntax' };
}

/**
 * Legacy nullable surface — preserved so existing call sites
 * (PaperAnalyzer, researchAnswerFormatter) keep compiling unchanged.
 */
export function extractJSON(raw: string): unknown | null {
  const result = parseJson(raw);
  return result.ok ? result.value : null;
}
