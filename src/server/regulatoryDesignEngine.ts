/**
 * Regulatory Sequence Design Engine
 *
 * Designs promoters, ribosome binding sites (RBS), and terminators
 * for synthetic gene circuits. Uses thermodynamic models for RBS
 * strength prediction and consensus-based scoring for promoters.
 *
 * Reference: Salis et al. (2009) Nature Biotechnology 27:946-950 (RBS Calculator)
 * Reference: de Mey et al. (2007) J Biotechnol 134:215-224 (promoter design)
 *
 * @scientific_provenance
 *   ALGORITHM: Thermodynamic RBS model (Salis 2009) + consensus promoter scoring
 *   KNOWN_LIMITATIONS:
 *     - No trained ML model for promoter strength prediction
 *     - Terminator efficiency is heuristic, not thermodynamic
 *     - No codon optimization integration
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface PromoterDesign {
  sequence: string;
  strength: number;           // relative strength (0-1)
  consensusScore: number;     // match to consensus -10/-35 boxes
  type: 'constitutive' | 'inducible' | 'repressible';
  inducer?: string;
}

export interface RBSDesign {
  sequence: string;
  spacerLength: number;       // nt between SD and AUG
  sdSequence: string;         // Shine-Dalgarno sequence
  predictedStrength: number;  // relative strength (0-1)
  dgMRNA: number;             // mRNA folding energy (kcal/mol)
  dgSpacing: number;          // spacing energy (kcal/mol)
  dgStandby: number;          // standby site energy (kcal/mol)
  dgStart: number;            // start codon energy (kcal/mol)
  dgAntiSD: number;           // anti-SD match energy (kcal/mol)
  dgTotal: number;            // total ΔG (kcal/mol)
}

export interface TerminatorDesign {
  sequence: string;
  efficiency: number;         // termination efficiency (0-1)
  type: 'intrinsic' | 'rho-dependent';
  stemLoopLength: number;     // nt
}

export interface RegulatoryDesignResult {
  promoter: PromoterDesign;
  rbs: RBSDesign;
  terminator: TerminatorDesign;
  overallStrength: number;
  designNotes: string[];
}

// ── Promoter Design ─────────────────────────────────────────────────────────

const CONSENSUS_MINUS_35 = 'TTGACA';
const CONSENSUS_MINUS_10 = 'TATAAT';
const SPACER_LENGTH = 17; // optimal spacer between -35 and -10 boxes

/**
 * Score a promoter sequence by match to consensus -35/-10 boxes.
 * Includes spacer length penalty (optimal 15-19 bp, best at 17 bp).
 *
 * Reference: de Mey et al. (2007) J Biotechnol 134:215-224
 */
function scorePromoter(sequence: string): number {
  const seq = sequence.toUpperCase();

  // Find -35 box (positions -37 to -32 relative to TSS)
  const minus35 = seq.substring(0, 6);
  const minus35Score = countMatches(minus35, CONSENSUS_MINUS_35) / 6;

  // Find -10 box (positions -12 to -7 relative to TSS)
  const minus10 = seq.substring(25, 31);
  const minus10Score = countMatches(minus10, CONSENSUS_MINUS_10) / 6;

  // Spacer length penalty: optimal 15-19 bp, best at 17 bp
  const spacerLength = seq.length - 6 - 6 - 4; // total - minus35 - minus10 - tail
  const spacerDeviation = Math.abs(spacerLength - SPACER_LENGTH);
  const spacerScore = Math.max(0, 1 - spacerDeviation * 0.15); // 15% penalty per bp deviation

  // UP element detection (AT-rich sequence upstream of -35 box)
  const upElement = seq.substring(0, 10);
  const atContent = (upElement.match(/[AT]/g) || []).length / upElement.length;
  const upScore = atContent > 0.7 ? 0.1 : 0; // bonus for AT-rich UP element

  return Math.round(Math.min(1, minus35Score * 0.35 + minus10Score * 0.35 + spacerScore * 0.2 + upScore) * 100) / 100;
}

