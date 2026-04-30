"""CLI for the Python trust-runtime reference implementation."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from .benchmark import REPO_ROOT, load_benchmark_bundle
from .consistency import (
    DEFAULT_CONSISTENCY_JSON_PATH,
    DEFAULT_CONSISTENCY_MD_PATH,
    DEFAULT_DECISIONS_PATH,
    build_consistency_report,
    evaluate_python_decisions,
    write_consistency_report,
    write_json,
)


PROOF_REPORT_JSON = REPO_ROOT / "proof-package" / "reports" / "second-implementation-consistency.json"
PROOF_REPORT_MD = REPO_ROOT / "proof-package" / "reports" / "second-implementation-consistency.md"


def _copy_if_proof_package_exists() -> None:
    proof_reports_dir = REPO_ROOT / "proof-package" / "reports"
    if not proof_reports_dir.exists():
        return
    proof_reports_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(DEFAULT_CONSISTENCY_JSON_PATH, PROOF_REPORT_JSON)
    shutil.copyfile(DEFAULT_CONSISTENCY_MD_PATH, PROOF_REPORT_MD)


def validate_command() -> int:
    bundle = load_benchmark_bundle()
    print(
        "python reference benchmark validation passed: "
        f"{len(bundle.cases)} cases, {len(bundle.labels)} expected labels"
    )
    return 0


def run_command() -> int:
    bundle = load_benchmark_bundle()
    decisions = evaluate_python_decisions(bundle)
    write_json(DEFAULT_DECISIONS_PATH, decisions)
    print(
        "python reference decisions written: "
        f"{DEFAULT_DECISIONS_PATH.relative_to(REPO_ROOT)}"
    )
    print(f"evaluated cases: {len(decisions)}")
    return 0


def compare_command() -> int:
    bundle = load_benchmark_bundle()
    report = build_consistency_report(bundle=bundle)
    write_consistency_report(report)
    _copy_if_proof_package_exists()
    print(
        "second implementation consistency report written: "
        f"{DEFAULT_CONSISTENCY_JSON_PATH.relative_to(REPO_ROOT)}"
    )
    print(
        "second implementation markdown report written: "
        f"{DEFAULT_CONSISTENCY_MD_PATH.relative_to(REPO_ROOT)}"
    )
    print(
        "summary: "
        f"totalCases={report['totalCases']} "
        f"pythonVsExpectedAgreementRate={report['pythonVsExpectedAgreementRate']} "
        f"pythonVsTypescriptAgreementRate={report['pythonVsTypescriptAgreementRate']} "
        f"mismatchCount={report['mismatchCount']}"
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the Nexus-Bio Python trust-runtime reference implementation.",
    )
    parser.add_argument(
        "command",
        choices=["validate", "run", "compare"],
        help="Reference implementation command to run.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    command = args.command
    if command == "validate":
        return validate_command()
    if command == "run":
        return run_command()
    if command == "compare":
        return compare_command()
    parser.error(f"unsupported command: {command}")
    return 2
