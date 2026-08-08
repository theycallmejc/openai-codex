"""Metrics and offline execution harness for FlowPilot's production generators.

The checks in this module are deliberately deterministic.  They score schemas,
links, categories, duplication, and explicit review findings instead of trying
to infer whether an answer "feels" good.  A future model judge can be added as
a separately labelled evaluator; it must not change these baseline metrics.
"""
from __future__ import annotations

import json
import shutil
import tempfile
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RESULTS_DIR = ROOT / "evals" / "results"


def load_suite(name: str = "core") -> dict[str, Any]:
    path = ROOT / "evals" / "datasets" / f"{name}.json"
    if not path.exists():
        raise ValueError(f"Evaluation suite '{name}' was not found.")
    return json.loads(path.read_text(encoding="utf-8"))


def _api_workflow(case: dict[str, Any], database: Path) -> dict[str, Any]:
    """Exercise the actual API and artifact generators against an isolated DB."""
    from fastapi.testclient import TestClient
    from backend.src import main

    original_db = main.DB_PATH
    main.DB_PATH = database
    try:
        main.init_db()
        with TestClient(main.app) as client:
            assert client.post("/api/auth/login", json={"email": "admin@flowpilot.local", "password": "flowpilot"}).status_code == 200
            project = client.post("/api/projects", json={"name": f"Evaluation: {case['title']}", "description": "Offline evaluation fixture"}).json()["data"]["public_id"]
            calls = [
                (f"/api/projects/{project}/requirements", {"raw_requirement": case["requirement"]}),
                (f"/api/projects/{project}/analysis/generate", {}),
                (f"/api/projects/{project}/brd/generate", {}),
                (f"/api/projects/{project}/brd/approve", {"reviewer": "Evaluation harness"}),
                (f"/api/projects/{project}/backlog/generate", {}),
                (f"/api/projects/{project}/backlog/approve", {"reviewer": "Evaluation harness"}),
                (f"/api/projects/{project}/tests/generate", {}),
                (f"/api/projects/{project}/traceability/generate", {}),
                (f"/api/projects/{project}/review/run", {}),
            ]
            for endpoint, payload in calls:
                response = client.post(endpoint, json=payload)
                if response.status_code >= 300:
                    raise RuntimeError(f"{case['id']}: {endpoint} returned {response.status_code}: {response.text}")
            orchestration = client.post(f"/api/projects/{project}/orchestration/run-all", json={})
            if orchestration.status_code >= 300:
                raise RuntimeError(f"{case['id']}: orchestration failed: {orchestration.text}")
            return client.get(f"/api/projects/{project}").json()["data"]
    finally:
        main.DB_PATH = original_db


def _check(condition: bool, name: str, detail: str) -> dict[str, Any]:
    return {"name": name, "passed": condition, "detail": detail}


def score_case(case: dict[str, Any], project: dict[str, Any]) -> dict[str, Any]:
    artifacts = project["artifacts"]
    analysis, backlog, tests, traceability, review = (artifacts.get(key) or {} for key in ("analysis", "backlog", "tests", "traceability", "ai_review"))
    stories = backlog.get("stories", [])
    criteria = [criterion for story in stories for criterion in story.get("acceptance_criteria", [])]
    test_cases = tests.get("test_cases", [])
    criterion_ids = {criterion.get("id") for criterion in criteria}
    linked_ids = [case.get("source_acceptance_criterion") or case.get("criterion_id") for case in test_cases]
    categories = [str(case.get("category") or case.get("type", "")).lower() for case in test_cases]
    duplicate_keys = Counter((case.get("source_acceptance_criterion") or case.get("criterion_id"), str(case.get("category") or case.get("type", "")).lower(), str(case.get("expected_result", "")).strip().lower()) for case in test_cases)
    combined = json.dumps({"analysis": analysis, "backlog": backlog, "tests": tests, "traceability": traceability}).lower()
    expected = case["expected"]
    concepts = expected.get("concepts", [])
    concept_hits = [concept for concept in concepts if concept.lower() in combined]
    findings = review.get("findings", [])
    expected_risk_terms = expected.get("risk_terms", [])
    requirement_results = [run.get("result") or {} for run in project.get("orchestration_runs", []) if run.get("agent") == "requirement"]
    risks = [risk.get("risk", "").lower() for run in project.get("orchestration_runs", []) if run.get("agent") == "risk" for risk in (run.get("result") or {}).get("risks", [])]

    checks = [
        _check(any(result.get("dimensions") and result.get("overall") for result in requirement_results), "requirement_intelligence_schema", "Requirement Agent returns dimensions and an overall readiness state."),
        _check(bool(analysis.get("functional_requirements")), "requirement_analysis_schema", "Analysis contains structured functional requirements."),
        _check(bool(criteria) and all(item.get("id") and item.get("then") for item in criteria), "acceptance_criteria_schema", "Every generated acceptance criterion has an ID and observable then field."),
        _check(bool(test_cases) and all(all(item.get(field) for field in ("id", "title", "preconditions", "steps", "expected_result", "criterion_id", "generated_by")) for item in test_cases), "qa_schema", "Every QA scenario has the required product fields."),
        _check(all(link and link in criterion_ids for link in linked_ids), "traceability_links", "Every test references a current acceptance criterion."),
        _check(not any(count > 1 for count in duplicate_keys.values()), "duplicate_scenarios", "No duplicate criterion/category/expected-result scenario exists."),
        _check(all(len(str(item.get("expected_result", "")).strip()) > 12 and str(item.get("expected_result", "")).lower() not in {"works correctly", "system works correctly", "success"} for item in test_cases), "specific_expected_results", "Expected results are concrete enough for deterministic review."),
        _check(sum(category == "negative" for category in categories) >= expected.get("minimum_negative_tests", 1), "negative_coverage", "The suite includes the required negative-path coverage."),
        _check(traceability.get("valid") is True and not traceability.get("gaps") and not traceability.get("unlinked_test_cases"), "traceability_artifact", "Traceability reports no orphan or uncovered links."),
        _check(len(concept_hits) == len(concepts), "expected_concepts", f"Covered {len(concept_hits)}/{len(concepts)} domain characteristics."),
        _check(not expected_risk_terms or all(any(term.lower() in risk for risk in risks) for term in expected_risk_terms), "risk_detection", "Expected domain risk signals were identified by the Risk Agent."),
    ]
    if expected.get("security_sensitive"):
        checks.append(_check(any(finding.get("id") == "security-sensitive-tests" for finding in findings), "security_coverage_review", "The Review Agent explicitly flags missing security-sensitive coverage when no security test exists."))
    covered = len({link for link in linked_ids if link in criterion_ids})
    metrics = {
        "structure_score": round(sum(check["passed"] for check in checks[:4]) / 4, 3),
        "completeness_score": round(len(concept_hits) / len(concepts), 3) if concepts else 1.0,
        "traceability_coverage": round(covered / len(criterion_ids), 3) if criterion_ids else 0.0,
        "duplicate_count": sum(count - 1 for count in duplicate_keys.values() if count > 1),
        "negative_test_count": sum(category == "negative" for category in categories),
        "security_review_finding": any(finding.get("id") == "security-sensitive-tests" for finding in findings),
        "test_count": len(test_cases),
        "acceptance_criteria_count": len(criteria),
    }
    failures = [check for check in checks if not check["passed"]]
    return {"case_id": case["id"], "title": case["title"], "passed": not failures, "metrics": metrics, "checks": checks, "failures": failures}


