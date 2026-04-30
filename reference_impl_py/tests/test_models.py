import unittest

from reference_impl_py.nexus_trust_runtime.models import (
    ClaimSurface,
    GateDecision,
    GateOverridePath,
    GateStatus,
    HumanGateStatus,
    ValidityTier,
    normalize_block_code,
)


class ModelTests(unittest.TestCase):
    def test_protocol_enum_values(self) -> None:
        self.assertEqual(ValidityTier.REAL.value, "real")
        self.assertEqual(ValidityTier.PARTIAL.value, "partial")
        self.assertEqual(ValidityTier.DEMO.value, "demo")
        self.assertEqual(ClaimSurface.EXTERNAL_HANDOFF.value, "external-handoff")
        self.assertEqual(GateStatus.DEMO_ONLY.value, "demoOnly")
        self.assertEqual(HumanGateStatus.APPROVED.value, "approved")

    def test_gate_decision_shape_matches_protocol_names(self) -> None:
        decision = GateDecision(
            status=GateStatus.BLOCKED,
            surface=ClaimSurface.EXPORT,
            reason="Needs provenance.",
            block_code="PROVENANCE_REQUIRED",
            override_path=GateOverridePath.HUMAN_REVIEW,
        )

        self.assertEqual(
            decision.to_dict(),
            {
                "status": "blocked",
                "reason": "Needs provenance.",
                "allowedSurfaces": [],
                "blockedSurfaces": ["export"],
                "blockCode": "PROVENANCE_REQUIRED",
                "overridePath": "human-review",
            },
        )

    def test_block_code_normalization(self) -> None:
        self.assertIsNone(normalize_block_code(""))
        self.assertIsNone(normalize_block_code(None))
        self.assertEqual(
            normalize_block_code("TIER_NOT_ALLOWED_FOR_SURFACE"),
            "TIER_NOT_ALLOWED_FOR_SURFACE",
        )
        with self.assertRaises(ValueError):
            normalize_block_code("NOT_A_BLOCK_CODE")


if __name__ == "__main__":
    unittest.main()
