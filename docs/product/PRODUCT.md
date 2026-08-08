# FlowPilot

## Purpose

FlowPilot is a local AI-assisted requirements-to-QA workflow platform. It converts a requirement into reviewable analysis, BRD, backlog, test, traceability, and QA-handoff artifacts while preserving approval and audit evidence.

## Current user journey

1. Sign in with the local development account and select or create a workspace.
2. Create a workflow and capture a requirement, optionally using deterministic requirement intelligence and sample scenarios.
3. Run analysis and generate a BRD; a reviewer approves or rejects it.
4. Generate a backlog and acceptance criteria; a reviewer approves or rejects it.
5. Generate positive, negative, and boundary QA scenarios, then traceability and a QA handoff.
6. Inspect workflow state, artifacts, review findings, audit history, orchestration runs, and scoped assistant guidance.

Target direction: broaden the governed workflow into AI-assisted SDLC/DevOps capabilities while retaining traceability and human control.

## Product areas

### Current

- New Workflow requirement composer and deterministic readiness guidance
- Workflow library, dashboard, workspaces, and execution timeline
- BRD/backlog review gates, assignments, comments, audit history, and recoverable failures
- QA test artifacts, generated-output review, traceability, and QA handoff
- Requirement, Risk, and Review orchestration agents
- Scoped FlowPilot assistant and keyboard command palette
- Offline quality evaluation of the production generation workflow

### Planned

- Configurable model providers and model-based evaluation
- External engineering integrations and controlled remediation
- Production identity, multi-user permissions, and enterprise RBAC

## Product principles

- AI assists rather than obscures.
- People control important decisions.
- Every generated artifact has useful lineage and traceability.
- Failures should be explainable and recoverable.
- No fake functionality, fake scores, or decorative automation.
- Prefer useful automation to decorative AI.
