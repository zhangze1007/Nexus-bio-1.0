import {
  RetrosynthesisRequestSchema,
  TFARequestSchema,
  ProEvolMLRequestSchema,
  validateSchema,
} from '../src/schemas';

/**
 * T3-4: API-boundary input schemas. Each converted tool must REJECT malformed
 * input with a typed validation error (not crash downstream in the engine).
 */
describe('tool input schemas reject malformed input', () => {
  describe('retrosynthesis', () => {
    it('rejects a missing targetSmiles with a typed error', () => {
      const r = validateSchema(RetrosynthesisRequestSchema, { maxSteps: 5 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.some((e) => e.field === 'targetSmiles')).toBe(true);
    });
    it('rejects a non-numeric maxSteps', () => {
      const r = validateSchema(RetrosynthesisRequestSchema, { targetSmiles: 'CCO', maxSteps: 'lots' });
      expect(r.ok).toBe(false);
    });
    it('accepts a valid payload', () => {
      const r = validateSchema(RetrosynthesisRequestSchema, { targetSmiles: 'CCO', maxSteps: 5 });
      expect(r.ok).toBe(true);
    });
  });

  describe('tfa', () => {
    it('rejects an empty reactions array', () => {
      const r = validateSchema(TFARequestSchema, {
        reactions: [],
        conditions: { pH: 7, ionicStrength: 0.1, temperature: 298 },
      });
      expect(r.ok).toBe(false);
    });
    it('rejects an out-of-range pH', () => {
      const r = validateSchema(TFARequestSchema, {
        reactions: [{ id: 'r1', deltaG0Prime: -10, stoichiometry: { a: -1, b: 1 } }],
        conditions: { pH: 99, ionicStrength: 0.1, temperature: 298 },
      });
      expect(r.ok).toBe(false);
    });
    it('accepts a valid model', () => {
      const r = validateSchema(TFARequestSchema, {
        reactions: [{ id: 'r1', deltaG0Prime: -10, stoichiometry: { a: -1, b: 1 } }],
        conditions: { pH: 7, ionicStrength: 0.1, temperature: 298 },
      });
      expect(r.ok).toBe(true);
    });
  });

  describe('proevol-ml', () => {
    it('rejects a bad modelType', () => {
      const r = validateSchema(ProEvolMLRequestSchema, { artifact: {}, modelType: 'transformer' });
      expect(r.ok).toBe(false);
    });
    it('rejects a missing artifact', () => {
      const r = validateSchema(ProEvolMLRequestSchema, { modelType: 'ridge' });
      expect(r.ok).toBe(false);
    });
    it('accepts a valid control payload', () => {
      const r = validateSchema(ProEvolMLRequestSchema, { artifact: {}, modelType: 'random_forest', seed: 7 });
      expect(r.ok).toBe(true);
    });
  });
});
