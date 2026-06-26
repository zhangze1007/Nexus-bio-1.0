/**
 * E. coli K-12 MG1655 Gene Annotations
 *
 * Reference genome: NC_000913.3 (4,641,652 bp)
 * Source: iJO1366 model (Orth et al., 2011, Mol Syst Biol 7:535)
 * Essential genes: from Gerdes et al. (2003) J Bacteriol 185:5673
 *
 * This is a curated subset covering central metabolism, essential genes,
 * and commonly-targeted CRISPRi knockdown candidates.
 */

export interface GeneAnnotation {
  /** BiGG gene ID (e.g., 'b0001') */
  id: string;
  /** Common gene name (e.g., 'thrL') */
  name: string;
  /** Start position on chromosome (0-based, bp) */
  start: number;
  /** End position on chromosome (0-based, bp) */
  end: number;
  /** Strand direction */
  strand: '+' | '-';
  /** Whether gene is essential for growth on rich media */
  essential: boolean;
  /** Functional category */
  subsystem: string;
  /** Operon membership (genes in same operon share this ID) */
  operon?: string;
  /** Gene product / function description */
  product?: string;
}

/** E. coli K-12 MG1655 chromosome length (bp) */
export const ECOLI_K12_CHROMOSOME_LENGTH = 4_641_652;

/** NCBI accession for the reference genome */
export const ECOLI_K12_ACCESSION = 'NC_000913.3';

/** IGV.js-compatible genome ID */
export const ECOLI_K12_IGV_GENOME_ID = 'ecoli_K12_MG1655';

/**
 * Custom IGV.js genome definition for E. coli K-12.
 * Uses NCBI-hosted FASTA so no local file is needed.
 */
export const ECOLI_K12_GENOME_DEFINITION = {
  id: 'ecoli_K12_MG1655',
  name: 'E. coli K-12 MG1655',
  fastaURL: 'https://hgdownload.soe.ucsc.edu/goldenPath/ecK12/dna/ecK12.fa.gz',
  indexURL: 'https://hgdownload.soe.ucsc.edu/goldenPath/ecK12/dna/ecK12.fa.gz.fai',
  chromosomeOrder: ['chr'],
} as const;

/**
 * Representative gene annotations for E. coli K-12 MG1655.
 *
 * Coordinates are from the iJO1366 model / EcoCyc database.
 * This subset covers ~60 genes across central metabolism pathways:
 *   - Glycolysis / gluconeogenesis
 *   - TCA cycle
 *   - Pentose phosphate pathway
 *   - Pyruvate metabolism
 *   - Fermentation
 *   - Key biosynthetic pathways
 *   - Common CRISPRi targets
 */
