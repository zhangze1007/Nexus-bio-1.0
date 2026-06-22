export type InputType = 'DOI' | 'STRAIN' | 'MOLECULE' | 'METRIC' | 'FREEFORM';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type ValidityClass = 'COMPUTATIONAL' | 'AI_ASSISTED';

export interface ParseResult {
  type: InputType;
  confidence: ConfidenceLevel;
  displayLabel: string;
  routeTo: string;
  toolChainDescription: string;
  validityClass: ValidityClass;
  rawInput: string;
}

const KNOWN_STRAINS: Record<string, string> = {
  'e. coli': 'E. coli',
  'escherichia coli': 'E. coli',
  'e.coli': 'E. coli',
  's. cerevisiae': 'S. cerevisiae',
  'saccharomyces cerevisiae': 'S. cerevisiae',
  'b. subtilis': 'B. subtilis',
  'bacillus subtilis': 'B. subtilis',
  'c. glutamicum': 'C. glutamicum',
  'corynebacterium glutamicum': 'C. glutamicum',
  'p. putida': 'P. putida',
  'pseudomonas putida': 'P. putida',
  'y. lipolytica': 'Y. lipolytica',
  'yarrowia lipolytica': 'Y. lipolytica',
  'k-12': 'E. coli K-12',
  'bl21': 'E. coli BL21',
  'dh5': 'E. coli DH5α',
  'mg1655': 'E. coli MG1655',
};

const KNOWN_MOLECULES: string[] = [
  // Terpenoids
  'artemisinin', 'lycopene', 'beta-carotene', 'taxol', 'limonene',
  'linalool', 'geraniol', 'farnesol', 'squalene', 'astaxanthin',
  // Amino acids
  'lysine', 'threonine', 'valine', 'leucine', 'tryptophan',
  'phenylalanine', 'tyrosine', 'glutamate', 'glutamine',
  // Organic acids
  'succinic acid', 'itaconic acid', 'lactic acid', 'gluconic acid',
  '3-hydroxypropionic acid', '3-hp', 'muconic acid',
  'adipic acid', 'glucaric acid',
  // Alcohols
  'ethanol', 'butanol', '1-butanol', '2,3-butanediol', 'isobutanol',
  'isopropanol', 'xylitol', 'sorbitol', 'mannitol', 'erythritol',
  '1,3-propanediol',
  // Terpenes / platform chemicals
  'isoprene', 'farnesene', 'p-coumaric acid', 'naringenin',
  'resveratrol', 'violacein', 'indigoidine', 'acetoin',
  // Antibiotics
  'erythromycin', 'FK506', 'rapamycin', 'tetracycline', 'avermectin',
  // Vitamins / cofactors
  'riboflavin', 'cobalamin', 'folic acid', 'menaquinone',
  // Sugars
  'trehalose',
  // Biosurfactants
  'rhamnolipid', 'surfactin', 'sophorolipid',
  // Pigments
  'prodigiosin', 'phycocyanin', 'phytoene', 'zeaxanthin',
  // Fatty acids / lipids
  'EPA', 'DHA', 'oleic acid', 'palmitic acid',
  // Alkaloids
  'berberine', 'caffeine', 'morphine', 'codeine', 'camptothecin',
  // Biopolymers
  'PHA', 'PHB', 'PHBV',
];

/** Pattern-based molecule inference (MEDIUM confidence — heuristic, not exact) */
const MOLECULE_PATTERNS: RegExp[] = [
  /\b\w{4,}ol\b/i,           // alcohols: hexanol, methanol, propanol
  /\b\w{4,}ene\b/i,          // alkenes/terpenes: butene, myrcene
  /\b\w{4,}in(e)?\b/i,       // alkaloids/compounds: caffeine, artemisinin
  /\b\w+\s+acid\b/i,         // organic acids: adipic acid
  /\b\w{4,}ose\b/i,          // sugars: glucose, fructose, xylose
  /\b(terpene|terpenoid|flavonoid|alkaloid|polyketide|carotenoid|sterol|coenzyme|vitamin\s+[a-z0-9]+)\b/i,
  /\b(PHA|PHB|PHBV|rhamnolipid|surfactin|sophorolipid)\b/i,
];

const DOI_PATTERN = /^10\.\d{4,9}\/\S+/;
const METRIC_PATTERN = /(\d+(\.\d+)?)\s*(%|fold|g\/[lL]|mg\/[lL]|x|percent)/i;
const METRIC_KEYWORDS = /(improve|increase|boost|yield|titer|optimize|production|enhance)/i;

