# Prompt and Decision Log

This file records hackathon instructions, decisions, human approvals, and
verified outcomes. It contains no credentials or non-synthetic business data.

## Chronological prompt summary

| Prompt or refinement | Purpose | Human review/correction | Accepted result |
|---|---|---|---|
| Prompt 1 | Define the smallest complete architecture and specification | No explicit corrections; progression to Phase 2 accepted the direction | Deterministic vertical MVP, two gates, stable IDs, traceability |
| Prompt 2 | Create a runnable foundation | User explicitly authorized dependency installation | Local FastAPI/Jinja2 shell, health, envelopes, tests, documentation |
| Prompt 3 | Implement the core workflow | User reported direct-start import failure and requested broader agent visibility | Complete gated workflow; direct execution fixed; honest eleven-role catalog |
| Prompt 4 | Prove quality, security, and responsible generation | Test gaps, logging disclosure, Postman syntax, and vulnerable local pip were corrected | 29 tests, 97.11 percent coverage, clean local dependency audit |
| Agent-map refinements | Represent every official role | User repeatedly identified missing/unclear workflow roles | Eleven-node interactive graph with Active, Partial, and Planned states |
| Repository audit | Align code, structure, README, and packaging | Stale phase labels, placeholder text, and Docker leakage risk were corrected | Consistent source and source-only packaging rules |
| Responsive graph fix | Make every graph node reachable | User reported that later agents could not be scrolled into view | Correct internal overflow, controls, touch/keyboard scrolling, cache busting |
| Prompt 5 | Produce final submission documentation and evidence | Current final audit | Complete documentation, verified demo, and inspected source ZIP |

## Evidence of human review and non-blind acceptance

- The original official vision was deliberately reduced to one complete
  vertical MVP; code generation, Git, Jira, CI/CD, deployment, and knowledge
  graphs were rejected as hackathon scope.
- Planned agents were not marked Active merely to satisfy the visual request.
  The UI retains six Planned roles and one Partial role.
- A user-reported `ModuleNotFoundError` was reproduced and fixed rather than
  documented away.
- The first live negative-path harness used the wrong response field and
  produced 404s. The harness, not the application, was corrected and rerun.
- A malformed Postman edit was detected by JSON parsing and fixed before
  handoff.
- Phase 4 found that positive-only tests did not meet the requested test
  strategy; QA rules and validators were upgraded to require positive,
  negative, and boundary coverage.
- Generic exception logging was judged too revealing even though HTTP responses
  were sanitized; logging was corrected and regression-tested.
- The first eleven-agent graph was not accepted as complete after the user
  found it unscrollable. Its overflow architecture was diagnosed and replaced
  with accessible controls and responsive behavior.
- Docker remains labelled optional and unverified because Docker is not
  installed. Interactive browser testing is also reported as unavailable.
- Deterministic templates are never described as LLM output.

## Accepted and rejected suggestions

Accepted:

- Local modular monolith with FastAPI, Jinja2, SQLite, and deterministic agents
- Two mandatory server-side approval gates
- Stable IDs, revisions, audit evidence, and traceability enforcement
- Responsive eleven-agent roadmap visualization with honest statuses
- Source-only ZIP and strict generated-file exclusions

Rejected or deferred:

- Cloud infrastructure, AWS, Terraform, and paid/unapproved APIs
- Runtime LLM dependency
- GitHub, Jira, CI/CD, deployment, and release automation
- Pretending roadmap agents execute in the MVP
- Real enterprise knowledge retrieval or knowledge graph
- Authentication and production scaling within the time-boxed MVP

## Prompt 1 — Analysis and specification

### User prompt

Plan the Cognizant Codex hackathon project **SDLC Agentic Framework — End-to-End
New Feature Development Automation**, Theme B application development.

Define one complete vertical MVP:

```text
Raw feature requirement
→ Requirement analysis
→ BRD generation
→ Human approval
→ User-story generation
→ Acceptance-criteria generation
→ Human approval
→ Test-case generation
→ Traceability matrix
→ QA handoff
```

The specification was required to cover the problem and value, users,
confirmed requirements, assumptions, ambiguities, exclusions, six specialized
agent contracts, approval gates, workflow states, entity model, stable IDs,
minimum APIs and UI, Given/When/Then acceptance criteria, failure paths,
responsible-AI and security controls, local stack, architecture, delivery
phases, demo scenarios, risks, and MUST/SHOULD/DROP classification.

