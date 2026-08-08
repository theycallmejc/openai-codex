# Architecture

## Current stack

| Area | Current implementation |
|---|---|
| Backend | Python 3, FastAPI, Pydantic |
| Entry point | `backend/src/main.py` via `python -m uvicorn backend.src.main:app` |
| Frontend | Server-served HTML with vanilla JavaScript and CSS (`frontend/`) |
| Database | SQLite; path from `SDLC_DATABASE_PATH`, defaulting to `data/sdlc-framework.db` |
| AI | Explainable deterministic rules; no runtime LLM provider configured |
| Authentication | Starlette session middleware with a local development sign-in endpoint |
| Testing | Pytest, pytest-cov, FastAPI TestClient; GitHub Actions verifies tests, JSON, demo, and dependency audit |

## Repository structure

- `backend/src/main.py` — API, persistence initialisation, state transitions, artifact generation, review, and assistant endpoints.
- `backend/src/orchestration.py` — agent registry, dependencies, and deterministic orchestration execution.
- `backend/src/requirement_intelligence.py` — explainable requirement readiness analysis.
- `backend/tests/` — workflow and evaluation tests.
- `frontend/` — login/workspace HTML and static CSS/JavaScript.
- `evals/` — curated datasets, offline evaluator, CLI, and ignored reports.
- `sample-data/`, `postman/`, and `scripts/` — scenarios, API collection, demo, and packaging helpers.

## Request flow

```text
Browser → frontend HTML/JavaScript → FastAPI route → workflow/persistence logic
        → SQLite artifact revisions and audit records → JSON response → rendered workflow state
```

Requirement intelligence and orchestration use local deterministic functions. They do not call an external AI provider.

## Workflow execution

The persisted path is requirement → analysis → BRD → BRD approval → backlog → backlog approval → tests → traceability → QA handoff. Each artifact is versioned; approvals and audit events are persisted. `automation/run-next` advances only safe steps and stops at human gates. The orchestration layer separately executes Requirement, Risk, and Review agents with dependency checks and persisted run history.

## Known technical debt

- `main.py` intentionally remains a compact modular-monolith file, so route, workflow, and persistence concerns are only partially separated.
- The local login is development-only; session configuration must be hardened for shared deployment.
- AI behaviour is deterministic and rule-based; provider abstraction and live-model failure handling are future work.
- The current risk rules do not satisfy the RBAC and file-upload evaluation cases.
