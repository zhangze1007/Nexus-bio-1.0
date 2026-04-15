import { extractJSON, parseJson, ParseResult, ParseFailureReason } from '../src/utils/jsonParser';

type Failure = Extract<ParseResult, { ok: false }>;
function asFailure(r: ParseResult): Failure {
  if (r.ok) throw new Error('expected parseJson to fail but it succeeded');
  // Cast is needed because tsconfig sets `strict: false`, which disables
  // post-throw narrowing of discriminated unions.
  return r as Failure;
}

describe('parseJson (discriminated)', () => {
  it('returns ok=true with strategy "direct" for clean JSON', () => {
    const r = parseJson('{"a":1}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ a: 1 });
      expect(r.strategy).toBe('direct');
    }
  });

  it('returns ok=true with strategy "fenced" for markdown-fenced JSON', () => {
    const r = parseJson('```json\n{"a":1}\n```');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.strategy).toBe('fenced');
  });

  it('returns ok=true with strategy "sliced" when JSON is embedded in prose', () => {
    const r = parseJson('Here:\n{"a":1}\nDone.');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.strategy).toBe('sliced');
  });

  it('returns ok=true with strategy "repaired" for trailing commas / single quotes', () => {
    const r = parseJson("{'a': 1,}");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.strategy).toBe('repaired');
  });

  it('distinguishes "empty" from "no-object" from "invalid-syntax"', () => {
    const cases: Array<[string, ParseFailureReason]> = [
      ['   ', 'empty'],
      ['hello world, no braces here', 'no-object'],
      ['{ this is not :: json @@ }', 'invalid-syntax'],
    ];
    for (const [input, expected] of cases) {
      expect(asFailure(parseJson(input)).reason).toBe(expected);
    }
  });
});

describe('extractJSON', () => {
  it('parses valid JSON directly', () => {
    const result = extractJSON('{"nodes": [{"id": "a"}]}');
    expect(result).toEqual({ nodes: [{ id: 'a' }] });
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"nodes": []}\n```';
    expect(extractJSON(raw)).toEqual({ nodes: [] });
  });

  it('finds JSON within surrounding text', () => {
    const raw = 'Here is the result:\n{"nodes": [{"id": "x"}]}\nDone.';
    const result = extractJSON(raw) as any;
    expect(result).not.toBeNull();
    expect(result.nodes[0].id).toBe('x');
  });

  it('handles trailing commas', () => {
    const raw = "{'nodes': [{'id': 'a',},],}";
    const result = extractJSON(raw) as any;
    expect(result).not.toBeNull();
    expect(result.nodes[0].id).toBe('a');
  });

  it('returns null for completely invalid input', () => {
    expect(extractJSON('not json at all')).toBeNull();
    expect(extractJSON('')).toBeNull();
  });

  it('handles nested JSON with markdown', () => {
    const raw = '```\n{"nodes": [{"id": "n1", "label": "Test"}], "edges": []}\n```';
    const result = extractJSON(raw) as any;
    expect(result).not.toBeNull();
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('handles single quotes (strategy 4)', () => {
    const raw = "{'key': 'value'}";
    const result = extractJSON(raw) as any;
    expect(result).not.toBeNull();
    expect(result.key).toBe('value');
  });
});
