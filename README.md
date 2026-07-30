# SDLC Agentic Framework

A locally runnable, deterministic MVP that converts one synthetic feature
requirement into approved, structured, and traceable QA artifacts.

```text
Raw requirement
  -> Structured requirement
  -> BRD
  -> Human BRD approval
  -> User stories and acceptance criteria
  -> Human backlog approval
  -> Positive, negative, and boundary test cases
  -> Traceability matrix
  -> QA handoff
```

No runtime LLM or external service is used. Generated artifacts are created by
versioned Python rules and templates, labelled as deterministic, validated
before persistence, and blocked by mandatory human approval gates.

## Problem statement

Feature delivery repeatedly hands the same context between requirement
analysis, documentation, planning, development, and QA. Manual handoffs lead to
inconsistent artifacts, lost decisions, incomplete QA packages, weak
requirement-to-test traceability, rework, and slower delivery.

## Business value

This MVP demonstrates a governed way to carry one requirement through analysis
and QA preparation while retaining its lineage. It reduces repetitive
documentation, makes approval responsibility explicit, exposes assumptions and
risks early, and gives QA a complete package whose tests can be traced back to
the approved source.

## MVP scope

Implemented:

- Requirement normalization and structured analysis
- Traceable BRD generation and approval/rejection
- Backlog and Given/When/Then acceptance-criteria generation
- Backlog approval/rejection
- Positive, negative, and boundary test-case generation
- Requirement-to-test traceability and gap detection
- Risk-aware QA handoff with approval evidence
- Stable public identifiers, SQLite persistence, and audit events
- Standard API envelopes and structured error responses
- Responsive local workflow UI with styled artifact views

Explicitly out of scope:

- Runtime LLMs and external knowledge retrieval
- Sprint execution, code generation, and automated test execution
- GitHub, Jira, CI/CD, deployment, and release automation
- Authentication, enterprise knowledge graphs, and production scaling

## Features

- End-to-end human-gated artifact workflow
- Stable project and artifact identifiers
- Deterministic, repeatable generation with rules-version disclosure
- Auditable approvals and mandatory rejection reasons
- Duplicate and invalid-transition protection
- Positive, negative, and boundary test design
- Orphan and untested-criterion detection
- Interactive eleven-agent roadmap graph with honest capability states
- Responsive artifact review UI and standard API response envelopes
- Synthetic sample data and a 23-request Postman collection

## Technology stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Python 3.11+; verified on 3.14.0 | Approved local Windows runtime |
| API | FastAPI 0.140.13 and Uvicorn 0.51.0 | Typed local HTTP API and OpenAPI |
| Validation | Pydantic 2.13.4 | Input and generated-artifact contracts |
| Persistence | Python SQLite | Transactional local storage with no service dependency |
| UI | Jinja2 3.1.6, HTML, CSS, vanilla JavaScript | No frontend build or Node runtime required |
| Testing | Pytest 9.1.1, HTTPX 0.28.1, pytest-cov 7.1.0 | Deterministic API and domain verification |

## Agent network

The UI presents all eleven official roles while distinguishing implemented
capabilities from the broader target vision.

The workflow sidebar lists every role, and the agent graph supports selectable
nodes, keyboard-accessible detail cards, status filters, and live
Current/Complete markers based on the persisted project workflow state. The
responsive graph supports touch swiping, a visible scrollbar, keyboard arrows,
scroll snapping, previous/next controls, and live position feedback.

| # | Agent | Stage | MVP status |
|---:|---|---|---|
| 01 | Requirement Intake Agent | Requirements | Active |
| 02 | Knowledge Retrieval Agent | Requirements | Planned |
| 03 | BRD Generation Agent | Requirements | Active |
| 04 | Backlog Decomposition Agent | Planning | Active |
| 05 | Sprint Planning Agent | Planning | Planned |
| 06 | Solution & Code Generation Agent | Engineering | Planned |
| 07 | Git Operations Agent | Engineering | Planned |
| 08 | Code Review Agent | Engineering | Planned |
| 09 | Sanity Testing Agent | QA | Partial: test design only |
| 10 | QA Handoff Agent | QA | Active |
| 11 | Knowledge Graph Agent | Knowledge | Planned |

Workflow orchestration, traceability validation, and approval/audit handling
are supporting controls rather than additional product-facing agents.

## Project structure