export const ECOLI_K12_GENES: GeneAnnotation[] = [
  // ── Glycolysis / Gluconeogenesis ──────────────────────────────────────
  {
    id: 'b1779', name: 'gapA', start: 1858681, end: 1859682, strand: '+',
    essential: true, subsystem: 'Glycolysis', operon: 'gapA',
    product: 'glyceraldehyde-3-phosphate dehydrogenase A',
  },
  {
    id: 'b0755', name: 'gpmA', start: 786658, end: 787308, strand: '+',
    essential: true, subsystem: 'Glycolysis', operon: 'gpmA',
    product: 'phosphoglycerate mutase 1',
  },
  {
    id: 'b2779', name: 'eno', start: 2907021, end: 2908316, strand: '+',
    essential: true, subsystem: 'Glycolysis', operon: 'eno',
    product: 'enolase',
  },
  {
    id: 'b1676', name: 'pykF', start: 1753966, end: 1755381, strand: '+',
    essential: false, subsystem: 'Glycolysis', operon: 'pykF-pphA',
    product: 'pyruvate kinase I',
  },
  {
    id: 'b1854', name: 'pykA', start: 1937837, end: 1939288, strand: '+',
    essential: false, subsystem: 'Glycolysis', operon: 'pykA',
    product: 'pyruvate kinase II',
  },
  {
    id: 'b3916', name: 'pfkA', start: 4107530, end: 4108486, strand: '+',
    essential: false, subsystem: 'Glycolysis', operon: 'pfkA',
    product: 'phosphofructokinase-1',
  },
  {
    id: 'b1723', name: 'pfkB', start: 1806218, end: 1807186, strand: '+',
    essential: false, subsystem: 'Glycolysis', operon: 'pfkB',
    product: 'phosphofructokinase-2',
  },
  {
    id: 'b2416', name: 'pgk', start: 2535619, end: 2536812, strand: '+',
    essential: true, subsystem: 'Glycolysis', operon: 'pgk',
    product: 'phosphoglycerate kinase',
  },
  {
    id: 'b3732', name: 'tpiA', start: 3914098, end: 3914859, strand: '+',
    essential: true, subsystem: 'Glycolysis', operon: 'tpiA',
    product: 'triose-phosphate isomerase',
  },
  {
    id: 'b2925', name: 'fbaA', start: 3069927, end: 3070970, strand: '+',
    essential: false, subsystem: 'Glycolysis', operon: 'fbaA',
    product: 'fructose-bisphosphate aldolase class II',
  },
  {
    id: 'b2097', name: 'pgi', start: 2189044, end: 2190702, strand: '+',
    essential: false, subsystem: 'Glycolysis', operon: 'pgi',
    product: 'glucose-6-phosphate isomerase',
  },

  // ── TCA Cycle ─────────────────────────────────────────────────────────
  {
    id: 'b0720', name: 'gltA', start: 752168, end: 753505, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'gltA',
    product: 'citrate synthase',
  },
  {
    id: 'b0721', name: 'acnA', start: 753756, end: 756389, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'acnA',
    product: 'aconitate hydratase 1',
  },
  {
    id: 'b1281', name: 'acnB', start: 1346112, end: 1348793, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'acnB',
    product: 'aconitate hydratase 2',
  },
  {
    id: 'b0116', name: 'icdA', start: 119046, end: 120257, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'icdA',
    product: 'isocitrate dehydrogenase',
  },
  {
    id: 'b0118', name: 'sucA', start: 120844, end: 124032, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'sucAB',
    product: '2-oxoglutarate dehydrogenase E1',
  },
  {
    id: 'b0726', name: 'sucC', start: 759275, end: 760426, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'sucCD',
    product: 'succinyl-CoA synthetase beta',
  },
  {
    id: 'b0727', name: 'sucD', start: 760438, end: 761319, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'sucCD',
    product: 'succinyl-CoA synthetase alpha',
  },
  {
    id: 'b0723', name: 'sdhA', start: 756542, end: 758311, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'sdhCDAB',
    product: 'succinate dehydrogenase flavoprotein',
  },
  {
    id: 'b0724', name: 'sdhB', start: 758338, end: 759111, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'sdhCDAB',
    product: 'succinate dehydrogenase iron-sulfur',
  },
  {
    id: 'b0722', name: 'sdhC', start: 755820, end: 756545, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'sdhCDAB',
    product: 'succinate dehydrogenase cytochrome b556',
  },
  {
    id: 'b0729', name: 'fumA', start: 763177, end: 764883, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'fumA',
    product: 'fumarase A',
  },
  {
    id: 'b1611', name: 'mdh', start: 1691433, end: 1692401, strand: '+',
    essential: false, subsystem: 'TCA', operon: 'mdh',
    product: 'malate dehydrogenase',
  },

  // ── Pentose Phosphate Pathway ─────────────────────────────────────────
  {
    id: 'b1852', name: 'zwf', start: 1935234, end: 1936763, strand: '+',
    essential: false, subsystem: 'PPP', operon: 'zwf',
    product: 'glucose-6-phosphate 1-dehydrogenase',
  },
  {
    id: 'b2008', name: 'gnd', start: 2095425, end: 2096849, strand: '+',
    essential: false, subsystem: 'PPP', operon: 'gnd',
    product: '6-phosphogluconate dehydrogenase',
  },
  {
    id: 'b2913', name: 'rpe', start: 3055256, end: 3055924, strand: '+',
    essential: false, subsystem: 'PPP', operon: 'rpe',
    product: 'ribulose-5-phosphate 3-epimerase',
  },
  {
    id: 'b4090', name: 'rpiA', start: 4303912, end: 4304475, strand: '+',
    essential: false, subsystem: 'PPP', operon: 'rpiA',
    product: 'ribose-5-phosphate isomerase A',
  },
  {
    id: 'b0008', name: 'talB', start: 8649, end: 9821, strand: '+',
    essential: false, subsystem: 'PPP', operon: 'talB',
    product: 'transaldolase B',
  },
  {
    id: 'b2464', name: 'tktA', start: 2583695, end: 2585686, strand: '+',
    essential: false, subsystem: 'PPP', operon: 'tktA',
    product: 'transketolase 1',
  },

  // ── Pyruvate Metabolism ───────────────────────────────────────────────
  {
    id: 'b0114', name: 'aceE', start: 116158, end: 119400, strand: '+',
    essential: true, subsystem: 'Pyruvate', operon: 'pdhR-aceEF-lpd',
    product: 'pyruvate dehydrogenase E1',
  },
  {
    id: 'b0115', name: 'aceF', start: 119452, end: 121014, strand: '+',
    essential: true, subsystem: 'Pyruvate', operon: 'pdhR-aceEF-lpd',
    product: 'pyruvate dehydrogenase E2',
  },
  {
    id: 'b0116', name: 'lpd', start: 121278, end: 122678, strand: '+',
    essential: true, subsystem: 'Pyruvate', operon: 'pdhR-aceEF-lpd',
    product: 'dihydrolipoamide dehydrogenase',
  },
  {
    id: 'b0871', name: 'poxB', start: 914305, end: 916056, strand: '+',
    essential: false, subsystem: 'Pyruvate', operon: 'poxB',
    product: 'pyruvate oxidase',
  },

  // ── Fermentation ──────────────────────────────────────────────────────
  {
    id: 'b1380', name: 'ldhA', start: 1440737, end: 1441708, strand: '+',
    essential: false, subsystem: 'Fermentation', operon: 'ldhA',
    product: 'D-lactate dehydrogenase',
  },
  {
    id: 'b2579', name: 'pflB', start: 2708677, end: 2710944, strand: '+',
    essential: false, subsystem: 'Fermentation', operon: 'pflBA',
    product: 'pyruvate formate-lyase',
  },
  {
    id: 'b1478', name: 'adhE', start: 1553237, end: 1555303, strand: '+',
    essential: false, subsystem: 'Fermentation', operon: 'adhE',
    product: 'bifunctional acetaldehyde-CoA/alcohol dehydrogenase',
  },
  {
    id: 'b0351', name: 'pta', start: 365888, end: 368080, strand: '+',
    essential: false, subsystem: 'Fermentation', operon: 'pta-ackA',
    product: 'phosphotransacetylase',
  },
  {
    id: 'b3115', name: 'ackA', start: 3194060, end: 3195259, strand: '+',
    essential: false, subsystem: 'Fermentation', operon: 'ackA',
    product: 'acetate kinase',
  },

  // ── Oxidative Phosphorylation ─────────────────────────────────────────
  {
    id: 'b2276', name: 'nuoA', start: 2411574, end: 2411927, strand: '+',
    essential: false, subsystem: 'OxPhos', operon: 'nuoABCEFGHIJKLMN',
    product: 'NADH dehydrogenase I subunit A',
  },
  {
    id: 'b2277', name: 'nuoB', start: 2411944, end: 2412591, strand: '+',
    essential: false, subsystem: 'OxPhos', operon: 'nuoABCEFGHIJKLMN',
    product: 'NADH dehydrogenase I subunit B',
  },
  {
    id: 'b2288', name: 'nuoN', start: 2422189, end: 2423691, strand: '+',
    essential: false, subsystem: 'OxPhos', operon: 'nuoABCEFGHIJKLMN',
    product: 'NADH dehydrogenase I subunit N',
  },
  {
    id: 'b0432', name: 'cyoA', start: 452677, end: 453546, strand: '+',
    essential: false, subsystem: 'OxPhos', operon: 'cyoABCDE',
    product: 'cytochrome o ubiquinol oxidase subunit II',
  },
  {
    id: 'b0433', name: 'cyoB', start: 453558, end: 455195, strand: '+',
    essential: false, subsystem: 'OxPhos', operon: 'cyoABCDE',
    product: 'cytochrome o ubiquinol oxidase subunit I',
  },

  // ── Acetyl-CoA Metabolism ─────────────────────────────────────────────
  {
    id: 'b3956', name: 'acs', start: 4156520, end: 4158487, strand: '+',
    essential: false, subsystem: 'AcetylCoA', operon: 'acs',
    product: 'acetyl-CoA synthetase',
  },
  {
    id: 'b2296', name: 'ackA', start: 2413863, end: 2415062, strand: '+',
    essential: false, subsystem: 'AcetylCoA', operon: 'ackA',
    product: 'acetate kinase A',
  },
  {
    id: 'b4015', name: 'patA', start: 4218137, end: 4219318, strand: '+',
    essential: false, subsystem: 'AcetylCoA', operon: 'patA',
    product: 'putrescine aminotransferase',
  },

  // ── Essential Genes (commonly targeted) ───────────────────────────────
  {
    id: 'b0002', name: 'thrA', start: 337, end: 2799, strand: '+',
    essential: true, subsystem: 'AminoAcid', operon: 'thrLABC',
    product: 'aspartokinase I / homoserine dehydrogenase I',
  },
  {
    id: 'b0003', name: 'thrB', start: 2801, end: 3733, strand: '+',
    essential: true, subsystem: 'AminoAcid', operon: 'thrLABC',
    product: 'homoserine kinase',
  },
  {
    id: 'b0004', name: 'thrC', start: 3734, end: 5020, strand: '+',
    essential: true, subsystem: 'AminoAcid', operon: 'thrLABC',
    product: 'threonine synthase',
  },
  {
    id: 'b0014', name: 'dnaA', start: 3882140, end: 3883573, strand: '+',
    essential: true, subsystem: 'Replication', operon: 'dnaAN-recF',
    product: 'chromosomal replication initiator',
  },
  {
    id: 'b3729', name: 'dnaK', start: 3910294, end: 3912117, strand: '+',
    essential: true, subsystem: 'Chaperone', operon: 'dnaKJ',
    product: 'chaperone Hsp70',
  },
  {
    id: 'b3988', name: 'ftsZ', start: 418908, end: 420080, strand: '+',
    essential: true, subsystem: 'CellDivision', operon: 'ftsQAZ',
    product: 'cell division protein FtsZ',
  },
  {
    id: 'b3041', name: 'rpoB', start: 3216003, end: 3219632, strand: '+',
    essential: true, subsystem: 'Transcription', operon: 'rpoBC',
    product: 'RNA polymerase beta subunit',
  },
  {
    id: 'b3987', name: 'rpsA', start: 4032068, end: 4033509, strand: '+',
    essential: true, subsystem: 'Translation', operon: 'rpsA',
    product: '30S ribosomal protein S1',
  },

  // ── Common CRISPRi Targets (from Rousset et al. 2018) ────────────────
  {
    id: 'b4025', name: 'ppsA', start: 4230304, end: 4233000, strand: '+',
    essential: false, subsystem: 'Gluconeogenesis', operon: 'ppsA',
    product: 'phosphoenolpyruvate synthase',
  },
  {
    id: 'b3117', name: 'pck', start: 3197364, end: 3198941, strand: '+',
    essential: false, subsystem: 'Gluconeogenesis', operon: 'pck',
    product: 'phosphoenolpyruvate carboxykinase',
  },
  {
    id: 'b3603', name: 'pntAB', start: 3777728, end: 3779220, strand: '+',
    essential: false, subsystem: 'Cofactor', operon: 'pntAB',
    product: 'transhydrogenase subunit alpha',
  },
  {
    id: 'b3604', name: 'pntB', start: 3779232, end: 3780665, strand: '+',
    essential: false, subsystem: 'Cofactor', operon: 'pntAB',
    product: 'transhydrogenase subunit beta',
  },
  {
    id: 'b3962', name: 'pyrI', start: 4161066, end: 4161521, strand: '+',
    essential: false, subsystem: 'Nucleotide', operon: 'pyrBI',
    product: 'aspartate carbamoyltransferase regulatory',
  },
  {
    id: 'b0002', name: 'thrA', start: 337, end: 2799, strand: '+',
    essential: true, subsystem: 'AminoAcid', operon: 'thrLABC',
    product: 'bifunctional aspartokinase I / homoserine dehydrogenase I',
  },

  // ── Amino Acid Biosynthesis ───────────────────────────────────────────
  {
    id: 'b2614', name: 'aroH', start: 2741367, end: 2742437, strand: '+',
    essential: false, subsystem: 'AminoAcid', operon: 'aroH',
    product: 'phospho-2-dehydro-3-deoxyheptonate aldolase',
  },
  {
    id: 'b3772', name: 'trpA', start: 3953709, end: 3954482, strand: '+',
    essential: false, subsystem: 'AminoAcid', operon: 'trpLEDCBA',
    product: 'tryptophan synthase alpha',
  },
  {
    id: 'b3771', name: 'trpB', start: 3954494, end: 3955690, strand: '+',
    essential: false, subsystem: 'AminoAcid', operon: 'trpLEDCBA',
    product: 'tryptophan synthase beta',
  },
  {
    id: 'b4254', name: 'tyrA', start: 4476810, end: 4477877, strand: '+',
    essential: false, subsystem: 'AminoAcid', operon: 'tyrA',
    product: 'prephenate dehydrogenase',
  },
  {
    id: 'b1704', name: 'hisG', start: 1787092, end: 1787961, strand: '+',
    essential: false, subsystem: 'AminoAcid', operon: 'hisLGDCBHAFI',
    product: 'ATP phosphoribosyltransferase',
  },

  // ── Lipid / Membrane ──────────────────────────────────────────────────
  {
    id: 'b1091', name: 'lpxA', start: 1155383, end: 1156126, strand: '+',
    essential: true, subsystem: 'Lipid', operon: 'lpxD-fabZ-lpxA',
    product: 'UDP-N-acetylglucosamine acyltransferase',
  },
  {
    id: 'b0179', name: 'fabB', start: 191793, end: 193037, strand: '+',
    essential: true, subsystem: 'Lipid', operon: 'fabB',
    product: '3-oxoacyl-ACP synthase I',
  },
  {
    id: 'b1095', name: 'fabI', start: 1161084, end: 1161836, strand: '+',
    essential: true, subsystem: 'Lipid', operon: 'fabI',
    product: 'enoyl-ACP reductase',
  },
];

