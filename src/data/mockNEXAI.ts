import type { NEXAIResult, CitationNode } from '../types';

export const MOCK_RESULTS: NEXAIResult[] = [
  {
    query: 'How does tHMGR improve artemisinin precursor supply in yeast?',
    answer: `Truncated HMG-CoA reductase (tHMGR, residues 529–872) eliminates the membrane-spanning domain responsible for sterol-mediated feedback inhibition. In the native enzyme, ergosterol accumulation triggers degradation via the endoplasmic reticulum quality-control pathway (ERAD). The truncated form localizes to the cytoplasm and escapes this regulation, resulting in constitutively elevated mevalonate flux. Ro et al. (2006) demonstrated a 3.6-fold increase in FPP pool size and a corresponding 4.8-fold improvement in amorpha-4,11-diene titers when tHMGR replaced the full-length enzyme in S. cerevisiae.`,
    confidence: 0.91,
    generatedAt: Date.now() - 120000,
    citations: [
      { id: 'c1', title: 'Production of the antimalarial drug precursor artemisinic acid in engineered yeast', authors: 'Ro DK, Paradise EM, Ouellet M et al.', year: 2006, doi: '10.1038/nature04640', relevance: 0.98, x: 300, y: 120 },
      { id: 'c2', title: 'Increased production of farnesyl diphosphate in Saccharomyces cerevisiae by overexpression of ERG20', authors: 'Chambon C, Ladevèze V, Oulmouden A et al.', year: 1990, doi: '10.1007/BF00713466', relevance: 0.72, x: 180, y: 220 },
      { id: 'c3', title: 'Reconstitution of the biosynthesis of artemisinic acid in yeast using a single pathway', authors: 'Paddon CJ, Westfall PJ, Pitera DJ et al.', year: 2013, doi: '10.1038/nature12051', relevance: 0.95, x: 430, y: 200 },
      { id: 'c4', title: 'Engineering of Saccharomyces cerevisiae for effective condensation of monoterpene', authors: 'Jongedijk E, Cankar K, Ranzijn J et al.', year: 2016, doi: '10.1007/s00253-015-7081-7', relevance: 0.58, x: 110, y: 350 },
      { id: 'c5', title: 'Optimizing the expression of MVA pathway enzymes for production of isoprenoids', authors: 'Westfall PJ, Pitera DJ, Lenihan JR et al.', year: 2012, doi: '10.1073/pnas.1110740109', relevance: 0.82, x: 370, y: 330 },
    ],
  },
  {
    query: 'What are the key bottlenecks in the artemisinin biosynthesis pathway?',
    answer: `Three major bottlenecks have been identified: (1) Precursor supply — FPP availability is limited by competition with the sterol pathway via squalene synthase (ERG9). Dynamic repression of ERG9 during production phase is essential. (2) Oxidative steps — CYP71AV1 requires adequate NADPH supply and functional electron transfer chain (CYB5/CPR). Cofactor imbalance causes uncoupling and H2O2 production. (3) Artemisinin oxidation — the final spontaneous oxidation from dihydroartemisinic acid (DHAA) to artemisinin is oxygen-dependent and occurs most efficiently under aerobic conditions with sufficient Fe²⁺ and singlet oxygen from light.`,
    confidence: 0.87,
    generatedAt: Date.now() - 240000,
    citations: [
      { id: 'c6', title: 'Semi-synthetic artemisinin: a model for the use of synthetic biology in pharmaceutical development', authors: 'Paddon CJ & Keasling JD', year: 2014, doi: '10.1038/nrmicro3240', relevance: 0.94, x: 280, y: 150 },
      { id: 'c7', title: 'A recombinant yeast efficiently produces and secretes artemisinic acid', authors: 'Teoh KH, Polichuk DR, Reed DW, Covello PS', year: 2006, doi: '10.1016/j.bbrc.2006.01.058', relevance: 0.70, x: 160, y: 280 },
      { id: 'c8', title: 'Oxidative biosynthesis of artemisinic acid in Saccharomyces cerevisiae', authors: 'Ro DK, Ouellet M, Paradise EM et al.', year: 2008, doi: '10.1021/jacs.8b00280', relevance: 0.78, x: 400, y: 240 },
    ],
  },
  {
    query: 'Dynamic regulation strategies for isoprenoid overproduction',
    answer: `Dynamic metabolic engineering involves using condition-responsive promoters or genetic circuits to temporally separate growth and production phases. Key strategies include: (1) Anaerobically-inducible promoters for ERG9 repression during production; (2) Quorum sensing-based switches (LuxR/LuxI) to automate phase transitions based on cell density; (3) Optogenetic actuators (CRY2/CIB1) for precise, light-controlled gene expression. Metabolite-responsive riboswitches for HMGR or ERG20 expression have achieved 3.2× improvement in farnesol titers in E. coli. The key principle is that uncoupling biomass accumulation from metabolic burden enables higher final product concentrations.`,
    confidence: 0.84,
    generatedAt: Date.now() - 360000,
    citations: [
      { id: 'c9',  title: 'Dynamic control of gene regulatory networks and metabolic fluxes for metabolic engineering', authors: 'Holtz WJ & Keasling JD', year: 2010, doi: '10.1016/j.cbpa.2009.12.018', relevance: 0.89, x: 250, y: 130 },
      { id: 'c10', title: 'Optogenetic control of gene expression in S. cerevisiae', authors: 'Zhao EM, Zhang Y, Mehl J et al.', year: 2018, doi: '10.1038/s41589-018-0081-9', relevance: 0.75, x: 390, y: 190 },
      { id: 'c11', title: 'Quorum sensing-based metabolic engineering', authors: 'Soma Y, Tsuruno K, Wada M et al.', year: 2014, doi: '10.1016/j.ymben.2014.05.003', relevance: 0.71, x: 130, y: 290 },
    ],
  },
];
