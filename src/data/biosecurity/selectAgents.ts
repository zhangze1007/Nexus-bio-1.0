/**
 * Select Agent Database
 *
 * Representative gene sequences from CDC/USDA select agents and toxins.
 * Sequences are short conserved gene fragments (50-80 bp) from publicly
 * available NCBI GenBank accessions, sufficient for identity-based screening.
 *
 * References:
 *   - 42 CFR Part 73 (HHS Select Agents and Toxins)
 *   - 9 CFR Part 121 (USDA/APHIS Select Agents and Toxins)
 *   - CDC National Select Agent Registry (selectagents.gov)
 *
 * This is NOT an exhaustive genome database. It provides representative
 * conserved gene fragments for identity-based screening with sliding window
 * alignment. Production deployments should supplement with full genome DBs.
 */

export interface SelectAgentEntry {
  /** Unique identifier for this entry */
  id: string;
  /** Scientific organism name */
  organism: string;
  /** Common name for quick reference */
  commonName: string;
  /** Gene or toxin target */
  gene: string;
  /** Representative DNA sequence (uppercase, ACGT only) */
  sequence: string;
  /** Applicable regulation (HHS, USDA, or both) */
  regulation: "HHS" | "USDA" | "HHS+USDA";
  /** Risk group classification */
  riskGroup: 3 | 4;
  /** NCBI GenBank accession for provenance */
  accession: string;
}

/**
 * CDC/USDA Select Agent Representative Sequences
 *
 * Each entry contains a 50-80 bp conserved gene fragment characteristic
 * of the listed select agent organism.
 */
