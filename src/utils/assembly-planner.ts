/**
 * Gibson Assembly Planner — automated DNA assembly design with primer Tm
 * matching using the SantaLucia '98 unified nearest-neighbor model.
 *
 * Biological constraints:
 * - Fragments must be < 1000 bp for reliable Gibson Assembly
 * - Overlaps 20–40 bp with matched Tm (ΔTm < 5°C across all primers)
 * - Primer binding regions 18–25 bp with Tm 55–72°C
 * - Secondary structure check: no self-complementary runs ≥ 6 bp
 * - Mispriming check: no binding region matching elsewhere in target
 *
 * Reference:
 * - SantaLucia J Jr. (1998) PNAS 95:1460–1465 (unified NN parameters)
 * - Gibson et al. (2009) Nature Methods 6:343–345
 */

import type {
  GibsonFragment,
  GibsonPrimer,
  GibsonAssemblyPlan,
  ProvenanceRecord,
} from '../types';
import { generateUUID } from './sbol-serializer';

// ── SantaLucia '98 Nearest-Neighbor Parameters ───────────────────────────────
// ΔH in cal/mol, ΔS in cal/(mol·K) for DNA/DNA duplexes in 1M NaCl
const NN_PARAMS: Record<string, { dH: number; dS: number }> = {
  'AA': { dH: -7900, dS: -22.2 },
  'AT': { dH: -7200, dS: -20.4 },
  'AC': { dH: -8400, dS: -22.4 },
  'AG': { dH: -7800, dS: -21.0 },
  'TA': { dH: -7200, dS: -21.3 },
  'TT': { dH: -7900, dS: -22.2 },
  'TC': { dH: -8200, dS: -22.2 },
  'TG': { dH: -8500, dS: -22.7 },
  'CA': { dH: -8500, dS: -22.7 },
  'CT': { dH: -7800, dS: -21.0 },
  'CC': { dH: -8000, dS: -19.9 },
  'CG': { dH: -10600, dS: -27.2 },
  'GA': { dH: -8200, dS: -22.2 },
  'GT': { dH: -8400, dS: -22.4 },
  'GC': { dH: -9800, dS: -24.4 },
  'GG': { dH: -8000, dS: -19.9 },
};

// Initiation parameters
const INIT_PARAMS = {
  // Terminal AT penalty
  AT: { dH: 2300, dS: 4.1 },
  // Terminal GC (no penalty)
  GC: { dH: 0, dS: 0 },
};

/**
 * Calculate melting temperature using SantaLucia '98 nearest-neighbor model.
 *
 * Tm = ΔH / (ΔS + R·ln(Ct/4)) - 273.15
 *
 * Where:
 * - ΔH, ΔS = sum of nearest-neighbor enthalpy/entropy
 * - R = 1.987 cal/(mol·K) (gas constant)
 * - Ct = total strand concentration (default 250 nM for PCR)
 * - Salt correction: ΔS += 0.368·(N-1)·ln([Na+])
 *
 * @param sequence - DNA sequence (5'→3')
 * @param naConc - Na+ concentration in M (default 0.05 for standard PCR)
 * @param primerConc - Total primer concentration in M (default 250e-9)
 */
export function calculateTm(
  sequence: string,
  naConc: number = 0.05,
  primerConc: number = 250e-9,
): number {
  const seq = sequence.toUpperCase().replace(/[^ATCG]/g, '');
  if (seq.length < 2) return 0;

  const R = 1.987; // cal/(mol·K)
  let dH = 0;
  let dS = 0;

  // Sum nearest-neighbor parameters
  for (let i = 0; i < seq.length - 1; i++) {
    const dinuc = seq[i] + seq[i + 1];
    const params = NN_PARAMS[dinuc];
    if (params) {
      dH += params.dH;
      dS += params.dS;
    }
  }

  // Initiation corrections
  const first = seq[0];
  const last = seq[seq.length - 1];
  if (first === 'A' || first === 'T') { dH += INIT_PARAMS.AT.dH; dS += INIT_PARAMS.AT.dS; }
  if (last === 'A' || last === 'T') { dH += INIT_PARAMS.AT.dH; dS += INIT_PARAMS.AT.dS; }

  // Salt correction (SantaLucia '98)
  dS += 0.368 * (seq.length - 1) * Math.log(naConc);

  // Tm calculation (self-complementary correction not applied — primers are non-self-complementary)
  const tm = dH / (dS + R * Math.log(primerConc / 4)) - 273.15;

  return Math.round(tm * 10) / 10;
}

