/**
 * Tests for ML Model Registry
 */

import { getModel, listModels } from '../../src/services/ml/modelRegistry';

describe('modelRegistry', () => {
  describe('listModels', () => {
    it('returns all registered models', () => {
      const models = listModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
    });

    it('includes yield-predictor-v1', () => {
      const models = listModels();
      const yieldPredictor = models.find(m => m.id === 'yield-predictor-v1');
      expect(yieldPredictor).toBeDefined();
      expect(yieldPredictor!.name).toBe('Yield Predictor');
      expect(yieldPredictor!.framework).toBe('onnx');
    });

    it('includes enzyme-activity-v1', () => {
      const models = listModels();
      const enzymeActivity = models.find(m => m.id === 'enzyme-activity-v1');
      expect(enzymeActivity).toBeDefined();
      expect(enzymeActivity!.name).toBe('Enzyme Activity Predictor');
      expect(enzymeActivity!.framework).toBe('onnx');
    });

    it('every model has required fields', () => {
      const models = listModels();
      for (const model of models) {
        expect(model.id).toBeTruthy();
        expect(model.name).toBeTruthy();
        expect(model.version).toBeTruthy();
        expect(model.description).toBeTruthy();
        expect(model.inputSchema).toBeDefined();
        expect(model.outputSchema).toBeDefined();
        expect(model.framework).toBe('onnx');
        expect(model.filePath).toBeTruthy();
        expect(model.createdAt).toBeTruthy();
      }
    });

    it('every model has at least one input and one output', () => {
      const models = listModels();
      for (const model of models) {
        expect(Object.keys(model.inputSchema).length).toBeGreaterThan(0);
        expect(Object.keys(model.outputSchema).length).toBeGreaterThan(0);
      }
    });
  });

  describe('getModel', () => {
    it('returns yield-predictor-v1 by id', () => {
      const model = getModel('yield-predictor-v1');
      expect(model).toBeDefined();
      expect(model!.id).toBe('yield-predictor-v1');
    });

    it('returns enzyme-activity-v1 by id', () => {
      const model = getModel('enzyme-activity-v1');
      expect(model).toBeDefined();
      expect(model!.id).toBe('enzyme-activity-v1');
    });

    it('returns undefined for unknown model id', () => {
      const model = getModel('nonexistent-model');
      expect(model).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      const model = getModel('');
      expect(model).toBeUndefined();
    });

    it('is case-sensitive', () => {
      const model = getModel('Yield-Predictor-V1');
      expect(model).toBeUndefined();
    });
  });

  describe('yield-predictor-v1 schema', () => {
    it('has the expected input keys', () => {
      const model = getModel('yield-predictor-v1')!;
      const inputKeys = Object.keys(model.inputSchema);
      expect(inputKeys).toContain('pathway_length');
      expect(inputKeys).toContain('num_heterologous');
      expect(inputKeys).toContain('thermodynamic_feasibility');
      expect(inputKeys).toContain('carbon_efficiency');
    });

    it('has predicted_yield as output', () => {
      const model = getModel('yield-predictor-v1')!;
      expect(model.outputSchema).toHaveProperty('predicted_yield');
      expect(model.outputSchema.predicted_yield.type).toBe('number');
    });

    it('all inputs are number type', () => {
      const model = getModel('yield-predictor-v1')!;
      for (const schema of Object.values(model.inputSchema)) {
        expect(schema.type).toBe('number');
      }
    });
  });

  describe('enzyme-activity-v1 schema', () => {
    it('has the expected input keys', () => {
      const model = getModel('enzyme-activity-v1')!;
      const inputKeys = Object.keys(model.inputSchema);
      expect(inputKeys).toContain('sequence_length');
      expect(inputKeys).toContain('molecular_weight');
      expect(inputKeys).toContain('isoelectric_point');
      expect(inputKeys).toContain('gravy');
    });

    it('has log_kcat as output', () => {
      const model = getModel('enzyme-activity-v1')!;
      expect(model.outputSchema).toHaveProperty('log_kcat');
      expect(model.outputSchema.log_kcat.type).toBe('number');
    });
  });
});