```text
.
|-- backend/
|   |-- requirements.txt
|   |-- src/
|   |   |-- agents/
|   |   |-- api/
|   |   |-- models/
|   |   |-- orchestrator/
|   |   |-- repositories/
|   |   |-- services/
|   |   |-- validators/
|   |   `-- main.py
|   `-- tests/
|-- frontend/
|   |-- index.html
|   `-- static/
|-- postman/collection.json
|-- sample-data/sample-requirements.json
|-- ARCHITECTURE.md
|-- FIELD-MAPPING.md
|-- PLAN.md
|-- PROMPTS.md
|-- SECURITY.md
|-- Dockerfile
`-- docker-compose.yml
```

## Prerequisites

- Windows PowerShell
- Python 3.11 or newer
- Internet access for the initial dependency installation

Verified locally with Python 3.14.0 and pip 26.1.2. Node.js is needed only for
the optional JavaScript syntax check. Docker is optional and was not available
in the verified local environment.

## Quick start

Run these commands from the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.src.main:app --host 127.0.0.1 --port 8000
```

Open:

- Workflow UI: `http://127.0.0.1:8000/`
- Health check: `http://127.0.0.1:8000/health`
- OpenAPI documentation: `http://127.0.0.1:8000/api/docs`

The frontend is served by FastAPI and has no separate start command.

Direct execution from `backend\src` is also supported:

```powershell
cd backend\src
..\..\.venv\Scripts\python.exe main.py
```

## Configuration

All settings are optional environment variables with safe local defaults.

| Variable | Default | Purpose |
|---|---|---|
| `SDLC_APP_NAME` | `SDLC Agentic Framework` | Display and API title |
| `SDLC_APP_VERSION` | `0.2.0` | Display, API, and asset-cache version |
| `SDLC_ENVIRONMENT` | `development` | Environment label |
| `SDLC_HOST` | `127.0.0.1` | Bind address |
| `SDLC_PORT` | `8000` | Bind port |
| `SDLC_DATABASE_PATH` | `data/sdlc-framework.db` | SQLite database path |

Do not configure the service on a non-loopback interface without adding
authentication, authorization, CSRF protection, rate limiting, and an
appropriate deployment review.

## API inventory

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Compatibility health check |
| `GET` | `/api/health` | API health check |
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects/{projectId}` | Read project and workflow state |
| `POST` | `/api/projects/{projectId}/requirements` | Submit a raw requirement |
| `POST` | `/api/projects/{projectId}/analyse` | Generate structured analysis |
| `POST` | `/api/projects/{projectId}/brd/generate` | Generate or revise the BRD |
| `POST` | `/api/projects/{projectId}/brd/approve` | Approve the BRD |
| `POST` | `/api/projects/{projectId}/brd/reject` | Reject the BRD with a reason |
| `POST` | `/api/projects/{projectId}/backlog/generate` | Generate or revise backlog |
| `POST` | `/api/projects/{projectId}/backlog/approve` | Approve the backlog |
| `POST` | `/api/projects/{projectId}/backlog/reject` | Reject backlog with a reason |
| `POST` | `/api/projects/{projectId}/tests/generate` | Generate tests and QA package |
| `GET` | `/api/projects/{projectId}/traceability` | Read the traceability matrix |
| `GET` | `/api/projects/{projectId}/qa-handoff` | Read the QA handoff |

All API responses use a consistent success/error envelope and include a
request correlation ID.

## Example API requests and responses

Create a project:

```powershell
$body = @{
  name = "Saved Shopping Lists"
  description = "Synthetic retail feature for the demonstration."
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/projects" `
  -ContentType "application/json" `
  -Body $body
```

Representative `201 Created` response, abridged only to keep this README
readable:

```json
{
  "success": true,
  "data": {
    "public_id": "PRJ-001",
    "name": "Saved Shopping Lists",
    "status": "ACTIVE",
    "workflow_state": "DRAFT",
    "allowed_actions": ["submit_requirement"]
  },
  "meta": {
    "request_id": "generated-correlation-id",
    "timestamp": "2026-07-29T00:00:00Z"
  }
}
```

Submit the raw requirement:

```powershell
$requirement = @{
  raw_requirement = "Customers need named shopping lists for repeat purchases. The system must reject an empty list name."
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/projects/PRJ-001/requirements" `
  -ContentType "application/json" `
  -Body $requirement
```

An invalid workflow action returns a structured conflict:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Action 'generate_backlog' is not allowed while the workflow is in BRD_GENERATED.",
    "details": {
      "current_state": "BRD_GENERATED",
      "allowed_actions": ["approve_brd", "reject_brd"]
    }
  },
  "meta": {
    "request_id": "generated-correlation-id",
    "timestamp": "2026-07-29T00:00:00Z"
  }
}
```

The complete executable sequence is available in
[`postman/collection.json`](postman/collection.json).

## Demonstration

1. Create the prefilled synthetic project and requirement.
2. Run structured analysis.
3. Generate and review `BRD-001`.
4. Approve the BRD gate.
5. Generate and review stories and Given/When/Then criteria.
6. Approve the backlog gate.
7. Generate the positive, negative, and boundary tests.
8. Show 100% traceability and `QAH-001`.

For guardrails, request backlog generation before BRD approval, submit a
duplicate requirement, or reject a BRD with a reason. The server returns a
structured conflict or records an auditable rejection without producing
unauthorized downstream artifacts.

## Tests and quality checks

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -q
.\.venv\Scripts\python.exe -m pytest backend\tests --cov=backend.src --cov-report=term-missing --cov-report=html:htmlcov --cov-report=json:coverage.json --cov-fail-under=70 -q
.\.venv\Scripts\python.exe -m pip check
node --check frontend\static\app.js
```

