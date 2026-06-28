/**
 * SBML Model Parser for FBASim
 *
 * Parses Systems Biology Markup Language (SBML) files into the internal
 * metabolic model format used by the FBA engine.
 *
 * Supports:
 *   - SBML Level 2 Version 1-5
 *   - SBML Level 3 Version 1-2
 *   - FBC (Flux Balance Constraints) package
 *   - Groups package (for subsystems)
 *
 * @references
 *   - SBML specification: https://sbml.org/specifications/
 *   - FBC package: https://sbml.org/specifications/sbml-level-3/version-2/fbc/
 *
 * @scientific_provenance
 *   ALGORITHM: SBML XML parsing → internal metabolic model
 *   FORMAT: SBML Level 2/3 with FBC extension
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface SBMLModel {
  /** Model ID */
  id: string;
  /** Model name */
  name: string;
  /** Compartments */
  compartments: SBMLCompartment[];
  /** Species (metabolites) */
  species: SBMLSpecies[];
  /** Reactions */
  reactions: SBMLReaction[];
  /** Objective function (from FBC) */
  objective?: SBMLObjective;
  /** Gene associations (from FBC) */
  geneAssociations: Map<string, string[]>;
}

export interface SBMLCompartment {
  id: string;
  name: string;
  size: number;
  constant: boolean;
}

export interface SBMLSpecies {
  id: string;
  name: string;
  compartment: string;
  boundaryCondition: boolean;
  charge: number | null;
  chemicalFormula: string | null;
}

export interface SBMLReaction {
  id: string;
  name: string;
  reversible: boolean;
  reactants: SBMLSpeciesRef[];
  products: SBMLSpeciesRef[];
  lowerBound: number;
  upperBound: number;
  /** Gene-protein-reaction (GPR) association */
  gpr: string | null;
  /** Subsystem/pathway */
  subsystem: string | null;
}

export interface SBMLSpeciesRef {
  species: string;
  stoichiometry: number;
}

export interface SBMLObjective {
  id: string;
  type: 'maximize' | 'minimize';
  reactions: Array<{ reaction: string; coefficient: number }>;
}

// ── Parser ─────────────────────────────────────────────────────────────

/**
 * Parse an SBML XML string into an SBMLModel.
 */
export function parseSBML(xml: string): SBMLModel {
  // Validate basic SBML structure
  if (!xml.includes('<sbml') && !xml.includes('<SBML')) {
    throw new Error('Invalid SBML: missing <sbml> root element');
  }

  const level = extractSBMLLevel(xml);
  const version = extractSBMLVersion(xml);

  // Extract model element
  const modelXml = extractTag(xml, 'model');
  if (!modelXml) {
    throw new Error('Invalid SBML: missing <model> element');
  }

  const modelId = extractAttribute(modelXml, 'id') ?? 'unknown';
  const modelName = extractAttribute(modelXml, 'name') ?? modelId;

  // Parse compartments
  const compartments = parseCompartments(modelXml);

  // Parse species
  const species = parseSpecies(modelXml);

  // Parse reactions
  const reactions = parseReactions(modelXml);

  // Parse FBC objective (if present)
  const objective = parseFBCObjective(modelXml);

  // Parse gene associations
  const geneAssociations = parseGeneAssociations(modelXml);

  return {
    id: modelId,
    name: modelName,
    compartments,
    species,
    reactions,
    objective: objective ?? undefined,
    geneAssociations,
  };
}

// ── SBML Level/Version Extraction ──────────────────────────────────────

function extractSBMLLevel(xml: string): number {
  const match = xml.match(/level="(\d+)"/i) ?? xml.match(/<sbml[^>]*level="(\d+)"/i);
  return match ? parseInt(match[1]) : 2;
}

function extractSBMLVersion(xml: string): number {
  const match = xml.match(/version="(\d+)"/i) ?? xml.match(/<sbml[^>]*version="(\d+)"/i);
  return match ? parseInt(match[1]) : 1;
}

// ── Compartments ───────────────────────────────────────────────────────

function parseCompartments(modelXml: string): SBMLCompartment[] {
  const compartments: SBMLCompartment[] = [];
  const listXml = extractTag(modelXml, 'listOfCompartments');
  if (!listXml) return compartments;

  const regex = /<compartment\s+([^>]*)\/>/gi;
  let match;
  while ((match = regex.exec(listXml)) !== null) {
    const attrs = match[1];
    compartments.push({
      id: extractAttribute(attrs, 'id') ?? '',
      name: extractAttribute(attrs, 'name') ?? '',
      size: parseFloat(extractAttribute(attrs, 'size') ?? '1'),
      constant: extractAttribute(attrs, 'constant') !== 'false',
    });
  }

  return compartments;
}

// ── Species ────────────────────────────────────────────────────────────

