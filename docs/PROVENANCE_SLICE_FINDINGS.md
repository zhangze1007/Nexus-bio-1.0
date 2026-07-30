# Provenance Slice Findings — e_coli_core (14 reactions)

**Date:** 2026-07-30 · **Scope:** exploratory slice only (a new type + one fixture + this page). No database, no SOP, no algorithm change.
**Question being tested:** if the project wants "every number carries an evidence grade," what does doing that *actually* look like on real data — and does it scale?

**Artifacts:** `src/types/dataProvenance.ts` (vocabulary) · `benchmarks/reference/fba/e_coli_core.provenance.json` (14 annotated reactions).

---

## 1. Results table

| Reaction | Class | Grade | Facet graded | Trace reached | Key ambiguity |
|---|---|---|---|---|---|
| Biomass_Ecoli_core | biomass | computational-inferred | numeric-parameter | reconstruction paper | composition is E. coli-experimental but curated; GAM is fitted — ≥3 sub-grades in one row |
| ATPM | maintenance | database-default | numeric-parameter | reconstruction paper | 8.39 was **fitted from data** yet **used as a fixed default** — un-distinguishable without the iAF1260 supplement |
| EX_glc__D_e | exchange | database-default | bounds | immediate DB | is −10 a *measured* uptake or a *simulation setting*? model doesn't say |
| EX_o2_e | exchange | database-default | bounds | immediate DB | −1000 = "unconstrained" sentinel (clear convention) |
| EX_co2_e | exchange | database-default | bounds | immediate DB | boundary construct |
| EX_ac_e | exchange | database-default | bounds | immediate DB | lb=0 encodes overflow-secretion policy, not a flux |
| PFK | glycolysis | experimental-direct | stoichiometry | reconstruction paper | "established biochemistry" isn't a clean enum level |
| PGI | glycolysis | experimental-direct | stoichiometry | reconstruction paper | " |
| CS | TCA | experimental-direct | stoichiometry | reconstruction paper | " |
| ICDHyr | TCA | experimental-direct | stoichiometry | reconstruction paper | " |
| G6PDH2r | PPP | experimental-direct | stoichiometry | reconstruction paper | " |
| GAPD | glycolysis | experimental-direct | stoichiometry | reconstruction paper | " |
| PYK | glycolysis | experimental-direct | stoichiometry | reconstruction paper | isozyme GPR pykA/pykF |
| RPI | PPP | experimental-direct | stoichiometry | reconstruction paper | rpiA (major) *or* rpiB (minor) mixes strong + weak evidence in one grade |

Distribution: **8 experimental-direct, 5 database-default, 1 computational-inferred.** Literature `null` (honest, not fabricated): 4/14. **Reached ultimate primary source: 0/14.**

Sample entry (verbatim from the fixture):
```json
{
  "reactionId": "ATPM",
  "level": "database-default",
  "primaryFacet": "numeric-parameter",
  "source": {
    "database": "BiGG e_coli_core (bigg.reaction: ATPM)",
    "primaryLiterature": "The 8.39 mmol ATP gDW^-1 h^-1 lower bound is carried from iAF1260 (Feist et al. 2007, Mol Syst Biol); the exact primary measurement that fixes the number 8.39 was NOT locatable.",
    "traceDepth": "reconstruction-paper"
  },
  "basisForJudgment": "ATPM is a modeling construct whose lower bound encodes non-growth maintenance ... propagated model-to-model as a fixed default ...",
  "facetNotes": "the NUMBER was originally fitted from experimental data (argues experimental-*) yet is used as a fixed default (argues database-default) ...",
  "confidence": "medium"
}
```

## 2. Process observations (the actual point of this slice)

