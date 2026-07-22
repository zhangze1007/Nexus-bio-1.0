# Lab Interface Ground-Truth Plan V1

> Place at: `spec/lab-interface-groundtruth-v1.md`
> Extends: `reference_impl_py/scientific/README.md` (scientific harness)

## Goal

Build and Test are physical. Design and Learn are not.

The **lab interface** is the last metre of Design: the boundary where a design
leaves the browser and becomes something a machine or a human can actually run.

> A design that cannot be executed has not left the browser.

Every artefact Nexus-Bio emits across that boundary must be verified against the
**real external toolchain** — not against a test written in the same commit.

## Scope

**IN** — verifiable offline, no wet lab, no hardware:
- labware / pipette / module identifier validity
- OT-2 JSON protocol schema conformance
- `opentrons_simulate` dry-run (parse + execute in simulation)
- SBOL-3 round-trip against `pySBOL3`
- `ExperimentRecordV1` ingest → `LearnedDeltaPack` provenance chain

**OUT** — requires a physical device or a relationship, not a commit:
- driving hardware, scheduling, LIMS sync, Antha/Synthace runtime
- anything claiming wet-lab validation

## Verification standard

Inherited **verbatim** from `reference_impl_py/scientific/README.md`
§Anti-fabrication rules. Non-negotiable:

1. **No self-report** — paste real command/test output, never "✔ fixed".
2. **Ground truth, not internal consistency** — a passing test written in the
   same commit does not prove correctness. The external comparison is the proof.
3. **A decoy is worse than a stub** — a function that ignores its inputs must be
   made to change output when inputs change.

A fourth rule, specific to this layer:

4. **No validity claim without a validator.** If a docstring says "valid X",
   there must be a check that X's own toolchain accepts it. Otherwise the
   docstring is citation laundering wearing a different hat.

## Status matrix

| # | Check | Engine | External reference | CI? | Status |
|---|-------|--------|--------------------|-----|--------|
| L1 | Labware / pipette ID validity | `labAutomationBridge.ts` `LABWARE_MAP` + `PIPETTE_MAP` | `opentrons_shared_data` 9.1.1 (141 labware / 14 module / 19 pipette defs) | ✅ `__tests__/labwareGroundTruth.test.ts` | **✅ FIXED & VERIFIED (2026-07-17)** — ran the reproduce script against real `opentrons_shared_data` 9.1.1: `nest_24_wellplate_10.4ml_flat` → **MISS** (confirmed fabricated); corrected to `nest_24_wellplate_10.4ml` → all 7 labware **OK**. Also verified modules 4/4 OK and pipettes 5/5 OK (my first pipette check used the wrong dir and false-MISSed — corrected against `pipetteNameSpecs.json`). Wired a JS ground-truth test (17 assertions) comparing the engine maps to a frozen fixture emitted from the package — RED on the fabricated id, GREEN on the fix (not a decoy). |
| L2 | Validity tier registered | `labAutomationBridge.ts` | `src/config/toolValidity.ts` | ❌ | **MISSING** — the only engine with no tier. UI shows no caption. |
| L3 | Docstring claim ↔ evidence | `exportOT2Protocol` JSDoc | rule 4 above | ❌ | **FAILING** — claims "Generates a **valid** Opentrons protocol JSON that can be loaded into the OT-2 app or executed via the Opentrons API." Nothing validates this. |
| L4 | OT-2 JSON schema conformance | `exportOT2Protocol` output | Opentrons protocol schema (`$otSharedSchema`, `schemaVersion`, `commandType`) | ❌ | **UNKNOWN** — `OT2Protocol.protocol` is typed `object`. Emitted commands use `{command, params}`; the real schema uses `commandType`. Verify before claiming. |
| L5 | Simulation dry-run | `exportOT2Protocol` output | `opentrons_simulate <protocol.json>` | ❌ | **BLOCKED on L4** |
| L6 | SBOL-3 round-trip | `src/modules/sbol/index.ts` | `pySBOL3` parse → re-serialise → diff | ❌ | **UNKNOWN** |

## Task order

L1 → L3 → L2 → L4 → L5. L6 independent.

L1 first because it is already **failing with a known, reproducible diff** —
fix the thing that is provably broken before auditing the thing that might be.

L3 before L2 because the tier caption must state what the code can actually
prove. Writing the caption first forces the claim to shrink to the evidence.

## Reproduce L1

```bash
pip install opentrons
python3 - <<'PY'
import opentrons_shared_data, os
d = os.path.join(os.path.dirname(opentrons_shared_data.__file__),
                 'data', 'labware', 'definitions', '2')
real = set(os.listdir(d))
claimed = [
  "nest_96_wellplate_200ul_flat", "nest_24_wellplate_10.4ml_flat",
  "nest_12_reservoir_15ml", "opentrons_96_tiprack_20ul",
  "opentrons_96_tiprack_300ul", "opentrons_96_tiprack_1000ul",
  "opentrons_24_tuberack_eppendorf_1.5ml_safelock_snapcap",
]
for c in claimed:
    print(("OK   " if c in real else "MISS ") + c)
PY
```

Wire the same comparison as `__tests__/labwareGroundTruth.test.ts`, driven by a
frozen JSON fixture emitted from the `opentrons` package — so the JS test
compares engine output to an external number, not to itself.

## Stop condition

This plan is DONE when **every row is ✅ or explicitly BLOCKED with a stated
reason**.

It is *not* done when the code feels complete. "Complete the rest of what can
run in software" is not a stop condition — it is an open loop. The matrix is
the loop's terminator.

## Non-claims

Carried forward from `proof-package/reports/second-implementation-consistency.md`:

- No wet-lab validation is claimed.
- No independent third-party validation is claimed.
- Passing L1–L6 proves the **emitted artefact is well-formed and accepted by the
  vendor toolchain**. It proves nothing about whether the experiment works.
