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
const METRIC_PATTERN = /(\d+(\.\d+)?)\s*(%|fold|g\/[lL]|mg\/[lL]|倍|percent)/i;
const METRIC_KEYWORDS = /(提升|增加|优化|improve|increase|boost|yield|产量|titer)/i;

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
      displayLabel: '学术论文 DOI',
      routeTo: `/analyze?mode=paper&doi=${encodeURIComponent(cleaned)}`,
      toolChainDescription: '论文解析 → 路径提取 → 关键酶识别',
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
        displayLabel: `宿主菌株：${displayName}`,
        routeTo: `/tools/fbasim?organism=${encodeURIComponent(key)}`,
        toolChainDescription: '代谢模型加载 → 通量平衡分析 → 改造靶点识别',
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
        displayLabel: `目标分子：${molecule.charAt(0).toUpperCase() + molecule.slice(1)}`,
        routeTo: `/tools/pathd?target=${encodeURIComponent(molecule)}`,
        toolChainDescription: '路径搜索 → FBA验证 → 关键酶设计',
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
        displayLabel: `目标分子（推断）`,
        routeTo: `/tools/pathd?target=${encodeURIComponent(input)}`,
        toolChainDescription: '路径搜索 → FBA验证 → 关键酶设计',
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
      displayLabel: '生产指标目标',
      routeTo: `/tools/fbasim?goal=metric&q=${encodeURIComponent(input)}`,
      toolChainDescription: '目标反推 → 改造策略生成 → 可行性评估',
      validityClass: 'AI_ASSISTED',
      rawInput: input,
    };
  }

  // Rule 5 — Freeform fallback
  return {
    type: 'FREEFORM',
    confidence: 'LOW',
    displayLabel: '自由描述',
    routeTo: `/analyze?mode=freeform&q=${encodeURIComponent(input)}`,
    toolChainDescription: 'Axon AI 自由分析（AI辅助，仅供参考）',
    validityClass: 'AI_ASSISTED',
    rawInput: input,
  };
}