def compare_runs(current: dict[str, Any], baseline: dict[str, Any] | None) -> dict[str, list[dict[str, Any]]]:
    if not baseline:
        return {"improvements": [], "regressions": [], "unchanged": []}
    prior = {item["case_id"]: item for item in baseline.get("cases", [])}
    improvements, regressions, unchanged = [], [], []
    for item in current["cases"]:
        old = prior.get(item["case_id"])
        if not old:
            continue
        if item["passed"] and not old["passed"]:
            improvements.append({"case_id": item["case_id"], "detail": "Case now passes."})
        elif old["passed"] and not item["passed"]:
            regressions.append({"case_id": item["case_id"], "detail": "Case no longer passes."})
        else:
            changed = []
            for metric in ("structure_score", "completeness_score", "traceability_coverage", "duplicate_count", "negative_test_count"):
                if old["metrics"].get(metric) != item["metrics"].get(metric):
                    changed.append(metric)
            (unchanged if not changed else improvements).append({"case_id": item["case_id"], "detail": "No measured change." if not changed else f"Metric change: {', '.join(changed)}."})
    return {"improvements": improvements, "regressions": regressions, "unchanged": unchanged}


def run_suite(name: str = "core", prompt_version: str = "deterministic-v1", model: str = "deterministic-rules", baseline_path: Path | None = None) -> dict[str, Any]:
    suite = load_suite(name)
    started = time.perf_counter()
    run_id = f"eval-{uuid.uuid4()}"
    workspace = Path(tempfile.mkdtemp(prefix="flowpilot-eval-"))
    try:
        results = []
        for case in suite["cases"]:
            case_started = time.perf_counter()
            project = _api_workflow(case, workspace / f"{case['id']}.db")
            result = score_case(case, project)
            result["latency_ms"] = round((time.perf_counter() - case_started) * 1000, 2)
            results.append(result)
    finally:
        shutil.rmtree(workspace, ignore_errors=True)
    baseline = json.loads(baseline_path.read_text(encoding="utf-8")) if baseline_path else None
    report = {
        "run_id": run_id,
        "suite": name,
        "suite_version": suite["version"],
        "prompt_version": prompt_version,
        "model": model,
        "agent": "production-workflow",
        "evaluator": "deterministic-v1",
        "model_based_evaluation": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        "token_usage": None,
        "passed": all(result["passed"] for result in results),
        "cases": results,
    }
    report["summary"] = {"passed": sum(item["passed"] for item in results), "failed": sum(not item["passed"] for item in results), "total": len(results), "coverage_gaps": sum(len(item["failures"]) for item in results)}
    report["comparison"] = compare_runs(report, baseline)
    return report


def save_report(report: dict[str, Any], output: Path | None = None) -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    path = output or RESULTS_DIR / f"{report['run_id']}.json"
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return path
