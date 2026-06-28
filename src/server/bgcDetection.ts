/**
 * Biosynthetic Gene Cluster (BGC) Detection
 *
 * AntiSMASH-style detection of biosynthetic gene clusters in genomic sequences.
 * BGCs are clusters of genes that work together to produce secondary metabolites
 * (natural products) like antibiotics, antifungals, and anticancer agents.
 *
 * This module implements a simplified version of the antiSMASH algorithm for
 * detecting common BGC types:
 * - NRPS (Non-Ribosomal Peptide Synthetase)
 * - PKS (Polyketide Synthase)
 * - Terpene
 * - RiPP (Ribosomally synthesized and Post-translationally modified Peptides)
 * - Siderophore
 * - Lantipeptide
 *
 * Reference:
 *   Blin K, et al. (2021)
 *   antiSMASH 6.0: improving cluster detection and comparison.
 *   Nucleic Acids Res. 49(W1):W29-W35. doi:10.1093/nar/gkab335
 *
 * @scientific_provenance
 *   ALGORITHM: Hidden Markov Model (HMM) profile matching
 *   REFERENCE: antiSMASH 6.0 (Blin et al., 2021)
 *   DATABASE: MIBiG (Minimum Information about a Biosynthetic Gene Cluster)
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface Gene {
  id: string;
  start: number;
  end: number;
  strand: '+' | '-';
  sequence?: string;
  annotation?: string;
}

export interface BGCRegion {
  id: string;
  type: BGCType;
  start: number;
  end: number;
  genes: Gene[];
  coreGenes: Gene[];
  score: number;
  products: string[];
  mibigHits: MIBiGHit[];
}

export type BGCType =
  | 'NRPS'
  | 'PKS'
  | 'NRPS-PKS'
  | 'terpene'
  | 'RiPP'
  | 'siderophore'
  | 'lantipeptide'
  | 'ectoine'
  | 'butyrolactone'
  | 'other';

export interface MIBiGHit {
  accession: string;
  name: string;
  similarity: number;
  type: BGCType;
}

export interface BGCDetectionResult {
  regions: BGCRegion[];
  totalGenes: number;
  genesInClusters: number;
  summary: Record<BGCType, number>;
}

// ── Domain Profiles (simplified HMM-like scoring) ──────────────────────

interface DomainProfile {
  name: string;
  type: BGCType;
  keywords: string[];
  minLength: number;
  maxLength: number;
  weight: number;
}

const DOMAIN_PROFILES: DomainProfile[] = [
  // NRPS domains
  { name: 'AMP-binding', type: 'NRPS', keywords: ['AMP-binding', 'adenylation', 'A-domain'], minLength: 400, maxLength: 600, weight: 1.0 },
  { name: 'PCP', type: 'NRPS', keywords: ['PCP', 'peptidyl-carrier', 'T-domain'], minLength: 80, maxLength: 120, weight: 0.8 },
  { name: 'C-domain', type: 'NRPS', keywords: ['condensation', 'C-domain'], minLength: 400, maxLength: 500, weight: 0.9 },
  { name: 'TE-domain', type: 'NRPS', keywords: ['thioesterase', 'TE-domain'], minLength: 250, maxLength: 350, weight: 0.7 },
  { name: 'E-domain', type: 'NRPS', keywords: ['epimerization', 'E-domain'], minLength: 400, maxLength: 500, weight: 0.6 },

  // PKS domains
  { name: 'KS', type: 'PKS', keywords: ['ketosynthase', 'KS-domain', 'beta-ketoacyl'], minLength: 400, maxLength: 500, weight: 1.0 },
  { name: 'AT', type: 'PKS', keywords: ['acyltransferase', 'AT-domain', 'malonyl'], minLength: 300, maxLength: 400, weight: 0.9 },
  { name: 'ACP', type: 'PKS', keywords: ['ACP', 'acyl-carrier'], minLength: 80, maxLength: 120, weight: 0.8 },
  { name: 'KR', type: 'PKS', keywords: ['ketoreductase', 'KR-domain'], minLength: 200, maxLength: 300, weight: 0.6 },
  { name: 'DH', type: 'PKS', keywords: ['dehydratase', 'DH-domain'], minLength: 150, maxLength: 250, weight: 0.5 },
  { name: 'ER', type: 'PKS', keywords: ['enoylreductase', 'ER-domain'], minLength: 300, maxLength: 400, weight: 0.5 },
  { name: 'TE', type: 'PKS', keywords: ['thioesterase', 'TE-domain'], minLength: 250, maxLength: 350, weight: 0.7 },

  // Terpene
  { name: 'TPS', type: 'terpene', keywords: ['terpene_synthase', 'TPS', 'cyclase'], minLength: 300, maxLength: 800, weight: 1.0 },
  { name: 'GGPPS', type: 'terpene', keywords: ['GGPPS', 'geranylgeranyl'], minLength: 300, maxLength: 400, weight: 0.8 },
  { name: 'FPPS', type: 'terpene', keywords: ['FPPS', 'farnesyl'], minLength: 250, maxLength: 350, weight: 0.7 },

  // RiPP
  { name: 'Lant_dehydr', type: 'lantipeptide', keywords: ['lant_dehydr', 'LanM', 'dehydratase'], minLength: 800, maxLength: 1200, weight: 1.0 },
  { name: 'Lant_cycl', type: 'lantipeptide', keywords: ['LanC', 'cyclase'], minLength: 300, maxLength: 400, weight: 0.9 },
  { name: 'Bottromycin', type: 'RiPP', keywords: ['bottromycin', 'MbtH'], minLength: 100, maxLength: 200, weight: 0.8 },
  { name: 'Thiopeptide', type: 'RiPP', keywords: ['thiopeptide', 'YcaO'], minLength: 300, maxLength: 500, weight: 0.8 },

  // Siderophore
  { name: 'IucA', type: 'siderophore', keywords: ['IucA', 'IucC', 'siderophore'], minLength: 400, maxLength: 600, weight: 1.0 },
  { name: 'NRPS-like', type: 'siderophore', keywords: ['NRPS-like', 'siderophore'], minLength: 300, maxLength: 500, weight: 0.7 },
];

// ── Detection Algorithm ────────────────────────────────────────────────

/**
 * Detect biosynthetic gene clusters in a genomic region.
 *
 * @param genes - Genes in the genomic region
 * @param upstreamBp - Base pairs upstream to search (default: 20000)
 * @param downstreamBp - Base pairs downstream to search (default: 20000)
 * @returns Detection results with identified BGCs
 */
