# Artemisinin Trust-Gated Walkthrough

## Purpose

This walkthrough shows how Nexus-Bio handles a single synthetic biology scenario with explicit trust boundaries:
- validity tiers,
- assumptions,
- provenance snapshots,
- and runtime gating.

It is a **documentation and transparency demo**, not a claim of wet-lab optimization.

## Setup

Use the same local setup flow documented in `README.md`:

```bash
git clone https://github.com/zhangze1007/Nexus-bio-1.0
cd Nexus-bio-1.0
npm install
```

Create `.env.local` with:
- `GROQ_API_KEY`
- `GEMINI_API_KEY`

Run:

```bash
npm run dev
```

Open: `http://localhost:3000`

## Routes Used In This Demo

- `/tools/pathd`
- `/tools/fbasim`
- `/tools/cethx`
- `/tools/catdes`
- `/tools/cellfree`
- `/tools/dbtlflow`
- `/tools/multio`

## Expected Validity Tiers

From `src/components/tools/shared/toolValidity.ts`:

- `fbasim` = `partial` (single-species LP is real; two-species is not joint LP)
- `cethx` = `demo`
- `cellfree` = `demo`
- `multio` = `demo`
- `catdes` = `partial`
- `dbtlflow` = `partial`
- `nexai` = `real`

## Expected Assumptions

From `src/components/tools/shared/toolAssumptions.ts`:

- `fbasim-community.community_not_joint_lp` is `blocking`
- `cethx.uniform_ph_factor` is `blocking`
- `multio.not_mofa_plus` and `multio.not_vae` are `blocking`
- `cellfree.parameters_unsourced` is `blocking`

These assumptions are intended to keep downstream interpretation honest.

## Expected Provenance

`runProvenance` is expected on payloads emitted by key tools, using `createProvenanceEntry()` from `src/utils/provenance.ts`.

In current code, provenance is explicitly written in at least:
- FBA API route (`fbasim-single`, `fbasim-community`)
- CETHX page payload write
- MultiO page payload write
- CellFree page payload write

## Expected Runtime Gating Behavior

From `src/utils/runtimeGating.ts`:

- `demo -> demo`: allowed with warning (demo-only chain)
- `demo -> partial`: blocked
- `demo -> real`: blocked
- missing `runProvenance`: treated as untrusted and blocked
- blocking assumptions: block escalation into `partial`/`real` downstream inference

`WorkbenchInlineContext` surfaces these decisions with runtime gate notices.

## Suggested Demo Flow

1. Start in `/tools/pathd` and establish the target context (artemisinin showcase pathway context).
2. Move to `/tools/fbasim` and compare single-species vs two-species mode.
3. Observe that two-species mode is documented as heuristic/demo-like and carries stronger assumptions.
4. Open `/tools/cethx` and verify it is marked demo with placeholder thermodynamics caveats.
5. Open `/tools/multio` and verify deterministic, non-Bayesian/non-MOFA+ framing.
6. Open `/tools/cellfree` and review assumptions/provenance around parameter evidence limits.
7. Review `/tools/dbtlflow` to see workflow gating and loop control context.

## What This Demo Proves

- The system exposes trust metadata at runtime instead of hiding uncertainty.
- Provenance and assumption severity affect downstream usability.
- Demo-tier outputs are explicitly prevented from silently becoming strong evidence.
- Workflow control and contract language are tied to transparent gating logic.

## What This Demo Does Not Prove

- Wet-lab validation
- Real artemisinin optimization performance
- Research-grade thermodynamics
- True joint community FBA
- Bayesian MultiO inference
- Clinical or industrial readiness