Constraints included local Windows execution, synthetic data, no AWS or
Terraform, no paid or unapproved APIs, no hardcoded credentials, a source ZIP
below 150 MB, explicit assumptions, mandatory approval gates, complete
traceability, and honest deterministic fallback when no runtime LLM exists.
The user instructed that no files, code, installation, or implementation be
performed in Phase 1.

### Outcome

The resulting Phase 1 handoff selected:

- Python, FastAPI, Pydantic, Uvicorn, Jinja2, vanilla JavaScript/CSS, SQLite,
  Pytest, and HTTPX.
- A deterministic six-agent pipeline.
- Five UI screens and a compact JSON API.
- Two mandatory, immutable approval decisions.
- Project-scoped stable public IDs and artifact revisions.
- An explicit workflow state machine, idempotency, audit history, atomic stage
  commits, traceability validation, and responsible-AI disclosure.
- Code generation, integrations, cloud services, enterprise authentication,
  containers, and runtime LLMs as out of scope.

### Human corrections and decision

No explicit Phase 1 corrections were supplied. The subsequent instruction to
proceed with Phase 2 is recorded as approval of the Phase 1 direction.

## Prompt 2 — Project scaffolding and executable foundation

### User prompt

Proceed with Phase 2 by inspecting the directory and available Python, Node,
package-manager, and Docker tools; create the requested root, backend,
frontend, Postman, and sample-data structure; implement only a health endpoint,
central configuration, standard response envelope, central error handling, and
basic project-model placeholder; add frontend navigation placeholders; create
approximately twenty synthetic feature requirements; write preliminary
README, architecture, plan, security, field-mapping, and prompt documents; add
health/envelope tests; start the application; verify health; run all tests; and
fix scaffolding failures.

The user explicitly prohibited BRD, backlog, test generation, and complete
orchestrator implementation. The health endpoint and tests must pass before
Phase 3.

### Follow-up authorization

The required Python packages were absent. The user replied: “Install the
dependencies and proceed with the phase2 implementation.”

### Result

Phase 2 was implemented in `C:\codex`, which was confirmed empty and not a Git
repository before scaffolding.

Observed environment:

- Python 3.14.0
- pip 25.2
- Node.js 25.9.0
- npm 11.12.1
- Git 2.51.0
- Docker, Podman, uv, Poetry, pnpm, and Yarn were not available
- FastAPI, Pydantic, Uvicorn, Jinja2, Pytest, and HTTPX were initially absent

After explicit user authorization, a local `.venv` was created and the pinned
dependencies in `backend/requirements.txt` were installed. `pip check` reported
no broken requirements.

Implemented foundation:

- Central environment-backed configuration.
- Standard success and error envelopes with UTC timestamp and correlation ID.
- Central handlers for application, validation, HTTP, and unexpected errors.
- `GET /api/health`.
- Preliminary Pydantic project models without persistence or an API.
- Server-rendered frontend shell with the four requested navigation areas.
- Twenty synthetic requirements.
- Postman health request and preliminary project documentation.
- Five automated tests for health, request IDs, success envelopes, error
  envelopes, and standardized 404 handling.

Verified results:

- Python compilation: passed.
- JSON validation: passed for Postman and sample-data files.
- Synthetic requirement count: 20.
- Tests: 5 passed, 0 failed, 0 warnings in the final run.
- Live health request: HTTP 200 with `status=healthy`,
  `generator_mode=deterministic`, and the supplied request ID.
- Live frontend request: HTTP 200 and returned all four navigation labels.
- Final source footprint excluding `.venv` and caches: 33 files, 51,904 bytes.
- Uvicorn process started on `127.0.0.1:8000`.

Known limitations:

- Docker files are optional references requested by Prompt 2. They are not an
  approved or verified runtime because Docker is unavailable.
- No interactive browser backend was available for a visual smoke test. The
  page was verified through a live HTTP request and returned HTML.
- Python 3.14 is verified locally; compatibility with the target Cognizant
  laptop must be confirmed.
- Workflow persistence and every business agent remain deferred.

## Appendix A — Verbatim Prompt 1