/**
 * Get autocomplete suggestions for a partial input.
 * Returns matching molecules and strains from the known lists.
 */
export function getSmartSuggestions(partial: string): string[] {
  const lower = partial.toLowerCase().trim();
  if (lower.length < 2) return [];

  const suggestions: string[] = [];

  // Match molecules
  for (const m of KNOWN_MOLECULES) {
    if (m.toLowerCase().startsWith(lower) || m.toLowerCase().includes(lower)) {
      suggestions.push(m.charAt(0).toUpperCase() + m.slice(1));
    }
  }

  // Match strains
  for (const [, displayName] of Object.entries(KNOWN_STRAINS)) {
    if (displayName.toLowerCase().startsWith(lower) || displayName.toLowerCase().includes(lower)) {
      if (!suggestions.includes(displayName)) suggestions.push(displayName);
    }
  }

  return suggestions.slice(0, 8); // max 8 suggestions
}

export function parseSmartInput(raw: string): ParseResult {
  const input = raw.trim();
  if (!input) throw new Error('Input is empty');

  // Strip https://doi.org/ prefix if present
  const cleaned = input.replace(/^https?:\/\/doi\.org\//, '');

  // Rule 1 — DOI
  if (DOI_PATTERN.test(cleaned)) {
    return {
      type: 'DOI',
      confidence: 'HIGH',
      displayLabel: 'Academic Paper DOI',
      routeTo: `/analyze?mode=paper&doi=${encodeURIComponent(cleaned)}`,
      toolChainDescription: 'Paper analysis → Pathway extraction → Enzyme identification',
      validityClass: 'AI_ASSISTED',
      rawInput: input,
    };
  }

  // Rule 2 — Known strain
  const lowerInput = input.toLowerCase();
  for (const [key, displayName] of Object.entries(KNOWN_STRAINS)) {
    if (lowerInput.includes(key)) {
      return {
        type: 'STRAIN',
        confidence: 'HIGH',
        displayLabel: `Host Strain: ${displayName}`,
        routeTo: `/tools/fbasim?organism=${encodeURIComponent(key)}`,
        toolChainDescription: 'Metabolic model → Flux balance analysis → Target identification',
        validityClass: 'COMPUTATIONAL',
        rawInput: input,
      };
    }
  }

  // Rule 3a — Known molecule (exact match)
  for (const molecule of KNOWN_MOLECULES) {
    if (lowerInput.includes(molecule)) {
      return {
        type: 'MOLECULE',
        confidence: 'HIGH',
        displayLabel: `Target Molecule: ${molecule.charAt(0).toUpperCase() + molecule.slice(1)}`,
        routeTo: `/tools/pathd?target=${encodeURIComponent(molecule)}`,
        toolChainDescription: 'Pathway search → FBA validation → Enzyme design',
        validityClass: 'COMPUTATIONAL',
        rawInput: input,
      };
    }
  }

  // Rule 3b — Pattern-based molecule inference (MEDIUM confidence)
  for (const pattern of MOLECULE_PATTERNS) {
    if (pattern.test(input)) {
      return {
        type: 'MOLECULE',
        confidence: 'MEDIUM',
        displayLabel: 'Target Molecule (inferred)',
        routeTo: `/tools/pathd?target=${encodeURIComponent(input)}`,
        toolChainDescription: 'Pathway search → FBA validation → Enzyme design',
        validityClass: 'AI_ASSISTED',
        rawInput: input,
      };
    }
  }

  // Rule 4 — Production metric
  if (METRIC_PATTERN.test(input) || (METRIC_KEYWORDS.test(input) && /\d/.test(input))) {
    return {
      type: 'METRIC',
      confidence: 'MEDIUM',
      displayLabel: 'Production Target',
      routeTo: `/tools/fbasim?goal=metric&q=${encodeURIComponent(input)}`,
      toolChainDescription: 'Reverse engineering → Strain design → Feasibility assessment',
      validityClass: 'AI_ASSISTED',
      rawInput: input,
    };
  }

  // Rule 5 — Freeform fallback
  return {
    type: 'FREEFORM',
    confidence: 'LOW',
    displayLabel: 'Free Query',
    routeTo: `/analyze?mode=freeform&q=${encodeURIComponent(input)}`,
    toolChainDescription: 'Axon AI analysis (AI-assisted, for reference only)',
    validityClass: 'AI_ASSISTED',
    rawInput: input,
  };
}
