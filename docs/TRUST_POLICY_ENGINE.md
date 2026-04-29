# Trust Policy Engine

`evaluateClaimSurfacePolicy` is the first Step 7A implementation slice for unified trust decisions. It is a pure function in `src/services/trustPolicyEngine.ts`.

## What It Does

The engine evaluates one tool output on one claim surface. It accepts:

- `toolId`
- `surface`
- optional `validityTier`
- draft state
- provenance ids
- evidence ids
- assumption ids
- human gate requirement and status

It returns the protocol-level `GateDecision` shape from `src/protocol/nexusTrustRuntime.ts`:

- `status`
- optional `blockCode`
- `reason`
- `allowedSurfaces`
- `blockedSurfaces`
- optional `overridePath`

## How It Uses ClaimSurfacePolicy

The engine looks up the Step 5 policy with `getClaimSurfacePolicy(toolId, surface)`. The policy decides which validity tiers are allowed, whether provenance is required, whether draft outputs are denied, and whether human review is required.

Current handling:

- Missing policy returns `blocked` with `MISSING_POLICY`.
- Missing validity tier returns `blocked` with `TIER_NOT_ALLOWED_FOR_SURFACE`. Step 7A reuses the existing Step 5 block-code catalog rather than adding a new code for missing tier.
- Draft output on a deny-draft surface returns `blocked` with `DRAFT_OUTPUT_NOT_EXPORTABLE`.
- Demo protocol returns `blocked` with `DEMO_OUTPUT_PROTOCOL_BLOCKED`.
- Demo external handoff returns `blocked` with `EXTERNAL_HANDOFF_BLOCKED`.
- Missing provenance on a provenance-required surface returns `blocked` with `PROVENANCE_REQUIRED`.
- Pending human review returns `gated` with `HUMAN_GATE_REQUIRED`.
- Approved human review returns `ok` when all other requirements pass.
- Demo payloads that are allowed by policy return `demoOnly`.

## Benchmark Corpus

`__tests__/trustPolicyEngineBenchmark.test.ts` loads the Step 6 corpus in `benchmarks/trust-runtime-cases/` and compares engine decisions to `benchmarks/expected_labels.csv`.

This is local development alignment for the trust-runtime corpus. It is not scientific validation, wet-lab validation, product performance evidence, or an external benchmark claim.

## What It Does Not Do Yet

- No UI enforcement.
- No export blocking.
- No route guards.
- No protocol blocking.
- No store write blocking.
- No state machine replacement.
- No provenance middleware.

Product behavior remains unchanged in Step 7A.

## Running Checks

```bash
npm run benchmark:trust:validate
npx jest __tests__/trustPolicyEngine.test.ts --runInBand
npx jest __tests__/trustPolicyEngineBenchmark.test.ts --runInBand
```

If the benchmark corpus changes, run the corpus validator before the engine benchmark test so schema and label integrity stay separate from engine behavior.

## Known Limitations

The engine only evaluates claim-surface policy inputs that callers provide. Step 7B still needs deliberate integration with existing store, UI, export, protocol, and route flows. That later integration should display or consume the returned `GateDecision` instead of recreating local trust rules.
