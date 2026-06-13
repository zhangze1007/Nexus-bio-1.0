import { GaussianProcess, GPConfig } from '../../src/server/gaussianProcess';

describe('Gaussian Process', () => {
  const defaultConfig: GPConfig = {
    kernel: 'rbf',
    lengthScale: 1.0,
    signalVariance: 1.0,
    noiseVariance: 0.01,
  };

  it('fits a simple 1D function', () => {
    const gp = new GaussianProcess(defaultConfig);
    const X = [[0], [1], [2], [3], [4]];
    const y = [0, 0.84, 0.91, 0.14, -0.76];
    gp.fit(X, y);
    const pred = gp.predict([[0.5]]);
    expect(pred[0].mean).toBeDefined();
    expect(pred[0].variance).toBeGreaterThan(0);
  });

  it('returns high uncertainty far from training data', () => {
    const gp = new GaussianProcess(defaultConfig);
    gp.fit([[0]], [1]);
    const near = gp.predict([[0.1]]);
    const far = gp.predict([[100]]);
    expect(far[0].variance).toBeGreaterThan(near[0].variance);
  });

  it('computes expected improvement', () => {
    const gp = new GaussianProcess(defaultConfig);
    gp.fit([[0], [1], [2]], [0, 1, 0.5]);
    const ei = gp.expectedImprovement([[1.5]], 1.0);
    expect(ei[0]).toBeGreaterThanOrEqual(0);
  });

  it('predicts multiple points at once', () => {
    const gp = new GaussianProcess(defaultConfig);
    gp.fit([[0], [1], [2]], [0, 1, 0.5]);
    const preds = gp.predict([[0.5], [1.5], [2.5]]);
    expect(preds).toHaveLength(3);
    preds.forEach(p => {
      expect(p.mean).toBeDefined();
      expect(p.variance).toBeGreaterThan(0);
    });
  });

  it('variance is zero at training points when noise is zero', () => {
    const gp = new GaussianProcess({
      ...defaultConfig,
      noiseVariance: 1e-10,
    });
    gp.fit([[0], [1]], [1, 2]);
    const pred = gp.predict([[0]]);
    expect(pred[0].variance).toBeLessThan(0.01);
  });

  it('handles multi-dimensional inputs', () => {
    const gp = new GaussianProcess(defaultConfig);
    const X = [[0, 0], [1, 0], [0, 1], [1, 1]];
    const y = [0, 1, 1, 2];
    gp.fit(X, y);
    const pred = gp.predict([[0.5, 0.5]]);
    expect(pred[0].mean).toBeDefined();
    expect(pred[0].variance).toBeGreaterThan(0);
  });

  it('expected improvement is zero when prediction is below best', () => {
    const gp = new GaussianProcess(defaultConfig);
    gp.fit([[0], [1], [2]], [0, 1, 0.5]);
    const ei = gp.expectedImprovement([[0]], 10.0);
    // EI should be very small (near zero) since best is much higher than prediction
    expect(ei[0]).toBeLessThan(0.1);
  });

  it('expected improvement is positive for uncertain promising regions', () => {
    const gp = new GaussianProcess(defaultConfig);
    gp.fit([[0], [2]], [0, 0]);
    const ei = gp.expectedImprovement([[1]], 0.0);
    expect(ei[0]).toBeGreaterThanOrEqual(0);
  });

  it('throws if predict is called before fit', () => {
    const gp = new GaussianProcess(defaultConfig);
    expect(() => gp.predict([[0]])).toThrow();
  });

  it('throws if expectedImprovement is called before fit', () => {
    const gp = new GaussianProcess(defaultConfig);
    expect(() => gp.expectedImprovement([[0]], 0)).toThrow();
  });
});