Current verified baseline: 29 passing tests, 0 failures, and 97.11% line
coverage. The suite covers workflow gates, rejection and duplicate paths,
stable identifiers, traceability gaps, generated test types, safe rendering,
malformed and oversized inputs, repository failures, and responsible-generation
disclosures.

The Postman collection includes the complete happy path and required guardrail
scenarios.

## Assumptions

- Each MVP project contains one active raw requirement.
- Submitted text is synthetic English-language feature content.
- Human reviewer names and roles are demo attribution, not authenticated
  identities.
- Deterministic templates are acceptable when no approved runtime LLM is
  available.
- The supported environment is a trusted, single-user Windows laptop bound to
  loopback.

## Limitations

- No authentication, RBAC, CSRF protection, rate limiting, or multi-user
  concurrency design
- No manual artifact editor; rejection leads to deterministic regeneration
- No automated execution of generated test cases
- No external knowledge source, runtime LLM, Git, Jira, CI/CD, or deployment
- SQLite is unencrypted, and audit events are not tamper-proof
- Docker and interactive browser automation were not available for final local
  execution

## Future enhancements

- Authenticated reviewers, role-based approvals, CSRF protection, and rate
  limiting
- Multiple requirements per project and manual artifact editing
- Approved enterprise knowledge retrieval with authorization and provenance
- Sandboxed code generation, code review, and sanity-test execution
- Idempotency keys, concurrency controls, and tamper-evident audit storage
- Accessible browser automation and responsive visual regression testing
- Optional GitHub, Jira, and CI/CD integrations only after separate approval

## Persistence and reset

SQLite data is stored at `data/sdlc-framework.db` by default. Public artifact
IDs are stable and project-scoped; regeneration increments revisions without
changing the BRD, story, acceptance-criterion, or test-case ID.

To start from a clean demo state:

1. Stop the application.
2. Move or delete only `data\sdlc-framework.db`.
3. Restart the application; the schema is recreated automatically.

Never remove the entire `data` directory if it contains files you need.

## Security and data use

Use synthetic data only. Do not enter credentials, personal data, client
information, proprietary requirements, financial records, or production data.
See [SECURITY.md](SECURITY.md) for implemented controls and remaining risks.

## Optional Docker reference

The verified runtime is local Python. If Docker is available, the checked-in
files can be evaluated with:

```powershell
docker compose config
docker compose up --build
```

The container port is published only on `127.0.0.1`. `.dockerignore` prevents
local environments, databases, reports, archives, and secrets from entering
the build context.

## Submission packaging

Created a source-only ZIP and exclude:

- `.venv` and every `venv` directory
- `__pycache__`, `.pytest_cache`, and other caches
- `data`, databases, logs, coverage reports, and generated output
- `node_modules`, build output, binaries, and existing archives

Inspect the ZIP before submission and confirm it remains below 150 MB. Do not
include the existing `backend.zip` inside the final archive.

## Additional documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): boundaries, state machine, and persistence
- [FIELD-MAPPING.md](FIELD-MAPPING.md): artifact lineage and traceability
- [SECURITY.md](SECURITY.md): security and responsible-AI controls
- [PLAN.md](PLAN.md): delivery and verification status
- [PROMPTS.md](PROMPTS.md): prompt and decision audit trail
