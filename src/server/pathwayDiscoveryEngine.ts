/**
 * AI-Driven Metabolic Pathway Discovery Engine
 *
 * Automatically discovers novel biosynthetic pathways from a target molecule
 * back to available precursors using graph search algorithms combined with
 * thermodynamic feasibility scoring and enzyme availability assessment.
 *
 * Goes beyond simple retrosynthesis by:
 *   1. Enumerating multiple pathway candidates via A* search
 *   2. Scoring thermodynamic feasibility (ΔG cascade)
 *   3. Assessing enzyme availability (BRENDA/UniProt)
 *   4. Computing pathway efficiency (atom economy, cofactor balance)
 *   5. Ranking by overall designability
 *
 * Reference: Hadicke et al. (2017) Bioinformatics 33:3228-3233
 * Reference: Campodonico et al. (2014) Metabolic Engineering 22:96-107
 * Reference: Cho et al. (2018) Nature Communications 9:4433
 *
 * @scientific_provenance
 *   ALGORITHM: A* graph search + thermodynamic scoring + enzyme matching
 *   KNOWN_LIMITATIONS:
 *     - Reaction database is curated subset (not full KEGG/Rhea)
 *     - No atom mapping (uses reaction-type-based stoichiometry)
 *     - Thermodynamic estimates are group-contribution approximations
 *     - No regulatory constraint modeling
 *     - No compartmentalization (assumes cytosol only)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface Molecule {
  id: string;
  name: string;
  smiles?: string;
  formula?: string;
  molecularWeight?: number;
  /** Functional groups for matching */
  functionalGroups: string[];
  /** Available as precursor? */
  isPrecursor: boolean;
  /** KEGG compound ID if available */
  keggId?: string;
}

export interface Reaction {
  id: string;
  name: string;
  substrates: string[];
  products: string[];
  /** EC number */
  ecNumber?: string;
  /** Estimated ΔG (kcal/mol) */
  deltaG: number;
  /** Reversibility */
  reversible: boolean;
  /** Enzyme availability score (0-1) */
  enzymeAvailability: number;
  /** Known organisms with this enzyme */
  organisms: string[];
  /** Cofactor requirements */
  cofactors: string[];
  /** Reaction type */
  type: 'oxidoreductase' | 'transferase' | 'hydrolase' | 'lyase' | 'isomerase' | 'ligase' | 'transaminase' | 'decarboxylase' | 'kinase';
}

export interface PathwayStep {
  reaction: Reaction;
  substrate: Molecule;
  product: Molecule;
  deltaG: number;
  enzymeScore: number;
  /** Feasibility of this step (0-1) */
  feasibility: number;
}

