# CellFree Reality Audit

## Current Implementation Status

CellFree is implemented primarily in `src/services/CellFreeEngine.ts`, with the tool surface in `src/components/tools/CellFreePage.tsx` and workflow metadata in `src/services/workflowRegistry.ts`.

The current implementation has a real simulation structure:

- `simulateCFPS` runs a deterministic ODE simulation.
- The ODE includes transcription, mRNA degradation, ribosome-limited translation, and resource consumption/regeneration terms.
- Resource pools include ATP, GTP, PEP, amino acids, NTPs, free ribosomes, and ribosome utilization.
- Time integration uses a fourth-order Runge-Kutta step.
- Plate-reader fitting uses a local Michaelis-Menten / Levenberg-Marquardt fit against generated demonstration data.
- The in-vitro to in-vivo estimate uses a deterministic seeded model plus heuristic biological correction factors.

This is not just a curated lookup. It is also not a fully sourced, calibrated, or experimentally validated CellFree prediction system.

## Model Structure vs Parameter Sourcing

The model structure and parameter evidence are separate trust claims.

| Area | Current state | Boundary |
|---|---|---|
| Model structure | Resource-aware TX-TL ODE structure is implemented. | Structure can be described as implemented. |
| Parameter values | Many defaults are embedded in code. | Defaults are not all per-value sourced. |
| Parameter units | Many units are present in names or comments. | Some units remain inferred from code context. |
| Parameter sources | Broad framework references appear in comments. | Per-parameter citations are incomplete. |
| Calibration | No repository calibration dataset establishes fit quality for the defaults. | Do not claim calibrated prediction. |
| Uncertainty | Confidence-like heuristics exist, but no parameter/output uncertainty model is implemented. | Do not claim quantified uncertainty. |

## Route Decision Table

| Route | What it means | Scientific truthfulness | Engineering cost | User value | Risk | When to choose |
|---|---|---|---|---|---|---|
| A. Structure implemented, parameters partial | Keep the implemented TX-TL simulation, split structure evidence from parameter sourcing limits. | High, because it names what is implemented and what is not. | Low to medium. | Preserves useful exploratory simulation while preventing overclaiming. | Users may still overread output unless labels stay clear. | Choose now. |
| B. Demo-only model | Treat the whole tool as a simple demo with no structure claim. | Conservative but under-describes current code. | Low. | Clear, but loses useful model-structure signal. | Hides real implementation work. | Choose only if the ODE structure is removed or invalidated. |
| C. Stronger sourced/calibrated model | Preserve or raise stronger claims with parameter sources, calibration, and uncertainty. | Only truthful if evidence exists. | High. | Strongest scientific value. | High if sources or calibration are missing. | Choose later after parameter sourcing and calibration work. |

## Final Step 12 Recommendation

Recommend Route A now.

CellFree should be described as a structure-implemented CellFree / TX-TL simulation with partially sourced parameters. The current validity tier remains unchanged in this task because parameter provenance, calibration, and uncertainty are not strong enough for formal claims.

## Decision Boundary

Implemented now:

- Resource-aware TX-TL ODE structure.
- Transcription, translation, degradation, and resource pool terms.
- Deterministic time integration.
- Local fitting and heuristic in-vitro to in-vivo estimate.
- Trust metadata that separates structure from parameter sourcing.

Not implemented now:

- Fully sourced parameter pack.
- Extract-specific calibration.
- Output prediction intervals.
- Parameter uncertainty model.
- Wet-lab validation.
- Protocol or external-handoff enforcement.

## Non-Claims

- No fully sourced parameter claim unless every required source exists.
- No calibration claim unless calibration evidence exists.
- No wet-lab validation claim unless evidence exists.
- No formal protocol or external-handoff claim when parameter provenance is incomplete.
- No claim that confidence-like UI values are calibrated uncertainty.
