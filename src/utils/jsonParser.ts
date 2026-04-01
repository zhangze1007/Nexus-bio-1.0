/**
 * Multi-strategy JSON parser for AI output.
 * Extracted from PaperAnalyzer for testability and reuse.
 */

export function extractJSON(raw: string): unknown | null {
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
