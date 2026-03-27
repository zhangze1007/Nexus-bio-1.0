/**
 * Artemisinin Biosynthesis Pathway v1
 *
 * Transforms data/artemisinin_pathway_v1.json into the typed structures
 * consumed by ThreeScene, NodePanel and App.
 *
 * color_mapping  → PathwayNode.color
 * thickness_mapping → PathwayEdge.thickness (Thin=0.4, Medium=1.0, Thick=1.8)
 * risk_report    → RiskEntry[] (exported separately for NodePanel lookup)
 */

import rawData from '../../data/artemisinin_pathway_v1.json';
import { PathwayNode, PathwayEdge, RiskEntry } from '../types';

// ── Color palette (matches artemisinin_pathway_v1 color_mapping values) ──
const COLOR_MAP: Record<string, string> = {
  Yellow: '#E8DCC8',
  Green:  '#C8E0D0',
  Orange: '#DDA870',
  Red:    '#E8C8D4',
  Purple: '#DDD0E8',
};

// ── Thickness palette (Thin / Medium / Thick) ─────────────────────────
const THICKNESS_MAP: Record<string, number> = {
  Thin:   0.4,
  Medium: 1.0,
  Thick:  1.8,
};

// ── Hand-crafted 3-D positions for each node ──────────────────────────
// Main pathway flows left→right along X; impurities branch into +Z or ±Y.
// Scale matches the existing pathwayData.json (nodes ~2 units apart).
const NODE_POSITIONS: Record<string, [number, number, number]> = {
  // ── Main artemisinin pathway ──────────────────────────────────────
  M_FPP:       [0,    0,     0],   // FPP – central branch-point hub
  M_A411D:     [3,    0,     0],   // Amorpha-4,11-diene (first committed step)
  M_AA_OH:     [5,    1,     0],   // Artemisinic alcohol
  M_AA_ALD:    [7,    0,     0],   // Artemisinic aldehyde (branch point)
  M_AA_ACID:   [9,    1.5,   0],   // Artemisinic acid (alternate oxidation)
  M_DHAA_ALD:  [7,   -2,     0.5], // Dihydroartemisinic aldehyde
  M_DHAA_ACID: [5,   -3.5,   0],   // Dihydroartemisinic acid
  M_ART:       [2.5, -3.5,   0],   // Artemisinin – target product

  // ── Impurities / side-products ────────────────────────────────────
  I_STEROL:    [-3,   0,     0],   // Sterols (compete with FPP; same plane)
  I_EPI:       [0,    3,     2.5], // epi-cedrol (FPP side branch)
  I_BCP:       [-1,   1.5,   2.5], // beta-caryophyllene
  I_BFS:       [1,    1.5,   2.5], // beta-farnesene
  I_ART_B:     [9,   -2,     0],   // Arteannuin B (from artemisinic acid)
};

// ── Node type mapping ─────────────────────────────────────────────────
function resolveNodeType(raw: string): PathwayNode['nodeType'] {
  const t = raw.toLowerCase();
  if (t.includes('enzyme')) return 'enzyme';
  if (t.includes('impurity')) return 'metabolite';
  if (t.includes('metabolite')) return 'metabolite';
  return 'metabolite';
}

// ── Transform nodes ───────────────────────────────────────────────────
export const artemisininNodes: PathwayNode[] = (rawData.nodes as Array<{
  id: string;
  name: string;
  type: string;
  thermodynamic_stability: string;
  color_mapping: string;
  audit_trail: string;
}>).map(n => ({
  id:                  n.id,
  label:               n.name,
  position:            NODE_POSITIONS[n.id] ?? [0, 0, 0],
  color:               COLOR_MAP[n.color_mapping] ?? '#C8D8E8',
  summary:             `${n.type} · Thermodynamic stability: ${n.thermodynamic_stability}`,
  citation:            n.audit_trail,
  nodeType:            resolveNodeType(n.type),
  confidenceScore:     undefined,
}));

// ── Transform edges ───────────────────────────────────────────────────
export const artemisininEdges: PathwayEdge[] = (rawData.edges as Array<{
  source: string;
  target: string;
  enzyme: string;
  predicted_delta_G_kJ_mol: number;
  spontaneity: string;
  yield_prediction: string;
  thickness_mapping: string;
  audit_trail: string;
}>).map(e => ({
  start:            e.source,
  end:              e.target,
  relationshipType: 'catalyzes',
  evidence:         `${e.enzyme} | ΔG=${e.predicted_delta_G_kJ_mol} kJ/mol | ${e.spontaneity} | ${e.audit_trail}`,
  thickness:        THICKNESS_MAP[e.thickness_mapping] ?? 1.0,
  direction:        'forward',
}));

// ── Re-export risk report ─────────────────────────────────────────────
export const artemisininRiskReport: RiskEntry[] = rawData.risk_report as RiskEntry[];
