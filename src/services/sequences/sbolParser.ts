/**
 * SBOL 2.0/3.0 Import Parser
 *
 * Parses SBOL XML into Nexus-Bio's internal data model.
 * Supports both SBOL 2.0 (sbol2: namespace) and SBOL 3.0 (sbol: namespace).
 *
 * Biological context:
 * - SBOL (Synthetic Biology Open Language) is the standard for describing
 *   genetic constructs, parts, and their relationships
 * - SO (Sequence Ontology) terms describe part roles (promoter, CDS, etc.)
 * - BioPAX types classify molecules (DnaRegion, RnaRegion, Protein)
 *
 * Reference: https://sbolstandard.org/
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SBOLAnnotation {
  name: string;
  start: number;
  end: number;
  strand: number; // 1 = forward, -1 = reverse
  role: string;
}

export interface SBOLComponent {
  id: string;
  name: string;
  type: "DNA" | "RNA" | "protein";
  sequence: string;
  roles: string[];
  annotations: SBOLAnnotation[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BIOPAX_DNA = "http://www.biopax.org/release/biopax-level3.owl#DnaRegion";
const BIOPAX_RNA = "http://www.biopax.org/release/biopax-level3.owl#RnaRegion";
const BIOPAX_PROTEIN = "http://www.biopax.org/release/biopax-level3.owl#Protein";

const SO_URI_PREFIX = "http://identifiers.org/SO:";

const SBOL3_NAMESPACE = "http://sbols.org/v3#";
const SBOL2_NAMESPACE = "http://sbols.org/v2#";

// SO terms for common genetic parts
const SO_ROLE_MAP: Record<string, string> = {
  "SO:0000167": "promoter",
  "SO:0000139": "ribosome_entry_site",
  "SO:0000316": "CDS",
  "SO:0000141": "terminator",
  "SO:0000804": "engineered_region",
  "SO:0000110": "sequence_feature",
  "SO:0000296": "origin_of_replication",
  "SO:0000057": "operator",
};

// ── XML helpers (regex-based, no external library) ─────────────────────────────

/**
 * Extract text content from the first occurrence of a tag.
 * Returns empty string if tag not found.
 */
function extractTag(xml: string, tag: string): string {
  // Match <tag>content</tag> or <tag attr="...">content</tag>
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Extract an rdf:resource attribute from a self-closing or opening tag.
 */
function extractResource(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*rdf:resource="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1] : "";
}

/**
 * Extract all rdf:resource attributes for a given tag.
 */
function extractAllResources(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*rdf:resource="([^"]*)"`, "gi");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * Extract all blocks matching a tag (including the tag itself).
 */
function extractBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, "gi");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[0]);
  }
  return results;
}

// ── Version detection ──────────────────────────────────────────────────────────

/**
 * Detect the SBOL version from namespace declarations.
 * Returns "2.0" or "3.0".
 */
function detectSBOLVersion(xml: string): "2.0" | "3.0" {
  // SBOL 3.0 uses xmlns:sbol="http://sbols.org/v3#"
  if (xml.includes(`xmlns:sbol="${SBOL3_NAMESPACE}"`)) return "3.0";
  // SBOL 2.0 uses xmlns:sbol2="http://sbols.org/v2#"
  if (xml.includes(`xmlns:sbol2="${SBOL2_NAMESPACE}"`)) return "2.0";
  // Fallback: check for namespace in content
  if (xml.includes(SBOL3_NAMESPACE)) return "3.0";
  if (xml.includes(SBOL2_NAMESPACE)) return "2.0";
  // Default to 3.0
  return "3.0";
}

// ── Type inference ─────────────────────────────────────────────────────────────

function inferTypeFromBioPAX(uri: string): "DNA" | "RNA" | "protein" {
  if (uri.includes(BIOPAX_RNA)) return "RNA";
  if (uri.includes(BIOPAX_PROTEIN)) return "protein";
  if (uri.includes(BIOPAX_DNA)) return "DNA";
  return "DNA";
}

// ── SO role extraction ─────────────────────────────────────────────────────────

function extractRolesFromUris(uris: string[]): string[] {
  return uris.map((uri) => {
    // Extract SO term from URI
    if (uri.startsWith(SO_URI_PREFIX)) {
      const soTerm = "SO:" + uri.slice(SO_URI_PREFIX.length);
      return SO_ROLE_MAP[soTerm] ?? soTerm;
    }
    // Already a plain SO term
    if (uri.startsWith("SO:")) {
      return SO_ROLE_MAP[uri] ?? uri;
    }
    return uri;
  });
}

// ── SBOL 3.0 Parser ───────────────────────────────────────────────────────────

