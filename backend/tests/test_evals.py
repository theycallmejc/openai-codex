from pathlib import Path

from evals.framework import compare_runs, load_suite, run_suite


def test_core_evaluation_uses_curated_cases():
    suite = load_suite()
    assert {case["id"] for case in suite["cases"]} == {"password-reset", "checkout", "user-registration", "refund", "rbac", "file-upload", "subscription-cancellation", "payment-retry"}


def test_evaluation_runs_production_workflow_without_live_api(tmp_path: Path):
    report = run_suite()
    assert report["model_based_evaluation"] is False
    assert report["token_usage"] is None
    assert report["summary"]["total"] == 8
    assert all("latency_ms" in item and "traceability_coverage" in item["metrics"] for item in report["cases"])


def test_evaluation_comparison_detects_regression():
    current = {"cases": [{"case_id": "case", "passed": False, "metrics": {"structure_score": 0, "completeness_score": 0, "traceability_coverage": 0, "duplicate_count": 1, "negative_test_count": 0}}]}
    baseline = {"cases": [{"case_id": "case", "passed": True, "metrics": {"structure_score": 1, "completeness_score": 1, "traceability_coverage": 1, "duplicate_count": 0, "negative_test_count": 1}}]}
    comparison = compare_runs(current, baseline)
    assert comparison["regressions"] == [{"case_id": "case", "detail": "Case no longer passes."}]
