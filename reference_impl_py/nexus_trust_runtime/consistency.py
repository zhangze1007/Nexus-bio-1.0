"""Consistency comparison for the Python trust-runtime implementation."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Mapping

from .benchmark import BenchmarkBundle, load_benchmark_bundle
from .models import BenchmarkCase, ExpectedLabel
from .policy import evaluate_claim_surface_policy


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TYPESCRIPT_RAW_RESULTS_PATH = (
    REPO_ROOT / "reports" / "public-benchmark" / "raw-results.json"
)
DEFAULT_DECISIONS_PATH = REPO_ROOT / "reports" / "second-implementation-decisions.json"
DEFAULT_CONSISTENCY_JSON_PATH = (
    REPO_ROOT / "reports" / "second-implementation-consistency.json"
)
DEFAULT_CONSISTENCY_MD_PATH = (
    REPO_ROOT / "reports" / "second-implementation-consistency.md"
)

LIMITATIONS = [
    "This is a local second implementation, not independent third-party validation.",
    "The Python policy table is a copied local snapshot and is not automatically synced from TypeScript.",
    "The report checks trust-runtime protocol decisions, not scientific model correctness.",
    "No wet-lab validation, external validation, regulatory approval, or safety certification is claimed.",
]

NON_CLAIMS = [
    "No independent third-party validation is claimed.",
    "No external validation is claimed.",
    "No scientific validation is claimed.",
    "No wet-lab validation is claimed.",
    "No external adoption is claimed.",
]


def _iso_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _block_for_comparison(value: object) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _round_rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(numerator / denominator, 4)


def _display_path(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def _label_map(labels: tuple[ExpectedLabel, ...]) -> dict[str, ExpectedLabel]:
    return {label.case_id: label for label in labels}


def evaluate_python_decisions(bundle: BenchmarkBundle) -> list[dict[str, object]]:
    labels_by_id = _label_map(bundle.labels)
    rows: list[dict[str, object]] = []

    for test_case in bundle.cases:
        label = labels_by_id[test_case.case_id]
        decision = evaluate_claim_surface_policy(test_case.evaluator_input())
        row: dict[str, object] = {
            "caseId": test_case.case_id,
            "category": test_case.category,
            "toolId": test_case.tool_id,
            "surface": test_case.surface.value,
            "knownBad": test_case.known_bad,
            "expectedStatus": label.expected_status.value,
            "pythonStatus": decision.status.value,
            "reason": decision.reason,
        }
        if label.expected_block_code is not None:
            row["expectedBlockCode"] = label.expected_block_code
        if decision.block_code is not None:
            row["pythonBlockCode"] = decision.block_code
        rows.append(row)

    return rows


def load_typescript_runtime_results(
    raw_results_path: Path = DEFAULT_TYPESCRIPT_RAW_RESULTS_PATH,
) -> dict[str, Mapping[str, object]]:
    if not raw_results_path.exists():
        return {}
    parsed = json.loads(raw_results_path.read_text(encoding="utf-8"))
    if not isinstance(parsed, list):
        raise ValueError(f"{raw_results_path}: expected raw results array")
    result: dict[str, Mapping[str, object]] = {}
    for row in parsed:
        if not isinstance(row, dict):
            continue
        if row.get("mode") != "runtime-gating":
            continue
        case_id = row.get("caseId")
        if isinstance(case_id, str):
            result[case_id] = row
    return result


def _mismatch_type(
    expected_status: str,
    expected_block_code: str,
    python_status: str,
    python_block_code: str,
    typescript_row: Mapping[str, object] | None,
) -> tuple[list[str], str | None, str | None]:
    mismatch_kinds: list[str] = []
    if expected_status != python_status:
        mismatch_kinds.append("python-vs-expected-status")
    if expected_block_code != python_block_code:
        mismatch_kinds.append("python-vs-expected-blockCode")

    typescript_status: str | None = None
    typescript_block_code: str | None = None
    if typescript_row is not None:
        actual_status = typescript_row.get("actualStatus")
        typescript_status = actual_status if isinstance(actual_status, str) else None
        typescript_block_code = _block_for_comparison(
            typescript_row.get("actualBlockCode")
        )
        if typescript_status != python_status:
            mismatch_kinds.append("python-vs-typescript-status")
        if typescript_block_code != python_block_code:
            mismatch_kinds.append("python-vs-typescript-blockCode")
    else:
        mismatch_kinds.append("typescript-runtime-result-missing")

    return mismatch_kinds, typescript_status, typescript_block_code


def _mismatch_row(
    test_case: BenchmarkCase,
    expected_status: str,
    expected_block_code: str,
    python_status: str,
    python_block_code: str,
    mismatch_kinds: list[str],
    typescript_status: str | None,
    typescript_block_code: str | None,
) -> dict[str, object]:
    row: dict[str, object] = {
        "caseId": test_case.case_id,
        "category": test_case.category,
        "toolId": test_case.tool_id,
        "surface": test_case.surface.value,
        "mismatchType": ",".join(mismatch_kinds),
        "expectedStatus": expected_status,
        "pythonStatus": python_status,
    }
    if expected_block_code:
        row["expectedBlockCode"] = expected_block_code
    if python_block_code:
        row["pythonBlockCode"] = python_block_code
    if typescript_status is not None:
        row["typescriptStatus"] = typescript_status
    if typescript_block_code:
        row["typescriptBlockCode"] = typescript_block_code
    return row


def build_consistency_report(
    bundle: BenchmarkBundle | None = None,
    generated_at: str | None = None,
    typescript_raw_results_path: Path = DEFAULT_TYPESCRIPT_RAW_RESULTS_PATH,
) -> dict[str, object]:
    if bundle is None:
        bundle = load_benchmark_bundle()

    labels_by_id = _label_map(bundle.labels)
    typescript_by_id = load_typescript_runtime_results(typescript_raw_results_path)

    python_expected_matches = 0
    python_typescript_matches = 0
    typescript_compared = 0
    mismatches: list[dict[str, object]] = []

    for test_case in bundle.cases:
        label = labels_by_id[test_case.case_id]
        decision = evaluate_claim_surface_policy(test_case.evaluator_input())
        expected_status = label.expected_status.value
        expected_block_code = _block_for_comparison(label.expected_block_code)
        python_status = decision.status.value
        python_block_code = _block_for_comparison(decision.block_code)
        typescript_row = typescript_by_id.get(test_case.case_id)

        if expected_status == python_status and expected_block_code == python_block_code:
            python_expected_matches += 1

        mismatch_kinds, typescript_status, typescript_block_code = _mismatch_type(
            expected_status,
            expected_block_code,
            python_status,
            python_block_code,
            typescript_row,
        )

        if typescript_row is not None:
            typescript_compared += 1
            if typescript_status == python_status and typescript_block_code == python_block_code:
                python_typescript_matches += 1

        if mismatch_kinds:
            mismatches.append(
                _mismatch_row(
                    test_case,
                    expected_status,
                    expected_block_code,
                    python_status,
                    python_block_code,
                    mismatch_kinds,
                    typescript_status,
                    typescript_block_code,
                )
            )

    total_cases = len(bundle.cases)
    return {
        "schemaVersion": "second-implementation-consistency-v1",
        "generatedAt": generated_at or _iso_now(),
        "runLabel": "local-dev",
        "referenceImplementation": "python-stdlib",
        "policySnapshot": "reference_impl_py/policies/claim_surface_policies.json",
        "benchmarkCorpus": [
            _display_path(path) for path in bundle.case_files
        ],
        "expectedLabelsPath": _display_path(bundle.labels_path),
        "typescriptRuntimeResultsPath": _display_path(typescript_raw_results_path),
        "totalCases": total_cases,
        "typescriptRuntimeRowsFound": len(typescript_by_id),
        "pythonVsExpectedMatchingCases": python_expected_matches,
        "pythonVsExpectedAgreementRate": _round_rate(
            python_expected_matches,
            total_cases,
        ),
        "pythonVsTypescriptComparedCases": typescript_compared,
        "pythonVsTypescriptMatchingCases": python_typescript_matches,
        "pythonVsTypescriptAgreementRate": (
            _round_rate(python_typescript_matches, typescript_compared)
            if typescript_compared > 0
            else None
        ),
        "mismatchCount": len(mismatches),
        "mismatches": mismatches,
        "limitations": LIMITATIONS,
        "nonClaims": NON_CLAIMS,
    }


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(value, indent=2)}\n", encoding="utf-8")


def markdown_report(report: Mapping[str, object]) -> str:
    mismatch_count = report.get("mismatchCount")
    mismatches = report.get("mismatches")
    lines = [
        "# Second Implementation Consistency Report",
        "",
        "This local-dev report compares the Python stdlib reference implementation against the curated expected labels and, when available, the TypeScript runtime-gating results.",
        "",
        "## Summary",
        "",
        f"- Reference implementation: `{report.get('referenceImplementation')}`",
        f"- Total cases: `{report.get('totalCases')}`",
        f"- Python vs expected agreement: `{report.get('pythonVsExpectedAgreementRate')}`",
        f"- Python vs TypeScript agreement: `{report.get('pythonVsTypescriptAgreementRate')}`",
        f"- Mismatch count: `{mismatch_count}`",
        "",
        "## What Was Compared",
        "",
        "- Core trust-runtime protocol objects: validity tier, claim surface, gate status, gate decision, and policy.",
        "- Existing benchmark cases under `benchmarks/trust-runtime-cases/`.",
        "- Expected labels from `benchmarks/expected_labels.csv`.",
        "- TypeScript runtime-gating rows from `reports/public-benchmark/raw-results.json` when present.",
        "",
        "## Mismatches",
        "",
    ]

    if isinstance(mismatches, list) and len(mismatches) > 0:
        lines.append("| Case | Type | Expected | Python | TypeScript |")
        lines.append("|---|---|---|---|---|")
        for mismatch in mismatches:
            if not isinstance(mismatch, dict):
                continue
            expected = mismatch.get("expectedStatus")
            if mismatch.get("expectedBlockCode"):
                expected = f"{expected}/{mismatch.get('expectedBlockCode')}"
            python_actual = mismatch.get("pythonStatus")
            if mismatch.get("pythonBlockCode"):
                python_actual = f"{python_actual}/{mismatch.get('pythonBlockCode')}"
            typescript_actual = mismatch.get("typescriptStatus", "<missing>")
            if mismatch.get("typescriptBlockCode"):
                typescript_actual = f"{typescript_actual}/{mismatch.get('typescriptBlockCode')}"
            lines.append(
                "| "
                + " | ".join(
                    [
                        str(mismatch.get("caseId")),
                        str(mismatch.get("mismatchType")),
                        str(expected),
                        str(python_actual),
                        str(typescript_actual),
                    ]
                )
                + " |"
            )
    else:
        lines.append("No mismatches were recorded for this local run.")

    lines.extend(
        [
            "",
            "## Limitations",
            "",
        ]
    )
    for limitation in report.get("limitations", []):
        lines.append(f"- {limitation}")

    lines.extend(["", "## Non-Claims", ""])
    for non_claim in report.get("nonClaims", []):
        lines.append(f"- {non_claim}")

    return "\n".join(lines) + "\n"


def write_consistency_report(
    report: Mapping[str, object],
    json_path: Path = DEFAULT_CONSISTENCY_JSON_PATH,
    markdown_path: Path = DEFAULT_CONSISTENCY_MD_PATH,
) -> None:
    write_json(json_path, report)
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(markdown_report(report), encoding="utf-8")