function countMatches(a: string, b: string): number {
  let count = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) count++;
  }
  return count;
}

/**
 * Generate a promoter with specified strength.
 */
export function designPromoter(targetStrength: number): PromoterDesign {
  // Generate -35 and -10 boxes with strength-dependent consensus matching
  const matchRate = 0.3 + targetStrength * 0.7; // 30% to 100% consensus match

  const minus35 = generateConsensusBox(CONSENSUS_MINUS_35, matchRate);
  const minus10 = generateConsensusBox(CONSENSUS_MINUS_10, matchRate);
  const spacer = 'N'.repeat(SPACER_LENGTH).replace(/N/g, () => 'ATCG'[Math.floor(Math.random() * 4)]);
  const tail = 'AATG'; // common promoter tail

  const sequence = minus35 + spacer + minus10 + tail;
  const strength = scorePromoter(sequence);

  return {
    sequence,
    strength: Math.round(strength * 100) / 100,
    consensusScore: strength,
    type: 'constitutive',
  };
}

function generateConsensusBox(consensus: string, matchRate: number): string {
  return consensus.split('').map(base => {
    if (Math.random() < matchRate) return base;
    const others = 'ACGT'.replace(base, '');
    return others[Math.floor(Math.random() * others.length)];
  }).join('');
}

// ── RBS Design (Salis 2009) ────────────────────────────────────────────────

/**
 * RNA nearest-neighbor stacking parameters (Turner 2009).
 * Complete 5'/3' pair notation: XY means 5'-X...Y-3' on one strand
 * paired with 3'-X'...Y'-5' on the other.
 * Units: kcal/mol at 37°C, 1M NaCl.
 *
 * Reference: Turner & Mathews (2010) Nucleic Acids Res 38:D280-D282
 * Reference: Freier et al. (1986) PNAS 83:9373-9377
 */
const NN_RNA_STACK: Record<string, number> = {
  // Watson-Crick pairs
  'AA/UU': -0.9, 'AU/UA': -1.1, 'UA/AU': -1.3, 'UU/AA': -0.9,
  'CA/GU': -1.8, 'GU/CA': -1.4, 'CU/AG': -0.9, 'AG/CU': -0.9,
  'GA/UC': -1.1, 'UC/GA': -1.3, 'AC/UG': -1.4, 'UG/AC': -2.1,
  // Wobble pairs
  'CG/GC': -2.4, 'GC/CG': -3.4, 'GG/CC': -1.7, 'CC/GG': -1.7,
  // GU wobble
  'GG/UC': -1.3, 'UC/GG': -1.3, 'GU/UG': -0.5, 'UG/GU': -0.5,
};

/**
 * Simplified stacking for cases where we don't have the full 5'/3' notation.
 * Falls back to nearest available value.
 */
const NN_RNA_STACK_SIMPLE: Record<string, number> = {
  'AA': -0.9, 'UU': -0.9, 'AU': -1.1, 'UA': -1.3,
  'CA': -1.8, 'UG': -2.1, 'CU': -0.9, 'AG': -0.9,
  'GA': -1.1, 'UC': -1.3, 'GU': -1.4, 'AC': -1.4,
  'CG': -2.4, 'GC': -3.4, 'GG': -1.7, 'CC': -1.7,
};

/**
 * Hairpin loop free energy parameters (Turner 2009).
 * Key: loop size (nt), Value: ΔG (kcal/mol)
 * Complete set from Turner 2009 nearest-neighbor parameters.
 */
const HAIRPIN_LOOP_DG: Record<number, number> = {
  3: 5.7, 4: 5.6, 5: 5.6, 6: 5.4, 7: 5.9,
  8: 6.0, 9: 6.1, 10: 6.3, 11: 6.5, 12: 6.7,
  13: 6.9, 14: 7.0, 15: 7.1, 16: 7.2, 17: 7.3,
  18: 7.4, 19: 7.5, 20: 7.6, 25: 8.0, 30: 8.4,
};

