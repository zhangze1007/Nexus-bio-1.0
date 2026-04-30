# One-Page Trust-Gated Showcase

## Thesis

Nexus-Bio can move a safe, traceable partial output forward while blocking a demo output from becoming a stronger scientific claim.

This is an artemisinin educational trace. It does not claim pathway optimization, wet-lab validation, or scientific validation.

## Safe Path

```text
Design input
-> partial tool output with assumptions
-> provenance attached
-> claim surface evaluated
-> allowed progression
```

## Blocked Path

```text
Demo thermodynamics output
-> protocol surface requested
-> claim surface evaluated
-> blocked with DEMO_OUTPUT_PROTOCOL_BLOCKED
-> output remains exploratory, not a protocol claim
```

## Showcase Table

| Path | Input status | Surface requested | GateDecision | Why |
| --- | --- | --- | --- | --- |
| Safe path | partial `fbasim` output with demo provenance IDs | `recommendation` | `ok` | Partial output has provenance and stays on an allowed surface. |
| Blocked path | demo `cethx` thermodynamics output | `protocol` | `blocked` / `DEMO_OUTPUT_PROTOCOL_BLOCKED` | Demo thermodynamics cannot support protocol-like operational claims. |

## Provenance And Assumptions

The safe path includes local demo provenance IDs such as `demo-provenance-fbasim-artemisinin-v1`. These are trace identifiers, not real assay records.

The blocked path includes CETHX assumptions such as `cethx.thermodynamics_demo_only`, `cethx.missing_condition_aware_backend`, and `cethx.uncertainty_not_calculated`.

## What The Reviewer Should Notice

- The workbench can keep exploratory outputs visible.
- The runtime separates payload, recommendation, protocol, export, and external-handoff surfaces.
- Stronger surfaces require stronger validity and provenance.
- Blocking is a trust-boundary result, not a biological falsification result.

## Non-Claims

- No wet-lab validation.
- No real artemisinin optimization.
- No real CETHX thermodynamic feasibility claim.
- No external benchmark claim.
- No claim that a blocked output is biologically false.
