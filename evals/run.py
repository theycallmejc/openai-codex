"""Run FlowPilot's offline generation evaluation suites.

Example: python -m evals.run --suite core
Live execution is intentionally opt-in and is not available until a live model
adapter is configured; normal unit tests never call an external API.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from evals.framework import run_suite, save_report


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate FlowPilot generation quality with deterministic checks.")
    parser.add_argument("--suite", default="core")
    parser.add_argument("--prompt-version", default="deterministic-v1")
    parser.add_argument("--model", default="deterministic-rules")
    parser.add_argument("--baseline", type=Path, help="Prior saved evaluation report for regression comparison.")
    parser.add_argument("--output", type=Path, help="Where to store the JSON report.")
    parser.add_argument("--live", action="store_true", help="Reserved opt-in integration mode; requires a configured live model adapter.")
    args = parser.parse_args()
    if args.live:
        parser.error("No live model adapter is configured. Add one explicitly before using --live; offline evaluation remains deterministic.")
    report = run_suite(args.suite, args.prompt_version, args.model, args.baseline)
    path = save_report(report, args.output)
    summary = report["summary"]
    print(f"{report['run_id']}: {'PASS' if report['passed'] else 'FAIL'} | {summary['passed']}/{summary['total']} cases | {summary['coverage_gaps']} failed checks | {report['latency_ms']} ms")
    print(f"Report: {path}")
    if report["comparison"]["regressions"]:
        print("Regressions: " + ", ".join(item["case_id"] for item in report["comparison"]["regressions"]))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
