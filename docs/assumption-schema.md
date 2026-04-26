# Assumption Schema — Phase 1 Design Notes

## Why this exists

Nexus-Bio already exposes a static validity tier per tool
(`'real' | 'partial' | 'demo'` in
`src/components/tools/shared/toolValidity.ts`). That tier answers the
question *"how trustworthy is the math behind this tool?"* — but it is
a single label, attached to the tool, not to the data the tool
produces. It cannot answer two questions that matter for a real
research workflow:

1. **Which specific assumptions does a tool depend on?**
   "FBAsim is partial" tells the user nothing about *why*. Is it the
   solver? The objective? The lack of regulation? Each of those has a
   different blast radius for downstream work.

2. **Should a downstream tool refuse to consume an upstream output?**
   If CETHX produces ΔG values using a uniform pH discount with no
   chemical basis, FBAsim should not silently treat those values as
   feasibility constraints. A static tier cannot express that
   relationship; a typed assumption can.

The four interfaces in `src/types/assumptions.ts` —
`ToolAssumption`, `Evidence`, `ProvenanceEntry`, `AssumptionViolation`
— promote those concepts to first-class objects so the workbench
payload bus can carry them and so future phases can build runtime
gating on top.

## Differentiation vs. prior art

The natural reference points are MIRIAM
(DOI: 10.1038/nbt1156), the BioModels curated/non-curated tier system,
COMBINE/OMEX archives, and Galaxy's provenance graph. All four
standardize *static* metadata: a model's identifiers, its curation
status, its bundled artefacts, the chain of tools that produced a
result. None of them gate execution at the UI layer based on whether
an upstream output's assumptions are compatible with a downstream
tool's required inputs.

Nexus-Bio's differentiation space is exactly that: **assumptions and
evidence as runtime objects, not just documentation**. Phase 1 lays
the type foundation; Phase 2 adds violation detection and UI gating;
Phase 3 adds workflow-level overrides.

## Why these four types, and not more

- **`ToolAssumption`** is the core unit. It is registry-shaped (one
  per (toolId, id) pair, defined statically in Phase 1.2) rather than
  payload-shaped, so the wording lives in one place and payloads
  reference it by ID. This avoids drift.

- **`Evidence`** is per-output, not per-tool, because a single tool
  run can emit values whose backing varies — one reaction's ΔG might
  come from Lehninger, another from a group-contribution estimate.
  The `'demo'` confidence tier is intentionally separate from
  `'low'`: a low-confidence value is still scientifically meaningful;
  a demo value exists only for UI illustration.

- **`ProvenanceEntry`** is the per-execution record that a tool
  writes to its payload alongside its normal output. It carries
  assumption IDs, not embedded objects, so the registry remains the
  source of truth. `upstreamProvenance` is a list of IDs/keys so the
  runtime can walk a chain of executions and surface the full
  assumption set behind any final result.

- **`AssumptionViolation`** is the type a future runtime check will
  produce. Phase 1 ships only the shape; no detector runs yet.

## What is deliberately *not* in this schema

- **No assumption inheritance graph.** An assumption is owned by one
  tool. If two tools share an assumption (e.g. steady state), each
  declares its own. This keeps the registry flat and easy to grep.

- **No automatic violation rules.** Whether `fbasim.steady_state`
  conflicts with a transient-state input is a Phase 2 problem and
  belongs in detector code, not in the schema.

- **No payload migration.** The schema adds `runProvenance` as
  *optional* on existing payloads in Phase 1.3. Existing data without
  runProvenance keeps working. New writes must populate it. Field is
  named `runProvenance` (not `provenance`) to avoid collision with
  ProEvolWorkbenchPayload's pre-existing `provenance: 'simulated' |
  'inferred' | ...` field.

- **No tier upgrades.** Per the standing rule, tools currently marked
  `'demo'` (CETHX, community FBA mode, MultiO, CFS) stay `'demo'` in
  Phase 1, even though their assumption lists are now richer. The
  tier is upgraded only after Phase 2 algorithm work, with
  verifiable evidence.

## Conventions and limits

- `ToolAssumption.statement` is capped at 120 characters so it fits a
  single UI row without truncation.
- Every assumption's `id` is namespaced as `<toolId>.<slug>` so the
  registry can be loaded into a single Map.
- `Evidence.reference = "MOCK"` is the only allowed marker for
  unbacked values. No fabricated DOIs, no plausible-sounding URLs.

## Forward-compatibility

Phase 2 will add (without breaking these types): a registry loader
keyed by `id`; a violation detector keyed by `(downstream toolId,
upstream assumption set)`; and UI surfaces (banners, blocked-tool
states) that read `ProvenanceEntry` off the payload bus. None of
those additions require changing the four interfaces shipped here.
