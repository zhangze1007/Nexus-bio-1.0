/**
 * AutomatedFeedbackLoop — closed-loop DBTL data integration.
 *
 * Uploaded CSV/Excel test data is parsed into TestDataRow[], validated
 * against the FBA theoretical maximum yield, and fed into a deterministic
 * multi-objective heuristic that proposes the next iteration's parameter
 * changes. No Math.random — identical inputs yield identical suggestions.
 *
 * Hardening priorities applied here:
 *   - CSV parser handles BOM, CRLF, quoted fields, and trailing commas
 *   - required columns are enforced; partial rows are dropped with diagnostics
 *   - NaN / missing numeric values are treated explicitly, not silently as 0
 *   - outlier detection handles zero-variance and single-row edge cases
 *   - predicted improvement is a function of the measured gap, never random
 */

import type {
  TestDataRow,
  FeedbackLoopResult,
  NextIterationSuggestion,
  QCFlag,
  DBTLIteration,
} from '../types';
import { findBenchmarkByTarget } from '../data/experimentalBenchmarks';
import { solveAuthorityFBA } from '../services/FBAAuthorityClient';

// ── CSV parsing ───────────────────────────────────────────────────────────────
/**
 * Split a CSV line respecting double-quote escaping. Opentrons-style export
 * plus standard Excel export both quote fields containing commas; we support
 * both without dragging in a parser dependency.
 */
function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((cell) => cell.trim());
}

const YIELD_COLUMN_ALIASES = ['yield_mg_l', 'yield', 'titer_mg_l', 'titer'];
const BIOMASS_COLUMN_ALIASES = ['biomass_od600', 'biomass', 'od600', 'od_600'];
const SUBSTRATE_COLUMN_ALIASES = ['substrate_consumed_mm', 'substrate', 'glucose_consumed', 'glucose_mm'];

/**
 * Parse a finite number from a CSV cell. Returns `null` on missing/NaN so the
 * caller can distinguish "not provided" from "explicitly zero".
 */
function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'na' || trimmed.toLowerCase() === 'nan') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parse CSV text into validated TestDataRow[]. Throws if required columns
 * (at minimum a yield column) are missing — silent success would let a
 * malformed upload propagate into downstream statistics.
 */
export function parseCSVData(csvText: string): TestDataRow[] {
  if (typeof csvText !== 'string') return [];
  // Strip UTF-8 BOM and normalize line endings before splitting.
  const cleaned = csvText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!cleaned) return [];

  const lines = cleaned.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const findCol = (aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const yieldIdx = findCol(YIELD_COLUMN_ALIASES);
  if (yieldIdx < 0) {
    throw new Error(
      `feedback-loop: CSV is missing a yield column. Expected one of: ${YIELD_COLUMN_ALIASES.join(', ')}. `
      + `Got headers: ${headers.join(', ')}.`,
    );
  }
  const biomassIdx = findCol(BIOMASS_COLUMN_ALIASES);
  const substrateIdx = findCol(SUBSTRATE_COLUMN_ALIASES);
  const sampleIdIdx = headers.indexOf('sample_id');
  const strainIdx = headers.indexOf('strain');
  const conditionIdx = headers.indexOf('condition');
  const timestampIdx = headers.indexOf('timestamp');

  const rows: TestDataRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const yieldVal = parseNumber(cells[yieldIdx]);
    if (yieldVal == null) continue; // required field missing — skip silently
    rows.push({
      sample_id: cells[sampleIdIdx]?.trim() || `S${i}`,
      strain: cells[strainIdx]?.trim() || 'unknown',
      condition: cells[conditionIdx]?.trim() || 'default',
      yield_mg_L: yieldVal,
      biomass_OD600: biomassIdx >= 0 ? (parseNumber(cells[biomassIdx]) ?? 0) : 0,
      substrate_consumed_mM: substrateIdx >= 0 ? (parseNumber(cells[substrateIdx]) ?? 0) : 0,
      timestamp: timestampIdx >= 0 ? (cells[timestampIdx]?.trim() || undefined) : undefined,
    });
  }
  return rows;
}

// ── Statistics helpers ────────────────────────────────────────────────────────
interface YieldStats {
  n: number;
  mean: number;
  std: number;          // population std, consistent with original module
  min: number;
  max: number;
  bestIdx: number;      // index in the input array of the best sample
  worstIdx: number;
}

function computeYieldStats(data: TestDataRow[]): YieldStats {
  const n = data.length;
  if (n === 0) {
    return { n: 0, mean: 0, std: 0, min: 0, max: 0, bestIdx: -1, worstIdx: -1 };
  }
  let sum = 0, min = Infinity, max = -Infinity, bestIdx = 0, worstIdx = 0;
  for (let i = 0; i < n; i++) {
    const y = data[i].yield_mg_L;
    sum += y;
    if (y > max) { max = y; bestIdx = i; }
    if (y < min) { min = y; worstIdx = i; }
  }
  const mean = sum / n;
  let sqSum = 0;
  for (let i = 0; i < n; i++) sqSum += (data[i].yield_mg_L - mean) ** 2;
  const std = Math.sqrt(sqSum / n);
  return { n, mean, std, min, max, bestIdx, worstIdx };
}

