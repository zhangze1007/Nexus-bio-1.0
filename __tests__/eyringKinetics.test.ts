/**
 * Eyring Kinetics Tests
 *
 * Tests for Eyring equation, Michaelis-Menten kinetics,
 * and enzyme activity corrections.
 */

import {
  eyringRateConstant,
  michaelisMentenRate,
  kcatToVmax,
  catalyticEfficiency,
  inverseEyring,
  arrheniusCorrection,
  phCorrection,
  temperatureCorrection,
  calculateEnzymeKinetics,
  estimateActivationEnergy,
} from '../src/utils/eyringKinetics';

describe('Eyring Kinetics', () => {

  // ── Eyring Rate Constant ─────────────────────────────────────────────

  describe('eyringRateConstant', () => {
    it('returns positive rate constant', () => {
      const k = eyringRateConstant(50, 298.15); // 50 kJ/mol at 25°C
      expect(k).toBeGreaterThan(0);
    });

    it('rate increases with temperature', () => {
      const k25 = eyringRateConstant(50, 298.15);
      const k37 = eyringRateConstant(50, 310.15);
      expect(k37).toBeGreaterThan(k25);
    });

    it('rate decreases with higher activation energy', () => {
      const k50 = eyringRateConstant(50, 298.15);
      const k100 = eyringRateConstant(100, 298.15);
      expect(k50).toBeGreaterThan(k100);
    });

    it('returns reasonable values for typical enzymes', () => {
      // Typical enzyme: ΔG‡ ≈ 50-100 kJ/mol, kcat ≈ 1-1000 1/s
      const k = eyringRateConstant(75, 298.15);
      expect(k).toBeGreaterThan(0.01);
      expect(k).toBeLessThan(1e6);
    });
  });

  // ── Michaelis-Menten Rate ────────────────────────────────────────────

  describe('michaelisMentenRate', () => {
    it('returns Vmax * S / (Km + S)', () => {
      const rate = michaelisMentenRate(100, 1e-6, 1, 1);
      // v = (100 * 1e-6 * 1000 * 1) / (1 + 1) = 0.05 mM/s (enzymeConc converted M→mM)
      expect(rate).toBeCloseTo(0.05, 8);
    });

    it('returns approximately Vmax when S >> Km', () => {
      const kcat = 100;
      const enzymeConc = 1e-6;
      const rate = michaelisMentenRate(kcat, enzymeConc, 1000, 0.1);
      // enzymeConc is converted M→mM, so Vmax = kcat * enzymeConc * 1000
      const vmaxMm = kcat * enzymeConc * 1000;
      // S/(Km+S) = 1000/1000.1 ≈ 0.9999, so rate ≈ 0.9999 * Vmax
      expect(rate).toBeGreaterThan(vmaxMm * 0.99);
      expect(rate).toBeLessThan(vmaxMm * 1.01);
    });

    it('returns 0 when S = 0', () => {
      expect(michaelisMentenRate(100, 1e-6, 0, 1)).toBe(0);
    });

    it('returns 0 when Km + S = 0', () => {
      expect(michaelisMentenRate(100, 1e-6, 0, 0)).toBe(0);
    });
  });

  // ── Vmax Conversion ─────────────────────────────────────────────────

  describe('kcatToVmax', () => {
    it('Vmax = kcat * [E]', () => {
      const vmax = kcatToVmax(100, 1e-6);
      expect(vmax).toBeCloseTo(1e-4, 10);
    });
  });

  // ── Catalytic Efficiency ─────────────────────────────────────────────

  describe('catalyticEfficiency', () => {
    it('kcat/Km for diffusion-limited enzyme', () => {
      // Diffusion limit: ~10^8 1/(M·s) = 10^5 1/(mM·s)
      const eff = catalyticEfficiency(1e6, 0.01); // kcat=1e6, Km=0.01 mM
      expect(eff).toBeCloseTo(1e8, 0);
    });

    it('returns Infinity when Km = 0', () => {
      expect(catalyticEfficiency(100, 0)).toBe(Infinity);
    });
  });

  // ── Inverse Eyring ──────────────────────────────────────────────────

  describe('inverseEyring', () => {
    it('recovers activation energy from rate constant', () => {
      const deltaG = 75; // kJ/mol
      const T = 298.15;
      const k = eyringRateConstant(deltaG, T);
      const recovered = inverseEyring(k, T);
      expect(recovered).toBeCloseTo(deltaG, 1);
    });
  });

  // ── Arrhenius Correction ────────────────────────────────────────────

  describe('arrheniusCorrection', () => {
    it('rate increases with temperature for positive Ea', () => {
      const k1 = arrheniusCorrection(100, 298.15, 310.15, 50);
      expect(k1).toBeGreaterThan(100);
    });

    it('rate at same temperature is unchanged', () => {
      const k = arrheniusCorrection(100, 298.15, 298.15, 50);
      expect(k).toBeCloseTo(100, 5);
    });
  });

  // ── pH Correction ───────────────────────────────────────────────────

  describe('phCorrection', () => {
    it('returns maximum at pH optimum', () => {
      const activity = phCorrection(100, 7.0, 7.0);
      expect(activity).toBeCloseTo(100, 5);
    });

    it('decreases away from optimum', () => {
      const activity = phCorrection(100, 5.0, 7.0);
      expect(activity).toBeLessThan(100);
    });

    it('is symmetric around optimum', () => {
      const low = phCorrection(100, 5.0, 7.0);
      const high = phCorrection(100, 9.0, 7.0);
      expect(low).toBeCloseTo(high, 5);
    });
  });

  // ── Temperature Correction ──────────────────────────────────────────

  describe('temperatureCorrection', () => {
    it('returns maximum at T optimum', () => {
      const activity = temperatureCorrection(100, 310.15, 310.15);
      expect(activity).toBeCloseTo(100, 0);
    });

    it('decreases at high temperature (denaturation)', () => {
      const activity = temperatureCorrection(100, 350, 310.15);
      expect(activity).toBeLessThan(100);
    });
  });

  // ── Complete Kinetics Calculation ───────────────────────────────────

  describe('calculateEnzymeKinetics', () => {
    it('calculates rate with default parameters', () => {
      const result = calculateEnzymeKinetics({
        enzymeConc: 1e-6,
        substrate: 1,
      });
      expect(result.rate).toBeGreaterThan(0);
      expect(result.vmax).toBeGreaterThan(0);
    });

    it('applies competitive inhibition', () => {
      const noInhib = calculateEnzymeKinetics({
        kcat: 100,
        km: 1,
        enzymeConc: 1e-6,
        substrate: 1,
      });

      const withInhib = calculateEnzymeKinetics({
        kcat: 100,
        km: 1,
        ki: 0.5,
        enzymeConc: 1e-6,
        substrate: 1,
        inhibitor: 1,
      });

      expect(withInhib.rate).toBeLessThan(noInhib.rate);
      expect(withInhib.inhibition).toBeGreaterThan(0);
    });

    it('uses BRENDA data when available', () => {
      const result = calculateEnzymeKinetics({
        kcat: 100,  // From BRENDA
        km: 0.1,    // From BRENDA
        enzymeConc: 1e-6,
        substrate: 0.5,
      });

      expect(result.source).toBe('BRENDA');
      expect(result.rate).toBeGreaterThan(0);
    });
  });

  // ── Activation Energy Estimation ────────────────────────────────────

  describe('estimateActivationEnergy', () => {
    it('estimates ΔG‡ from kcat', () => {
      const deltaG = estimateActivationEnergy(100, 298.15);
      expect(deltaG).toBeGreaterThan(0);
      expect(deltaG).toBeLessThan(200); // Reasonable range for enzymes
    });

    it('higher kcat gives lower ΔG‡', () => {
      const low = estimateActivationEnergy(10, 298.15);
      const high = estimateActivationEnergy(1000, 298.15);
      expect(high).toBeLessThan(low);
    });
  });
});
