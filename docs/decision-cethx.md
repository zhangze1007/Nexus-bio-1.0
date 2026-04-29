# CETHX Thermodynamics Decision Memo

P1 Step 10 audits the CETHX thermodynamics surface in Nexus-Bio. This memo is a scientific honesty and implementation decision. It does not add a thermodynamics backend.

## Current Implementation Status

CETHX logic currently appears in:

- `src/data/mockCETHX.ts`
- `src/components/tools/CETHXPage.tsx`
- `src/components/tools/shared/toolAssumptions.ts`
- `src/components/tools/shared/toolValidity.ts`
- `src/components/tools/shared/toolRegistry.ts`
- `src/store/workbenchPayloads.ts`

CETHX does not currently have a real condition-aware thermodynamics backend. The current implementation is demo-only reference bookkeeping.

Evidence from code:

- `computeThermo()` in `src/data/mockCETHX.ts` uses bundled pathway step tables and returns those reference delta G values unchanged.
- The same file explicitly says reaction-specific pH transforms, ionic-strength corrections, pMg/magnesium binding correction, group contribution, compartment-specific delta G prime adjustment, and eQuilibrator integration are not implemented.
- `src/components/tools/CETHXPage.tsx` writes `validity: "demo"` and records provenance notes that output delta G values are not for thermodynamic feasibility decisions.
- `src/components/tools/shared/toolValidity.ts` keeps `cethx` at `demo`.
- Current CETHX payloads contain pathway, temperature, pH, total reference delta G, entropy-style bookkeeping, efficiency sketch, and limiting step. They do not contain reaction-level uncertainty, ionic strength, pMg, compound IDs, backend name/version, or backend calculation provenance.

## Scientific Requirement For Real Thermodynamic Claims

Real thermodynamic feasibility claims require condition-aware calculation, not reference-table display or universal correction factors. A backend-backed result should carry reaction-level transformed delta G prime or equivalent, uncertainty, pH, ionic strength, pMg or magnesium treatment when relevant, temperature, compound identifier mapping, backend name/version, and a clear failure mode when the calculation cannot be performed.

The current mode does not meet those requirements.

## Route Decision Table

| Route | What it means | Scientific truthfulness | Engineering cost | User value | Risk | When to choose |
|---|---|---|---|---|---|---|
| A. Real backend integration | Integrate an actual condition-aware thermodynamics backend with typed request/response, uncertainty, conditions, compound mapping, and failure modes. | Highest if implemented and tested. | High. Requires backend dependency, compound mapping, uncertainty semantics, and failure handling. | High for users who need actual thermodynamic feasibility. | High risk if fallback values are mistaken for real results. | Choose later only when the backend can be integrated without fake outputs. |
| B. Demo-only boundary | Keep CETHX as a demo thermodynamics explainer with explicit assumptions, policy boundaries, benchmark cases, and safe wording. | Honest for current code because it matches the reference-table implementation. | Low. Mostly metadata, docs, wording, policy, and tests. | Moderate. Useful for workflow exploration and trust-runtime blocking. | Low if formal surfaces remain blocked for demo output. | Choose now for Step 10. |
| C. Remove formal claim surface | Hide or remove formal thermodynamics claims and keep only educational content or saved-payload compatibility. | Very high because ambiguous claims disappear. | Medium. Requires workflow and UI pruning. | Lower for users exploring route energetics. | Product disruption and broken exploratory affordance. | Choose if demo labeling remains too easy to misread. |

## Final Step 10 Recommendation

Recommend B now.

Keep CETHX as a demo-only thermodynamics explainer until a real condition-aware backend exists. Do not call current CETHX output real thermodynamic feasibility, condition-aware delta G prime, eQuilibrator-backed, or validated thermodynamics. Demo CETHX output may remain visible as workbench payload context, but it must not become a formal recommendation, protocol, export, or external-handoff thermodynamic claim.

## Decision Boundary

Implemented now:

- Decision memo for CETHX thermodynamics honesty.
- Mode boundary metadata in `src/domain/cethxThermodynamicsBoundary.ts`.
- Assumption metadata for demo-only thermodynamics, missing backend, missing uncertainty, and missing condition-aware corrections.
- Claim-surface policy rationales that preserve demo payload visibility while blocking formal demo claims.
- Benchmark cases for fake delta G, missing condition parameters, and missing uncertainty.
- Tests that prevent CETHX thermodynamics overclaiming.

Not implemented now:

- No eQuilibrator integration.
- No condition-aware thermodynamics backend.
- No reaction-level uncertainty calculation.
- No pH, ionic strength, pMg, or temperature transform beyond reference metadata.
- No compound identifier mapping.
- No export, protocol, recommendation, or external-handoff runtime enforcement.
- No UI redesign.

## Non-Claims

- No real thermodynamics claim unless a backend exists.
- No eQuilibrator claim unless integrated and tested.
- No wet-lab validation claim.
- No condition-aware delta G prime claim unless pH, ionic strength, pMg, uncertainty, and backend provenance are handled.
- Demo thermodynamics cannot become a protocol or external-handoff claim.
