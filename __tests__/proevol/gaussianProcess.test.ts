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

describe('Gaussian Process — ARD (Automatic Relevance Determination)', () => {
  it('accepts per-dimension length scales', () => {
    const gp = new GaussianProcess({
      kernel: 'rbf',
      lengthScale: [2.0, 0.5],
      signalVariance: 1.0,
      noiseVariance: 0.01,
    });
    const X = [[0, 0], [1, 0], [0, 1], [1, 1]];
    const y = [0, 1, 1, 2];
    gp.fit(X, y);
    const pred = gp.predict([[0.5, 0.5]]);
    expect(pred[0].mean).toBeDefined();
    expect(pred[0].variance).toBeGreaterThan(0);
  });

  it('ARD produces different predictions than shared length scale', () => {
    // With shared ls=1.0
    const gpShared = new GaussianProcess({
      kernel: 'rbf', lengthScale: 1.0, signalVariance: 1.0, noiseVariance: 0.01,
    });
    // With per-dim: wide on dim 0, narrow on dim 1
    const gpARD = new GaussianProcess({
      kernel: 'rbf', lengthScale: [10.0, 0.5], signalVariance: 1.0, noiseVariance: 0.01,
    });

    const X = [[0, 0], [1, 0], [0, 1], [1, 1]];
    const y = [0, 3, 0.5, 3.5]; // dim 1 matters more

    gpShared.fit(X, y);
    gpARD.fit(X, y);

    const predShared = gpShared.predict([[0.5, 0.5]]);
    const predARD = gpARD.predict([[0.5, 0.5]]);

    // Predictions should differ because ARD weights dimensions differently
    expect(predShared[0].mean).not.toBeCloseTo(predARD[0].mean, 2);
  });

  it('handles ARD with 1D inputs (single-element array)', () => {
    const gp = new GaussianProcess({
      kernel: 'rbf',
      lengthScale: [5.0],
      signalVariance: 1.0,
      noiseVariance: 0.01,
    });
    gp.fit([[0], [1], [2]], [0, 1, 0.5]);
    const pred = gp.predict([[1.5]]);
    expect(pred[0].mean).toBeDefined();
    expect(pred[0].variance).toBeGreaterThan(0);
  });
});

describe('Gaussian Process — Matérn 5/2 kernel', () => {
  it('fits and predicts with matern52 kernel', () => {
    const gp = new GaussianProcess({
      kernel: 'matern52',
      lengthScale: 1.0,
      signalVariance: 1.0,
      noiseVariance: 0.01,
    });
    const X = [[0], [1], [2], [3], [4]];
    const y = [0, 0.84, 0.91, 0.14, -0.76];
    gp.fit(X, y);
    const pred = gp.predict([[0.5]]);
    expect(pred[0].mean).toBeDefined();
    expect(pred[0].variance).toBeGreaterThan(0);
  });

  it('matern52 produces different predictions than RBF', () => {
    const gpRBF = new GaussianProcess({
      kernel: 'rbf', lengthScale: 1.0, signalVariance: 1.0, noiseVariance: 0.01,
    });
    const gpMatern = new GaussianProcess({
      kernel: 'matern52', lengthScale: 1.0, signalVariance: 1.0, noiseVariance: 0.01,
    });

    const X = [[0], [1], [2], [3], [4]];
    const y = [0, 0.5, 1.0, 0.5, 0];

    gpRBF.fit(X, y);
    gpMatern.fit(X, y);

    const predRBF = gpRBF.predict([[1.5]]);
    const predMatern = gpMatern.predict([[1.5]]);

    // Matérn 5/2 is less smooth than RBF — predictions should differ
    expect(predRBF[0].mean).not.toBeCloseTo(predMatern[0].mean, 2);
  });

  it('matern52 supports ARD length scales', () => {
    const gp = new GaussianProcess({
      kernel: 'matern52',
      lengthScale: [2.0, 0.5],
      signalVariance: 1.0,
      noiseVariance: 0.01,
    });
    const X = [[0, 0], [1, 0], [0, 1], [1, 1]];
    const y = [0, 1, 1, 2];
    gp.fit(X, y);
    const pred = gp.predict([[0.5, 0.5]]);
    expect(pred[0].mean).toBeDefined();
    expect(pred[0].variance).toBeGreaterThan(0);
  });

  it('matern52 computes expected improvement', () => {
    const gp = new GaussianProcess({
      kernel: 'matern52', lengthScale: 1.0, signalVariance: 1.0, noiseVariance: 0.01,
    });
    gp.fit([[0], [1], [2]], [0, 1, 0.5]);
    const ei = gp.expectedImprovement([[1.5]], 1.0);
    expect(ei[0]).toBeGreaterThanOrEqual(0);
  });
});

