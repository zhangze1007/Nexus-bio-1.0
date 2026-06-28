/**
 * Sequence Export & Format Detection
 *
 * Export DNA/protein sequences to standard bioinformatics formats:
 * - FASTA: simple header + wrapped sequence lines
 * - GenBank: flat-file format with LOCUS, FEATURES, ORIGIN sections
 * - SBOL 3.0: XML with Component, Sequence, and SequenceFeature elements
 *
 * Also provides autoDetectFormat() for content-based format identification.
 *
 * All positions in features are 1-based inclusive (bioinformatics convention).
 * Pure TypeScript — no external dependencies.
 *
 * References:
 *   - FASTA: https://www.ncbi.nlm.nih.gov/genbank/fastaformat/
 *   - GenBank: https://www.ncbi.nlm.nih.gov/Sitemap/samplerecord.html
 *   - SBOL 3.0: https://sbolstandard.org/
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * A sequence feature/annotation for export.
 *
 * Positions are 1-based inclusive (bioinformatics convention),
 * matching GenBank and SBOL coordinate systems.
 */
export interface SequenceFeature {
  /** Feature name (e.g. "lacZ", "AmpR promoter") */
  name: string;
  /** 1-based start position */
  start: number;
  /** 1-based end position (inclusive) */
  end: number;
  /** Strand: 1 = forward/sense, -1 = reverse/complement */
  strand: 1 | -1;
  /** Feature type (e.g. "CDS", "promoter", "terminator", "misc_feature") */
  type: string;
  /** Optional qualifier key-value pairs (used in GenBank /qualifier="value" and SBOL annotations) */
  qualifiers?: Record<string, string>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FASTA_LINE_WIDTH = 80;

/** GenBank feature table indentation: 5 spaces for location, 16 spaces for qualifiers */
const GB_FEATURE_INDENT = "     ";
const GB_QUALIFIER_INDENT = "                ";

/** SBOL namespaces */
const SBOL3_NS = "http://sbols.org/v3#";
const SO_NS = "http://identifiers.org/SO:";
const BIOPAX_DNA = "http://www.biopax.org/release/biopax-level3.owl#DnaRegion";
const BIOPAX_PROTEIN = "http://www.biopax.org/release/biopax-level3.owl#Protein";

/** Map feature types to SO (Sequence Ontology) URIs */
const SO_TERM_MAP: Record<string, string> = {
  promoter: "SO:0000167",
  ribosome_entry_site: "SO:0000139",
  CDS: "SO:0000316",
  terminator: "SO:0000141",
  gene: "SO:0000704",
  misc_feature: "SO:0000110",
  engineered_region: "SO:0000804",
  origin_of_replication: "SO:0000296",
  operator: "SO:0000057",
  regulatory: "SO:0005836",
  rep_origin: "SO:0000296",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Wrap a sequence string into fixed-width lines for FASTA output.
 */
function wrapSequence(seq: string, width: number): string {
  const lines: string[] = [];
  for (let i = 0; i < seq.length; i += width) {
    lines.push(seq.slice(i, i + width));
  }
  return lines.join("\n");
}

/**
 * Format a feature location for GenBank flat file.
 * Uses join(complement(...)) notation for multi-exon or reverse-strand features.
 */
function formatGenBankLocation(feature: SequenceFeature): string {
  const loc = `${feature.start}..${feature.end}`;
  return feature.strand === -1 ? `complement(${loc})` : loc;
}

/**
 * Determine if a string looks like a protein sequence (contains amino acid
 * characters that are not valid DNA bases).
 */
function isProteinSequence(seq: string): boolean {
  const upper = seq.toUpperCase().replace(/[^A-Z]/g, "");
  const dnaBases = /^[ATCGRYSWKMBDHVN]+$/;
  return !dnaBases.test(upper);
}

// ── FASTA Export ───────────────────────────────────────────────────────────────

/**
 * Export a sequence to FASTA format.
 *
 * Produces a standard FASTA file with a single-line header (>name) followed by
 * the sequence wrapped at 80 characters per line.
 *
 * @param sequence - The nucleotide or amino acid sequence
 * @param name - Sequence name/identifier for the header line
 * @returns FASTA-formatted string
 * @throws Error if sequence or name is empty
 */
export function exportToFasta(sequence: string, name: string): string {
  if (!sequence || sequence.length === 0) {
    throw new Error("Cannot export empty sequence to FASTA");
  }
  if (!name || name.trim().length === 0) {
    throw new Error("Sequence name is required for FASTA export");
  }

  const header = `>${name.trim()}`;
  const cleanedSeq = sequence.toUpperCase().replace(/[^A-Z]/g, "");
  const body = wrapSequence(cleanedSeq, FASTA_LINE_WIDTH);

  return `${header}\n${body}\n`;
}

// ── GenBank Export ─────────────────────────────────────────────────────────────

/**
 * Export a sequence with features to GenBank flat-file format.
 *
 * Generates the standard GenBank record sections:
 *   LOCUS       — name, length, molecule type, topology, division, date
 *   FEATURES    — feature table with /qualifier="value" lines
 *   ORIGIN      — numbered sequence lines (60 bp, groups of 10)
 *   //
 *
 * @param sequence - The nucleotide sequence
 * @param features - Array of annotated features (1-based inclusive coordinates)
 * @param name - Locus/sequence name
 * @returns GenBank flat-file formatted string
 * @throws Error if sequence or name is empty
 */
export function exportToGenBank(sequence: string, features: SequenceFeature[], name: string): string {
  if (!sequence || sequence.length === 0) {
    throw new Error("Cannot export empty sequence to GenBank");
  }
  if (!name || name.trim().length === 0) {
    throw new Error("Sequence name is required for GenBank export");
  }

  const cleanedSeq = sequence.toUpperCase().replace(/[^A-Z]/g, "");
  const seqLen = cleanedSeq.length;
  const locusName = name.trim().replace(/\s+/g, "_").slice(0, 16);
  const isProtein = isProteinSequence(cleanedSeq);
  const moleculeType = isProtein ? "AA" : "DNA";
  const division = "SYN"; // Synthetic biology
  const date = new Date()
    .toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/ /g, "-")
    .toUpperCase();

  // LOCUS line (fixed-width columns)
  const locusLine = `LOCUS       ${locusName.padEnd(16)} ${String(seqLen).padStart(7)} ${moleculeType}    ${isProtein ? "linear" : "circular"}  ${division} ${date}`;

  // DEFINITION line
  const definitionLine = `DEFINITION  ${locusName}.`;

  // ACCESSION and VERSION placeholders
  const accessionLine = `ACCESSION   ${locusName}`;
  const versionLine = `VERSION     ${locusName}.1`;

  // FEATURES section
  const featureHeader = "FEATURES             Location/Qualifiers";
  const featureLines: string[] = [];

  // Sort features by start position
  const sortedFeatures = [...features].sort((a, b) => a.start - b.start);

  for (const feat of sortedFeatures) {
    const location = formatGenBankLocation(feat);
    const typePad = Math.max(feat.type.length + 1, 16);
    featureLines.push(`${GB_FEATURE_INDENT}${feat.type.padEnd(typePad)}${location}`);

    // Standard qualifiers
    featureLines.push(`${GB_QUALIFIER_INDENT}/gene="${feat.name}"`);

    if (feat.qualifiers) {
      for (const [key, value] of Object.entries(feat.qualifiers)) {
        // Skip "gene" since we already emitted it from feat.name
        if (key === "gene") continue;
        featureLines.push(`${GB_QUALIFIER_INDENT}/${key}="${value}"`);
      }
    }
  }

  // ORIGIN section (60 characters per line, grouped in 10s)
  const originHeader = "ORIGIN";
  const originLines: string[] = [];

  if (!isProtein) {
    for (let i = 0; i < seqLen; i += 60) {
      const lineSeq = cleanedSeq.slice(i, i + 60);
      const position = String(i + 1).padStart(9);
      // Group in 10-character blocks
      const groups: string[] = [];
      for (let j = 0; j < lineSeq.length; j += 10) {
        groups.push(lineSeq.slice(j, j + 10));
      }
      originLines.push(`${position} ${groups.join(" ")}`);
    }
  } else {
    // For protein sequences, write raw sequence after ORIGIN
    originLines.push(`         ${cleanedSeq}`);
  }

  const terminator = "//";

  // Assemble the record
  const sections = [
    locusLine,
    definitionLine,
    accessionLine,
    versionLine,
    featureHeader,
    ...featureLines,
    originHeader,
    ...originLines,
    terminator,
  ];

  return sections.join("\n") + "\n";
}

// ── SBOL 3.0 Export ───────────────────────────────────────────────────────────

/**
 * Export a sequence with features to SBOL 3.0 XML format.
 *
 * Generates an SBOL 3.0 document containing:
 *   - A Component (top-level design element) with type and roles
 *   - An inline Sequence with nucleotides element
 *   - SequenceFeature annotations with Range locations and SO roles
 *
 * @param sequence - The nucleotide or amino acid sequence
 * @param features - Array of annotated features (1-based inclusive coordinates)
 * @param name - Component display name
 * @returns SBOL 3.0 XML string
 * @throws Error if sequence or name is empty
 */
export function exportToSBOL(sequence: string, features: SequenceFeature[], name: string): string {
  if (!sequence || sequence.length === 0) {
    throw new Error("Cannot export empty sequence to SBOL");
  }
  if (!name || name.trim().length === 0) {
    throw new Error("Sequence name is required for SBOL export");
  }

  const cleanedSeq = sequence.toUpperCase().replace(/[^A-Z]/g, "");
  const displayName = name.trim();
  const displayId = displayName.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "") || "sequence";
  const isProtein = isProteinSequence(cleanedSeq);
  const componentType = isProtein ? BIOPAX_PROTEIN : BIOPAX_DNA;