```text
Prompt 1 — Analysis and specification
Run this in /plan mode.

You are my senior software architect and pair-programming partner for a time-boxed Cognizant Codex hackathon.

PROJECT:SDLC Agentic Framework — End-to-End New Feature Development Automation

TRACK: Theme B — Application Development (Greenfield Development)

OFFICIAL USE CASE:

The SDLC Agentic Framework converts raw feature requirements into structured and traceable software-development artifacts.

It connects requirement input, previous project knowledge, BRD generation, backlog decomposition, sprint planning, code generation, code review, sanity testing, QA handoff and knowledge updates through an orchestrated set of specialised agents.

The business problem is repetitive manual handoffs between requirement analysis, planning, development and testing. This causes inconsistent documentation, lost context, incomplete QA handoffs, weak requirement-to-test traceability, rework and slower delivery.

APPROVED MVP DIRECTION:

The complete official vision is too large for a hackathon. Plan one complete vertical workflow:

Raw feature requirement
→ Requirement analysis
→ BRD generation
→ Human approval
→ User-story generation
→ Acceptance-criteria generation
→ Human approval
→ Test-case generation
→ Traceability matrix
→ QA handoff

Code generation, GitHub integration, Jira integration, CI/CD execution, deployment, real enterprise knowledge graphs and release automation are out of scope unless time remains after the complete MVP works.

CONSTRAINTS:

- All code must be created during the hackathon.
- The application must run locally on a Cognizant Windows laptop.
- Do not use AWS, Terraform or cloud infrastructure.
- Do not require paid or unapproved APIs.
- Use synthetic data only.
- Do not hardcode credentials.
- Prefer a complete working MVP over additional features.
- The final source ZIP must remain below 150 MB.
- Exclude node_modules, .venv, caches, logs and generated binaries.
- Do not invent business requirements without labelling them as assumptions.
- Human approval gates are mandatory.
- Outputs must remain traceable from requirement to test case.
- If no runtime LLM API is available, specialised agents may use deterministic rules and structured templates. This limitation must be stated honestly.

PHASE 1 TASKS:

1. Restate the problem and business value.
2. Identify target users.
3. Separate:
   - Confirmed requirements
   - Assumptions requiring approval
   - Ambiguities
   - Out-of-scope features
4. Define the smallest complete MVP.
5. Define each specialised agent:
   - Requirement Analyst Agent
   - BRD Agent
   - Backlog Agent
   - QA Agent
   - Traceability Agent
   - QA Handoff Agent
6. For every agent, define:
   - Responsibility
   - Input
   - Output
   - Validation rules
   - Failure behaviour
7. Define mandatory human-approval gates.
8. Design the workflow states and permitted transitions.
9. Design the data model for:
   - Project
   - Raw requirement
   - Structured requirement
   - BRD
   - User story
   - Acceptance criterion
   - Test case
   - Approval decision
   - Traceability link
   - QA handoff
10. Use stable identifiers:
   - REQ-001
   - BRD-001
   - STORY-001
   - AC-001
   - TC-001
11. Propose the minimum APIs and UI screens.
12. Define acceptance criteria using Given/When/Then.
13. Define happy paths, rejection paths, invalid state transitions, duplicate submissions, missing fields and orphan-traceability scenarios.
14. Define responsible-AI and security controls.
15. Recommend the simplest locally runnable stack.
16. Propose the architecture and folder structure.
17. Divide implementation into Phases 2–5.
18. Identify the three strongest video-demonstration scenarios.
19. Identify risks that may block delivery.
20. Classify every proposed feature as:
   - MUST HAVE
   - SHOULD HAVE
   - DROP

IMPORTANT:

- Do not create or modify files.
- Do not write code.
- Do not install anything.
- Do not begin implementation.
- Challenge unnecessary complexity.
- Stop after completing the specification.

END YOUR RESPONSE WITH THIS EXACT SECTION:

## PHASE_1_HANDOFF

Include:
- Approved problem summary
- Proposed MVP
- Selected technology stack
- Agent list
- Workflow states
- Data entities
- APIs
- UI screens
- Must-have features
- Out-of-scope features
- Acceptance criteria
- Test categories
- Security controls
- Unresolved decisions
- Recommended Phase 2 actions

Then write:

PHASE 1 STATUS: AWAITING HUMAN APPROVAL
After Prompt 1
Review the answer. If acceptable, reply:

I approve Phase 1 with the following corrections:

[WRITE CORRECTIONS, OR WRITE “No corrections.”]

Regenerate only the final PHASE_1_HANDOFF incorporating these corrections.
Do not create files or begin Phase 2.
```