export const SELECT_AGENTS: SelectAgentEntry[] = [
  // ── Tier 1 / HHS Select Agents ────────────────────────────────
  {
    id: "ba-paga-001",
    organism: "Bacillus anthracis",
    commonName: "Anthrax",
    gene: "protective antigen (pagA)",
    sequence: "ATGGCTGATGTTCAAAACGAATCCTAAATGATGAAAGAAGTTCACATGGAAGTGATCA" + "AGAAAAACGTGATTTAGTAGGTGAT",
    regulation: "HHS+USDA",
    riskGroup: 3,
    accession: "M22589.1",
  },
  {
    id: "ba-lef-002",
    organism: "Bacillus anthracis",
    commonName: "Anthrax",
    gene: "lethal factor (lef)",
    sequence: "ATGAAGATTTATCAATTAGAACAATCAAGAGAAGTATCTTCTGATGAAATCGAATCTG" + "AATTTAATAACATCATGGCTGATAAA",
    regulation: "HHS+USDA",
    riskGroup: 3,
    accession: "M29080.1",
  },
  {
    id: "yp-pla-001",
    organism: "Yersinia pestis",
    commonName: "Plague",
    gene: "plasminogen activator (pla)",
    sequence: "ATGAAAGCGTTTTCTATCAGTCTGATTGTTGGTCTATTTGCTACCGGATTAGCATTTA" + "ATGCATTTAAAAAAGCGCAGGAT",
    regulation: "HHS+USDA",
    riskGroup: 3,
    accession: "X16453.1",
  },
  {
    id: "ft-tul4-001",
    organism: "Francisella tularensis",
    commonName: "Tularemia",
    gene: "outer membrane protein (tul4)",
    sequence: "ATGGCTAGTAAAATCGCAGTAATCTTACTAACCAGTTTATTAGCCTGCGCAGGCTTTA" + "CTTGCGCAGTAGAAAAA",
    regulation: "HHS+USDA",
    riskGroup: 3,
    accession: "M32059.1",
  },
  {
    id: "ebola-np-001",
    organism: "Zaire ebolavirus",
    commonName: "Ebola",
    gene: "nucleoprotein (NP)",
    sequence: "ATGTATCAAACTATCGGCAAAAGGCGGAACAATTCTGACATCTAGATCAGAAACAGGA" + "TATCTAAGGATCATGGCAGAAAAA",
    regulation: "HHS",
    riskGroup: 4,
    accession: "AF086833.2",
  },
  {
    id: "variola-pol-001",
    organism: "Variola major",
    commonName: "Smallpox",
    gene: "DNA polymerase (E9L)",
    sequence: "ATGGATTTCTTTATAGATGGAACACTAATGTTACCAGAATCTCAAAACGAATTTGCTA" + "AATATTTAGATAAAGTAGTTAAT",
    regulation: "HHS",
    riskGroup: 4,
    accession: "L22579.1",
  },
  {
    id: "cb-bont-a-001",
    organism: "Clostridium botulinum",
    commonName: "Botulism",
    gene: "botulinum neurotoxin type A (bont/A)",
    sequence: "ATGATAAATATTAATTTATCAAGATTTAATTTAGGAGAATTTAATAATGATGCAAATC" + "AATTTAATGATTTATCTATGGAT",
    regulation: "HHS+USDA",
    riskGroup: 3,
    accession: "M30196.1",
  },
  {
    id: "cb-bont-b-002",
    organism: "Clostridium botulinum",
    commonName: "Botulism",
    gene: "botulinum neurotoxin type B (bont/B)",
    sequence: "ATGTTAATTAATAATAATATTTTAGATAATTTAAATCAAGAATTTTTTATTAATACAG" + "ATAGTGATAATGAAACATTTTCT",
    regulation: "HHS+USDA",
    riskGroup: 3,
    accession: "X71343.1",
  },
  {
    id: "bp-t3ss-001",
    organism: "Burkholderia pseudomallei",
    commonName: "Melioidosis",
    gene: "type III secretion system (bsaZ)",
    sequence: "ATGAATAAAGCAATTTTGGCCTTGTCAGCGAGCCTGCTGGCAGGAACAGCCTTCTTGC" + "AAGAAGCAATTCAGGCGCTG",
    regulation: "HHS",
    riskGroup: 3,
    accession: "AF191536.1",
  },
  {
    id: "cjb-cia-001",
    organism: "Coxiella burnetii",
    commonName: "Q fever",
    gene: "com1 surface antigen",
    sequence: "ATGACTAAACGCTTAATTTCATCAGTTGTTTCAGCTTTATTGGCAGGAATTTTATCAG" + "CATTATCAGAGAAT",
    regulation: "HHS",
    riskGroup: 3,
    accession: "M80680.1",
  },

  // ── USDA Select Agents (agricultural) ──────────────────────────
  {
    id: "fv-fmd-001",
    organism: "Foot-and-mouth disease virus",
    commonName: "FMD",
    gene: "VP1 capsid protein",
    sequence: "ATGGGAGCAGGACACAGCTTCACTGGAACATGCGACCTCCTTCTACAGGCCCTGGCGG" + "GGCCTACCTTCAACCTGTGTGAC",
    regulation: "USDA",
    riskGroup: 3,
    accession: "AY593763.1",
  },
  {
    id: "rp-001",
    organism: "Rickettsia prowazekii",
    commonName: "Epidemic typhus",
    gene: "outer membrane protein B (ompB)",
    sequence: "ATGAAACATATTATCGTTAATGATAACGGACGCTTTGAATCTACTGTTGATGCTTCAA" + "ACTTAACTAATATGACTAAAGAT",
    regulation: "HHS",
    riskGroup: 3,
    accession: "U27499.1",
  },
  {
    id: "marburg-vp35-001",
    organism: "Marburg marburgvirus",
    commonName: "Marburg virus",
    gene: "VP35 interferon antagonist",
    sequence: "ATGGCTTCAATTTTAGAAGATGACCTAGGAGAAAACTGCTTTATAAATTTAGGAATCA" + "ATCAGAAGAATAGAGCACTA",
    regulation: "HHS",
    riskGroup: 4,
    accession: "DQ217792.1",
  },
];

/**
 * Get the set of unique organism names in the database.
 */
export function getSelectAgentOrganisms(): string[] {
  return [...new Set(SELECT_AGENTS.map((e) => e.organism))];
}

/**
 * Get all entries for a specific organism.
 */
export function getEntriesForOrganism(organism: string): SelectAgentEntry[] {
  return SELECT_AGENTS.filter((e) => e.organism === organism);
}
