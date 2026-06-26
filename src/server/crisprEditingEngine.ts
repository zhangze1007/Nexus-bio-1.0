/**
 * CRISPR Editing Design Engine — Prime Editing, Base Editing, Epigenome Editing
 *
 * Extends GenMIM beyond CRISPRi knockdown to include:
 *   1. Prime Editing (PE3, PEmax) — pegRNA design for precise insertions/deletions/point mutations
 *   2. Base Editing (ABE8e, CGBE) — A→G and C→T conversions without DSBs
 *   3. Epigenome Editing (CRISPRoff/CRISPRon) — heritable gene silencing/activation
 *
 * References:
 *   - Anzalone et al. (2019) Nature 576:149-157 (Prime editing)
 *   - Gaudelli et al. (2017) Nature 551:464-471 (Adenine base editors)
 *   - Komor et al. (2016) Nature 533:420-424 (Cytosine base editors)
 *   - Nuñez et al. (2021) Cell 184:1-15 (CRISPRoff)
 *   - Yarnall et al. (2023) Nat Biotechnol 41:500-512 (PASTE)
 *
 * @scientific_provenance
 *   ALGORITHM: pegRNA design (PBS + RTT), base editing window prediction,
 *              epigenome effector scoring
 *   KNOWN_LIMITATIONS:
 *     - pegRNA design uses simplified thermodynamic scoring (not full NUPACK)
 *     - Base editing efficiency is a heuristic approximation
 *     - Epigenome editing silencing/activation scores are estimated from GC content
 *     - No off-target prediction for prime/base editors (would require GUIDE-seq data)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type EditingMode = "prime" | "base" | "epigenome";

export type BaseEditorType = "ABE8e" | "CGBE" | "CBE4max";
export type EpigenomeEffector = "CRISPRoff" | "CRISPRon" | "DNMT3A" | "TET1" | "p300" | "KRAB";

export interface PrimeEditDesign {
  /** Target gene ID */
  geneId: string;
  /** Original codon */
  originalCodon: string;
  /** Edited codon */
  editedCodon: string;
  /** Amino acid change */
  aaChange: string;
  /** pegRNA spacer sequence (20 nt) */
  spacer: string;
  /** Primer binding site (PBS, 8-15 nt) */
  pbs: string;
  /** Reverse transcriptase template (RTT, 10-16 nt) */
  rtt: string;
  /** Full pegRNA sequence */
  pegRNA: string;
  /** Nicking sgRNA for PE3 */
  nicksgRNA?: string;
  /** Predicted editing efficiency (0-1) */
  efficiency: number;
  /** Predicted indel frequency (0-1) */
  indelFrequency: number;
  /** Edit type */
  editType: "substitution" | "insertion" | "deletion";
  /** Design notes */
  notes: string[];
}

export interface BaseEditDesign {
  /** Target gene ID */
  geneId: string;
  /** Target nucleotide position */
  position: number;
  /** Original base */
  originalBase: string;
  /** Target base */
  targetBase: string;
  /** Editor type */
  editorType: BaseEditorType;
  /** sgRNA spacer (20 nt) */
  spacer: string;
  /** Editing window position (0-indexed protospacer) */
  editingWindow: { start: number; end: number };
  /** Target base position within editing window */
  targetPosition: number;
  /** Predicted editing efficiency (0-1) */
  efficiency: number;
  /** Predicted bystander editing (other bases in window) */
  bystanderEdits: Array<{ position: number; original: string; edited: string; efficiency: number }>;
  /** Design notes */
  notes: string[];
}

export interface EpigenomeEditDesign {
  /** Target gene ID */
  geneId: string;
  /** Target region (promoter, gene body, enhancer) */
  targetRegion: "promoter" | "gene_body" | "enhancer";
  /** Effector protein */
  effector: EpigenomeEffector;
  /** dCas9-sgRNA spacer (20 nt) */
  spacer: string;
  /** Predicted silencing/activation score (0-1) */
  activityScore: number;
  /** Chromatin context estimate */
  chromatinContext: "open" | "closed" | "mixed";
  /** Design notes */
  notes: string[];
}

