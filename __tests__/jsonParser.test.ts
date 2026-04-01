import { extractJSON } from '../src/utils/jsonParser';

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