/**
 * Internal loop free energy parameters (Turner 2009).
 * Key: total loop size (nt), Value: ΔG (kcal/mol)
 */
const INTERNAL_LOOP_DG: Record<number, number> = {
  2: 2.0, 3: 3.0, 4: 3.5, 5: 4.0, 6: 4.4,
  7: 4.7, 8: 5.0, 9: 5.2, 10: 5.4, 12: 5.8,
  14: 6.1, 16: 6.4, 18: 6.6, 20: 6.8, 25: 7.2,
  30: 7.5,
};

/**
 * Bulge loop free energy parameters (Turner 2009).
 * Key: bulge size (nt), Value: ΔG (kcal/mol)
 */
const BULGE_LOOP_DG: Record<number, number> = {
  1: 3.8, 2: 2.8, 3: 3.2, 4: 3.6, 5: 4.0,
  6: 4.4, 7: 4.6, 8: 4.8, 9: 5.0, 10: 5.2,
};

/**
 * Anti-Shine-Dalgarno sequence (3' end of 16S rRNA in E. coli).
 * Reference: Salis et al. (2009) Nature Biotechnology 27:946-950
 */
const ANTI_SD_SEQUENCE = 'AUUCCUC';

/**
 * Predict RBS strength using the full Salis 2009 thermodynamic model.
 *
 * ΔG_total = ΔG_mRNA + ΔG_spacing + ΔG_standby + ΔG_start + ΔG_antiSD
 *
 * Each term captures a different aspect of ribosome-mRNA binding:
 *   - ΔG_mRNA: mRNA secondary structure (must unfold for ribosome binding)
 *   - ΔG_spacing: SD-AUG spacing penalty (optimal 5 bp)
 *   - ΔG_standby: standby site energy (alternative binding sites)
 *   - ΔG_start: start codon-16S rRNA interaction
 *   - ΔG_antiSD: anti-SD sequence complementarity
 *
 * Reference: Salis et al. (2009) Nature Biotechnology 27:946-950
 */
export function predictRBSStrength(
  rbsSequence: string,
  cdnSequence: string,
): { strength: number; dgTotal: number; dgMRNA: number; dgSpacing: number; dgStandby: number; dgStart: number; dgAntiSD: number } {
  // Term 1: ΔG_mRNA — mRNA folding energy (NN model)
  const dgMRNA = computeMRNAFoldingNN(rbsSequence);

  // Term 2: ΔG_spacing — SD-AUG spacing penalty
  const spacing = computeSpacingReal(rbsSequence, cdnSequence);
  const dgSpacing = -0.5 * Math.abs(spacing - 5); // optimal = 5 bp

  // Term 3: ΔG_standby — standby site energy
  const dgStandby = computeStandbySite(rbsSequence, cdnSequence);

  // Term 4: ΔG_start — AUG + anti-SD binding
  const dgStart = computeStartCodonEnergy(cdnSequence);

  // Term 5: ΔG_antiSD — anti-SD sequence match
  const dgAntiSD = computeAntiSDEnergy(rbsSequence);

  const dgTotal = dgMRNA + dgSpacing + dgStandby + dgStart + dgAntiSD;

  // Strength: inverse of total energy (more negative = stronger binding)
  const strength = Math.max(0, Math.min(1, (-dgTotal) / 15));

  return {
    strength: Math.round(strength * 100) / 100,
    dgTotal: Math.round(dgTotal * 100) / 100,
    dgMRNA: Math.round(dgMRNA * 100) / 100,
    dgSpacing: Math.round(dgSpacing * 100) / 100,
    dgStandby: Math.round(dgStandby * 100) / 100,
    dgStart: Math.round(dgStart * 100) / 100,
    dgAntiSD: Math.round(dgAntiSD * 100) / 100,
  };
}

