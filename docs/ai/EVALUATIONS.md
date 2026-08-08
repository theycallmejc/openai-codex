# AI Evaluations

## Principle

Do not claim that AI quality improved without measurable evidence. Use deterministic checks first; keep any future model-based evaluator separate from the generation model and label it explicitly.

## Current implementation

`evals/` runs the production API workflow against isolated temporary SQLite databases. The curated `core` suite covers password reset, checkout, registration, refund, RBAC, file upload, subscription cancellation, and payment retry.

```powershell
python -m evals.run --suite core
python -m evals.run --suite core --baseline evals/results/<prior-report>.json
```

Reports record run ID, suite and prompt version, model label, evaluator/agent, timestamp, latency, token usage when available, per-case checks, metrics, failures, and comparison results. Reports are local ignored artifacts. `--live` is intentionally unavailable until an explicit live-model adapter exists; normal unit tests make no external calls.

## Deterministic metrics

- **Structure:** required requirement, acceptance-criterion, and QA fields exist.
- **Completeness:** expected characteristics in each curated case are represented.
- **Traceability:** generated tests reference a valid acceptance criterion; the traceability artifact has no gaps or orphan tests.
- **Duplication:** criterion/category/expected-result duplicates are counted.
- **Specificity:** expected results cannot be empty or vague boilerplate.
- **Negative coverage:** required negative scenarios exist.
- **Security coverage:** security-sensitive cases are reviewed for explicit security testing.
- **Risk detection:** expected risk signals appear in Risk Agent output.

## Current baseline

The current baseline has known failures for RBAC and file-upload risk detection. Treat these as measurable backlog items, not silently accepted output quality.

## Future evaluation work

Add datasets and thresholds only with product justification. A future live-model integration may record token usage and use a separately labelled model judge for qualitative criteria, but must retain deterministic baseline checks and never run from normal unit tests.
