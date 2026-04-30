"""Benchmark corpus loading and validation for the Python reference runtime."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping

from .models import (
    EVIDENCE_STATES,
    UNCERTAINTY_STATES,
    BenchmarkCase,
    BenchmarkExpected,
    BenchmarkInput,
    ClaimSurface,
    ExpectedLabel,
    GateStatus,
    HumanGateStatus,
    ValidityTier,
    normalize_block_code,
    require_bool,
    require_string,
    require_string_sequence,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CASE_DIR = REPO_ROOT / "benchmarks" / "trust-runtime-cases"
DEFAULT_LABELS_PATH = REPO_ROOT / "benchmarks" / "expected_labels.csv"


@dataclass(frozen=True)
class BenchmarkBundle:
    cases: tuple[BenchmarkCase, ...]
    labels: tuple[ExpectedLabel, ...]
    case_files: tuple[Path, ...]
    labels_path: Path


def _is_record(value: object) -> bool:
    return isinstance(value, dict)


def _records(value: object, context: str) -> list[Mapping[str, object]]:
    if not isinstance(value, list):
        raise ValueError(f"{context} must be an array")
    records: list[Mapping[str, object]] = []
    for index, item in enumerate(value):
        if not _is_record(item):
            raise ValueError(f"{context}[{index}] must be an object")
        records.append(item)
    return records


def _optional_human_gate_status(
    value: object,
    context: str,
) -> HumanGateStatus | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"{context} must be a string when present")
    return HumanGateStatus(value)


def parse_benchmark_case(record: Mapping[str, object], context: str) -> BenchmarkCase:
    input_value = record.get("input")
    expected_value = record.get("expected")
    if not _is_record(input_value):
        raise ValueError(f"{context}.input must be an object")
    if not _is_record(expected_value):
        raise ValueError(f"{context}.expected must be an object")

    evidence_state = require_string(input_value, "evidenceState", f"{context}.input")
    if evidence_state not in EVIDENCE_STATES:
        raise ValueError(f"{context}.input.evidenceState is not allowed")

    uncertainty_state = require_string(input_value, "uncertaintyState", f"{context}.input")
    if uncertainty_state not in UNCERTAINTY_STATES:
        raise ValueError(f"{context}.input.uncertaintyState is not allowed")

    case_input = BenchmarkInput(
        validity_tier=ValidityTier(
            require_string(input_value, "validityTier", f"{context}.input")
        ),
        has_provenance=require_bool(input_value, "hasProvenance", f"{context}.input"),
        evidence_state=evidence_state,
        uncertainty_state=uncertainty_state,
        is_draft=require_bool(input_value, "isDraft", f"{context}.input"),
        human_gate_required=require_bool(
            input_value,
            "humanGateRequired",
            f"{context}.input",
        ),
        human_gate_satisfied=require_bool(
            input_value,
            "humanGateSatisfied",
            f"{context}.input",
        ),
        human_gate_status=_optional_human_gate_status(
            input_value.get("humanGateStatus"),
            f"{context}.input.humanGateStatus",
        ),
        notes=require_string(input_value, "notes", f"{context}.input"),
    )

    expected = BenchmarkExpected(
        status=GateStatus(require_string(expected_value, "status", f"{context}.expected")),
        block_code=normalize_block_code(expected_value.get("blockCode")),
        rationale=require_string(expected_value, "rationale", f"{context}.expected"),
    )

    return BenchmarkCase(
        case_id=require_string(record, "caseId", context),
        title=require_string(record, "title", context),
        category=require_string(record, "category", context),
        tool_id=require_string(record, "toolId", context),
        surface=ClaimSurface(require_string(record, "surface", context)),
        claim=require_string(record, "claim", context),
        input=case_input,
        expected=expected,
        risk_tags=require_string_sequence(record.get("riskTags"), f"{context}.riskTags"),
        known_bad=require_bool(record, "knownBad", context),
    )


def load_benchmark_cases(case_dir: Path = DEFAULT_CASE_DIR) -> tuple[BenchmarkCase, ...]:
    case_files = sorted(case_dir.glob("*.json"))
    cases: list[BenchmarkCase] = []
    for case_file in case_files:
        parsed = json.loads(case_file.read_text(encoding="utf-8"))
        if not _is_record(parsed):
            raise ValueError(f"{case_file}: root must be an object")
        for index, record in enumerate(_records(parsed.get("cases"), f"{case_file}.cases")):
            cases.append(parse_benchmark_case(record, f"{case_file}.cases[{index}]"))
    return tuple(cases)


def load_case_files(case_dir: Path = DEFAULT_CASE_DIR) -> tuple[Path, ...]:
    return tuple(sorted(case_dir.glob("*.json")))


def load_expected_labels(labels_path: Path = DEFAULT_LABELS_PATH) -> tuple[ExpectedLabel, ...]:
    with labels_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        expected_header = [
            "caseId",
            "expectedStatus",
            "expectedBlockCode",
            "category",
            "toolId",
            "surface",
            "knownBad",
        ]
        if reader.fieldnames != expected_header:
            raise ValueError(
                "expected_labels.csv header must be "
                + ",".join(expected_header)
            )

        labels: list[ExpectedLabel] = []
        for row_number, row in enumerate(reader, start=2):
            known_bad_value = row.get("knownBad")
            if known_bad_value not in {"true", "false"}:
                raise ValueError(f"expected_labels.csv:{row_number}: knownBad invalid")
            labels.append(
                ExpectedLabel(
                    case_id=row["caseId"],
                    expected_status=GateStatus(row["expectedStatus"]),
                    expected_block_code=normalize_block_code(row["expectedBlockCode"]),
                    category=row["category"],
                    tool_id=row["toolId"],
                    surface=ClaimSurface(row["surface"]),
                    known_bad=known_bad_value == "true",
                )
            )
    return tuple(labels)


def _block_for_comparison(value: str | None) -> str:
    return value or ""


def _case_map(cases: Iterable[BenchmarkCase]) -> dict[str, BenchmarkCase]:
    result: dict[str, BenchmarkCase] = {}
    for test_case in cases:
        if test_case.case_id in result:
            raise ValueError(f"duplicate benchmark case: {test_case.case_id}")
        result[test_case.case_id] = test_case
    return result


def _label_map(labels: Iterable[ExpectedLabel]) -> dict[str, ExpectedLabel]:
    result: dict[str, ExpectedLabel] = {}
    for label in labels:
        if label.case_id in result:
            raise ValueError(f"duplicate expected label: {label.case_id}")
        result[label.case_id] = label
    return result


def validate_cases_and_labels(
    cases: tuple[BenchmarkCase, ...],
    labels: tuple[ExpectedLabel, ...],
) -> None:
    cases_by_id = _case_map(cases)
    labels_by_id = _label_map(labels)
    errors: list[str] = []

    for case_id, test_case in cases_by_id.items():
        label = labels_by_id.get(case_id)
        if label is None:
            errors.append(f"{case_id}: missing expected label")
            continue
        if label.expected_status != test_case.expected.status:
            errors.append(f"{case_id}: expectedStatus CSV/JSON mismatch")
        if _block_for_comparison(label.expected_block_code) != _block_for_comparison(
            test_case.expected.block_code
        ):
            errors.append(f"{case_id}: expectedBlockCode CSV/JSON mismatch")
        if label.category != test_case.category:
            errors.append(f"{case_id}: category CSV/JSON mismatch")
        if label.tool_id != test_case.tool_id:
            errors.append(f"{case_id}: toolId CSV/JSON mismatch")
        if label.surface != test_case.surface:
            errors.append(f"{case_id}: surface CSV/JSON mismatch")
        if label.known_bad != test_case.known_bad:
            errors.append(f"{case_id}: knownBad CSV/JSON mismatch")

    for case_id in labels_by_id:
        if case_id not in cases_by_id:
            errors.append(f"{case_id}: expected label has no JSON case")

    if errors:
        raise ValueError("benchmark label validation failed:\n" + "\n".join(errors))


def load_benchmark_bundle(
    case_dir: Path = DEFAULT_CASE_DIR,
    labels_path: Path = DEFAULT_LABELS_PATH,
) -> BenchmarkBundle:
    cases = load_benchmark_cases(case_dir)
    labels = load_expected_labels(labels_path)
    validate_cases_and_labels(cases, labels)
    return BenchmarkBundle(
        cases=cases,
        labels=labels,
        case_files=load_case_files(case_dir),
        labels_path=labels_path,
    )