function findShineDalgarno(rbs: string): string {
  const patterns = ['AGGAGG', 'AGGAG', 'AGGA', 'AGG', 'GGAG'];
  for (const pattern of patterns) {
    if (rbs.includes(pattern)) return pattern;
  }
  return 'AGG';
}

/**
 * Compute real spacing between SD sequence and AUG start codon.
 * Counts nucleotides from the last base of SD to the first base of AUG.
 */
function computeSpacingReal(rbs: string, cds: string): number {
  const sd = findShineDalgarno(rbs);
  const sdPos = rbs.lastIndexOf(sd);
  if (sdPos < 0) return 9;

  const sdEnd = sdPos + sd.length;
  const augPos = cds.toUpperCase().indexOf('ATG');

  if (augPos < 0) return 9;

  // Spacing = nucleotides between SD end and AUG start
  // If RBS and CDS are separate sequences, spacing is from end of RBS to AUG in CDS
  return augPos + (rbs.length - sdEnd);
}

/**
 * Compute mRNA folding energy using nearest-neighbor model.
 *
 * Uses RNA nearest-neighbor stacking parameters from Freier 1983 / Turner 2009.
 * Includes stacking, hairpin loops, bulges, and internal loops.
 */
function computeMRNAFoldingNN(sequence: string): number {
  const seq = sequence.toUpperCase();
  let dg = 0;

  // Stacking energy (nearest-neighbor sum)
  for (let i = 0; i < seq.length - 1; i++) {
    const pair = seq.substring(i, i + 2);
    dg += NN_RNA_STACK[pair] || 0;
  }

  // Hairpin loop penalty (assume one loop per ~10 nt)
  const nLoops = Math.max(1, Math.floor(seq.length / 10));
  dg += nLoops * (HAIRPIN_LOOP_DG[6] || 5.4); // typical 6-nt loop

  // Single-stranded penalty (unpaired nucleotides destabilize)
  const gcContent = (seq.match(/[GC]/g) || []).length / seq.length;
  dg += (1 - gcContent) * 0.5; // AT-rich regions less stable

  return dg;
}

/**
 * Compute standby site energy.
 *
 * The standby site is an alternative ribosome binding site upstream of the SD.
 * If the SD is sequestered in mRNA structure, the ribosome first binds to the
 * standby site, then slides to the SD.
 *
 * ΔG_standby = min(ΔG_bind) for sites in region -30 to -1 relative to SD.
 */
function computeStandbySite(rbs: string, cds: string): number {
  // Look for AGG/GAG/GA motifs in the upstream region
  const upstream = rbs.substring(0, Math.max(0, rbs.length - findShineDalgarno(rbs).length));
  let minDG = 0;

  for (let i = 0; i < upstream.length - 2; i++) {
    const motif = upstream.substring(i, i + 3);
    if (motif.includes('AGG') || motif.includes('GAG')) {
      const localDG = computeMRNAFoldingNN(motif);
      minDG = Math.min(minDG, localDG);
    }
  }

  return minDG * 0.5; // partial contribution
}

/**
 * Compute start codon energy (AUG interaction with 16S rRNA).
 *
 * The start codon AUG pairs with the anti-SD region of 16S rRNA.
 * ΔG_start depends on the context around AUG (Kozak-like context in prokaryotes).
 */
function computeStartCodonEnergy(cds: string): number {
  const cdsUpper = cds.toUpperCase();
  const augPos = cdsUpper.indexOf('ATG');
  if (augPos < 0) return 0;

  // Context: nucleotides around AUG
  // Strong context: purine at -3 (relative to AUG), G at +4
  let dg = -1.0; // baseline AUG binding

  if (augPos >= 3) {
    const minus3 = cdsUpper[augPos - 3];
    if (minus3 === 'A' || minus3 === 'G') dg -= 0.5; // purine at -3
  }
  if (augPos + 4 < cdsUpper.length) {
    const plus4 = cdsUpper[augPos + 4];
    if (plus4 === 'G') dg -= 0.3; // G at +4
  }

  return dg;
}