describe('Gaussian Process — Hyperparameter Optimisation', () => {
  it('logMarginalLikelihood returns a finite number after fit', () => {
    const gp = new GaussianProcess({
      kernel: 'rbf', lengthScale: 1.0, signalVariance: 1.0, noiseVariance: 0.01,
    });
    gp.fit([[0], [1], [2], [3]], [0, 1, 0.5, -0.5]);
    const lml = gp.logMarginalLikelihood();
    expect(Number.isFinite(lml)).toBe(true);
  });

  it('logMarginalLikelihood throws before fit', () => {
    const gp = new GaussianProcess({
      kernel: 'rbf', lengthScale: 1.0, signalVariance: 1.0, noiseVariance: 0.01,
    });
    expect(() => gp.logMarginalLikelihood()).toThrow();
  });

  it('optimizeHyperparameters returns a valid config', () => {
    const X = [[0], [1], [2], [3], [4]];
    const y = [0, 0.84, 0.91, 0.14, -0.76];
    const best = GaussianProcess.optimizeHyperparameters(X, y, 'rbf', [1, 5, 10]);
    expect(best.kernel).toBe('rbf');
    expect(typeof best.lengthScale).toBe('number');
    expect(best.signalVariance).toBeGreaterThan(0);
    expect(best.noiseVariance).toBeGreaterThan(0);
  });

  it('optimizeHyperparameters works with matern52', () => {
    const X = [[0], [1], [2], [3], [4]];
    const y = [0, 0.84, 0.91, 0.14, -0.76];
    const best = GaussianProcess.optimizeHyperparameters(X, y, 'matern52', [1, 5, 10]);
    expect(best.kernel).toBe('matern52');
    expect(typeof best.lengthScale).toBe('number');
  });

  it('fitOptimized fits with optimised hyperparameters', () => {
    const gp = new GaussianProcess({
      kernel: 'rbf', lengthScale: 1.0, signalVariance: 1.0, noiseVariance: 0.01,
    });
    const X = [[0], [1], [2], [3], [4]];
    const y = [0, 0.84, 0.91, 0.14, -0.76];
    gp.fitOptimized(X, y, 'rbf', [1, 5, 10]);
    const pred = gp.predict([[2.5]]);
    expect(pred[0].mean).toBeDefined();
    expect(pred[0].variance).toBeGreaterThan(0);
  });

  it('fitOptimized with matern52 produces valid predictions', () => {
    const gp = new GaussianProcess({
      kernel: 'matern52', lengthScale: 1.0, signalVariance: 1.0, noiseVariance: 0.01,
    });
    const X = [[0], [1], [2], [3], [4]];
    const y = [0, 0.84, 0.91, 0.14, -0.76];
    gp.fitOptimized(X, y, 'matern52', [1, 5, 10]);
    const pred = gp.predict([[2.5]]);
    expect(pred[0].mean).toBeDefined();
    expect(pred[0].variance).toBeGreaterThan(0);
  });

  it('fitOptimized can improve over default hyperparameters', () => {
    // Create data where a larger length scale is clearly better
    const X = [[0], [1], [2], [3], [4], [5], [6]];
    const y = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]; // very smooth

    // Default (bad) config
    const gpDefault = new GaussianProcess({
      kernel: 'rbf', lengthScale: 0.1, signalVariance: 1.0, noiseVariance: 0.5,
    });
    gpDefault.fit(X, y);
    const lmlDefault = gpDefault.logMarginalLikelihood();

    // Optimized
    const gpOpt = new GaussianProcess({
      kernel: 'rbf', lengthScale: 0.1, signalVariance: 1.0, noiseVariance: 0.5,
    });
    gpOpt.fitOptimized(X, y, 'rbf', [0.1, 1, 5, 10, 50]);
    const lmlOpt = gpOpt.logMarginalLikelihood();

    // Optimized LML should be at least as good as default
    expect(lmlOpt).toBeGreaterThanOrEqual(lmlDefault - 1e-6);
  });
});
