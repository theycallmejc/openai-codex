# Automated SDLC-to-QA MVP

A local deterministic FastAPI application that turns one synthetic feature requirement into a BRD, backlog, acceptance criteria, positive/negative/boundary tests, traceability report, and QA handoff—without runtime LLMs or external services.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.src.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/`. Requirement submission captures a revision; BRD and backlog generation require recorded reviewer approvals before downstream generation.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Deterministic service health |
| POST | `/api/projects` | Create a project |
| POST | `/api/projects/{projectId}/requirements` | Submit a requirement revision |
| POST | `/api/projects/{projectId}/brd/generate`, `/brd/approve`, `/brd/reject` | Govern BRD generation and review |
| POST | `/api/projects/{projectId}/backlog/generate`, `/backlog/approve`, `/backlog/reject` | Govern backlog generation and review |
| POST | `/api/projects/{projectId}/tests/generate` | Generate tests after backlog approval |
| POST | `/api/projects/{projectId}/workflow/run` | Demo helper; stops at mandatory approval gates |
| GET | `/api/projects/{projectId}` | Project, artifacts, and system audit events |
| GET | `/api/projects/{projectId}/traceability` | Traceability result |
| GET | `/api/projects/{projectId}/qa-handoff` | QA handoff |

Successful responses use `{ success, data, request_id }`; failures use `{ success: false, error, request_id }`.

## Automation

```powershell
python -m pytest backend\tests --cov=backend.src --cov-fail-under=70 -q
python scripts\demo.py
powershell -ExecutionPolicy Bypass -File scripts\package.ps1
```

GitHub Actions runs dependency validation, tests/coverage, JSON validation, an isolated demo, and a dependency audit. The package task produces a source-only archive excluding databases, caches, virtual environments, and generated output.

## Boundaries

Synthetic data only. This local single-user MVP intentionally excludes authentication, external integrations, deployment automation, and runtime LLM generation.