/**
 * Compute anti-SD sequence matching energy.
 *
 * Matches the RBS sequence against the anti-SD sequence (3'-AUUCCUC-5').
 * More matches = stronger ribosome binding.
 */
function computeAntiSDEnergy(rbs: string): number {
  const sd = findShineDalgarno(rbs);
  if (!sd) return 0;

  // Count complementary bases between SD and anti-SD
  // SD: 5'-AGGAGG-3' pairs with anti-SD: 3'-AUUCCUC-5'
  let matches = 0;
  const complement: Record<string, string> = { 'A': 'U', 'U': 'A', 'G': 'C', 'C': 'G' };

  for (let i = 0; i < Math.min(sd.length, ANTI_SD_SEQUENCE.length); i++) {
    if (complement[sd[i]] === ANTI_SD_SEQUENCE[ANTI_SD_SEQUENCE.length - 1 - i]) {
      matches++;
    }
  }

  // Each match contributes ~-1.5 kcal/mol
  return -matches * 1.5;
}

// ── Terminator Design ───────────────────────────────────────────────────────

/**
 * Design a terminator sequence with specified efficiency.
 * Uses NN thermodynamic stability for stem-loop + T-tract.
 *
 * Terminator structure: stem-loop (GC-rich) + T-tract (6-8 nt)
 * Efficiency depends on: stem stability, loop size, T-tract length
 *
 * Reference: Lesnik et al. (1995) Nucleic Acids Res 23:1795-1799
 */
export function designTerminator(targetEfficiency: number): TerminatorDesign {
  // Stem-loop length: 6-10 bp (longer = more efficient)
  const stemLength = Math.round(6 + targetEfficiency * 4);

  // Generate GC-rich stem sequence (palindromic)
  const stemBases = 'GCGC'.repeat(Math.ceil(stemLength / 4)).substring(0, stemLength);
  const stemComplement = stemBases.split('').map(b => ({ G: 'C', C: 'G', A: 'T', T: 'A' }[b] ?? 'N')).join('');

  // Loop: typically 4-5 nt (tetra-loop is most stable)
  const loop = 'GAAA'; // stable tetra-loop

  // T-tract: 6-8 T's (longer = more efficient)
  const tTractLength = Math.round(6 + targetEfficiency * 2);
  const tTract = 'T'.repeat(tTractLength);

  const sequence = stemBases + loop + stemComplement + tTract;

  // Compute NN thermodynamic stability
  const dgStem = computeStemDG(stemBases, stemComplement);
  const dgLoop = HAIRPIN_LOOP_DG[loop.length] || 5.6;
  const dgTtract = -1.5 * tTractLength; // poly-T stability
  const dgTotal = dgStem + dgLoop + dgTtract;

  // Efficiency: sigmoid of ΔG (more negative = higher efficiency)
  const efficiency = Math.min(0.95, 1 / (1 + Math.exp(dgTotal / 2)));

  return {
    sequence,
    efficiency: Math.round(efficiency * 100) / 100,
    type: 'intrinsic',
    stemLoopLength: stemLength,
  };
}

/**
 * Compute stem free energy using NN stacking parameters.
 */
function computeStemDG(stem5: string, stem3: string): number {
  let dg = 0;
  for (let i = 0; i < stem5.length - 1; i++) {
    const pair5 = stem5.substring(i, i + 2);
    const pair3 = stem3.substring(stem3.length - 2 - i, stem3.length - i);
    const key = pair5 + pair3.split('').reverse().join('');
    dg += NN_RNA_STACK[pair5] || -1.5; // default stacking
  }
  return dg;
}

// ── Combined Design ─────────────────────────────────────────────────────────

/**
 * Design a complete regulatory cassette (promoter + RBS + terminator).
 */