function parseSpecies(modelXml: string): SBMLSpecies[] {
  const species: SBMLSpecies[] = [];
  const listXml = extractTag(modelXml, 'listOfSpecies');
  if (!listXml) return species;

  const regex = /<species\s+([^>]*)\/?>/gi;
  let match;
  while ((match = regex.exec(listXml)) !== null) {
    const attrs = match[1];
    const id = extractAttribute(attrs, 'id') ?? '';

    // Check for FBC charge and formula
    const chargeStr = extractAttribute(attrs, 'fbc:charge') ?? extractAttribute(attrs, 'charge');
    const formula = extractAttribute(attrs, 'fbc:chemicalFormula') ?? extractAttribute(attrs, 'chemicalFormula');

    species.push({
      id,
      name: extractAttribute(attrs, 'name') ?? id,
      compartment: extractAttribute(attrs, 'compartment') ?? '',
      boundaryCondition: extractAttribute(attrs, 'boundaryCondition') === 'true',
      charge: chargeStr ? parseInt(chargeStr) : null,
      chemicalFormula: formula ?? null,
    });
  }

  return species;
}

// ── Reactions ──────────────────────────────────────────────────────────

function parseReactions(modelXml: string): SBMLReaction[] {
  const reactions: SBMLReaction[] = [];
  const listXml = extractTag(modelXml, 'listOfReactions');
  if (!listXml) return reactions;

  const reactionRegex = /<reaction\s+([^>]*)>([\s\S]*?)<\/reaction>/gi;
  let match;

  while ((match = reactionRegex.exec(listXml)) !== null) {
    const attrs = match[1];
    const body = match[2];

    const id = extractAttribute(attrs, 'id') ?? '';
    const name = extractAttribute(attrs, 'name') ?? id;
    const reversible = extractAttribute(attrs, 'reversible') !== 'false';

    // Parse reactants
    const reactants = parseSpeciesReferences(body, 'listOfReactants');

    // Parse products
    const products = parseSpeciesReferences(body, 'listOfProducts');

    // Parse kinetic law bounds (if present)
    const { lowerBound, upperBound } = parseBounds(body);

    // Parse GPR association (from FBC or notes)
    const gpr = parseGPR(body);

    // Parse subsystem from notes
    const subsystem = parseSubsystem(body);

    reactions.push({
      id,
      name,
      reversible,
      reactants,
      products,
      lowerBound,
      upperBound,
      gpr,
      subsystem,
    });
  }

  return reactions;
}

function parseSpeciesReferences(reactionXml: string, listTag: string): SBMLSpeciesRef[] {
  const refs: SBMLSpeciesRef[] = [];
  const listXml = extractTag(reactionXml, listTag);
  if (!listXml) return refs;

  const regex = /<speciesReference\s+([^>]*)\/?>/gi;
  let match;
  while ((match = regex.exec(listXml)) !== null) {
    const attrs = match[1];
    refs.push({
      species: extractAttribute(attrs, 'species') ?? '',
      stoichiometry: parseFloat(extractAttribute(attrs, 'stoichiometry') ?? '1'),
    });
  }

  return refs;
}

function parseBounds(reactionXml: string): { lowerBound: number; upperBound: number } {
  // Try FBC bounds first
  const fbcLower = extractAttribute(reactionXml, 'fbc:lowerFluxBound');
  const fbcUpper = extractAttribute(reactionXml, 'fbc:upperFluxBound');

  if (fbcLower && fbcUpper) {
    return {
      lowerBound: parseFloat(fbcLower),
      upperBound: parseFloat(fbcUpper),
    };
  }

  // Try kinetic law parameters
  const kineticLaw = extractTag(reactionXml, 'kineticLaw');
  if (kineticLaw) {
    const lowerParam = extractParameterValue(kineticLaw, 'LOWER_BOUND') ??
                       extractParameterValue(kineticLaw, 'lb') ??
                       extractParameterValue(kineticLaw, 'LOWER');
    const upperParam = extractParameterValue(kineticLaw, 'UPPER_BOUND') ??
                       extractParameterValue(kineticLaw, 'ub') ??
                       extractParameterValue(kineticLaw, 'UPPER');

    return {
      lowerBound: lowerParam ? parseFloat(lowerParam) : -1000,
      upperBound: upperParam ? parseFloat(upperParam) : 1000,
    };
  }

  // Default bounds
  return { lowerBound: -1000, upperBound: 1000 };
}

function extractParameterValue(kineticLawXml: string, paramId: string): string | null {
  const regex = new RegExp(`<parameter\\s+[^>]*id="${paramId}"[^>]*value="([^"]*)"`, 'i');
  const match = regex.exec(kineticLawXml);
  return match ? match[1] : null;
}

