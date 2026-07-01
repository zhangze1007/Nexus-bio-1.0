import { bystanderActivityWeight, designBaseEdit } from '../src/server/crisprEditingEngine';

/**
 * T1-1 anti-decoy: bystander editing efficiency must be a deterministic,
 * position-ordered function of the base's position in the editing window —
 * NOT a random fraction of the on-target rate.
 */
describe('base-editor bystander activity', () => {
  it('is position-ordered: eff(pos=5) > eff(pos=1) for ABE8e', () => {
    expect(bystanderActivityWeight('ABE8e', 5)).toBeGreaterThan(bystanderActivityWeight('ABE8e', 1));
  });

  it('is deterministic across calls', () => {
    expect(bystanderActivityWeight('ABE8e', 6)).toBe(bystanderActivityWeight('ABE8e', 6));
  });

  it('peaks in the window and decays toward the edges', () => {
    const center = bystanderActivityWeight('ABE8e', 5);
    const edge = bystanderActivityWeight('ABE8e', 8);
    expect(center).toBeGreaterThan(edge);
  });

  it('produces reproducible bystander efficiencies from designBaseEdit', () => {
    // A window full of adenines so multiple bystanders exist at different positions.
    const seq = 'A'.repeat(60);
    const d1 = designBaseEdit(seq, 25, 'ABE8e');
    const d2 = designBaseEdit(seq, 25, 'ABE8e');
    expect(d1.bystanderEdits).toEqual(d2.bystanderEdits); // deterministic, no Math.random
    // If more than one bystander, their efficiencies must not all be identical
    // (they sit at different window positions).
    if (d1.bystanderEdits.length >= 2) {
      const effs = d1.bystanderEdits.map((b) => b.efficiency);
      expect(new Set(effs).size).toBeGreaterThan(1);
    }
  });
});