  // Build hasFeature blocks — each feature is a separate sbol:hasFeature element
  const featureElements: string[] = [];
  for (let i = 0; i < features.length; i++) {
    const feat = features[i];
    const featId = `${displayId}_feature_${i + 1}`;
    const soUri = SO_TERM_MAP[feat.type] ?? SO_TERM_MAP.misc_feature;
    const orientation = feat.strand === -1 ? "http://sbols.org/v3#reverseComplement" : "http://sbols.org/v3#inline";

    featureElements.push(
      `    <sbol:hasFeature>`,
      `      <sbol:SequenceFeature sbol:displayId="${featId}">`,
      `        <sbol:role rdf:resource="${SO_NS}${soUri.replace("SO:", "")}"/>`,
      `        <sbol:location>`,
      `          <sbol:Range sbol:displayId="${featId}_range" sbol:start="${feat.start}" sbol:end="${feat.end}" sbol:orientation="${orientation}"/>`,
      `        </sbol:location>`,
      `      </sbol:SequenceFeature>`,
      `    </sbol:hasFeature>`,
    );
  }

  // Build role list for the Component
  const componentRoles: string[] = [];
  for (const feat of features) {
    const soUri = SO_TERM_MAP[feat.type];
    if (soUri) {
      componentRoles.push(`    <sbol:role rdf:resource="${SO_NS}${soUri.replace("SO:", "")}"/>`);
    }
  }

