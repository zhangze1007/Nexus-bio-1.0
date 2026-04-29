# Trust Benchmark Corpus

This directory contains the P0 Step 6 trust-runtime benchmark corpus. It is a static corpus plus an integrity validator. It does not run the Nexus-Bio runtime against the cases yet.

## What It Measures

The corpus describes whether an output should be visible, blocked, or gated when consumed on a specific claim surface. It is designed to exercise trust vocabulary added in earlier P0 steps:

- validity tier
- provenance presence
- evidence presence
- draft state
- unresolved uncertainty
- human gate requirements
- known bad trust failures

## What It Does Not Measure

This corpus does not require wet-lab data. It does not evaluate scientific algorithms, run FBA, run CETHX thermodynamics, execute protocols, or score biological outcomes. It does not claim a runtime score or production readiness.

Step 7 is expected to connect actual runtime policy evaluation to this answer key.

## Expected Statuses

- `ok`: the described output is acceptable on the specified surface.
- `blocked`: the described output should not be consumed on the specified surface.
- `gated`: the described output needs human review before consumption.
- `demoOnly`: the described output may remain visible only as demo or exploratory context.

## Categories

- `truthful-partial`: partial outputs that remain honestly framed and traceable.
- `unsafe-demo`: demo outputs used on a stronger surface than their tier supports.
- `missing-evidence`: outputs missing provenance or evidence trace for the target surface.
- `uncertainty-unresolved`: outputs whose unresolved uncertainty should trigger review.
- `human-gate-required`: outputs on protocol or external surfaces before human review.
- `known-bad-case`: regression cases that encode trust failures Nexus-Bio should keep catching.
- `draft-output`: draft artifacts that should not become formal exports or protocol-like outputs.

## Known-Bad Cases

Known-bad cases exist so future policy evaluation can be tested against explicit failure modes:

- community FBA fake exchange treated as a formal recommendation
- CETHX demo delta G prime treated as real thermodynamic feasibility
- stringly DBTL loop-back treated as typed learning
- draft DBTL protocol export
- demo MultiO output used as external handoff
- missing provenance export
- demo CellFree result used as protocol-like artifact
- NEXAI answer with missing evidence used as recommendation

The community FBA known-bad cases are claim-boundary regressions: illustrative two-species demo output must not become a formal recommendation, protocol, or external-handoff claim. They do not evaluate or imply a true joint community FBA solver.

## Expected Labels

`expected_labels.csv` is the answer key. Each JSON case must have exactly one CSV row with matching:

- `caseId`
- `expectedStatus`
- `expectedBlockCode`
- `category`
- `toolId`
- `surface`
- `knownBad`

Blank `expectedBlockCode` means the JSON case has `expected.blockCode: null`.

## Running The Validator

Run:

```bash
npm run benchmark:trust:validate
```

The validator checks corpus integrity, required field presence, enum values, one-to-one CSV coverage, category coverage, surface coverage, status coverage, total case count, and required known-bad risk tags.

## Current Limitation

This is only a corpus and integrity validator. It does not call a runtime evaluator, enforce UI behavior, block exports, block protocols, or generate provenance middleware. No wet-lab validation is claimed.