function parseSBOL3Component(block: string, _namespace: string): SBOLComponent | null {
  const displayId = extractTag(block, "sbol:displayId");
  if (!displayId) return null;

  const name = extractTag(block, "sbol:name") || displayId;

  // Type: sbol:type with rdf:resource
  const typeUri = extractResource(block, "sbol:type");
  const type = inferTypeFromBioPAX(typeUri);

  // Roles: multiple sbol:role elements
  const roleUris = extractAllResources(block, "sbol:role");
  const roles = extractRolesFromUris(roleUris);

  // Sequence: find sbol:hasSequence -> sbol:elements
  let sequence = "";
  const sequenceBlocks = extractBlocks(block, "sbol:hasSequence");
  if (sequenceBlocks.length > 0) {
    sequence = extractTag(sequenceBlocks[0], "sbol:elements");
  }
  // Also check for sbol:elements directly (sometimes inlined)
  if (!sequence) {
    sequence = extractTag(block, "sbol:elements");
  }

  // Annotations: sbol:hasFeature -> sbol:SequenceFeature with location and role
  const annotations: SBOLAnnotation[] = [];
  const featureBlocks = extractBlocks(block, "sbol:hasFeature");
  for (const feature of featureBlocks) {
    const rangeBlocks = extractBlocks(feature, "sbol:Range");
    for (const range of rangeBlocks) {
      const start = Number.parseInt(extractTag(range, "sbol:start"), 10);
      const end = Number.parseInt(extractTag(range, "sbol:end"), 10);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;

      const orientationUri = extractResource(range, "sbol:orientation");
      const strand = orientationUri.includes("reverseComplement") ? -1 : 1;

      const featureRoleUris = extractAllResources(feature, "sbol:role");
      const featureRoles = extractRolesFromUris(featureRoleUris);

      annotations.push({
        name: extractTag(feature, "sbol:displayId") || name,
        start,
        end,
        strand,
        role: featureRoles[0] ?? "sequence_feature",
      });
    }
  }

  return {
    id: displayId,
    name,
    type,
    sequence,
    roles,
    annotations,
  };
}

// ── SBOL 2.0 Parser ───────────────────────────────────────────────────────────

function parseSBOL2Component(block: string, _namespace: string): SBOLComponent | null {
  const displayId = extractTag(block, "sbol2:displayId");
  if (!displayId) return null;

  const name = extractTag(block, "sbol2:name") || displayId;

  // Type: sbol2:type with rdf:resource
  const typeUri = extractResource(block, "sbol2:type");
  const type = inferTypeFromBioPAX(typeUri);

  // Roles: multiple sbol2:role elements
  const roleUris = extractAllResources(block, "sbol2:role");
  const roles = extractRolesFromUris(roleUris);

  // Sequence: find sbol2:sequence -> sbol2:elements
  let sequence = "";
  const sequenceBlocks = extractBlocks(block, "sbol2:sequence");
  if (sequenceBlocks.length > 0) {
    sequence = extractTag(sequenceBlocks[0], "sbol2:elements");
  }
  if (!sequence) {
    sequence = extractTag(block, "sbol2:elements");
  }

  // Annotations: sbol2:sequenceAnnotation with location
  const annotations: SBOLAnnotation[] = [];
  const annotationBlocks = extractBlocks(block, "sbol2:sequenceAnnotation");
  for (const annotation of annotationBlocks) {
    const rangeBlocks = extractBlocks(annotation, "sbol2:Range");
    for (const range of rangeBlocks) {
      const start = Number.parseInt(extractTag(range, "sbol2:start"), 10);
      const end = Number.parseInt(extractTag(range, "sbol2:end"), 10);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;

      const orientationUri = extractResource(range, "sbol2:orientation");
      const strand = orientationUri.includes("reverseComplement") ? -1 : 1;

      const annotRoleUris = extractAllResources(annotation, "sbol2:role");
      const annotRoles = extractRolesFromUris(annotRoleUris);

      annotations.push({
        name: extractTag(annotation, "sbol2:displayId") || name,
        start,
        end,
        strand,
        role: annotRoles[0] ?? "sequence_feature",
      });
    }
  }

  return {
    id: displayId,
    name,
    type,
    sequence,
    roles,
    annotations,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Detect whether a string contains SBOL-formatted XML.
 *
 * Checks for SBOL namespace declarations and RDF root element.
 */
export function isSBOLFile(content: string): boolean {
  if (!content || typeof content !== "string") return false;
  // Must be XML-like
  if (!content.includes("<?xml") && !content.includes("<rdf:RDF")) return false;
  // Must have an SBOL namespace
  return (
    content.includes("http://sbols.org/v3#") ||
    content.includes("http://sbols.org/v2#") ||
    content.includes("sbols.org")
  );
}

/**
 * Parse SBOL XML into an array of SBOLComponent objects.
 *
 * Supports both SBOL 2.0 and 3.0 formats.
 * Each top-level Component (3.0) or ComponentDefinition (2.0) becomes
 * one SBOLComponent in the output.
 *
 * @param xmlString - Raw SBOL XML content
 * @returns Array of parsed components
 * @throws Error if the XML is malformed or not SBOL
 */
export function parseSBOL(xmlString: string): SBOLComponent[] {
  if (!xmlString || typeof xmlString !== "string") {
    throw new Error("Invalid input: expected a non-empty string");
  }

  if (!isSBOLFile(xmlString)) {
    throw new Error("Invalid SBOL: document does not contain SBOL namespace declarations");
  }

  const version = detectSBOLVersion(xmlString);
  const components: SBOLComponent[] = [];

  // Extract namespace from the first rdf:about or use default
  const nsMatch = xmlString.match(/rdf:about="([^"]*?)\/[^/]*"/);
  const namespace = nsMatch ? nsMatch[1] : "https://nexus-bio.org/sbol3";

  if (version === "3.0") {
    // Parse sbol:Component blocks
    const componentBlocks = extractBlocks(xmlString, "sbol:Component");
    for (const block of componentBlocks) {
      const component = parseSBOL3Component(block, namespace);
      if (component) components.push(component);
    }

    // Also parse sbol:SubComponent blocks as separate components
    const subComponentBlocks = extractBlocks(xmlString, "sbol:SubComponent");
    for (const block of subComponentBlocks) {
      const component = parseSBOL3Component(block, namespace);
      if (component) components.push(component);
    }
  } else {
    // Parse sbol2:ComponentDefinition blocks
    const componentBlocks = extractBlocks(xmlString, "sbol2:ComponentDefinition");
    for (const block of componentBlocks) {
      const component = parseSBOL2Component(block, namespace);
      if (component) components.push(component);
    }
  }

  return components;
}