## Appendix B — Verbatim Prompt 2

```text
Proceed with Phase 2: Project Scaffolding and Executable Foundation.

The approved Phase 1 handoff is provided below:

[PASTE THE APPROVED PHASE_1_HANDOFF HERE]

PHASE 2 OBJECTIVE:

Create a clean project foundation that builds and runs locally before implementing the complete business workflow.

EXECUTION RULES:

- Inspect the current directory first.
- Confirm that this is the correct empty project directory.
- Inspect available Python, Node.js, package-manager and Docker versions.
- Do not assume any tool is installed.
- Do not overwrite unrelated files.
- Ask before installing unavailable dependencies.
- Use only the approved stack.
- Do not implement the full business workflow yet.
- Execute commands and verify results rather than claiming they work.

CREATE OR ADAPT THIS STRUCTURE:

project-root/
├── README.md
├── ARCHITECTURE.md
├── PROMPTS.md
├── PLAN.md
├── SECURITY.md
├── FIELD-MAPPING.md
├── .gitignore
├── backend/
│   ├── requirements.txt
│   ├── src/
│   │   ├── api/
│   │   ├── agents/
│   │   ├── orchestrator/
│   │   ├── models/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── validators/
│   │   └── main.py
│   └── tests/
├── frontend/
├── postman/
│   └── collection.json
├── sample-data/
│   └── sample-requirements.json
├── Dockerfile
└── docker-compose.yml

PHASE 2 TASKS:

1. Inspect the environment and report available runtimes.
2. Create the project structure.
3. Create the minimum backend application.
4. Implement only:
   - Health endpoint
   - Central configuration
   - Standard response envelope
   - Central error handling
   - Basic project model placeholder
5. Create the minimum frontend shell only if the approved stack includes a frontend.
6. Add navigation placeholders for:
   - New Requirement
   - Workflow Status
   - Traceability
   - QA Handoff
7. Create approximately 20 synthetic feature requirements in sample-data.
8. Create preliminary versions of:
   - README.md
   - ARCHITECTURE.md
   - PLAN.md
   - SECURITY.md
   - FIELD-MAPPING.md
9. In FIELD-MAPPING.md, explain that it maps:
   - Raw requirement input
   - Structured requirement
   - BRD
   - Story
   - Acceptance criterion
   - Test case
10. Add Prompt 1, its outcome, human corrections and Phase 1 decisions to PROMPTS.md.
11. Add this Phase 2 prompt and its result to PROMPTS.md.
12. Create initial unit tests for the health endpoint and response envelope.
13. Start the application.
14. Verify the health endpoint.
15. Run all current tests.
16. Fix scaffolding failures before stopping.

Do not implement BRD generation, backlog generation, test generation or the complete orchestrator yet.

END YOUR RESPONSE WITH:

## PHASE_2_VERIFICATION

Include:
- Files created
- Environment detected
- Commands executed
- Build result
- Health-check result
- Tests executed
- Tests passed and failed
- Known issues
- Human decisions required

## PHASE_2_HANDOFF

Include:
- Confirmed stack
- Confirmed project path
- Backend start command
- Frontend start command
- Test command
- Existing endpoints
- Existing models
- Work remaining for Phase 3
- Any deviations from Phase 1

Then write:

PHASE 2 STATUS: AWAITING HUMAN APPROVAL
Do not run Prompt 3 if the health endpoint or initial tests fail.
```

## Prompt 3 — Core agentic workflow

### Outcome

Implemented a complete deterministic vertical workflow:

```text
Raw requirement
→ Structured requirement
→ BRD
→ BRD approval
→ Stories and acceptance criteria
→ Backlog approval
→ Test cases
→ Traceability matrix
→ QA handoff
```

Implementation decisions:

- SQLite with explicit transactions and project-scoped artifact sequences.
- One active requirement per project.
- Stable `PRJ`, `REQ`, `BRD`, `STORY`, `AC`, `TC`, `APR`, and `QAH` IDs.
- Six specialized deterministic agents with Pydantic output contracts.
- Validation occurs before generated artifact persistence.
- BRD and backlog approvals/rejections are append-only audit records.
- Rejection requires actor, role, and reason.
- Invalid transitions use structured HTTP 409 errors.
- Test generation invokes traceability validation and handoff generation only
  after both approvals.
- The QA handoff contains assumptions, unresolved risks, approval evidence, and
  an explicit no-runtime-LLM disclosure.
