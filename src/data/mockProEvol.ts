import type { FitnessPoint } from '../types';

// Pre-computed 20x20 fitness landscape grid for a model enzyme (ADS variant)
// Values 0-1, peak around (12,14) — mimics empirical directed evolution data

function gaussian(x: number, y: number, cx: number, cy: number, sx: number, sy: number, h: number) {
  return h * Math.exp(-((x - cx) ** 2 / (2 * sx ** 2) + (y - cy) ** 2 / (2 * sy ** 2)));
}

export function generateLandscape(): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < 20; y++) {
    const row: number[] = [];
    for (let x = 0; x < 20; x++) {
      // Multi-peak landscape
      const v = (
        gaussian(x, y, 12, 14, 3, 3, 1.0) +
        gaussian(x, y, 4,  6,  2, 2, 0.6) +
        gaussian(x, y, 17, 3,  2, 3, 0.4) +
        (Math.sin(x * 0.8) * Math.cos(y * 0.6) * 0.08)
      );
      row.push(Math.min(1, Math.max(0, v)));
    }
    grid.push(row);
  }
  return grid;
}

export const FITNESS_LANDSCAPE = generateLandscape();

// Seeded Monte Carlo evolution trajectory (50 steps)
export function generateEvolutionTrajectory(
  mutationRate: number,
  rounds: number,
): FitnessPoint[] {
  const trajectory: FitnessPoint[] = [];
  let x = 2, y = 2;
  let fitness = FITNESS_LANDSCAPE[y]?.[x] ?? 0;
  const AMINO_ACIDS = 'ACDEFGHIKLMNPQRSTVWY';

  const initialSeq = 'MSDKIVVVGSGPAGLTAAKYLLEKAGIEVSLIEREFLGGVCHTPYWDSIQLAELFGKMPVIPR';
  let seq = initialSeq;

  trajectory.push({ mutationCount: 0, fitness, sequence: seq.slice(0, 20) + '...' });

  for (let i = 0; i < rounds; i++) {
    const dx = Math.floor(Math.random() * 3 - 1);
    const dy = Math.floor(Math.random() * 3 - 1);
    const nx = Math.max(0, Math.min(19, x + dx));
    const ny = Math.max(0, Math.min(19, y + dy));
    const newFitness = FITNESS_LANDSCAPE[ny]?.[nx] ?? 0;

    // Accept by Metropolis criterion
    if (newFitness >= fitness || Math.random() < Math.exp((newFitness - fitness) / 0.05)) {
      x = nx; y = ny; fitness = newFitness;
      const pos = Math.floor(Math.random() * seq.length);
      seq = seq.slice(0, pos) + AMINO_ACIDS[Math.floor(Math.random() * 20)] + seq.slice(pos + 1);
    }

    if ((i + 1) % Math.max(1, Math.floor(rounds / 20)) === 0) {
      trajectory.push({ mutationCount: i + 1, fitness, sequence: seq.slice(0, 20) + '...' });
    }
  }
  return trajectory;
}

// Starting sequence (truncated ADS enzyme)
export const STARTING_SEQUENCE =
  'MSDKIVVVGSGPAGLTAAKYLLEKAGIEVSLIEREFLGGVCHTPYWDSIQLAELFGKMPVIPRNTPEELEKVLAQHQFPQFLEKYGIKVSEYNHFHPMRHEYGHRPEDLAKRFSDFAIQAGVDPFHASPFAQRLCEQAGVEQIILAQG';
