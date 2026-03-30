import type { DBTLIteration } from '../types';

export const INITIAL_ITERATIONS: DBTLIteration[] = [
  { id: 1, phase: 'Design',  hypothesis: 'Overexpress ADS under strong constitutive promoter (pTet)', result: 12.4, unit: 'mg/L', passed: true,  notes: 'Baseline amorpha-4,11-diene titer' },
  { id: 2, phase: 'Build',   hypothesis: 'Add MVA pathway genes (HMGS, HMGR, MK, PMK, MDC)', result: 41.8, unit: 'mg/L', passed: true,  notes: 'Precursor pool boost confirmed by GC-MS' },
  { id: 3, phase: 'Test',    hypothesis: 'Balance NADPH supply via PntAB transhydrogenase', result: 38.2, unit: 'mg/L', passed: false, notes: 'Slight decrease — cofactor competition' },
  { id: 4, phase: 'Learn',   hypothesis: 'Replace HMGR with truncated variant (tHMGR, residues 529-872)', result: 87.3, unit: 'mg/L', passed: true,  notes: 'tHMGR reduces sterol feedback inhibition' },
  { id: 5, phase: 'Design',  hypothesis: 'Codon-optimize ADS for E. coli expression', result: 94.1, unit: 'mg/L', passed: true,  notes: 'Translation rate improved 1.8x' },
  { id: 6, phase: 'Build',   hypothesis: 'Engineer CYPB71AV1 + cytochrome P450 reductase for oxidation', result: 22.6, unit: 'mg/L AA', passed: true,  notes: 'Artemisinic acid accumulation detected' },
  { id: 7, phase: 'Test',    hypothesis: 'Add exogenous mevalonate feed (10 mM) during production phase', result: 108.5, unit: 'mg/L', passed: true, notes: 'Highest titer to date — bottleneck upstream' },
  { id: 8, phase: 'Learn',   hypothesis: 'Dynamic control of ERG9 via anaerobically-inducible promoter', result: 142.0, unit: 'mg/L', passed: true, notes: 'Squalene diversion minimized, +31% yield' },
];

export function appendIteration(
  iterations: DBTLIteration[],
  hypothesis: string,
  result: number,
  unit: string,
  passed: boolean,
  notes?: string,
): DBTLIteration[] {
  const phases: DBTLIteration['phase'][] = ['Design', 'Build', 'Test', 'Learn'];
  const nextPhase = phases[(iterations.length) % 4];
  return [...iterations, {
    id: iterations.length + 1,
    phase: nextPhase,
    hypothesis,
    result,
    unit,
    passed,
    notes,
  }];
}