- A server-rendered, vanilla-JavaScript UI exposes every workflow stage.

Verified live clean-state result:

- Project `PRJ-001` completed with `REQ-001`, `BRD-001`, two stories, two ACs,
  two tests, 100% traceability, two approvals, and `QAH-001`.
- Duplicate requirement submission returned HTTP 409.
- Backlog generation before BRD approval returned HTTP 409.
- Test generation before backlog approval returned HTTP 409.
- Project `PRJ-002` demonstrated BRD rejection, mandatory reason capture,
  blocked backlog, stable `BRD-001`, and revision increment to 2.
- UI HTML, CSS, and JavaScript returned HTTP 200.
- Interactive browser automation was unavailable; UI content and assets were
  verified over live HTTP and JavaScript syntax was checked with Node.
- Final automated suite: 14 passed, 0 failed, 0 warnings.
- Python compilation, dependency consistency, Postman JSON, sample JSON, and
  JavaScript syntax checks passed.
- Final source footprint excluding `.venv`, caches, and SQLite data: 47 files,
  165,894 bytes.

### Verbatim user prompt

```text
Prompt 3 — Core agentic workflow
Proceed with Phase 3: Core Agentic Workflow Implementation.

PHASE 3 OBJECTIVE:

Implement one complete and demonstrable vertical workflow:

Raw requirement
→ Structured requirement
→ BRD
→ BRD approval
→ User stories and acceptance criteria
→ Backlog approval
→ Test cases
→ Traceability matrix
→ QA handoff

EXECUTION RULES:

- Inspect the existing project before editing.
- Preserve the approved architecture.
- Do not introduce new frameworks without approval.
- Keep API, orchestration, agent logic, validation and persistence separated.
- Use deterministic outputs when no approved runtime LLM is available.
- Never pretend deterministic output was generated by an LLM.
- Validate every generated artifact before persistence.
- Human approval gates must block downstream processing.
- Run relevant tests after each workflow increment.
- Update documentation as implementation decisions change.

IMPLEMENT IN THIS ORDER:

1. Domain models and persistence
2. Stable ID generation
3. Requirement Analyst Agent
4. BRD Agent
5. BRD approval/rejection
6. Backlog Agent
7. Acceptance-criteria generation
8. Backlog approval/rejection
9. QA Test Agent
10. Traceability Agent
11. QA Handoff Agent
12. Workflow Orchestrator
13. Required API endpoints
14. Minimum UI workflow

MANDATORY BUSINESS RULES:

- Empty requirements must be rejected.
- Duplicate submissions must be detected.
- Every project must have a unique ID.
- BRD generation must create stable requirement IDs.
- Backlog generation must be blocked until BRD approval.
- Test generation must be blocked until backlog approval.
- Every acceptance criterion must map to at least one test case.
- Orphan requirements and untested acceptance criteria must be flagged.
- Rejections must record a reason.
- Invalid workflow transitions must return a structured conflict response.
- Approval decisions must be auditable.
- QA handoff must include assumptions and unresolved risks.

MINIMUM ENDPOINTS:

- POST /api/projects
- POST /api/projects/{projectId}/requirements
- POST /api/projects/{projectId}/analyse
- POST /api/projects/{projectId}/brd/generate
- POST /api/projects/{projectId}/brd/approve
- POST /api/projects/{projectId}/brd/reject
- POST /api/projects/{projectId}/backlog/generate
- POST /api/projects/{projectId}/backlog/approve
- POST /api/projects/{projectId}/backlog/reject
- POST /api/projects/{projectId}/tests/generate
- GET /api/projects/{projectId}/traceability
- GET /api/projects/{projectId}/qa-handoff
- GET /api/projects/{projectId}
- GET /health

Adapt endpoint names only when technically justified.

MINIMUM UI:

1. Enter raw requirement.
2. View structured analysis.
3. Generate and review BRD.
4. Approve or reject BRD.
5. Generate and review backlog.
6. Approve or reject backlog.
7. Generate tests.
8. View traceability matrix.
9. View QA handoff.

VERIFICATION:

1. Start from a clean local state.
2. Execute the successful workflow.
3. Verify that backlog generation fails before BRD approval.
4. Verify that tests cannot be generated before backlog approval.
5. Verify one rejection workflow.
6. Verify duplicate handling.
7. Verify the traceability matrix.
8. Run all current tests.
9. Fix confirmed failures.
10. Update README.md, ARCHITECTURE.md, PLAN.md, SECURITY.md and PROMPTS.md.

Do not add GitHub, Jira, CI/CD, deployment, authentication or knowledge-graph integrations.

END YOUR RESPONSE WITH:

## PHASE_3_VERIFICATION

Include:
- Features implemented
- Endpoints implemented
- UI screens implemented
- Successful workflow result
- Approval-gate verification
- Rejection verification
- Duplicate verification
- Tests passed and failed
- Known defects
- Deferred features

## PHASE_3_HANDOFF

Include:
- Final workflow
- Implemented agents
- Business rules
- State transitions
- Endpoint inventory
- Demonstration-ready scenario
- Known limitations
- Required Phase 4 tests
- Security risks requiring review

Then write:

PHASE 3 STATUS: AWAITING HUMAN APPROVAL
Do not proceed if the successful end-to-end workflow is broken.
```