/**
 * Calculate GC content of a sequence.
 */
function gcContent(seq: string): number {
  const s = seq.toUpperCase();
  const gc = (s.split('').filter(c => c === 'G' || c === 'C').length) / s.length;
  return Math.round(gc * 1000) / 1000;
}

/**
 * Reverse complement of a DNA sequence.
 */
function reverseComplement(seq: string): string {
  const comp: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };
  return seq.toUpperCase().split('').reverse().map(c => comp[c] ?? c).join('');
}

/**
 * Check for self-complementary runs (potential hairpins/self-dimers).
 * Returns true if any run of ≥ 6 bp can self-pair.
 */
function hasSelfComplementarity(seq: string, minRun: number = 6): boolean {
  const s = seq.toUpperCase();
  const rc = reverseComplement(s);
  for (let i = 0; i <= s.length - minRun; i++) {
    const subseq = s.slice(i, i + minRun);
    if (rc.includes(subseq)) return true;
  }
  return false;
}

/**
 * Check for mispriming — does the binding region appear elsewhere in the target?
 * Returns true if the binding region matches another location.
 */
function checkMispriming(
  bindingRegion: string,
  fullTarget: string,
  fragmentStart: number,
  fragmentEnd: number,
): boolean {
  const target = fullTarget.toUpperCase();
  const binding = bindingRegion.toUpperCase();
  const rc = reverseComplement(binding);

  // Find all occurrences of the binding region (or its RC)
  let count = 0;
  let idx = -1;
  while ((idx = target.indexOf(binding, idx + 1)) !== -1) {
    // Ignore the expected binding site
    if (idx < fragmentStart - 5 || idx > fragmentEnd + 5) count++;
  }
  idx = -1;
  while ((idx = target.indexOf(rc, idx + 1)) !== -1) {
    if (idx < fragmentStart - 5 || idx > fragmentEnd + 5) count++;
  }

  return count > 0;
}

/**
 * Design a primer for a specific fragment boundary.
 * Adjusts binding region length to achieve target Tm (60°C ± 5°C).
 */
function designPrimer(
  template: string,
  position: number, // Start position in template for binding
  direction: 'forward' | 'reverse',
  overlapSeq: string,
  fragmentIndex: number,
  fullTarget: string,
  fragStart: number,
  fragEnd: number,
): GibsonPrimer {
  const MIN_BIND = 18;
  const MAX_BIND = 25;
  const TARGET_TM = 62; // °C

  let bestBind = '';
  let bestTm = 0;
  let bestDiff = Infinity;

  for (let len = MIN_BIND; len <= MAX_BIND; len++) {
    let binding: string;
    if (direction === 'forward') {
      binding = template.slice(position, position + len).toUpperCase();
    } else {
      const start = Math.max(0, position - len);
      binding = reverseComplement(template.slice(start, position).toUpperCase());
    }
    if (binding.length < MIN_BIND) continue;

    const tm = calculateTm(binding);
    const diff = Math.abs(tm - TARGET_TM);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestBind = binding;
      bestTm = tm;
    }
  }

  // Build full primer: overlap + binding
  const fullSeq = direction === 'forward'
    ? overlapSeq.toUpperCase() + bestBind
    : overlapSeq.toUpperCase() + bestBind;

  return {
    id: `primer_F${fragmentIndex}_${direction[0].toUpperCase()}`,
    fragmentIndex,
    direction,
    sequence: fullSeq,
    bindingRegion: bestBind,
    overlapRegion: overlapSeq.toUpperCase(),
    length: fullSeq.length,
    tm: bestTm,
    gcContent: gcContent(bestBind),
    hasSelfDimer: hasSelfComplementarity(fullSeq),
    hasMisprime: checkMispriming(bestBind, fullTarget, fragStart, fragEnd),
  };
}

