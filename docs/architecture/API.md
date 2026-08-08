# API

All API responses use the FlowPilot success/error envelope. Protected workspace and project routes require the local session. Invalid state transitions return structured HTTP 409 responses; validation failures return FastAPI validation errors or route-specific errors.

## Session and application

| Method | Path | Purpose | Input / response |
|---|---|---|---|
| GET | `/api/health` | Health and deterministic mode | Health metadata |
| POST | `/api/auth/login` | Local development sign-in | Email/password → local user profile |
| POST | `/api/auth/logout` | Clear current session | Sign-out confirmation |
| GET | `/api/samples` | Built-in requirement samples | Sample list |
| POST | `/api/requirement-intelligence` | Analyze raw requirement readiness | `raw_requirement` → dimensions, questions, proposal |
| POST | `/api/assistant` | General assistant guidance | Message/conversation ID → persisted reply |

## Workspaces and dashboards

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/workspaces` | List or create workspaces |
| POST | `/api/workspaces/{workspace_id}/update` | Update workspace name/owner |
| POST | `/api/workspaces/{workspace_id}/delete` | Delete an eligible workspace |
| GET | `/api/workspace/overview` | Workflow and agent-run summary |
| GET | `/api/dashboard` | Dashboard data |
| GET | `/api/reviews` | Review inbox |

## Workflow and artifacts

| Method | Path | Purpose |
|---|---|---|
| POST / GET | `/api/projects` | Create a workflow or list workflow summaries |
| GET | `/api/projects/{project_id}` | Project state, artifacts, revisions, runs, comments, and audit history |
| POST | `/api/projects/{project_id}/requirements` | Persist raw requirement |
| POST | `/api/projects/{project_id}/analysis/generate` | Generate analysis artifact |
| POST | `/api/projects/{project_id}/brd/generate` | Generate BRD; then requires review |
| POST | `/api/projects/{project_id}/brd/approve` or `/brd/reject` | Record BRD decision (`reviewer`, rejection `reason`) |
| POST | `/api/projects/{project_id}/backlog/generate` | Generate stories and acceptance criteria |
| POST | `/api/projects/{project_id}/backlog/approve` or `/backlog/reject` | Record backlog decision |
| POST | `/api/projects/{project_id}/tests/generate` | Generate QA scenarios |
| POST | `/api/projects/{project_id}/traceability/generate` | Generate requirement-to-test relationships |
| GET | `/api/projects/{project_id}/traceability` | Read traceability artifact |
| POST / GET | `/api/projects/{project_id}/qa-handoff/generate`, `/qa-handoff` | Generate or read QA handoff |
| POST | `/api/projects/{project_id}/workflow/run` | Compatibility single-step workflow helper |
| POST | `/api/projects/{project_id}/automation/run-next` | Advance the next safe workflow step |
| POST | `/api/projects/{project_id}/retry` | Recover a failed workflow at the saved requirement boundary |

## Review, agents, and copilot

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/projects/{project_id}/review-assignment` | Assign BRD/backlog reviewer |
| POST | `/api/projects/{project_id}/review/run` | Run deterministic generated-output review |
| POST | `/api/projects/{project_id}/review/remediate` | Apply a supported targeted remediation |
| POST | `/api/projects/{project_id}/comments` | Add artifact review comment |
| GET | `/api/projects/{project_id}/orchestration/plan` | Read agent plan and registry |
| GET | `/api/projects/{project_id}/orchestration/runs` | Read persisted agent runs |
| POST | `/api/projects/{project_id}/orchestration/run-all` | Execute dependency-ready agents |
| POST | `/api/projects/{project_id}/orchestration/{agent}/run` | Execute one registered agent |
| POST | `/api/projects/{project_id}/orchestration/{agent}/feedback` | Record agent feedback |
| POST | `/api/projects/{project_id}/assistant` | Project-scoped assistant reply |
| GET / DELETE | `/api/projects/{project_id}/assistant/conversations...` | Read or clear project-scoped conversations |

Use `/docs` on a running local server for the generated FastAPI schema and exact request models.