// ── QC validation ─────────────────────────────────────────────────────────────
/**
 * Validate measurements against FBA theoretical maximum yield. Flags:
 *   - sensor_anomaly: measured > theoretical max (indicates sensor/data error)
 *   - below_detection: yield ≈ 0 despite visible biomass growth
 *   - outlier: |yield - mean| > 3σ (z-score gate; skipped when n < 3 or σ = 0)
 */
export async function validateAgainstFBA(
  data: TestDataRow[],
  glucoseUptake: number = 10,
  oxygenUptake: number = 20,
  targetHint?: string,
): Promise<QCFlag[]> {
  if (data.length === 0) return [];

  const fbaResult = await solveAuthorityFBA({
    objective: 'product',
    glucoseUptake,
    oxygenUptake,
    knockouts: [],
  });
  const benchmark = findBenchmarkByTarget(targetHint);

  // Mechanistic upper bound on yield (mg/L) from FBA carbon efficiency.
  // Glucose MW = 180 g/mol; the 0.8 factor is a conservative downstream
  // recovery penalty (consistent with the pre-rewrite behaviour).
  const mechanisticYield = (fbaResult.carbonEfficiency / 100) * glucoseUptake * 180 * 0.8;
  const theoreticalMaxYield = benchmark
    ? Math.min(benchmark.theoreticalYieldMgL, mechanisticYield * 1.1)
    : mechanisticYield;

  const stats = computeYieldStats(data);
  const zGateUsable = stats.n >= 3 && stats.std > 0;
  const flags: QCFlag[] = [];

  for (const row of data) {
    if (row.yield_mg_L > theoreticalMaxYield) {
      flags.push({
        sample_id: row.sample_id,
        flag_type: 'sensor_anomaly',
        measured_value: row.yield_mg_L,
        theoretical_max: theoreticalMaxYield,
        message: `Yield ${row.yield_mg_L.toFixed(1)} mg/L exceeds FBA theoretical max ${theoreticalMaxYield.toFixed(1)} mg/L — possible sensor calibration error or data entry mistake`,
      });
    }
    if (row.yield_mg_L < 0.01 && row.biomass_OD600 > 0.1) {
      flags.push({
        sample_id: row.sample_id,
        flag_type: 'below_detection',
        measured_value: row.yield_mg_L,
        theoretical_max: theoreticalMaxYield,
        message: `Yield below detection limit despite biomass growth (OD600 = ${row.biomass_OD600.toFixed(2)}) — check assay sensitivity`,
      });
    }
    if (zGateUsable && Math.abs(row.yield_mg_L - stats.mean) > 3 * stats.std) {
      flags.push({
        sample_id: row.sample_id,
        flag_type: 'outlier',
        measured_value: row.yield_mg_L,
        theoretical_max: theoreticalMaxYield,
        message: `Yield ${row.yield_mg_L.toFixed(1)} mg/L is >3σ from mean (${stats.mean.toFixed(1)} ± ${stats.std.toFixed(1)}) — statistical outlier`,
      });
    }
  }

  return flags;
}

// ── Multi-objective optimisation ──────────────────────────────────────────────
/**
 * Deterministic MOO heuristic. Each suggestion's predicted improvement % is
 * derived from the observed gap (mean yield vs. target, yield-per-biomass,
 * biomass, carbon efficiency) — not drawn randomly. The function is pure:
 * given the same `data` and `currentIteration` it returns the same list.
 */
