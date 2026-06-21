# P4: Trust Self-Audit Report

## 1. Script Outputs

### `npm run benchmark:trust:validate`

Ran successfully. Validates the trust benchmark corpus (74 cases across 7 categories, 5 surfaces, 14 tools, 4 gate statuses). Output:

- **totalCases**: 74
- **categoryCoverage**: truthful-partial (11), unsafe-demo (9), missing-evidence (16), uncertainty-unresolved (9), human-gate-required (12), known-bad-case (9), draft-output (8)
- **surfaceCoverage**: payload (6), export (18), recommendation (25), protocol (11), external-handoff (14)
- **statusCoverage**: ok (10), demoOnly (4), blocked (39), gated (21)
- **knownBadCoverage**: All 8 required known-bad tags present
- **integrity**: ok

The script validates: JSON schema conformance, CSV/JSON label consistency, category minimums, surface/status coverage, duplicate IDs, and known-bad tag coverage.

### `npm run proof:check`

Ran successfully. Checks proof package integrity. Output:

- **checkedPackageFiles**: 14 required files present
- **checkedJsonFiles**: 12 JSON files parse correctly
- **checkedCsvFiles**: 3 CSV files have headers and rows
- **nonClaims**: 11 required non-claim disclaimers present
- **proof package check passed**

The script verifies: manifest schema version, non-claims array completeness, all packagePath/sourcePath entries exist on disk, no orphan files in proof-package/, JSON parse validity, CSV structure.

---

## 2. Trust Policy Engine Analysis

### File: `src/services/trustPolicyEngine.ts` (161 lines)

**Inputs** (via `EvaluateClaimSurfacePolicyInput`):
- `toolId`: string (one of 14 tools)
- `surface`: ClaimSurface (payload/export/recommendation/protocol/external-handoff)
- `validityTier`: ValidityTier (real/partial/demo) -- optional
- `isDraft`: boolean -- optional
- `provenanceIds`: string[] -- optional
- `evidenceIds`: string[] -- optional
- `assumptionIds`: string[] -- optional
- `requiresHumanGate`: boolean -- optional
- `humanGateStatus`: HumanGateStatus -- optional

**Computation** (deterministic decision tree):
1. Look up policy for (toolId, surface) from `claimSurfacePolicies.ts`. If missing -> `blocked/MISSING_POLICY`
2. If no validityTier provided -> `blocked/TIER_NOT_ALLOWED_FOR_SURFACE`
3. If isDraft AND policy.denyIfDraft -> `blocked/DRAFT_OUTPUT_NOT_EXPORTABLE`
4. If validityTier not in policy.allowedTiers -> `blocked` (with tier-specific block code)
5. If policy.requiresProvenance AND no provenanceIds -> `blocked/PROVENANCE_REQUIRED`
6. If humanGate required AND not approved -> `gated/HUMAN_GATE_REQUIRED` (or `blocked` if rejected)
7. If validityTier is `demo` -> `demoOnly`
8. Otherwise -> `ok`

**Determinism**: Fully deterministic. No randomness, no external calls, no async. Pure function of inputs.

**Does it check for Math.random in computation paths?** No. The trust policy engine does not inspect source code, computation paths, or implementation details. It operates entirely on metadata labels (validityTier, isDraft, provenanceIds, etc.).

**Does it check for test coverage?** No. Test coverage is not an input to the policy engine.

**Key finding**: The validityTier is NOT computed by the trust policy engine. It is a manually assigned label set in boundary definition files:
- `src/domain/communityFbaBoundary.ts`: single-species -> `partial`, community -> `demo`
- `src/domain/cethxThermodynamicsBoundary.ts`: `partial`
- `src/domain/cellfreeParameterBoundary.ts`: `demo`
- `src/domain/multioModelBoundary.ts`: `demo`

These are human-authored declarations about the scientific maturity of each tool, not automated assessments.

---

## 3. Python Reference Implementation Analysis