export function detectBGCs(
  genes: Gene[],
  upstreamBp: number = 20000,
  downstreamBp: number = 20000,
): BGCDetectionResult {
  if (genes.length === 0) {
    return {
      regions: [],
      totalGenes: 0,
      genesInClusters: 0,
      summary: {} as Record<BGCType, number>,
    };
  }

  // Step 1: Score each gene for BGC-related domains
  const geneScores = genes.map(gene => scoreGene(gene));

  // Step 2: Identify high-scoring genes as potential core genes
  const coreGenes = geneScores
    .filter(gs => gs.score >= 0.7)
    .map(gs => gs.gene);

  if (coreGenes.length === 0) {
    return {
      regions: [],
      totalGenes: genes.length,
      genesInClusters: 0,
      summary: {} as Record<BGCType, number>,
    };
  }

  // Step 3: Cluster nearby core genes into regions
  const regions = clusterGenesIntoRegions(genes, coreGenes, geneScores, upstreamBp, downstreamBp);

  // Step 4: Classify each region by BGC type
  const classifiedRegions = regions.map(region => classifyRegion(region, geneScores));

  // Step 5: Build summary
  const summary: Record<string, number> = {};
  let genesInClusters = 0;

  for (const region of classifiedRegions) {
    summary[region.type] = (summary[region.type] ?? 0) + 1;
    genesInClusters += region.genes.length;
  }

  return {
    regions: classifiedRegions,
    totalGenes: genes.length,
    genesInClusters,
    summary: summary as Record<BGCType, number>,
  };
}