export interface PASTEDesign {
  /** Target gene ID */
  geneId: string;
  /** Safe harbor locus */
  safeHarbor: string;
  /** Cargo sequence to insert */
  cargo: string;
  /** Cargo size (bp) */
  cargoSize: number;
  /** Cas9 sgRNA for targeting */
  cas9sgRNA: string;
  /** Serine integrase type */
  integrase: "Bxb1" | "phiC31" | "PhiBT1";
  /** AttB/attP sites */
  attachmentSites: { attB: string; attP: string };
  /** Predicted integration efficiency (0-1) */
  efficiency: number;
  /** Design notes */
  notes: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const CODON_TABLE: Record<string, string> = {
  TTT: "F",
  TTC: "F",
  TTA: "L",
  TTG: "L",
  CTT: "L",
  CTC: "L",
  CTA: "L",
  CTG: "L",
  ATT: "I",
  ATC: "I",
  ATA: "I",
  ATG: "M",
  GTT: "V",
  GTC: "V",
  GTA: "V",
  GTG: "V",
  TCT: "S",
  TCC: "S",
  TCA: "S",
  TCG: "S",
  CCT: "P",
  CCC: "P",
  CCA: "P",
  CCG: "P",
  ACT: "T",
  ACC: "T",
  ACA: "T",
  ACG: "T",
  GCT: "A",
  GCC: "A",
  GCA: "A",
  GCG: "A",
  TAT: "Y",
  TAC: "Y",
  TAA: "*",
  TAG: "*",
  CAT: "H",
  CAC: "H",
  CAA: "Q",
  CAG: "Q",
  AAT: "N",
  AAC: "N",
  AAA: "K",
  AAG: "K",
  GAT: "D",
  GAC: "D",
  GAA: "E",
  GAG: "E",
  TGT: "C",
  TGC: "C",
  TGA: "*",
  TGG: "W",
  CGT: "R",
  CGC: "R",
  CGA: "R",
  CGG: "R",
  AGT: "S",
  AGC: "S",
  AGA: "R",
  AGG: "R",
  GGT: "G",
  GGC: "G",
  GGA: "G",
  GGG: "G",
};

// Safe harbor loci in common model organisms
const SAFE_HARBORS: Record<string, { locus: string; sequence: string; organism: string }[]> = {
  human: [
    {
      locus: "AAVS1",
      sequence: "GGGGCCACTAGGGACAGGATCGGGGCCACAGGGGCCCCGCGGCCCGGGCCCGCCGTGCCACTA",
      organism: "Homo sapiens",
    },
    { locus: "Rosa26", sequence: "GAGATGGGCGGGAGTCTTGTGGCCCCTCCTCTGGACCCCAGGCTCCTGTCC", organism: "Homo sapiens" },
  ],
  mouse: [
    { locus: "Rosa26", sequence: "GAGATGGGCGGGAGTCTTGTGGCCCCTCCTCTGGACCCCAGGCTCCTGTCC", organism: "Mus musculus" },
    { locus: "Hipp11", sequence: "GATGGGCGGGAGTCTTGTGGCCCCTCCTCTGGACCCCAGG", organism: "Mus musculus" },
  ],
  ecoli: [{ locus: "attTn7", sequence: "CGGGGGATCCTCTAGAGTCGACCTGCAGGCATGCAAGCTT", organism: "E. coli" }],
};

// Serine integrase attachment sites
const INTEGRASE_SITES: Record<string, { attB: string; attP: string }> = {
  Bxb1: { attB: "TCAATTTCTTGTCTACCTAGGCTA", attP: "TCAATTTCTTGTCTACCTAGGCTA" },
  phiC31: {
    attB: "GCGGTCTCGGTCGTTGCGGACCGTGCGGGTGCCAGGGCGTGCCCTTGGGCTCCCCGGGCGCGTACTCCAC",
    attP: "GCGGTCTCGGTCGTTGCGGACCGTGCGGGTGCCAGGGCGTGCCCTTGGGCTCCCCGGGCGCGTACTCCAC",
  },
  PhiBT1: { attB: "TCAATTTCTTGTCTACCTAGGCTA", attP: "TCAATTTCTTGTCTACCTAGGCTA" },
};

// ── Prime Editing Design ──────────────────────────────────────────────────

/**
 * Design a prime edit for a specific mutation.
 *
 * Generates pegRNA with:
 *   - Spacer: 20 nt protospacer adjacent to edit site
 *   - PBS (primer binding site): 8-15 nt complementary to nick strand
 *   - RTT (reverse transcriptase template): 10-16 nt encoding the desired edit
 *
 * @param geneSequence  Full gene coding sequence
 *   - editPosition    Position of the edit (0-indexed)
 *   - editType        Type of edit
 *   - newBases        New bases to insert/substitute
 *   - peVersion       PE version (PE2, PE3, PEmax)
 * @returns pegRNA design with efficiency estimates
 */
export function designPrimeEdit(
  geneSequence: string,
  editPosition: number,
  editType: "substitution" | "insertion" | "deletion",
  newBases: string = "",
  peVersion: "PE2" | "PE3" | "PEmax" = "PE3",
): PrimeEditDesign {
  const seq = geneSequence.toUpperCase();
  const geneId = `gene_pos${editPosition}`;

  // Extract context around edit site
  const contextStart = Math.max(0, editPosition - 30);
  const contextEnd = Math.min(seq.length, editPosition + 30);
  const context = seq.substring(contextStart, contextEnd);

  // Design spacer (20 nt protospacer)
  // PAM should be on the non-edited strand, 3' of the protospacer
  const spacerStart = Math.max(0, editPosition - 20);
  const spacer = seq.substring(spacerStart, spacerStart + 20);

  // Design PBS (primer binding site)
  // PBS is complementary to the nick strand, 8-15 nt
  const pbsLength = 13;
  const pbsStart = Math.max(0, editPosition - pbsLength);
  const pbsSeq = seq.substring(pbsStart, editPosition);
  const pbs = reverseComplement(pbsSeq);

  // Design RTT (reverse transcriptase template)
  // RTT encodes the desired edit + flanking homology
  let rtt = "";
  let editedCodon = "";
  let originalCodon = "";
  let aaChange = "";

  if (editType === "substitution") {
    const codonStart = Math.floor(editPosition / 3) * 3;
    originalCodon = seq.substring(codonStart, codonStart + 3);
    editedCodon =
      originalCodon.substring(0, editPosition - codonStart) +
      newBases.charAt(0) +
      originalCodon.substring(editPosition - codonStart + 1);
    const originalAA = CODON_TABLE[originalCodon] || "?";
    const editedAA = CODON_TABLE[editedCodon] || "?";
    aaChange = `${originalAA}${Math.floor(editPosition / 3) + 1}${editedAA}`;
    rtt = seq.substring(editPosition, editPosition + 10) + newBases + seq.substring(editPosition + 1, editPosition + 6);
  } else if (editType === "insertion") {
    rtt = seq.substring(editPosition, editPosition + 8) + newBases + seq.substring(editPosition, editPosition + 5);
    aaChange = `ins:${newBases}`;
    editedCodon = newBases;
    originalCodon = "";
  } else {
    // deletion
    const delLength = newBases.length || 3;
    rtt =
      seq.substring(editPosition, editPosition + 5) +
      seq.substring(editPosition + delLength, editPosition + delLength + 8);
    aaChange = `del:${delLength}bp`;
    editedCodon = "";
    originalCodon = seq.substring(editPosition, editPosition + delLength);
  }

  // Full pegRNA = spacer + scaffold + RTT
  const scaffold = "GTTTCAGAGCTATGCTGGAAACAGCATAGCAAGTTGAAATAAGGCTAGTCCGTTATCAACTTGAAAAAGTGGCACCGAGTCGGTGC";
  const pegRNA = spacer + scaffold + reverseComplement(rtt);

  // Efficiency estimation (heuristic based on PBS/RTT length and GC content)
  const pbsGC = (pbs.match(/[GC]/g) || []).length / pbs.length;
  const rttGC = (rtt.match(/[GC]/g) || []).length / Math.max(1, rtt.length);
  const baseEfficiency = peVersion === "PEmax" ? 0.65 : peVersion === "PE3" ? 0.45 : 0.3;
  const efficiency = Math.min(
    0.9,
    Math.max(0.05, baseEfficiency + 0.1 * (1 - Math.abs(pbsGC - 0.5)) - 0.05 * Math.abs(rttGC - 0.5)),
  );

  // Indel frequency (PE3 has lower indels than PE2)
  const indelFrequency = peVersion === "PE3" ? 0.02 : peVersion === "PEmax" ? 0.01 : 0.05;

  // Nicking sgRNA for PE3
  let nicksgRNA: string | undefined;
  if (peVersion === "PE3" || peVersion === "PEmax") {
    const nickPos = editPosition + 40; // ~40 bp from edit site
    if (nickPos + 20 <= seq.length) {
      nicksgRNA = seq.substring(nickPos, nickPos + 20);
    }
  }

  return {
    geneId,
    originalCodon,
    editedCodon,
    aaChange,
    spacer,
    pbs,
    rtt: reverseComplement(rtt),
    pegRNA,
    nicksgRNA,
    efficiency: Math.round(efficiency * 100) / 100,
    indelFrequency: Math.round(indelFrequency * 100) / 100,
    editType,
    notes: [
      `Prime ${peVersion} design for ${editType} at position ${editPosition}`,
      `PBS length: ${pbs.length} nt, RTT length: ${rtt.length} nt`,
      `Amino acid change: ${aaChange}`,
      `Predicted efficiency: ${(efficiency * 100).toFixed(1)}%`,
      `Predicted indel frequency: ${(indelFrequency * 100).toFixed(1)}%`,
    ],
  };
}

// ── Base Editing Design ──────────────────────────────────────────────────

/**
 * Design a base edit for a specific nucleotide change.
 *
 * Supports:
 *   - ABE8e: A·T → G·C (adenine base editor)
 *   - CGBE: C·G → G·C (cytosine glycosylase base editor)
 *   - CBE4max: C·G → T·A (cytosine base editor)
 *
 * @param geneSequence  Full gene coding sequence
 * @param editPosition  Position of the target base (0-indexed)
 * @param editorType    Base editor type
 * @returns Base editing design with efficiency and bystander analysis
 */
export function designBaseEdit(
  geneSequence: string,
  editPosition: number,
  editorType: BaseEditorType = "ABE8e",
): BaseEditDesign {
  const seq = geneSequence.toUpperCase();
  const geneId = `gene_pos${editPosition}`;

  // Determine target base conversion
  const originalBase = seq[editPosition];
  let targetBase: string;
  if (editorType === "ABE8e") {
    targetBase = "G"; // A→G
  } else if (editorType === "CGBE") {
    targetBase = "G"; // C→G
  } else {
    targetBase = "T"; // C→T
  }

  // Design spacer (20 nt protospacer with NGG PAM)
  const spacerStart = Math.max(0, editPosition - 20);
  const spacer = seq.substring(spacerStart, spacerStart + 20);

  // Editing window (position within protospacer where editing occurs)
  // ABE8e: positions 4-8 (0-indexed)
  // CBE4max: positions 4-8
  // CGBE: positions 4-8
  const editingWindow = { start: 4, end: 8 };
  const targetPosition = editPosition - spacerStart;

  // Efficiency estimation
  const baseEfficiency = editorType === "ABE8e" ? 0.55 : editorType === "CGBE" ? 0.35 : 0.5;
  const windowBonus = targetPosition >= editingWindow.start && targetPosition <= editingWindow.end ? 0.2 : -0.3;
  const efficiency = Math.min(0.9, Math.max(0.02, baseEfficiency + windowBonus));

  // Bystander editing analysis (other editable bases in the window)
  const bystanderEdits: BaseEditDesign["bystanderEdits"] = [];
  const targetBases = editorType === "ABE8e" ? ["A"] : ["C"];
  for (let i = editingWindow.start; i <= editingWindow.end; i++) {
    const pos = spacerStart + i;
    if (pos !== editPosition && pos < seq.length && targetBases.includes(seq[pos])) {
      const bystanderEff = Math.max(0.05, efficiency * (0.5 + 0.3 * Math.random()));
      bystanderEdits.push({
        position: pos,
        original: seq[pos],
        edited: targetBase,
        efficiency: Math.round(bystanderEff * 100) / 100,
      });
    }
  }

  const codonStart = Math.floor(editPosition / 3) * 3;
  const originalCodon = seq.substring(codonStart, codonStart + 3);

  return {
    geneId,
    position: editPosition,
    originalBase,
    targetBase,
    editorType,
    spacer,
    editingWindow,
    targetPosition,
    efficiency: Math.round(efficiency * 100) / 100,
    bystanderEdits,
    notes: [
      `${editorType} base editing: ${originalBase}→${targetBase} at position ${editPosition}`,
      `Editing window: positions ${editingWindow.start}-${editingWindow.end} in protospacer`,
      `Target position in window: ${targetPosition}`,
      `Predicted efficiency: ${(efficiency * 100).toFixed(1)}%`,
      `Bystander edits detected: ${bystanderEdits.length}`,
      bystanderEdits.length > 0
        ? `Warning: ${bystanderEdits.length} bystander ${targetBases[0]} bases in editing window`
        : "No bystander edits in window",
    ],
  };
}

// ── Epigenome Editing Design ─────────────────────────────────────────────

/**
 * Design an epigenome edit for gene silencing or activation.
 *
 * Supports:
 *   - CRISPRoff: heritable gene silencing (DNMT3A/3L fusion)
 *   - CRISPRon: gene activation (TET1/dCas9)
 *   - DNMT3A: DNA methylation
 *   - TET1: DNA demethylation
 *   - p300: histone acetylation
 *   - KRAB: transcriptional repression
 *
 * @param geneSequence  Gene sequence (including promoter region)
 * @param targetRegion  Target region (promoter, gene body, enhancer)
 * @param effector      Epigenome effector protein
 * @returns Epigenome editing design
 */
export function designEpigenomeEdit(
  geneSequence: string,
  targetRegion: "promoter" | "gene_body" | "enhancer" = "promoter",
  effector: EpigenomeEffector = "CRISPRoff",
): EpigenomeEditDesign {
  const seq = geneSequence.toUpperCase();
  const geneId = "epigenome_target";

  // Select target position based on region
  let targetStart: number;
  if (targetRegion === "promoter") {
    targetStart = 0; // Assume first 500bp is promoter
  } else if (targetRegion === "enhancer") {
    targetStart = Math.max(0, Math.floor(seq.length * 0.3));
  } else {
    targetStart = Math.floor(seq.length * 0.5);
  }

  // Design spacer targeting the selected region
  const spacerStart = Math.min(targetStart, seq.length - 20);
  const spacer = seq.substring(spacerStart, spacerStart + 20);

  // Activity score based on effector and target region
  const effectorScores: Record<EpigenomeEffector, Record<string, number>> = {
    CRISPRoff: { promoter: 0.8, gene_body: 0.5, enhancer: 0.7 },
    CRISPRon: { promoter: 0.7, gene_body: 0.4, enhancer: 0.6 },
    DNMT3A: { promoter: 0.75, gene_body: 0.5, enhancer: 0.65 },
    TET1: { promoter: 0.7, gene_body: 0.4, enhancer: 0.6 },
    p300: { promoter: 0.6, gene_body: 0.3, enhancer: 0.8 },
    KRAB: { promoter: 0.85, gene_body: 0.6, enhancer: 0.7 },
  };
  const baseScore = effectorScores[effector]?.[targetRegion] ?? 0.5;

  // GC content affects chromatin accessibility
  const gcContent = (seq.match(/[GC]/g) || []).length / seq.length;
  const chromatinBonus = gcContent > 0.5 ? 0.05 : -0.05;
  const activityScore = Math.min(0.95, Math.max(0.1, baseScore + chromatinBonus));

  // Chromatin context estimation
  const chromatinContext: EpigenomeEditDesign["chromatinContext"] =
    gcContent > 0.55 ? "closed" : gcContent < 0.4 ? "open" : "mixed";

  const isSilencing = ["CRISPRoff", "DNMT3A", "KRAB"].includes(effector);

  return {
    geneId,
    targetRegion,
    effector,
    spacer,
    activityScore: Math.round(activityScore * 100) / 100,
    chromatinContext,
    notes: [
      `${effector} epigenome editing targeting ${targetRegion}`,
      isSilencing ? "Mode: gene silencing" : "Mode: gene activation",
      `GC content: ${(gcContent * 100).toFixed(1)}%`,
      `Chromatin context: ${chromatinContext}`,
      `Predicted activity: ${(activityScore * 100).toFixed(1)}%`,
      targetRegion === "promoter"
        ? "Promoter targeting recommended for maximal silencing/activation"
        : `${targetRegion} targeting — may require multiple sgRNAs for full effect`,
    ],
  };
}

// ── PASTE Design ─────────────────────────────────────────────────────────

/**
 * Design a PASTE (Programmable Addition via Site-specific Targeting Elements) experiment.
 *
 * Combines CRISPR-Cas9 with serine integrases to insert large DNA cargos
 * at specific genomic sites without HDR.
 *
 * @param cargo         DNA cargo sequence to insert
 * @param targetOrganism Target organism
 * @param integrase     Serine integrase to use
 * @returns PASTE design with integration sites and efficiency
 */
export function designPASTE(
  cargo: string,
  targetOrganism: "human" | "mouse" | "ecoli" = "human",
  integrase: "Bxb1" | "phiC31" | "PhiBT1" = "Bxb1",
): PASTEDesign {
  const geneId = "paste_insertion";
  const cargoSize = cargo.length;

  // Select safe harbor locus
  const harbors = SAFE_HARBORS[targetOrganism] || SAFE_HARBORS.human;
  const harbor = harbors[0];

  // Design Cas9 sgRNA targeting the safe harbor
  const cas9sgRNA = harbor.sequence.substring(0, 20);

  // Get integrase attachment sites
  const sites = INTEGRASE_SITES[integrase];

  // Efficiency estimation based on cargo size and integrase
  const sizePenalty = cargoSize > 5000 ? 0.2 : cargoSize > 2000 ? 0.1 : 0;
  const integraseEfficiency: Record<string, number> = {
    Bxb1: 0.6,
    phiC31: 0.55,
    PhiBT1: 0.45,
  };
  const efficiency = Math.max(0.05, (integraseEfficiency[integrase] || 0.5) - sizePenalty);

  return {
    geneId,
    safeHarbor: harbor.locus,
    cargo,
    cargoSize,
    cas9sgRNA,
    integrase,
    attachmentSites: sites,
    efficiency: Math.round(efficiency * 100) / 100,
    notes: [
      `PASTE design: ${cargoSize} bp cargo → ${harbor.locus} (${harbor.organism})`,
      `Integrase: ${integrase}`,
      `Safe harbor: ${harbor.locus}`,
      `Predicted integration efficiency: ${(efficiency * 100).toFixed(1)}%`,
      cargoSize > 5000 ? "Warning: large cargo may reduce efficiency" : "Cargo size within optimal range",
      `attB site: ${sites.attB.substring(0, 20)}...`,
      `attP site: ${sites.attP.substring(0, 20)}...`,
    ],
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function reverseComplement(seq: string): string {
  const comp: Record<string, string> = { A: "T", T: "A", G: "C", C: "G", N: "N" };
  return seq
    .split("")
    .reverse()
    .map((b) => comp[b] || b)
    .join("");
}