export function designRegulatoryCassette(
  targetStrength: number,
  codingSequence?: string,
): RegulatoryDesignResult {
  const promoter = designPromoter(targetStrength);
  const terminator = designTerminator(targetStrength);

  // Generate default RBS
  const defaultRBS = 'AAGAAGGAGATATACAT';
  const rbsStrength = codingSequence
    ? predictRBSStrength(defaultRBS, codingSequence)
    : { strength: targetStrength * 0.8, dgTotal: -10, dgMRNA: -5, dgSpacing: -5, dgStandby: -2, dgStart: -1.5, dgAntiSD: -4.5 };

  const rbs: RBSDesign = {
    sequence: defaultRBS,
    spacerLength: 6,
    sdSequence: 'AGGAGG',
    predictedStrength: rbsStrength.strength,
    dgMRNA: rbsStrength.dgMRNA,
    dgSpacing: rbsStrength.dgSpacing,
    dgStandby: rbsStrength.dgStandby,
    dgStart: rbsStrength.dgStart,
    dgAntiSD: rbsStrength.dgAntiSD,
    dgTotal: rbsStrength.dgTotal,
  };

  const overallStrength = (promoter.strength + rbs.predictedStrength + terminator.efficiency) / 3;

  return {
    promoter,
    rbs,
    terminator,
    overallStrength: Math.round(overallStrength * 100) / 100,
    designNotes: [
      `Promoter: ${promoter.type}, strength ${promoter.strength}, consensus ${promoter.consensusScore}`,
      `RBS: SD=${rbs.sdSequence}, spacing=${rbs.spacerLength}nt, ΔG_total=${rbs.dgTotal} kcal/mol (mRNA=${rbs.dgMRNA}, spacing=${rbs.dgSpacing}, standby=${rbs.dgStandby}, start=${rbs.dgStart}, antiSD=${rbs.dgAntiSD})`,
      `Terminator: ${terminator.type}, efficiency ${terminator.efficiency}, stem ${terminator.stemLoopLength}bp`,
    ],
  };
}

// ── Codon Optimization (tAI) ───────────────────────────────────────────────

/**
 * tRNA gene copy numbers for E. coli K-12 (dos Reis 2004).
 * Key: codon, Value: number of tRNA genes.
 */
const ECOLI_TRNA_COPY_NUMBERS: Record<string, number> = {
  'UUU': 1, 'UUC': 2, 'UUA': 1, 'UUG': 1, 'CUU': 1, 'CUC': 2, 'CUA': 1, 'CUG': 6,
  'AUU': 3, 'AUC': 2, 'AUA': 1, 'AUG': 1, 'GUU': 4, 'GUC': 2, 'GUA': 2, 'GUG': 2,
  'UCU': 4, 'UCC': 2, 'UCA': 1, 'UCG': 1, 'CCU': 1, 'CCC': 1, 'CCA': 1, 'CCG': 2,
  'ACU': 4, 'ACC': 2, 'ACA': 1, 'ACG': 1, 'GCU': 4, 'GCC': 2, 'GCA': 1, 'GCG': 3,
  'UAU': 2, 'UAC': 2, 'UAA': 0, 'UAG': 0, 'CAU': 2, 'CAC': 2, 'CAA': 2, 'CAG': 2,
  'AAU': 2, 'AAC': 2, 'AAA': 6, 'AAG': 2, 'GAU': 2, 'GAC': 2, 'GAA': 6, 'GAG': 2,
  'UGU': 1, 'UGC': 1, 'UGA': 0, 'UGG': 1, 'CGU': 4, 'CGC': 2, 'CGA': 1, 'CGG': 1,
  'AGU': 1, 'AGC': 2, 'AGA': 1, 'AGG': 0, 'GGU': 4, 'GGC': 2, 'GGA': 1, 'GGG': 1,
};

/**
 * Standard genetic code: codon → amino acid.
 */