// ── Gene Scoring ───────────────────────────────────────────────────────

interface GeneScore {
  gene: Gene;
  score: number;
  domains: string[];
  bestType: BGCType;
}

function scoreGene(gene: Gene): GeneScore {
  const annotation = (gene.annotation ?? '').toLowerCase();
  const sequence = gene.sequence ?? '';

  let bestScore = 0;
  let bestType: BGCType = 'other';
  const domains: string[] = [];

  for (const profile of DOMAIN_PROFILES) {
    // Check annotation keywords
    const keywordMatch = profile.keywords.some(kw => annotation.includes(kw.toLowerCase()));

    // Check sequence length (rough proxy for domain presence)
    const lengthMatch = sequence.length >= profile.minLength && sequence.length <= profile.maxLength;

    if (keywordMatch) {
      const score = profile.weight;
      if (score > bestScore) {
        bestScore = score;
        bestType = profile.type;
      }
      domains.push(profile.name);
    } else if (lengthMatch && annotation.length > 0) {
      // Partial match based on length alone
      const score = profile.weight * 0.3;
      if (score > bestScore) {
        bestScore = score;
        bestType = profile.type;
      }
    }
  }

  return {
    gene,
    score: bestScore,
    domains,
    bestType,
  };
}

// ── Region Clustering ──────────────────────────────────────────────────

function clusterGenesIntoRegions(
  allGenes: Gene[],
  coreGenes: Gene[],
  geneScores: GeneScore[],
  upstreamBp: number,
  downstreamBp: number,
): Array<{ genes: Gene[]; coreGenes: Gene[]; start: number; end: number }> {
  // Sort core genes by position
  const sortedCore = [...coreGenes].sort((a, b) => a.start - b.start);

  const regions: Array<{ genes: Gene[]; coreGenes: Gene[]; start: number; end: number }> = [];
  let currentRegion: { genes: Gene[]; coreGenes: Gene[]; start: number; end: number } | null = null;

  for (const coreGene of sortedCore) {
    if (!currentRegion) {
      // Start new region
      currentRegion = {
        genes: [coreGene],
        coreGenes: [coreGene],
        start: coreGene.start - upstreamBp,
        end: coreGene.end + downstreamBp,
      };
    } else if (coreGene.start <= currentRegion.end + downstreamBp) {
      // Extend current region
      currentRegion.coreGenes.push(coreGene);
      currentRegion.end = Math.max(currentRegion.end, coreGene.end + downstreamBp);
    } else {
      // Gap too large — finalize current region and start new one
      regions.push(currentRegion);
      currentRegion = {
        genes: [coreGene],
        coreGenes: [coreGene],
        start: coreGene.start - upstreamBp,
        end: coreGene.end + downstreamBp,
      };
    }
  }

  if (currentRegion) {
    regions.push(currentRegion);
  }

  // Add all genes within each region's boundaries
  for (const region of regions) {
    region.genes = allGenes.filter(
      g => g.start >= region.start && g.end <= region.end
    );
  }

  return regions;
}

// ── Region Classification ──────────────────────────────────────────────