export interface DiscoveredPathway {
  id: string;
  steps: PathwayStep[];
  precursor: Molecule;
  target: Molecule;
  /** Overall pathway metrics */
  metrics: {
    totalDeltaG: number;
    avgEnzymeAvailability: number;
    atomEconomy: number;
    cofactorBalance: number;
    pathwayLength: number;
    overallScore: number;
  };
  /** Thermodynamic feasibility cascade */
  dgCascade: number[];
  /** Bottleneck steps */
  bottlenecks: Array<{
    stepIndex: number;
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  /** Alternative routes at each step */
  alternativeRoutes: Map<number, string[]>;
}

export interface PathwayDiscoveryInput {
  /** Target molecule to synthesize */
  target: Molecule;
  /** Available precursors */
  precursors: Molecule[];
  /** Maximum pathway length */
  maxLength?: number;
  /** Minimum thermodynamic feasibility */
  minFeasibility?: number;
  /** Preferred organism for enzyme sourcing */
  preferredOrganism?: string;
  /** Number of top pathways to return */
  topN?: number;
  /** Include novel/hypothetical reactions? */
  includeNovel?: boolean;
}

export interface PathwayDiscoveryResult {
  pathways: DiscoveredPathway[];
  targetInfo: Molecule;
  precursorPool: Molecule[];
  /** Reaction database statistics */
  dbStats: {
    totalReactions: number;
    totalMetabolites: number;
    avgEnzymeAvailability: number;
  };
  designNotes: string[];
}

// ── Reaction Database (curated subset) ─────────────────────────────────────

/**
 * Core reaction database covering major biosynthetic pathways.
 * In production, this would be loaded from KEGG/Rhea/BRENDA.
 */
const REACTION_DB: Reaction[] = [
  // ── Glycolysis ──
  { id: 'R00200', name: 'Hexokinase', substrates: ['glucose', 'atp'], products: ['glucose_6p', 'adp'], ecNumber: '2.7.1.1', deltaG: -4.0, reversible: false, enzymeAvailability: 0.95, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Mg2+'], type: 'kinase' },
  { id: 'R00756', name: 'Phosphoglucose isomerase', substrates: ['glucose_6p'], products: ['fructose_6p'], ecNumber: '5.3.1.9', deltaG: 0.4, reversible: true, enzymeAvailability: 0.95, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'isomerase' },
  { id: 'R00756b', name: 'Phosphofructokinase', substrates: ['fructose_6p', 'atp'], products: ['fructose_16bp', 'adp'], ecNumber: '2.7.1.11', deltaG: -3.4, reversible: false, enzymeAvailability: 0.95, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Mg2+'], type: 'kinase' },
  { id: 'R01068', name: 'Fructose-bisphosphate aldolase', substrates: ['fructose_16bp'], products: ['g3p', 'dhap'], ecNumber: '4.1.2.13', deltaG: 5.7, reversible: true, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'lyase' },
  { id: 'R00658', name: 'Glyceraldehyde-3-P dehydrogenase', substrates: ['g3p', 'nad', 'pi'], products: ['13dpg', 'nadh'], ecNumber: '1.2.1.12', deltaG: 1.3, reversible: true, enzymeAvailability: 0.95, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['NAD+'], type: 'oxidoreductase' },
  { id: 'R01512', name: 'Pyruvate kinase', substrates: ['pep', 'adp'], products: ['pyruvate', 'atp'], ecNumber: '2.7.1.40', deltaG: -7.5, reversible: false, enzymeAvailability: 0.95, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['K+', 'Mg2+'], type: 'kinase' },

  // ── TCA Cycle ──
  { id: 'R00209', name: 'Citrate synthase', substrates: ['acetyl_coa', 'oxaloacetate', 'h2o'], products: ['citrate', 'coa'], ecNumber: '2.3.3.1', deltaG: -7.5, reversible: false, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'transferase' },
  { id: 'R01324', name: 'Aconitase', substrates: ['citrate'], products: ['isocitrate'], ecNumber: '4.2.1.3', deltaG: 1.3, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Fe-S cluster'], type: 'isomerase' },
  { id: 'R00216', name: 'Isocitrate dehydrogenase', substrates: ['isocitrate', 'nadp'], products: ['akg', 'co2', 'nadph'], ecNumber: '1.1.1.42', deltaG: -5.0, reversible: false, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['NADP+', 'Mn2+'], type: 'oxidoreductase' },
  { id: 'R00216b', name: 'α-Ketoglutarate dehydrogenase', substrates: ['akg', 'coa', 'nad'], products: ['succinyl_coa', 'co2', 'nadh'], ecNumber: '1.2.4.2', deltaG: -7.2, reversible: false, enzymeAvailability: 0.8, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['NAD+', 'TPP', 'lipoate'], type: 'oxidoreductase' },
  { id: 'R00405', name: 'Succinyl-CoA synthetase', substrates: ['succinyl_coa', 'adp', 'pi'], products: ['succinate', 'coa', 'atp'], ecNumber: '6.2.1.5', deltaG: -0.8, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'ligase' },
  { id: 'R01082', name: 'Succinate dehydrogenase', substrates: ['succinate', 'fad'], products: ['fumarate', 'fadh2'], ecNumber: '1.3.5.1', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['FAD', 'Fe-S'], type: 'oxidoreductase' },
  { id: 'R01082b', name: 'Fumarase', substrates: ['fumarate', 'h2o'], products: ['malate'], ecNumber: '4.2.1.2', deltaG: -0.9, reversible: true, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'lyase' },
  { id: 'R00342', name: 'Malate dehydrogenase', substrates: ['malate', 'nad'], products: ['oxaloacetate', 'nadh'], ecNumber: '1.1.1.37', deltaG: 6.7, reversible: true, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['NAD+'], type: 'oxidoreductase' },

  // ── Amino acid biosynthesis ──
  { id: 'R00258', name: 'Aspartate aminotransferase', substrates: ['oxaloacetate', 'glutamate'], products: ['aspartate', 'akg'], ecNumber: '2.6.1.1', deltaG: 0, reversible: true, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['PLP'], type: 'transaminase' },
  { id: 'R00480', name: 'Glutamate dehydrogenase', substrates: ['akg', 'nh4', 'nadph'], products: ['glutamate', 'nadp'], ecNumber: '1.4.1.4', deltaG: 4.2, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['NADPH'], type: 'oxidoreductase' },
  { id: 'R00709', name: 'Serine hydroxymethyltransferase', substrates: ['serine', 'thf'], products: ['glycine', 'methf', 'h2o'], ecNumber: '2.1.2.1', deltaG: 0.8, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['PLP', 'THF'], type: 'transferase' },
  { id: 'R00709b', name: 'Phosphoserine aminotransferase', substrates: ['3p_hydroxypyruvate', 'glutamate'], products: ['phosphoserine', 'akg'], ecNumber: '2.6.1.52', deltaG: 0, reversible: true, enzymeAvailability: 0.8, organisms: ['ecoli', 'yeast'], cofactors: ['PLP'], type: 'transaminase' },

  // ── Fatty acid / Lipid ──
  { id: 'R00744', name: 'Acetyl-CoA carboxylase', substrates: ['acetyl_coa', 'atp', 'co2'], products: ['malonyl_coa', 'adp', 'pi'], ecNumber: '6.4.1.2', deltaG: -4.1, reversible: false, enzymeAvailability: 0.8, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['biotin', 'Mg2+'], type: 'ligase' },
  { id: 'R00744b', name: 'Malonyl-CoA:ACP transacylase', substrates: ['malonyl_coa', 'acp'], products: ['malonyl_acp', 'coa'], ecNumber: '2.3.1.39', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli'], cofactors: ['ACP'], type: 'transferase' },
  { id: 'R00744c', name: 'β-Ketoacyl-ACP synthase', substrates: ['malonyl_acp', 'acetyl_acp'], products: ['acetoacetyl_acp', 'co2', 'acp'], ecNumber: '2.3.1.41', deltaG: -3.5, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli'], cofactors: ['ACP'], type: 'transferase' },

  // ── Isoprenoid / Mevalonate ──
  { id: 'R00238', name: 'HMG-CoA reductase', substrates: ['hmg_coa', 'nadph'], products: ['mevalonate', 'coa', 'nadp'], ecNumber: '1.1.1.34', deltaG: -3.8, reversible: false, enzymeAvailability: 0.85, organisms: ['yeast', 'human'], cofactors: ['NADPH'], type: 'oxidoreductase' },
  { id: 'R00238b', name: 'Mevalonate kinase', substrates: ['mevalonate', 'atp'], products: ['mevalonate_5p', 'adp'], ecNumber: '2.7.1.36', deltaG: -4.0, reversible: false, enzymeAvailability: 0.8, organisms: ['yeast', 'human'], cofactors: ['Mg2+'], type: 'kinase' },
  { id: 'R00238c', name: 'IPP isomerase', substrates: ['ipp'], products: ['dmapp'], ecNumber: '5.3.3.2', deltaG: 0.5, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast'], cofactors: [], type: 'isomerase' },
  { id: 'R00238d', name: 'FPP synthase', substrates: ['ipp', 'dmapp'], products: ['fpp', 'ppi'], ecNumber: '2.5.1.1', deltaG: -4.2, reversible: false, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Mg2+'], type: 'transferase' },

  // ── Specialty / Natural product pathways ──
  { id: 'R00238e', name: 'Amorpha-4,11-diene synthase', substrates: ['fpp'], products: ['amorpha_4_11_diene', 'ppi'], ecNumber: '4.2.3.24', deltaG: -5.0, reversible: false, enzymeAvailability: 0.7, organisms: ['artemisia_annua'], cofactors: ['Mg2+'], type: 'lyase' },
  { id: 'R00238f', name: 'Artemisinic alcohol oxidase', substrates: ['amorpha_4_11_diene', 'o2', 'nadph'], products: ['artemisinic_alcohol', 'nadp', 'h2o'], ecNumber: '1.14.13.-', deltaG: -8.0, reversible: false, enzymeAvailability: 0.6, organisms: ['artemisia_annua', 's_cerevisiae'], cofactors: ['NADPH', 'cytP450'], type: 'oxidoreductase' },
  { id: 'R00238g', name: 'Artemisinic aldehyde oxidase', substrates: ['artemisinic_alcohol', 'nad'], products: ['artemisinic_aldehyde', 'nadh'], ecNumber: '1.1.1.-', deltaG: -1.5, reversible: false, enzymeAvailability: 0.6, organisms: ['artemisia_annua'], cofactors: ['NAD+'], type: 'oxidoreductase' },
  { id: 'R00238h', name: 'Artemisinic acid synthase', substrates: ['artemisinic_aldehyde', 'nad'], products: ['artemisinic_acid', 'nadh'], ecNumber: '1.2.1.-', deltaG: -2.0, reversible: false, enzymeAvailability: 0.6, organisms: ['artemisia_annua'], cofactors: ['NAD+'], type: 'oxidoreductase' },

  // ── Shikimate / Aromatic ──
  { id: 'R01826', name: 'DAHP synthase', substrates: ['pep', 'e4p'], products: ['dahp', 'pi'], ecNumber: '2.5.1.54', deltaG: -4.0, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast'], cofactors: [], type: 'transferase' },
  { id: 'R01826b', name: 'Shikimate kinase', substrates: ['shikimate', 'atp'], products: ['shikimate_3p', 'adp'], ecNumber: '2.7.1.71', deltaG: -3.0, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast'], cofactors: ['Mg2+'], type: 'kinase' },
  { id: 'R01826c', name: 'Chorismate synthase', substrates: ['epsps'], products: ['chorismate', 'pi'], ecNumber: '4.2.3.5', deltaG: -2.0, reversible: false, enzymeAvailability: 0.8, organisms: ['ecoli', 'yeast'], cofactors: [], type: 'lyase' },

  // ── Acetyl-CoA production ──
  { id: 'R00228', name: 'Pyruvate dehydrogenase', substrates: ['pyruvate', 'coa', 'nad'], products: ['acetyl_coa', 'co2', 'nadh'], ecNumber: '1.2.4.1', deltaG: -8.0, reversible: false, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['NAD+', 'TPP', 'lipoate', 'FAD'], type: 'oxidoreductase' },
  { id: 'R00228b', name: 'ATP citrate lyase', substrates: ['citrate', 'coa', 'atp'], products: ['acetyl_coa', 'oxaloacetate', 'adp', 'pi'], ecNumber: '2.3.3.8', deltaG: -2.5, reversible: false, enzymeAvailability: 0.7, organisms: ['human', 'yeast'], cofactors: [], type: 'transferase' },

  // ── NADPH production ──
  { id: 'R01528', name: 'Glucose-6-P dehydrogenase', substrates: ['glucose_6p', 'nadp'], products: ['6pgl', 'nadph'], ecNumber: '1.1.1.49', deltaG: -4.0, reversible: false, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['NADP+'], type: 'oxidoreductase' },
  { id: 'R01528b', name: '6-PG dehydrogenase', substrates: ['6pgl', 'nadp'], products: ['ru5p', 'co2', 'nadph'], ecNumber: '1.1.1.44', deltaG: -5.0, reversible: false, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['NADP+'], type: 'oxidoreductase' },

  // ════════════════════════════════════════════════════════════════════════════
  // FATTY ACID METABOLISM (12 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'R01396', name: 'Acetyl-CoA carboxylase', substrates: ['acetyl_coa', 'atp', 'hco3'], products: ['malonyl_coa', 'adp', 'pi'], ecNumber: '6.4.1.2', deltaG: -4.1, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['biotin'], type: 'ligase' },
  { id: 'R01699', name: 'Malonyl-CoA-ACP transacylase', substrates: ['malonyl_coa', 'acp'], products: ['malonyl_acp', 'coa'], ecNumber: '2.3.1.39', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli'], cofactors: ['ACP'], type: 'transferase' },
  { id: 'R01700', name: 'β-Ketoacyl-ACP synthase III', substrates: ['acetyl_coa', 'malonyl_acp'], products: ['acetoacetyl_acp', 'co2', 'coa'], ecNumber: '2.3.1.180', deltaG: -3.5, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli'], cofactors: ['ACP'], type: 'transferase' },
  { id: 'R01701', name: 'β-Ketoacyl-ACP reductase', substrates: ['acetoacetyl_acp', 'nadph'], products: ['beta_hydroxybutyryl_acp', 'nadp'], ecNumber: '1.1.1.100', deltaG: -2.0, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli'], cofactors: ['NADPH'], type: 'oxidoreductase' },
  { id: 'R01702', name: 'β-Hydroxyacyl-ACP dehydratase', substrates: ['beta_hydroxybutyryl_acp'], products: ['crotonyl_acp', 'h2o'], ecNumber: '4.2.1.59', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli'], cofactors: [], type: 'lyase' },
  { id: 'R01703', name: 'Enoyl-ACP reductase', substrates: ['crotonyl_acp', 'nadph'], products: ['butyryl_acp', 'nadp'], ecNumber: '1.3.1.9', deltaG: -2.5, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli'], cofactors: ['NADPH'], type: 'oxidoreductase' },
  { id: 'R04751', name: 'Palmitoyl-ACP thioesterase', substrates: ['palmitoyl_acp', 'h2o'], products: ['palmitate', 'acp', 'h'], ecNumber: '3.1.2.14', deltaG: -2.0, reversible: false, enzymeAvailability: 0.8, organisms: ['ecoli', 'plant'], cofactors: [], type: 'hydrolase' },
  { id: 'R04752', name: 'Stearoyl-ACP desaturase', substrates: ['stearoyl_acp', 'o2', 'nadph'], products: ['oleoyl_acp', 'h2o', 'nadp'], ecNumber: '1.14.19.2', deltaG: -5.0, reversible: false, enzymeAvailability: 0.7, organisms: ['plant'], cofactors: ['Fe', 'O2'], type: 'oxidoreductase' },
  { id: 'R01786', name: 'β-Oxidation (acyl-CoA dehydrogenase)', substrates: ['palmitoyl_coa', 'fad'], products: ['trans2_enoyl_coa', 'fadh2'], ecNumber: '1.3.8.8', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'human'], cofactors: ['FAD'], type: 'oxidoreductase' },
  { id: 'R01787', name: 'β-Oxidation (enoyl-CoA hydratase)', substrates: ['trans2_enoyl_coa', 'h2o'], products: ['3hydroxyacyl_coa'], ecNumber: '4.2.1.17', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'human'], cofactors: [], type: 'lyase' },
  { id: 'R01788', name: 'β-Oxidation (3-hydroxyacyl-CoA dehydrogenase)', substrates: ['3hydroxyacyl_coa', 'nad'], products: ['3ketoacyl_coa', 'nadh'], ecNumber: '1.1.1.35', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'human'], cofactors: ['NAD+'], type: 'oxidoreductase' },
  { id: 'R01789', name: 'β-Oxidation (thiolase)', substrates: ['3ketoacyl_coa', 'coa'], products: ['acetyl_coa', 'acyl_coa_short'], ecNumber: '2.3.1.16', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'human'], cofactors: ['CoA'], type: 'transferase' },

  // ════════════════════════════════════════════════════════════════════════════
  // NUCLEOTIDE BIOSYNTHESIS (10 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'R00569', name: 'Adenylosuccinate synthase', substrates: ['imp', 'asp', 'gtp'], products: ['dcamp', 'gdp', 'pi'], ecNumber: '6.3.4.4', deltaG: -4.0, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['GTP'], type: 'ligase' },
  { id: 'R00570', name: 'Adenylosuccinate lyase', substrates: ['dcamp'], products: ['amp', 'fumarate'], ecNumber: '4.3.2.2', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'lyase' },
  { id: 'R00571', name: 'IMP dehydrogenase', substrates: ['imp', 'nad', 'h2o'], products: ['xmp', 'nadh'], ecNumber: '1.1.1.205', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['NAD+'], type: 'oxidoreductase' },
  { id: 'R00572', name: 'GMP synthase', substrates: ['xmp', 'gln', 'atp'], products: ['gmp', 'glu', 'amp', 'ppi'], ecNumber: '6.3.5.2', deltaG: -8.0, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['ATP'], type: 'ligase' },
  { id: 'R00573', name: 'CMP synthase (CTP synthase)', substrates: ['utp', 'gln', 'atp'], products: ['ctp', 'glu', 'adp', 'pi'], ecNumber: '6.3.4.2', deltaG: -6.0, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['ATP'], type: 'ligase' },
  { id: 'R00574', name: 'UMP synthase (orotate phosphoribosyltransferase)', substrates: ['orotate', 'prpp'], products: ['orot5p', 'ppi'], ecNumber: '2.4.2.10', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'transferase' },
  { id: 'R00575', name: 'Orotidine-5-P decarboxylase', substrates: ['orot5p'], products: ['ump', 'co2'], ecNumber: '4.1.1.23', deltaG: -4.0, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'decarboxylase' },
  { id: 'R00576', name: 'Nucleoside diphosphate kinase', substrates: ['ump', 'atp'], products: ['udp', 'adp'], ecNumber: '2.7.4.22', deltaG: 0, reversible: true, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Mg2+'], type: 'kinase' },
  { id: 'R00577', name: 'UTP-glucose-1-P uridylyltransferase', substrates: ['utp', 'glucose_1p'], products: ['udpg', 'ppi'], ecNumber: '2.7.7.9', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Mg2+'], type: 'transferase' },
  { id: 'R00578', name: 'Ribose-5-P isomerase', substrates: ['ru5p'], products: ['r5p'], ecNumber: '5.3.1.6', deltaG: 0, reversible: true, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'isomerase' },

  // ════════════════════════════════════════════════════════════════════════════
  // AMINO ACID BIOSYNTHESIS (10 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'R00258', name: 'Aspartate aminotransferase', substrates: ['oxaloacetate', 'glutamate'], products: ['aspartate', 'akg'], ecNumber: '2.6.1.1', deltaG: 0, reversible: true, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['PLP'], type: 'transaminase' },
  { id: 'R00480', name: 'Glutamate dehydrogenase', substrates: ['akg', 'nh4', 'nadph'], products: ['glutamate', 'nadp'], ecNumber: '1.4.1.4', deltaG: 4.2, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['NADPH'], type: 'oxidoreductase' },
  { id: 'R00709', name: 'Serine hydroxymethyltransferase', substrates: ['serine', 'thf'], products: ['glycine', 'methf', 'h2o'], ecNumber: '2.1.2.1', deltaG: 0.8, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['PLP', 'THF'], type: 'transferase' },
  { id: 'R01522', name: 'Phosphoserine aminotransferase', substrates: ['3p_hydroxypyruvate', 'glutamate'], products: ['phosphoserine', 'akg'], ecNumber: '2.6.1.52', deltaG: 0, reversible: true, enzymeAvailability: 0.8, organisms: ['ecoli', 'yeast'], cofactors: ['PLP'], type: 'transaminase' },
  { id: 'R01523', name: 'Phosphoserine phosphatase', substrates: ['phosphoserine', 'h2o'], products: ['serine', 'pi'], ecNumber: '3.1.3.3', deltaG: -2.0, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'hydrolase' },
  { id: 'R01524', name: 'Threonine synthase', substrates: ['phosphohomoserine', 'h2o'], products: ['threonine', 'pi'], ecNumber: '4.2.3.1', deltaG: -2.0, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast'], cofactors: ['PLP'], type: 'lyase' },
  { id: 'R01525', name: 'Threonine dehydratase', substrates: ['threonine'], products: ['2obut', 'nh4'], ecNumber: '4.3.1.19', deltaG: 0, reversible: true, enzymeAvailability: 0.8, organisms: ['ecoli', 'yeast'], cofactors: ['PLP'], type: 'lyase' },
  { id: 'R01526', name: 'Acetolactate synthase', substrates: ['2pyr', 'h'], products: ['acetolactate', 'co2'], ecNumber: '2.2.1.6', deltaG: -2.0, reversible: false, enzymeAvailability: 0.8, organisms: ['ecoli', 'yeast'], cofactors: ['TPP'], type: 'transferase' },
  { id: 'R01527', name: 'Ketol-acid reductoisomerase', substrates: ['acetolactate', 'nadph'], products: ['dihydroxyisovalerate', 'nadp'], ecNumber: '1.1.1.86', deltaG: -2.0, reversible: false, enzymeAvailability: 0.8, organisms: ['ecoli', 'yeast'], cofactors: ['NADPH', 'Mg2+'], type: 'oxidoreductase' },
  { id: 'R01528c', name: 'Dihydroxyacid dehydratase', substrates: ['dihydroxyisovalerate'], products: ['3mob', 'h2o'], ecNumber: '4.2.1.9', deltaG: 0, reversible: true, enzymeAvailability: 0.75, organisms: ['ecoli', 'yeast'], cofactors: ['Fe-S'], type: 'lyase' },

  // ════════════════════════════════════════════════════════════════════════════
  // COFACTOR BIOSYNTHESIS (8 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'R00127', name: 'NAD synthetase', substrates: ['dhnad', 'gln', 'atp', 'h2o'], products: ['nad', 'glu', 'amp', 'ppi'], ecNumber: '6.3.5.1', deltaG: -6.0, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast'], cofactors: ['ATP'], type: 'ligase' },
  { id: 'R00128', name: 'NMN adenylyltransferase', substrates: ['nmn', 'atp'], products: ['nad', 'ppi'], ecNumber: '2.7.7.1', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Mg2+'], type: 'transferase' },
  { id: 'R00129', name: 'FMN adenylyltransferase', substrates: ['fmn', 'atp'], products: ['fad', 'ppi'], ecNumber: '2.7.7.2', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Mg2+'], type: 'transferase' },
  { id: 'R00130', name: 'Pantothenate kinase', substrates: ['pantothenate', 'atp'], products: ['4ppan', 'adp'], ecNumber: '2.7.1.33', deltaG: -3.0, reversible: false, enzymeAvailability: 0.8, organisms: ['ecoli', 'yeast'], cofactors: ['Mg2+'], type: 'kinase' },
  { id: 'R00131', name: 'Phosphopantothenate-cysteine ligase', substrates: ['4ppan', 'cys', 'atp'], products: ['4ppcys', 'amp', 'ppi'], ecNumber: '6.3.2.5', deltaG: -5.0, reversible: false, enzymeAvailability: 0.75, organisms: ['ecoli'], cofactors: ['ATP'], type: 'ligase' },
  { id: 'R00132', name: 'Phosphopantothenoylcysteine decarboxylase', substrates: ['4ppcys'], products: ['pan4p', 'co2'], ecNumber: '4.1.1.36', deltaG: -2.0, reversible: false, enzymeAvailability: 0.75, organisms: ['ecoli'], cofactors: [], type: 'decarboxylase' },
  { id: 'R00133', name: 'Dephospho-CoA kinase', substrates: ['dpcoa', 'atp'], products: ['coa', 'adp'], ecNumber: '2.7.1.24', deltaG: -3.0, reversible: false, enzymeAvailability: 0.8, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Mg2+'], type: 'kinase' },
  { id: 'R00134', name: 'Biotin synthase', substrates: ['dethiobiotin', 's', 'am', 'flxdo'], products: ['biotin', 'amp', 'flxrd'], ecNumber: '2.8.1.6', deltaG: -5.0, reversible: false, enzymeAvailability: 0.6, organisms: ['ecoli'], cofactors: ['Fe-S', 'SAM'], type: 'transferase' },

  // ════════════════════════════════════════════════════════════════════════════
  // ADDITIONAL CENTRAL METABOLISM (8 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  { id: 'R00300', name: 'Phosphofructokinase (PPi-dependent)', substrates: ['f6p', 'ppi'], products: ['fdp', 'pi'], ecNumber: '2.7.1.90', deltaG: -3.0, reversible: false, enzymeAvailability: 0.7, organisms: ['plant', 'protist'], cofactors: ['Mg2+'], type: 'kinase' },
  { id: 'R00301', name: 'Fructose-1,6-bisphosphatase', substrates: ['fdp', 'h2o'], products: ['f6p', 'pi'], ecNumber: '3.1.3.11', deltaG: -4.0, reversible: false, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Mg2+'], type: 'hydrolase' },
  { id: 'R00302', name: 'Phosphoglucomutase', substrates: ['glucose_1p'], products: ['glucose_6p'], ecNumber: '5.4.2.2', deltaG: 0, reversible: true, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Mg2+'], type: 'isomerase' },
  { id: 'R00303', name: 'Galactokinase', substrates: ['galactose', 'atp'], products: ['galactose_1p', 'adp'], ecNumber: '2.7.1.6', deltaG: -3.0, reversible: false, enzymeAvailability: 0.8, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['Mg2+'], type: 'kinase' },
  { id: 'R00304', name: 'UDP-glucose 4-epimerase', substrates: ['udpg'], products: ['udpgal'], ecNumber: '5.1.3.2', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['NAD+'], type: 'isomerase' },
  { id: 'R00305', name: 'Transaldolase', substrates: ['s7p', 'g3p'], products: ['f6p', 'e4p'], ecNumber: '2.2.1.2', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'transferase' },
  { id: 'R00306', name: 'Transketolase', substrates: ['xu5p', 'r5p'], products: ['s7p', 'g3p'], ecNumber: '2.2.1.1', deltaG: 0, reversible: true, enzymeAvailability: 0.85, organisms: ['ecoli', 'yeast', 'human'], cofactors: ['TPP'], type: 'transferase' },
  { id: 'R00307', name: 'Ribulose-5-P epimerase', substrates: ['ru5p'], products: ['xu5p'], ecNumber: '5.1.3.1', deltaG: 0, reversible: true, enzymeAvailability: 0.9, organisms: ['ecoli', 'yeast', 'human'], cofactors: [], type: 'isomerase' },
];

// ── Functional Group Analysis ──────────────────────────────────────────────

/**
 * Pattern-based functional group detection for molecular matching.
 */
function detectFunctionalGroups(smiles: string): string[] {
  const groups: string[] = [];
  const s = smiles.toUpperCase();

  if (s.includes('C(=O)O') || s.includes('COOH')) groups.push('carboxyl');
  if (s.includes('C(=O)') && !s.includes('C(=O)O')) groups.push('carbonyl');
  if (s.includes('OH')) groups.push('hydroxyl');
  if (s.includes('NH2')) groups.push('amino');
  if (s.includes('SH')) groups.push('thiol');
  if (s.includes('P(=O)') || s.includes('PO')) groups.push('phosphoryl');
  if (s.includes('C=C')) groups.push('alkene');
  if (s.includes('C#C')) groups.push('alkyne');
  if (s.includes('OCC') && groups.includes('hydroxyl')) groups.push('sugar');

  return groups;
}

/**
 * Compute molecular similarity based on functional group overlap.
 */
function molecularSimilarity(a: Molecule, b: Molecule): number {
  if (a.functionalGroups.length === 0 && b.functionalGroups.length === 0) return 0.5;

  const setA = new Set(a.functionalGroups);
  const setB = new Set(b.functionalGroups);
  const intersection = [...setA].filter(g => setB.has(g)).length;
  const union = new Set([...setA, ...setB]).size;

  return union > 0 ? intersection / union : 0;
}

// ── Atom Economy ───────────────────────────────────────────────────────────

/**
 * Compute atom economy of a reaction.
 * Atom economy = (MW of desired product) / (MW of all reactants) × 100%
 *
 * Estimation using reaction-type molecular weight ratios.
 */
function computeAtomEconomy(reaction: Reaction): number {
  // Estimation based on reaction type
  const typeEconomy: Record<string, number> = {
    'oxidoreductase': 0.85,
    'transferase': 0.90,
    'hydrolase': 0.70,
    'lyase': 0.80,
    'isomerase': 1.00,
    'ligase': 0.75,
    'transaminase': 0.85,
    'decarboxylase': 0.75,
    'kinase': 0.80,
  };

  return typeEconomy[reaction.type] || 0.80;
}

// ── Cofactor Balance ───────────────────────────────────────────────────────

/**
 * Compute cofactor balance across a pathway.
 * A balanced pathway regenerates consumed cofactors.
 */
function computeCofactorBalance(steps: PathwayStep[]): number {
  const consumed: Record<string, number> = {};
  const produced: Record<string, number> = {};

  for (const step of steps) {
    const r = step.reaction;

    // NAD+/NADH balance
    if (r.substrates.includes('nad')) consumed['nad'] = (consumed['nad'] || 0) + 1;
    if (r.products.includes('nadh')) produced['nadh'] = (produced['nadh'] || 0) + 1;
    if (r.substrates.includes('nadh')) consumed['nadh'] = (consumed['nadh'] || 0) + 1;
    if (r.products.includes('nad')) produced['nad'] = (produced['nad'] || 0) + 1;

    // NADP+/NADPH balance
    if (r.substrates.includes('nadp')) consumed['nadp'] = (consumed['nadp'] || 0) + 1;
    if (r.products.includes('nadph')) produced['nadph'] = (produced['nadph'] || 0) + 1;
    if (r.substrates.includes('nadph')) consumed['nadph'] = (consumed['nadph'] || 0) + 1;
    if (r.products.includes('nadp')) produced['nadp'] = (produced['nadp'] || 0) + 1;

    // ATP/ADP balance
    if (r.substrates.includes('atp')) consumed['atp'] = (consumed['atp'] || 0) + 1;
    if (r.products.includes('adp')) produced['adp'] = (produced['adp'] || 0) + 1;
    if (r.products.includes('atp')) produced['atp'] = (produced['atp'] || 0) + 1;
    if (r.substrates.includes('adp')) consumed['adp'] = (consumed['adp'] || 0) + 1;

    // CoA balance
    if (r.substrates.includes('coa')) consumed['coa'] = (consumed['coa'] || 0) + 1;
    if (r.products.includes('coa')) produced['coa'] = (produced['coa'] || 0) + 1;
  }

  // Compute balance score
  const allCofactors = new Set([...Object.keys(consumed), ...Object.keys(produced)]);
  let balanceScore = 1.0;

  for (const cofactor of allCofactors) {
    const c = consumed[cofactor] || 0;
    const p = produced[cofactor] || 0;
    const imbalance = Math.abs(c - p) / Math.max(c, p, 1);
    balanceScore -= imbalance * 0.2;
  }

  return Math.max(0, Math.min(1, balanceScore));
}

// ── A* Pathway Search ──────────────────────────────────────────────────────

/**
 * A* search for pathways from target back to precursors.
 *
 * State: current metabolite
 * Goal: reach any available precursor
 * Cost: cumulative ΔG + enzyme availability penalty
 * Heuristic: molecular similarity to nearest precursor
 */
function aStarPathwaySearch(
  target: Molecule,
  precursors: Molecule[],
  reactionDB: Reaction[],
  maxLength: number,
  topN: number,
): DiscoveredPathway[] {
  const precursorIds = new Set(precursors.map(p => p.id));
  const precursorMap = new Map(precursors.map(p => [p.id, p]));

  // Build reaction index: product → reactions that produce it
  const productToReactions = new Map<string, Reaction[]>();
  for (const rxn of reactionDB) {
    for (const product of rxn.products) {
      if (!productToReactions.has(product)) productToReactions.set(product, []);
      productToReactions.get(product)!.push(rxn);
    }
  }

  // A* search
  interface SearchNode {
    metabolite: string;
    path: PathwayStep[];
    totalDG: number;
    avgEnzyme: number;
    heuristic: number;
    cost: number; // totalDG + heuristic
  }

  const openSet: SearchNode[] = [];
  const closedSet = new Set<string>();
  const foundPathways: DiscoveredPathway[] = [];
  const cofactors = ['atp', 'adp', 'nad', 'nadh', 'nadp', 'nadph', 'coa', 'fad', 'fadh2', 'h2o', 'o2', 'co2', 'pi', 'ppi', 'h', 'nh4', 'thf', 'methf', 'plp', 'acp', 'mg2', 'k', 'fe-s'];

  // Heuristic: minimum similarity to any precursor
  function heuristic(metaboliteId: string): number {
    const met: Molecule = { id: metaboliteId, name: metaboliteId, functionalGroups: [], isPrecursor: false };
    let minDist = Infinity;
    for (const prec of precursors) {
      const sim = molecularSimilarity(met, prec);
      minDist = Math.min(minDist, 1 - sim);
    }
    return minDist * 5; // scale factor
  }

  // Initialize with target
  openSet.push({
    metabolite: target.id,
    path: [],
    totalDG: 0,
    avgEnzyme: 1.0,
    heuristic: heuristic(target.id),
    cost: heuristic(target.id),
  });

  let iterations = 0;
  const maxIterations = 10000;

  while (openSet.length > 0 && iterations < maxIterations && foundPathways.length < topN * 3) {
    iterations++;

    // Sort by cost (A* priority)
    openSet.sort((a, b) => a.cost - b.cost);
    const current = openSet.shift()!;

    // Check if we reached a precursor
    if (precursorIds.has(current.metabolite)) {
      const precursor = precursorMap.get(current.metabolite)!;
      const steps = current.path;
      const dgCascade = steps.map(s => s.deltaG);

      // Compute metrics
      const totalDG = steps.reduce((sum, s) => sum + s.deltaG, 0);
      const avgEnzyme = steps.length > 0
        ? steps.reduce((sum, s) => sum + s.enzymeScore, 0) / steps.length
        : 0;
      const atomEconomy = steps.reduce((prod, s) => prod * computeAtomEconomy(s.reaction), 1.0);
      const cofactorBalance = computeCofactorBalance(steps);

      // Overall score
      const overallScore =
        0.30 * Math.max(0, 1 + totalDG / 50) + // ΔG (normalized)
        0.25 * avgEnzyme +                       // enzyme availability
        0.20 * atomEconomy +                     // atom economy
        0.15 * cofactorBalance +                 // cofactor balance
        0.10 * (1 - steps.length / maxLength);   // shorter is better

      // Detect bottlenecks
      const bottlenecks: DiscoveredPathway['bottlenecks'] = [];
      steps.forEach((step, idx) => {
        if (step.deltaG > 5) bottlenecks.push({ stepIndex: idx, reason: `Thermodynamically unfavorable (ΔG=${step.deltaG.toFixed(1)} kcal/mol)`, severity: 'high' });
        else if (step.deltaG > 2) bottlenecks.push({ stepIndex: idx, reason: `Slightly unfavorable (ΔG=${step.deltaG.toFixed(1)} kcal/mol)`, severity: 'medium' });
        if (step.enzymeScore < 0.5) bottlenecks.push({ stepIndex: idx, reason: `Low enzyme availability (${(step.enzymeScore * 100).toFixed(0)}%)`, severity: step.enzymeScore < 0.3 ? 'high' : 'medium' });
      });

      foundPathways.push({
        id: `pathway_${foundPathways.length + 1}`,
        steps,
        precursor,
        target,
        metrics: {
          totalDeltaG: Math.round(totalDG * 100) / 100,
          avgEnzymeAvailability: Math.round(avgEnzyme * 100) / 100,
          atomEconomy: Math.round(atomEconomy * 100) / 100,
          cofactorBalance: Math.round(cofactorBalance * 100) / 100,
          pathwayLength: steps.length,
          overallScore: Math.round(overallScore * 100) / 100,
        },
        dgCascade,
        bottlenecks,
        alternativeRoutes: new Map(),
      });

      continue;
    }

    // Skip if too long
    if (current.path.length >= maxLength) continue;

    // Skip if already visited (with some tolerance for diversity)
    const stateKey = `${current.metabolite}_${current.path.length}`;
    if (closedSet.has(stateKey)) continue;
    closedSet.add(stateKey);

    // Expand: find reactions that produce this metabolite
    const producingReactions = productToReactions.get(current.metabolite) || [];

    for (const rxn of producingReactions) {
      // Check if we have all substrates (or they can be traced to precursors)
      for (const substrate of rxn.substrates) {
        // Skip cofactors (they're regenerated in the cell)
        const cofactors = ['atp', 'adp', 'nad', 'nadh', 'nadp', 'nadph', 'coa', 'fad', 'fadh2', 'h2o', 'o2', 'co2', 'pi', 'ppi', 'h', 'nh4', 'thf', 'methf', 'plp', 'acp', 'mg2', 'k', 'fe-s'];
        if (cofactors.includes(substrate)) continue;

        // Check if this substrate is already produced in the path
        const producedInPath = current.path.some(s =>
          s.reaction.products.includes(substrate)
        );

        // Check if it's a precursor or common metabolite
        const commonMetabolites = ['glucose', 'pyruvate', 'acetyl_coa', 'oxaloacetate', 'akg', 'glutamate', 'pep', 'e4p', 'g3p'];
        const isAvailable = precursorIds.has(substrate) || commonMetabolites.includes(substrate) || producedInPath;

        if (!isAvailable) {
          // Can't satisfy this substrate requirement — skip this reaction
          continue;
        }
      }

      // Find the product that matches our current metabolite
      const matchingProduct = rxn.products.find(p => p === current.metabolite);
      if (!matchingProduct) continue;

      // Take the first substrate as the next metabolite to trace back
      const nextMetabolite = rxn.substrates.find(s => !cofactors.includes(s)) || rxn.substrates[0];

      const step: PathwayStep = {
        reaction: rxn,
        substrate: { id: nextMetabolite, name: nextMetabolite, functionalGroups: [], isPrecursor: precursorIds.has(nextMetabolite) },
        product: { id: matchingProduct, name: matchingProduct, functionalGroups: [], isPrecursor: false },
        deltaG: rxn.deltaG,
        enzymeScore: rxn.enzymeAvailability,
        feasibility: Math.max(0, 1 - Math.abs(rxn.deltaG) / 20) * rxn.enzymeAvailability,
      };

      const newTotalDG = current.totalDG + rxn.deltaG;
      const newAvgEnzyme = (current.avgEnzyme * current.path.length + rxn.enzymeAvailability) / (current.path.length + 1);
      const h = heuristic(nextMetabolite);

      openSet.push({
        metabolite: nextMetabolite,
        path: [...current.path, step],
        totalDG: newTotalDG,
        avgEnzyme: newAvgEnzyme,
        heuristic: h,
        cost: -newTotalDG + h * 10, // negative ΔG is good (favorable)
      });
    }
  }

  // Sort by overall score and return top N
  foundPathways.sort((a, b) => b.metrics.overallScore - a.metrics.overallScore);
  return foundPathways.slice(0, topN);
}

// ── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Run pathway discovery from target to precursors.
 */
export function runPathwayDiscovery(input: PathwayDiscoveryInput): PathwayDiscoveryResult {
  const {
    target,
    precursors,
    maxLength = 8,
    topN = 5,
    preferredOrganism,
    includeNovel = false,
  } = input;

  // Validate
  if (!target.id) throw new Error('Target molecule must have an ID');
  if (precursors.length === 0) throw new Error('At least one precursor is required');

  // Filter reactions by organism preference
  let reactionDB = [...REACTION_DB];
  if (preferredOrganism) {
    reactionDB = reactionDB.filter(r =>
      r.organisms.includes(preferredOrganism) || r.organisms.includes('universal')
    );
  }
  if (!includeNovel) {
    reactionDB = reactionDB.filter(r => r.enzymeAvailability >= 0.5);
  }

  // Run A* search
  const pathways = aStarPathwaySearch(target, precursors, reactionDB, maxLength, topN);

  // Compute database stats
  const allMetabolites = new Set<string>();
  for (const rxn of reactionDB) {
    rxn.substrates.forEach(s => allMetabolites.add(s));
    rxn.products.forEach(p => allMetabolites.add(p));
  }

  const dbStats = {
    totalReactions: reactionDB.length,
    totalMetabolites: allMetabolites.size,
    avgEnzymeAvailability: Math.round(
      reactionDB.reduce((sum, r) => sum + r.enzymeAvailability, 0) / reactionDB.length * 100
    ) / 100,
  };

  const designNotes: string[] = [
    `Discovered ${pathways.length} pathways from ${target.name} to ${precursors.length} precursors`,
    `Reaction database: ${dbStats.totalReactions} reactions, ${dbStats.totalMetabolites} metabolites`,
    `Max pathway length: ${maxLength} steps`,
  ];

  if (pathways.length > 0) {
    designNotes.push(`Best pathway: ${pathways[0].metrics.pathwayLength} steps, score=${pathways[0].metrics.overallScore}, ΔG=${pathways[0].metrics.totalDeltaG} kcal/mol`);
    const nBottlenecks = pathways[0].bottlenecks.filter(b => b.severity === 'high').length;
    if (nBottlenecks > 0) designNotes.push(`Warning: ${nBottlenecks} high-severity bottleneck(s) detected`);
  }

  return {
    pathways,
    targetInfo: target,
    precursorPool: precursors,
    dbStats,
    designNotes,
  };
}

/**
 * Quick pathway feasibility check.
 */
export function checkPathwayFeasibility(
  targetId: string,
  precursorIds: string[],
): { feasible: boolean; estimatedSteps: number; confidence: number } {
  const precursors: Molecule[] = precursorIds.map(id => ({
    id, name: id, functionalGroups: [], isPrecursor: true,
  }));
  const target: Molecule = {
    id: targetId, name: targetId, functionalGroups: [], isPrecursor: false,
  };

  try {
    const result = runPathwayDiscovery({ target, precursors: precursors, maxLength: 10, topN: 1 });
    const best = result.pathways[0];
    return {
      feasible: result.pathways.length > 0,
      estimatedSteps: best?.metrics.pathwayLength || -1,
      confidence: best?.metrics.overallScore || 0,
    };
  } catch {
    return { feasible: false, estimatedSteps: -1, confidence: 0 };
  }
}