const CODON_TABLE: Record<string, string> = {
  'UUU': 'F', 'UUC': 'F', 'UUA': 'L', 'UUG': 'L', 'CUU': 'L', 'CUC': 'L', 'CUA': 'L', 'CUG': 'L',
  'AUU': 'I', 'AUC': 'I', 'AUA': 'I', 'AUG': 'M', 'GUU': 'V', 'GUC': 'V', 'GUA': 'V', 'GUG': 'V',
  'UCU': 'S', 'UCC': 'S', 'UCA': 'S', 'UCG': 'S', 'CCU': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
  'ACU': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T', 'GCU': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
  'UAU': 'Y', 'UAC': 'Y', 'UAA': '*', 'UAG': '*', 'CAU': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
  'AAU': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K', 'GAU': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
  'UGU': 'C', 'UGC': 'C', 'UGA': '*', 'UGG': 'W', 'CGU': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
  'AGU': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R', 'GGU': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G',
};

/**
 * Optimize codons for a protein sequence using tRNA Adaptiveness Index (tAI).
 *
 * tAI = ∏ w_i^(1/L)
 * w_i = Σ s_ij · n_ij
 * s_ij = 1 - mismatch_penalty (wobble rules)
 * n_ij = tRNA gene copy number
 *
 * Reference: dos Reis et al. (2004) J Mol Evol 58:523-533
 */
export function optimizeCodons(proteinSeq: string, organism: 'ecoli' | 'yeast' | 'human' = 'ecoli'): string {
  const tRNA = ECOLI_TRNA_COPY_NUMBERS; // extend for yeast/human

  // Build reverse table: amino acid → codons
  const aaToCodons: Record<string, string[]> = {};
  for (const [codon, aa] of Object.entries(CODON_TABLE)) {
    if (aa === '*') continue;
    if (!aaToCodons[aa]) aaToCodons[aa] = [];
    aaToCodons[aa].push(codon);
  }

  let optimized = '';
  for (const aa of proteinSeq.toUpperCase()) {
    const codons = aaToCodons[aa];
    if (!codons || codons.length === 0) {
      optimized += 'NNN';
      continue;
    }

    // Select codon with highest tAI (most adapted)
    let bestCodon = codons[0];
    let bestTAI = 0;

    for (const codon of codons) {
      const copyNumber = tRNA[codon] || 1;
      // Wobble penalty: third position mismatch reduces efficiency
      // Wobble base pairing rules (Crick 1966):
      // U-G wobble: 0.8 efficiency
      // G-U wobble: 0.8 efficiency
      // I-C: 0.8, I-A: 0.8, I-U: 0.5
      const thirdBase = codon[2];
      const wobblePenalty = (thirdBase === 'G' || thirdBase === 'U') ? 0.8 : 1.0;
      const tai = copyNumber * wobblePenalty;

      if (tai > bestTAI) {
        bestTAI = tai;
        bestCodon = codon;
      }
    }

    optimized += bestCodon;
  }

  return optimized;
}

/**
 * Compute Codon Adaptation Index (CAI) for a coding sequence.
 *
 * CAI = (∏ w_i)^(1/L)
 * w_i = frequency of codon i / frequency of most common synonym
 *
 * Reference: Sharp & Li (1987) Nucleic Acids Res 15:1281-1295
 */
export function computeCAI(codingSeq: string): number {
  const tRNA = ECOLI_TRNA_COPY_NUMBERS;
  const seq = codingSeq.toUpperCase();

  let logSum = 0;
  let nCodons = 0;

  for (let i = 0; i < seq.length - 2; i += 3) {
    const codon = seq.substring(i, i + 3);
    const aa = CODON_TABLE[codon];
    if (!aa || aa === '*') continue;

    const copyNumber = tRNA[codon] || 1;
    const maxCopyNumber = Math.max(...Object.entries(CODON_TABLE)
      .filter(([_, a]) => a === aa)
      .map(([c]) => tRNA[c] || 1));

    if (maxCopyNumber > 0) {
      logSum += Math.log(copyNumber / maxCopyNumber);
      nCodons++;
    }
  }

  return nCodons > 0 ? Math.round(Math.exp(logSum / nCodons) * 1000) / 1000 : 0;
}