function classifyRegion(
  region: { genes: Gene[]; coreGenes: Gene[]; start: number; end: number },
  geneScores: GeneScore[],
): BGCRegion {
  // Count domain types in the region
  const typeCounts: Record<string, number> = {};
  const allDomains: string[] = [];

  for (const coreGene of region.coreGenes) {
    const gs = geneScores.find(g => g.gene.id === coreGene.id);
    if (gs) {
      typeCounts[gs.bestType] = (typeCounts[gs.bestType] ?? 0) + 1;
      allDomains.push(...gs.domains);
    }
  }

  // Determine primary type
  let primaryType: BGCType = 'other';
  let maxCount = 0;

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryType = type as BGCType;
    }
  }

  // Handle mixed NRPS-PKS clusters
  if (typeCounts['NRPS'] && typeCounts['PKS']) {
    primaryType = 'NRPS-PKS';
  }

  // Calculate score based on number of core genes and domain matches
  const score = Math.min(1.0, region.coreGenes.length * 0.3 + allDomains.length * 0.1);

  // Predict products
  const products = predictProducts(primaryType, allDomains);

  // Mock MIBiG hits (in production, this would query the MIBiG database)
  const mibigHits: MIBiGHit[] = [];

  return {
    id: `BGC_${region.start}_${region.end}`,
    type: primaryType,
    start: region.start,
    end: region.end,
    genes: region.genes,
    coreGenes: region.coreGenes,
    score,
    products,
    mibigHits,
  };
}

// ── Product Prediction ─────────────────────────────────────────────────

function predictProducts(type: BGCType, domains: string[]): string[] {
  const products: string[] = [];

  switch (type) {
    case 'NRPS':
      products.push('non-ribosomal peptide');
      if (domains.includes('TE-domain')) products.push('cyclic peptide');
      break;
    case 'PKS':
      products.push('polyketide');
      if (domains.includes('KR') || domains.includes('DH')) products.push('reduced polyketide');
      break;
    case 'NRPS-PKS':
      products.push('hybrid NRPS-PKS product');
      break;
    case 'terpene':
      products.push('terpenoid');
      if (domains.includes('TPS')) products.push('sesquiterpene');
      break;
    case 'lantipeptide':
      products.push('lantibiotic');
      break;
    case 'RiPP':
      products.push('ribosomal peptide');
      break;
    case 'siderophore':
      products.push('siderophore');
      break;
    default:
      products.push('unknown secondary metabolite');
  }

  return products;
}

// ── Utility Functions ──────────────────────────────────────────────────

/**
 * Get BGC type description for display.
 */
export function getBGCTypeDescription(type: BGCType): string {
  const descriptions: Record<BGCType, string> = {
    'NRPS': 'Non-Ribosomal Peptide Synthetase — produces peptides without ribosomes',
    'PKS': 'Polyketide Synthase — produces polyketides (antibiotics, antifungals)',
    'NRPS-PKS': 'Hybrid NRPS-PKS cluster — produces complex natural products',
    'terpene': 'Terpene cluster — produces terpenoids (fragrances, drugs)',
    'RiPP': 'Ribosomally synthesized Peptide — post-translationally modified',
    'siderophore': 'Siderophore cluster — iron-chelating compounds',
    'lantipeptide': 'Lantipeptide cluster — lanthionine-containing peptides',
    'ectoine': 'Ectoine cluster — osmoprotectant',
    'butyrolactone': 'Butyrolactone cluster — signaling molecules',
    'other': 'Other biosynthetic cluster',
  };
  return descriptions[type] ?? 'Unknown cluster type';
}

/**
 * Get common examples of natural products for each BGC type.
 */
export function getBGCTypeExamples(type: BGCType): string[] {
  const examples: Record<BGCType, string[]> = {
    'NRPS': ['Vancomycin', 'Daptomycin', 'Cyclosporin A'],
    'PKS': ['Erythromycin', 'Rapamycin', 'Lovastatin'],
    'NRPS-PKS': ['Bleomycin', 'Epothilone', 'Calicheamicin'],
    'terpene': ['Artemisinin', 'Taxol', 'Carotenoids'],
    'RiPP': ['Nisin', 'Thuricin', 'Plantazolicin'],
    'siderophore': ['Enterobactin', 'Pyoverdine', 'Desferrioxamine'],
    'lantipeptide': ['Nisin', 'Mersacidin', 'Lacticin'],
    'ectoine': ['Ectoine', 'Hydroxyectoine'],
    'butyrolactone': ['A-factor', 'SCB1'],
    'other': ['Various'],
  };
  return examples[type] ?? [];
}
