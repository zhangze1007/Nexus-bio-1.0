import json
import tempfile
import unittest
from pathlib import Path

from reference_impl_py.nexus_trust_runtime.benchmark import (
    DEFAULT_LABELS_PATH,
    REPO_ROOT,
    BenchmarkBundle,
    load_benchmark_bundle,
)
from reference_impl_py.nexus_trust_runtime.consistency import (
    build_consistency_report,
    evaluate_python_decisions,
)
from reference_impl_py.nexus_trust_runtime.models import (
    BenchmarkCase,
    BenchmarkExpected,
    BenchmarkInput,
    ClaimSurface,
    ExpectedLabel,
    GateStatus,
    ValidityTier,
)


class ConsistencyTests(unittest.TestCase):
    def test_real_corpus_agreement_fields_are_computed(self) -> None:
        bundle = load_benchmark_bundle()
        report = build_consistency_report(bundle=bundle, generated_at="2026-04-30T00:00:00Z")

        self.assertEqual(report["totalCases"], 74)
        self.assertIn("pythonVsExpectedAgreementRate", report)
        self.assertIn("pythonVsTypescriptAgreementRate", report)
        self.assertIn("mismatches", report)

    def test_decision_rows_include_expected_and_python_statuses(self) -> None:
        rows = evaluate_python_decisions(load_benchmark_bundle())

        self.assertEqual(len(rows), 74)
        self.assertIn("expectedStatus", rows[0])
        self.assertIn("pythonStatus", rows[0])

    def test_mismatch_fixture_is_reported_not_hidden(self) -> None:
        fixture_case = BenchmarkCase(
            case_id="PY-MISMATCH",
            title="Mismatch fixture",
            category="fixture",
            tool_id="pathd",
            surface=ClaimSurface.EXPORT,
            claim="Fixture claim.",
            input=BenchmarkInput(
                validity_tier=ValidityTier.PARTIAL,
                has_provenance=False,
                evidence_state="present",
                uncertainty_state="bounded",
                is_draft=False,
                human_gate_required=False,
                human_gate_satisfied=False,
                notes="Expected label intentionally disagrees with policy.",
            ),
            expected=BenchmarkExpected(
                status=GateStatus.OK,
                block_code=None,
                rationale="Fixture expected label.",
            ),
            risk_tags=("fixture",),
            known_bad=False,
        )
        fixture_label = ExpectedLabel(
            case_id="PY-MISMATCH",
            expected_status=GateStatus.OK,
            expected_block_code=None,
            category="fixture",
            tool_id="pathd",
            surface=ClaimSurface.EXPORT,
            known_bad=False,
        )
        bundle = BenchmarkBundle(
            cases=(fixture_case,),
            labels=(fixture_label,),
            case_files=(REPO_ROOT / "benchmarks" / "trust-runtime-cases" / "p0-step-6-cases.json",),
            labels_path=DEFAULT_LABELS_PATH,
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            raw_path = Path(tmpdir) / "raw-results.json"
            raw_path.write_text(
                json.dumps(
                    [
                        {
                            "caseId": "PY-MISMATCH",
                            "mode": "runtime-gating",
                            "actualStatus": "blocked",
                            "actualBlockCode": "PROVENANCE_REQUIRED",
                        }
                    ]
                ),
                encoding="utf-8",
            )
            report = build_consistency_report(
                bundle=bundle,
                generated_at="2026-04-30T00:00:00Z",
                typescript_raw_results_path=raw_path,
            )

        self.assertEqual(report["pythonVsExpectedAgreementRate"], 0.0)
        self.assertEqual(report["pythonVsTypescriptAgreementRate"], 1.0)
        self.assertEqual(report["mismatchCount"], 1)
        mismatches = report["mismatches"]
        self.assertIsInstance(mismatches, list)
        self.assertIn("python-vs-expected", mismatches[0]["mismatchType"])


if __name__ == "__main__":
    unittest.main()
