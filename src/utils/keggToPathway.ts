/**
 * KEGG-to-Pathway converter
 *
 * Converts a KEGGPathwayResult (compound + reaction IDs) into
 * PathwayNode / PathwayEdge arrays that MetabolicEngPage can render
 * via the uiStore tier-4 resolution cascade.
 */

import type { PathwayNode, PathwayEdge } from '../types';
import type { KEGGPathwayResult } from '../services/database/keggClient';

// ── Common KEGG compound ID -> human-readable name ────────────────────
// Covers glycolysis, TCA, mevalonate, pentose phosphate, and amino acid
// biosynthesis intermediates. Unknown IDs fall back to the raw ID string.
const COMPOUND_NAMES: Record<string, string> = {
  // Glycolysis / Gluconeogenesis
  C00031: 'D-Glucose',
  C05125: 'D-Glucose 1-phosphate',
  C00668: 'Glucose 6-phosphate',
  C00085: 'Fructose 6-phosphate',
  C00354: 'Fructose 1,6-bisphosphate',
  C00111: 'Glycerone phosphate',
  C00118: 'D-Glyceraldehyde 3-phosphate',
  C00236: '1,3-Bisphospho-D-glycerate',
  C00197: '3-Phospho-D-glycerate',
  C00631: '2-Phospho-D-glycerate',
  C00074: 'Phosphoenolpyruvate',
  C00022: 'Pyruvate',
  C00033: 'Acetate',
  C00068: 'Thiamin diphosphate',

  // TCA cycle
  C00158: 'Citrate',
  C00417: 'cis-Aconitate',
  C00051: 'Isocitrate',
  C00026: '2-Oxoglutarate',
  C00091: 'Succinyl-CoA',
  C00042: 'Succinate',
  C00122: 'Fumarate',
  C00149: '(S)-Malate',
  C00036: 'Oxaloacetate',

  // Acetyl-CoA / CoA
  C00024: 'Acetyl-CoA',
  C00010: 'CoA',

  // Mevalonate / Terpenoid
  C00083: 'Malonyl-CoA',
  C01144: 'Mevalonate',
  C00956: 'Mevalonate 5-phosphate',
  C01098: 'Mevalonate 5-diphosphate',
  C00129: 'Isopentenyl diphosphate',
  C00235: 'Dimethylallyl diphosphate',
  C00448: 'Geranyl diphosphate',
  C00353: 'Farnesyl diphosphate',

  // Pentose phosphate pathway
  C00199: 'D-Ribulose 5-phosphate',
  C00117: 'D-Ribose 5-phosphate',
  C00279: 'D-Erythrose 4-phosphate',
  C00231: 'D-Sedoheptulose 7-phosphate',
  C05382: 'D-Xylulose 5-phosphate',
  C00309: 'Sedoheptulose 1,7-bisphosphate',

  // Amino acid biosynthesis
  C00025: 'L-Glutamate',
  C00064: 'L-Glutamine',
  C00041: 'L-Alanine',
  C00049: 'L-Aspartate',
  C00152: 'L-Asparagine',
  C00037: 'Glycine',
  C00065: 'L-Serine',
  C00183: 'L-Valine',
  C00123: 'L-Leucine',
  C00079: 'L-Phenylalanine',
  C00082: 'L-Tyrosine',
  C00078: 'L-Tryptophan',

  // Nucleotide cofactors
  C00002: 'ATP',
  C00008: 'ADP',
  C00020: 'AMP',
  C00003: 'NAD+',
  C00004: 'NADH',
  C00005: 'NADPH',
  C00006: 'NADP+',
  C00009: 'Orthophosphate',
};

/**
 * Return a human-readable name for a KEGG compound ID.
 * Falls back to the raw ID if not in our lookup table.
 */
function compoundLabel(id: string): string {
  return COMPOUND_NAMES[id] ?? id;
}

/**
 * Compute a position on a circle of `radius` for node at `index` of `total`.
 * Returns a [x, y, z] tuple suitable for PathwayNode.position.
 */
function circularPosition(index: number, total: number, radius: number): [number, number, number] {
  if (total <= 1) return [0, 0, 0];
  const angle = (2 * Math.PI * index) / total - Math.PI / 2; // start from top
  const x = +(radius * Math.cos(angle)).toFixed(2);
  const y = +(radius * Math.sin(angle)).toFixed(2);
  // Slight z variation for visual depth separation
  const z = +(0.2 * Math.sin((2 * Math.PI * index) / total)).toFixed(2);
  return [x, y, z];
}

/**
 * Convert a KEGGPathwayResult into arrays of PathwayNode and PathwayEdge.
 *
 * - Each KEGG compound becomes a metabolite node arranged in a circle.
 * - Consecutive compounds are linked by forward-direction edges (linear chain).
 * - Reaction IDs are stored in the `evidence` field of each edge for traceability.
 */
export function keggToPathway(keggData: KEGGPathwayResult): { nodes: PathwayNode[]; edges: PathwayEdge[] } {
  const { compounds, reactions, name: pathwayName, id: pathwayId } = keggData;

  // Deduplicate compounds while preserving order
  const seen = new Set<string>();
  const uniqueCompounds: string[] = [];
  for (const c of compounds) {
    if (!seen.has(c)) {
      seen.add(c);
      uniqueCompounds.push(c);
    }
  }

  // If KEGG returned no compounds (degenerate case), return empty
  if (uniqueCompounds.length === 0) {
    return { nodes: [], edges: [] };
  }

  const radius = Math.max(2.5, uniqueCompounds.length * 0.6);

  // ── Nodes ─────────────────────────────────────────────────────────
  const nodes: PathwayNode[] = uniqueCompounds.map((cpdId, i) => ({
    id: cpdId,
    label: compoundLabel(cpdId),
    position: circularPosition(i, uniqueCompounds.length, radius),
    summary: `KEGG compound ${cpdId} in ${pathwayName}`,
    citation: `KEGG ${pathwayId}`,
    color: '#4fc3f7',
    nodeType: 'metabolite' as const,
  }));

  // ── Edges ─────────────────────────────────────────────────────────
  // Build edges between consecutive compounds as a linear chain.
  // Attach the corresponding reaction ID to each edge when available.
  const edges: PathwayEdge[] = [];
  for (let i = 0; i < uniqueCompounds.length - 1; i++) {
    edges.push({
      start: uniqueCompounds[i],
      end: uniqueCompounds[i + 1],
      direction: 'forward',
      relationshipType: 'converts',
      evidence: reactions[i] ? `KEGG reaction ${reactions[i]}` : undefined,
    });
  }

  return { nodes, edges };
}