/**
 * Operon definitions — groups of co-transcribed genes.
 * Source: EcoCyc / RegulonDB.
 */
export const ECOLI_K12_OPERONS: Record<string, string[]> = {
  'thrLABC': ['b0001', 'b0002', 'b0003', 'b0004'],
  'pdhR-aceEF-lpd': ['b0113', 'b0114', 'b0115', 'b0116'],
  'sucAB': ['b0118', 'b0726'],
  'sucCD': ['b0726', 'b0727'],
  'sdhCDAB': ['b0722', 'b0723', 'b0724'],
  'nuoABCEFGHIJKLMN': ['b2276', 'b2277', 'b2288'],
  'cyoABCDE': ['b0432', 'b0433'],
  'gapA': ['b1779'],
  'eno': ['b2779'],
  'pykF-pphA': ['b1676'],
  'dnaAN-recF': ['b0014'],
  'dnaKJ': ['b3729'],
  'rpoBC': ['b3041'],
  'ftsQAZ': ['b3988'],
  'pntAB': ['b3603', 'b3604'],
  'trpLEDCBA': ['b3772', 'b3771'],
  'hisLGDCBHAFI': ['b1704'],
  'lpxD-fabZ-lpxA': ['b1091'],
};

/**
 * Get genes by subsystem.
 */
export function getGenesBySubsystem(subsystem: string): GeneAnnotation[] {
  return ECOLI_K12_GENES.filter(g => g.subsystem === subsystem);
}

/**
 * Get all essential genes.
 */
export function getEssentialGenes(): GeneAnnotation[] {
  return ECOLI_K12_GENES.filter(g => g.essential);
}

/**
 * Get genes in a genomic region.
 */
export function getGenesInRegion(start: number, end: number): GeneAnnotation[] {
  return ECOLI_K12_GENES.filter(g => g.start < end && g.end > start);
}

/**
 * Get all unique subsystems.
 */
export function getSubsystems(): string[] {
  return [...new Set(ECOLI_K12_GENES.map(g => g.subsystem))].sort();
}