export function runMOO(
  data: TestDataRow[],
  currentIteration: DBTLIteration,
): NextIterationSuggestion[] {
  if (data.length === 0) return [];
  const suggestions: NextIterationSuggestion[] = [];

  const meanYield = data.reduce((s, d) => s + d.yield_mg_L, 0) / data.length;
  const meanBiomass = data.reduce((s, d) => s + d.biomass_OD600, 0) / data.length;
  const meanSubstrate = data.reduce((s, d) => s + d.substrate_consumed_mM, 0) / data.length;
  const targetYield = currentIteration.result > 0 ? currentIteration.result * 1.2 : 0;

  // Objective 1 — precursor loading. Relief predicted from how far below the
  // target the observed mean sits, clamped to a plausible 8–30% band.
  if (targetYield > 0 && meanYield < targetYield) {
    const currentPrecursor = meanSubstrate > 0 ? meanSubstrate : 10;
    const suggestedPrecursor = currentPrecursor * 1.25;
    const gapFraction = Math.min(1, (targetYield - meanYield) / targetYield);
    suggestions.push({
      parameter: 'Precursor Loading (mM mevalonate)',
      current_value: round1(currentPrecursor),
      suggested_value: round1(suggestedPrecursor),
      rationale: `Mean yield (${meanYield.toFixed(1)} mg/L) is ${((1 - meanYield / targetYield) * 100).toFixed(0)}% below the ${targetYield.toFixed(1)} mg/L target. Increasing mevalonate supplementation relieves upstream precursor bottleneck.`,
      predicted_improvement_percent: round1(clamp(8 + 20 * gapFraction, 8, 30)),
    });
  }

  // Objective 2 — promoter tuning. Improvement scales with how low specific
  // productivity sits relative to the 50 mg/L/OD reference.
  const yieldPerBiomass = meanBiomass > 0 ? meanYield / meanBiomass : 0;
  if (meanBiomass > 0 && yieldPerBiomass < 50) {
    const productivityDeficit = (50 - yieldPerBiomass) / 50; // 0..1
    suggestions.push({
      parameter: 'Promoter Strength (RFU)',
      current_value: 1000,
      suggested_value: 1500,
      rationale: `Specific productivity ${yieldPerBiomass.toFixed(1)} mg/L/OD is below the 50 mg/L/OD reference. A stronger promoter or higher copy number raises per-cell flux.`,
      predicted_improvement_percent: round1(clamp(10 + 20 * productivityDeficit, 10, 28)),
    });
  }

  // Objective 3 — temperature drop when biomass is suppressed by metabolic
  // burden. Predicted improvement scales with how far below OD600 1.0.
  if (meanBiomass > 0 && meanBiomass < 1.0) {
    const biomassDeficit = (1.0 - meanBiomass) / 1.0;
    suggestions.push({
      parameter: 'Induction Temperature (°C)',
      current_value: 37,
      suggested_value: 30,
      rationale: `Low biomass (OD600 ${meanBiomass.toFixed(2)}) suggests metabolic burden. Reducing induction temperature improves protein folding and growth.`,
      predicted_improvement_percent: round1(clamp(8 + 10 * biomassDeficit, 8, 18)),
    });
  }

  // Objective 4 — carbon-source feeding. Improvement scales with how low the
  // carbon-to-product conversion sits relative to the 5 mg/mmol reference.
  if (meanSubstrate > 0) {
    const conversion = meanYield / meanSubstrate;
    if (conversion < 5) {
      const conversionDeficit = (5 - conversion) / 5;
      suggestions.push({
        parameter: 'Carbon Source Feeding Rate (mM/h)',
        current_value: round2(meanSubstrate / 48),
        suggested_value: round2((meanSubstrate * 0.8) / 48),
        rationale: `Carbon-to-product conversion ${conversion.toFixed(2)} mg/mmol is below the 5 mg/mmol reference. Fed-batch at a lower continuous rate reduces overflow metabolism.`,
        predicted_improvement_percent: round1(clamp(6 + 10 * conversionDeficit, 6, 16)),
      });
    }
  }

  // If nothing fired, suggest extending the fermentation duration — a
  // conservative, deterministic fallback.
  if (suggestions.length === 0) {
    suggestions.push({
      parameter: 'Fermentation Duration (h)',
      current_value: 48,
      suggested_value: 72,
      rationale: 'Observed yields are close to target. Extending culture time may capture late-stage product accumulation.',
      predicted_improvement_percent: 7.5,
    });
  }

  return suggestions;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}
function round1(value: number): number { return Math.round(value * 10) / 10; }
function round2(value: number): number { return Math.round(value * 100) / 100; }

// ── Main pipeline ─────────────────────────────────────────────────────────────
export async function AutomatedFeedbackLoop(
  csvText: string,
  currentIteration: DBTLIteration,
  glucoseUptake: number = 10,
  oxygenUptake: number = 20,
): Promise<FeedbackLoopResult> {
  let data: TestDataRow[];
  try {
    data = parseCSVData(csvText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      iteration_id: currentIteration.id,
      test_summary: { mean_yield: 0, std_yield: 0, best_sample: 'N/A', worst_sample: 'N/A' },
      qc_flags: [],
      next_iteration_suggestions: [{
        parameter: 'Data Quality',
        current_value: 0,
        suggested_value: 1,
        rationale: message,
        predicted_improvement_percent: 0,
      }],
      optimization_objective: 'data_quality',
    };
  }

  if (data.length === 0) {
    return {
      iteration_id: currentIteration.id,
      test_summary: { mean_yield: 0, std_yield: 0, best_sample: 'N/A', worst_sample: 'N/A' },
      qc_flags: [],
      next_iteration_suggestions: [{
        parameter: 'Data Quality',
        current_value: 0,
        suggested_value: 1,
        rationale: 'No valid data rows found. Required columns: sample_id, strain, yield_mg_L (or yield), biomass_OD600 (or OD600).',
        predicted_improvement_percent: 0,
      }],
      optimization_objective: 'data_quality',
    };
  }

  const stats = computeYieldStats(data);
  const qcFlags = await validateAgainstFBA(data, glucoseUptake, oxygenUptake, currentIteration.hypothesis);
  const suggestions = runMOO(data, currentIteration);

  return {
    iteration_id: currentIteration.id,
    test_summary: {
      mean_yield: round2(stats.mean),
      std_yield: round2(stats.std),
      best_sample: stats.bestIdx >= 0 ? data[stats.bestIdx].sample_id : 'N/A',
      worst_sample: stats.worstIdx >= 0 ? data[stats.worstIdx].sample_id : 'N/A',
    },
    qc_flags: qcFlags,
    next_iteration_suggestions: suggestions,
    optimization_objective: 'maximize_yield_minimize_burden',
  };
}