### Files in `reference_impl_py/nexus_trust_runtime/`:
- `models.py` (246 lines) -- dataclasses mirroring TS types: ValidityTier, ClaimSurface, GateStatus, ClaimSurfacePolicy, BenchmarkCase, ExpectedLabel
- `policy.py` (286 lines) -- `evaluate_claim_surface_policy()` function, same decision tree as TS
- `benchmark.py` (253 lines) -- loads benchmark cases from JSON + expected labels from CSV, validates consistency
- `consistency.py` (355 lines) -- builds consistency report comparing Python vs expected labels AND Python vs TypeScript runtime results
- `cli.py` -- CLI entry point
- `__init__.py` -- exports

### Does the Python reference produce the same outputs?

Yes, the consistency report (`proof-package/reports/second-implementation-consistency.json`) shows:
- **Python vs expected agreement**: 1.0 (74/74)
- **Python vs TypeScript agreement**: 1.0 (74/74)
- **Mismatch count**: 0

The consistency script (`consistency.py`) actually does compare TS vs Python outputs. It:
1. Loads the TypeScript raw results from `reports/public-benchmark/raw-results.json`
2. Runs the Python evaluator on the same 74 benchmark cases
3. Compares both against expected labels AND against each other
4. Reports mismatches with case ID, mismatch type, and actual values

### Critical caveat (acknowledged in the code):

The Python policy table is a **manually copied JSON snapshot** (`reference_impl_py/policies/claim_surface_policies.json`). The file header says: `"syncStatus": "not automatically synced; run the consistency report to detect drift"`. This means if the TypeScript policy changes, the Python snapshot must be manually updated. The consistency report would catch drift, but only if re-run.

The Python reference is a local second implementation, not independent third-party validation. Both implementations share the same author, same policy data, and same test cases.

---

## 4. Proof Package Assessment

### Structure (`proof-package/`)

