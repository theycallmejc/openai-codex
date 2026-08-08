# FlowPilot

FlowPilot is a local SDLC-to-QA workflow application. It turns one requirement into governed artifacts through visible, step-by-step agent handoffs.

## How the workflow works

```text
Requirement → Analysis agent → BRD agent → human approval → Backlog agent
→ human approval → Test agent → Traceability agent → QA handoff agent
```

Every agent reads the persisted artifact from the previous stage. The BRD and backlog require a recorded human decision before the next agent can run. The UI shows the workflow map, current state, input/output handoff, and per-agent run history.

Generation is deterministic by design, so the project works locally without API keys. Model-backed agents are a future extension.

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.src.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000 to sign in, then FlowPilot redirects to the workspace at `/app`.

### Local sign-in

This local MVP includes a development sign-in gate. Use the prefilled demo account:

- Email: `admin@flowpilot.local`
- Password: `flowpilot`

After signing in, choose a scenario from **Load sample**, create the workflow, then run the visible next agent. Use **Run until approval** to continue automatically until a BRD or backlog approval is required. Use the sign-out control in the top bar to return to the login screen.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Service health |
| POST | `/api/auth/login` | Validate the local demo account and return its workspace profile |
| GET | `/api/samples` | Built-in test scenarios |
| GET | `/api/projects` | Workflow library summaries |
| GET | `/api/workspace/overview` | Workspace-level workflow and agent-run metrics |
| POST | `/api/projects` | Create a workflow |
| POST | `/api/projects/{id}/requirements` | Save the input requirement |
| POST | `/api/projects/{id}/analysis/generate` | Run Analysis agent |
| POST | `/api/projects/{id}/brd/generate` | Run BRD agent |
| POST | `/api/projects/{id}/brd/approve` or `/brd/reject` | Record BRD review |
| POST | `/api/projects/{id}/backlog/generate` | Run Backlog agent |
| POST | `/api/projects/{id}/backlog/approve` or `/backlog/reject` | Record Backlog review |
| POST | `/api/projects/{id}/tests/generate` | Run Test agent |
| POST | `/api/projects/{id}/traceability/generate` | Run Traceability agent |
| POST | `/api/projects/{id}/qa-handoff/generate` | Run QA handoff agent |
| POST | `/api/projects/{id}/automation/run-next` | Run the next safe agent; stops at approval gates |
| GET | `/api/projects/{id}` | Workflow state, artifacts, audit records, and agent-run history |

## Test data and verification

Copy-ready scenarios are in `sample-data/sample-requirements.json` and are available from the UI.

```powershell
python -m pytest backend\tests --cov=backend.src --cov-fail-under=70 -q
python scripts\demo.py
```

Interactive API documentation is available at http://127.0.0.1:8000/docs.

The demo emits machine-readable evidence of the complete staged workflow, including agent-run input/output handoffs.

## Current boundaries

- Local single-user application with a development-only browser sign-in gate
- Deterministic artifact generation; no runtime LLM provider is configured
- Login is not production authentication: workflow APIs are not yet protected by server-side session middleware
- No external connectors or deployed scheduler yet
