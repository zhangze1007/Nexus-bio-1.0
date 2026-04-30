# DBTL Typed Loop-Back

Nexus-Bio treats DBTL loop-back as a trust-runtime boundary, not as automatic parameter rewriting. A committed DBTL run may produce `DBTLLearnedFeedback` for audit and display, but upstream seed builders only consume approved typed `LearnedDeltaPack` records.

## Record Roles

`ExperimentRecordV1` is the typed assay source. It carries units, sample context, timepoints, QC flags, and source metadata.

`DBTLLearnedFeedback` is the DBTL feedback summary. It preserves typed learned metrics and legacy text, but legacy text is audit-only.

`LearnedDeltaPack` is the reviewable loop-back object. It records the source DBTL run, source experiment record ids, target tools, explicit before/after delta fields, classification, and human gate status.

## Application Policy

Seed builders use `filterApprovedLearnedDeltaPacks()` before reading a pack. A pack cannot apply unless:

- it passes `validateLearnedDeltaPack()`;
- `sourceDbtlRunId` is present;
- `sourceExperimentRecordIds` is non-empty;
- `targetToolIds` includes the seed builder tool;
- `humanGateStatus` is `approved`.

Pending and rejected packs remain visible as records but do not change seeds. Missing experiment sources block application. Natural-language notes and legacy `learnedParameters` are never parsed into numeric changes.

## Seed Builder Boundary

The current integration applies only explicit `changedPriors` for existing seed fields:

- `fbasim.glucoseUptake`
- `fbasim.oxygenUptake`
- `catdes.requiredFlux`
- `catdes.designCount`
- `dyncon.controller.kp`
- `dyncon.controller.ki`
- `dyncon.controller.kd`
- `dyncon.controller.setpoint`
- `dyncon.hill.vmax`
- `dyncon.hill.kd`
- `dyncon.hill.n`
- `cellfree.params.temperature`
- `cellfree.params.simulationTime`
- `cellfree.params.ribosomeTotal`

Unknown fields, nonmatching targets, `changedBounds`, and `changedWeights` are skipped safely in this step.

## Limits

This boundary does not provide wet-lab validation, scientific validation, automatic approval, or a falsification dashboard. Step 15 can add blocked-propagation review surfaces later.