- **Effort:** ~128 min over 14 rows (avg **9.1 min**) — but that is the *shallow* number. It buys grade + immediate source + lineage, **not** the ultimate primary source, which I reached for **none** of them.
- **What was easy (minutes):** the model file hands you the BiGG id, the GPR b-numbers, and an **SBO term** for free. SBO:0000627 literally says "exchange reaction," so exchanges self-classify as convention. Grading a *famous* enzyme's stoichiometry is a fast domain-knowledge call.
- **What was cheap-but-only-once:** the lineage `e_coli_core ⊂ iAF1260 ⊂ EcoCyc/primary`. Established once, it's inherited by ~every reaction — so cost is front-loaded, not linear.
- **What was genuinely hard / un-findable:** (a) the *ultimate primary measurement* of a specific number — I could not pin where **8.39** or the biomass GAM originally come from without the iAF1260 supplement; (b) per-gene GPR evidence strength (rpiA vs rpiB); (c) external verification is **rate-limited** — I hit a live search-quota wall mid-task, which is itself a scaling signal.
- **Ambiguous zones (most important):**
  1. **A reaction is not one datum.** Existence, stoichiometry, GPR, bounds, and each number carry *different* grades and sources. One label per reaction is a lossy compromise — the fixture keeps `primaryFacet` + `facetNotes` precisely because a single `level` hides this.
  2. **"Fitted-from-data" vs "default" is a real fork.** ATPM 8.39 defends *both* grades. Which one you pick is a **policy decision**, not a lookup.
  3. **The enum has a category gap.** Reaction stoichiometry is "established textbook biochemistry," which none of the five levels names cleanly; I mapped it to experimental-direct and flagged it rather than invent a sixth level to paper over the finding.
  4. **Cheap to grade, expensive to defend.** "PFK is experimental-direct" takes seconds from domain knowledge but a *defensible citation* takes a per-enzyme literature dig I did not do.

## 3. Scalability judgment (honest, explicit)

**To all 95 reactions of THIS model, at the shallow depth I used:** ~**10–13 human-hours** for a domain expert. But note these 14 were the *easiest, most famous* reactions; the other 81 include obscure transporters and lesser-studied steps that grade slower. And the shallow pass mostly restates "it came from iAF1260" — **low marginal information.**

**To a *defensible, ultimate-primary* depth:** not feasible by hand — realistically **weeks per model and still incomplete**, since I reached primary depth for **0/14** even on textbook enzymes.

**Across all data sources in the platform** (KEGG, EcoCyc, BRENDA, eQuilibrator, ProteinGym, BiGG…): each has a *different* provenance structure, so **one schema/automation does not cover them** — the cost multiplies per source, it doesn't amortize.

**What CAN be automated (cheap, low-risk):** extracting the immediate DB id, the SBO term, and the GPR from the model file; SBO/id-pattern heuristics (`SBO:0000627 → exchange → database-default bounds`); recording reconstruction lineage when the model metadata carries it. This is real but **low-value on its own** — it restates metadata, it does not answer "is this number trustworthy."

**What MUST stay human/expert (does not scale cheaply):** the evidence-**grade** judgment; resolving the fitted-vs-default and measured-vs-setting forks (these are *policy*, not lookup); per-gene GPR curation; ultimate-primary tracing (often unresolved).

## 4. Bottom line

Not "infeasible," not "do it for everything." The honest verdict is **triage, don't blanket-apply.** A uniform per-datum provenance grade across 95 reactions × 5 facets × N databases is too expensive for the value, and its cheap-automatable layer is the least informative part. But the exercise was **not** worthless — on 14 rows it surfaced concrete, decision-relevant issues (the ATPM fitted-vs-default fork, the thin model metadata, the one-label-per-reaction category error) that a user reading "biomass 0.87 h⁻¹" would never see.

**Recommendation for the "every number carries an evidence grade" direction:** (1) auto-tag the cheap structural facets (source id, SBO type, lineage) platform-wide; (2) spend scarce expert grading **only** on the handful of *load-bearing* numbers that actually drive a reported result or claim (objective value, maintenance, the few fluxes/parameters a user acts on) — not on all 95 × every facet; (3) make the type carry `primaryFacet` + `basisForJudgment` + a **policy** field for the fitted-vs-default fork, because that fork recurred and is a decision, not a fact. Re-run this slice on one non-FBA source (e.g. a CETHX ΔG value or a kinetic Km) before generalizing — the provenance structure there is different and will change the cost estimate.
