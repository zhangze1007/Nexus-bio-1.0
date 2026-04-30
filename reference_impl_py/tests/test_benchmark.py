import unittest

from reference_impl_py.nexus_trust_runtime.benchmark import (
    load_benchmark_bundle,
    validate_cases_and_labels,
)
from reference_impl_py.nexus_trust_runtime.policy import evaluate_claim_surface_policy


class BenchmarkTests(unittest.TestCase):
    def test_loader_loads_cases_and_expected_labels(self) -> None:
        bundle = load_benchmark_bundle()

        self.assertEqual(len(bundle.cases), 74)
        self.assertEqual(len(bundle.labels), 74)
        self.assertEqual(bundle.cases[0].case_id, "TRB-001")

    def test_loader_validates_case_label_alignment(self) -> None:
        bundle = load_benchmark_bundle()

        validate_cases_and_labels(bundle.cases, bundle.labels)

    def test_evaluator_input_matches_benchmark_human_gate_mapping(self) -> None:
        bundle = load_benchmark_bundle()
        reviewed_protocol = next(case for case in bundle.cases if case.case_id == "TRB-005")
        decision = evaluate_claim_surface_policy(reviewed_protocol.evaluator_input())

        self.assertEqual(decision.status.value, "ok")
        self.assertIsNone(decision.block_code)


if __name__ == "__main__":
    unittest.main()