## Post-Phase 3 refinement — Direct execution and agent-network UI

### User requests

- Fix `ModuleNotFoundError: No module named 'backend'` when running
  `python main.py` from `C:\codex\backend\src`.
- Add the eleven-role SDLC agent catalog.
- Improve the visual design and replace raw JSON artifact output with
  presentation-quality UI.

### Result

- `backend/src/main.py` now supports direct execution while preserving package
  imports and the root-module Uvicorn command.
- The exact direct launch was verified from `C:\codex\backend\src`; `/health`
  returned healthy.
- Added eleven stage-colored agent cards with honest status labels:
  4 Active, 1 Partial, and 6 Planned.
- Engineering integrations, sprint execution, knowledge retrieval, and
  knowledge graph remain visually planned rather than falsely implemented.
- Replaced raw structured-requirement, BRD, and QA-handoff JSON with styled
  document sections, pills, metrics, risks, assumptions, and approval history.
- Improved stories, Given/When/Then criteria, tests, coverage, and responsive
  behavior.
- Final regression: 14 tests passed and JavaScript syntax validation passed.
- Interactive browser automation was unavailable; the live UI, CSS, JavaScript,
  eleven agent cards, and direct-launch health endpoint were verified over
  HTTP.

## Prompt 4 — Testing, security and quality

### Request

Proceed with Phase 4 by creating meaningful deterministic tests for health,
projects, requirement validation and analysis, duplicates, both approval
gates and rejection paths, BRD/backlog/test generation, positive/negative/
boundary tests, stable IDs, traceability gaps, QA handoff, invalid IDs and
transitions, malformed input, and controlled repository failures. Reach at
least 70% meaningful coverage; review security and responsible-AI controls;
complete the Postman collection; execute the suite, coverage, live API
scenarios, and update the project documentation without hiding failures.

### Findings and corrections

- QA generation previously created only a positive test for each acceptance
  criterion. The deterministic QA rules were upgraded to `qa-v2`, producing a
  positive, negative, and boundary test per criterion, and artifact validation
  now rejects incomplete type coverage.
- Generic error handling returned a safe response but logged full exception
  text and traceback. Logging was reduced to correlation ID and exception type.
- Test-model imports caused Pytest collection warnings; aliases removed the
  warnings without changing production models.
- The first edited Postman collection contained a missing closing bracket.
  JSON parsing detected it and the collection was corrected before handoff.
- A first live guardrail script read the project ID from the wrong response
  field, causing expected 404s against an empty identifier. The harness was
  corrected to use `data.public_id`, then the scenario passed.
- Local dependency audit found six pip 25.2 vulnerabilities. The isolated
  project environment was upgraded to pip 26.1.2; the repeat audit found none.

### Result

- 28 tests pass with 0 failures and 96.97% line coverage.
- The isolated live happy path completed as `PRJ-001` with 2 stories, 2
  acceptance criteria, 6 test cases, 100% traceability, `QAH-001`, and two
  approvals.
- Live guardrails returned 422 for empty/malformed input and 409 for duplicate
  submission and premature backlog generation. BRD rejection persisted the
  reason and entered `BRD_REJECTED`.
- The Postman collection contains 23 requests across health, complete workflow,
  and negative/guardrail folders.
- The system remains deterministic, labels its generator, exposes assumptions
  and risks, preserves source lineage, and performs no automated deployment or
  release action.

## Post-Phase 4 refinement — Complete 11-agent workflow map

### User request

