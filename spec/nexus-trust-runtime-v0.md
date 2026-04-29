# Nexus Trust Runtime Protocol v0

## Scope

This protocol defines trust-runtime objects for Nexus-Bio. These objects are independent of React components, Zustand stores, Next.js routes, API handlers, and visual UI state. They are vocabulary and data-contract objects only; wiring them into product behavior is future work.

The v0 purpose is to describe how assumptions, evidence, provenance, violations, workflow contracts, gate decisions, claim surfaces, validity tiers, and gate statuses should be represented without upgrading any tool tier or changing scientific algorithms.

## Legal Value Sets

### ValidityTier

Legal values:
- `real`: the method matches the scientific label closely enough for the scoped use described by the tool.
- `partial`: core pieces are real, but important parameters, coupling, calibration, or coverage remain simplified.
- `demo`: values are for demonstration, visualization, or workflow testing and must not be treated as scientific evidence.

Forbidden values:
- Any value other than `real`, `partial`, or `demo`.
- Marketing labels such as `validated`, `production`, `SOTA`, `research-grade`, or `wet-lab`.

### ClaimSurface

Legal values:
- `payload`: internal workbench payloads.
- `export`: downloaded or serialized output.
- `recommendation`: suggested intervention, design choice, or next action.
- `protocol`: protocol-like instructions or procedural handoff.
- `external-handoff`: transfer outside Nexus-Bio, such as downstream tools, collaborators, or lab-facing systems.

Forbidden values:
- Any value outside the five listed strings.
- Broad aliases such as `all`, `public`, `lab`, or `paper`.

### GateStatus

Legal values:
- `ok`: the gate allows the requested surfaces.
- `blocked`: the gate refuses one or more requested surfaces.
- `gated`: the gate allows only after a human review or explicit gate step.
- `demoOnly`: the output may remain in demo-only contexts but must not escalate to stronger claims.

Forbidden values:
- Any value other than `ok`, `blocked`, `gated`, or `demoOnly`.
- Boolean-only states such as `true` or `false`, because they lose the distinction between blocked, gated, and demo-only.

## Protocol Objects

### ToolAssumption

Plain meaning: a specific assumption that a tool depends on or introduces.

Fields:
- `assumptionId`: stable unique identifier, usually namespaced by tool.
- `toolId`: identifier of the tool that owns the assumption.
- `statement`: concise human-readable assumption.
- `validityTier`: `real`, `partial`, or `demo`.
- `status`: `active`, `resolved`, `violated`, or `unknown`.
- `knownLimitations`: list of known limits that should remain visible.
- `evidenceIds`: IDs of evidence objects that support or explain the assumption.

Forbidden values:
- Empty IDs.
- Tool tiers outside `real`, `partial`, or `demo`.
- Status values outside `active`, `resolved`, `violated`, or `unknown`.
- Unsupported claims such as "wet-lab validated" unless backed by repository evidence.

### Evidence

Plain meaning: a record that explains where a value, assumption, or decision comes from.

Fields:
- `evidenceId`: stable unique identifier.
- `evidenceType`: `literature`, `dataset`, `user-input`, `simulation`, `experiment`, or `manual-review`.
- `title`: short label for the evidence.
- `source`: optional source name, accession, file name, or system name.
- `doi`: optional DOI if one is already known and verified.
- `url`: optional source URL.
- `notes`: optional caveats or context.

Forbidden values:
- Fabricated DOI values.
- Citation-like placeholders presented as real sources.
- Evidence types outside the legal set.

### ProvenanceEntry

Plain meaning: a record of a tool run, human gate, import, export, or review.