// ── Main Assembly Planner ─────────────────────────────────────────────────────

export interface AssemblyOptions {
  maxFragmentLength?: number;   // Default 800 bp
  overlapLength?: number;       // Default 30 bp
  targetTm?: number;            // Default 62°C
  circularize?: boolean;        // Default true (circular plasmid)
}

/**
 * Design a Gibson Assembly plan for a target plasmid sequence.
 *
 * Algorithm:
 * 1. Fragment the target into chunks < maxFragmentLength
 * 2. Design overlapping primers at each junction with matched Tm
 * 3. Check for secondary structures and mispriming
 * 4. Assign UUID provenance to each physical tube
 *
 * @param targetSequence - Full plasmid DNA sequence
 * @param targetName - Name for the construct
 * @param options - Assembly parameters
 * @returns GibsonAssemblyPlan with fragments, primers, and warnings
 */
export function planGibsonAssembly(
  targetSequence: string,
  targetName: string,
  options: AssemblyOptions = {},
): GibsonAssemblyPlan {
  const {
    maxFragmentLength = 800,
    overlapLength = 30,
    circularize = true,
  } = options;

  const target = targetSequence.toUpperCase().replace(/[^ATCG]/g, '');
  const totalLength = target.length;
  const warnings: string[] = [];
  const provenanceId = generateUUID();

  if (totalLength < 100) {
    warnings.push('Target sequence is very short (< 100 bp). Consider direct synthesis.');
  }

  // Step 1: Calculate fragment count and boundaries
  const fragmentCount = Math.max(2, Math.ceil(totalLength / (maxFragmentLength - overlapLength)));
  const idealFragLen = Math.ceil(totalLength / fragmentCount);
  const fragments: GibsonFragment[] = [];
  const primers: GibsonPrimer[] = [];

  for (let i = 0; i < fragmentCount; i++) {
    const start = i * idealFragLen;
    const end = Math.min(start + idealFragLen + overlapLength, totalLength);
    const seq = target.slice(start, end);

    // For circular constructs, last fragment overlaps with first
    let overlapFwd = '';
    let overlapRev = '';

    if (i > 0) {
      // 5' overlap = end of previous fragment
      overlapRev = target.slice(start - overlapLength, start);
    } else if (circularize) {
      // First fragment: 5' overlap wraps around to end of sequence
      overlapRev = target.slice(totalLength - overlapLength);
    }

    if (i < fragmentCount - 1) {
      // 3' overlap = start of next fragment
      overlapFwd = target.slice(end - overlapLength, end);
    } else if (circularize) {
      // Last fragment: 3' overlap wraps to start
      overlapFwd = target.slice(0, overlapLength);
    }

    fragments.push({
      id: `${targetName}_frag_${i + 1}`,
      index: i,
      sequence: seq,
      length: seq.length,
      overlapFwd,
      overlapRev,
      gcContent: gcContent(seq),
    });

    if (seq.length > 1000) {
      warnings.push(`Fragment ${i + 1} is ${seq.length} bp (exceeds 1000 bp limit).`);
    }
  }

  // Step 2: Design primers for each fragment
  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i];
    const fragStart = i * idealFragLen;
    const fragEnd = Math.min(fragStart + idealFragLen + overlapLength, totalLength);

    // Forward primer: overlap from previous junction + binding to fragment start
    const fwdOverlap = i > 0
      ? target.slice(fragStart - overlapLength, fragStart)
      : (circularize ? target.slice(totalLength - overlapLength) : '');

    const fwdPrimer = designPrimer(
      target, fragStart, 'forward', fwdOverlap,
      i, target, fragStart, fragEnd,
    );
    primers.push(fwdPrimer);

    // Reverse primer: overlap into next junction + binding to fragment end
    const nextStart = Math.min(fragEnd, totalLength);
    const revOverlap = i < fragments.length - 1
      ? reverseComplement(target.slice(nextStart, nextStart + overlapLength))
      : (circularize ? reverseComplement(target.slice(0, overlapLength)) : '');

    const revPrimer = designPrimer(
      target, fragEnd, 'reverse', revOverlap,
      i, target, fragStart, fragEnd,
    );
    primers.push(revPrimer);
  }

  // Step 3: Analyze Tm spread
  const tms = primers.map(p => p.tm);
  const minTm = Math.min(...tms);
  const maxTm = Math.max(...tms);
  const tmSpread = Math.round((maxTm - minTm) * 10) / 10;

  if (tmSpread > 5) {
    warnings.push(`Tm spread is ${tmSpread}°C (target < 5°C). Consider adjusting primer lengths.`);
  }

  // Step 4: Flag secondary structure warnings
  const dimers = primers.filter(p => p.hasSelfDimer);
  if (dimers.length > 0) {
    warnings.push(`${dimers.length} primer(s) have potential self-dimer structures: ${dimers.map(p => p.id).join(', ')}.`);
  }

  const misprimes = primers.filter(p => p.hasMisprime);
  if (misprimes.length > 0) {
    warnings.push(`${misprimes.length} primer(s) have potential mispriming sites: ${misprimes.map(p => p.id).join(', ')}.`);
  }

  return {
    targetName,
    targetLength: totalLength,
    fragments,
    primers,
    overlapLength,
    expectedTmRange: [minTm, maxTm],
    tmSpread,
    warnings,
    provenanceId,
  };
}

