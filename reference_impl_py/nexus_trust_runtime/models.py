"""Core protocol objects for the Python trust-runtime reference implementation.

The reference implementation intentionally models only the trust-runtime
contract: validity tiers, claim surfaces, gate decisions, policies, and
benchmark case metadata. Scientific tool payloads remain opaque mappings.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Mapping, Sequence


class StrEnum(str, Enum):
    """Small stdlib-compatible string enum helper."""

    def __str__(self) -> str:
        return self.value


class ValidityTier(StrEnum):
    REAL = "real"
    PARTIAL = "partial"
    DEMO = "demo"


class ClaimSurface(StrEnum):
    PAYLOAD = "payload"
    EXPORT = "export"
    RECOMMENDATION = "recommendation"
    PROTOCOL = "protocol"
    EXTERNAL_HANDOFF = "external-handoff"


class GateStatus(StrEnum):
    OK = "ok"
    BLOCKED = "blocked"
    GATED = "gated"
    DEMO_ONLY = "demoOnly"


class GateOverridePath(StrEnum):
    HUMAN_REVIEW = "human-review"
    NOT_ALLOWED = "not-allowed"


class HumanGateStatus(StrEnum):
    NOT_REQUIRED = "not-required"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


CLAIM_SURFACE_BLOCK_CODES = {
    "MISSING_POLICY",
    "TIER_NOT_ALLOWED_FOR_SURFACE",
    "PROVENANCE_REQUIRED",
    "HUMAN_GATE_REQUIRED",
    "DRAFT_OUTPUT_NOT_EXPORTABLE",
    "DEMO_OUTPUT_PROTOCOL_BLOCKED",
    "EXTERNAL_HANDOFF_BLOCKED",
}

EVIDENCE_STATES = {"present", "missing", "not-required"}
UNCERTAINTY_STATES = {"bounded", "unresolved", "not-applicable"}


def parse_enum(enum_type: type[StrEnum], value: object, field_name: str) -> StrEnum:
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string")
    try:
        return enum_type(value)
    except ValueError as exc:
        allowed = ", ".join(item.value for item in enum_type)
        raise ValueError(f"{field_name} must be one of: {allowed}") from exc


def normalize_block_code(value: object) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ValueError("blockCode must be a string or null")
    if value not in CLAIM_SURFACE_BLOCK_CODES:
        raise ValueError(f"blockCode is not recognized: {value}")
    return value


@dataclass(frozen=True)
class GateDecision:
    status: GateStatus
    surface: ClaimSurface
    reason: str
    block_code: str | None = None
    override_path: GateOverridePath | None = None

    @property
    def allowed_surfaces(self) -> list[str]:
        if self.status in {GateStatus.OK, GateStatus.DEMO_ONLY}:
            return [self.surface.value]
        return []

    @property
    def blocked_surfaces(self) -> list[str]:
        if self.status in {GateStatus.OK, GateStatus.DEMO_ONLY}:
            return []
        return [self.surface.value]

    def to_dict(self) -> dict[str, object]:
        result: dict[str, object] = {
            "status": self.status.value,
            "reason": self.reason,
            "allowedSurfaces": self.allowed_surfaces,
            "blockedSurfaces": self.blocked_surfaces,
        }
        if self.block_code is not None:
            result["blockCode"] = self.block_code
        if self.override_path is not None:
            result["overridePath"] = self.override_path.value
        return result


@dataclass(frozen=True)
class ClaimSurfacePolicy:
    policy_id: str
    tool_id: str
    surface: ClaimSurface
    allowed_tiers: tuple[ValidityTier, ...]
    requires_provenance: bool
    block_code: str
    rationale: str
    requires_human_gate: bool = False
    deny_if_draft: bool = False


@dataclass(frozen=True)
class Evidence:
    evidence_id: str
    source_kind: str
    summary: str


@dataclass(frozen=True)
class ProvenanceEntry:
    provenance_id: str
    source: str
    activity: str


@dataclass(frozen=True)
class BenchmarkInput:
    validity_tier: ValidityTier
    has_provenance: bool
    evidence_state: str
    uncertainty_state: str
    is_draft: bool
    human_gate_required: bool
    human_gate_satisfied: bool
    notes: str
    human_gate_status: HumanGateStatus | None = None


@dataclass(frozen=True)
class BenchmarkExpected:
    status: GateStatus
    block_code: str | None
    rationale: str


@dataclass(frozen=True)
class BenchmarkCase:
    case_id: str
    title: str
    category: str
    tool_id: str
    surface: ClaimSurface
    claim: str
    input: BenchmarkInput
    expected: BenchmarkExpected
    risk_tags: tuple[str, ...]
    known_bad: bool

    def evaluator_input(self) -> dict[str, object]:
        human_status = self.input.human_gate_status
        if human_status is None:
            if not self.input.human_gate_required:
                human_status = HumanGateStatus.NOT_REQUIRED
            elif self.input.human_gate_satisfied:
                human_status = HumanGateStatus.APPROVED
            else:
                human_status = HumanGateStatus.PENDING

        return {
            "toolId": self.tool_id,
            "surface": self.surface.value,
            "validityTier": self.input.validity_tier.value,
            "isDraft": self.input.is_draft,
            "provenanceIds": (
                [f"{self.case_id}:provenance"] if self.input.has_provenance else []
            ),
            "evidenceIds": (
                [f"{self.case_id}:evidence"]
                if self.input.evidence_state == "present"
                else []
            ),
            "assumptionIds": list(self.risk_tags),
            "requiresHumanGate": self.input.human_gate_required,
            "humanGateStatus": human_status.value,
        }


@dataclass(frozen=True)
class ExpectedLabel:
    case_id: str
    expected_status: GateStatus
    expected_block_code: str | None
    category: str
    tool_id: str
    surface: ClaimSurface
    known_bad: bool


def require_string(record: Mapping[str, object], field_name: str, context: str) -> str:
    value = record.get(field_name)
    if not isinstance(value, str):
        raise ValueError(f"{context}.{field_name} must be a string")
    return value


def require_bool(record: Mapping[str, object], field_name: str, context: str) -> bool:
    value = record.get(field_name)
    if not isinstance(value, bool):
        raise ValueError(f"{context}.{field_name} must be a boolean")
    return value


def require_string_sequence(value: object, context: str) -> tuple[str, ...]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        raise ValueError(f"{context} must be a string array")
    result: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise ValueError(f"{context} must be a string array")
        result.append(item)
    return tuple(result)
