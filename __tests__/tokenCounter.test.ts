import {
  countTokens,
  estimateCost,
  formatCost,
  estimateRequestCost,
} from '../src/services/ai/tokenCounter';

// ── countTokens ──

describe('countTokens', () => {
  it('returns 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countTokens('   \n\t  ')).toBe(0);
  });

  it('estimates tokens for a short English sentence', () => {
    // "Hello world" = 2 words => ceil(2 / 0.75) = 3 tokens
    expect(countTokens('Hello world')).toBe(3);
  });

  it('estimates tokens for a longer paragraph', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    // 9 words => ceil(9 / 0.75) = 12 tokens
    expect(countTokens(text)).toBe(12);
  });

  it('handles text with punctuation attached to words', () => {
    // "Hello, world!" = 2 words => 3 tokens
    expect(countTokens('Hello, world!')).toBe(3);
  });

  it('handles multiple spaces and newlines', () => {
    const text = 'Hello   world\n\nfoo   bar';
    // 4 words => ceil(4 / 0.75) = 6 tokens
    expect(countTokens(text)).toBe(6);
  });

  it('counts CJK characters as approximately 1 token each', () => {
    // "你好世界" = 4 CJK chars + 0 words => 4 tokens
    expect(countTokens('你好世界')).toBe(4);
  });

  it('handles mixed English and CJK text', () => {
    // "Hello 你好 world" = 2 English words + 2 CJK chars
    // English: ceil(2 / 0.75) = 3, CJK: 2 => total 5
    expect(countTokens('Hello 你好 world')).toBe(5);
  });
});

// ── estimateCost ──

describe('estimateCost', () => {
  it('returns 0 for zero tokens', () => {
    expect(estimateCost(0, 'llama-3.3-70b-versatile')).toBe(0);
  });

  it('returns 0 for negative tokens', () => {
    expect(estimateCost(-100, 'llama-3.3-70b-versatile')).toBe(0);
  });

  it('calculates cost for Groq llama-3.3-70b-versatile input', () => {
    // 1M tokens at $0.59/M = $0.59
    expect(estimateCost(1_000_000, 'llama-3.3-70b-versatile', 'input')).toBeCloseTo(0.59, 6);
  });

  it('calculates cost for Groq llama-3.3-70b-versatile output', () => {
    // 1M tokens at $0.79/M = $0.79
    expect(estimateCost(1_000_000, 'llama-3.3-70b-versatile', 'output')).toBeCloseTo(0.79, 6);
  });

  it('calculates cost for Gemini flash-lite input', () => {
    // 500k tokens at $0.075/M = $0.0375
    expect(estimateCost(500_000, 'gemini-2.0-flash-lite', 'input')).toBeCloseTo(0.0375, 8);
  });

  it('uses default pricing for unknown models', () => {
    // 1M tokens at default $0.50/M = $0.50
    expect(estimateCost(1_000_000, 'some-unknown-model', 'input')).toBeCloseTo(0.50, 6);
  });
});

// ── formatCost ──

describe('formatCost', () => {
  it('formats zero cents', () => {
    expect(formatCost(0)).toBe('$0.00');
  });

  it('formats whole dollar amounts', () => {
    expect(formatCost(150)).toBe('$1.50');
  });

  it('formats sub-cent amounts with 4 decimal places', () => {
    // 0.042 cents = $0.00042 => formatted as $0.0004
    expect(formatCost(0.042)).toBe('$0.0004');
  });

  it('formats a typical small cost', () => {
    // 0.5 cents = $0.005 => $0.0050
    expect(formatCost(0.5)).toBe('$0.0050');
  });

  it('formats exactly 1 cent', () => {
    expect(formatCost(1)).toBe('$0.01');
  });

  it('returns $0.00 for negative values', () => {
    expect(formatCost(-5)).toBe('$0.00');
  });
});

// ── estimateRequestCost ──

describe('estimateRequestCost', () => {
  it('sums input and output costs', () => {
    const result = estimateRequestCost(
      1_000_000,
      500_000,
      'llama-3.3-70b-versatile',
    );
    // Input: 1M * 0.59/M = 0.59
    // Output: 500k * 0.79/M = 0.395
    // Total: 0.985
    expect(result).toBeCloseTo(0.985, 6);
  });

  it('returns 0 when both token counts are 0', () => {
    expect(estimateRequestCost(0, 0, 'gemini-2.0-flash-lite')).toBe(0);
  });
});
