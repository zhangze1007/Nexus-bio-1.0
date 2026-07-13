# Nexus-Bio Zero-Fabrication Audit — Design

**Date:** 2026-07-13
**Author:** Zhang Ze + Claude
**Status:** Approved (design), pending spec review → implementation plan
**Supersedes context:** `NEXUS_BIO_INTEGRITY_AUDIT.md` (2026-07-01) Tier 0/1 — this is the *new-defect hunt* beyond that catalogue.

---

## 1. Goal

**Zero fabrication.** Every instance of fabricated or fictional data — anywhere on the
platform, at the algorithm level **or any other layer** — must be found and fixed. A tool
that presents invented numbers as real analysis is worse than useless: it sends a researcher
into the wrong experiment. This audit drives the count of confirmed fabrications to **0**.

### Non-goals (explicitly deferred)

- **Physical / biological accuracy** ("the method runs but the number disagrees with reality,"
  e.g. the FBA biomass giving 12–20 h⁻¹). Confirming the *correct physical value* needs
  experimental / wet-lab ground truth, which the founder will run later with university lab
  access. We do **not** chase this class now (we may *note* it, never block on it).
- Architectural refactors (integrity audit Tier 3) — out of scope.
- Performance optimization — out of scope.

The dividing line: **this audit only pursues defects provable from code + computation alone.**

---

## 2. Scope — surfaces where fabrication can hide

Not just the ~53 engines. Any surface that can present invented data as real:

| Surface | Example fabrication |
|---|---|
| `src/server/*Engine.ts`, `src/services/*`, `src/modules/*` (~53 files, ~30K LOC) | `Math.random()` returned as a confidence/fitness/efficiency score |
| `src/data/*` | mock/placeholder data presented as real; hardcoded "results" |
| `app/api/*/route.ts` | route returns canned/fabricated payloads regardless of input |
| UI components (`src/components/**`) | hardcoded final values shown as computed output |
| Provenance / citations | real paper cited over code that does none of what it claims |
| `toolValidity` / `toolAssumptions` | tier "real" over fabricated computation; false model/scale claims |

---

## 3. In-scope defect classes (code-verifiable)

1. **Fabricated / misrepresented science** — a real citation or a "real algorithm" / tier="real"
   claim attached to `Math.random()`, a hardcoded return, or canned data. The gap between the
   **claim** and the **code** is the tell.
2. **Decoys** — a function accepts parameters but ignores them; output does not change when
   input changes (the audit's `findAB` was the canonical case).
3. **Unseeded / non-reproducible** — a *reported result* derives from unseeded `Math.random()`,
   `Date.now()`, or an unseeded shuffle, so it differs run-to-run.

## 4. Out of scope / DO-NOT-TOUCH (flagging these would be a NEW error)

- **Legitimate stochastic methods** that are *supposed* to use randomness: Knuth's Poisson
  sampler (`digitalCellEngine` ~L5195), ACHR/hit-and-run flux sampling, MD Langevin noise,
  Box–Muller CI sampling, design-diversity injection (`ProEvolCampaignEngine`). These are
  correct; they only ever need a *seed* for reproducibility, never a "fix."
- **ID generators** (`Math.random().toString(36)` for keys/ids) — fine.
- **FORBIDDEN files** (`IDEShell`, `IDETopBar`, `IDESidebar`, `DBTLflowPage`, `GECAIRPage`,
  `ProEvolPage`) — may be *audited* but not modified without explicit approval.
- Anything already fixed & verified (FBA single-species, and the audit's Tier 0/1 items that
  now pass genuine anti-decoy / ground-truth tests: `findAB`, SCRaMbLE fitness, CRISPR
  bystander, PCA/DBTL seeding).

---

## 5. Methodology

Triage-first: scan everything shallow, then deep-verify + fix the ranked suspects.

### Phase 0 — Inventory & claim extraction
Enumerate all engines + data/route/UI surfaces. For each, extract its **claims**: file-header
`@scientific_provenance`, cited papers, `toolValidity` level, assumption tags. This is the
baseline the code is measured against.

### Phase 1 — Triage scan (hybrid: mechanical + targeted read) → ranked report
Run the three detectors across the whole surface:
- **Fabrication detector:** `Math.random()` (or `Date.now()`, hardcoded constant) flowing into
  a *returned* score / confidence / fitness / efficiency / yield; excluding the DO-NOT-TOUCH
  list. Plus: citation/tier="real" in a file whose function bodies do not compute what is claimed.
- **Decoy detector:** parameters threaded into a function but absent from the expression that
  produces its return value.
- **Reproducibility detector:** unseeded randomness on a reported-result path.

Then **read the "claim-bearing" parts** (headers, provenance, tier captions) of the top-ranked
suspects to separate real misrepresentation from false positives.

**Output:** a ranked suspicion table — `{surface, class, file:line, claim↔code gap, severity}` —
credibility bombs first. This is the **first bounded deliverable**.

### Phase 2 — Deep verification (one suspect at a time)
Prove each with a **code-level test** that a fake fix cannot satisfy (the project's anti-fabrication
protocol):
- Decoy → input-sensitivity test: change an input, assert the output changes.
- Reproducibility → run twice, assert equal (after seeding) / differs by seed.
- Fabrication → trace that the returned value derives from `Math.random`/constant/canned data,
  not from the inputs; demonstrate output is noise or input-independent.

Confirmed → it's a finding. Not reproducible as a defect → drop it (documented as a false positive).

### Phase 3 — Fix (report + 全修), failing-test-first
Per confirmed finding (systematic-debugging + TDD):
- **Reproducibility** → thread `SeededRNG` (already in repo).
- **Decoy** → implement the real computation so output responds to inputs.
- **Fabrication** → **Path B (make it real)** preferred where a genuine method is tractable from
  available code/data; **Path A (honest downgrade)** where a real implementation needs deferred
  data / wet-lab — strip the false citation, relabel the UI/provenance honestly, set the validity
  tier to `demo`/`partial`. Either way the fabrication is gone; nothing keeps claiming science it
  doesn't do.

Each fix: **failing test → fix → test passes → full suite green (no regressions).**

---

## 6. Verification & deliverables

- **Findings doc** — `NEXUS_BIO_INTEGRITY_AUDIT_V2.md` at repo root (same location as the original
  `NEXUS_BIO_INTEGRITY_AUDIT.md`): the ranked table + per-finding status (`suspected` → `confirmed`
  → `fixed` → `verified`), each backed by its test name.
- **Per-finding test** — committed alongside the fix; the anti-decoy/determinism/trace assertion.
- **CI wiring** — fixed items get a standing test so fabrication cannot silently regress.
- **Success criteria:** every confirmed fabrication is either made real or honestly relabeled;
  **0 confirmed fabrications remain**; every fix has a passing code-level test; full suite green;
  DO-NOT-TOUCH and FORBIDDEN lists respected.

---

## 7. Decomposition & sequencing

"All surfaces + 全修" is too large for one implementation plan, so:

1. **Plan A (first):** Phase 0 + Phase 1 → the ranked findings report. Bounded, one pass,
   independently valuable.
2. **Plan B+ (then):** Phase 2–3 deep-verify + fix, executed **in severity order, one finding at
   a time**, batched by subsystem across sessions. Each batch: confirm → failing test → fix →
   verify → update the findings doc.

The first implementation plan covers Phase 0–1 in full plus the reusable Phase 2–3 fix workflow;
subsequent work draws down the ranked list until the confirmed-fabrication count is 0.
