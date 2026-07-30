# Delivery Plan

## Delivery summary

| Phase | Milestone | Status |
|---:|---|---|
| 1 | Approved specification and vertical MVP | Completed |
| 2 | Runnable scaffold and executable foundation | Completed |
| 3 | Human-gated end-to-end agentic workflow | Completed |
| 4 | Test, security, and responsible-AI validation | Completed |
| 5 | Submission documentation, demo evidence, and source package | In progress |

## Phase 1: Specification

Milestone: convert the official broad vision into the smallest complete
hackathon workflow.

Completed:

- Problem, value, users, requirements, assumptions, ambiguities, and exclusions
- Six executable agent contracts
- Two mandatory human gates
- Workflow states, stable identifiers, data entities, APIs, and UI
- Given/When/Then acceptance criteria
- Responsible-AI, security, risks, and phased delivery plan

Acceptance criteria:

- [x] One complete requirement-to-QA vertical slice selected
- [x] Assumptions distinguished from confirmed requirements
- [x] Human gates and traceability made mandatory
- [x] Cloud, paid APIs, integrations, and production release excluded

## Phase 2: Executable foundation

Milestone: build and run the approved local stack before business workflow
implementation.

Completed:

- Repository structure and pinned dependencies
- Central configuration
- Health endpoint
- Standard success/error envelopes and request IDs
- Central error handling
- FastAPI-served frontend shell
- Twenty synthetic requirements
- Initial Postman collection and documentation

Acceptance criteria:

- [x] Local virtual environment installs successfully
- [x] Application starts on `127.0.0.1`
- [x] Health endpoint returns a deterministic-mode disclosure
- [x] Initial tests pass
- [x] No BRD/backlog/test workflow implemented prematurely

## Phase 3: Core agentic workflow

Milestone: implement the complete gated workflow from raw requirement to QA
handoff.

Completed:

- Transactional SQLite repository and stable ID sequences
- Requirement Analyst, BRD, Backlog, QA Test, Traceability, and QA Handoff
  agents
- BRD and backlog approval/rejection
- Positive, negative, and boundary test generation
- Traceability matrix and gap detection
- QA handoff with assumptions, risks, and approval evidence
- Complete API and responsive workflow UI
- Eleven-role target graph with honest capability labels

Acceptance criteria:

- [x] Empty requirements rejected
- [x] Duplicates detected
- [x] Backlog blocked before BRD approval
- [x] Tests blocked before backlog approval
- [x] Rejections require and retain a reason
- [x] Invalid transitions return structured conflicts
- [x] Every acceptance criterion maps to required test types
- [x] QA handoff requires valid traceability
- [x] Direct `python main.py` execution works from `backend\src`

## Phase 4: Testing, security, and quality

Milestone: prove business rules, error handling, security controls, and
responsible-generation behavior.

Completed:

- Twenty-nine independent deterministic tests
- 97.11 percent meaningful line coverage
- Happy, rejection, malformed, duplicate, barrier, traceability-gap, and
  repository-failure paths
- Input, injection, rendering, CORS, file-access, logging, and dependency review
- Complete 23-request Postman collection
- Responsive eleven-agent graph and UI contract

Acceptance criteria:

- [x] All requested test categories covered
- [x] Zero test failures and no hidden warnings
- [x] Coverage exceeds 70 percent
- [x] Approval gates cannot be bypassed
- [x] Deterministic output is not represented as LLM output
- [x] Assumptions, risks, source lineage, and human decisions remain visible
- [x] No automated deployment or release action exists
- [x] Local dependency audit reports no known vulnerabilities

## Phase 5: Documentation, demonstration, and submission

Milestone: produce an honest, runnable, reviewable, source-only submission.

Completed so far:

- README requirement audit
- Mermaid architecture and state/data-flow documentation
- Prompt and human-decision audit trail
- Threat and responsible-AI review
- Explicit field and identifier mapping
- Source/build exclusion rules

Acceptance criteria:

- [x] README contains problem, value, scope, stack, setup, run, API examples,
  tests, demo, assumptions, limitations, and future enhancements
- [x] Architecture contains components, Mermaid diagrams, agents, gates,
  traceability, data flow, and decisions
- [x] Prompt log shows chronological purpose, corrections, accepted/rejected
  suggestions, defects, and verification evidence
- [x] Plan contains all phases, milestones, acceptance criteria, and deferrals
- [x] Security document contains threats, controls, responsible-AI, residual
  risks, and synthetic-data rules
- [x] Field mapping covers every required artifact transformation and ID
- [ ] Clean installation/startup command verified for final source state
- [ ] Happy path and rejection/guardrail demonstrations rerun
- [ ] Complete suite and coverage rerun
- [ ] Source-only ZIP created, inspected, and confirmed below 150 MB

## Deferred items

- Knowledge retrieval and enterprise knowledge graph
- Sprint planning execution
- Sandboxed solution and code generation
- Git operations and code review
- Automated sanity-test execution
- GitHub, Jira, CI/CD, deployment, and release automation
- Runtime LLM integration
- Authentication, RBAC, CSRF protection, and rate limiting
- Multi-user concurrency, production scaling, and tamper-evident audit storage
- Multiple requirements per project and manual artifact editing

## Known limitations

- One active requirement per project
- Local, synchronous, single-user execution
- Reviewer identity is attribution only
- SQLite is unencrypted and optimized for local MVP use
- No global idempotency key or request-body limiter beyond field constraints
- Docker execution is unverified because Docker is unavailable
- Interactive browser, accessibility, and visual-regression testing remain
  incomplete
- Dependency licenses require final organizational review
- Final execution must still be repeated on the target Cognizant laptop
