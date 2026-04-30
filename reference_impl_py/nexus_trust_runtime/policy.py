"""Claim-surface policy evaluator for the Python reference implementation."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Mapping

from .models import (
    CLAIM_SURFACE_BLOCK_CODES,
    ClaimSurface,
    ClaimSurfacePolicy,
    GateDecision,
    GateOverridePath,
    GateStatus,
    HumanGateStatus,
    ValidityTier,
)


DEFAULT_POLICY_PATH = (
    Path(__file__).resolve().parents[1]
    / "policies"
    / "claim_surface_policies.json"
)


def _is_record(value: object) -> bool:
    return isinstance(value, dict)


def _string_list(value: object, context: str) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ValueError(f"{context} must be a string array")
    return value


def _bool_field(record: Mapping[str, object], field_name: str, context: str) -> bool:
    value = record.get(field_name)
    if not isinstance(value, bool):
        raise ValueError(f"{context}.{field_name} must be a boolean")
    return value


def _string_field(record: Mapping[str, object], field_name: str, context: str) -> str:
    value = record.get(field_name)
    if not isinstance(value, str):
        raise ValueError(f"{context}.{field_name} must be a string")
    return value


def load_claim_surface_policies(
    policy_path: Path = DEFAULT_POLICY_PATH,
) -> dict[tuple[str, ClaimSurface], ClaimSurfacePolicy]:
    """Load the copied claim-surface policy snapshot.

    The JSON snapshot intentionally records surface templates and tool IDs
    instead of importing TypeScript at runtime. This keeps the implementation
    independent while still making drift visible in consistency reports.
    """

    raw = json.loads(policy_path.read_text(encoding="utf-8"))
    if not _is_record(raw):
        raise ValueError("policy snapshot must be an object")

    tool_ids = _string_list(raw.get("toolIds"), "toolIds")
    surface_policies = raw.get("surfacePolicies")
    if not isinstance(surface_policies, dict):
        raise ValueError("surfacePolicies must be an object")

    policies: dict[tuple[str, ClaimSurface], ClaimSurfacePolicy] = {}
    for surface_value, template_value in surface_policies.items():
        if not isinstance(surface_value, str):
            raise ValueError("surface policy keys must be strings")
        surface = ClaimSurface(surface_value)
        if not isinstance(template_value, dict):
            raise ValueError(f"surfacePolicies.{surface_value} must be an object")

        allowed_tiers = tuple(
            ValidityTier(item)
            for item in _string_list(
                template_value.get("allowedTiers"),
                f"surfacePolicies.{surface_value}.allowedTiers",
            )
        )
        block_code = _string_field(
            template_value,
            "blockCode",
            f"surfacePolicies.{surface_value}",
        )
        if block_code not in CLAIM_SURFACE_BLOCK_CODES:
            raise ValueError(f"unknown blockCode in policy snapshot: {block_code}")

        for tool_id in tool_ids:
            policies[(tool_id, surface)] = ClaimSurfacePolicy(
                policy_id=f"claim-surface:{tool_id}:{surface.value}:v1",
                tool_id=tool_id,
                surface=surface,
                allowed_tiers=allowed_tiers,
                requires_provenance=_bool_field(
                    template_value,
                    "requiresProvenance",
                    f"surfacePolicies.{surface_value}",
                ),
                requires_human_gate=_bool_field(
                    template_value,
                    "requiresHumanGate",
                    f"surfacePolicies.{surface_value}",
                ),
                deny_if_draft=_bool_field(
                    template_value,
                    "denyIfDraft",
                    f"surfacePolicies.{surface_value}",
                ),
                block_code=block_code,
                rationale=_string_field(
                    template_value,
                    "rationale",
                    f"surfacePolicies.{surface_value}",
                ),
            )

    return policies


POLICIES_BY_TOOL_AND_SURFACE = load_claim_surface_policies()


def _decision(
    status: GateStatus,
    surface: ClaimSurface,
    reason: str,
    block_code: str | None = None,
    override_path: GateOverridePath | None = None,
) -> GateDecision:
    return GateDecision(
        status=status,
        surface=surface,
        reason=reason,
        block_code=block_code,
        override_path=override_path,
    )


def _list_field(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _has_items(value: object) -> bool:
    return len(_list_field(value)) > 0


def _tier_block_code(validity_tier: ValidityTier, surface: ClaimSurface) -> str:
    if validity_tier == ValidityTier.DEMO and surface == ClaimSurface.PROTOCOL:
        return "DEMO_OUTPUT_PROTOCOL_BLOCKED"
    if validity_tier == ValidityTier.DEMO and surface == ClaimSurface.EXTERNAL_HANDOFF:
        return "EXTERNAL_HANDOFF_BLOCKED"
    return "TIER_NOT_ALLOWED_FOR_SURFACE"


def evaluate_claim_surface_policy(input_case: Mapping[str, object]) -> GateDecision:
    """Evaluate one case using the copied Step 7A policy semantics."""

    tool_id_value = input_case.get("toolId")
    if not isinstance(tool_id_value, str):
        tool_id = "<missing-tool>"
    else:
        tool_id = tool_id_value

    surface_value = input_case.get("surface")
    surface = (
        ClaimSurface(surface_value)
        if isinstance(surface_value, str)
        else ClaimSurface.PAYLOAD
    )

    policy = POLICIES_BY_TOOL_AND_SURFACE.get((tool_id, surface))
    if policy is None:
        return _decision(
            status=GateStatus.BLOCKED,
            surface=surface,
            block_code="MISSING_POLICY",
            reason=f"No claim-surface policy is defined for {tool_id} on {surface.value}.",
            override_path=GateOverridePath.NOT_ALLOWED,
        )

    validity_tier_value = input_case.get("validityTier")
    if not isinstance(validity_tier_value, str) or validity_tier_value == "":
        return _decision(
            status=GateStatus.BLOCKED,
            surface=surface,
            block_code="TIER_NOT_ALLOWED_FOR_SURFACE",
            reason=(
                f"A validity tier is required before {tool_id} output can be "
                f"evaluated for {surface.value}."
            ),
            override_path=GateOverridePath.NOT_ALLOWED,
        )
    validity_tier = ValidityTier(validity_tier_value)

    if input_case.get("isDraft") is True and policy.deny_if_draft is True:
        return _decision(
            status=GateStatus.BLOCKED,
            surface=surface,
            block_code="DRAFT_OUTPUT_NOT_EXPORTABLE",
            reason=(
                f"{tool_id} output is still draft and {surface.value} requires "
                "a finalized artifact."
            ),
            override_path=GateOverridePath.HUMAN_REVIEW,
        )

    if validity_tier not in policy.allowed_tiers:
        block_code = _tier_block_code(validity_tier, surface)
        return _decision(
            status=GateStatus.BLOCKED,
            surface=surface,
            block_code=block_code,
            reason=(
                f"{validity_tier.value} output from {tool_id} is not allowed "
                f"on {surface.value}."
            ),
            override_path=GateOverridePath.NOT_ALLOWED,
        )

    if policy.requires_provenance and not _has_items(input_case.get("provenanceIds")):
        return _decision(
            status=GateStatus.BLOCKED,
            surface=surface,
            block_code="PROVENANCE_REQUIRED",
            reason=(
                f"{surface.value} consumption for {tool_id} requires provenance "
                "before the claim can be used."
            ),
            override_path=GateOverridePath.HUMAN_REVIEW,
        )

    input_requires_human_gate = input_case.get("requiresHumanGate") is True
    human_gate_required = policy.requires_human_gate or input_requires_human_gate
    human_gate_status_value = input_case.get("humanGateStatus")
    if isinstance(human_gate_status_value, str):
        human_gate_status = HumanGateStatus(human_gate_status_value)
    elif human_gate_required:
        human_gate_status = HumanGateStatus.PENDING
    else:
        human_gate_status = HumanGateStatus.NOT_REQUIRED

    if human_gate_required and human_gate_status != HumanGateStatus.APPROVED:
        if human_gate_status == HumanGateStatus.REJECTED:
            return _decision(
                status=GateStatus.BLOCKED,
                surface=surface,
                block_code="HUMAN_GATE_REQUIRED",
                reason=f"Human review rejected {tool_id} output for {surface.value}.",
                override_path=GateOverridePath.NOT_ALLOWED,
            )

        return _decision(
            status=GateStatus.GATED,
            surface=surface,
            block_code="HUMAN_GATE_REQUIRED",
            reason=(
                f"{surface.value} consumption for {tool_id} requires approved "
                "human review."
            ),
            override_path=GateOverridePath.HUMAN_REVIEW,
        )

    if validity_tier == ValidityTier.DEMO:
        return _decision(
            status=GateStatus.DEMO_ONLY,
            surface=surface,
            reason=(
                f"{tool_id} output is allowed on {surface.value} only as demo "
                "or exploratory context."
            ),
        )

    return _decision(
        status=GateStatus.OK,
        surface=surface,
        reason=f"{tool_id} output satisfies the {surface.value} claim-surface policy.",
    )