Show every role from the official eleven-agent reference within the workflow,
because the seven artifact panels made the remaining roles appear absent.

### Result

- Added a connected, numbered 01–11 workflow map spanning requirements,
  planning, engineering, QA, and knowledge stages.
- Preserved honest capability labels: 4 Active, 1 Partial, and 6 Planned.
- Retained the detailed eleven-card catalog beneath the new workflow map.
- Added an automated UI contract test requiring all eleven official role names
  and exactly eleven numbered workflow nodes.
- Live HTML verification found all eleven roles and nodes.
- Final regression: 29 tests passed with 97.11% line coverage; JavaScript
  syntax validation passed.
- Interactive browser inspection was attempted but no browser was available in
  the session.

## Repository alignment and documentation audit

### User request

Audit the complete directory as an expert, align the code and documentation,
update the README wherever required, and leave the project in a high-quality,
mistake-free state.

### Corrections

- Replaced stale phase and placeholder language in source modules, UI copy,
  Postman data, and field-mapping documentation.
- Aligned the `TestSuiteDraft` default rules version with the implemented
  `qa-v2` generator and added a regression assertion.
- Reformatted the QA test generator for consistent readability.
- Added `.dockerignore` and narrowed Docker runtime copies so virtual
  environments, databases, caches, reports, archives, and secrets cannot enter
  the build context.
- Added an optional container health check.
- Rebuilt `README.md` as the authoritative local operator/developer guide,
  including scope, all eleven agents, directory structure, setup, configuration,
  API inventory, demo, tests, reset, security, Docker, and packaging guidance.
- Updated the delivery plan and security documentation to match the repository.

### Verification

- Python compilation passed.
- 29 tests passed with 0 failures and 97.11% line coverage.
- `pip check`, JavaScript syntax, Postman JSON, and sample-data JSON passed.
- Direct startup from `backend/src` passed using an isolated database and port.
- Live verification returned healthy deterministic mode, HTTP 200 for the UI,
  eleven agent nodes, and fourteen OpenAPI paths.
- The sample dataset contains twenty unique, complete synthetic requirements.
- The Postman collection contains twenty-three requests in three folders.
- All six relative README links resolve.
- The source-only payload contains forty-nine files and is approximately
  0.22 MB, below the 150 MB limit.

## Interactive eleven-agent workflow and graph

### User request

Include all eleven official agents under Workflow, update the graph, and
improve the overall application functionality.

### Result

- Added a grouped eleven-agent directory to the desktop workflow navigation.
- Converted all eleven graph nodes into keyboard-accessible controls.
- Added a live agent inspector showing the selected role's exact name,
  responsibility, stage, capability status, and runtime workflow position.
- Added All, Active, Partial, and Planned status filters across graph nodes and
  detail cards.
- Added workflow-state-driven Current, Complete, Waiting, and Deferred markers
  without executing or misrepresenting planned capabilities.
- Made all detailed role cards keyboard-selectable and synchronized them with
  the graph, inspector, and navigation.
- Added responsive layouts and an automated UI contract covering eleven graph
  controls, eleven navigation entries, four filters, and the inspector.
- Live verification confirmed eleven navigation entries, eleven graph nodes,
  eleven cards, four filters, progress/filter logic, and responsive styles.
- Final regression remained 29 passing tests with 97.11% line coverage;
  JavaScript syntax validation passed.
- Interactive browser automation was unavailable, so verification used the
  live served DOM and assets plus automated UI contracts.

## Responsive graph and CSS usability correction

### User request

Fix the agent graph because later agents could not be reached, audit all CSS
components, and improve responsiveness and visual usability.

### Root cause and correction

- The graph had a `min-width` larger than its container while the parent clipped
  overflow, placing its scrollbar outside the visible area.
- Constrained the graph to its parent and moved overflow to the graph viewport.
- Added a visible custom scrollbar, touch panning, scroll snapping, keyboard
  arrow support, previous/next buttons, and live visible-agent feedback.
- Added automatic horizontal centering when an agent is selected from the
  graph, navigation, or detail cards.
- Improved sticky tablet navigation, mobile spacing, responsive graph tracks,
  inspector stacking, full-width mobile approval controls, focus states, and
  reduced-motion behavior.
- Versioned the frontend asset URLs and advanced the MVP to `0.2.0` so an
  already-open browser does not retain the broken pre-fix CSS or JavaScript.
