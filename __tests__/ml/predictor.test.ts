/**
 * Tests for ML Predictor
 *
 * Since no real .onnx model files are shipped, these tests focus on:
 * - Input validation and error handling (model not found, missing inputs)
 * - Schema validation against the registry
 * - Integration with modelRegistry
 *
 * ONNX inference tests require actual .onnx files and should be added
 * when trained models are available in public/models/.
 */

import { predict } from '../../src/services/ml/predictor';
import { getModel, listModels } from '../../src/services/ml/modelRegistry';

describe('predictor', () => {
  describe('model lookup', () => {
    it('throws when model ID is not in registry', async () => {
      await expect(
        predict({ modelId: 'nonexistent-model', inputs: {} }),
      ).rejects.toThrow('Model not found: nonexistent-model');
    });

    it('throws for empty model ID', async () => {
      await expect(
        predict({ modelId: '', inputs: {} }),
      ).rejects.toThrow('Model not found: ');
    });
  });

  describe('input validation', () => {
    it('throws when required input is missing for yield-predictor-v1', async () => {
      await expect(
        predict({
          modelId: 'yield-predictor-v1',
          inputs: {
            pathway_length: 5,
            // missing: num_heterologous, thermodynamic_feasibility, carbon_efficiency
          },
        }),
      ).rejects.toThrow('Missing input');
    });

    it('throws when all inputs are missing for yield-predictor-v1', async () => {
      await expect(
        predict({
          modelId: 'yield-predictor-v1',
          inputs: {},
        }),
      ).rejects.toThrow('Missing input');
    });

    it('throws when required input is missing for enzyme-activity-v1', async () => {
      await expect(
        predict({
          modelId: 'enzyme-activity-v1',
          inputs: {
            sequence_length: 350,
            // missing: molecular_weight, isoelectric_point, gravy
          },
        }),
      ).rejects.toThrow('Missing input');
    });
  });

  describe('registry integration', () => {
    it('all registered models have schemas that predict() can validate against', () => {
      const models = listModels();
      for (const model of models) {
        const meta = getModel(model.id);
        expect(meta).toBeDefined();
        expect(Object.keys(meta!.inputSchema).length).toBeGreaterThan(0);
        expect(Object.keys(meta!.outputSchema).length).toBeGreaterThan(0);
      }
    });

    it('predict fails fast on missing inputs before attempting model load', async () => {
      // This verifies the fail-fast behavior: validation happens before loadModel()
      const start = performance.now();
      try {
        await predict({
          modelId: 'yield-predictor-v1',
          inputs: { pathway_length: 1 }, // missing 3 other inputs
        });
      } catch {
        // expected
      }
      const elapsed = performance.now() - start;
      // Input validation should be near-instant (< 50ms), not waiting for model load
      expect(elapsed).toBeLessThan(50);
    });
  });
});