Fields:
- `provenanceId`: stable unique identifier for this provenance record.
- `toolId`: tool or protocol actor associated with the record.
- `activityType`: `tool-run`, `human-gate`, `export`, `import`, or `review`.
- `startedAt`: ISO-8601 timestamp for the activity start.
- `completedAt`: optional ISO-8601 timestamp for completion.
- `inputAssumptionIds`: assumptions consumed by the activity.
- `outputAssumptionIds`: assumptions introduced or preserved by the activity.
- `evidenceIds`: evidence records used by the activity.
- `upstreamProvenanceIds`: provenance records this activity depends on.
- `actor`: optional human or system actor.

Forbidden values:
- Non-string timestamps.
- Activity types outside the legal set.
- Hidden upstream provenance when an output depends on prior runs.

### AssumptionViolation

Plain meaning: a detected problem where an assumption is missing, contradicted, or not strong enough for the requested surface.

Fields:
- `violationId`: stable unique identifier.
- `assumptionId`: violated assumption.
- `detectedAt`: ISO-8601 timestamp.
- `severity`: `warning` or `blocking`.
- `message`: human-readable explanation.
- `affectedSurfaces`: list of affected claim surfaces.

Forbidden values:
- Severity outside `warning` or `blocking`.
- Affected surfaces outside the legal `ClaimSurface` values.
- Messages that hide the reason for the violation.

### WorkflowContract

Plain meaning: a rule describing what one tool may pass to another tool or surface.

Fields:
- `contractId`: stable unique identifier.
- `fromToolId`: source tool.
- `toToolId`: optional target tool. If omitted, the contract applies to a surface rather than a specific tool.
- `allowedSurfaces`: claim surfaces this contract can allow.
- `minimumValidityTier`: minimum tier required by the contract.
- `requiresProvenance`: whether provenance must be present.
- `requiresHumanGate`: optional flag requiring human review before use.

Forbidden values:
- Validity tiers outside `real`, `partial`, or `demo`.
- Surfaces outside the legal `ClaimSurface` set.
- Contracts that imply unsupported tier upgrades.

### GateDecision

Plain meaning: the result of evaluating a payload, export, recommendation, protocol, or external handoff against a workflow contract.

Fields:
- `status`: `ok`, `blocked`, `gated`, or `demoOnly`.
- `blockCode`: optional machine-readable code for a block reason.
- `reason`: human-readable explanation.
- `allowedSurfaces`: surfaces still allowed.
- `blockedSurfaces`: surfaces refused by the gate.
- `overridePath`: optional `human-review` or `not-allowed`.

Forbidden values:
- Gate statuses outside the legal set.
- Surfaces outside the legal `ClaimSurface` set.
- Override paths outside `human-review` or `not-allowed`.
- Silent success when blocked surfaces exist.

## JSON Examples

### ok

```json
{
  "status": "ok",
  "reason": "Single-species FBA output has provenance and may remain an internal payload.",
  "allowedSurfaces": ["payload"],
  "blockedSurfaces": []
}
```

### blocked

```json
{
  "status": "blocked",
  "blockCode": "DEMO_TO_PROTOCOL",
  "reason": "Demo-tier thermodynamics cannot be used to generate a protocol-like handoff.",
  "allowedSurfaces": ["payload"],
  "blockedSurfaces": ["protocol", "external-handoff"],
  "overridePath": "not-allowed"
}
```

### gated

```json
{
  "status": "gated",
  "reason": "A recommendation requires human review before export.",
  "allowedSurfaces": ["payload"],
  "blockedSurfaces": ["recommendation", "export"],
  "overridePath": "human-review"
}
```

### demoOnly

```json
{
  "status": "demoOnly",
  "reason": "The output can remain visible inside demo-only workflow contexts but cannot support recommendations.",
  "allowedSurfaces": ["payload"],
  "blockedSurfaces": ["recommendation", "protocol", "external-handoff"]
}
```

## Non-Goals For v0

- No homepage or landing-page changes.
- No scientific algorithm changes.
- No tool validity tier changes.
- No new benchmark claims.
- No wet-lab validation claims.
- No full SBOL or PROV-DM compliance claims.
- No enforcement middleware or route integration.
