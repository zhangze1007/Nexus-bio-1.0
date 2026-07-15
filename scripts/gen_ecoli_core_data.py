#!/usr/bin/env python3
"""
Generate src/data/iJO1366Subset.ts from the real, published e_coli_core model.

Why this script exists
-----------------------
The file it overwrites used to be a HAND-CURATED ~83-reaction subset that was
never a real model: its biomass equation was mis-calibrated (it solved to a
biologically impossible growth rate of ~2.05 h⁻¹; real E. coli maxes out
around 0.87 h⁻¹) and it lacked metabolic scope a real biomass function needs
(no glutamate/glutamine nodes). It could not be patched -- it had to be
replaced with a real, externally-published, machine-verifiable model.

This script loads e_coli_core -- Orth, Fleming & Palsson (2010), "Reconstruction
and Use of Microbial Metabolic Networks: the Core Escherichia coli Metabolic
Model as an Educational Guide" (EcoSal Plus) -- via COBRApy's bundled
`textbook` sample model (`cobra.io.load_model("textbook")`) and emits a
TypeScript data file whose reaction list, stoichiometry, and flux bounds are
read DIRECTLY off the loaded `cobra.Model` object. Nothing scientific in the
output is hand-typed: every id, bound, and stoichiometric coefficient comes
from `reaction.lower_bound` / `reaction.upper_bound` / `reaction.metabolites`.

Run:
    <venv>/Scripts/python.exe scripts/gen_ecoli_core_data.py

Requires `cobra` (COBRApy) installed in the active Python environment.

Subsystem labels
-----------------
COBRApy's bundled `textbook.xml.gz` does NOT carry BiGG subsystem
annotations (verified: every `reaction.subsystem` reads back `""`). The
`BIGG_SUBSYSTEM` table below supplies those labels. It was built once by
downloading the canonical model description from the BiGG Models database
(http://bigg.ucsd.edu/static/models/e_coli_core.json) and cross-checking it
against this script's COBRApy-loaded model: EVERY reaction's stoichiometry
and flux bounds matched exactly (0 mismatches across all 95 reactions; see
git history / PR description for the cross-check transcript). Only 2 of the
95 ids differ in spelling between the two sources (COBRApy's bundled model
vs. the live BiGG download) -- `Biomass_Ecoli_core`/`BIOMASS_Ecoli_core_w_GAM`
and `FORti`/`FORt` -- both resolved via the `BIGG_ID_ALIASES` map below.
Subsystem strings do not affect the LP (stoichiometry/bounds/objective do);
they are purely an organizational label carried through to the UI.

Engine compatibility (src/server/fbaEngine.ts `solveExpandedFBA`)
-------------------------------------------------------------------
`solveExpandedFBA` hardcodes three reaction ids. e_coli_core spells two of
them differently, so this script renames those two on the way out (every
other id and every metabolite id is emitted exactly as COBRApy provides it):
  - biomass reaction   : "Biomass_Ecoli_core"  -> "BIOMASS"
  - glucose exchange    : "EX_glc__D_e"         -> "EX_glc_e"
  - oxygen exchange     : "EX_o2_e"             -> "EX_o2_e"  (already matches)

A synthetic "PRODUCT" reaction (NOT part of e_coli_core / NOT COBRApy output)
is appended for backward compatibility -- see PRODUCT_REACTION below for why.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import cobra

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "src" / "data" / "iJO1366Subset.ts"

# ── Reaction id normalization (engine compatibility) ──────────────────────
BIOMASS_ID = "BIOMASS"
GLUCOSE_EX_ID = "EX_glc_e"
OXYGEN_EX_ID = "EX_o2_e"

# ── Subsystem labels: BiGG e_coli_core.json cross-reference ───────────────
# (see module docstring for provenance)
BIGG_ID_ALIASES = {
    "Biomass_Ecoli_core": "BIOMASS_Ecoli_core_w_GAM",
    "FORti": "FORt",
}

BIGG_SUBSYSTEM: dict[str, str] = {
    "ACALD": "Pyruvate Metabolism",
    "ACALDt": "Transport, Extracellular",
    "ACKr": "Pyruvate Metabolism",
    "ACONTa": "Citric Acid Cycle",
    "ACONTb": "Citric Acid Cycle",
    "ACt2r": "Transport, Extracellular",
    "ADK1": "Oxidative Phosphorylation",
    "AKGDH": "Citric Acid Cycle",
    "AKGt2r": "Transport, Extracellular",
    "ALCD2x": "Pyruvate Metabolism",
    "ATPM": "Biomass and maintenance functions",
    "ATPS4r": "Oxidative Phosphorylation",
    "Biomass_Ecoli_core": "Biomass and maintenance functions",
    "CO2t": "Transport, Extracellular",
    "CS": "Citric Acid Cycle",
    "CYTBD": "Oxidative Phosphorylation",
    "D_LACt2": "Transport, Extracellular",
    "ENO": "Glycolysis/Gluconeogenesis",
    "ETOHt2r": "Transport, Extracellular",
    "EX_ac_e": "Extracellular exchange",
    "EX_acald_e": "Extracellular exchange",
    "EX_akg_e": "Extracellular exchange",
    "EX_co2_e": "Extracellular exchange",
    "EX_etoh_e": "Extracellular exchange",
    "EX_for_e": "Extracellular exchange",
    "EX_fru_e": "Extracellular exchange",
    "EX_fum_e": "Extracellular exchange",
    "EX_glc__D_e": "Extracellular exchange",
    "EX_gln__L_e": "Extracellular exchange",
    "EX_glu__L_e": "Extracellular exchange",
    "EX_h2o_e": "Extracellular exchange",
    "EX_h_e": "Extracellular exchange",
    "EX_lac__D_e": "Extracellular exchange",
    "EX_mal__L_e": "Extracellular exchange",
    "EX_nh4_e": "Extracellular exchange",
    "EX_o2_e": "Extracellular exchange",
    "EX_pi_e": "Extracellular exchange",
    "EX_pyr_e": "Extracellular exchange",
    "EX_succ_e": "Extracellular exchange",
    "FBA": "Glycolysis/Gluconeogenesis",
    "FBP": "Glycolysis/Gluconeogenesis",
    "FORt2": "Transport, Extracellular",
    "FORti": "Transport, Extracellular",
    "FRD7": "Oxidative Phosphorylation",
    "FRUpts2": "Transport, Extracellular",
    "FUM": "Citric Acid Cycle",
    "FUMt2_2": "Transport, Extracellular",
    "G6PDH2r": "Pentose Phosphate Pathway",
    "GAPD": "Glycolysis/Gluconeogenesis",
    "GLCpts": "Transport, Extracellular",
    "GLNS": "Glutamate Metabolism",
    "GLNabc": "Transport, Extracellular",
    "GLUDy": "Glutamate Metabolism",
    "GLUN": "Glutamate Metabolism",
    "GLUSy": "Glutamate Metabolism",
    "GLUt2r": "Transport, Extracellular",
    "GND": "Pentose Phosphate Pathway",
    "H2Ot": "Transport, Extracellular",
    "ICDHyr": "Citric Acid Cycle",
    "ICL": "Anaplerotic reactions",
    "LDH_D": "Pyruvate Metabolism",
    "MALS": "Anaplerotic reactions",
    "MALt2_2": "Transport, Extracellular",
    "MDH": "Citric Acid Cycle",
    "ME1": "Anaplerotic reactions",
    "ME2": "Anaplerotic reactions",
    "NADH16": "Oxidative Phosphorylation",
    "NADTRHD": "Oxidative Phosphorylation",
    "NH4t": "Inorganic Ion Transport and Metabolism",
    "O2t": "Transport, Extracellular",
    "PDH": "Glycolysis/Gluconeogenesis",
    "PFK": "Glycolysis/Gluconeogenesis",
    "PFL": "Pyruvate Metabolism",
    "PGI": "Glycolysis/Gluconeogenesis",
    "PGK": "Glycolysis/Gluconeogenesis",
    "PGL": "Pentose Phosphate Pathway",
    "PGM": "Glycolysis/Gluconeogenesis",
    "PIt2r": "Inorganic Ion Transport and Metabolism",
    "PPC": "Anaplerotic reactions",
    "PPCK": "Anaplerotic reactions",
    "PPS": "Glycolysis/Gluconeogenesis",
    "PTAr": "Pyruvate Metabolism",
    "PYK": "Glycolysis/Gluconeogenesis",
    "PYRt2": "Transport, Extracellular",
    "RPE": "Pentose Phosphate Pathway",
    "RPI": "Pentose Phosphate Pathway",
    "SUCCt2_2": "Transport, Extracellular",
    "SUCCt3": "Transport, Extracellular",
    "SUCDi": "Oxidative Phosphorylation",
    "SUCOAS": "Citric Acid Cycle",
    "TALA": "Pentose Phosphate Pathway",
    "THD2": "Oxidative Phosphorylation",
    "TKT1": "Pentose Phosphate Pathway",
    "TKT2": "Pentose Phosphate Pathway",
    "TPI": "Glycolysis/Gluconeogenesis",
}

# Raw BiGG subsystem string -> our TypeScript `Subsystem` union member.
# Reused existing union members wherever the concept already matches;
# only added "Glutamate" for the one genuinely new category (e_coli_core's
# glutamate/nitrogen-assimilation reactions have no home in the old union,
# which is exactly the missing metabolic scope this migration is fixing).
SUBSYSTEM_TS_MAP: dict[str, str] = {
    "Glycolysis/Gluconeogenesis": "Glycolysis",
    "Pentose Phosphate Pathway": "PPP",
    "Citric Acid Cycle": "TCA",
    "Oxidative Phosphorylation": "OxPhos",
    "Anaplerotic reactions": "Anaplerosis",
    "Pyruvate Metabolism": "Pyruvate",
    "Extracellular exchange": "Exchange",
    "Transport, Extracellular": "Transport",
    "Inorganic Ion Transport and Metabolism": "Transport",
    "Glutamate Metabolism": "Glutamate",
    # "Biomass and maintenance functions" is intentionally NOT mapped here:
    # BIOMASS and ATPM get distinct overrides below (id-keyed), because BiGG
    # groups them under one label but they play different roles in the model.
}

# id-keyed overrides take priority over the subsystem-string map above.
SUBSYSTEM_ID_OVERRIDE: dict[str, str] = {
    "Biomass_Ecoli_core": "Biosynthesis",
    "ATPM": "Energy",
}

# Order the grouped output sections are emitted in (cosmetic only).
GROUP_ORDER = [
    "Glycolysis",
    "PPP",
    "TCA",
    "OxPhos",
    "Anaplerosis",
    "Pyruvate",
    "Glutamate",
    "Transport",
    "Exchange",
    "Biosynthesis",
    "Energy",
]

GROUP_VAR_NAME = {
    "Glycolysis": "GLYCOLYSIS",
    "PPP": "PPP",
    "TCA": "TCA",
    "OxPhos": "OXPHOS",
    "Anaplerosis": "ANAPLEROSIS",
    "Pyruvate": "PYRUVATE",
    "Glutamate": "GLUTAMATE",
    "Transport": "TRANSPORT",
    "Exchange": "EXCHANGE",
    "Biosynthesis": "BIOSYNTHESIS",
    "Energy": "ENERGY",
}

GROUP_COMMENT = {
    "Glycolysis": "Glycolysis / Gluconeogenesis",
    "PPP": "Pentose Phosphate Pathway",
    "TCA": "Citric Acid Cycle (TCA)",
    "OxPhos": "Oxidative Phosphorylation",
    "Anaplerosis": "Anaplerotic Reactions",
    "Pyruvate": "Pyruvate Metabolism",
    "Glutamate": "Glutamate / Nitrogen Assimilation",
    "Transport": "Membrane Transport (incl. inorganic ion transport)",
    "Exchange": "Extracellular Exchange Reactions",
    "Biosynthesis": "Biomass & Product Reactions",
    "Energy": "ATP Maintenance",
}

# ── Synthetic backward-compat reaction (NOT from COBRApy / NOT e_coli_core) ─
#
# src/server/fbaEngine.ts `solveExpandedFBA` hardcodes objRxn = "PRODUCT" for
# `objective: "product"`, and src/server/fbaStrainPipeline.ts hardcodes
# `productReactionId: "PRODUCT"` for its OptKnock/FSEOF strain-design calls
# (both real, user-reachable code paths -- see PR description). e_coli_core
# is a real central-carbon-metabolism model; it has no "engineered product
# pathway" reaction (no real model would -- that concept is
# organism/product-specific and doesn't exist until someone engineers it).
# To avoid regressing those two working features while migrating off the
# fabricated iJO1366 subset, we keep ONE clearly-labeled synthetic sink that
# draws down real, already-balanced e_coli_core cofactor pools (acetyl-CoA,
# NADPH, ATP) -- the same illustrative role the previous hand-curated file's
# "PRODUCT" reaction already played. This is the only non-COBRApy-derived
# reaction in the file.
PRODUCT_REACTION = {
    "id": "PRODUCT",
    "name": "Target product reaction (synthetic; not part of e_coli_core)",
    "subsystem": "Biosynthesis",
    "lb": 0,
    "ub": 100,
    "stoichiometry": {
        "accoa_c": -3,
        "nadph_c": -2,
        "atp_c": -1,
        "adp_c": 1,
        "nadp_c": 2,
        "coa_c": 3,
        "co2_c": 0.5,
    },
}


def to_ts_number(value: float) -> str:
    """Format a Python float as a clean TS number literal (no trailing .0)."""
    if value == float("inf"):
        return "1000"  # defensive; e_coli_core doesn't use real inf, but just in case
    if value == float("-inf"):
        return "-1000"
    if float(value).is_integer():
        return str(int(value))
    return repr(float(value))


def to_ts_string(value: str) -> str:
    return json.dumps(value)


def normalize_gpr(rule: str) -> str | None:
    """COBRApy GPR strings use lowercase 'and'/'or'; the in-repo GPR parser
    (src/server/fbaGPR.ts) and GPRPanel.tsx's gene extractor both only
    recognize uppercase 'AND'/'OR' as boolean operators (case-sensitive
    tokenizers) -- lowercase would silently be treated as gene ids instead
    of operators. Uppercase them here; gene ids (b#### / s0001) never
    collide with the words "and"/"or"."""
    rule = rule.strip()
    if not rule:
        return None
    rule = re.sub(r"\band\b", "AND", rule)
    rule = re.sub(r"\bor\b", "OR", rule)
    return rule


def resolve_subsystem(reaction_id: str) -> str:
    if reaction_id in SUBSYSTEM_ID_OVERRIDE:
        return SUBSYSTEM_ID_OVERRIDE[reaction_id]
    # BIGG_SUBSYSTEM is keyed by COBRApy's own reaction ids (BIGG_ID_ALIASES
    # was already applied once, offline, when this table was built from the
    # BiGG download -- see module docstring). No further alias translation
    # needed here.
    raw = BIGG_SUBSYSTEM.get(reaction_id)
    if raw is None:
        raise ValueError(f"No subsystem mapping for reaction id {reaction_id!r}")
    mapped = SUBSYSTEM_TS_MAP.get(raw)
    if mapped is None:
        raise ValueError(f"No TS Subsystem mapping for raw BiGG subsystem {raw!r} (reaction {reaction_id!r})")
    return mapped


def build_reaction_dicts(model: "cobra.Model") -> list[dict]:
    out = []
    biomass_candidates = [r for r in model.reactions if "biomass" in r.id.lower()]
    if len(biomass_candidates) != 1:
        raise ValueError(f"Expected exactly 1 biomass reaction, found {len(biomass_candidates)}: {biomass_candidates}")
    biomass_rxn_id = biomass_candidates[0].id

    glucose_ex_candidates = [r for r in model.reactions if r.id.upper().startswith("EX_GLC")]
    if len(glucose_ex_candidates) != 1:
        raise ValueError(f"Expected exactly 1 glucose exchange reaction, found {len(glucose_ex_candidates)}")
    glucose_ex_id = glucose_ex_candidates[0].id

    oxygen_ex_candidates = [r for r in model.reactions if r.id.upper().startswith("EX_O2")]
    if len(oxygen_ex_candidates) != 1:
        raise ValueError(f"Expected exactly 1 oxygen exchange reaction, found {len(oxygen_ex_candidates)}")
    oxygen_ex_id = oxygen_ex_candidates[0].id

    id_renames = {
        biomass_rxn_id: BIOMASS_ID,
        glucose_ex_id: GLUCOSE_EX_ID,
        oxygen_ex_id: OXYGEN_EX_ID,
    }

    for r in model.reactions:
        subsystem = resolve_subsystem(r.id)
        emitted_id = id_renames.get(r.id, r.id)
        stoich = {m.id: coef for m, coef in r.metabolites.items()}
        gpr = normalize_gpr(r.gene_reaction_rule or "")
        out.append(
            {
                "id": emitted_id,
                "name": r.name,
                "subsystem": subsystem,
                "lb": r.lower_bound,
                "ub": r.upper_bound,
                "stoichiometry": stoich,
                "gpr": gpr,
            }
        )
    return out


def render_reaction(rxn: dict, indent: str = "    ") -> str:
    lines = [f"{indent}{{"]
    lines.append(f"{indent}  id: {to_ts_string(rxn['id'])},")
    lines.append(f"{indent}  name: {to_ts_string(rxn['name'])},")
    lines.append(f"{indent}  subsystem: {to_ts_string(rxn['subsystem'])},")
    lines.append(f"{indent}  lb: {to_ts_number(rxn['lb'])},")
    lines.append(f"{indent}  ub: {to_ts_number(rxn['ub'])},")
    stoich_items = ", ".join(
        f"{to_ts_string(met)}: {to_ts_number(coef)}" for met, coef in rxn["stoichiometry"].items()
    )
    lines.append(f"{indent}  stoichiometry: {{ {stoich_items} }},")
    if rxn.get("gpr"):
        lines.append(f"{indent}  gpr: {to_ts_string(rxn['gpr'])},")
    lines.append(f"{indent}}},")
    return "\n".join(lines)


def render_group(var_name: str, comment: str, reactions: list[dict]) -> str:
    header = f"// ── {comment} ─{'─' * max(0, 50 - len(comment))}\n"
    body = "\n".join(render_reaction(r) for r in reactions)
    return f"{header}const {var_name}: IJO1366Reaction[] = [\n{body}\n];\n"


def main() -> None:
    model = cobra.io.load_model("textbook")
    solution = model.optimize()
    growth = solution.objective_value
    print(f"Loaded {model.id}: {len(model.reactions)} reactions, {len(model.metabolites)} metabolites")
    print(f"COBRApy FBA optimum (default bounds, glucose=-10, O2 unconstrained): growth = {growth:.6f} h^-1")
    if abs(growth - 0.8739215069684279) > 1e-6:
        raise SystemExit(f"Unexpected growth rate {growth} -- expected ~0.8739215; refusing to generate stale data")

    reactions = build_reaction_dicts(model)
    reactions.append(PRODUCT_REACTION)

    grouped: dict[str, list[dict]] = {g: [] for g in GROUP_ORDER}
    for r in reactions:
        grouped[r["subsystem"]].append(r)
    for g in grouped:
        grouped[g].sort(key=lambda r: r["id"])

    total_emitted = sum(len(v) for v in grouped.values())
    if total_emitted != len(reactions):
        raise SystemExit("Internal error: reaction count mismatch after grouping")

    group_blocks = "\n".join(
        render_group(GROUP_VAR_NAME[g], GROUP_COMMENT[g], grouped[g]) for g in GROUP_ORDER if grouped[g]
    )
    assemble_spread = "\n  ".join(f"...{GROUP_VAR_NAME[g]}," for g in GROUP_ORDER if grouped[g])

    all_met_ids = sorted({met for r in reactions for met in r["stoichiometry"].keys()})

    header = f'''/**
 * e_coli_core — the real, published E. coli core metabolic model
 *
 * Source: Orth, J.D., Fleming, R.M.T. & Palsson, B.O. (2010) "Reconstruction
 * and Use of Microbial Metabolic Networks: the Core Escherichia coli
 * Metabolic Model as an Educational Guide." EcoSal Plus. Loaded via
 * COBRApy's bundled `textbook` sample model (`cobra.io.load_model("textbook")`,
 * COBRApy {cobra.__version__}) and machine-exported by
 * scripts/gen_ecoli_core_data.py -- see that script for full provenance,
 * including how subsystem labels were cross-referenced against the BiGG
 * Models database. DO NOT hand-edit this file; edit the generator instead
 * and re-run it.
 *
 * COBRApy-verified optimum at default bounds (glucose uptake 10, O2
 * unconstrained): growth = {growth:.4f} h⁻¹ (real E. coli caps out ~0.87-0.90 h⁻¹
 * on glucose minimal media -- this replaces a prior hand-curated subset whose
 * mis-calibrated biomass reaction solved to a biologically impossible 2.05 h⁻¹).
 *
 * {len(reactions)} reactions ({len(reactions) - 1} from e_coli_core + 1 synthetic
 * backward-compat "PRODUCT" reaction, see PRODUCT_REACTION in the generator),
 * {len(all_met_ids)} metabolites.
 *
 * Three reaction ids are normalized from e_coli_core's native spelling so
 * src/server/fbaEngine.ts `solveExpandedFBA` keeps working unmodified:
 *   biomass reaction   "Biomass_Ecoli_core" -> "{BIOMASS_ID}"
 *   glucose exchange    "EX_glc__D_e"        -> "{GLUCOSE_EX_ID}"
 *   oxygen exchange      "EX_o2_e"            -> "{OXYGEN_EX_ID}" (already matched)
 * Every other reaction id and every metabolite id is exactly what COBRApy
 * reports (BiGG naming convention, compartment-suffixed: _c cytoplasm,
 * _e extracellular).
 */

export type Subsystem =
  | "Glycolysis"
  | "PPP"
  | "TCA"
  | "OxPhos"
  | "Anaplerosis"
  | "Pyruvate"
  | "Glutamate"
  | "Exchange"
  | "Transport"
  | "Biosynthesis"
  | "Energy";

export interface IJO1366Reaction {{
  id: string;
  name: string;
  subsystem: Subsystem;
  lb: number;
  ub: number;
  /** Stoichiometry: metaboliteId → coefficient (negative = consumed, positive = produced) */
  stoichiometry: Record<string, number>;
  /**
   * Gene-Protein-Reaction boolean rule from BiGG / e_coli_core.
   * AND = protein complex (all genes required), OR = isozymes (any gene sufficient).
   * Empty/absent = reaction is always active (no gene dependency).
   */
  gpr?: string;
}}

'''

    footer = f'''
// ── Assemble full network ────────────────────────────────────────────
export const IJO1366_REACTIONS: IJO1366Reaction[] = [
  {assemble_spread}
];

/** All unique metabolite IDs in the model. */
export const IJO1366_METABOLITES: string[] = (() => {{
  const ids = new Set<string>();
  for (const rxn of IJO1366_REACTIONS) {{
    for (const met of Object.keys(rxn.stoichiometry)) {{
      ids.add(met);
    }}
  }}
  return Array.from(ids).sort();
}})();

/** Quick stats for display. */
export const IJO1366_STATS = {{
  reactions: IJO1366_REACTIONS.length,
  metabolites: IJO1366_METABOLITES.length,
  source: "e_coli_core (Orth, Fleming & Palsson 2010); COBRApy textbook model; growth {growth:.4f} h\\u207b\\u00b9 verified against COBRApy optimize()",
}} as const;

/**
 * Map of reaction ID → GPR rule string for all reactions that have one.
 * Ready to pass to getKnockoutReactions() from fbaGPR.ts.
 */
export const IJO1366_GPR_RULES: Record<string, string> = (() => {{
  const rules: Record<string, string> = {{}};
  for (const rxn of IJO1366_REACTIONS) {{
    if (rxn.gpr) {{
      rules[rxn.id] = rxn.gpr;
    }}
  }}
  return rules;
}})();
'''

    content = header + group_blocks + footer

    OUTPUT_PATH.write_text(content, encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT_PATH} ({len(reactions)} reactions, {len(all_met_ids)} metabolites)")


if __name__ == "__main__":
    main()
