# SBOL 3.0 Mapping

## Scope

This document maps Nexus-Bio trust-runtime and biological workflow artifacts to SBOL 3.0 concepts. The intended wording is SBOL-aligned or future SBOL-compatible export. This is not a claim of a fully SBOL-compliant export unless a proper SBOL validator is added and passes.

## Mapping Summary

| Nexus-Bio artifact | SBOL-aligned concept | Meaning |
| --- | --- | --- |
| Biological design artifact | SBOL-aligned design object | A construct, sequence-bearing design, pathway design, circuit design, or component candidate. |
| Construct / pathway / protocol-like object | SBOL-aligned artifact | A structured representation that could later map to SBOL components, features, interactions, constraints, or implementation notes. |
| `linkedProvenanceId` | Nexus extension or sidecar reference | A pointer from an SBOL-aligned artifact to a Nexus trust-runtime provenance record. |

## Biological Design Artifact

A Nexus-Bio biological design artifact should be treated as SBOL-aligned when it represents biological structure or design intent in a structured way. Examples include:
- a pathway graph with reactions and enzymes,
- a gene circuit construct,
- a candidate enzyme or protein-design artifact,
- a DBTL handoff object that references a construct or pathway.

Possible SBOL-aligned fields:
- `displayId`: stable artifact ID.
- `name`: human-readable name.
- `description`: concise artifact description and limitations.
- `type`: artifact type such as pathway, construct, circuit, or protocol-like handoff.
- `components`: sequence, enzyme, metabolite, or feature-like children where available.
- `interactions`: reaction, regulation, or transformation-like relationships where available.
- `linkedProvenanceId`: Nexus extension pointing to trust-runtime provenance.

## Construct / Pathway / Protocol-Like Object

Construct, pathway, and protocol-like objects may be serialized as SBOL-aligned artifacts when they preserve structured biological intent. The trust-runtime layer should not imply that a protocol-like object is experimentally validated or lab-ready.

Recommended wording:
- "SBOL-aligned artifact"
- "future SBOL-compatible export"
- "protocol-like handoff"

Forbidden wording unless validated by a proper SBOL validator:
- "fully SBOL-compliant export"
- "validated SBOL package"
- "lab-ready SBOL protocol"

## linkedProvenanceId

`linkedProvenanceId` is a Nexus extension or sidecar reference. It lets an SBOL-aligned artifact point back to the trust-runtime activity that produced it.

This field should reference a `ProvenanceEntry.provenanceId`. It should not replace SBOL-native provenance or annotation mechanisms in a future validator-backed export. Instead, it keeps Nexus trust state attached while the repository remains in an SBOL-aligned stage.

Example shape:

```json
{
  "displayId": "pathway-artemisinin-demo",
  "type": "pathway",
  "name": "Artemisinin pathway context",
  "description": "SBOL-aligned pathway artifact for trust-runtime demonstration, not an experimentally confirmed biological design.",
  "linkedProvenanceId": "provenance:pathd-run:001"
}
```

## Compliance Boundary

This repository should only claim SBOL-aligned behavior or future SBOL-compatible export. It should not claim full SBOL compliance until:
- an SBOL 3.0 serialization target is specified,
- required namespaces and object constraints are implemented,
- generated artifacts pass a proper SBOL validator,
- test coverage checks the validator output.