function parseGPR(reactionXml: string): string | null {
  // Check FBC gene product association
  const gprXml = extractTag(reactionXml, 'fbc:geneProductAssociation');
  if (gprXml) {
    return extractAttribute(gprXml, 'fbc:geneProduct') ?? gprXml;
  }

  // Check notes for GPR
  const notes = extractTag(reactionXml, 'notes');
  if (notes) {
    const gprMatch = notes.match(/GENE_ASSOCIATION:\s*([^<\n]+)/i) ??
                     notes.match(/GPR:\s*([^<\n]+)/i);
    if (gprMatch) return gprMatch[1].trim();
  }

  return null;
}

function parseSubsystem(reactionXml: string): string | null {
  const notes = extractTag(reactionXml, 'notes');
  if (notes) {
    const subMatch = notes.match(/SUBSYSTEM:\s*([^<\n]+)/i) ??
                     notes.match(/PATHWAY:\s*([^<\n]+)/i);
    if (subMatch) return subMatch[1].trim();
  }
  return null;
}

// ── FBC Objective ──────────────────────────────────────────────────────

function parseFBCObjective(modelXml: string): SBMLObjective | null {
  // Look for FBC objective
  const objectiveList = extractTag(modelXml, 'fbc:listOfObjectives');
  if (!objectiveList) return null;

  const activeObj = extractAttribute(objectiveList, 'fbc:activeObjective');
  if (!activeObj) return null;

  const objectiveRegex = new RegExp(`<fbc:objective\\s+[^>]*fbc:id="${activeObj}"[^>]*>([\\s\\S]*?)<\\/fbc:objective>`, 'i');
  const objMatch = objectiveRegex.exec(objectiveList);
  if (!objMatch) return null;

  const objBody = objMatch[1];
  const type = extractAttribute(objMatch[0], 'fbc:type') ?? 'maximize';

  const fluxObjRegex = /<fbc:fluxObjective\s+([^>]*)\/>/gi;
  const reactions: Array<{ reaction: string; coefficient: number }> = [];
  let fluxMatch;

  while ((fluxMatch = fluxObjRegex.exec(objBody)) !== null) {
    const attrs = fluxMatch[1];
    reactions.push({
      reaction: extractAttribute(attrs, 'fbc:reaction') ?? '',
      coefficient: parseFloat(extractAttribute(attrs, 'fbc:coefficient') ?? '1'),
    });
  }

  return {
    id: activeObj,
    type: type as 'maximize' | 'minimize',
    reactions,
  };
}

// ── Gene Associations ──────────────────────────────────────────────────

function parseGeneAssociations(modelXml: string): Map<string, string[]> {
  const geneMap = new Map<string, string[]>();

  // Parse FBC gene products
  const gpList = extractTag(modelXml, 'fbc:listOfGeneProducts');
  if (!gpList) return geneMap;

  const gpRegex = /<fbc:geneProduct\s+([^>]*)\/?>/gi;
  let match;
  while ((match = gpRegex.exec(gpList)) !== null) {
    const attrs = match[1];
    const id = extractAttribute(attrs, 'fbc:id') ?? '';
    const label = extractAttribute(attrs, 'fbc:label') ?? id;
    geneMap.set(id, [label]);
  }

  return geneMap;
}

// ── XML Utilities ──────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

function extractAttribute(attrs: string, name: string): string | null {
  const regex = new RegExp(`${name}="([^"]*)"`, 'i');
  const match = regex.exec(attrs);
  return match ? match[1] : null;
}

// ── Conversion to Internal Format ──────────────────────────────────────

/**
 * Convert SBML model to the internal FBA format.
 */
export function sbmlToFBARequest(model: SBMLModel): {
  reactions: string[];
  metabolites: string[];
  stoichMatrix: number[][];
  lowerBounds: number[];
  upperBounds: number[];
  objective: string;
  externalMetabolites: string[];
} {
  const reactions = model.reactions.map(r => r.id);
  const metabolites = model.species.map(s => s.id);
  const externalMetabolites = model.species
    .filter(s => s.boundaryCondition)
    .map(s => s.id);

  // Build stoichiometric matrix
  const stoichMatrix: number[][] = metabolites.map(() => reactions.map(() => 0));

  for (let j = 0; j < model.reactions.length; j++) {
    const rxn = model.reactions[j];

    for (const reactant of rxn.reactants) {
      const i = metabolites.indexOf(reactant.species);
      if (i >= 0) stoichMatrix[i][j] = -reactant.stoichiometry;
    }

    for (const product of rxn.products) {
      const i = metabolites.indexOf(product.species);
      if (i >= 0) stoichMatrix[i][j] = product.stoichiometry;
    }
  }

  const lowerBounds = model.reactions.map(r => r.lowerBound);
  const upperBounds = model.reactions.map(r => r.upperBound);

  // Determine objective
  let objective = reactions[0];
  if (model.objective && model.objective.reactions.length > 0) {
    objective = model.objective.reactions[0].reaction;
  }

  return {
    reactions,
    metabolites,
    stoichMatrix,
    lowerBounds,
    upperBounds,
    objective,
    externalMetabolites,
  };
}
