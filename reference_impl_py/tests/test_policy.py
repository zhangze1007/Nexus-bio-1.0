import unittest

from reference_impl_py.nexus_trust_runtime.policy import evaluate_claim_surface_policy


def make_input(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "toolId": "pathd",
        "surface": "payload",
        "validityTier": "partial",
        "isDraft": False,
        "provenanceIds": ["fixture:provenance"],
        "evidenceIds": ["fixture:evidence"],
        "assumptionIds": [],
        "requiresHumanGate": False,
        "humanGateStatus": "not-required",
    }
    base.update(overrides)
    return base


class PolicyTests(unittest.TestCase):
    def test_missing_policy_blocks(self) -> None:
        decision = evaluate_claim_surface_policy(make_input(toolId="missing-tool"))

        self.assertEqual(decision.status.value, "blocked")
        self.assertEqual(decision.block_code, "MISSING_POLICY")

    def test_demo_protocol_blocks_with_special_code(self) -> None:
        decision = evaluate_claim_surface_policy(
            make_input(
                toolId="cellfree",
                surface="protocol",
                validityTier="demo",
                humanGateStatus="approved",
                requiresHumanGate=True,
            )
        )

        self.assertEqual(decision.status.value, "blocked")
        self.assertEqual(decision.block_code, "DEMO_OUTPUT_PROTOCOL_BLOCKED")

    def test_demo_external_handoff_blocks_with_special_code(self) -> None:
        decision = evaluate_claim_surface_policy(
            make_input(
                toolId="multio",
                surface="external-handoff",
                validityTier="demo",
                humanGateStatus="approved",
                requiresHumanGate=True,
            )
        )

        self.assertEqual(decision.status.value, "blocked")
        self.assertEqual(decision.block_code, "EXTERNAL_HANDOFF_BLOCKED")

    def test_missing_provenance_blocks(self) -> None:
        decision = evaluate_claim_surface_policy(
            make_input(surface="export", provenanceIds=[])
        )

        self.assertEqual(decision.status.value, "blocked")
        self.assertEqual(decision.block_code, "PROVENANCE_REQUIRED")

    def test_pending_human_gate_returns_gated(self) -> None:
        decision = evaluate_claim_surface_policy(
            make_input(
                toolId="dbtlflow",
                surface="protocol",
                requiresHumanGate=True,
                humanGateStatus="pending",
            )
        )

        self.assertEqual(decision.status.value, "gated")
        self.assertEqual(decision.block_code, "HUMAN_GATE_REQUIRED")

    def test_rejected_human_gate_blocks(self) -> None:
        decision = evaluate_claim_surface_policy(
            make_input(
                toolId="dbtlflow",
                surface="protocol",
                requiresHumanGate=True,
                humanGateStatus="rejected",
            )
        )

        self.assertEqual(decision.status.value, "blocked")
        self.assertEqual(decision.block_code, "HUMAN_GATE_REQUIRED")

    def test_valid_partial_export_with_provenance_returns_ok(self) -> None:
        decision = evaluate_claim_surface_policy(make_input(surface="export"))

        self.assertEqual(decision.status.value, "ok")
        self.assertIsNone(decision.block_code)


if __name__ == "__main__":
    unittest.main()