The proof package is well-organized into 7 sections:
- **specs/** (5 files) -- Protocol spec (nexus-trust-runtime-v0.md), PROV-DM mapping, SBOL 3 mapping, experiment record spec, learned delta pack spec
- **benchmark/** (6 files) -- Schema, expected labels CSV, benchmark cases JSON, replay scripts
- **reports/** (8 files) -- Trust metrics, public benchmark report/summary/raw results, second-implementation consistency JSON/MD
- **examples/** (6 files) -- Safe/blocked showcase traces, showcase scripts
- **provenance/** (5 files) -- Example provenance bundles, SBOL artifacts, middleware docs
- **limitations/** (6 files) -- README, manifest, replication guide, replay guide, limitations doc, demo status table
- **checks/** (1 file) -- Check documentation

### What it actually contains:

The `manifest.json` explicitly lists what the package proves and does not prove. The 11 non-claims are enforced by `checkProofPackage.mjs` -- the script will fail if any non-claim is missing. This is a genuine structural safeguard against overclaiming.

The `limitations.md` is unusually honest. It explicitly states:
- "This proof package is a local trust-runtime artifact. It shows that benchmark cases, expected labels, reports, examples, and provenance notes are present and replayable. It does not prove biological truth."
- Lists specific scientific limitations for each tool (Community FBA is demo-only, CETHX lacks condition-aware backend, MultiO is deterministic demo, CellFree parameters are heuristic)
- Lists runtime limitations (local labels, local benchmarks, copied Python snapshot, no external review completed)

### Is it structured evidence or just documentation?

It is structured evidence with explicit guardrails. The replay commands (`npm run benchmark:trust:validate`, `npm run benchmark:trust:evaluate`, `npm run benchmark:trust:report`, `npm run benchmark:public`, `npm run reference:py:compare`, `npm run proof:check`) are runnable scripts that regenerate the reports. The proof check script verifies file existence, JSON validity, CSV structure, and non-claim completeness.

However, the evidence is entirely self-referential: the system validates its own claims against its own test cases using its own scripts.

---

## 5. Benchmark Quality Assessment

### Benchmark corpus: 74 cases in `benchmarks/trust-runtime-cases/p0-step-6-cases.json`

**Categories tested**:
- **truthful-partial** (11 cases): Correctly allowed partial outputs on appropriate surfaces (payload, export, recommendation, protocol, external-handoff) when provenance and evidence are present
- **unsafe-demo** (9 cases): Demo outputs correctly blocked from formal surfaces (recommendation, protocol, external-handoff) but allowed as demoOnly payloads
- **missing-evidence** (16 cases): Missing provenance correctly blocks export/recommendation/external-handoff surfaces
- **uncertainty-unresolved** (9 cases): Unresolved uncertainty correctly gates (not blocks) recommendation/export/external-handoff via human review
- **human-gate-required** (12 cases): Protocol and external-handoff surfaces correctly require human review before approval
- **known-bad-case** (9 cases): Specific known failure modes (community FBA fake exchange, CETHX fake dG, stringly DBTL loopback, draft protocol export, demo external handoff, missing provenance export, demo CellFree protocol, NEXAI missing evidence)
- **draft-output** (8 cases): Draft outputs correctly blocked from export and protocol surfaces

**Are they testing real scenarios or trivial ones?**

The scenarios are non-trivial. They test:
- The interaction between validity tier, surface type, provenance, evidence, draft status, and human gate status
- Specific known failure modes where demo/partial outputs could leak into formal claims
- Edge cases like "rejected human gate" vs "pending human gate" producing different outcomes (blocked vs gated)
- The distinction between `gated` (can proceed with human review) and `blocked` (cannot proceed at all)

The 8 known-bad cases represent real failure modes specific to this codebase (community FBA not being a real joint LP, CETHX using reference values not measured ones, stringly-typed DBTL feedback).

**Limitation**: The benchmarks test the policy decision tree, not the scientific correctness of the tools themselves. A tool could compute wrong numbers and still get `ok` if its validityTier is `real` and it has provenance.

---

## 6. Overall Verdict

### What the trust system actually is:

A **claim-surface access control system**. It determines which outputs (payload, export, recommendation, protocol, external-handoff) are allowed based on metadata labels (validity tier, provenance, evidence, draft status, human review). This is a policy enforcement layer, not a scientific validation system.

### What it does well:

1. **Deterministic and auditable**: The policy engine is a pure function. Same inputs always produce same outputs. No randomness, no hidden state.
2. **Two-implementation consistency**: Python and TypeScript agree on all 74 cases. The consistency report is generated by actually running both implementations and comparing.
3. **Honest about limitations**: The non-claims list, limitations.md, and README.md are unusually explicit about what is NOT validated. The checkProofPackage script enforces these disclaimers.
4. **Known-bad case coverage**: 8 specific failure modes are tested, not just happy paths.
5. **Structural safeguards**: The proof check script fails if files are missing, JSON is invalid, CSVs lack headers, or non-claims are removed.
6. **Public benchmark comparison**: The benchmark report compares three modes (no-gating, badge-only, runtime-gating) showing that runtime-gating achieves 0% unsafe propagation while no-gating and badge-only both achieve 100% unsafe propagation.

### What it does NOT do:

1. **Does not detect Math.random in computation paths** -- the policy engine never inspects source code
2. **Does not check test coverage** -- test coverage is not an input
3. **Does not validate scientific correctness** -- a tool labeled `real` with provenance gets `ok` regardless of whether its math is right
4. **Does not auto-assign validity tiers** -- tiers are manually declared in boundary files by the author
5. **The Python reference is not independent** -- same author, same test cases, manually synced policy snapshot
6. **No external reviewers have completed the review workflow** -- templates exist but are empty
7. **No wet-lab validation** -- explicitly disclaimed

### Is it genuinely self-verifying or performative?

**It is genuinely self-verifying for what it claims to verify** -- which is the narrow question of "does the policy engine correctly apply its own rules to its own test cases, and do two implementations agree?" The answer is yes, and the verification is reproducible via `npm run proof:replay`.

**It is NOT self-verifying for what it does not claim** -- scientific correctness, real-world safety, independent validation. The system is honest about this gap.

The risk is in the manual assignment of validity tiers. If a tool author incorrectly labels a `demo` tool as `real`, the trust system will faithfully report `ok` for that tool's outputs. The trust system verifies policy compliance, not the accuracy of its own inputs. This is a real limitation, but it is explicitly acknowledged in the documentation.