// ── Provenance Record Generator ───────────────────────────────────────────────

/**
 * Generate provenance records for all physical tubes in a Gibson Assembly.
 * Each fragment, primer, and assembly product gets a unique UUID linked
 * back to the digital design ID.
 */
export function generateProvenanceRecords(
  plan: GibsonAssemblyPlan,
): ProvenanceRecord[] {
  const records: ProvenanceRecord[] = [];
  const now = new Date().toISOString();
  const fragmentUuids: string[] = [];

  // Fragment tubes
  for (const frag of plan.fragments) {
    const uuid = generateUUID();
    fragmentUuids.push(uuid);
    records.push({
      uuid,
      designId: plan.provenanceId,
      sampleType: 'fragment',
      label: `${frag.id} (${frag.length} bp)`,
      well: `${String.fromCharCode(65 + frag.index)}1`,
      slot: 4,
      volume_ul: 50,
      concentration_ng_ul: 100,
      createdAt: now,
    });
  }

  // Primer tubes
  for (const primer of plan.primers) {
    records.push({
      uuid: generateUUID(),
      designId: plan.provenanceId,
      sampleType: 'primer',
      label: `${primer.id} (Tm ${primer.tm}°C)`,
      well: `${String.fromCharCode(65 + primer.fragmentIndex)}${primer.direction === 'forward' ? 2 : 3}`,
      slot: 5,
      volume_ul: 100,
      concentration_ng_ul: 10,
      createdAt: now,
    });
  }

  // Assembly product (the joined construct)
  records.push({
    uuid: generateUUID(),
    designId: plan.provenanceId,
    sampleType: 'assembly',
    label: `${plan.targetName} assembled (${plan.targetLength} bp)`,
    well: 'A1',
    slot: 2,
    volume_ul: 25,
    createdAt: now,
    parentUuids: fragmentUuids,
  });

  return records;
}

/**
 * Generate a detailed primer order sheet as a CSV string.
 */
export function exportPrimerOrderCSV(plan: GibsonAssemblyPlan): string {
  const header = 'Primer_ID,Direction,Sequence_5to3,Length_bp,Tm_C,GC%,Self_Dimer,Misprime,Fragment,Overlap_bp,Binding_bp';
  const rows = plan.primers.map(p => [
    p.id,
    p.direction,
    p.sequence,
    p.length,
    p.tm.toFixed(1),
    (p.gcContent * 100).toFixed(1),
    p.hasSelfDimer ? 'YES' : 'no',
    p.hasMisprime ? 'YES' : 'no',
    `Fragment_${p.fragmentIndex + 1}`,
    p.overlapRegion.length,
    p.bindingRegion.length,
  ].join(','));

  return [header, ...rows].join('\n');
}