  // XML document
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"`,
    `         xmlns:sbol="${SBOL3_NS}"`,
    `         xmlns:dcterms="http://purl.org/dc/terms/">`,
    ``,
    `  <sbol:Component rdf:about="https://nexus-bio.org/sbol3/${displayId}">`,
    `    <sbol:displayId>${displayId}</sbol:displayId>`,
    `    <sbol:name>${displayName}</sbol:name>`,
    `    <sbol:type rdf:resource="${componentType}"/>`,
    ...componentRoles,
    `    <sbol:hasSequence>`,
    `      <sbol:Sequence rdf:about="https://nexus-bio.org/sbol3/${displayId}/sequence">`,
    `        <sbol:displayId>${displayId}_seq</sbol:displayId>`,
    `        <sbol:elements>${cleanedSeq}</sbol:elements>`,
    `        <sbol:encoding rdf:resource="${isProtein ? "http://www.chem.qmul.ac.uk/iubmb/misc/na33.html" : "http://www.chem.qmul.ac.uk/iupac/aigo/"}"/>`,
    `      </sbol:Sequence>`,
    `    </sbol:hasSequence>`,
    ...featureElements,
    `  </sbol:Component>`,
    ``,
    `</rdf:RDF>`,
    ``,
  ].join("\n");

  return xml;
}

// ── Format Detection ───────────────────────────────────────────────────────────

/**
 * Auto-detect the format of a sequence file from its content.
 *
 * Detection order:
 *   1. SBOL — XML with SBOL namespace declarations
 *   2. GenBank — starts with "LOCUS " or contains "FEATURES" and "ORIGIN"
 *   3. FASTA — starts with ">" followed by a header line
 *   4. "unknown" — no recognized format
 *
 * @param content - Raw file content string
 * @returns Detected format identifier
 */
export function autoDetectFormat(content: string): "fasta" | "genbank" | "sbol" | "unknown" {
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return "unknown";
  }

  const trimmed = content.trimStart();

  // SBOL: XML with SBOL namespace (check first — XML files might also contain
  // text that looks like GenBank or FASTA)
  if (
    (trimmed.startsWith("<?xml") || trimmed.startsWith("<rdf:RDF")) &&
    (content.includes("http://sbols.org/v3#") ||
      content.includes("http://sbols.org/v2#") ||
      content.includes("sbols.org"))
  ) {
    return "sbol";
  }

  // GenBank: first non-empty line starts with "LOCUS "
  if (trimmed.startsWith("LOCUS ")) {
    return "genbank";
  }

  // GenBank fallback: contains both FEATURES and ORIGIN sections with // terminator
  if (content.includes("FEATURES") && content.includes("ORIGIN") && content.includes("//")) {
    return "genbank";
  }

  // FASTA: first non-empty line starts with ">"
  if (trimmed.startsWith(">")) {
    return "fasta";
  }

  return "unknown";
}
